/**
 * De verliesbewaking van de merge-writer: de leesverliestoets (#804 fase 1b; fixronde 2 van #867).
 *
 * Regel: de verliesbewaking vergelijkt met de bron, nooit met de eigen uitvoer. Elk veld dat de bron had (ook in een
 * P-stuk, een hulpentiteit, een pset, een JSON-tekst of een constant slot) en dat de uitvoer niet terug heeft, laat de
 * merge weigeren met `merge-needs-phase2`, tenzij het domein dat veld bewust veranderde. Een vrijstelling bewijst geen
 * behoud: er is geen lijst met velden die vooraf veilig heten.
 *
 * Werkwijze. De merge schrijft twee keer met hetzelfde id-plan en dezelfde stappen (`mergeWriter.ts`): O0 voor het domein
 * zoals de lezer het uit de bron las, zonder bewerking (`pristineDomain`), en O1 voor het bewerkte domein.
 *  1. O0: elk P-stuk van de bron moet in O0 veld voor veld gelijk zijn. Elk argument; elke lijst met al haar leden, in
 *     dezelfde volgorde; elke verwijzing (naar een stuk dat niet P is: hetzelfde `#id`; naar een P-stuk: zijn
 *     tegenhanger); elke propertywaarde, ook een enumeratie of een lijst; elke JSON-tekst, teken voor teken. Ook een waarde
 *     in O0 waar de bron niets had, telt. Een P-stuk zonder tegenhanger in O0 telt ook. Elk verschil betekent dat de lezer
 *     dat veld niet draagt: `niet-gedragen`.
 *  2. O1: is O0 gelijk, dan mag een P-stuk in O1 alleen anders zijn (of ontbreken) als een domeinobject waar het bij hoort
 *     veranderde (`changedScopes`). Een stuk hoort bij de taak, resource of volgorderelatie die het bereikt in de bron
 *     (`sourceScopes`); een relatie bij elk object waar zij naar wijst; al het andere bij het project. Een stuk van het
 *     project mag veranderen als er iets in het domein veranderde (de writer leidt er een deel van af uit alle taken,
 *     bijvoorbeeld de begin- en einddatum van het werkplan). Een stuk van een object dat verdween, valt buiten de toets.
 *     Binnen een veranderd object toetst dit per object, niet per veld (zie de PR-body van #867, "Fixronde 2").
 *
 * Paren. Elk P-stuk van de bron krijgt een tegenhanger in de uitvoer:
 *  - een vast id (`stepIds`, de baselinekoppen) met de regel met hetzelfde id;
 *  - via de eigenaar: een gepaard stuk wijst in slot k naar een P-stuk, de regel van de writer wijst in hetzelfde slot naar
 *    de tegenhanger (per type; in een pset en een template op propertynaam; een werktijd op naam; een blok werktijd op
 *    inhoud; daarna op positie);
 *  - een relatie zonder vast id via haar type en haar gepaarde relating; een `IfcRelDefinesByProperties` via de naam van
 *    haar pset en haar gepaarde eigenaren.
 * Het paren zegt niets over gelijkheid: daarna vergelijkt de toets elk paar volledig.
 *
 * Wat zonder melding mag, en alleen dit (elk met een eigen test in `check-ifc-foreign-preserve.ts`, deel 5f):
 *  Normalisaties: de waarde blijft gelijk, en een ander programma dat het bestand leest, krijgt dezelfde waarde.
 *   - `getal` (`sameNumber`): een getal in een andere notatie (`8`, `8.`, `8.0`, `8.E0`). Elke STEP-lezer leest
 *     hetzelfde getal; het type komt uit het schema of de getypeerde waarde (`IFCREAL(8)` en `IFCREAL(8.)`).
 *   - `tekst` (`index.tokenText`, `decodeStepText`): een tekst in een andere STEP-codering (`\X2\00E9\X0\` of een
 *     letterlijk teken). Na decoderen dezelfde tekst.
 *   - `id`: het `#id` van een P-stuk zonder vast id, en de kopie die de writer schrijft van een stuk dat niet P is (een
 *     eigen owner history naast een gedeelde owner history van de bron). Een STEP-id is geen waarde; de verwijzing gaat
 *     naar de tegenhanger of de kopie, en die is zelf veld voor veld gelijk.
 *   - `duur` (`sameDuration`): een ISO 8601-duur met nul-onderdelen erbij of eraf (`PT12H` en `PT12H0M0S`), alleen in een
 *     duurslot of een `IFCDURATION`. Elk onderdeel is gelijk, dus de duur is gelijk; `P1D` en `PT24H` zijn niet gelijk.
 *  Lay-out (`alignment`; geen normalisatie, want een ander programma merkt het): de argumenten van een oudere OPS-versie
 *  op hun plek in het schema: werkplan en werkschema met 15 argumenten (of 14 met de einddatum op PredefinedType),
 *  kalender met 8 (of 9 met de werkweek op Identification), taak met 12 (`ifcWorkControlSlots.ts`). Elke waarde die de
 *  lezer las, blijft gelijk en staat daarna op haar plek in het schema. Een programma dat het oude bestand volgens het
 *  schema las, las sommige waarden op een verkeerde plek; na opslaan leest het ze goed. De gewone writer doet hetzelfde
 *  (#292). Een slot dat alleen de bron heeft, moet leeg zijn; een slot dat alleen de uitvoer heeft ook.
 *  Toevoeging: een eigen pset mag properties bijkrijgen die de bron niet had (`sameMembers`): nieuwe gegevens uit het
 *  domein, zoals de vier projectvelden in `OPS_ProjectSettings` (§4.4). Elke property van de bron blijft, in dezelfde
 *  volgorde, en is zelf veld voor veld gelijk.
 *  Schrijfvelden: geen normalisatie (de waarde verandert), maar het opslaan zelf. De writer zet ze bij elk opslaan, ook
 *  zonder vreemd deel; ze beschrijven het moment en het programma van het opslaan, niet de planning (`SAVE_FIELDS`):
 *   - `IfcOwnerHistory.CreationDate` van de owner history die de writer aan zijn stukken hangt: het moment van opslaan;
 *   - `IfcApplication.Version` van de applicatie van die owner history: de versie van de app die opslaat;
 *   - `CreationDate` van het eigen werkplan en het eigen live-werkschema: het moment van opslaan (een baseline draagt haar
 *     eigen datum en valt hier niet onder).
 */
import type { ImportResult } from '@/services/importTypes';
import { readIFC } from '../ifcReader';
import type { WriteIFCInput } from '../ifcWriter';
import { PSET } from '../ifcPsets';
import { WORK_CALENDAR_ARITY, WORK_CONTROL_ARITY, workCalendarSlots, workControlSlots } from '../ifcWorkControlSlots';
import { decodeStepText } from '../stepText';
import type { Classification } from './classify';
import { foreignScanFrom, readerBytes, readerOptions } from './foreignScan';
import type { IfcSource } from './ifcSource';
import { splitStepArgs, type StepIndex } from './stepScanner';
import type { MergePhase2Kind } from './mergeWriter';

/** Een regel van de writer, ontleed. */
export interface OutLine { readonly id: number; readonly type: string; readonly args: readonly string[] }

/** Wat de bewaking meldt. Bij `niet-gedragen` staat het verschil erbij (`diff`). */
export interface LossFinding { kind: MergePhase2Kind; chunk: number; detail: string; diff?: LossDiff }

/**
 * Eén verschil van bronstuk `chunk`. Zonder `whole`: argument `arg` van de bron (`source`) staat anders in de uitvoer
 * (`out`), beide als STEP-tekst. `slotless`: het argument heeft in de andere lay-out geen plek ('bron': argument `arg` van de
 * bron is niet leeg en heeft geen slot in de uitvoer; 'uitvoer': argument `arg` van de uitvoer is niet leeg en heeft geen
 * slot in de bron).
 * Met `whole` gaat het om het hele stuk (`arg` is dan -1): het ontbreekt in de uitvoer, het heeft daar een ander
 * entiteittype, of een aantal argumenten dat geen bekende lay-out is.
 */
export interface LossDiff {
  readonly chunk: number;
  readonly arg: number;
  readonly source: string;
  readonly out: string;
  readonly whole?: 'ontbreekt' | 'type' | 'aantal';
  readonly slotless?: 'bron' | 'uitvoer';
}

export interface LossCheckInput {
  readonly index: StepIndex;
  readonly cls: Classification;
  /** De vaste ids van de merge (`stepIds` en de baselinekoppen). */
  readonly fixed: ReadonlySet<number>;
  /** bron-#id → het domeinobject (soort en id), uit `mergeIdPlan`. */
  readonly bySource: ReadonlyMap<number, { kind: string; id: string }>;
  /** De regels van de merge voor het domein zoals gelezen (O0) en voor het bewerkte domein (O1), na alle stappen. */
  readonly o0: readonly OutLine[];
  readonly o1: readonly OutLine[];
  /** Het domein zoals gelezen (`pristineDomain`) en het domein dat de merge schrijft. */
  readonly pristine: ImportResult;
  readonly domain: WriteIFCInput;
  /** De eerste owner history die de lezer ziet, als die van de bron is (C of A, vóór het eerste P-stuk); anders -1. */
  readonly sourceOwnerHistory: number;
  /** Schrijft de writer het project zelf (het project van de bron is P)? */
  readonly projectWritten: boolean;
  /** Meetstand: elk verschil in O0 (alleen voor proeven en de telling). */
  readonly collect?: (diff: LossDiff) => void;
}

/** Het domein zoals de lezer het uit de bron leest: dezelfde bytes en dezelfde opties als de bytes-route. */
export function pristineDomain(index: StepIndex, cls: Classification, source: IfcSource): ImportResult {
  const scan = foreignScanFrom(index, cls, source.bytes);
  const text = new TextDecoder('utf-8').decode(readerBytes(source.bytes, scan));
  return readIFC(text, {}, { ...readerOptions(scan), skipBuildingModelGuard: true });
}

/**
 * Schrijfvelden (zie boven): type → slots. Ze gelden voor de owner history (en applicatie) die de writer aan zijn eigen
 * stukken hangt, ook als die een kopie is van een gedeelde owner history van de bron; die bronregel zelf blijft
 * byte-gelijk staan.
 */
const SAVE_FIELDS: Readonly<Record<string, readonly number[]>> = {
  IFCOWNERHISTORY: [7],
  IFCAPPLICATION: [1],
  IFCWORKPLAN: [6],
  IFCWORKSCHEDULE: [6],
};

/** Slots met een ISO 8601-duur als tekst (`IfcDuration`), voor de normalisatie `duur`: ScheduleDuration, FreeFloat,
 *  TotalFloat, ActualDuration en RemainingTime van een `IfcTaskTime`. */
const DURATION_SLOTS: Readonly<Record<string, readonly number[]>> = { IFCTASKTIME: [4, 11, 12, 15, 18] };

/** Het slot met de naam waarop hulpstukken van één type in een lijst paren. Properties en templates paren alleen op naam
 *  (een andere naam is een andere property); een werktijd eerst op naam, dan op positie. */
const NAME_SLOT: Readonly<Record<string, number>> = {
  IFCPROPERTYSINGLEVALUE: 0, IFCPROPERTYENUMERATEDVALUE: 0, IFCSIMPLEPROPERTYTEMPLATE: 2, IFCWORKTIME: 0,
};
const NAME_ONLY: ReadonlySet<string> = new Set(['IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE', 'IFCSIMPLEPROPERTYTEMPLATE']);
/** Hulpstukken zonder naam die eerst op hun inhoud paren, dan op positie: een blok werktijd paart zo met hetzelfde blok,
 *  ook als de writer de blokken anders ordent (de vergelijking ziet dan de andere volgorde). */
const CONTENT_PAIR: ReadonlySet<string> = new Set(['IFCTIMEPERIOD']);

/** Argumentpositie van de relating per relatietype zonder vast id. */
const RELATING: Readonly<Record<string, number>> = {
  IFCRELNESTS: 4, IFCRELAGGREGATES: 4, IFCRELDECLARES: 4, IFCRELASSIGNSTOCONTROL: 6, IFCRELASSIGNSTOPROCESS: 6,
  IFCRELSEQUENCE: 4,
};

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

/** `#12=TYPE(args);` → een `OutLine`. */
export function parseOutLine(text: string): OutLine | undefined {
  const m = LINE.exec(text);
  return m ? { id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]) } : undefined;
}

/**
 * Bron-slot → uitvoer-slot (-1: de uitvoer heeft dat slot niet), voor de oude eigen lay-outs die de lezer kent
 * (`ifcWorkControlSlots.ts`, `IfcTask` met 12 argumenten): de normalisatie `lay-out`. Zelfde aantal: per positie.
 * `undefined`: een ander aantal zonder bekende lay-out.
 */
function alignment(type: string, src: readonly string[], outLength: number): number[] | undefined {
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
  if (src.length === outLength) return src.map((_, k) => k);
  return undefined;
}

/** Vergelijk de bron met O0 en, als die gelijk is, met O1. Elk verlies gaat naar `report`. */
export function lossCheck(input: LossCheckInput, report: (f: LossFinding) => void): void {
  const { index } = input;
  const say = (d: LossDiff, after: boolean) => report({ kind: 'niet-gedragen', chunk: d.chunk, detail: describe(index, d, after), diff: d });
  const first = matchOutput(input, input.o0);
  for (const d of first) { input.collect?.(d); say(d, false); }
  if (first.length === 0) {
    const changed = changedScopes(input.domain, input.pristine);
    if (changed.any) {
      const scopes = sourceScopes(input);
      for (const d of matchOutput(input, input.o1)) if (!explained(scopes.get(d.chunk), changed)) say(d, true);
    }
  }

  // Auteur en bedrijf (§4.4). Schrijft de writer het project zelf, dan leest de lezer ze uit de eerste owner history die
  // hij ziet. Is die van de bron, dan komt een wijziging niet terug.
  if (input.sourceOwnerHistory >= 0 && input.projectWritten) {
    const want = input.domain.project;
    if ((want.author ?? '') !== (input.pristine.project.author ?? '') || (want.company ?? '') !== (input.pristine.project.company ?? '')) {
      report({
        kind: 'projectgegevens', chunk: input.sourceOwnerHistory,
        detail: `auteur of bedrijf veranderde, maar de lezer leest ze uit ${index.type(input.sourceOwnerHistory)} #${index.id(input.sourceOwnerHistory)} van de bron`,
      });
    }
  }
}

/** De tekst van een melding: stuk, propertynaam, argument, bronwaarde en uitvoer. */
function describe(index: StepIndex, d: LossDiff, after: boolean): string {
  const name = index.name(d.chunk);
  const what = `${index.type(d.chunk)} #${index.id(d.chunk)}${name ? ` (${name})` : ''}`;
  const when = after ? ' na de bewerking' : '';
  if (d.whole === 'ontbreekt') return `${what}: ontbreekt in de uitvoer${when}${d.source ? ` (${d.source.slice(0, 60)})` : ''}`;
  if (d.whole === 'type') return `${what}: in de uitvoer${when} als ${d.out}`;
  if (d.whole === 'aantal') return `${what}: ${d.source} argumenten → ${d.out} argumenten${when}, geen bekende lay-out`;
  if (d.slotless === 'uitvoer') return `${what}, argument ${d.arg} van de uitvoer${when} (geen slot in de bron): ${d.out.slice(0, 60)}`;
  if (d.slotless === 'bron') return `${what}, argument ${d.arg}${when}: ${d.source.slice(0, 60)} → geen slot in de uitvoer`;
  return `${what}, argument ${d.arg}${when}: ${d.source.slice(0, 60)} → ${d.out.slice(0, 60)}`;
}

/** Paar de P-stukken van de bron met `lines` en vergelijk elk paar veld voor veld. */
function matchOutput(input: LossCheckInput, lines: readonly OutLine[]): LossDiff[] {
  const { index, cls, fixed } = input;
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (i: number) => Number(index.id(i));
  const out = new Map<number, OutLine>();
  for (const line of lines) out.set(line.id, line);
  const outDecode = (tok: string) => decodeStepText(unquote(tok));

  // ── Paren ──
  const matched = new Uint8Array(n);
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
  /** Bronstuk → uitvoer-id (de eerste tegenhanger). Een stuk dat niet P is, staat met zijn eigen id in de uitvoer. */
  const outIdOf = (s: number): number | undefined => {
    if (s < 0) return undefined;
    if (!isP(s)) return sid(s);
    return pairedOut.get(s)?.[0];
  };
  for (const id of fixed) {
    const s = index.chunkOf(String(id));
    if (s >= 0 && isP(s) && out.get(id)?.type === index.type(s)) pair(s, id);
  }

  // Relaties zonder vast id: per sleutel (type en relating, of pset-naam en eigenaren).
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
    return pos === undefined ? undefined : `${line.type}|${refOf(line.args[pos])}`;
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

  /** Paar de P-stukken in `targets` met de stukken in `outIds`, per type: wat al een paar heeft blijft, dan op naam
   *  (`NAME_SLOT`), dan op inhoud (`CONTENT_PAIR`), dan op positie (niet voor properties en templates). */
  const pairGroup = (targets: readonly number[], outIds: readonly number[], keyOf: (name: string) => string = x => x): void => {
    const outByType = new Map<string, number[]>();
    for (const id of outIds) {
      const line = out.get(id);
      if (!line) continue;
      const list = outByType.get(line.type);
      if (list) list.push(id); else outByType.set(line.type, [id]);
    }
    const srcByType = new Map<string, number[]>();
    for (const t of targets) {
      if (t < 0) continue;
      const list = srcByType.get(index.type(t));
      if (list) list.push(t); else srcByType.set(index.type(t), [t]);
    }
    for (const [type, src] of srcByType) {
      let left = [...(outByType.get(type) ?? [])];
      // Een stuk dat niet P is en met zijn eigen id in de lijst staat, is zichzelf. Staat het er niet, dan zoekt de toets de
      // kopie die de writer schreef (de normalisatie `id`, bijvoorbeeld een eigen owner history naast een gedeelde).
      let todo = src.filter(t => {
        const o = outIdOf(t);
        if (o !== undefined && left.includes(o)) { left = left.filter(x => x !== o); if (!inD[t] && isP(t)) pair(t, o); return false; }
        return o === undefined || !isP(t);
      });
      const take = (match: (t: number, line: OutLine) => boolean) => {
        todo = todo.filter(t => {
          const o = left.find(id => match(t, out.get(id)!));
          if (o === undefined) return true;
          left = left.filter(x => x !== o);
          pair(t, o);
          return false;
        });
      };
      const nameSlot = NAME_SLOT[type];
      if (nameSlot !== undefined) {
        take((t, line) => keyOf(outDecode(line.args[nameSlot])) === keyOf(index.tokenText(t, index.argTokens(t)?.[nameSlot])));
      }
      if (NAME_ONLY.has(type)) continue;
      if (CONTENT_PAIR.has(type)) {
        take((t, line) => (index.argTokens(t) ?? []).map(x => sourceText(index, t, x)).join('|') === line.args.map(outText).join('|'));
      }
      for (let j = 0; j < Math.min(todo.length, left.length); j++) pair(todo[j], left[j]);
    }
  };

  // Via de eigenaar, met de relaties tussendoor, tot er niets meer bij komt.
  const pairs: [number, number][] = [];
  const process = () => {
    while (queue.length > 0) {
      const [s, o] = queue.shift()!;
      pairs.push([s, o]);
      const line = out.get(o);
      const a = index.argTokens(s);
      if (!line || line.type !== index.type(s) || !a) continue;
      const map = alignment(line.type, a, line.args.length);
      for (let k = 0; k < a.length; k++) {
        const targets = index.refsAt(s, k);
        if (targets.length === 0) continue;
        const k2 = map ? map[k] : -1;
        // Zonder bekende lay-out: alleen per type paren (de vergelijking meldt de lay-out).
        const outIds = k2 >= 0 ? refList(line.args[k2]) : map ? [] : line.args.flatMap(t => refList(t));
        const keyOf = line.type === 'IFCPROPERTYSET' && k2 === 4 && index.name(s) === PSET.Assignments ? assignmentKey : undefined;
        pairGroup(targets, outIds, keyOf);
      }
    }
  };
  process();
  for (;;) {
    const before = seenPair.size;
    pairRelations();
    process();
    if (seenPair.size === before) break;
  }

  // ── Vergelijken ──
  const diffs: LossDiff[] = [];
  /** De uitvoer-ids die een verwijzing naar bronstuk `t` mag hebben: zijn tegenhanger, en voor een stuk dat niet P is ook
   *  zijn eigen id. */
  const allowed = (t: number): readonly number[] => (t < 0 ? [] : !isP(t) ? [sid(t), ...(pairedOut.get(t) ?? [])] : pairedOut.get(t) ?? []);
  /** Is bron-token `a` (van stuk `s`) dezelfde waarde als uitvoer-token `b`? */
  const same = (s: number, a: string, b: string, duration: boolean): boolean => {
    a = a.trim();
    b = b.trim();
    if (a === b && !a.includes('#') && !a.includes("'")) return true;
    if (a.startsWith('#')) return b.startsWith('#') && allowed(index.chunkOf(a.slice(1))).includes(Number(b.slice(1)));
    if (a.startsWith('(')) {
      if (!b.startsWith('(') || !a.endsWith(')') || !b.endsWith(')')) return false;
      const xs = splitStepArgs(a.slice(1, -1));
      const ys = splitStepArgs(b.slice(1, -1));
      return xs.length === ys.length && xs.every((x, i) => same(s, x, ys[i], duration));
    }
    if (a.startsWith("'")) {
      if (!b.startsWith("'")) return false;
      const x = index.tokenText(s, a);
      const y = outDecode(b);
      return x === y || (duration && sameDuration(x, y));
    }
    const ta = /^([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/.exec(a);
    const tb = /^([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/.exec(b);
    if (ta || tb) {
      return !!ta && !!tb && ta[1].toUpperCase() === tb[1].toUpperCase()
        && same(s, ta[2], tb[2], duration || ta[1].toUpperCase() === 'IFCDURATION');
    }
    return sameNumber(a, b);
  };

  /** Toevoeging: de properties van een eigen pset (`HasProperties`). Elke property van de bron moet erin staan, in dezelfde
   *  volgorde; de uitvoer mag er properties bij hebben (nieuwe gegevens uit het domein, geen verlies). */
  const sameMembers = (s: number, a: string, b: string): boolean => {
    const xs = a.startsWith('(') ? splitStepArgs(a.slice(1, -1)) : [];
    const ys = b.startsWith('(') ? splitStepArgs(b.slice(1, -1)) : [];
    let j = 0;
    for (const x of xs) {
      while (j < ys.length && !same(s, x, ys[j], false)) j++;
      if (j === ys.length) return false;
      j++;
    }
    return xs.length > 0 || a === b;
  };

  for (const [s, o] of pairs) {
    const line = out.get(o);
    const type = index.type(s);
    if (!line) continue;
    if (line.type !== type) { diffs.push({ chunk: s, arg: -1, source: type, out: line.type, whole: 'type' }); continue; }
    const a = index.argTokens(s) ?? [];
    const b = line.args;
    const map = alignment(type, a, b.length);
    if (!map) { diffs.push({ chunk: s, arg: -1, source: String(a.length), out: String(b.length), whole: 'aantal' }); continue; }
    const covered = new Set<number>();
    for (let k = 0; k < a.length; k++) {
      const k2 = map[k];
      const at = a[k].trim();
      if (k2 < 0) {
        if (!isEmpty(at)) diffs.push({ chunk: s, arg: k, source: at, out: '', slotless: 'bron' });
        continue;
      }
      covered.add(k2);
      if (SAVE_FIELDS[type]?.includes(k2) && !isBaselineHead(index, s)) continue;
      const bt = b[k2].trim();
      const ok = type === 'IFCPROPERTYSET' && k2 === 4 ? sameMembers(s, at, bt) : same(s, at, bt, DURATION_SLOTS[type]?.includes(k2) === true);
      if (!ok) diffs.push({ chunk: s, arg: k, source: at, out: bt });
    }
    // Een slot dat alleen de nieuwe lay-out heeft, moet leeg zijn.
    // (Properties die een eigen pset erbij krijgt: zie `sameMembers`.)
    for (let j = 0; j < b.length; j++) {
      if (!covered.has(j) && b[j].trim() !== '$') diffs.push({ chunk: s, arg: j, source: '', out: b[j].trim(), slotless: 'uitvoer' });
    }
  }

  // ── Stukken zonder tegenhanger ──
  // Levend: een D-stuk dat de uitvoer schrijft (een vast id in de uitvoer, of zonder vast id), en wat het bereikt via
  // P-stukken; een relatie waarvan elk D-stuk leeft. Een stuk van een object dat verdween, valt buiten de toets (§4.7).
  const alive = new Uint8Array(n);
  const stack: number[] = [];
  const aliveD = (i: number) => !fixed.has(sid(i)) || out.has(sid(i));
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
  for (let u = 0; u < n; u++) {
    if (!alive[u] || matched[u]) continue;
    const first = (index.argTokens(u) ?? []).map(t => t.trim()).find(t => !isEmpty(t) && !t.startsWith('#') && !t.startsWith('(#')) ?? '';
    diffs.push({ chunk: u, arg: -1, source: first, out: '', whole: 'ontbreekt' });
  }
  return diffs;
}

/** De domeinobjecten die tussen het gelezen en het bewerkte domein veranderden. */
export interface ChangedScopes { readonly any: boolean; readonly global: boolean; readonly keys: ReadonlySet<string> }

/**
 * Wat er in het domein veranderde: per taak (met haar toewijzingen), per volgorderelatie en per resource; `global` voor
 * de rest (project, kalenders, velden, codes, baselines, instellingen). `ifcSource` telt niet: dat is de bron zelf.
 */
export function changedScopes(domain: WriteIFCInput, pristine: ImportResult): ChangedScopes {
  const keys = new Set<string>();
  /** De toewijzingen per taak, zonder hun `id`: dat staat niet in het bestand (de lezer maakt het bij elk lezen nieuw). */
  const byTask = (list: readonly { id: string; taskId: string }[]) => {
    const m = new Map<string, unknown[]>();
    for (const { id: _id, ...x } of list) {
      const l = m.get(x.taskId);
      if (l) l.push(x); else m.set(x.taskId, [x]);
    }
    return m;
  };
  const diff = <T extends { id: string }>(kind: string, a: readonly T[], b: readonly T[], extraA?: (x: T) => unknown, extraB?: (x: T) => unknown) => {
    const seen = new Map<string, string>();
    for (const x of b) seen.set(x.id, JSON.stringify([x, extraB?.(x)]));
    for (const x of a) {
      if (seen.get(x.id) !== JSON.stringify([x, extraA?.(x)])) keys.add(`${kind}:${x.id}`);
      seen.delete(x.id);
    }
    for (const id of seen.keys()) keys.add(`${kind}:${id}`);
  };
  const asgnA = byTask(domain.assignments);
  const asgnB = byTask(pristine.assignments);
  diff('task', domain.tasks, pristine.tasks, t => asgnA.get(t.id), t => asgnB.get(t.id));
  diff('seq', domain.sequences, pristine.sequences);
  diff('res', domain.resources, pristine.resources);
  const skip = new Set(['tasks', 'sequences', 'resources', 'assignments', 'ifcSource']);
  const a = domain as unknown as Record<string, unknown>;
  const b = pristine as unknown as Record<string, unknown>;
  let global = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skip.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { global = true; break; }
  }
  return { any: global || keys.size > 0, global, keys };
}

/**
 * Bij welke domeinobjecten hoort elk P-stuk van de bron: een D-stuk bij zijn eigen object (taak, resource, volgorde; de
 * rest bij `project`), een relatie bij elk D-stuk waar zij naar wijst, en elk ander P-stuk bij wat het bereikt.
 */
function sourceScopes(input: LossCheckInput): Map<number, Set<string>> {
  const { index, cls, bySource } = input;
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const scopes = new Map<number, Set<string>>();
  const rootOf = (d: number): string => {
    const o = bySource.get(Number(index.id(d)));
    return o && (o.kind === 'task' || o.kind === 'res' || o.kind === 'seq') ? `${o.kind}:${o.id}` : 'project';
  };
  const spread = (start: number, scope: ReadonlySet<string>) => {
    const stack = [start];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      let set = scopes.get(x);
      if (!set) scopes.set(x, set = new Set());
      for (const s of scope) set.add(s);
      for (let k = index.outStart(x); k < index.outEnd(x); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && isP(t) && !inD[t] && !cls.inR[t]) stack.push(t);
      }
    }
  };
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || !isP(i)) continue;
    if (inD[i]) spread(i, new Set([rootOf(i)]));
    else if (cls.inR[i]) {
      const set = new Set<string>();
      for (let k = index.outStart(i); k < index.outEnd(i); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && inD[t]) set.add(rootOf(t));
      }
      if (set.size === 0) set.add('project');
      spread(i, set);
    }
  }
  return scopes;
}

/** Mag een stuk met deze scopes in O1 anders zijn? */
function explained(scopes: ReadonlySet<string> | undefined, changed: ChangedScopes): boolean {
  if (changed.global) return true;
  if (!scopes || scopes.size === 0 || scopes.has('project')) return changed.any;
  for (const s of scopes) if (changed.keys.has(s)) return true;
  return false;
}

/** Is dit stuk de kop van een baseline (`IfcWorkSchedule` met `.BASELINE.`)? Die draagt haar eigen CreationDate. */
function isBaselineHead(index: StepIndex, s: number): boolean {
  if (index.type(s) !== 'IFCWORKSCHEDULE') return false;
  const a = index.argTokens(s) ?? [];
  return a[workControlSlots(a).predefinedType]?.trim() === '.BASELINE.';
}

/** Normalisatie `getal`: twee STEP-getallen met dezelfde waarde (`8`, `8.`, `8.0`, `8.E0`). Het type van het attribuut
 *  of van de getypeerde waarde (`IFCREAL(…)`) bepaalt wat een lezer ervan maakt; de waarde is gelijk. */
export function sameNumber(a: string, b: string): boolean {
  const num = /^[+-]?\d+(\.\d*)?([eE][+-]?\d+)?$/;
  return num.test(a) && num.test(b) && Number(a) === Number(b);
}

/** Normalisatie `duur`: twee ISO 8601-duren met dezelfde onderdelen; een ontbrekend onderdeel telt als 0. */
export function sameDuration(a: string, b: string): boolean {
  const parts = (x: string) => {
    const m = /^(-?)P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/.exec(x);
    if (!m || x === 'P' || x.endsWith('T') || x === '-P') return undefined;
    return [m[1], ...m.slice(2).map(v => Number((v ?? '0').replace(',', '.')))];
  };
  const x = parts(a);
  const y = parts(b);
  return !!x && !!y && x.every((v, i) => v === y[i]);
}

/** De gedecodeerde vorm van een token voor het paren op inhoud. */
function sourceText(index: StepIndex, s: number, token: string): string {
  const t = token.trim();
  return t.startsWith("'") ? `S${index.tokenText(s, t)}` : t;
}
function outText(token: string): string {
  const t = token.trim();
  return t.startsWith("'") ? `S${decodeStepText(unquote(t))}` : t;
}

/** De resource van een sleutel in `OPS_Assignments`: `GUID#N` of de kale `GUID` (alleen voor het paren). */
const assignmentKey = (name: string) => name.replace(/#\d+$/, '');

function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.startsWith("'") && t.endsWith("'") && t.length >= 2 ? t.slice(1, -1).replace(/''/g, "'") : '';
}

function isEmpty(t: string): boolean {
  return t === '$' || t === '';
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
