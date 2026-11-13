/**
 * De writer met een vreemd deel (#804 fase 1b, ontwerp "Gebouwmodel behouden" §4.3, §4.4, §4.6 en §4.10).
 *
 * Opbouw van de uitvoer (§4.10): de kop van de bron; de niet-P-stukken die vóór het eerste P-stuk staan; het hele P-blok
 * in de volgorde van de writer; de overige niet-P-stukken in bronvolgorde; de staart. Heeft de bron geen P-stuk, dan komt
 * het P-blok na het laatste bronstuk, vóór de staart. Niet-P-stukken blijven byte-gelijk en houden hun volgorde. De
 * uitvoer is een lijst `Uint8Array`-delen: stukken van de bron als `subarray` (geen kopie), het P-blok in een paar delen.
 *
 * Ids (§4.3): elk D-stuk houdt zijn bron-`#id` (via `ifcSource.stepIds`). R-stukken, hulpstukken en nieuwe objecten
 * krijgen ids vanaf het hoogste id van de niet-P-stukken plus 1, en slaan de D-ids over.
 *
 * Project (§4.4): is het `IfcProject` van de bron niet P, dan schrijft de writer geen eigen project, eenheden en context;
 * naam, omschrijving, auteur en bedrijf gaan in `OPS_ProjectSettings`, en alleen dan (de lezer leest ze ook alleen dan).
 * Het project houdt dan de owner history van de bron; daaraan ziet `classify` na opslaan dat het context (C) blijft. Een
 * eigen bestand van v2026.7.2 met een los project gaat zo ook door de gewone merge (fixronde 1 van #867, BLOKKEERT 2).
 *
 * Bewaarde relaties gaan voor (§4.6, v20): geen eigen `IfcRelNests`, `IfcRelAggregates` of `IfcRelDeclares` voor een
 * D-object dat al lid is van een bewaarde relatie van dat type (zo krijgt niets twee `Nests`/`Decomposes`/`HasContext`,
 * die zijn SET [0:1]). Geen taak in het D-schema als zij of een voorouder in de `IfcRelAssignsToControl` of `IfcRelNests`
 * van een ander werkschema staat. Een ongewijzigde gemengde relatie (§4.6) blijft byte-gelijk; de writer laat haar D-leden
 * dan weg uit zijn eigen relatie. Een vreemd lid van een eigen pset hangt hij aan de pset die hij voor hetzelfde object en
 * dezelfde naam schrijft.
 *
 * Wat zonder fase 2 niet veilig kan, schrijft deze writer niet: hij gooit `MergeNeedsPhase2Error` (code
 * `merge-needs-phase2`) met elk geval, vóór er iets geschreven is. Nooit stil weglaten.
 *
 * Regel voor de verliesbewaking (fixronde 1, 2 en 3 van #867; ook voor 1c): de verliesbewaking vergelijkt met de bron,
 * nooit met de eigen uitvoer. Elk veld dat de bron had (ook in een P-stuk, een hulpentiteit, een pset, een JSON-tekst of
 * een constant slot) en dat de uitvoer niet terug heeft, laat de merge weigeren met `merge-needs-phase2`, tenzij het
 * domein dat veld bewust veranderde. Bewijs is de leesverliestoets in `lossCheck.ts`: de merge schrijft ook het domein
 * zoals de lezer het las (O0), en elk P-stuk van de bron moet daarin veld voor veld terugkomen; alleen benoemde soorten
 * mogen anders zijn (normalisaties, de GlobalId van een eigen hulpstuk, lay-out, toevoegingen, schrijfvelden). Een slot
 * dat de lezer niet draagt, krijgt zijn bronwaarde terug zolang de planner het veld niet wijzigde (b, fixronde 3); de
 * merge leest de planning daarna terug, en geeft dat een andere planning, dan weigert hij (`readPlanning`). De tabel per
 * entiteittype staat in de PR-body van #867, secties "Fixronde 2" en "Fixronde 3".
 *
 * Fase 1b: alleen tests gebruiken deze writer. Opslaan met een vreemd deel blijft geweigerd tot 1c.
 */
import { ifcGuid, writeIFC, writeIfcMergeLines, type SourceTaskTime, type WriteIFCInput, type WriterMergeIds } from '../ifcWriter';
import { ACTIVITY_CODE_ID_SUFFIX, PSET, ifcStr } from '../ifcPsets';
import { decodeStepText } from '../stepText';
import { workCalendarSlots } from '../ifcWorkControlSlots';
import { classify, REGISTER_PSET_NAMES, type Classification } from './classify';
import { DURATION_SLOT_LABEL, durationForm } from './durationForms';
import { orphanRowsWithoutId, sourceFormProblems, sourceFormWhereUnchanged } from './sourceForm';
import {
  changedScopes, dateTimeTexts, decimalKey, durationTexts, LAG_VALUE_FIELDS, lossCheck, partialDateTime, pristineFromScan, taskField,
  taskTimeSlotFields, type LossDiff,
} from './lossCheck';
import { foreignScanFrom, type ForeignScanResult } from './foreignScan';
import { readIFCWithXerReconstruction } from '../ifcReadWithXer';
import type { IfcSource } from './ifcSource';
import { MAX_STEP_ID, scanStep, splitStepArgs, type StepIndex } from './stepScanner';
import type { DayMeasureDurationKey } from '../dayMeasureIo';
import { planningCanon, planningDifference } from './planningCanon';
import { sameValue } from '@/utils/sameValue';
import type { ImportResult } from '@/services/importTypes';

/** De gevallen waarin de writer zonder fase 2 niet veilig kan schrijven. */
export type MergePhase2Kind =
  /** Een D- of R-stuk van een ander programma (§4.5): zonder `sourceSlots` gingen owner history, `Creators` en andere
   *  slots van dat programma verloren. */
  | 'vreemde-herkomst'
  /** Een veld van een eigen stuk (P) dat de lezer niet draagt: de writer schrijft het domein zoals gelezen (O0) en dat
   *  veld komt anders of niet terug, of een bewerking liet het vallen (`lossCheck.ts`). Zonder fase 2 (`sourceSlots`,
   *  `jsonExtras`, `unusedKeys`) kan de writer het niet bewaren. */
  | 'niet-gedragen'
  /** Een niet-P-stuk wijst naar een D-object dat niet meer bestaat, of een vreemd lid hoort bij zo'n object (§4.7). */
  | 'verwijderd'
  /** Een niet-P-stuk wijst naar een P-stuk zonder vast id (een relatie of hulpstuk, §4.3). */
  | 'verwijzing-naar-p'
  /** Een D-object kreeg een andere plek dan in een bewaarde relatie (§4.6, verplaatsen uit een bewaarde relatie). */
  | 'verplaatst'
  /** De D-leden van een gemengde relatie veranderden, of de volgorde na herlezen zou anders zijn (§4.6). */
  | 'gemengde-relatie'
  /** Een vreemd lid zonder eigen pset (of template) om aan te hangen. */
  | 'vreemd-lid'
  /** De writer schrijft een D-object met een ander entiteittype dan de bron (§4.5: het type komt uit de bron). */
  | 'entiteittype'
  /** De bron heeft meer dan één `IfcProject`. */
  | 'meer-projecten'
  /** Auteur of bedrijf veranderde, maar de writer schrijft het project zelf en de eerste owner history die de lezer ziet
   *  is van de bron (C of A, vóór het P-blok). De lezer leest auteur en bedrijf daar terug (§4.4); de wijziging ging dan
   *  verloren (fixronde 1 van #867, BLOKKEERT 1). */
  | 'projectgegevens'
  /** Een stuk paarde niet eenduidig met de uitvoer (meer kandidaten met dezelfde sleutel, zoals twee toewijzingen van
   *  dezelfde resource aan dezelfde taak of een hernoemde feestdag die alleen op plek paart), en de bron heeft daar een
   *  waarde die terug moet of een verschil (fixronde 4, BLOKKEERT 5). Of twee stukken van de bron hebben één tegenhanger
   *  (twee gelijke psets: de uitvoer heeft er één, plek 26). Zonder betrouwbare identiteit is niet te zeggen bij welke regel
   *  die waarde hoort (`lossCheck.ts`, `ambiguous`). */
  | 'niet-eenduidig'
  /** Een P-stuk heeft een duur in een vorm die niet op de lijst staat van vormen die de lezer in dat slot exact leest
   *  (`durationForms.ts`, na de STEP-decodering; fixronde 6). Bijvoorbeeld jaren, maanden of weken (knownbug 1028), een
   *  decimale komma (`P1,5D`, knownbug 1029; tijdelijk, besluit van Trias van 10 november 2026), een vorm buiten ISO 8601
   *  (`p3d`, `P1E1D`, `PT1H1H`; knownbug 1030), een speling met een tijddeel (`PT28H`), een lag in werktijd met dagen vóór
   *  `T` (`P1DT2H`; beide knownbug 1033), een minteken in een deel (`PT-2H`, knownbug 1034), een tijddeel dat niet op een
   *  hele minuut valt (`PT90S`, knownbug 1035), of een tijddeel in de oude lagvorm. */
  | 'duur-deels-gelezen'
  /** Een P-stuk heeft een datum-tijd, tijd of datum die de lezer anders leest (`partialDateTime`, na de STEP-decodering):
   *  met een tijdzone (`Z`, `+02:00`; de lezer laat die weg), seconden die niet 0 zijn, een spatie in plaats van `T`, of een
   *  uur van één cijfer (knownbug 1031; fixronde 5, zoektocht punt 4); of een begin of einde van een feestdag of
   *  uitzondering (`IfcWorkTime`) dat geen kale datum is (`2027-03-26T12:00:00`, `2027-3-26`; fixronde 6, zoektocht 2). */
  | 'tijd-deels-gelezen'
  /** De uitvoer heeft een pset zonder bronstuk die niet in ons eigen register staat (`ifcPsets.ts`). Alleen een eigen
   *  registerpset mag erbij komen (fixronde 5, plek 34, besluit van Trias van 10 november 2026). */
  | 'nieuwe-pset'
  /** Een nieuw `#id` zou boven `MAX_STEP_ID` (2147483647) komen, omdat de bron buiten de eigen stukken een `#` met een
   *  getal net onder die grens heeft (`highestHashNumber`, ook in commentaar of een string). De scanner weigert zo'n id
   *  (`id-te-groot`). */
  | 'id-te-groot'
  /** Een veld dat alleen de omzetting naar het minutenmodel bij openen veranderde, schrijft de merge in de vorm van de bron
   *  (`sourceForm.ts`, #886). Na herlezen en dezelfde omzetting geeft het dan een andere waarde dan de planner
   *  zag: de omzetting hangt af van een veld dat de planner wel wijzigde. */
  | 'bronvorm-leest-anders'
  /** Vóór een eigen stuk (P) staat tekst buiten zijn tokens (commentaar) met een `#` en cijfers (#886). De scanner
   *  hangt commentaar aan het volgende stuk; volgens de norm (stuurtekens vallen overal weg, ook in `*⏎/`) kan daarin een
   *  stuk staan. De merge schrijft een P-stuk opnieuw, zonder dat commentaar: zo'n stuk ging dan verloren, en een
   *  verwijzing van een ander stuk ernaar wees daarna naar niets. */
  | 'verstopt-stuk'
  /** De verplichte open-stappen ontbreken, of openen geeft een andere planning (1107). */
  | 'open-stappen-ontbreken'
  | 'planning-na-openen'
  | 'ongewijzigd-getal';

export interface MergePhase2Case {
  readonly kind: MergePhase2Kind;
  /** Het `#id` in de bron waar het geval over gaat, als er één is. */
  readonly sourceId?: number;
  readonly detail: string;
  /** Bij `niet-gedragen`: het verschil zelf (zie `LossDiff` in `lossCheck.ts`), zonder het interne stuknummer. */
  readonly field?: Omit<LossDiff, 'chunk'>;
}

/** Schrijven met dit vreemde deel kan pas veilig met fase 2. Er is niets geschreven. */
export class MergeNeedsPhase2Error extends Error {
  readonly code = 'merge-needs-phase2' as const;
  readonly cases: readonly MergePhase2Case[];
  constructor(cases: readonly MergePhase2Case[]) {
    const kinds = new Map<MergePhase2Kind, number>();
    for (const c of cases) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    super(`merge-needs-phase2: ${[...kinds].map(([k, n]) => `${k} (${n})`).join(', ')}`);
    this.name = 'MergeNeedsPhase2Error';
    this.cases = cases;
  }
}

const NESTS = 'IFCRELNESTS';
const AGGREGATES = 'IFCRELAGGREGATES';
const DECLARES = 'IFCRELDECLARES';
const CONTROL = 'IFCRELASSIGNSTOCONTROL';
const PROCESS = 'IFCRELASSIGNSTOPROCESS';
const DEFINES = 'IFCRELDEFINESBYPROPERTIES';

/** Argumentposities van relating en related per structureel relatietype. */
const REL_ARGS: Readonly<Record<string, { relating: number; related: number }>> = {
  [NESTS]: { relating: 4, related: 5 },
  [AGGREGATES]: { relating: 4, related: 5 },
  [DECLARES]: { relating: 4, related: 5 },
  [CONTROL]: { relating: 6, related: 4 },
  [PROCESS]: { relating: 6, related: 4 },
};
/** Typen waarvan het lid maar in één relatie mag staan (inverse SET [0:1]): `Nests`, `Decomposes`, `HasContext`. */
const SINGLE_MEMBERSHIP: ReadonlySet<string> = new Set([NESTS, AGGREGATES, DECLARES]);

/** Een regel van de writer: `#id=TYPE(args);`. */
interface OwnLine {
  readonly id: number;
  readonly type: string;
  args: string[];
  text: string;
  drop: boolean;
}

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

function parseLine(text: string): OwnLine {
  const m = LINE.exec(text);
  if (!m) throw new Error(`mergeWriter: onverwachte regel van de writer: ${text.slice(0, 80)}`);
  return { id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]), text, drop: false };
}

function setArgs(line: OwnLine, args: string[]): void {
  line.args = args;
  line.text = `#${line.id}=${line.type}(${args.join(',')});`;
}

/** `#12` → 12; anders -1. */
function refOf(token: string | undefined): number {
  const m = /^#(\d+)$/.exec((token ?? '').trim());
  return m ? Number(m[1]) : -1;
}

/** `(#1,#2)` → [1, 2]. */
function refList(token: string | undefined): number[] {
  const t = (token ?? '').trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return [];
  return splitStepArgs(t.slice(1, -1)).map(refOf).filter(id => id >= 0);
}

const formatRefs = (ids: readonly number[]) => `(${ids.map(id => `#${id}`).join(',')})`;

/** Een multiset van ids. */
class Bag {
  readonly #m = new Map<number, number>();
  add(id: number): void { this.#m.set(id, (this.#m.get(id) ?? 0) + 1); }
  /** Haal er één weg; `true` als dat lukte. */
  take(id: number): boolean {
    const n = this.#m.get(id) ?? 0;
    if (n === 0) return false;
    this.#m.set(id, n - 1);
    return true;
  }
}

/** Het id-plan van de merge (§4.3, §4.4) en wat de merge en de bewaking ervan nodig hebben. */
export interface MergeIdPlan {
  readonly plan: WriterMergeIds;
  /** sleutel van de writer → bron-#id */
  readonly keep: ReadonlyMap<string, number>;
  /** bron-#id → het domeinobject (soort en id) */
  readonly bySource: ReadonlyMap<number, { kind: string; id: string }>;
  readonly reserved: ReadonlySet<number>;
  readonly baselineHeads: ReadonlyMap<string, number>;
  /** De stukken met `IfcProject`, in bronvolgorde. */
  readonly projects: readonly number[];
  /** De eerste owner history die de lezer ziet, als die van de bron is: C of A en vóór het eerste P-stuk; anders -1. */
  readonly sourceOwnerHistory: number;
}

/**
 * Het hoogste getal na een `#` in `bytes[start, end)`, overal: ook in commentaar en in strings, en stuurtekens tellen niet
 * mee (fixronde 8 van #867, knownbug 1100). Volgens de norm vallen stuurtekens overal weg; dan is `/* a *⏎/ #402=…;` geen
 * commentaar maar een entiteit die de scanner niet kent. Te hoog beginnen kan geen kwaad. Een getal boven `MAX_STEP_ID`
 * telt niet: de writer geeft geen id boven die grens uit, dus het kan niet botsen. Eén doorloop, zonder kopie.
 */
function highestHashNumber(bytes: Uint8Array, start: number, end: number): number {
  let max = 0;
  for (let k = bytes.indexOf(35, start); k >= 0 && k < end; k = bytes.indexOf(35, k)) {
    let v = 0;
    for (k++; k < end; k++) {
      const c = bytes[k];
      if (c >= 48 && c <= 57) { if (v <= MAX_STEP_ID) v = v * 10 + c - 48; } else if (c >= 32 && c !== 127) break;
    }
    if (v <= MAX_STEP_ID && v > max) max = v;
  }
  return max;
}

/** Het id-plan uit de bron en haar `stepIds` (domeinsleutel → bron-#id). */
export function mergeIdPlan(index: StepIndex, cls: Classification, stepIds: Readonly<Record<string, number>>, projectCalendarId: string,
  bytes: Uint8Array): MergeIdPlan {
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (chunk: number) => Number(index.id(chunk));
  const projects: number[] = [];
  for (let i = 0; i < n; i++) if (index.isEntity(i) && index.type(i) === 'IFCPROJECT') projects.push(i);
  const projectChunk = projects.length > 0 ? projects[0] : -1;
  const projectIsP = projectChunk >= 0 && isP(projectChunk);
  const keep = new Map<string, number>();
  const bySource = new Map<number, { kind: string; id: string }>();
  for (const [seed, stepId] of Object.entries(stepIds)) {
    const at = seed.indexOf(':');
    const kind = seed.slice(0, at);
    const id = seed.slice(at + 1);
    const key = kind === 'task' ? `task_${id}`
      : kind === 'res' ? `res_${id}`
        : kind === 'seq' ? `seq_${id}`
          : kind === 'cal' ? (id === projectCalendarId ? '_calendar' : `calendar_${id}`)
            : kind === 'proj' ? (projectIsP ? '_project' : undefined)
              : kind === 'wp' ? '_workplan'
                : kind === 'ws' ? '_worksched' : undefined;
    if (!key || bySource.has(stepId)) continue; // de eerste sleutel voor een bron-id wint
    keep.set(key, stepId);
    bySource.set(stepId, { kind, id });
  }
  const reserved = new Set<number>();
  let maxNonP = 0;
  let firstP = -1;
  let sourceOwnerHistory = -1;
  for (let i = 0; i < n; i++) {
    // Elk byte dat de merge letterlijk overneemt (elk stuk dat niet P is, ook kop en staart) telt mee voor het eerste
    // nieuwe id, ook een `#` in commentaar of een string (knownbug 1100). De P-stukken vervangt de writer helemaal
    // (`assemble`); wat (b) daaruit terugzet, is een token zonder commentaar. Telden zij mee, dan schoof elke opslag de ids op.
    if (!isP(i)) maxNonP = Math.max(maxNonP, highestHashNumber(bytes, index.start(i), index.end(i)));
    if (!index.isEntity(i)) continue;
    if (inD[i]) reserved.add(sid(i));
    if (isP(i)) { if (firstP < 0) firstP = i; continue; }
    if (firstP < 0 && sourceOwnerHistory < 0 && index.type(i) === 'IFCOWNERHISTORY' && (cls.classes[i] === 2 || cls.classes[i] === 3)) {
      sourceOwnerHistory = i;
    }
  }
  // Ook een vast id buiten D (het project als het P is) mag de reeks niet uitgeven.
  for (const id of keep.values()) reserved.add(id);
  // De koppen van de eigen baselines (D) staan niet in `stepIds`; ze houden hun id via hun GlobalId. Een GlobalId dat
  // twee koppen delen, telt niet: dan is niet te zeggen welke kop bij welke baseline hoort.
  const baselineHeads = new Map<string, number>();
  const sharedHeadGuid = new Set<string>();
  for (let i = 0; i < n; i++) {
    if (!inD[i] || !index.isEntity(i) || index.type(i) !== 'IFCWORKSCHEDULE') continue;
    const guid = index.globalId(i);
    if (!guid || !index.argTokens(i)?.includes('.BASELINE.')) continue;
    if (baselineHeads.has(guid)) sharedHeadGuid.add(guid);
    baselineHeads.set(guid, sid(i));
  }
  for (const guid of sharedHeadGuid) baselineHeads.delete(guid);
  const plan: WriterMergeIds = {
    keep, firstId: maxNonP + 1, reserved, baselineHeads,
    ...(projectIsP || projectChunk < 0 ? {} : { projectSourceId: sid(projectChunk) }),
  };
  return { plan, keep, bySource, reserved, baselineHeads, projects, sourceOwnerHistory };
}

/**
 * Schrijf het document met het vreemde deel van `source`. Zonder vreemd deel: de gewone writer (`writeIFC`), zoals nu.
 * Gooit `MergeNeedsPhase2Error` als het niet veilig kan zonder fase 2; dan is er niets geschreven. Async (fixronde 4,
 * BLOKKEERT 3): de verliesbewaking leest de bron met dezelfde ingang als het openen (`readIFCWithXerReconstruction`), ook
 * bij een compact XER-bronarchief.
 */
/** De aanroeper voert de gewone open-stappen uit in een eigen documentcontext, zonder modelscan.
 * ImportResult bevat ook TimeModel, herkomst en opgeslagen datums; pad en bestandskop zijn niet nodig.
 */
export type OpenMergePlanning = (planning: WriteIFCInput, side: 'uitvoer' | 'domein') => Promise<WriteIFCInput>;

export async function writeIfcMerge(input: WriteIFCInput, source: IfcSource, openPlanning: OpenMergePlanning): Promise<Uint8Array[]> {
  if (typeof openPlanning !== 'function') {
    throw new MergeNeedsPhase2Error([{ kind: 'open-stappen-ontbreken', detail: 'de verplichte open-stappen van de app ontbreken' }]);
  }
  if (!source.foreign) return [new TextEncoder().encode(writeIFC(input))];
  const index = scanStep(source.bytes);
  const cls = classify(index);
  assertSameSource(index, cls, source);

  const cases: MergePhase2Case[] = [];
  const caseAt = (kind: MergePhase2Kind, chunk: number, detail: string, diff?: LossDiff) => {
    const field = diff ? (({ chunk: _, ...rest }) => rest)(diff) : undefined;
    cases.push({ kind, ...(chunk >= 0 ? { sourceId: Number(index.id(chunk)) } : {}), detail, ...(field ? { field } : {}) });
  };
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (chunk: number) => Number(index.id(chunk));
  const label = (chunk: number) => `${index.type(chunk)} #${index.id(chunk)}`;

  // ── 1. Wat de bron zelf al uitsluit ──
  for (const i of cls.foreignOrigin) caseAt('vreemde-herkomst', i, `${label(i)} heeft de owner history van een ander programma`);
  const ids = mergeIdPlan(index, cls, source.stepIds, input.calendar.id, source.bytes);
  const { plan, keep, bySource, reserved, baselineHeads, projects } = ids;
  if (projects.length > 1) caseAt('meer-projecten', projects[1], `${projects.length} keer IfcProject`);
  // Een verstopt stuk vóór een P-stuk (#886): het commentaar ervóór gaat met het P-stuk weg.
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || !isP(i)) continue;
    const hidden = highestHashNumber(source.bytes, index.start(i), index.entityStart(i));
    if (hidden > 0) {
      caseAt('verstopt-stuk', i, `vóór ${label(i)} staat buiten de tokens een # met een getal (#${hidden}); daar kan volgens de norm een stuk staan,`
        + ' en dat schrijft de merge niet terug');
    }
  }
  // Een duur, datum-tijd of tijd in een P-stuk die de lezer deels of anders leest: de planner ziet dan een andere waarde dan
  // het bestand bewaart, en (b) zou de bron vasthouden. De tekst is die van de lezer, na de STEP-decodering
  // (`durationTexts`, `dateTimeTexts`). De fixes komen in de lezer zelf (besluiten van Trias, 10 november 2026); tot dan
  // weigert de merge.
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || !isP(i)) continue;
    // De duur: alleen een vorm van de lijst (`durationForms.ts`) mag blijven; al het andere weigert (fixronde 6).
    for (const { text, slot } of durationTexts(index, i)) {
      if (durationForm(text, slot)) continue;
      const temporary = text.includes(',') ? ' Tijdelijk, tot de fix van knownbug 1029 in main staat.' : '';
      caseAt('duur-deels-gelezen', i, `${label(i)}: ${DURATION_SLOT_LABEL[slot]} '${text}' staat niet op de lijst van vormen die de lezer`
        + ` exact leest.${temporary}`);
    }
    for (const { text, kind, oldClock } of dateTimeTexts(index, i)) {
      const part = partialDateTime(text, kind, oldClock);
      const what = kind === 'tijd' ? 'de tijd' : kind === 'datum' ? 'de datum' : 'de datum-tijd';
      if (part === 'zone') {
        caseAt('tijd-deels-gelezen', i, `${label(i)}: ${what} '${text}' heeft een tijdzone; de lezer leest alleen de kloktijd (knownbug 1031)`);
      } else if (part === 'vorm' && kind === 'datum') {
        caseAt('tijd-deels-gelezen', i, `${label(i)}: ${what} '${text}' is geen datum in de vorm JJJJ-MM-DD; de lezer neemt de eerste tien tekens (knownbug 1031)`);
      } else if (part === 'vorm') {
        caseAt('tijd-deels-gelezen', i, `${label(i)}: ${what} '${text}' heeft geen vorm die de lezer kent; hij leest haar anders (knownbug 1031)`);
      }
    }
  }

  // Een al geweigerde bronklok mag niet alsnog door normalisatie in de writer
  // een andere, ongeclassificeerde precisiefout veroorzaken.
  if (cases.some(c => c.kind === 'tijd-deels-gelezen')) throw new MergeNeedsPhase2Error(cases);

  // ── 2–6. De regels van de writer voor een domein, met de bewaarde en gemengde relaties en de vreemde leden. De merge
  // doet dit voor het bewerkte domein (O1) en voor het domein zoals de lezer het las (O0, de verliesbewaking). ──
  function buildLines(input: WriteIFCInput, caseAt: (kind: MergePhase2Kind, chunk: number, detail: string) => void) {
    // ── 2. Het domein ──
    const tasks = new Map(input.tasks.map(t => [t.id, t]));
    const resources = new Map(input.resources.map(r => [r.id, r]));

    // ── 3. De writer ──
    // Wat de planner niet wijzigde, in de vorm van de bron (fixronde 7, `SourceTaskTime`).
    const written = writeIfcMergeLines(input, {
      ...plan, sourceTaskTimes: sourceTaskTimes(pristine, input, index, source), sourceDayLagIds: sourceDayLagIds(pristine, input, index, source),
      sourceBandCalendarIds: sourceBandCalendarIds(pristine, input, index, source),
      sourceBaselineHeadGuids: legacyBaselineHeadGuids(input, baselineHeads),
    });
    const lines = written.lines.map(parseLine);
    const byId = new Map<number, OwnLine>();
    for (const line of lines) {
      if (byId.has(line.id)) throw new Error(`mergeWriter: de writer gaf #${line.id} twee keer uit`);
      byId.set(line.id, line);
    }
    const outIdOf = (key: string) => written.idMap.get(key);
    const scheduleOut = outIdOf('_worksched');
    /** De baseline-koppen die met hun bron-id in de uitvoer staan (`baselineHeads`). */
    const keptHeads = new Set<number>();
    for (const [key, id] of written.idMap) if (key.startsWith('_baseline_ws_') && reserved.has(id)) keptHeads.add(id);

    // ── 4. Bewaarde en gemengde relaties ──
    /** Leden die in geen eigen relatie van dit type mogen staan (SET [0:1]). */
    const noOwnRel = new Map<string, Set<number>>([[NESTS, new Set()], [AGGREGATES, new Set()], [DECLARES, new Set()]]);
    /** Per `type|relating`: leden die de writer weglaat omdat een ongewijzigde gemengde relatie ze al heeft. */
    const mixedMembers = new Map<string, Bag>();
    const bagFor = (type: string, relating: number) => {
      const key = `${type}|${relating}`;
      let bag = mixedMembers.get(key);
      if (!bag) mixedMembers.set(key, bag = new Bag());
      return bag;
    };
    /** D-taken in een relatie van een ander werkschema (niet D). */
    const otherScheduleTasks = new Set<number>();
    const domainOf = (chunk: number) => bySource.get(sid(chunk));
    const taskOf = (chunk: number) => {
      const d = domainOf(chunk);
      return d?.kind === 'task' ? tasks.get(d.id) : undefined;
    };

    for (let r = 0; r < n; r++) {
      if (!index.isEntity(r) || isP(r)) continue;
      const type = index.type(r);
      const pos = REL_ARGS[type];
      if (!pos) continue;
      const relating = index.refAt(r, pos.relating);
      const members = index.refsAt(r, pos.related).filter(x => x >= 0 && inD[x]);
      if (members.length === 0) continue;
      if (relating >= 0 && inD[relating]) {
        mixedRelation(r, type, relating, members);
        continue;
      }
      // Bewaarde relatie met een relating buiten D: haar D-leden houden hun plek.
      const relatingIsSchedule = relating >= 0 && index.type(relating) === 'IFCWORKSCHEDULE';
      for (const m of members) {
        if (SINGLE_MEMBERSHIP.has(type)) noOwnRel.get(type)!.add(sid(m));
        if (type === NESTS) {
          const d = domainOf(m);
          const moved = d?.kind === 'task' ? !!tasks.get(d.id)?.parentId : d?.kind === 'res' ? resources.get(d.id)?.parentId != null : false;
          if (moved) caseAt('verplaatst', m, `${label(m)} staat in ${label(r)} van een ander, maar heeft in de planning een ouder`);
        }
        if ((type === NESTS || type === CONTROL) && relatingIsSchedule && index.type(m) === 'IFCTASK') otherScheduleTasks.add(sid(m));
      }
    }

    function mixedRelation(r: number, type: string, relating: number, members: number[]): void {
      const relType = index.type(relating);
      const relatingDomain = domainOf(relating);
      const bag = bagFor(type, sid(relating));
      // Een lid dat niet meer bestaat (of dat de planning niet kent): dat meldt de controle op verwijzingen (stap 7).
      const missing = members.some(m => (!domainOf(m) && !keptHeads.has(sid(m))) || (domainOf(m)?.kind === 'task' ? !tasks.has(domainOf(m)!.id)
        : domainOf(m)?.kind === 'res' ? !resources.has(domainOf(m)!.id) : false));
      if (missing) return;
      if (type === NESTS && relType === 'IFCTASK' && relatingDomain?.kind === 'task') {
        const parent = tasks.get(relatingDomain.id);
        const s = members.map(m => taskOf(m)?.id);
        if (!parent || s.some(id => id === undefined || tasks.get(id)!.parentId !== parent.id)) {
          caseAt('gemengde-relatie', r, `${label(r)}: een D-lid heeft een andere ouder`);
          return;
        }
        // De lezer leest de eigen relatie (in het blok) vóór de gemengde (erna): de volgorde moet dan die van het domein zijn.
        const others = parent.childIds.filter(id => !s.includes(id));
        if (parent.childIds.join('\u0000') !== [...others, ...s].join('\u0000')) {
          caseAt('gemengde-relatie', r, `${label(r)}: de volgorde van de kinderen zou na herlezen anders zijn`);
          return;
        }
      } else if (type === NESTS && relType === 'IFCWORKSCHEDULE') {
        if (members.some(m => !!taskOf(m)?.parentId)) {
          caseAt('gemengde-relatie', r, `${label(r)}: een D-lid is geen wortel-taak meer`);
          return;
        }
      } else if (type === AGGREGATES && relType === 'IFCWORKPLAN') {
        // Het D-schema hangt altijd onder het D-werkplan, en een eigen baselinekop houdt zijn id (`keptHeads`).
      } else if (type === CONTROL && relType === 'IFCWORKSCHEDULE') {
        // Elke taak hangt aan het D-schema; de leden bestaan nog (hierboven).
      } else if (type === CONTROL && relType === 'IFCWORKCALENDAR' && relatingDomain?.kind === 'cal') {
        const calId = relatingDomain.id;
        for (const m of members) {
          const d = domainOf(m)!;
          const own = d.kind === 'task' ? tasks.get(d.id)?.calendarId : d.kind === 'res' ? resources.get(d.id)?.calendarId : undefined;
          const same = calId === input.calendar.id ? !own || own === input.calendar.id : own === calId;
          if (!same) {
            caseAt('gemengde-relatie', r, `${label(r)}: ${label(m)} heeft een andere kalender`);
            return;
          }
        }
      } else if (type === PROCESS && relType === 'IFCTASK' && relatingDomain?.kind === 'task') {
        const taskId = relatingDomain.id;
        const domainRes = input.assignments.filter(a => a.taskId === taskId).map(a => a.resourceId);
        const s = members.map(m => domainOf(m)?.id);
        const count = (list: readonly (string | undefined)[], id: string | undefined) => list.filter(x => x === id).length;
        for (const id of new Set(s)) {
          // Meer toewijzingen van dezelfde resource: de wachtrij van `OPS_Assignments` kan dan schuiven.
          if (count(s, id) > 1 || count(domainRes, id) !== 1) {
            caseAt('gemengde-relatie', r, `${label(r)}: de toewijzingen van de taak veranderden`);
            return;
          }
        }
        const others = domainRes.filter(id => !s.includes(id));
        if (domainRes.join('\u0000') !== [...others, ...s].join('\u0000')) {
          caseAt('gemengde-relatie', r, `${label(r)}: de volgorde van de toewijzingen zou na herlezen anders zijn`);
          return;
        }
      } else {
        caseAt('gemengde-relatie', r, `${label(r)} met relating ${label(relating)}: deze vorm kan pas in fase 2`);
        return;
      }
      for (const m of members) bag.add(sid(m));
    }

    // De taken die niet aan het D-schema mogen: zelf of via een voorouder in een relatie van een ander werkschema.
    const notInSchedule = new Set<number>();
    for (const t of input.tasks) {
      for (let cur: typeof t | undefined = t, guard = 0; cur && guard < 10000; cur = cur.parentId ? tasks.get(cur.parentId) : undefined, guard++) {
        const kept = keep.get(`task_${cur.id}`);
        if (kept !== undefined && otherScheduleTasks.has(kept)) {
          const out = outIdOf(`task_${t.id}`);
          if (out !== undefined) notInSchedule.add(out);
          break;
        }
      }
    }

    for (const line of lines) {
      const pos = REL_ARGS[line.type];
      if (!pos) continue;
      const relating = refOf(line.args[pos.relating]);
      const before = refList(line.args[pos.related]);
      const bag = mixedMembers.get(`${line.type}|${relating}`);
      const banned = noOwnRel.get(line.type);
      const scheduleRel = relating === scheduleOut && (line.type === NESTS || line.type === CONTROL);
      const after = before.filter(m => !(banned?.has(m)) && !(bag?.take(m)) && !(scheduleRel && notInSchedule.has(m)));
      if (after.length === before.length) continue;
      if (after.length === 0) line.drop = true;
      else {
        const args = [...line.args];
        args[pos.related] = formatRefs(after);
        setArgs(line, args);
      }
    }

    // ── 5. Gemengde psets (§4.6 b): ongewijzigd ⇒ geen eigen pset voor dat D-object ──
    const ownPsetsOf = indexOwnPsets(lines, byId);
    for (let r = 0; r < n; r++) {
      if (!index.isEntity(r) || isP(r) || index.type(r) !== DEFINES) continue;
      const pset = index.refAt(r, 5);
      if (pset < 0 || index.type(pset) !== 'IFCPROPERTYSET') continue;
      const name = index.name(pset) ?? '';
      // Alleen bij een pset van het register is een gemengde pset mogelijk.
      if (!REGISTER_PSET_NAMES.has(name)) continue;
      for (const owner of index.refsAt(r, 4).filter(x => x >= 0 && inD[x])) {
        const own = ownPsetsOf.get(`${sid(owner)}|${name}`);
        const want = sourceProps(index, pset);
        if (!own || own.rels.some(rel => refList(rel.args[4]).length !== 1) || !sameProps(own.props, want)) {
          caseAt('gemengde-relatie', r, `${label(r)}: de pset ${name} van ${label(owner)} veranderde (of de writer deelt haar)`);
          continue;
        }
        own.pset.drop = true;
        for (const p of own.propLines) p.drop = true;
        for (const rel of own.rels) rel.drop = true;
      }
    }

    // ── 6. Vreemde leden aan de eigen pset of template hangen ──
    const extraPsets = new Map<string, { owner: number; pset: number; rel: number; members: number[] }>();
    // De velden en codes die de uitvoer in `OPS_StructureMeta` krijgt: een vreemd lid met zo'n naam (of code) leest de
    // lezer na opslaan als eigen (§10: een veld "Zone" dat de planner later maakt). Dat vraagt een melding (fase 2); tot dan
    // schrijft de merge niets.
    const outFields = new Set((input.customFieldDefs ?? []).map(d => d.name));
    const outCodes = new Map((input.activityCodeTypes ?? []).map(t => [t.name, new Set(t.values.map(v => v.code))]));
    // Dezelfde regels als `ownProperty` en `ownTemplateProperty` in `classify.ts`, met de structuur van de uitvoer.
    const readAsOwn = (m: number, setName: string, inTemplate: boolean): boolean => {
      const name = index.name(m) ?? '';
      const type = index.type(m);
      if (inTemplate) {
        if (type !== 'IFCSIMPLEPROPERTYTEMPLATE') return false;
        return setName === PSET.CustomFields ? outFields.has(name) : outCodes.has(name);
      }
      if (setName === PSET.CustomFields) return type === 'IFCPROPERTYSINGLEVALUE' && outFields.has(name);
      if (setName === PSET.ActivityCodes) {
        if (type === 'IFCPROPERTYSINGLEVALUE' && name.endsWith(ACTIVITY_CODE_ID_SUFFIX)) {
          return outCodes.has(name.slice(0, -ACTIVITY_CODE_ID_SUFFIX.length));
        }
        return type === 'IFCPROPERTYENUMERATEDVALUE' && (outCodes.get(name)?.has((index.enumValues(m) ?? [])[0] ?? '\u0000') ?? false);
      }
      return false;
    };
    for (const m of cls.foreignMembers) {
      for (let k = index.inStart(m); k < index.inEnd(m); k++) {
        const parent = index.inSource(k);
        if (parent < 0 || !isP(parent)) continue;
        const ptype = index.type(parent);
        const name = index.name(parent) ?? '';
        if (readAsOwn(m, name, ptype === 'IFCPROPERTYSETTEMPLATE')) {
          caseAt('vreemd-lid', m, `${label(m)} in ${name} zou na opslaan als eigen gelezen worden: de planning heeft nu een veld of code met die naam`);
          continue;
        }
        if (ptype === 'IFCPROPERTYSET' && index.inArg(k) === 4) {
          const owners = psetOwners(index, parent);
          if (owners.length !== 1) {
            caseAt('vreemd-lid', m, `${label(m)} hoort bij ${label(parent)} met ${owners.length} eigenaren`);
            continue;
          }
          const own = ownPsetsOf.get(`${sid(owners[0])}|${name}`);
          if (!own || own.pset.drop) {
            const owner = owners[0];
            const exists = !isP(owner) || (byId.has(sid(owner)) && !byId.get(sid(owner))!.drop);
            if (!exists) {
              caseAt('verwijderd', m, `${label(m)} hoort bij ${name} van ${label(owner)}, dat niet meer bestaat`);
              continue;
            }
            // De writer schrijft deze pset niet (golden rule: niets eigens te schrijven). Dan een pset met alleen de vreemde
            // leden, met de GlobalIds van de bron, zodat het lidmaatschap blijft (§4.10, controle 1).
            const key = `${sid(owner)}|${name}`;
            let extra = extraPsets.get(key);
            if (!extra) extraPsets.set(key, extra = { owner: sid(owner), pset: parent, rel: psetRel(index, parent), members: [] });
            extra.members.push(sid(m));
            continue;
          }
          const args = [...own.pset.args];
          args[4] = formatRefs([...refList(args[4]), sid(m)]);
          setArgs(own.pset, args);
        } else if (ptype === 'IFCPROPERTYSETTEMPLATE' && index.inArg(k) === 6) {
          const tmpl = lines.find(l => !l.drop && l.type === 'IFCPROPERTYSETTEMPLATE' && unquote(l.args[2]) === name);
          if (!tmpl) {
            caseAt('vreemd-lid', m, `${label(m)} hoort bij het template ${name}, maar de writer schrijft dat niet`);
            continue;
          }
          const args = [...tmpl.args];
          args[6] = formatRefs([...refList(args[6]), sid(m)]);
          setArgs(tmpl, args);
        }
      }
    }

    if (extraPsets.size > 0) {
      let next = Math.max(plan.firstId - 1, ...lines.map(l => l.id)) + 1;
      const nextId = () => { while (reserved.has(next)) next++; return next++; };
      const ownerHistory = written.idMap.get('_owner');
      for (const extra of extraPsets.values()) {
        const text = (chunk: number, arg: number) => ifcStr(index.tokenText(chunk, index.argTokens(chunk)?.[arg]));
        const psetId = nextId();
        lines.push(parseLine(`#${psetId}=IFCPROPERTYSET(${text(extra.pset, 0)},#${ownerHistory},${text(extra.pset, 2)},`
          + `${text(extra.pset, 3)},${formatRefs(extra.members)});`));
        const relGuid = extra.rel >= 0 ? text(extra.rel, 0) : ifcStr(`${index.globalId(extra.pset)}`);
        const relName = extra.rel >= 0 ? `${text(extra.rel, 2)},${text(extra.rel, 3)}` : '$,$';
        lines.push(parseLine(`#${nextId()}=IFCRELDEFINESBYPROPERTIES(${relGuid},#${ownerHistory},${relName},(#${extra.owner}),#${psetId});`));
      }
    }

    const taskIds = input.tasks.map(t => written.idMap.get(`task_${t.id}`)).filter((id): id is number => id !== undefined);
    // Uitvoer-id → het domeinobject dat de writer daar schreef (de verliesbewaking ziet zo een nieuw lid van een relatie).
    const objects = new Map<number, string>();
    for (const [key, id] of written.idMap) {
      const m = /^(task|res|seq|calendar|_baseline_ws)_(.+)$/.exec(key);
      if (m) objects.set(id, m[1] === 'calendar' ? `cal:${m[2]}` : m[1] === '_baseline_ws' ? 'baselines' : `${m[1]}:${m[2]}`);
      else if (key === '_calendar') objects.set(id, `cal:${input.calendar.id}`);
    }
    return { lines, byId, keptHeads, owner: written.idMap.get('_owner'), taskIds, objects, literalCalendarIds: written.literalCalendarIds };
  }
  // Het domein zoals de lezer het uit de bron las (O0 hieronder), al vóór O1: de writer vergelijkt de taken ermee
  // (`sourceTaskTimes`, `sourceDayLagIds`, `sourceBandCalendarIds`).
  const scan = foreignScanFrom(index, cls, source.bytes);
  const pristine = await pristineFromScan(scan, source.bytes);
  // "De planner wijzigde dit veld" betekent: het wijkt af van wat de app na het openen liet zien (`source.opened`), niet van
  // de lezing van de bron (#886). Wat alleen het openen veranderde, schrijft de merge in de vorm van de bron
  // (`sourceForm.ts`); de verliesbewaking blijft met de bron vergelijken.
  // O0: het domein zoals de lezer het uit de bron las (de verliesbewaking hieronder).
  const built0 = buildLines(pristine, () => {});
  const literal0 = new Set(built0.literalCalendarIds);
  // Was knownbug 1102 (besluit van Trias, 10 november 2026): een kalender die bij deze opslag letterlijk wordt (letterlijk in O1,
  // niet in O0), krijgt al haar datums in de vorm van de writer, zoals een gewone opslag op main; zie `sourceForm.ts`. De
  // bronvorm hangt daarvan af, dus de merge bouwt O1 opnieuw tot de kalenders die letterlijk worden niet meer veranderen.
  // De gevallen van een ronde die niet blijft, tellen niet.
  let newlyLiteral = new Set<string>();
  let form = sourceFormWhereUnchanged(input, source.opened, pristine);
  let pending: Parameters<typeof caseAt>[] = [];
  let built = buildLines(form.input, (...a) => { pending.push(a); });
  for (let round = 0; ; round++) {
    const next = new Set([...newlyLiteral, ...built.literalCalendarIds.filter(id => !literal0.has(id))]);
    if (next.size === newlyLiteral.size) break;
    if (round === 3) throw new Error('mergeWriter: de kalenders die letterlijk worden, blijven veranderen');
    newlyLiteral = next;
    form = sourceFormWhereUnchanged(input, source.opened, pristine, newlyLiteral);
    pending = [];
    built = buildLines(form.input, (...a) => { pending.push(a); });
  }
  for (const a of pending) caseAt(...a);
  const domain = form.input;
  const { lines, byId, keptHeads, owner, taskIds, objects } = built;

  // ── 7. Verwijzingen van buiten P: alleen naar een D-object dat met zijn bron-id in de uitvoer staat ──
  const emitted = new Set<number>();
  for (const line of lines) if (!line.drop) emitted.add(line.id);
  // Een nieuw id boven de grens van de scanner: meteen weigeren, de verliesbewaking rekent dan niet meer.
  const tooHigh = lines.find(l => !l.drop && l.id > MAX_STEP_ID);
  if (tooHigh) {
    caseAt('id-te-groot', -1, `het nieuwe #${tooHigh.id} ligt boven ${MAX_STEP_ID}: de bron heeft buiten de eigen stukken een # met een getal tot ${plan.firstId - 1}`);
    throw new MergeNeedsPhase2Error(cases);
  }
  // Een vast id: een domeinobject uit `stepIds`, of de kop van een eigen baseline (`baselineHeads`).
  const fixedIds = new Set<number>([...bySource.keys(), ...baselineHeads.values()]);
  for (let c = 0; c < n; c++) {
    if (!index.isEntity(c) || isP(c)) continue;
    for (let k = index.outStart(c); k < index.outEnd(c); k++) {
      const t = index.outTarget(k);
      if (t < 0 || !isP(t)) continue;
      const id = sid(t);
      if (fixedIds.has(id) && emitted.has(id)) continue;
      if (inD[t] && !emitted.has(id)) {
        caseAt('verwijderd', c, `${label(c)} wijst naar ${label(t)}, dat ${fixedIds.has(id) ? 'niet meer bestaat' : 'de planning niet kent'}`);
      }
      else caseAt('verwijzing-naar-p', c, `${label(c)} wijst naar ${label(t)}, dat bij opslaan een nieuw id krijgt`);
    }
  }
  // Het type van een D-object komt uit de bron (§4.5).
  for (const [, id] of keep) {
    const line = byId.get(id);
    const chunk = index.chunkOf(String(id));
    if (line && !line.drop && chunk >= 0 && line.type !== index.type(chunk)) {
      caseAt('entiteittype', chunk, `${label(chunk)} zou ${line.type} worden`);
    }
  }

  // ── 8. De verliesbewaking (`lossCheck.ts`): O0, het domein zoals de lezer het uit de bron las, moet elk P-stuk van de
  // bron veld voor veld teruggeven; O1 mag daar alleen van afwijken waar het domein veranderde. ──
  // (b), het slotdeel van `sourceSlots` (fixronde 3 van #867): de slots die de lezer niet draagt, krijgen in O1 de
  // bronwaarde terug zolang de planner dat veld niet wijzigde (`lossCheck`, `edits`). De bronwaarden komen uit
  // `ifcSource.bytes`: geen tweede kopie, en niets nieuws in het document, undo, herstel of de MCP-backup.
  const o0 = built0.lines.filter(l => !l.drop);
  const { edits } = lossCheck({
    index, cls, fixed: fixedIds, bySource, o0, o1: lines.filter(l => !l.drop), pristine, domain, opened: source.opened,
    sourceOwnerHistory: ids.sourceOwnerHistory, projectWritten: plan.projectSourceId === undefined,
    owner0: built0.owner, owner1: owner, objects1: objects, literalCalendarIds: newlyLiteral,
    // Fixronde 1 van #886: "de planner wijzigde dit" tegenover wat de app na het openen liet zien, met de invoer van de
    // planner (niet `domain`, waarin de bronvorm al staat).
    ...(source.opened ? { plannerChanged: changedScopes(input, source.opened as unknown as ImportResult).keys } : {}),
  }, f => caseAt(f.kind, f.chunk, f.detail, f.diff));
  const read = (block: readonly string[]) => readPlanning(source, index, cls, scan, block, taskIds);
  if (cases.length === 0 && edits.length > 0) {
    const plain = lines.filter(l => !l.drop).map(l => l.text);
    for (const e of edits) {
      const line = byId.get(e.id)!;
      const args = [...line.args];
      args[e.arg] = e.token;
      setArgs(line, args);
    }
    // Herlezen (§4.5: "het token geeft in de codering van de uitvoer dezelfde waarde"): een bronwaarde mag de planning niet
    // veranderen. Leest de lezer de uitvoer met (b) anders dan zonder (b), dan weigert de merge: de waarde hangt dan af van
    // een ander veld dat wel veranderde (bijvoorbeeld een status die bij een andere voortgang iets anders betekent).
    const changed = changedScopes(orphanRowsWithoutId(await read(lines.filter(l => !l.drop).map(l => l.text))) as unknown as WriteIFCInput,
      orphanRowsWithoutId(await read(plain)));
    if (changed.any) {
      const shown = edits.slice(0, 3).map(e => `${label(e.chunk)} argument ${e.arg}`).join(', ');
      caseAt('niet-gedragen', edits[0].chunk,
        `de bronwaarden (${edits.length}: ${shown}${edits.length > 3 ? ', …' : ''}) zouden na herlezen een andere planning geven (${[...changed.keys].slice(0, 3).join(', ') || 'project'})`);
    }
  }

  // De herleestoets van de vorm van de bron (#886): wat de omzetting bij openen maakte, moet na herlezen en
  // dezelfde omzetting weer geven wat de planner zag.
  if (cases.length === 0 && form.checked.length > 0) {
    const problems = sourceFormProblems(form.checked, input, await read(lines.filter(l => !l.drop).map(l => l.text)));
    if (problems.length > 0) {
      caseAt('bronvorm-leest-anders', -1, `${problems.length} veld(en) in de vorm van de bron lezen na openen anders: ${problems.slice(0, 3).join('; ')}`);
    }
  }

  if (cases.length > 0) throw new MergeNeedsPhase2Error(cases);

  // ── 9. Bewaking (eigen zoektocht van 1b): een fout hier is een fout in deze module, geen geval van fase 2; er is dan
  // niets geschreven. Elk vast id is een P-stuk van de bron (anders botst het met een bewaard stuk), en elke verwijzing
  // uit het P-blok gaat naar een stuk dat in de uitvoer staat (geen `#0` en geen verwijzing naar een weggelaten regel).
  const chunkOfId = new Map<number, number>();
  for (let i = 0; i < n; i++) if (index.isEntity(i)) chunkOfId.set(sid(i), i);
  for (const id of [...keep.values(), ...keptHeads]) {
    const c = chunkOfId.get(id);
    if (c === undefined || !isP(c)) throw new Error(`mergeWriter: het vaste id #${id} is geen P-stuk van de bron`);
  }
  const present = new Set<number>(emitted);
  for (let i = 0; i < n; i++) if (index.isEntity(i) && !isP(i)) present.add(sid(i));
  for (const line of lines) {
    if (line.drop) continue;
    for (const target of refsInText(line.text)) {
      if (!present.has(target)) throw new Error(`mergeWriter: #${line.id} wijst naar #${target}, dat niet in de uitvoer staat`);
    }
  }
  // Volledige herleestoets vóór er uitvoer naar de aanroeper gaat; geen modelscan of volle uitvoerbuffer.
  const shown = await openPlanning(await read(lines.filter(l => !l.drop).map(l => l.text)), 'uitvoer');
  const wanted = await openPlanning(input, 'domein');
  if (planningCanon(wanted) !== planningCanon(shown)) {
    throw new MergeNeedsPhase2Error([{ kind: 'planning-na-openen', detail: planningDifference(wanted, shown) }]);
  }
  const numberProblem = unchangedPlanningNumberProblem(input, source.opened ?? pristine, wanted, shown);
  if (numberProblem) throw new MergeNeedsPhase2Error([{ kind: 'ongewijzigd-getal', detail: numberProblem }]);
  return assemble(source, index, cls, lines.filter(l => !l.drop).map(l => l.text));
}

/** Trias 1107: gelijk aan opened is ongewijzigd; zonder opened geldt pristine, zoals in de verliesbewaking.
 * Eén doorloop over alle numerieke bladeren van de planning. Id-lijsten koppelen op id, baselineregels op taskId;
 * overige lijsten blijven op plek gekoppeld.
 * Toewijzings-ids worden niet opgeslagen (ifcReader.extractAssignments maakt ze opnieuw): hun identiteit is het
 * taak/resource-paar met een volgnummer voor dubbele voorkomens. Er verdwijnt geen dubbel object in een Map.
 * Verandert openen van het domein zelf het getal, dan geldt de bestaande vergelijking na dezelfde open-stappen.
 */
function unchangedPlanningNumberProblem(input: WriteIFCInput, opened: WriteIFCInput,
  wanted: WriteIFCInput, shown: WriteIFCInput): string | undefined {
  const field = (value: unknown, key: string): unknown => value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[key] : undefined;
  const idOf = (value: unknown) => field(value, 'id');
  const taskIds = new Set([...opened.tasks, ...input.tasks].map(t => t.id));
  const taskIdByGuid = new Map<string, string | null>();
  for (const [seed, guid] of Object.entries(opened.ifcGlobalIds ?? input.ifcGlobalIds ?? {})) {
    if (!seed.startsWith('task:')) continue;
    const id = seed.slice(5);
    taskIdByGuid.set(guid, !taskIdByGuid.has(guid) || taskIdByGuid.get(guid) === id ? id : null);
  }
  const keyOf = (value: unknown, index: number, path: string): string => {
    if (path === 'planning.assignments') return `pair:${field(value, 'taskId')}\0${field(value, 'resourceId')}`;
    const taskId = field(value, 'taskId');
    if (/^planning\.baselines\[[\s\S]*\]\.tasks$/.test(path) && typeof taskId === 'string') {
      // Oude baseline-JSON zonder TaskGuids houdt na het wissen haar interne bron-id (#1104).
      // De lezer koppelt dat via ifcGuid aan de taak; gebruik alleen een eenduidig bekende bron-GUID.
      const stable = taskIds.has(taskId) ? taskId : taskIdByGuid.get(ifcGuid(taskId)) ?? taskId;
      return `task:${stable}`;
    }
    const id = idOf(value);
    return typeof id === 'string' || typeof id === 'number' ? `id:${id}` : `index:${index}`;
  };
  const indexed = (value: unknown, path: string, reference?: Map<string, unknown[]>) => {
    const map = new Map<string, unknown[]>();
    if (Array.isArray(value)) value.forEach((item: unknown, index) => {
      const key = keyOf(item, index, path), bucket = map.get(key) ?? [];
      bucket.push(item); map.set(key, bucket);
    });
    if (reference && /^planning\.baselines\[[\s\S]*\]\.tasks$/.test(path)) {
      for (const [key, rows] of reference) {
        const remaining = [...(map.get(key) ?? [])];
        // Eerst ALLE geheel gelijke voorkomens reserveren, pas daarna de rest op volgorde.
        // Anders kan een gewijzigde eerste dubbele rij de ongewijzigde tweede rij opsouperen.
        const exact = rows.map(row => {
          const at = remaining.findIndex(other => sameValue(row, other));
          return at < 0 ? undefined : { row: remaining.splice(at, 1)[0] };
        });
        map.set(key, exact.map(match => match ? match.row : remaining.shift()));
      }
    }
    return map;
  };
  function first(was: unknown, now: unknown, afterOpen: unknown, back: unknown, path: string, paired = false): string | undefined {
    if (typeof now === 'number') {
      if (now === was && now === afterOpen && now !== back) return `${path}: ${now} → ${JSON.stringify(back)}`;
    } else if (Array.isArray(now)) {
      const reference = indexed(now, path);
      const before = indexed(was, path, reference), normalized = indexed(afterOpen, path, reference), actual = indexed(back, path, reference);
      const seen = new Map<string, number>();
      for (let index = 0; index < now.length; index++) {
        const item: unknown = now[index], key = keyOf(item, index, path), occurrence = seen.get(key) ?? 0;
        seen.set(key, occurrence + 1);
        const itemPath = path === 'planning.tasks' ? `taak ${idOf(item)} (${field(item, 'name')})`
          : `${path}[${key}${occurrence ? `,${occurrence}` : ''}]`;
        const problem = first(before.get(key)?.[occurrence], item, normalized.get(key)?.[occurrence], actual.get(key)?.[occurrence], itemPath, true);
        if (problem) return problem;
      }
    } else if (now !== null && typeof now === 'object') {
      if (!paired && idOf(now) !== undefined && idOf(now) !== idOf(was)) return; // Nieuw/vervangen ding: niet ongewijzigd.
      for (const [key, value] of Object.entries(now)) {
        // Deze hele bibliotheek wordt al exact op id getoetst door planningCanon; geen tweede controle.
        if (path === 'planning' && key === 'resourceCalendars') continue;
        const problem = first(field(was, key), value, field(afterOpen, key), field(back, key), `${path}.${key}`);
        if (problem) return problem;
      }
    }
  }
  return first(opened, input, wanted, shown, 'planning');
}

/** De `#id`-verwijzingen in een regel van de writer, buiten strings (een sleutel als `'3LKE…#0'` telt niet). */
function refsInText(text: string): number[] {
  const out: number[] = [];
  const QUOTE = 39, HASH = 35;
  let i = text.indexOf('=') + 1;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === QUOTE) {
      i++;
      while (i < text.length && !(text.charCodeAt(i) === QUOTE && text.charCodeAt(i + 1) !== QUOTE)) i += text.charCodeAt(i) === QUOTE ? 2 : 1;
      i++;
      continue;
    }
    if (c === HASH) {
      let j = i + 1;
      while (j < text.length && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
      if (j > i + 1) out.push(Number(text.slice(i + 1, j)));
      i = j;
      continue;
    }
    i++;
  }
  return out;
}


function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.startsWith("'") && t.endsWith("'") && t.length >= 2 ? t.slice(1, -1).replace(/''/g, "'") : '';
}

/** De eigen psets van de writer per `eigenaar-id|psetnaam`, met hun property-regels en relaties. */
interface OwnPset { pset: OwnLine; propLines: OwnLine[]; rels: OwnLine[]; props: Map<string, string> }
function indexOwnPsets(lines: readonly OwnLine[], byId: ReadonlyMap<number, OwnLine>): Map<string, OwnPset> {
  const out = new Map<string, OwnPset>();
  for (const rel of lines) {
    if (rel.type !== DEFINES) continue;
    const pset = byId.get(refOf(rel.args[5]));
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const name = unquote(pset.args[2]);
    const propLines = refList(pset.args[4]).map(id => byId.get(id)).filter((l): l is OwnLine => !!l);
    const props = new Map<string, string>();
    for (const p of propLines) props.set(unquote(p.args[0]), propValue(p.args, t => decodeStepText(unquote(t))));
    for (const owner of refList(rel.args[4])) {
      const key = `${owner}|${name}`;
      const have = out.get(key);
      if (have && have.pset === pset) have.rels.push(rel);
      else if (!have) out.set(key, { pset, propLines, rels: [rel], props });
    }
  }
  return out;
}

/** De properties van een pset in de bron: naam → de overige argumenten als tekst. */
function sourceProps(index: StepIndex, pset: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of index.refsAt(pset, 4)) {
    if (p < 0) continue;
    const args = index.argTokens(p) ?? [];
    out.set(index.name(p) ?? '', propValue(args, t => index.tokenText(p, t)));
  }
  return out;
}

/**
 * De waarde van een property zoals de lezer haar ziet: het type en de waarde (een getal exact, tekst gedecodeerd), plus
 * `Description` en `Unit`. Zo is `IFCREAL(8)` gelijk aan `IFCREAL(8.)` (de writer schrijft sinds 2026-10-13 altijd een
 * punt) en `'caf\X2\00E9\X0\'` gelijk aan dezelfde tekst in een bestand met letterlijke codering.
 */
function propValue(args: readonly string[], text: (token: string) => string): string {
  const typed = (token: string | undefined): unknown => {
    const t = (token ?? '').trim();
    const m = /^([A-Z0-9_]+)\s*\(([\s\S]*)\)$/.exec(t);
    if (!m) return t.startsWith("'") ? ['', text(t)] : t;
    const inner = m[2].trim();
    if (inner.startsWith("'")) return [m[1], text(inner)];
    // Een getal exact als decimaal getal (fixronde 4, BLOKKEERT 4), niet via `Number`.
    return [m[1], decimalKey(inner) ?? inner];
  };
  return JSON.stringify([typed(args[1]), typed(args[2]), typed(args[3])]);
}

function sameProps(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/** De (eerste) `IfcRelDefinesByProperties` van een pset in de bron, of -1. */
function psetRel(index: StepIndex, pset: number): number {
  for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
    const rel = index.inSource(k);
    if (rel >= 0 && index.type(rel) === DEFINES && index.inArg(k) === 5) return rel;
  }
  return -1;
}

/** De eigenaren van een pset in de bron (via `IfcRelDefinesByProperties`). */
function psetOwners(index: StepIndex, pset: number): number[] {
  const owners: number[] = [];
  for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
    const rel = index.inSource(k);
    if (rel >= 0 && index.type(rel) === DEFINES && index.inArg(k) === 5) owners.push(...index.refsAt(rel, 4).filter(x => x >= 0));
  }
  return owners;
}

/** De bron moet de bron zijn waaruit `ifcSource` kwam: dezelfde stukken met dezelfde ids en klassen. */
function assertSameSource(index: StepIndex, cls: Classification, source: IfcSource): void {
  const same = index.count === source.classes.length
    && cls.classes.every((c, i) => c === source.classes[i])
    && Array.from({ length: index.count }, (_, i) => i).every(i => (index.id(i) === '' ? -1 : Number(index.id(i))) === source.chunkIds[i]);
  if (!same) throw new Error('mergeWriter: de bronbytes passen niet bij ifcSource');
}

/** Het P-blok tussen de bronstukken (§4.10). */
/**
 * De planning zoals de lezer haar uit de uitvoer met dit P-blok zou lezen: dezelfde stukken als `readerBytes` (geen
 * V-stuk, behalve het project als context en de stukken van een gemengde pset), met het P-blok op de plek van `assemble`,
 * en dezelfde leesopties als de bytes-route. De regels van de writer zijn nooit letterlijk gecodeerd.
 */
function readPlanning(source: IfcSource, index: StepIndex, cls: Classification, scan: ForeignScanResult,
  block: readonly string[], taskIds: readonly number[]) {
  const alsoRead = new Set(scan.mixedPsetChunks);
  const skip = (i: number) => cls.classes[i] === 4 && i !== scan.projectContext && !alsoRead.has(i);
  const parts = assemble(source, index, cls, block, skip);
  const bytes = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  const literalStepIds = new Set<string>();
  for (let i = 0; i < scan.literal.length; i++) if (scan.literal[i] === 1 && cls.classes[i] !== 1) literalStepIds.add(String(scan.chunkIds[i]));
  return readIFCWithXerReconstruction(new TextDecoder('utf-8').decode(bytes), {}, {
    literalStepIds, planningTaskStepIds: new Set(taskIds.map(String)), projectDataInSettings: scan.projectNotP,
  });
}

function assemble(source: IfcSource, index: StepIndex, cls: Classification, block: readonly string[],
  skip: (i: number) => boolean = () => false): Uint8Array[] {
  const n = index.count;
  const bytes = source.bytes;
  const starts = source.chunkStarts;
  let insertAt = -1;
  for (let i = 0; i < n; i++) if (cls.classes[i] === 1) { insertAt = i; break; }
  if (insertAt < 0) insertAt = n - 1; // geen P-stuk: vóór de staart
  const parts: Uint8Array[] = [];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart >= 0 && end > runStart) parts.push(bytes.subarray(starts[runStart], starts[end]));
    runStart = -1;
  };
  const enc = new TextEncoder();
  const le = source.lineEnding;
  const BATCH = 2000;
  for (let i = 0; i < n; i++) {
    if (i === insertAt) {
      flush(i);
      for (let b = 0; b < block.length; b += BATCH) parts.push(enc.encode(le + block.slice(b, b + BATCH).join(le)));
    }
    if (cls.classes[i] === 1 || skip(i)) { flush(i); continue; }
    if (runStart < 0) runStart = i;
  }
  flush(n);
  return parts;
}

/** Een dagduur in de oude vormen van OPS, ook met een breuk, minteken of exponent. */
const DAY_FORM = /^-?P(?:0Y0M)?-?(\d+(?:\.\d+)?(?:e[-+]\d+)?)D$/;
/** De velden achter de slots van `SourceTaskTime`, uit de ene tabel van de verliesbewaking (`taskTimeSlotFields`): duur en
 *  rest elk apart (slots 4 en 18), de werkelijke duur (15), en elke speling apart (11 en 12). */
const DURATION_FIELDS = taskTimeSlotFields(4);
const REMAINING_FIELDS = taskTimeSlotFields(18);
const ACTUAL_FIELDS = taskTimeSlotFields(15);
const FREE_FLOAT_FIELDS = taskTimeSlotFields(11);
const TOTAL_FLOAT_FIELDS = taskTimeSlotFields(12);

/**
 * Per taak van `domain`: de slots die de writer in de dagvorm van de bron schrijft (`SourceTaskTime` in `ifcWriter.ts`;
 * fixronde 7 van #867, BLOKKEERT 1 en 4). Een slot doet mee als de bron daar een dagduur in de oude vorm had en de
 * planner het veld niet wijzigde (tegenover `pristine`, het domein zoals de lezer het las). Regel van Trias: wat OPS zelf
 * schreef en de planner niet wijzigde, blijft staan zoals in de bron; wijzigde hij het, dan geldt de writer.
 */
function sourceTaskTimes(pristine: WriteIFCInput, domain: WriteIFCInput, index: StepIndex, source: IfcSource): ReadonlyMap<string, SourceTaskTime> {
  const before = new Map(pristine.tasks.map(t => [t.id, t]));
  const out = new Map<string, SourceTaskTime>();
  for (const task of domain.tasks) {
    const was = before.get(task.id);
    if (!was) continue;
    const same = (fields: readonly string[]) => fields.every(f => taskField(was, f) === taskField(task, f));
    // Ook een hele duur/rest blijft in dagvorm. Werkelijke duur en speling houden hun bestaande breukregel;
    // hele spelingen kunnen daarnaast een ExactFloat-record met minuten dragen, dat moet blijven staan.
    const daySlots = new Set<number>();
    const step = source.stepIds[`task:${task.id}`];
    const chunk = step === undefined ? -1 : index.chunkOf(String(step));
    for (let k = 0; chunk >= 0 && k < index.argCount(chunk); k++) {
      for (const tt of index.refsAt(chunk, k)) {
        if (index.type(tt) !== 'IFCTASKTIME') continue;
        for (const { text, arg } of durationTexts(index, tt)) {
          const m = DAY_FORM.exec(text);
          if (m && arg !== undefined && (arg === 4 || arg === 18 || !Number.isInteger(Number(m[1])))) daySlots.add(arg);
        }
      }
    }
    const exactDays = new Set<DayMeasureDurationKey>();
    if (same(DURATION_FIELDS) && daySlots.has(4)) exactDays.add('ScheduleDuration');
    if (same(REMAINING_FIELDS) && daySlots.has(18)) exactDays.add('RemainingTime');
    if (same(ACTUAL_FIELDS) && daySlots.has(15)) exactDays.add('ActualDuration');
    const exactFloat = new Set<'freeFloat' | 'totalFloat'>();
    if (same(FREE_FLOAT_FIELDS) && daySlots.has(11)) exactFloat.add('freeFloat');
    if (same(TOTAL_FLOAT_FIELDS) && daySlots.has(12)) exactFloat.add('totalFloat');
    if (exactDays.size > 0 || exactFloat.size > 0) out.set(task.id, { exactDays, exactFloat });
  }
  return out;
}

/** De relaties van `domain` met een lag die de planner niet wijzigde, en die de bron als gebroken dag in de oude vorm had
 *  (`WriterMergeIds.sourceDayLagIds`; fixronde 7 van #867, BLOKKEERT 4). */
function sourceDayLagIds(pristine: WriteIFCInput, domain: WriteIFCInput, index: StepIndex, source: IfcSource): ReadonlySet<string> {
  const before = new Map(pristine.sequences.map(q => [q.id, q]));
  const out = new Set<string>();
  for (const seq of domain.sequences) {
    const was = before.get(seq.id);
    if (!was || LAG_VALUE_FIELDS.some(f => (was as unknown as Record<string, unknown>)[f] !== (seq as unknown as Record<string, unknown>)[f])) continue;
    const step = source.stepIds[`seq:${seq.id}`];
    const chunk = step === undefined ? -1 : index.chunkOf(String(step));
    const lag = chunk >= 0 ? index.refAt(chunk, 6) : -1;
    if (lag < 0 || index.type(lag) !== 'IFCLAGTIME') continue;
    for (const { text } of durationTexts(index, lag)) {
      const m = DAY_FORM.exec(text);
      if (m && !Number.isInteger(Number(m[1]))) out.add(seq.id);
    }
  }
  return out;
}

/**
 * De kalenders van `domain` die de planner niet wijzigde en die de bron als scalaire kalender met meer dan één blok had: één
 * `IFCWORKTIME` in `WorkingTimes` met een patroon van meer perioden (`WriterMergeIds.sourceBandCalendarIds`). Zo schreef OPS
 * van v2026.7.7 tot en met v2026.43.0 de kalender van een urentaak (fixronde 7 van #867, bevinding 6). Schrijft de writer
 * daar andere blokken dan de bron, dan weigert de verliesbewaking nog steeds.
 */
/**
 * De baselines waarvan de kop in de bron het GlobalId van OPS tot en met v2026.9.x heeft (`ifcGuid('baseline_ws_' + id)`,
 * zonder zout; het zout kwam in `0768132bb`). De huidige writer hasht met het project-id als zout; zonder deze lijst kreeg
 * de kop een ander GlobalId en weigerde de merge een ongewijzigd eigen bestand (fixronde 7 van #867, v2026.7.12).
 */
function legacyBaselineHeadGuids(domain: WriteIFCInput, baselineHeads: ReadonlyMap<string, number>): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const b of domain.baselines ?? []) {
    const guid = ifcGuid('baseline_ws_' + b.id);
    if (baselineHeads.has(guid)) out.set(b.id, guid);
  }
  return out;
}

function sourceBandCalendarIds(pristine: WriteIFCInput, domain: WriteIFCInput, index: StepIndex, source: IfcSource): ReadonlySet<string> {
  const before = new Map([pristine.calendar, ...(pristine.resourceCalendars ?? [])].map(c => [c.id, c]));
  const out = new Set<string>();
  for (const cal of [domain.calendar, ...(domain.resourceCalendars ?? [])]) {
    const was = before.get(cal.id);
    if (!was || cal.workTime || JSON.stringify(was) !== JSON.stringify(cal)) continue;
    const step = source.stepIds[`cal:${cal.id}`];
    const chunk = step === undefined ? -1 : index.chunkOf(String(step));
    const times = chunk >= 0 ? index.refsAt(chunk, workCalendarSlots(index.argTokens(chunk) ?? []).workingTimes) : [];
    if (times.length !== 1 || index.type(times[0]) !== 'IFCWORKTIME') continue;
    const pattern = index.refAt(times[0], 3);
    if (pattern >= 0 && index.type(pattern) === 'IFCRECURRENCEPATTERN' && index.refsAt(pattern, 7).length > 1) out.add(cal.id);
  }
  return out;
}
