/**
 * De verliesbewaking van de merge-writer (#804 fase 1b; fixronde 1 van #867, BLOKKEERT 3, 4 en 5).
 *
 * Regel: de verliesbewaking vergelijkt met de bron, nooit met de eigen uitvoer. Elk veld dat de bron had (ook in een
 * P-stuk, een hulpentiteit, een pset, een JSON-sleutel of een constant slot) en dat de uitvoer niet terug heeft, laat de
 * merge weigeren met `merge-needs-phase2`, tenzij het domein dat veld bewust veranderde.
 *
 * Werkwijze. De lezer leest de bron opnieuw: de stand bij openen, zonder bewerking. De writer schrijft die stand met
 * hetzelfde id-plan als de merge (`writeIfcMergeLines`), dus elk D-stuk en elke volgorderelatie uit `stepIds` (en elke
 * baselinekop) houdt zijn bron-`#id`. Dan paart de bewaking elk P-stuk van de bron met zijn regel in die uitvoer:
 *  1. een vast id met de regel met hetzelfde id (op `#id`, niet op GlobalId: een dubbele GlobalId telt zo gewoon mee);
 *  2. via de eigenaar: een gepaard stuk wijst in slot k naar een P-stuk, de regel van de writer wijst in hetzelfde slot naar
 *     de tegenhanger. Zo krijgt elke hulpentiteit een paar: taak → `IfcTaskTime`, volgorde → `IfcLagTime`, kalender →
 *     `IfcWorkTime` → `IfcRecurrencePattern` → `IfcTimePeriod`, elk stuk → owner history → persoon, organisatie,
 *     applicatie. In een lijst per positie; in een pset en een template per propertynaam;
 *  3. een relatie zonder vast id via haar type en haar gepaarde relating; een `IfcRelDefinesByProperties` via de naam van
 *     haar pset en haar gepaarde eigenaren.
 * Per paar vergelijkt de bewaking elk slot (genormaliseerd: getalnotatie en tekstcodering tellen niet):
 *  - gelijk, of leeg in de bron (`$`, `''`, `*`, `()`): goed;
 *  - een waarde in de bron en `$` in de uitvoer: `constant-slot`;
 *  - een andere waarde: goed als de writer dat slot uit het domein schrijft (`DOMAIN_SLOTS`), anders `constant-slot`
 *    (bijvoorbeeld `DataOrigin` `.USERDEFINED.` van een `IfcTaskTime`);
 *  - JSON in een property: elk sleutelpad van de bron moet in de uitvoer staan, anders `json-sleutel`;
 *  - een lijst die de volgorde draagt (`IfcRelNests`, `IfcRecurrencePattern.TimePeriods`): dezelfde volgorde.
 * Een P-stuk zonder paar terwijl zijn eigenaar in de uitvoer staat (de writer liet het weg): elke waarde die de writer niet
 * kent, telt als verlies. Een property uit het register met een gewone waarde kent de writer (hij laat haar weg als ze
 * leeg of standaard is); JSON met een sleutelpad dat de writer in dit bestand niet schrijft, is `json-sleutel`; een
 * `Description` of `Unit` is `constant-slot`; in `OPS_Assignments` een sleutel te veel `ongebruikte-sleutel`.
 * Een stuk waarvan de eigenaar niet meer in de uitvoer staat, valt buiten de bewaking: met het object vervallen ook zijn
 * gegevens (§4.7).
 *
 * De tabel per entiteittype (wat de bewaking ziet en welke test het bewijst) staat in de PR-body van #867, "Fixronde 1".
 */
import type { ImportResult } from '@/services/importTypes';
import { readIFC } from '../ifcReader';
import { writeIfcMergeLines, type WriteIFCInput, type WriterMergeIds } from '../ifcWriter';
import { PSET } from '../ifcPsets';
import { RESOURCE_TYPE_TO_IFC } from '../ifcConstants';
import { IFC_TASKTIME_SLOTS } from '../ifcTaskSlots';
import {
  DAY_MEASURE_DURATIONS_PROP, DAY_MEASURE_DURATION_KEYS, EXACT_FLOAT_KEYS, EXACT_FLOAT_PROP, EXACT_MINUTES_KEYS, EXACT_MINUTES_PROP,
} from '../dayMeasureIo';
import { WORK_CALENDAR_ARITY, WORK_CONTROL_ARITY, workCalendarSlots, workControlSlots } from '../ifcWorkControlSlots';
import { decodeStepText } from '../stepText';
import type { Classification } from './classify';
import { foreignScanFrom, readerBytes, readerOptions } from './foreignScan';
import type { IfcSource } from './ifcSource';
import { splitStepArgs, type StepIndex } from './stepScanner';
import type { MergePhase2Kind } from './mergeWriter';

/** Een regel van de writer, ontleed. */
interface OutLine { readonly type: string; readonly args: readonly string[] }

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

/** De resource-entiteiten die de writer schrijft, plus de leesalias (zoals `WRITER_ENTITY_TYPES`). */
const RESOURCE_ENTITY_TYPES: readonly string[] = [...new Set([...Object.values(RESOURCE_TYPE_TO_IFC), 'IFCCONSTRUCTIONPRODUCTRESOURCE'])];

/**
 * Slots die de writer uit het domein schrijft, of bij elk opslaan zelf opnieuw zet (de schrijftijd, de versie van de
 * app). Daar mag de uitvoer anders zijn dan de bron, ook `$`: de lezer leest het slot in het domein, en de herlezing
 * geeft hetzelfde domein (dat bewaken de rondes in `check-ifc-foreign-preserve.ts`). Elk ander slot is constant of
 * afgeleid (bijvoorbeeld de naam van het werkplan, gelijk aan de projectnaam): daar moet de bron precies hebben wat de
 * writer schrijft. Een type dat hier niet staat, heeft alleen zulke slots. Posities zoals de writer ze nu schrijft
 * (`alignment` zet een oude lay-out om). Bron: de regels in `ifcWriter.ts` en `ifcTaskSlots.ts`.
 */
export const DOMAIN_SLOTS: Readonly<Record<string, readonly number[]>> = {
  // Name, Description, Identification (WBS-code), Status, IsMilestone, Priority, PredefinedType (`IFC_TASK_SLOTS`).
  IFCTASK: [2, 3, 5, 7, 9, 10, 12],
  // De slots met een `read` in `IFC_TASKTIME_SLOTS`.
  IFCTASKTIME: IFC_TASKTIME_SLOTS.flatMap((slot, i) => (slot.read ? [i] : [])),
  // Description, CreationDate (schrijftijd, of `createdAt` van een baseline), StartTime, FinishTime, PredefinedType. Name
  // niet: het werkplan heet zoals het project, het werkschema 'Construction schedule v1.0', een baseline zoals in het domein.
  IFCWORKPLAN: [3, 6, 11, 12, 13],
  IFCWORKSCHEDULE: [3, 6, 11, 12, 13],
  // Name, Description, PredefinedType (ploeg).
  IFCWORKCALENDAR: [2, 3, 8],
  // StartDate en FinishDate van een feestdag of uitzondering. De naam: zie `workTimeName`.
  IFCWORKTIME: [4, 5],
  // WeekdayComponent; RecurrenceType volgt het soort werktijd (WEEKLY of DAILY) en is afgeleid.
  IFCRECURRENCEPATTERN: [2],
  IFCTIMEPERIOD: [0, 1],
  IFCRELSEQUENCE: [7],
  // LagValue en DurationType (een oude lay-out had ze verwisseld; de lezer kent beide).
  IFCLAGTIME: [3, 4],
  // CreationDate: de schrijftijd.
  IFCOWNERHISTORY: [7],
  // Version: de versie van deze app.
  IFCAPPLICATION: [1],
  // FamilyName (auteur), Name (bedrijf).
  IFCPERSON: [1],
  IFCORGANIZATION: [1],
  IFCPROJECT: [2, 3],
  // De naam en de codes van een codesoort.
  IFCPROPERTYENUMERATION: [0, 1],
  // PrimaryMeasureType: het soort veld.
  IFCSIMPLEPROPERTYTEMPLATE: [5],
  // Name en Description van een resource (de lezer leest alleen die en het GlobalId).
  ...Object.fromEntries(RESOURCE_ENTITY_TYPES.map(t => [t, [2, 3]])),
};

/** Typen waarvan slot 0 een GlobalId is (`IfcRoot`): de writer leidt die af of maakt een dubbele uniek. */
const ROOT_TYPES: ReadonlySet<string> = new Set([
  'IFCPROJECT', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCWORKCALENDAR', 'IFCTASK', 'IFCRELSEQUENCE', 'IFCRELNESTS',
  'IFCRELASSIGNSTOCONTROL', 'IFCRELASSIGNSTOPROCESS', 'IFCRELAGGREGATES', 'IFCRELDECLARES', 'IFCRELDEFINESBYPROPERTIES',
  'IFCPROPERTYSET', 'IFCPROPERTYSETTEMPLATE', 'IFCSIMPLEPROPERTYTEMPLATE', ...RESOURCE_ENTITY_TYPES,
]);

/** Lijsten waarvan de volgorde betekenis heeft (EXPRESS `LIST`), per type en slot. */
const ORDERED: Readonly<Record<string, readonly number[]>> = {
  IFCRELNESTS: [5],
  IFCRECURRENCEPATTERN: [7],
};

/** Het slot met de naam waarop hulpstukken van één type in een lijst paren. Properties en templates paren alleen op naam
 *  (een andere naam is een andere property); een werktijd eerst op naam, dan op positie. */
const NAME_SLOT: Readonly<Record<string, number>> = {
  IFCPROPERTYSINGLEVALUE: 0, IFCPROPERTYENUMERATEDVALUE: 0, IFCSIMPLEPROPERTYTEMPLATE: 2, IFCWORKTIME: 0,
};
const NAME_ONLY: ReadonlySet<string> = new Set(['IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE', 'IFCSIMPLEPROPERTYTEMPLATE']);

const PROPERTY_TYPES: ReadonlySet<string> = new Set(['IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE']);

/**
 * JSON-sleutels die de writer kent maar weglaat als het standaardveld alles zegt (`dayMeasureIo.ts`: een record alleen
 * bij een breuk of minuten). Zo'n sleutel in de bron die de uitvoer niet heeft, is geen verlies: de writer kent hem.
 * Andere sleutels kent de writer alleen als hij ze in dit bestand voor dezelfde property schrijft.
 */
const KNOWN_JSON_KEYS: Readonly<Record<string, readonly string[]>> = {
  [EXACT_FLOAT_PROP]: EXACT_FLOAT_KEYS.map(k => `.${k}`),
  [DAY_MEASURE_DURATIONS_PROP]: DAY_MEASURE_DURATION_KEYS.map(k => `.${k}`),
  [EXACT_MINUTES_PROP]: EXACT_MINUTES_KEYS.map(k => `.${k}`),
};

/**
 * De naam van een werktijd zonder datums (een werkweek) leest de lezer niet: de writer schrijft er zijn eigen label
 * (`writeCalendar`). Dat label mag dus anders zijn, maar alleen als de bron ook een label van OPS heeft: 'Standard work
 * week', met of zonder dagen, of 'Standaard werkweek' (versies vóór #39). Een andere naam komt van een ander programma.
 */
/** De naam van het live-werkschema schrijft de writer vast; versies vóór #39 schreven 'Bouwplanning v1.0'. */
const OPS_SCHEDULE_LABEL = /^(Construction schedule v1\.0|Bouwplanning v1\.0)$/;
const OPS_WORK_WEEK_LABEL = /^(Standard work week( \((Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d+)(, (Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d+))*\))?|Standaard werkweek)$/;

/**
 * Bron-slot → uitvoer-slot (-1: de uitvoer heeft dat slot niet), voor de oude eigen lay-outs die de lezer kent
 * (`ifcWorkControlSlots.ts`, `IfcTask` met 12 argumenten). Zelfde aantal en geen oude lay-out: per positie. `undefined`:
 * een ander aantal zonder bekende lay-out; dan alleen de hulpstukken paren, per type (§4.5: uit een oude lay-out worden
 * geen slots bewaard).
 */
function alignment(type: string, src: readonly string[], outLength: number): number[] | undefined {
  const identity = (k: number) => (k < outLength ? k : -1);
  if (type === 'IFCWORKPLAN' || type === 'IFCWORKSCHEDULE') {
    if (outLength !== WORK_CONTROL_ARITY) return undefined;
    const slots = workControlSlots(src);
    return src.map((_, k) => k === slots.startTime ? 11 : k === slots.finishTime ? 12 : k === slots.predefinedType ? 13 : k <= 10 ? k : -1);
  }
  if (type === 'IFCWORKCALENDAR') {
    if (outLength !== WORK_CALENDAR_ARITY) return undefined;
    const slots = workCalendarSlots(src);
    return src.map((_, k) => k === slots.workingTimes ? 6 : k === slots.exceptionTimes ? 7 : k === slots.predefinedType ? 8 : k <= 4 ? k : -1);
  }
  if (type === 'IFCTASK' && src.length === 12 && outLength === 13) {
    // Zonder WorkMethod (8): de vier slots erna staan één plek eerder (`IFC_TASK_SLOTS`).
    return src.map((_, k) => (k < 8 ? k : k + 1));
  }
  if (src.length === outLength) return src.map((_, k) => identity(k));
  return undefined;
}

/** Wat de bewaking meldt. In de meetstand (`collect`) ook de slots die een `DOMAIN_SLOTS`-regel vrijgaf. */
export interface LossFinding { kind: MergePhase2Kind; chunk: number; detail: string }

export interface LossCheckInput {
  readonly index: StepIndex;
  readonly cls: Classification;
  readonly source: IfcSource;
  /** Het id-plan van de merge (dezelfde vaste ids). */
  readonly plan: WriterMergeIds;
  /** De ids van de regels die de merge echt schrijft (na bewerking). */
  readonly emitted: ReadonlySet<number>;
  /** Het document dat de merge schrijft (voor auteur en bedrijf). */
  readonly input: WriteIFCInput;
  /** De eerste owner history die de lezer ziet, als die van de bron is (C of A, vóór het eerste P-stuk); anders -1. */
  readonly sourceOwnerHistory: number;
  /** Meetstand: ook de vrijgegeven domeinslots melden, als `kind` `'domein'` (alleen voor de proef). */
  readonly collect?: (finding: { type: string; arg: number; source: string; out: string; chunk: number }) => void;
}

/** Vergelijk bron en uitvoer van de writer zonder bewerking. Elk verlies gaat naar `report`. */
export function lossCheck(input: LossCheckInput, report: (f: LossFinding) => void): void {
  const { index, cls, source, plan, emitted } = input;
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (i: number) => Number(index.id(i));
  const label = (i: number) => `${index.type(i)} #${index.id(i)}`;

  // ── De stand bij openen, geschreven met het id-plan van de merge ──
  const scan = foreignScanFrom(index, cls, source.bytes);
  const text = new TextDecoder('utf-8').decode(readerBytes(source.bytes, scan));
  const pristine: ImportResult = readIFC(text, {}, { ...readerOptions(scan), skipBuildingModelGuard: true });
  const written = writeIfcMergeLines(pristine, plan);
  const out = new Map<number, OutLine>();
  for (const line of written.lines) {
    const m = LINE.exec(line);
    if (m) out.set(Number(m[1]), { type: m[2], args: splitStepArgs(m[3]) });
  }
  const outDecode = (tok: string) => decodeStepText(unquote(tok));

  // ── Paren ──
  const matched = new Uint8Array(n);
  /** Bron-stuk → zijn tegenhangers in de uitvoer. */
  const pairedOut = new Map<number, number[]>();
  const usedOut = new Set<number>();
  const seenPair = new Set<string>();
  const queue: [number, number][] = [];
  const pair = (s: number, o: number) => {
    const key = `${s}|${o}`;
    if (seenPair.has(key)) return;
    seenPair.add(key);
    matched[s] = 1;
    usedOut.add(o);
    const list = pairedOut.get(s);
    if (list) list.push(o); else pairedOut.set(s, [o]);
    queue.push([s, o]);
  };
  /** Bron-stuk → uitvoer-id (de eerste tegenhanger). Een niet-P-stuk staat met zijn eigen id in de uitvoer. */
  const outIdOf = (s: number): number | undefined => {
    if (s < 0) return undefined;
    if (!isP(s)) return sid(s);
    return pairedOut.get(s)?.[0];
  };
  // 1. Vaste ids.
  const fixed = new Set<number>([...plan.keep.values(), ...plan.baselineHeads.values()]);
  for (const id of fixed) {
    const s = index.chunkOf(String(id));
    if (s >= 0 && isP(s) && out.get(id)?.type === index.type(s)) pair(s, id);
  }

  // 3. Relaties zonder vast id: per sleutel (type en relating, of pset-naam en eigenaren).
  const relKeySource = (r: number): string | undefined => {
    const t = index.type(r);
    if (t === 'IFCRELDEFINESBYPROPERTIES') {
      const pset = index.refAt(r, 5);
      const owners = index.refsAt(r, 4).map(outIdOf);
      if (pset < 0 || owners.some(o => o === undefined)) return undefined;
      return `${t}|${index.type(pset)}|${index.name(pset) ?? ''}|${(owners as number[]).sort((x, y) => x - y).join(',')}`;
    }
    const pos = RELATING[t];
    if (pos === undefined) return undefined;
    const relating = outIdOf(index.refAt(r, pos));
    return relating === undefined ? undefined : `${t}|${relating}`;
  };
  const relKeyOut = (line: OutLine): string | undefined => {
    if (line.type === 'IFCRELDEFINESBYPROPERTIES') {
      const pset = out.get(refOf(line.args[5]));
      if (!pset) return undefined;
      const owners = refList(line.args[4]).sort((x, y) => x - y);
      const name = pset.type === 'IFCPROPERTYSET' ? outDecode(pset.args[2]) : '';
      return `${line.type}|${pset.type}|${name}|${owners.join(',')}`;
    }
    const pos = RELATING[line.type];
    if (pos === undefined) return undefined;
    return `${line.type}|${refOf(line.args[pos])}`;
  };
  const outRels = new Map<string, number[]>();
  for (const [id, line] of out) {
    if (fixed.has(id)) continue;
    const key = relKeyOut(line);
    if (key === undefined) continue;
    const list = outRels.get(key);
    if (list) list.push(id); else outRels.set(key, [id]);
  }
  const relDone = new Uint8Array(n);
  const pairRelations = () => {
    for (let r = 0; r < n; r++) {
      if (relDone[r] || !index.isEntity(r) || !isP(r) || !cls.inR[r] || fixed.has(sid(r))) continue;
      const key = relKeySource(r);
      if (key === undefined) continue;
      relDone[r] = 1;
      const candidates = outRels.get(key) ?? [];
      if (candidates.length === 0) continue;
      // Meer kandidaten: eerst hetzelfde GlobalId, anders de eerste nog vrije.
      const guid = index.globalId(r);
      const byGuid = candidates.find(o => unquote(out.get(o)!.args[0]) === guid);
      const free = candidates.find(o => !usedOut.has(o));
      pair(r, byGuid ?? free ?? candidates[0]);
    }
  };

  // 2. Via de eigenaar, met de relaties tussendoor, tot er niets meer bij komt.
  const process = () => {
    while (queue.length > 0) {
      const [s, o] = queue.shift()!;
      compare(s, o);
    }
  };
  process();
  for (;;) {
    const before = seenPair.size;
    pairRelations();
    process();
    if (seenPair.size === before) break;
  }

  function compare(s: number, o: number): void {
    const line = out.get(o);
    const type = index.type(s);
    if (!line) return;
    if (line.type !== type) {
      report({ kind: 'constant-slot', chunk: s, detail: `${label(s)} wordt ${line.type}` });
      return;
    }
    const a = index.argTokens(s);
    if (!a) return;
    const b = line.args;
    const map = alignment(type, a, b.length);
    if (!map) {
      // Een oude lay-out zonder bekende indeling: geen slots te vergelijken (§4.5), wel de hulpstukken paren.
      const targets: number[] = [];
      for (let k = index.outStart(s); k < index.outEnd(s); k++) if (index.outTarget(k) >= 0) targets.push(index.outTarget(k));
      pairGroup(targets, b.flatMap(t => refList(t)));
      return;
    }
    for (let k = 0; k < a.length; k++) {
      const at = a[k].trim();
      const k2 = map[k];
      if (k2 < 0) {
        if (!isEmpty(at)) report({ kind: 'constant-slot', chunk: s, detail: `${label(s)}, argument ${k}: ${at.slice(0, 40)} heeft geen plek in de uitvoer` });
        continue;
      }
      compareSlot(s, type, k, k2, at, b[k2].trim());
    }
  }

  /** Slot `k` van de bron tegen slot `k2` van de uitvoer (dezelfde betekenis). */
  function compareSlot(s: number, type: string, k: number, k2: number, at: string, bt: string): void {
    if (isEmpty(at)) return;
    if (k2 === 0 && ROOT_TYPES.has(type)) return; // GlobalId: afgeleid, of uniek gemaakt
    const where = `${label(s)}, argument ${k}`;
    if (isRefToken(at)) {
      const targets = index.refsAt(s, k);
      if (!isRefToken(bt)) {
        // De writer schrijft hier geen verwijzing. Naar een P-stuk: dat stuk krijgt geen paar, en de bewaking van stukken
        // zonder paar ziet wat er verloren gaat. Naar een stuk buiten P: de verwijzing zelf gaat verloren.
        if (bt === '$' && targets.every(isP)) return;
        report({ kind: 'constant-slot', chunk: s, detail: `${where}: ${at.slice(0, 40)} → ${bt.slice(0, 40)}` });
        return;
      }
      const outIds = refList(bt);
      // In `OPS_Assignments` paart een sleutel op zijn resource: `GUID#N` (nu) en de kale `GUID` (oude bestanden) zijn
      // dezelfde soort sleutel; per resource telt de bewaking het aantal (`ongebruikte-sleutel`).
      const keyOf = type === 'IFCPROPERTYSET' && k2 === 4 && index.name(s) === PSET.Assignments ? assignmentKey : undefined;
      pairGroup(targets, outIds, t => report({ kind: 'constant-slot', chunk: s, detail: `${where}: ${label(t)} staat er niet meer in` }), keyOf);
      if (ORDERED[type]?.includes(k2)) {
        // De volgorde van de bron, in uitvoer-ids, moet de volgorde van de uitvoer zijn.
        const want = targets.map(outIdOf).filter((x): x is number => x !== undefined && outIds.includes(x));
        const got = outIds.filter(id => want.includes(id));
        if (want.join(',') !== got.join(',')) report({ kind: 'constant-slot', chunk: s, detail: `${where}: een andere volgorde` });
      }
      return;
    }
    const srcDecode = (tok: string) => index.tokenText(s, tok);
    if (PROPERTY_TYPES.has(type) && k2 === 0) return; // de naam: daarop is gepaard
    if (PROPERTY_TYPES.has(type) && k2 === 2) {
      // De waarde van een property komt uit het domein; haar JSON-sleutels moeten terugkomen.
      jsonCheck(s, jsonOfToken(at, srcDecode), jsonOfToken(bt, outDecode));
      return;
    }
    const domain = DOMAIN_SLOTS[type]?.includes(k2) === true
      || (type === 'IFCWORKTIME' && k2 === 0 && workTimeName(s, at, bt))
      || (type === 'IFCWORKSCHEDULE' && k2 === 2 && scheduleName(s, at, bt));
    if (domain) {
      if (norm(at, srcDecode) !== norm(bt, outDecode)) input.collect?.({ type, arg: k2, source: at, out: bt, chunk: s });
      return;
    }
    if (bt === '$' || norm(at, srcDecode) !== norm(bt, outDecode)) {
      report({ kind: 'constant-slot', chunk: s, detail: `${where}: ${at.slice(0, 40)} → ${bt.slice(0, 40)}` });
    }
  }

  /** De naam van een werktijd: van een feestdag of uitzondering (met datums) uit het domein; van een werkweek het label
   *  van de writer, zolang de bron ook een label van OPS heeft (`OPS_WORK_WEEK_LABEL`). */
  function workTimeName(s: number, at: string, bt: string): boolean {
    const a = index.argTokens(s) ?? [];
    const hasDates = !isEmpty((a[4] ?? '$').trim()) || !isEmpty((a[5] ?? '$').trim());
    if (hasDates) return true;
    return OPS_WORK_WEEK_LABEL.test(index.tokenText(s, at)) && OPS_WORK_WEEK_LABEL.test(outDecode(bt));
  }

  /** De naam van een werkschema: van een baseline uit het domein; van het live-werkschema het vaste label van de writer,
   *  zolang de bron ook dat label heeft (`OPS_SCHEDULE_LABEL`). */
  function scheduleName(s: number, at: string, bt: string): boolean {
    const a = index.argTokens(s) ?? [];
    if (a[workControlSlots(a).predefinedType]?.trim() === '.BASELINE.') return true;
    return OPS_SCHEDULE_LABEL.test(index.tokenText(s, at)) && OPS_SCHEDULE_LABEL.test(outDecode(bt));
  }

  function jsonCheck(s: number, src: unknown, got: unknown): void {
    if (src === undefined) return;
    const have = new Set([...(got === undefined ? [] : keyPaths(got)), ...(KNOWN_JSON_KEYS[index.name(s) ?? ''] ?? [])]);
    const extra = keyPaths(src).find(path => !have.has(path));
    if (extra !== undefined) report({ kind: 'json-sleutel', chunk: s, detail: `${label(s)} (${index.name(s)}): ${extra}` });
  }

  /** Paar de P-stukken in `targets` met de stukken in `outIds`, per type: wat al een paar heeft blijft (een D-object met
   *  een vast id), dan op naam (`NAME_SLOT`), dan op positie (niet voor properties en templates). */
  function pairGroup(
    targets: readonly number[], outIds: readonly number[], missing?: (t: number) => void, keyOf: (name: string) => string = x => x,
  ): void {
    const outByType = new Map<string, number[]>();
    for (const id of outIds) {
      const line = out.get(id);
      if (!line) continue;
      const list = outByType.get(line.type);
      if (list) list.push(id); else outByType.set(line.type, [id]);
    }
    const srcByType = new Map<string, number[]>();
    for (const t of targets) {
      if (t < 0 || !isP(t)) continue;
      const list = srcByType.get(index.type(t));
      if (list) list.push(t); else srcByType.set(index.type(t), [t]);
    }
    for (const [type, src] of srcByType) {
      let left = [...(outByType.get(type) ?? [])];
      let todo = src.filter(t => {
        const o = outIdOf(t);
        if (o !== undefined && left.includes(o)) { left = left.filter(x => x !== o); if (!inD[t]) pair(t, o); return false; }
        // Een D-object met een paar dat hier niet staat: de writer zet het niet in deze relatie.
        if (o !== undefined && inD[t]) { missing?.(t); return false; }
        return true;
      });
      const nameSlot = NAME_SLOT[type];
      if (nameSlot !== undefined) {
        todo = todo.filter(t => {
          const name = keyOf(index.tokenText(t, index.argTokens(t)?.[nameSlot]));
          const o = left.find(id => keyOf(outDecode(out.get(id)!.args[nameSlot])) === name);
          if (o === undefined) return true;
          left = left.filter(x => x !== o);
          pair(t, o);
          return false;
        });
      }
      if (NAME_ONLY.has(type)) continue;
      for (let j = 0; j < Math.min(todo.length, left.length); j++) pair(todo[j], left[j]);
    }
  }

  // ── Stukken zonder paar ──
  // Levend: een D-stuk dat de merge schrijft (een vast id in `emitted`, of zonder vast id), en wat het bereikt via P-stukken;
  // een relatie waarvan elk D-stuk leeft.
  const alive = new Uint8Array(n);
  const stack: number[] = [];
  const aliveD = (i: number) => !fixed.has(sid(i)) || emitted.has(sid(i));
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || !isP(i)) continue;
    if (inD[i]) { if (aliveD(i)) stack.push(i); continue; }
    if (cls.inR[i]) {
      let ok = true;
      for (let k = index.outStart(i); k < index.outEnd(i) && ok; k++) {
        const t = index.outTarget(k);
        if (t >= 0 && inD[t] && !aliveD(t)) ok = false;
      }
      if (ok) stack.push(i);
    }
  }
  while (stack.length > 0) {
    const x = stack.pop()!;
    if (alive[x]) continue;
    alive[x] = 1;
    for (let k = index.outStart(x); k < index.outEnd(x); k++) {
      const t = index.outTarget(k);
      if (t >= 0 && isP(t) && !alive[t] && !(inD[t] && !aliveD(t))) stack.push(t);
    }
  }
  // De sleutelpaden die de writer per propertynaam in dit bestand schrijft.
  const vocabulary = new Map<string, Set<string>>();
  for (const line of out.values()) {
    if (!PROPERTY_TYPES.has(line.type)) continue;
    const json = jsonOfToken(line.args[2] ?? '$', outDecode);
    if (json === undefined) continue;
    const nm = outDecode(line.args[0]);
    let set = vocabulary.get(nm);
    if (!set) vocabulary.set(nm, set = new Set());
    for (const p of keyPaths(json)) set.add(p);
  }
  const assignmentsLeft = new Map<number, Map<string, number>>();
  for (let u = 0; u < n; u++) {
    if (!alive[u] || matched[u]) continue;
    const type = index.type(u);
    const a = index.argTokens(u) ?? [];
    if (PROPERTY_TYPES.has(type)) {
      const pset = ownerPset(index, u);
      if (pset >= 0 && index.name(pset) === PSET.Assignments) {
        const g = assignmentKey(index.name(u) ?? '');
        let m = assignmentsLeft.get(pset);
        if (!m) assignmentsLeft.set(pset, m = new Map());
        m.set(g, (m.get(g) ?? 0) + 1);
        continue;
      }
      for (const k of [1, 3]) {
        if (a[k] !== undefined && !isEmpty(a[k].trim())) report({ kind: 'constant-slot', chunk: u, detail: `${label(u)} (${index.name(u)}), argument ${k}, ontbreekt in de uitvoer` });
      }
      const json = jsonOfToken((a[2] ?? '$').trim(), tok => index.tokenText(u, tok));
      if (json !== undefined) {
        const have = new Set([...(vocabulary.get(index.name(u) ?? '') ?? []), ...(KNOWN_JSON_KEYS[index.name(u) ?? ''] ?? [])]);
        const extra = keyPaths(json).find(p => !have.has(p));
        if (extra !== undefined) report({ kind: 'json-sleutel', chunk: u, detail: `${label(u)} (${index.name(u)}) ontbreekt in de uitvoer: ${extra}` });
      }
      continue;
    }
    if (type === 'IFCPROPERTYSET') {
      if (a[3] !== undefined && !isEmpty(a[3].trim())) report({ kind: 'constant-slot', chunk: u, detail: `${label(u)} (${index.name(u)}), argument 3, ontbreekt in de uitvoer` });
      continue;
    }
    if (cls.inR[u] && !fixed.has(sid(u))) {
      for (const k of [2, 3]) {
        if (a[k] !== undefined && !isEmpty(a[k].trim())) report({ kind: 'constant-slot', chunk: u, detail: `${label(u)}, argument ${k}, ontbreekt in de uitvoer` });
      }
      continue;
    }
    for (let k = 0; k < a.length; k++) {
      const t = a[k].trim();
      if (isEmpty(t) || isRefToken(t) || (k === 0 && ROOT_TYPES.has(type))) continue;
      report({ kind: 'constant-slot', chunk: u, detail: `${label(u)}, argument ${k}, ontbreekt in de uitvoer: ${t.slice(0, 40)}` });
      break;
    }
  }
  // `OPS_Assignments`: per resource niet meer sleutels dan de writer schrijft (§4.2, `unusedKeys`).
  for (const [pset, left] of assignmentsLeft) {
    for (const [g, count] of left) report({ kind: 'ongebruikte-sleutel', chunk: pset, detail: `${label(pset)}: ${count} sleutel(s) voor ${g}` });
  }

  // ── Auteur en bedrijf (§4.4) ──
  // Schrijft de writer het project zelf, dan leest de lezer auteur en bedrijf uit de eerste owner history die hij ziet. Is
  // die van de bron, dan komt een wijziging niet terug.
  if (input.sourceOwnerHistory >= 0 && plan.projectSourceId === undefined) {
    const want = input.input.project;
    if ((want.author ?? '') !== (pristine.project.author ?? '') || (want.company ?? '') !== (pristine.project.company ?? '')) {
      report({
        kind: 'projectgegevens', chunk: input.sourceOwnerHistory,
        detail: `auteur of bedrijf veranderde, maar de lezer leest ze uit ${label(input.sourceOwnerHistory)} van de bron`,
      });
    }
  }
}

/** De resource van een sleutel in `OPS_Assignments`: `GUID#N` of de kale `GUID`. */
const assignmentKey = (name: string) => name.replace(/#\d+$/, '');

/** Argumentpositie van de relating per relatietype zonder vast id. */
const RELATING: Readonly<Record<string, number>> = {
  IFCRELNESTS: 4, IFCRELAGGREGATES: 4, IFCRELDECLARES: 4, IFCRELASSIGNSTOCONTROL: 6, IFCRELASSIGNSTOPROCESS: 6,
  IFCRELSEQUENCE: 4,
};

/** De pset waar een property in staat, of -1. */
function ownerPset(index: StepIndex, prop: number): number {
  for (let k = index.inStart(prop); k < index.inEnd(prop); k++) {
    const p = index.inSource(k);
    if (p >= 0 && index.type(p) === 'IFCPROPERTYSET' && index.inArg(k) === 4) return p;
  }
  return -1;
}

function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.startsWith("'") && t.endsWith("'") && t.length >= 2 ? t.slice(1, -1).replace(/''/g, "'") : '';
}

function isEmpty(t: string): boolean {
  return t === '$' || t === "''" || t === '*' || t === '()' || t === '';
}

/** `#12` of een lijst met alleen verwijzingen. */
function isRefToken(t: string): boolean {
  if (/^#\d+$/.test(t)) return true;
  if (!t.startsWith('(') || !t.endsWith(')')) return false;
  const items = splitStepArgs(t.slice(1, -1));
  return items.length > 0 && items.every(x => /^#\d+$/.test(x.trim()));
}

function refOf(token: string | undefined): number {
  const m = /^#(\d+)$/.exec((token ?? '').trim());
  return m ? Number(m[1]) : -1;
}

function refList(token: string | undefined): number[] {
  const t = (token ?? '').trim();
  if (/^#\d+$/.test(t)) return [Number(t.slice(1))];
  if (!t.startsWith('(') || !t.endsWith(')')) return [];
  return splitStepArgs(t.slice(1, -1)).map(refOf).filter(id => id >= 0);
}

/** Een token als vergelijkbare vorm: getallen als getal, tekst gedecodeerd, verwijzingen als `R`. */
function norm(t: string, decode: (tok: string) => string): string {
  const x = t.trim();
  if (x === '$' || x === '*') return x;
  if (x.startsWith("'")) return `S${decode(x)}`;
  if (x.startsWith('#')) return 'R';
  if (x.startsWith('.')) return `E${x.toUpperCase()}`;
  if (x.startsWith('(') && x.endsWith(')')) return `L(${splitStepArgs(x.slice(1, -1)).map(y => norm(y, decode)).join(',')})`;
  const typed = /^([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/.exec(x);
  if (typed) return `T${typed[1].toUpperCase()}(${norm(typed[2], decode)})`;
  const num = Number(x);
  if (x !== '' && !Number.isNaN(num)) return `N${num}`;
  return x;
}

/** De JSON in een propertywaarde (`IFCTEXT('{…}')`), of `undefined`. Alleen een object of lijst telt. */
function jsonOfToken(t: string, decode: (tok: string) => string): unknown {
  const m = /^IFC\w+\s*\(\s*('[\s\S]*')\s*\)$/i.exec(t.trim());
  if (!m) return undefined;
  const text = decode(m[1]).trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try { return JSON.parse(text) as unknown; } catch { return undefined; }
}

/** Alle sleutelpaden in een JSON-waarde; een lijstpositie telt als `[]`. */
export function keyPaths(value: unknown, prefix = '', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = `${prefix}.${k}`;
      out.push(path);
      keyPaths(v, path, out);
    }
  }
  return out;
}
