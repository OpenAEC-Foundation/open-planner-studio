/**
 * De verliesbewaking van de merge-writer: de leesverliestoets (#804 fase 1b; fixronde 2 en 3 van #867).
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
 *     in O0 waar de bron niets had, telt. Een P-stuk zonder tegenhanger in O0 telt ook.
 *  2. (b), het slotdeel van `sourceSlots` (fixronde 3, besluit 2 van Trias): een slot dat in O0 anders is dan in de bron,
 *     draagt de lezer niet. Kan (b) het terugzetten (`planRestores`), dan krijgt O0 de bronwaarde, en moet O0 daarna
 *     gelijk zijn aan de bron ("een kale schrijfronde is gelijk aan de bron, op de benoemde soorten na"). Wat dan nog
 *     verschilt: `niet-gedragen`. In O1 krijgt hetzelfde slot de bronwaarde terug zolang de planner het veld niet wijzigde:
 *     "het veld" is het slot zoals de writer het uit het domein schrijft; is het in O1 gelijk aan O0 (verwijzingen als
 *     bronstuk), dan wijzigde de bewerking het niet. Wijzigde hij het wel, dan geldt zijn waarde; bij een `lijst` of `json`
 *     (de lezer draagt er een deel van) weigert de merge dan, want per lid of per sleutel samenvoegen is fase 2
 *     (`jsonExtras`, `unusedKeys`). De bronwaarden komen uit de bronbytes van `ifcSource`, bij elke merge opnieuw gelezen;
 *     er is geen documentveld bij. De merge leest de planning met de bronwaarden erin terug (`mergeWriter.ts`); geeft dat
 *     een andere planning dan zonder, dan weigert hij.
 *     (b) zet niet terug: een heel stuk (ontbreekt, ander type, onbekende lay-out), een argument zonder slot in de
 *     uitvoer, structuur (`structural`: GlobalId en owner history van een `IfcRoot`, de leden van een relatie, de
 *     properties van een pset), tekst uit een stuk met de oude letterlijke codering die niet in beide coderingen gelijk
 *     leest, een slot van een kopie die ook bij een ander bronstuk hoort, een verwijzing naar een P-stuk zonder
 *     tegenhanger, en een slot waar de writer een verwijzing zet die niet van de bron komt.
 *  3. O1: is O0 gelijk, dan mag een P-stuk in O1 (met (b) erin) alleen anders zijn (of ontbreken) als een domeinobject
 *     waar het bij hoort veranderde (`changedScopes`). Een stuk hoort bij de taak, resource of volgorderelatie die het
 *     bereikt in de bron (`sourceScopes`); een relatie bij elk object waar zij naar wijst; al het andere bij het project.
 *     Een stuk van het project mag veranderen als er iets in het domein veranderde (de writer leidt er een deel van af uit
 *     alle taken, bijvoorbeeld de begin- en einddatum van het werkplan). Een stuk van een object dat verdween, valt buiten
 *     de toets. Binnen een veranderd object toetst dit per object, niet per veld (zie de PR-body van #867, "Fixronde 2").
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
 * Wat zonder melding mag, en alleen dit (elk met een eigen test in `check-ifc-foreign-preserve.ts`, deel 5f, 5h en 5i):
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
 *  GlobalId van een eigen hulpstuk (besluit 1, `ownAuxGuid`): de writer geeft een P-stuk zonder vast id elke keer een
 *  nieuwe GlobalId (knownbug 1023). Dat mag alleen als het stuk P is, eigen herkomst heeft (§4.5), en geen stuk dat niet
 *  P is ernaar wijst; de toets gaat dat zelf na in de inkomende verwijzingen van de index. Een stuk met een vast id (een
 *  taak, een resource) houdt zijn GlobalId; een kopie van een stuk dat niet P is ook.
 *  Lay-out (smal, besluit 3; `alignment`; geen normalisatie, want een ander programma merkt het): de argumenten van een
 *  oudere OPS-versie op hun plek in het schema: werkplan en werkschema met 15 argumenten (of 14 met de einddatum op
 *  PredefinedType), kalender met 8 (of 9 met de werkweek op Identification), taak met 12 (`ifcWorkControlSlots.ts`). Elke
 *  waarde die de lezer las, blijft gelijk en staat daarna op haar plek in het schema. De gewone writer doet hetzelfde
 *  (#292). Een argument dat in de nieuwe lay-out geen slot heeft, mag alleen wegvallen als het `$` was (argument 11 van
 *  het oude werkplan, de `$` te veel vóór StartTime); had het een waarde (ook `''`), dan weigert de merge, want er is
 *  geen plek voor in het schema. Een slot dat alleen de uitvoer heeft, moet leeg zijn, of (b) zet er `$` terug.
 *  Toevoeging (smal, besluit 3; `sameMembers`): een pset met eigen herkomst mag properties bijkrijgen die de bron niet
 *  had: nieuwe gegevens uit het domein, zoals de vier projectvelden in `OPS_ProjectSettings` (§4.4). Elke property van de
 *  bron blijft, in dezelfde volgorde, en is zelf veld voor veld gelijk; een nieuwe property heeft een naam die de bron in
 *  die pset niet had.
 *  Schrijfvelden (smal, besluit 3; `saveField`): geen normalisatie (de waarde verandert), maar het opslaan zelf. De writer
 *  zet ze bij elk opslaan, ook zonder vreemd deel; ze beschrijven het moment en het programma van het opslaan, niet de
 *  planning (`SAVE_FIELDS`):
 *   - `IfcOwnerHistory.CreationDate`, alleen van de eigen owner history van de writer (`_owner`): het moment van opslaan;
 *   - `IfcApplication.Version`, alleen van de applicatie van die owner history: de versie van de app die opslaat;
 *   - `CreationDate` van het eigen werkplan en het eigen live-werkschema (een vast id): het moment van opslaan (een
 *     baselinekop draagt haar eigen datum en valt hier niet onder).
 */
import type { ImportResult } from '@/services/importTypes';
import { readIFC } from '../ifcReader';
import type { WriteIFCInput } from '../ifcWriter';
import { PSET } from '../ifcPsets';
import { WORK_CALENDAR_ARITY, WORK_CONTROL_ARITY, workCalendarSlots, workControlSlots } from '../ifcWorkControlSlots';
import { decodeStepText } from '../stepText';
import { hasOwnOrigin, type Classification } from './classify';
import { foreignScanFrom, readerBytes, readerOptions, type ForeignScanResult } from './foreignScan';
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
  /** Bij een verschil in een slot: het slot in de uitvoer (bij een oude lay-out een ander getal dan `arg`). */
  readonly outArg?: number;
}

/**
 * De soort van een slot voor (b), het slotdeel van `sourceSlots` (fixronde 3 van #867, besluit 2). `lijst` en `json`
 * blijven alleen staan zolang de planner het veld niet wijzigt: de lezer draagt er een deel van, en per lid of per sleutel
 * samenvoegen is fase 2 (`jsonExtras`, `unusedKeys`). Wijzigt hij het wel, dan weigert de merge.
 */
export type SlotKind = 'enumeratie' | 'duur' | 'tekst' | 'getal' | 'verwijzing' | 'lijst' | 'json' | 'leeg';
/** De soorten die (b) terugzet (een mutatie haalt er één weg: dan moet de proef van die soort rood worden). */
const RESTORE_KINDS: ReadonlySet<SlotKind> = new Set<SlotKind>(['enumeratie', 'duur', 'tekst', 'getal', 'verwijzing', 'lijst', 'json', 'leeg']);

/** (b): een slot van een P-stuk dat de lezer niet draagt. De merge zet de bronwaarde terug zolang de planner het veld
 *  niet wijzigde. */
export interface SlotRestore {
  readonly chunk: number;
  /** Het argument in de bron en het slot in de uitvoer. */
  readonly arg: number;
  readonly outArg: number;
  /** Het brontoken (bij een slot dat alleen de uitvoer heeft: `$`). */
  readonly token: string;
  readonly kind: SlotKind;
}

/** Een wijziging die de merge in een regel van O1 aanbrengt: slot `arg` van regel `#id` wordt `token`. */
export interface SlotEdit { readonly id: number; readonly arg: number; readonly token: string; readonly chunk: number }

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
  /** De eigen owner history van de writer in O0 en in O1 (`_owner`): alleen daar zijn CreationDate en de versie van
   *  de applicatie schrijfvelden. */
  readonly owner0?: number;
  readonly owner1?: number;
  /** Meetstand: elk verschil dat na (b) in O0 overblijft (alleen voor proeven en de telling). */
  readonly collect?: (diff: LossDiff) => void;
  /** Meetstand: elk slot dat (b) in O0 terugzet. */
  readonly restored?: (r: SlotRestore) => void;
}

/** Het domein zoals de lezer het uit de bron leest: dezelfde bytes en dezelfde opties als de bytes-route. */
export function pristineDomain(index: StepIndex, cls: Classification, source: IfcSource): ImportResult {
  return pristineFromScan(foreignScanFrom(index, cls, source.bytes), source.bytes);
}
/** Idem, met een scan die er al is. */
export function pristineFromScan(scan: ForeignScanResult, bytes: Uint8Array): ImportResult {
  const text = new TextDecoder('utf-8').decode(readerBytes(bytes, scan));
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

/**
 * Vergelijk de bron met O0 en, als die gelijk is, met O1. Elk verlies gaat naar `report`.
 *
 * (b), het slotdeel van `sourceSlots` (fixronde 3 van #867, besluit 2): een slot van een P-stuk dat de lezer niet draagt
 * (O0 heeft het anders dan de bron), krijgt in O1 de bronwaarde terug zolang de planner dat veld niet wijzigde; wijzigde
 * hij het wel, dan geldt zijn waarde. "Het veld" is het slot zoals de writer het uit het domein schrijft: is het in O1
 * gelijk aan O0, dan wijzigde de bewerking het niet. O0 blijft de toets: O0 met (b) erin moet veld voor veld gelijk zijn
 * aan de bron, op de benoemde soorten na (`planRestores` zegt welke slots (b) kan terugzetten). Geeft `edits` terug: de
 * slots die de merge in O1 terugzet.
 */
export function lossCheck(input: LossCheckInput, report: (f: LossFinding) => void): { edits: SlotEdit[] } {
  const { index } = input;
  const say = (d: LossDiff, after: boolean) => report({ kind: 'niet-gedragen', chunk: d.chunk, detail: describe(index, d, after), diff: d });
  const edits: SlotEdit[] = [];
  const p0 = pairOutput(input, input.o0);
  const plan = planRestores(input, p0, compareOutput(input, p0, input.owner0));
  for (const r of plan.restores) input.restored?.(r);
  // De kale schrijfronde met (b): moet gelijk zijn aan de bron, op de benoemde soorten na.
  const o0b = applyEdits(input.o0, plan.restores.map(r => ({ id: p0.pairedOut.get(r.chunk)![0], arg: r.outArg, token: mapToken(input, r.token, p0)!, chunk: r.chunk })));
  const first = compareOutput(input, pairOutput(input, o0b), input.owner0);
  for (const d of first) { input.collect?.(d); say(d, false); }
  if (first.length === 0) {
    const p1 = pairOutput(input, input.o1);
    for (const r of plan.restores) {
      const o1 = p1.pairedOut.get(r.chunk)?.[0];
      const line1 = o1 === undefined ? undefined : p1.out.get(o1);
      const line0 = p0.out.get(p0.pairedOut.get(r.chunk)![0])!;
      // Het object is weg, of de bewerking gaf het een ander type of een andere vorm: dat toetst O1 hieronder.
      if (!line1 || line1.type !== line0.type || line1.args.length !== line0.args.length) continue;
      const now = line1.args[r.outArg].trim();
      const after = { chunk: r.chunk, arg: r.arg, source: r.token, out: now, outArg: r.outArg };
      if (normRefs(input, now, p1) === normRefs(input, line0.args[r.outArg], p0)) {
        const token = mapToken(input, r.token, p1);
        if (token === undefined) say(after, true); // een verwijzing van de bron heeft in O1 geen tegenhanger meer
        else edits.push({ id: o1!, arg: r.outArg, token, chunk: r.chunk });
      } else if (r.kind === 'lijst' || r.kind === 'json') {
        say(after, true); // de planner wijzigde een veld waarvan de lezer maar een deel draagt
      }
    }
    const changed = changedScopes(input.domain, input.pristine);
    if (changed.any) {
      const scopes = sourceScopes(input);
      const o1b = applyEdits(input.o1, edits);
      for (const d of compareOutput(input, pairOutput(input, o1b), input.owner1)) if (!explained(scopes.get(d.chunk), changed)) say(d, true);
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
  return { edits };
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

/** De paren van de P-stukken van de bron met de regels van een uitvoer. */
interface Pairing {
  readonly out: ReadonlyMap<number, OutLine>;
  /** Bronstuk, uitvoer-id: in de volgorde waarin ze gevonden zijn. */
  readonly pairs: readonly (readonly [number, number])[];
  /** Bronstuk → zijn tegenhangers (de eerste is de tegenhanger; een stuk dat niet P is, kan een kopie hebben). */
  readonly pairedOut: ReadonlyMap<number, readonly number[]>;
  /** Uitvoer-id → het bronstuk waar het de tegenhanger van is. */
  readonly sourceOf: ReadonlyMap<number, number>;
  readonly matched: Uint8Array;
}

/** Paar de P-stukken van de bron met `lines`. */
function pairOutput(input: LossCheckInput, lines: readonly OutLine[]): Pairing {
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

  const sourceOf = new Map<number, number>();
  for (const [s, o] of pairs) if (!sourceOf.has(o)) sourceOf.set(o, s);
  return { out, pairs, pairedOut, sourceOf, matched };
}

/** Vergelijk elk paar veld voor veld, en meld de P-stukken zonder tegenhanger. `ownerOut`: de eigen owner history van de
 *  writer in deze uitvoer (de schrijfvelden). */
function compareOutput(input: LossCheckInput, p: Pairing, ownerOut: number | undefined): LossDiff[] {
  const { index, cls, fixed } = input;
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (i: number) => Number(index.id(i));
  const { out, pairs, pairedOut, matched } = p;
  const outDecode = (tok: string) => decodeStepText(unquote(tok));
  /** Schrijfvelden (smal): alleen de eigen owner history van de writer, zijn applicatie, en het eigen werkplan en live-schema
   *  (een vast id, geen baseline). */
  const ownApp = ownerOut === undefined ? -1 : refOf(out.get(ownerOut)?.args[1]);
  const saveField = (s: number, o: number, type: string, k2: number): boolean => {
    if (!SAVE_FIELDS[type]?.includes(k2)) return false;
    if (type === 'IFCOWNERHISTORY') return o === ownerOut;
    if (type === 'IFCAPPLICATION') return o === ownApp;
    return fixed.has(sid(s)) && !isBaselineHead(index, s);
  };
  /** GlobalId van een eigen hulpstuk (besluit 1): het stuk is P, heeft geen vast id, heeft eigen herkomst, en geen stuk dat
   *  niet P is, wijst ernaar (de inkomende verwijzingen uit de index). De toets gaat dat zelf na. */
  const ownAuxGuid = (s: number): boolean => {
    if (!isP(s) || fixed.has(sid(s)) || !hasOwnOrigin(index, s)) return false;
    for (let k = index.inStart(s); k < index.inEnd(s); k++) {
      const from = index.inSource(k);
      if (from >= 0 && !isP(from)) return false;
    }
    return true;
  };

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

  /** Toevoeging (smal): de properties van een pset (`HasProperties`). Elke property van de bron moet erin staan, in
   *  dezelfde volgorde. Alleen een pset met eigen herkomst mag er properties bij krijgen (nieuwe gegevens uit het domein),
   *  en alleen met een naam die de bron in die pset niet had (anders is het een andere waarde, geen toevoeging). */
  const sameMembers = (s: number, a: string, b: string): boolean => {
    const xs = a.startsWith('(') ? splitStepArgs(a.slice(1, -1)) : [];
    const ys = b.startsWith('(') ? splitStepArgs(b.slice(1, -1)) : [];
    const hit = new Set<number>();
    let j = 0;
    for (const x of xs) {
      while (j < ys.length && !same(s, x, ys[j], false)) j++;
      if (j === ys.length) return false;
      hit.add(j);
      j++;
    }
    if (xs.length === 0) return a === b;
    if (ys.length === xs.length) return true;
    if (!hasOwnOrigin(index, s)) return false;
    const names = new Set(xs.map(x => index.name(index.chunkOf(x.trim().slice(1))) ?? ''));
    return ys.every((y, k) => {
      if (hit.has(k)) return true;
      const line = out.get(refOf(y));
      return !!line && !names.has(outDecode(line.args[0] ?? ''));
    });
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
      // Lay-out (smal): een argument dat in de uitvoer geen slot heeft, mag alleen wegvallen als het `$` was.
      if (k2 < 0) {
        if (at !== '$') diffs.push({ chunk: s, arg: k, source: at, out: '', slotless: 'bron' });
        continue;
      }
      covered.add(k2);
      if (saveField(s, o, type, k2)) continue;
      const bt = b[k2].trim();
      if (k2 === 0 && isGuidToken(at) && isGuidToken(bt) && isRootLine(line) && ownAuxGuid(s)) continue;
      const ok = type === 'IFCPROPERTYSET' && k2 === 4 ? sameMembers(s, at, bt) : same(s, at, bt, DURATION_SLOTS[type]?.includes(k2) === true);
      if (!ok) diffs.push({ chunk: s, arg: k, source: at, out: bt, outArg: k2 });
    }
    // Een slot dat alleen de nieuwe lay-out heeft, moet leeg zijn (of (b) zet er `$` terug).
    // (Properties die een eigen pset erbij krijgt: zie `sameMembers`.)
    for (let j = 0; j < b.length; j++) {
      if (!covered.has(j) && b[j].trim() !== '$') diffs.push({ chunk: s, arg: j, source: '', out: b[j].trim(), slotless: 'uitvoer', outArg: j });
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

// ── (b): het slotdeel van `sourceSlots` (fixronde 3 van #867, besluit 2) ──

/** Slots die structuur zijn, geen waarde: de GlobalId en de owner history van een `IfcRoot` (besluit 1 en §4.5), de
 *  objectleden van een relatie (welke leden erin staan, volgt uit het domein, §4.5) en de properties van een pset (de
 *  merge hangt vreemde leden er zelf aan). Die zet (b) nooit terug; een verschil daar blijft `niet-gedragen`. */
const REL_MEMBER_SLOTS: Readonly<Record<string, readonly number[]>> = {
  IFCRELNESTS: [4, 5], IFCRELAGGREGATES: [4, 5], IFCRELDECLARES: [4, 5], IFCRELASSIGNSTOCONTROL: [4, 6],
  IFCRELASSIGNSTOPROCESS: [4, 6], IFCRELDEFINESBYPROPERTIES: [4, 5], IFCRELSEQUENCE: [4, 5],
};
function structural(type: string, outArg: number, line: OutLine): boolean {
  if (isRootLine(line) && (outArg === 0 || outArg === 1)) return true;
  if (type === 'IFCPROPERTYSET' && outArg === 4) return true;
  if (type.startsWith('IFCREL')) return REL_MEMBER_SLOTS[type] ? REL_MEMBER_SLOTS[type].includes(outArg) : outArg >= 4;
  return false;
}

/** De soort van een brontoken (zie `SlotKind`). */
function slotKind(type: string, outArg: number, token: string, text: (tok: string) => string): SlotKind {
  const t = token.trim();
  if (t === '$') return 'leeg';
  if (refsOutsideText(t).length > 0) return 'verwijzing';
  if (t.startsWith('(')) return 'lijst';
  const isJson = (tok: string) => /^\s*[[{]/.test(text(tok));
  if (t.startsWith("'")) return DURATION_SLOTS[type]?.includes(outArg) ? 'duur' : isJson(t) ? 'json' : 'tekst';
  const typed = /^([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/.exec(t);
  if (typed) {
    const inner = typed[2].trim();
    if (typed[1].toUpperCase() === 'IFCDURATION') return 'duur';
    if (inner.startsWith("'")) return isJson(inner) ? 'json' : 'tekst';
    return inner.startsWith('.') ? 'enumeratie' : 'getal';
  }
  return /^[+-]?\d/.test(t) ? 'getal' : 'enumeratie';
}

/**
 * Welke verschillen van O0 kan (b) terugzetten? Een slot (geen heel stuk, geen argument zonder slot in de uitvoer), geen
 * structuur (`structural`), niet uit een stuk met de oude letterlijke codering als het tekst draagt (§4.5: die tekst leest
 * een lezer van de uitvoer anders), een soort uit `RESTORE_KINDS`, elke verwijzing van de bron heeft een tegenhanger, en
 * elke verwijzing die de writer in dat slot zet, is de tegenhanger van een verwijzing van de bron (de structuur van de
 * writer blijft: de bron voegt alleen toe, zoals een gedeelde eenheid in de projecteenheden).
 */
function planRestores(input: LossCheckInput, p0: Pairing, diffs: readonly LossDiff[]): { restores: SlotRestore[]; rest: LossDiff[] } {
  const { index } = input;
  const restores: SlotRestore[] = [];
  const rest: LossDiff[] = [];
  const text = (s: number) => (tok: string) => index.tokenText(s, tok);
  /** Uitvoer-id → het aantal bronstukken waarvan die regel de tegenhanger of de kopie is. */
  const holders = new Map<number, number>();
  for (const [, o] of p0.pairs) holders.set(o, (holders.get(o) ?? 0) + 1);
  for (const d of diffs) {
    const o = p0.pairedOut.get(d.chunk)?.[0];
    const line = o === undefined ? undefined : p0.out.get(o);
    // Een slot van een P-stuk, of van de kopie die de writer naast een stuk zet dat niet P is (een eigen persoon naast een
    // gedeelde; het stuk zelf blijft byte-gelijk staan, en de kopie moet er veld voor veld gelijk aan zijn, `id`). Een kopie
    // die ook bij een ander bronstuk hoort (de eigen owner history van de writer, als een eigen pset de owner history van
    // Revit heeft), krijgt geen bronwaarde: de waarden van twee stukken passen niet in één regel.
    const copy = input.cls.classes[d.chunk] !== 1 && o !== Number(index.id(d.chunk)) && holders.get(o!) === 1;
    if (d.whole || d.slotless === 'bron' || d.outArg === undefined || !line || (input.cls.classes[d.chunk] !== 1 && !copy)
      || structural(line.type, d.outArg, line)) { rest.push(d); continue; }
    const token = d.slotless === 'uitvoer' ? '$' : d.source;
    // Oude letterlijke codering (§4.9): alleen tekst die in beide coderingen hetzelfde leest (ASCII zonder `\`).
    if (index.literalText(d.chunk) && token.includes("'") && !/^[\x20-\x5b\x5d-\x7e]*$/.test(token)) { rest.push(d); continue; }
    const kind = slotKind(line.type, d.outArg, token, text(d.chunk));
    const sourceRefs = new Set(refsOutsideText(token).map(id => index.chunkOf(String(id))));
    const writerRefsKept = refsOutsideText(line.args[d.outArg]).every(r => {
      const c = sourceChunkOf(input, r, p0);
      return c !== undefined && sourceRefs.has(c);
    });
    if (!RESTORE_KINDS.has(kind) || !writerRefsKept || mapToken(input, token, p0) === undefined) { rest.push(d); continue; }
    restores.push({ chunk: d.chunk, arg: d.arg, outArg: d.outArg, token, kind });
  }
  return { restores, rest };
}

/** Het bronstuk achter uitvoer-id `r`: een tegenhanger, of een stuk dat niet P is (dat heeft in de uitvoer zijn eigen id). */
function sourceChunkOf(input: LossCheckInput, r: number, p: Pairing): number | undefined {
  const c = p.sourceOf.get(r);
  if (c !== undefined) return c;
  const own = input.index.chunkOf(String(r));
  return own >= 0 && input.cls.classes[own] !== 1 ? own : undefined;
}

/** Het brontoken met elke verwijzing naar een P-stuk vervangen door zijn tegenhanger in `p` (een stuk dat niet P is, houdt
 *  zijn id). `undefined` als een P-stuk geen tegenhanger heeft. */
function mapToken(input: LossCheckInput, token: string, p: Pairing): string | undefined {
  let ok = true;
  const out = replaceRefsOutsideText(token, id => {
    const c = input.index.chunkOf(String(id));
    if (c < 0) { ok = false; return `#${id}`; }
    if (input.cls.classes[c] !== 1) return `#${id}`;
    const o = p.pairedOut.get(c)?.[0];
    if (o === undefined) { ok = false; return `#${id}`; }
    return `#${o}`;
  });
  return ok ? out.trim() : undefined;
}

/** Een uitvoertoken met elke verwijzing als het bronstuk erachter (zo zijn O0 en O1 te vergelijken, ook als de ids van
 *  hulpstukken verschuiven). */
function normRefs(input: LossCheckInput, token: string, p: Pairing): string {
  return replaceRefsOutsideText(token.trim(), id => {
    const c = sourceChunkOf(input, id, p);
    return c === undefined ? `#n${id}` : `#s${c}`;
  });
}

/** Regels met de wijzigingen van (b) erin (kopieën; `lines` blijft zoals het was). */
function applyEdits(lines: readonly OutLine[], edits: readonly SlotEdit[]): OutLine[] {
  if (edits.length === 0) return [...lines];
  const byId = new Map<number, SlotEdit[]>();
  for (const e of edits) {
    const list = byId.get(e.id);
    if (list) list.push(e); else byId.set(e.id, [e]);
  }
  return lines.map(line => {
    const mine = byId.get(line.id);
    if (!mine) return line;
    const args = [...line.args];
    for (const e of mine) args[e.arg] = e.token;
    return { ...line, args };
  });
}

/** De `#id`'s in een token, buiten tekst. */
export function refsOutsideText(token: string): number[] {
  const out: number[] = [];
  replaceRefsOutsideText(token, id => { out.push(id); return `#${id}`; });
  return out;
}
/** Vervang elke `#id` buiten tekst (`'…'`, met `''` als aanhalingsteken erin). `f` krijgt het id en geeft de vervanging. */
function replaceRefsOutsideText(token: string, f: (id: number) => string): string {
  let res = '';
  let i = 0;
  while (i < token.length) {
    const c = token[i];
    if (c === "'") {
      let j = i + 1;
      while (j < token.length) {
        if (token[j] === "'" && token[j + 1] === "'") { j += 2; continue; }
        if (token[j] === "'") break;
        j++;
      }
      res += token.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '#') {
      const m = /^#(\d+)/.exec(token.slice(i));
      if (m) { res += f(Number(m[1])); i += m[0].length; continue; }
    }
    res += c;
    i++;
  }
  return res;
}

/** Een regel van een `IfcRoot`: een GlobalId op 0 en een owner history (of `$`) op 1. */
function isRootLine(line: OutLine): boolean {
  return isGuidToken(line.args[0] ?? '') && /^(#\d+|\$)$/.test((line.args[1] ?? '').trim());
}
function isGuidToken(token: string): boolean {
  return /^'[0-9A-Za-z_$]{22}'$/.test(token.trim());
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
