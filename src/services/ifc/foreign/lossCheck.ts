/**
 * De verliesbewaking van de merge-writer: de leesverliestoets (#804 fase 1b; fixronde 2 tot en met 4 van #867).
 *
 * Regel: de verliesbewaking vergelijkt met de bron, nooit met de eigen uitvoer. Elk veld dat de bron had (ook in een
 * P-stuk, een hulpentiteit, een pset, een JSON-tekst of een constant slot) en dat de uitvoer niet terug heeft, laat de
 * merge weigeren met `merge-needs-phase2`, tenzij de planner juist dat veld veranderde. Een vrijstelling bewijst geen
 * behoud: er is geen lijst met velden die vooraf veilig heten. Bij twijfel weigert de merge (fixronde 4).
 *
 * Werkwijze. De merge schrijft twee keer met hetzelfde id-plan en dezelfde stappen (`mergeWriter.ts`): O0 voor het domein
 * zoals de lezer het uit de bron las, zonder bewerking (`pristineDomain`, via dezelfde ingang als openen), en O1 voor het
 * bewerkte domein.
 *  1. O0: elk P-stuk van de bron moet in O0 veld voor veld gelijk zijn. Elk argument; elke lijst met al haar leden, in
 *     dezelfde volgorde; elke verwijzing (naar een stuk dat niet P is: hetzelfde `#id`; naar een P-stuk: zijn
 *     tegenhanger); elke propertywaarde, ook een enumeratie of een lijst; elke JSON-tekst, teken voor teken. Ook een waarde
 *     in een slot van O0 waar de bron niets had, telt. Een P-stuk zonder tegenhanger in O0 telt ook, en twee P-stukken met
 *     één tegenhanger (`gedeeld`). Een heel stuk dat alleen O0 heeft (een pset die de writer toevoegt), ziet de toets niet.
 *  2. (b), het slotdeel van `sourceSlots` (fixronde 3, besluit 2 van Trias): een slot dat in O0 anders is dan in de bron,
 *     draagt de lezer niet. Kan (b) het terugzetten (`planRestores`), dan krijgt O0 de bronwaarde, en moet O0 daarna
 *     gelijk zijn aan de bron ("een kale schrijfronde is gelijk aan de bron, op de benoemde soorten na"). Wat dan nog
 *     verschilt: `niet-gedragen`, of `niet-eenduidig` als het stuk niet eenduidig paarde. In O1 krijgt hetzelfde slot de
 *     bronwaarde terug zolang de planner het veld niet wijzigde: "het veld" is het slot zoals de writer het uit het
 *     domein schrijft; is het in O1 gelijk aan O0 (verwijzingen als bronstuk), dan wijzigde de bewerking het niet.
 *     Wijzigde hij het wel, dan geldt zijn waarde; bij een `lijst`, `json` of `samengesteld` (de lezer draagt er een deel
 *     van) weigert de merge dan, want per lid, per sleutel of per deel samenvoegen is fase 2 (`jsonExtras`,
 *     `unusedKeys`). Paart het stuk in O1 niet eenduidig, of heeft de regel in O1 een ander type of een andere vorm, dan
 *     weigert de merge ook. De bronwaarden komen uit de bronbytes van `ifcSource`, bij elke merge opnieuw gelezen; er is
 *     geen documentveld bij. De merge leest de planning met de bronwaarden erin terug (`mergeWriter.ts`); geeft dat een
 *     andere planning dan zonder, dan weigert hij.
 *     (b) zet niet terug: een heel stuk (ontbreekt, ander type, onbekende lay-out), een argument zonder slot in de
 *     uitvoer, structuur (`structural`: GlobalId en owner history van een `IfcRoot`, de leden van een relatie, de
 *     properties van een pset), tekst uit een stuk met de oude letterlijke codering die niet in beide coderingen gelijk
 *     leest, een slot van een kopie die ook bij een ander bronstuk hoort, een stuk dat niet eenduidig paarde, een
 *     verwijzing naar een P-stuk zonder (eenduidige) tegenhanger, en een slot waar de writer een verwijzing zet die niet
 *     van de bron komt.
 *  3. O1 (fixronde 4): is O0 gelijk, dan mag een P-stuk in O1 (met (b) erin) alleen anders zijn (of ontbreken) als de
 *     planner het veld veranderde dat de writer daar schrijft (`explainO1`). Er is geen algemene vrijstelling en niets per
 *     object: per stuk de weg waarlangs het bij een domeinobject hoort (`sourceScopes`: het object zelf, een slot, een
 *     relatie, een pset), en per slot of property het veld (`TASK_SLOT_FIELDS`, `CAL_PROP_FIELDS`, de per-taak-psets via
 *     hun eigen `write`, `PROJECT_SETTINGS_FIELDS`, …). Elke weg moet het verklaren. De leden van een relatie toetst
 *     `explainMembers` per lid. O1 toetst altijd, ook als `changedScopes` niets ziet. Een stuk van een object dat
 *     verdween, valt buiten de toets.
 *
 * Paren. Elk P-stuk van de bron krijgt een tegenhanger in de uitvoer:
 *  - een vast id (`stepIds`, de baselinekoppen) met de regel met hetzelfde id;
 *  - via de eigenaar: een gepaard stuk wijst in slot k naar een P-stuk, de regel van de writer wijst in hetzelfde slot naar
 *    de tegenhanger (per type; in een pset en een template op propertynaam; een eenheid op haar UnitType; een werktijd
 *    eerst op naam met begin- en einddatum, dan op naam; een blok werktijd op inhoud; daarna op positie);
 *  - een relatie zonder vast id via haar type en haar gepaarde relating; een `IfcRelDefinesByProperties` via de naam van
 *    haar pset en haar gepaarde eigenaren.
 * Hebben meer bronstukken of meer regels dezelfde sleutel, of paart een stuk alleen op positie terwijl het een naam heeft
 * die het aanwijst (een uitzondering in een kalender, een eenheid, een template), dan is het paar niet eenduidig
 * (`ambiguous`). De properties van `OPS_Assignments` paren op hun volle naam (`GUID#N`) in O0 en zolang de toewijzingen
 * van de taak niet veranderden, anders op de resource. Een kopie van een stuk dat niet P is (de normalisatie `id`)
 * bestaat alleen in de keten van de owner history (`COPY_TYPES`). Het paren zegt niets over gelijkheid: daarna vergelijkt
 * de toets elk paar volledig.
 *
 * Wat zonder melding mag, en alleen dit (elk met een eigen test in `check-ifc-foreign-preserve.ts`, deel 5f, 5h en 5i, en
 * `check-ifc-foreign-strikt.ts`):
 *  Normalisaties: de waarde blijft gelijk, en een ander programma dat het bestand leest, krijgt dezelfde waarde.
 *   - `getal` (`sameNumber`): een getal in een andere notatie (`8`, `8.`, `8.0`, `8.E0`), exact vergeleken (`decimalKey`:
 *     teken, cijfers, exponent; geen JavaScript-`Number`). Het type komt uit het schema of de getypeerde waarde.
 *   - `tekst` (`index.tokenText`, `decodeStepText`): een tekst in een andere STEP-codering (`\X2\00E9\X0\` of een
 *     letterlijk teken). Na decoderen dezelfde tekst. Een tekst met een reeks die de lezer letterlijk laat staan (geen
 *     geldige codering), alleen byte-gelijk (`stepTextIsValid`).
 *   - `id`: het `#id` van een P-stuk zonder vast id, en de kopie die de writer schrijft van een stuk dat niet P is in de
 *     keten van de owner history (een eigen owner history naast een gedeelde owner history van de bron). Een STEP-id is
 *     geen waarde; de verwijzing gaat naar de tegenhanger of de kopie, en die is zelf veld voor veld gelijk.
 *   - `duur` (`sameDuration`): een ISO 8601-duur met nul-onderdelen erbij of eraf (`PT12H` en `PT12H0M0S`), alleen in een
 *     duurslot of een `IFCDURATION`. Elk onderdeel is exact gelijk, dus de duur is gelijk; `P1D` en `PT24H` zijn niet
 *     gelijk. Een duur in een vorm die niet op de lijst staat van vormen die de lezer exact leest (`durationForms.ts`),
 *     weigert de merge vooraf (fixronde 6).
 *  GlobalId van een eigen hulpstuk (besluit 1, `ownAuxGuid`): de writer geeft een P-stuk zonder vast id elke keer een
 *  nieuwe GlobalId (knownbug 1023). Dat mag alleen als het stuk P is, eigen herkomst heeft (§4.5), en geen stuk dat niet
 *  P is ernaar wijst; de toets gaat dat zelf na in de inkomende verwijzingen van de index. Een stuk met een vast id (een
 *  taak, een resource) houdt zijn GlobalId; een kopie van een stuk dat niet P is ook.
 *  Lay-out (smal, besluit 3; `alignment`; geen normalisatie, want een ander programma merkt het): de argumenten van een
 *  oudere OPS-versie op hun plek in het schema: werkplan en werkschema met 15 argumenten (of 14 met de einddatum op
 *  PredefinedType), kalender met 8 (of 9 met de werkweek op Identification), taak met 12 (`ifcWorkControlSlots.ts`),
 *  resource met 9 (OPS tot `4f5008614`, fixronde 7: zonder BaseCosts en BaseQuantity). Elke waarde die de lezer las, blijft gelijk en staat daarna op haar plek in het schema. De gewone writer doet hetzelfde
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
import { isStrictIsoDateTime, parseInstant } from '@/utils/dateUtils';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { scalarHourFromClock } from '@/services/subdayIo';
import { readIFCWithXerReconstruction } from '../ifcReadWithXer';
import type { WriteIFCInput } from '../ifcWriter';
import { PER_TASK_PSET_BY_NAME, PROP, PSET, ifcJson } from '../ifcPsets';
import { WORK_CALENDAR_ARITY, WORK_CONTROL_ARITY, workCalendarSlots, workControlSlots } from '../ifcWorkControlSlots';
import { lagValueSlot } from '../ifcLagTimeSlots';
import { decodeStepText, stepTextIsValid } from '../stepText';
import { hasOwnOrigin, REGISTER_PSET_NAMES, type Classification } from './classify';
import { durationForm, type DurationSlot } from './durationForms';
import { parseIfcDuration } from '../isoDuration';
import { taskMinutesPerDay } from '../dayMeasureIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { foreignScanFrom, readerBytes, readerOptions, type ForeignScanResult } from './foreignScan';
import type { IfcSource } from './ifcSource';
import { planningIdentities, planningIdentityInput } from './planningIdentity';
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
 * entiteittype, een aantal argumenten dat geen bekende lay-out is, of zijn tegenhanger is ook die van een ander P-stuk
 * (`gedeeld`, `out` is dan die regel).
 */
export interface LossDiff {
  readonly chunk: number;
  readonly arg: number;
  readonly source: string;
  readonly out: string;
  readonly whole?: 'ontbreekt' | 'type' | 'aantal' | 'gedeeld' | 'nieuw';
  readonly slotless?: 'bron' | 'uitvoer';
  /** Bij een verschil in een slot: het slot in de uitvoer (bij een oude lay-out een ander getal dan `arg`). */
  readonly outArg?: number;
  /** Het stuk paarde niet eenduidig met de uitvoer (fixronde 4, BLOKKEERT 5): meer kandidaten met dezelfde sleutel. */
  readonly ambiguous?: boolean;
}

/**
 * De soort van een slot voor (b), het slotdeel van `sourceSlots` (fixronde 3 van #867, besluit 2). De soort volgt de
 * structuur van het token (fixronde 4): een lijst is een `lijst`, ook met verwijzingen erin; een `verwijzing` is één `#id`.
 * `lijst`, `json` en `samengesteld` blijven alleen staan zolang de planner het veld niet wijzigt: de lezer draagt er een
 * deel van, en per lid, per sleutel of per deel samenvoegen is fase 2 (`jsonExtras`, `unusedKeys`). Wijzigt hij het wel,
 * dan weigert de merge. `samengesteld` (fixronde 4, BLOKKEERT 6): een tekst waarvan de lezer een deel las, want O0 heeft
 * er een niet-lege tekst die anders is dan de bron (`1|UNIFORM|BEWAAR-DIT` → `1|UNIFORM`; een datum met tijd waarvan de
 * lezer alleen de datum leest). Een tekst die de lezer helemaal niet draagt (O0 leeg, zoals `Status 'ON HOLD'`), is een
 * `tekst`: wijzigt de planner dat veld, dan geldt zijn waarde.
 */
export type SlotKind = 'enumeratie' | 'duur' | 'tekst' | 'samengesteld' | 'getal' | 'verwijzing' | 'lijst' | 'json' | 'leeg';
/** Properties waarvan de waarde een lijst STEP-ids van de writer is (`ifcWriter.ts`, `writeCalendarGenerationMeta`). */
const ID_LIST_PROPS: ReadonlySet<string> = new Set([PROP.Calendar.WorkingExceptionIds]);
/** Is dit slot de waarde van zo'n property? */
const isIdListSlot = (index: StepIndex, chunk: number, type: string, outArg: number) =>
  type === 'IFCPROPERTYSINGLEVALUE' && outArg === 2 && ID_LIST_PROPS.has(index.name(chunk) ?? '');
/** De ids in de waarde van zo'n property (`IFCTEXT('["40","41"]')`), of `undefined` als het geen lijst ids is.
 *  `decode` leest de string (met de quotes). */
function textIdList(token: string, decode: (quoted: string) => string): number[] | undefined {
  const m = /^IFCTEXT\s*\(\s*('[\s\S]*')\s*\)$/i.exec(token.trim());
  if (!m) return undefined;
  try {
    const v: unknown = JSON.parse(decode(m[1]));
    return Array.isArray(v) && v.every(x => typeof x === 'string' && /^\d{1,10}$/.test(x)) ? v.map(Number) : undefined;
  } catch {
    return undefined;
  }
}
/** De soorten waarbij een wijziging van de planner weigert in plaats van de bron te vervangen. */
const PARTIAL_KINDS: ReadonlySet<SlotKind> = new Set<SlotKind>(['lijst', 'json', 'samengesteld']);

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
  /** Wat de app na openen liet zien; zonder store geldt de lezing van de bron. */
  readonly opened?: WriteIFCInput;
  /** De eigen owner history van de writer in O0 en in O1 (`_owner`): alleen daar zijn CreationDate en de versie van
   *  de applicatie schrijfvelden. */
  readonly owner0?: number;
  readonly owner1?: number;
  /** Meetstand: elk verschil dat na (b) in O0 overblijft (alleen voor proeven en de telling). */
  readonly collect?: (diff: LossDiff) => void;
  /** Meetstand: elk slot dat (b) in O0 terugzet. */
  readonly restored?: (r: SlotRestore) => void;
  /** O1: uitvoer-id → het domeinobject dat de writer daar schreef (`task:<id>`, `res:<id>`, `seq:<id>`, `cal:<id>`,
   *  `baselines`), uit de id-kaart van de writer. Zo is een nieuw lid van een relatie een object dat erbij kwam. */
  readonly objects1?: ReadonlyMap<number, string>;
  /** Meetstand: elk verschil in O1 dat een bewerking verklaart, met de regel (`explainO1`). */
  readonly explainedO1?: (diff: LossDiff, why: string) => void;
  /** De kalenders die bij deze opslag letterlijk worden: letterlijk in O1 en niet in O0 (was knownbug 1102,
   *  `literalWriterForm`). */
  readonly literalCalendarIds?: ReadonlySet<string>;
  /** Wat de planner wijzigde: de sleutels van `changedScopes` tegenover wat de app na het openen liet zien
   *  (`ifcSource.opened`; fixronde 1 van #886). Zonder: tegenover de lezing van de bron (`changed`). */
  readonly plannerChanged?: ReadonlySet<string>;
}

/** Het domein zoals de lezer het uit de bron leest: dezelfde bytes, dezelfde opties en dezelfde ingang als de bytes-route
 *  (`readIFCWithXerReconstruction`, ook voor een compact XER-bronarchief; fixronde 4, BLOKKEERT 3). */
export function pristineDomain(index: StepIndex, cls: Classification, source: IfcSource): Promise<ImportResult> {
  return pristineFromScan(foreignScanFrom(index, cls, source.bytes), source.bytes);
}
/** Idem, met een scan die er al is. */
export function pristineFromScan(scan: ForeignScanResult, bytes: Uint8Array): Promise<ImportResult> {
  const text = new TextDecoder('utf-8').decode(readerBytes(bytes, scan));
  return readIFCWithXerReconstruction(text, {}, readerOptions(scan));
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
 *  (een andere naam is een andere property); een werktijd eerst op naam, dan op positie. Een eenheid paart op haar
 *  UnitType: een `IfcUnitAssignment` heeft per soort één eenheid (fixronde 4: op plek paren is niet eenduidig). */
const NAME_SLOT: Readonly<Record<string, number>> = {
  IFCPROPERTYSINGLEVALUE: 0, IFCPROPERTYENUMERATEDVALUE: 0, IFCSIMPLEPROPERTYTEMPLATE: 2, IFCPROPERTYSETTEMPLATE: 2,
  IFCWORKTIME: 0, IFCSIUNIT: 1, IFCCONVERSIONBASEDUNIT: 1, IFCDERIVEDUNIT: 1,
};
const NAME_ONLY: ReadonlySet<string> = new Set(['IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE', 'IFCSIMPLEPROPERTYTEMPLATE']);
/** Hulpstukken zonder naam die eerst op hun inhoud paren, dan op positie: een blok werktijd paart zo met hetzelfde blok,
 *  ook als de writer de blokken anders ordent (de vergelijking ziet dan de andere volgorde). */
const CONTENT_PAIR: ReadonlySet<string> = new Set(['IFCTIMEPERIOD']);

/**
 * Per relatietype de slots van de relating en van de leden (RelatedObjects; bij `IfcRelDefinesByProperties` zijn de
 * eigenaren de leden en is de pset de relating). Eén tabel voor het paren (`relKeySource`), de structuur (`structural`) en
 * de uitleg in O1 (fixronde 5, VERVOLG van Sol). `members`: welke leden erin staan, volgt uit het domeinobject van de
 * relating (`explainMembers`, `explainRelation`). Een `IfcRelSequence` is zelf een domeinobject (`seq:`): beide slots volgen
 * uit zijn velden (`SEQ_SLOT_FIELDS`).
 */
const RELATION_SLOTS: Readonly<Record<string, { readonly relating: number; readonly related: number; readonly members: boolean }>> = {
  IFCRELNESTS: { relating: 4, related: 5, members: true },
  IFCRELAGGREGATES: { relating: 4, related: 5, members: true },
  IFCRELDECLARES: { relating: 4, related: 5, members: true },
  IFCRELASSIGNSTOCONTROL: { relating: 6, related: 4, members: true },
  IFCRELASSIGNSTOPROCESS: { relating: 6, related: 4, members: true },
  IFCRELDEFINESBYPROPERTIES: { relating: 5, related: 4, members: true },
  IFCRELSEQUENCE: { relating: 4, related: 5, members: false },
};
/** De relatie met leden die uit het domein van haar relating volgen, of `undefined`. */
const memberRelation = (type: string) => (RELATION_SLOTS[type]?.members ? RELATION_SLOTS[type] : undefined);

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

/** De resources die OPS schrijft (`RESOURCE_TYPE_TO_IFC`), met hun argumentaantal in het schema (11) en in de oude
 *  lay-out van OPS tot `4f5008614` (9). */
const OLD_RESOURCE_TYPES: ReadonlySet<string> = new Set(['IFCLABORRESOURCE', 'IFCCONSTRUCTIONEQUIPMENTRESOURCE',
  'IFCCONSTRUCTIONMATERIALRESOURCE', 'IFCSUBCONTRACTRESOURCE', 'IFCCREWRESOURCE']);
const RESOURCE_ARITY = 11;
const OLD_RESOURCE_ARITY = 9;

/** `#12=TYPE(args);` → een `OutLine`. */
export function parseOutLine(text: string): OutLine | undefined {
  const m = LINE.exec(text);
  return m ? { id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]) } : undefined;
}

/**
 * Bron-slot → uitvoer-slot (-1: de uitvoer heeft dat slot niet), voor de oude eigen lay-outs die de lezer kent
 * (`ifcWorkControlSlots.ts`, `IfcTask` met 12 argumenten, een resource met 9): de normalisatie `lay-out`. Zelfde aantal: per positie.
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
  if (OLD_RESOURCE_TYPES.has(type) && src.length === OLD_RESOURCE_ARITY && outLength === RESOURCE_ARITY) {
    // Fixronde 7 van #867 (was knownbug 1024): OPS tot `4f5008614` (v2026.9.0 en ouder) schreef een resource met 9
    // argumenten, zonder BaseCosts en BaseQuantity: `(GlobalId,OwnerHistory,Name,Description,$,$,$,$,.USERDEFINED.)`.
    // De eerste acht staan op hun plek in het schema; PredefinedType (8) staat in het schema op 10.
    return src.map((_, k) => (k < 8 ? k : 10));
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
  const say = (d: LossDiff, after: boolean) => report({
    kind: d.whole === 'nieuw' ? 'nieuwe-pset' : d.ambiguous ? 'niet-eenduidig' : 'niet-gedragen', chunk: d.chunk,
    detail: describe(index, d, after), diff: d,
  });
  const edits: SlotEdit[] = [];
  const p0 = pairOutput(input, input.o0);
  const restores = planRestores(input, p0, compareOutput(input, p0, input.owner0));
  for (const r of restores) input.restored?.(r);
  // Gedragen (fixronde 1 van #886): een slot is volledig gedragen als de writer op de lezing van de bron (O0) dezelfde
  // waarde teruggeeft als de bron. Zonder (b) is dat zo (O0 is dan gelijk aan de bron); met (b) alleen bij een datum, tijd of duur
  // met dezelfde betekenis in een andere vorm (`sameMeaning`). Wat niet gedragen is, krijgt nooit de waarde van de writer.
  const notCarried = new Set(restores.filter(r => !sameMeaning(index, r, p0.out.get(p0.pairedOut.get(r.chunk)![0])!.args[r.outArg], taskTimeMinutesPerDay(input, r.chunk)))
    .map(r => `${r.chunk}:${r.outArg}`));
  const carried = (chunk: number, outArg: number) => !notCarried.has(`${chunk}:${outArg}`);
  // De kale schrijfronde met (b): moet gelijk zijn aan de bron, op de benoemde soorten na.
  const o0b = applyEdits(input.o0, restores.map(r => ({ id: p0.pairedOut.get(r.chunk)![0], arg: r.outArg, token: mapToken(input, r.token, p0)!, chunk: r.chunk })));
  const first = compareOutput(input, pairOutput(input, o0b), input.owner0);
  for (const d of first) { input.collect?.(d); say(d, false); }
  if (first.length === 0) {
    const changed = changedScopes(input.domain, input.pristine, input.opened);
    const p1 = pairEditedOutput(input, input.o1, p0, changed);
    const ctx1 = o1Context(input, p1, changed, carried);
    const deleted = deletedExceptionItems(input, p1, changed);
    /** Stukken met een bronwaarde zonder regel in O1, terwijl hun object blijft (fixronde 4, plek 5; fixronde 5, BLOKKEERT
     *  4): het wissen van een bekende waarde verklaart niet het wissen van een slot ernaast dat de lezer niet draagt, van
     *  welke soort ook. Dan weigert de merge. Behalve bij een uitzondering van een kalender die de planner wiste (een
     *  feestdag): die gaat met haar bronwaarden weg (`deletedExceptionItems`). */
    const lost = new Set<number>();
    for (const r of restores) {
      const o1 = p1.pairedOut.get(r.chunk)?.[0];
      const line1 = o1 === undefined ? undefined : p1.out.get(o1);
      const line0 = p0.out.get(p0.pairedOut.get(r.chunk)![0])!;
      // Geen regel: het object is weg (dan valt het stuk buiten de toets), of de bewerking haalde het stuk weg (dan weigert
      // de merge, op een gewiste feestdag na). Ook een stuk dat een ander type kreeg, heeft geen regel: het paren eist
      // hetzelfde type. Een andere vorm (een ander aantal argumenten bij hetzelfde type) schrijft de writer niet; als vangnet
      // weigert de merge dan (bij twijfel weigeren).
      // Een bronwaarde in een slot waarvan de planner het veld wijzigde, vervalt (plek 6), behalve bij een soort die de lezer
      // deels draagt; elke andere bronwaarde van het verdwenen stuk weigert, van welke soort ook (BLOKKEERT 4).
      if (!line1) {
        if (deleted.has(r.chunk)) continue;
        const gone = { chunk: r.chunk, arg: r.arg, source: r.token, out: '', outArg: r.outArg };
        if (PARTIAL_KINDS.has(r.kind) || explainO1(ctx1, gone) === undefined) lost.add(r.chunk);
        continue;
      }
      if (line1.type !== line0.type || line1.args.length !== line0.args.length) {
        say({ chunk: r.chunk, arg: r.arg, source: r.token, out: `${line1.type} met ${line1.args.length} argumenten`, outArg: r.outArg }, true);
        continue;
      }
      const now = line1.args[r.outArg].trim();
      const after = { chunk: r.chunk, arg: r.arg, source: r.token, out: now, outArg: r.outArg };
      // Na de bewerking is de koppeling van het stuk (of van een stuk waar de bronwaarde naar wijst) niet eenduidig:
      // dan is niet te zeggen bij welke regel de bronwaarde hoort (BLOKKEERT 5).
      // Was knownbug 1102 (#886, besluit van Trias): wordt de kalender van dit slot bij deze opslag letterlijk, dan geldt de vorm
      // van de writer, ook als het stuk niet eenduidig paart (een werkweek met één periode wordt blokken). De herleestoets
      // (`sourceFormProblems`) gaat na dat herlezen geeft wat de planner zag; de toets van O1 hieronder verklaart het verschil.
      if (inLiteralWriterForm(ctx1, after)) continue;
      if (p1.ambiguous[r.chunk] || refsOutsideText(r.token).some(id => p1.ambiguous[index.chunkOf(String(id))] === 1)) {
        // Behalve een kale sleutel die alleen de vorm van de writer kreeg: die hoeft niet terug (fixronde 7).
        if (bareKeyInWriterForm(input, p1, r, now)) continue;
        say({ ...after, ambiguous: true }, true);
        continue;
      }
      // Plek 6 (fixronde 5, besluit van Trias): wijzigde de planner het domeinveld waar de writer dit slot uit schrijft
      // (dezelfde tabellen per veld als de uitleg van O1), dan vervalt de bronwaarde en geldt de waarde van de writer, ook
      // als die gelijk bleef. Bij een soort die de lezer deels draagt, gaat dan een deel verloren: weigeren.
      if (explainO1(ctx1, after) !== undefined) {
        // Een datum die de planner zelf wijzigde en die de lezer volledig droeg, verliest niets (#886: F5 na een
        // duurwijziging, was knownbug 1102).
        if ((PARTIAL_KINDS.has(r.kind) && !plannerReplacedDate(ctx1, r))
          || (r.kind === 'duur' && !ctx1.carried(r.chunk, r.outArg))) say(after, true);
        continue;
      }
      if (normRefs(input, now, p1) === normRefs(input, line0.args[r.outArg], p0)) {
        const token = mapToken(input, r.token, p1);
        if (token === undefined) say(after, true); // een verwijzing van de bron heeft in O1 geen tegenhanger meer
        else edits.push({ id: o1!, arg: r.outArg, token, chunk: r.chunk });
      } else if (PARTIAL_KINDS.has(r.kind)) {
        say(after, true); // de writer schrijft hier iets anders, zonder dat het veld veranderde: weigeren
      }
    }
    // O1 (fixronde 4, BLOKKEERT 1 en plek 1 tot 4): geen algemene vrijstelling. Elk verschil met de bron moet een
    // bewerking aantoonbaar verklaren, per veld (`explainO1`); anders weigert de merge. De toets draait altijd, ook als
    // `changedScopes` niets ziet (een veld dat JSON niet ziet: plek 4). Een stuk dat niet eenduidig paarde, gaat ook door
    // `explainO1`: een bronwaarde van zo'n stuk weigert al hierboven, en de rest moet een bewerking verklaren.
    const p1b = pairEditedOutput(input, applyEdits(input.o1, edits), p0, changed);
    const ctx = o1Context(input, p1b, changed, carried);
    const differences = compareOutput(input, p1b, input.owner1);
    for (const d of differences) {
      const why = lost.has(d.chunk) ? undefined : explainO1(ctx, d);
      if (why === undefined) say(d, true); else input.explainedO1?.(d, why);
    }
    // Een writerfout kan alle nieuwe koppelingen weglaten, zodat de kaart precies de bron blijft.
    // Ook zonder slotverschil moet een werkelijk verwachte groei volledig aanwezig zijn.
    const different = new Set(differences.map(d => d.chunk));
    for (const [chunk, scopes] of ctx.scopes) {
      if (different.has(chunk) || scopes.size !== 1) continue;
      const scope = [...scopes][0];
      const codes = index.type(chunk) === 'IFCPROPERTYSETTEMPLATE' && index.name(chunk) === PSET.ActivityCodes;
      if (!codes && (index.type(chunk) !== 'IFCPROPERTYSINGLEVALUE'
        || (scope !== `project|pset:${PSET.Baselines}` && scope !== `project|pset:${PSET.TaskTypes}`))) continue;
      const line = p1b.out.get(p1b.pairedOut.get(chunk)?.[0] ?? -1);
      if (!line) continue;
      const arg = codes ? 6 : 2;
      const d = { chunk, arg, outArg: arg, source: index.argTokens(chunk)![arg], out: line.args[arg] };
      if ((codes ? explainCodeDefinitions(ctx, d) : explainOwnMapGrowth(ctx, d, scope.slice(8))) === false
        || (!codes && explainActiveBaseline(ctx, d, scope.slice(8)) === false)) say(d, true);
    }
  }

  // E8 / 1022: de bytes-lezer kiest de project-/werkplaneigenaar na OPS_ProjectSettings. De oude onvoorwaardelijke
  // weigering 'projectgegevens' vervalt; de onafhankelijke heropening controleert de werkelijk geschreven velden.
  return { edits };
}

/** De tekst van een melding: stuk, propertynaam, argument, bronwaarde en uitvoer. */
function describe(index: StepIndex, d: LossDiff, after: boolean): string {
  const when = after ? ' na de bewerking' : '';
  if (d.whole === 'nieuw') {
    const owner = d.chunk >= 0 ? ` op ${index.type(d.chunk)} #${index.id(d.chunk)}` : '';
    return `de uitvoer${when} heeft een nieuwe pset ${d.out}${owner} die niet in ons register staat`;
  }
  const name = index.name(d.chunk);
  const what = `${index.type(d.chunk)} #${index.id(d.chunk)}${name ? ` (${name})` : ''}`;
  if (d.whole === 'ontbreekt') return `${what}: ontbreekt in de uitvoer${when}${d.source ? ` (${d.source.slice(0, 60)})` : ''}`;
  if (d.whole === 'type') return `${what}: in de uitvoer${when} als ${d.out}`;
  if (d.whole === 'aantal') return `${what}: ${d.source} argumenten → ${d.out} argumenten${when}, geen bekende lay-out`;
  if (d.whole === 'gedeeld') return `${what}: heeft in de uitvoer${when} dezelfde tegenhanger (#${d.out}) als een ander stuk van de bron`;
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
  /** 1: het stuk paarde niet eenduidig (fixronde 4, BLOKKEERT 5). Meer bronstukken of meer uitvoerregels hadden dezelfde
   *  sleutel (dezelfde relating, dezelfde naam, dezelfde resource in `OPS_Assignments`, dezelfde inhoud, of alleen het
   *  type en de plek). Dan is niet te zeggen welke regel bij welk bronstuk hoort: (b) zet er geen bronwaarde terug, en een
   *  verschil in O0 weigert als `niet-eenduidig`. */
  readonly ambiguous: Uint8Array;
  /** P-stuk → de regel die het deelt met een ander P-stuk (fixronde 4, plek 26). */
  readonly shared: ReadonlyMap<number, number>;
}

/** De keten van de owner history: alleen daarvan schrijft de writer een kopie naast een stuk dat niet P is (de
 *  normalisatie `id`; een eigen owner history naast een gedeelde van de bron). */
const COPY_TYPES: ReadonlySet<string> = new Set(['IFCOWNERHISTORY', 'IFCPERSONANDORGANIZATION', 'IFCPERSON', 'IFCORGANIZATION', 'IFCAPPLICATION']);

/**
 * Paar de P-stukken van de bron met `lines`. `exactAssignments(pset)`: mogen de properties van deze `OPS_Assignments` op
 * hun volle naam paren (`GUID#N`)? Dat geldt in O0, en in O1 als de toewijzingen van de taak niet veranderden: dan
 * schrijft de writer dezelfde properties in dezelfde volgorde. Anders paren ze op de resource (`GUID`), en is een resource
 * die twee keer aan de taak hangt niet eenduidig (fixronde 4, plek 29: `#N` is een volgnummer, geen identiteit).
 */
function pairOutput(input: LossCheckInput, lines: readonly OutLine[], exactAssignments: (pset: number) => boolean = () => true): Pairing {
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
  const ambiguous = new Uint8Array(n);
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
    const pos = RELATION_SLOTS[t]?.relating;
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
    const pos = RELATION_SLOTS[line.type]?.relating;
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
  /** Relaties die op hun GlobalId paarden (één kandidaat met hetzelfde GlobalId): dat is een identiteit. */
  const byGuidPair = new Uint8Array(n);
  /** Sleutel → de bronrelaties met die sleutel (voor de eenduidigheid, na het paren). */
  const relKeyOf = new Map<number, string>();
  const pairRelations = () => {
    for (let r = 0; r < n; r++) {
      if (relDone[r] || !index.isEntity(r) || !isP(r) || !cls.inR[r] || fixed.has(sid(r))) continue;
      const key = relKeySource(r);
      if (key === undefined) continue;
      relDone[r] = 1;
      relKeyOf.set(r, key);
      const candidates = outRels.get(key) ?? [];
      if (candidates.length === 0) continue;
      // Eén kandidaat met hetzelfde GlobalId: de writer gaf de relatie haar GlobalId terug (`ifcGlobalIds`). Anders de
      // eerste nog vrije; met meer kandidaten (of meer bronrelaties met deze sleutel) is dat niet eenduidig (hieronder).
      const guid = index.globalId(r);
      const byGuid = candidates.filter(o => unquote(out.get(o)!.args[0]) === guid);
      if (byGuid.length === 1) { byGuidPair[r] = 1; pair(r, byGuid[0]); continue; }
      const free = candidates.find(o => !usedOut.has(o));
      pair(r, free ?? candidates[0]);
    }
  };

  /** Paar de P-stukken in `targets` met de stukken in `outIds`, per type: wat al een paar heeft blijft, dan op naam
   *  (`NAME_SLOT`), dan op inhoud (`CONTENT_PAIR`), dan op positie (niet voor properties en templates). */
  const pairGroup = (targets: readonly number[], outIds: readonly number[], keyOf: (name: string) => string = x => x, exceptions = false): void => {
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
      // Een kopie bestaat alleen in de keten van de owner history (fixronde 4, plek 28): een ander stuk dat niet P is (een
      // vreemde werktijd in de eigen kalender) paart niet met een regel van de writer; de lijst van de eigenaar ziet dan
      // een verschil.
      let todo = src.filter(t => {
        const o = outIdOf(t);
        if (o !== undefined && left.includes(o)) { left = left.filter(x => x !== o); if (!inD[t] && isP(t)) pair(t, o); return false; }
        return o === undefined || (!isP(t) && COPY_TYPES.has(index.type(t)));
      });
      /** Paar op een sleutel. Hebben meer bronstukken of meer regels dezelfde sleutel, dan is het paar niet eenduidig
       *  (BLOKKEERT 5): dan nog wel in volgorde paren (de vergelijking ziet een verschil), maar met het merk `ambiguous`. */
      const take = (srcKey: (t: number) => string, outKey: (line: OutLine) => string) => {
        const srcCount = new Map<string, number>();
        for (const t of todo) { const k = srcKey(t); srcCount.set(k, (srcCount.get(k) ?? 0) + 1); }
        const outCount = new Map<string, number>();
        const keyOfOut = new Map<number, string>();
        for (const id of left) { const k = outKey(out.get(id)!); keyOfOut.set(id, k); outCount.set(k, (outCount.get(k) ?? 0) + 1); }
        todo = todo.filter(t => {
          const k = srcKey(t);
          const o = left.find(id => keyOfOut.get(id) === k);
          if (o === undefined) return true;
          if ((srcCount.get(k) ?? 0) > 1 || (outCount.get(k) ?? 0) > 1) ambiguous[t] = 1;
          left = left.filter(x => x !== o);
          pair(t, o);
          return false;
        });
      };
      const nameSlot = NAME_SLOT[type];
      if (nameSlot !== undefined) {
        // Een tekst gedecodeerd; een ander token (een UnitType als `.LENGTHUNIT.`) zoals het er staat.
        const key = (tok: string | undefined, text: (x: string) => string) => {
          const x = (tok ?? '').trim();
          return x.startsWith("'") ? keyOf(text(x)) : `\u0000${x}`;
        };
        // Een werktijd eerst op naam met begin- en einddatum (fixronde 4, plek 27): elke feestdag staat er per jaar,
        // met dezelfde naam.
        if (type === 'IFCWORKTIME') {
          const srcKey = (t: number) => [0, 4, 5].map(k => key(index.argTokens(t)?.[k], x => index.tokenText(t, x))).join('\u0001');
          take(srcKey, line => [0, 4, 5].map(k => key(line.args[k], outDecode)).join('\u0001'));
        }
        take(t => key(index.argTokens(t)?.[nameSlot], x => index.tokenText(t, x)), line => key(line.args[nameSlot], outDecode));
      }
      if (NAME_ONLY.has(type)) continue;
      if (CONTENT_PAIR.has(type)) {
        take(t => (index.argTokens(t) ?? []).map(x => sourceText(index, t, x)).join('|'), line => line.args.map(outText).join('|'));
      }
      // Op plek: alleen eenduidig als er van dit type één bronstuk en één regel over zijn, en het type geen naam heeft die
      // het stuk aanwijst: een eenheid die niet op haar UnitType paarde, een template, en een uitzondering in een kalender
      // die niet op naam en datum paarde (dat kan een andere feestdag zijn: plek 27). De werkweek van een kalender heeft
      // een vast label van de writer (`Standard work week`); daar is de plek de sleutel.
      const named = nameSlot !== undefined && (type !== 'IFCWORKTIME' || exceptions);
      const several = todo.length > 1 || left.length > 1 || named;
      for (let j = 0; j < Math.min(todo.length, left.length); j++) {
        if (several) ambiguous[todo[j]] = 1;
        pair(todo[j], left[j]);
      }
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
        const assignments = line.type === 'IFCPROPERTYSET' && k2 === 4 && index.name(s) === PSET.Assignments;
        const keyOf = assignments && (!exactAssignments(s) || hasBareAssignmentKey(index, s)) ? assignmentKey : undefined;
        pairGroup(targets, outIds, keyOf, line.type === 'IFCWORKCALENDAR' && k2 === 7);
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

  // Relaties zonder GlobalId-paar: eenduidig alleen als hun sleutel bij één bronrelatie en één regel hoort.
  const relCount = new Map<string, number>();
  for (const key of relKeyOf.values()) relCount.set(key, (relCount.get(key) ?? 0) + 1);
  for (const [r, key] of relKeyOf) {
    if (!byGuidPair[r] && ((relCount.get(key) ?? 0) > 1 || (outRels.get(key)?.length ?? 0) > 1)) ambiguous[r] = 1;
  }
  const sourceOf = new Map<number, number>();
  const holders = new Map<number, number[]>();
  for (const [s, o] of pairs) {
    if (!sourceOf.has(o)) sourceOf.set(o, s);
    const list = holders.get(o);
    if (list) { if (!list.includes(s)) list.push(s); } else holders.set(o, [s]);
  }
  // Eén regel als tegenhanger van twee P-stukken (twee gelijke psets, twee relaties met dezelfde sleutel): niet
  // eenduidig, en de uitvoer heeft één stuk waar de bron er twee had (fixronde 4, plek 26). `compareOutput` meldt dat.
  const shared = new Map<number, number>();
  for (const [o, list] of holders) {
    const ps = list.filter(isP);
    if (ps.length > 1) for (const s of ps) { ambiguous[s] = 1; if (!shared.has(s)) shared.set(s, o); }
  }
  inheritAmbiguity(input, ambiguous, matched);
  return { out, pairs, pairedOut, sourceOf, matched, ambiguous, shared };
}

/** Dezelfde bewerkings- en dubbelzinnigheidsregels voor verliesbewaking en identiteitsbehoud. */
function pairEditedOutput(input: LossCheckInput, lines: readonly OutLine[], p0: Pairing,
  changed = changedScopes(input.domain, input.pristine, input.opened)): Pairing {
  const exact = (pset: number) => psetOwners(input, pset).every(key => !['assignments', '*', '@'].some(f => changed.keys.has(`${key}#${f}`)));
  const paired = pairOutput(input, lines, exact);
  unstableLists(input, p0, paired);
  return paired;
}

/** Eén stap ná de writer: eenduidig gekoppelde P-hulpregels houden hun bronidentiteit.
 * D en de bestaande vaste ids blijven staan. De regelvolgorde blijft die van de writer;
 * er gaan geen bronregels letterlijk terug. De werkelijke uitvoercontrole beslist daarna.
 */
export function preserveAuxiliaryIdentities(input: LossCheckInput, lines: readonly OutLine[]): readonly OutLine[] {
  const { index, cls, fixed } = input;
  const paired = pairEditedOutput(input, lines, pairOutput(input, input.o0));
  const ids = new Map<number, number>();
  const guids = new Map<number, string>();
  for (const [s, oldId] of paired.pairs) {
    if (cls.classes[s] !== 1 || cls.selection.inD[s] || fixed.has(Number(index.id(s)))) continue;
    if (paired.ambiguous[s] || paired.pairedOut.get(s)?.length !== 1 || paired.sourceOf.get(oldId) !== s) continue;
    ids.set(oldId, Number(index.id(s)));
    const line = paired.out.get(oldId)!;
    const args = index.argTokens(s);
    if (hasOwnOrigin(index, s) && args && args.length >= 5 && isRootLine(line) && isRootLine({ args })) {
      guids.set(oldId, args[0]);
    }
  }
  // Alleen nieuwe/ongepaarde regels krijgen een nieuw nummer. Geen daarvan raakt een bron-id;
  // ook niet wanneer de kale writer dat nummer toevallig al voor een ander stuk gebruikte.
  let next = 0;
  for (let s = 0; s < index.count; s++) if (index.isEntity(s)) next = Math.max(next, Number(index.id(s)));
  for (const line of lines) next = Math.max(next, line.id);
  for (const line of lines) if (!ids.has(line.id)) ids.set(line.id, fixed.has(line.id) ? line.id : ++next);
  const remap = (id: number) => ids.get(id) ?? id;
  let changed = false;
  const kept = lines.map(line => {
    const args = line.args.map(token => replaceRefsOutsideText(token, id => `#${remap(id)}`));
    if (guids.has(line.id)) args[0] = guids.get(line.id)!;
    // Deze bestaande native property bewaart STEP-ids als JSON-tekst, niet als #verwijzingen.
    if (line.type === 'IFCPROPERTYSINGLEVALUE' && ID_LIST_PROPS.has(decodeStepText(unquote(line.args[0])))) {
      const list = textIdList(line.args[2], token => decodeStepText(unquote(token)));
      if (list) args[2] = `IFCTEXT(${ifcJson(list.map(id => String(remap(id))))})`;
    }
    const id = remap(line.id);
    changed ||= id !== line.id || args.some((arg, k) => arg !== line.args[k]);
    return { id, type: line.type, args };
  });
  return changed ? kept : lines;
}

/** Het enige stuk van de bron dat naar `t` wijst, of -1 (geen of meer dan één). */
function onlyParent(index: StepIndex, t: number): number {
  let parent = -1;
  for (let k = index.inStart(t); k < index.inEnd(t); k++) {
    const from = index.inSource(k);
    if (from < 0 || from === parent) continue;
    if (parent >= 0) return -1;
    parent = from;
  }
  return parent;
}

/**
 * Erfelijk (fixronde 5, zoektocht punt 2): een hulpstuk dat alleen een niet-eenduidig gepaard stuk als ouder heeft (de
 * werktijden en tijdblokken van een feestdag, de properties van een pset), paarde via dat stuk. Dan is het zelf ook niet
 * eenduidig: anders gaat zijn bronwaarde mee naar een andere regel.
 */
function inheritAmbiguity(input: LossCheckInput, ambiguous: Uint8Array, matched: Uint8Array): void {
  const { index, cls } = input;
  const stack: number[] = [];
  for (let s = 0; s < index.count; s++) if (ambiguous[s]) stack.push(s);
  while (stack.length > 0) {
    const s = stack.pop()!;
    for (let k = index.outStart(s); k < index.outEnd(s); k++) {
      const t = index.outTarget(k);
      if (t < 0 || ambiguous[t] || !matched[t] || cls.classes[t] !== 1 || cls.selection.inD[t] || cls.inR[t]) continue;
      if (onlyParent(index, t) !== s) continue;
      ambiguous[t] = 1;
      stack.push(t);
    }
  }
}

/** De uitzonderingen (ExceptionTimes) van elke eigen kalender van de bron: kalender → de P-stukken in die lijst. */
function exceptionLists(input: LossCheckInput): Map<number, number[]> {
  const { index, cls } = input;
  const lists = new Map<number, number[]>();
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || cls.classes[c] !== 1 || index.type(c) !== 'IFCWORKCALENDAR') continue;
    const map = alignment('IFCWORKCALENDAR', index.argTokens(c) ?? [], WORK_CALENDAR_ARITY);
    const k = map ? map.indexOf(7) : -1;
    if (k < 0) continue;
    const members = index.refsAt(c, k).filter(m => m >= 0 && cls.classes[m] === 1);
    if (members.length > 0) lists.set(c, members);
  }
  return lists;
}

/** De ledenlijsten waarvan de sleutel kan verschuiven (fixronde 5, BLOKKEERT 3 en zoektocht punt 2): de uitzonderingen
 *  van een eigen kalender (uitvoerslot 7; sleutel naam en datums) en de properties van een eigen `OPS_Assignments`
 *  (slot 4; sleutel de naam `<resource-GUID>#<plek in de lijst>`, die bij wissen schuift). */
function shiftingLists(input: LossCheckInput): { readonly list: number; readonly members: readonly number[]; readonly outArg: number; readonly keyArgs: readonly number[] }[] {
  const { index, cls } = input;
  const lists = [...exceptionLists(input)].map(([list, members]) => ({ list, members, outArg: 7, keyArgs: [0, 4, 5] }));
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || cls.classes[c] !== 1 || index.type(c) !== 'IFCPROPERTYSET' || index.name(c) !== PSET.Assignments) continue;
    const members = index.refsAt(c, 4).filter(m => m >= 0 && cls.classes[m] === 1);
    if (members.length > 0) lists.push({ list: c, members, outArg: 4, keyArgs: [0] });
  }
  return lists;
}

/**
 * Plek 27 (fixronde 5, BLOKKEERT 3): de uitzonderingen van een kalender (feestdagen en werkende uitzonderingen) hebben in
 * het domein geen id; de kalenderdialoog wijzigt en wist ze per plek in de lijst. Naam en datum zijn dus geen identiteit.
 * Hetzelfde voor de toewijzingen van een taak (zoektocht punt 2): de property heet naar de resource en de plek in de
 * lijst, en de planner kan een toewijzing wissen of een andere resource geven. Verdween een lid van de bron uit O1, staat er
 * een met een andere sleutel (de sleutel van de writer in O1 tegenover die in O0), of staan ze in een andere volgorde, dan
 * kan elk lid met een ander verwisseld zijn. Dan paart elk lid van die lijst niet eenduidig: een bronwaarde gaat niet over,
 * en de merge weigert als er een is. Alleen erbij komen (achteraan, of een feestdag vooraan) laat de lijst eenduidig.
 */
function unstableLists(input: LossCheckInput, p0: Pairing, p1: Pairing): void {
  let marked = false;
  for (const { list: c, members, outArg, keyArgs } of shiftingLists(input)) {
    const keyOf = (line: OutLine | undefined) => (line ? keyArgs.map(k => (line.args[k] ?? '').trim()).join('\u0001') : undefined);
    const c0 = p0.pairedOut.get(c)?.[0];
    const c1 = p1.pairedOut.get(c)?.[0];
    const line0 = c0 === undefined ? undefined : p0.out.get(c0);
    const line1 = c1 === undefined ? undefined : p1.out.get(c1);
    if (!line0 || !line1) continue; // de lijst zelf is weg: dan valt ze buiten de toets
    const list0 = refList(line0.args[outArg]);
    const list1 = refList(line1.args[outArg]);
    const order = members.map(m => ({ m, at: list0.indexOf(p0.pairedOut.get(m)?.[0] ?? -1) })).sort((x, y) => x.at - y.at);
    let last = -1;
    const stable = order.every(({ m, at }) => {
      const o0 = p0.pairedOut.get(m)?.[0];
      const o1 = p1.pairedOut.get(m)?.[0];
      if (at < 0 || o0 === undefined || o1 === undefined) return false;
      const at1 = list1.indexOf(o1);
      if (at1 <= last || keyOf(p0.out.get(o0)) !== keyOf(p1.out.get(o1))) return false;
      last = at1;
      return true;
    });
    if (stable) continue;
    for (const m of members) if (p1.matched[m]) p1.ambiguous[m] = 1;
    marked = true;
  }
  if (marked) inheritAmbiguity(input, p1.ambiguous, p1.matched);
}

/**
 * De stukken van een uitzondering die de planner wiste (fixronde 5, BLOKKEERT 3 en 4): een lid van de uitzonderingen van
 * een kalender zonder regel in O1, terwijl de uitzonderingen van die kalender in het domein veranderden, met de stukken die
 * alleen daaronder hangen. Hun bronwaarden gaan met de feestdag weg; elk ander verdwenen stuk met een bronwaarde weigert.
 * Een lid zonder regel komt alleen voor als de lijst korter werd: het paren op plek koppelt de overige leden, ook een
 * uitzondering met een andere naam of datum (die paart dan niet eenduidig, `unstableLists`).
 */
function deletedExceptionItems(input: LossCheckInput, p1: Pairing, changed: ChangedScopes): Set<number> {
  const { index } = input;
  const out = new Set<number>();
  for (const [c, members] of exceptionLists(input)) {
    const key = objectKey(input, c);
    if (!key || !['holidays', 'workingExceptions', '*'].some(f => changed.keys.has(`${key}#${f}`))) continue;
    const stack = members.filter(m => p1.pairedOut.get(m) === undefined);
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (out.has(x)) continue;
      out.add(x);
      for (let k = index.outStart(x); k < index.outEnd(x); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && input.cls.classes[t] === 1 && onlyParent(index, t) === x && p1.pairedOut.get(t) === undefined) stack.push(t);
      }
    }
  }
  return out;
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
  // De verliesbewaking toetst de kale O0/O1 vóór het identiteitsbehoud. Deze bestaande
  // uitzondering blijft ook nodig voor ongepaarde/dubbelzinnige hulpregels en de veilige
  // terugval naar de kale uitvoer; de behoudstap en de uitvoercontrole volgen hierna.
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
  /** Een verschil van een gepaard stuk; paarde het niet eenduidig, dan met het merk (BLOKKEERT 5). */
  const push = (d: LossDiff) => diffs.push(p.ambiguous[d.chunk] ? { ...d, ambiguous: true } : d);
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
      // Een reeks die de lezer letterlijk laat staan (`\X2\00E\X0\`), leest een strikte lezer anders: dan alleen
      // byte-gelijk (fixronde 4, plek 19). De oude letterlijke codering (§4.9) leest `tokenText` zelf.
      if (!index.literalText(s) && !stepTextIsValid(unquote(a))) return a === b;
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

  /** Een lijst STEP-ids in een tekst (`ID_LIST_PROPS`): de ids zijn verwijzingen. De merge geeft elk eigen stuk een nieuw
   *  id; elk id van de bron moet in de uitvoer als zijn tegenhanger staan, in dezelfde volgorde (#886). */
  const sameIdList = (s: number, a: string, b: string): boolean => {
    const xs = textIdList(a, q => index.tokenText(s, q));
    const ys = textIdList(b, outDecode);
    if (!xs || !ys) return same(s, a, b, false);
    return xs.length === ys.length && xs.every((x, i) => allowed(index.chunkOf(String(x))).includes(ys[i]));
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
    if (line.type !== type) { push({ chunk: s, arg: -1, source: type, out: line.type, whole: 'type' }); continue; }
    const a = index.argTokens(s) ?? [];
    const b = line.args;
    const map = alignment(type, a, b.length);
    if (!map) { push({ chunk: s, arg: -1, source: String(a.length), out: String(b.length), whole: 'aantal' }); continue; }
    const covered = new Set<number>();
    for (let k = 0; k < a.length; k++) {
      const k2 = map[k];
      const at = a[k].trim();
      // Lay-out (smal): een argument dat in de uitvoer geen slot heeft, mag alleen wegvallen als het `$` was.
      if (k2 < 0) {
        if (at !== '$') push({ chunk: s, arg: k, source: at, out: '', slotless: 'bron' });
        continue;
      }
      covered.add(k2);
      if (saveField(s, o, type, k2)) continue;
      const bt = b[k2].trim();
      if (k2 === 0 && isGuidToken(at) && isGuidToken(bt) && isRootLine(line) && ownAuxGuid(s)) continue;
      const ok = type === 'IFCPROPERTYSET' && k2 === 4 ? sameMembers(s, at, bt)
        : isIdListSlot(index, s, type, k2) ? sameIdList(s, at, bt)
        : same(s, at, bt, DURATION_SLOTS[type]?.includes(k2) === true);
      if (!ok) push({ chunk: s, arg: k, source: at, out: bt, outArg: k2 });
    }
    // Een slot dat alleen de nieuwe lay-out heeft, moet leeg zijn (of (b) zet er `$` terug).
    // (Properties die een eigen pset erbij krijgt: zie `sameMembers`.)
    for (let j = 0; j < b.length; j++) {
      if (!covered.has(j) && b[j].trim() !== '$') push({ chunk: s, arg: j, source: '', out: b[j].trim(), slotless: 'uitvoer', outArg: j });
    }
  }

  // Twee P-stukken met één tegenhanger: de uitvoer heeft één stuk waar de bron er twee had (fixronde 4, plek 26).
  for (const [s, o] of p.shared) diffs.push({ chunk: s, arg: -1, source: '', out: String(o), whole: 'gedeeld', ambiguous: true });

  // Plek 34 (fixronde 5, besluit van Trias): een pset in de uitvoer zonder bronstuk. Alleen een pset van ons eigen register
  // mag erbij komen (nieuwe gegevens uit het domein, zoals `OPS_Assignments` voor een taak die er in de bron geen had);
  // elke andere nieuwe pset weigert. Het stuk van de melding is de eigenaar in de bron, als die er is.
  for (const [id, line] of out) {
    if (line.type !== 'IFCPROPERTYSET' || sourceChunkOf(input, id, p) !== undefined) continue;
    const name = outDecode(line.args[2] ?? '');
    if (REGISTER_PSET_NAMES.has(name)) continue;
    let owner = -1;
    for (const rel of out.values()) {
      if (rel.type !== 'IFCRELDEFINESBYPROPERTIES' || refOf(rel.args[5]) !== id) continue;
      for (const o of refList(rel.args[4])) { const c = sourceChunkOf(input, o, p); if (c !== undefined) { owner = c; break; } }
      if (owner >= 0) break;
    }
    diffs.push({ chunk: owner, arg: -1, source: '', out: `'${name}' (#${id})`, whole: 'nieuw' });
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
function structural(type: string, outArg: number, line: OutLine): boolean {
  if (isRootLine(line) && (outArg === 0 || outArg === 1)) return true;
  if (type === 'IFCPROPERTYSET' && outArg === 4) return true;
  const rel = RELATION_SLOTS[type];
  if (type.startsWith('IFCREL')) return rel ? outArg === rel.relating || outArg === rel.related : outArg >= 4;
  return false;
}

/**
 * Teksten die de lezer in delen leest (fixronde 4, BLOKKEERT 6; de tabel in de PR-body van #867): een datum met tijd in een
 * taaktijd (de lezer neemt in dagmodus de eerste tien tekens, `parseDateFromIFC`), en in een pset de properties die hij
 * splitst of inkort. Per pset: de propertynamen, of `*` voor elke property.
 */
const COMPOSITE_SLOTS: Readonly<Record<string, readonly number[]>> = { IFCTASKTIME: [5, 6, 7, 8, 9, 10, 14, 16, 17] };
const COMPOSITE_PROPS: Readonly<Record<string, readonly string[]>> = {
  [PSET.Assignments]: ['*'], // `eenheden|curve` (`value.split('|')`)
  [PSET.Resource]: [PROP.Resource.AvailabilitySteps], // `datum:eenheden;…`
  [PSET.ProjectSettings]: [PROP.ProjectSettings.ProjectStartDate, PROP.ProjectSettings.ProjectEndDate], // de eerste tien tekens
};

/**
 * De soort van een brontoken (zie `SlotKind`), op structuur (fixronde 4): eerst `$`, een lijst, een verwijzing (één `#id`),
 * dan tekst en getypeerde waarden. Een tekst is `samengesteld` als de lezer er een deel van leest: een slot of property uit
 * `COMPOSITE_SLOTS`/`COMPOSITE_PROPS`, of een tekst waarvan O0 (`outToken`) een niet-leeg deel heeft (`1|UNIFORM` in
 * `1|UNIFORM|BEWAAR-DIT`). `composite`: het slot staat in die tabellen.
 */
function slotKind(type: string, outArg: number, token: string, outToken: string, text: (tok: string) => string, composite: boolean): SlotKind {
  const t = token.trim();
  if (t === '$') return 'leeg';
  if (t.startsWith('(')) return 'lijst';
  if (/^#\d+$/.test(t)) return 'verwijzing';
  const isJson = (tok: string) => /^\s*[[{]/.test(text(tok));
  /** De tekst van een tekst-token, of van de tekst in een getypeerde waarde (`IFCTEXT('…')`); anders `undefined`. */
  const innerText = (tok: string, decode: (x: string) => string): string | undefined => {
    const x = tok.trim();
    if (x.startsWith("'")) return decode(x);
    const m = /^[A-Za-z0-9_]+\s*\(\s*('[\s\S]*')\s*\)$/.exec(x);
    return m ? decode(m[1]) : undefined;
  };
  const read = innerText(outToken, x => decodeStepText(unquote(x)));
  const source = innerText(t, text);
  const part = composite || (read !== undefined && read !== '' && source !== undefined && source !== read && source.includes(read));
  if (t.startsWith("'")) return DURATION_SLOTS[type]?.includes(outArg) ? 'duur' : isJson(t) ? 'json' : part ? 'samengesteld' : 'tekst';
  const typed = /^([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/.exec(t);
  if (typed) {
    const inner = typed[2].trim();
    if (typed[1].toUpperCase() === 'IFCDURATION') return 'duur';
    if (inner.startsWith("'")) return isJson(inner) ? 'json' : part ? 'samengesteld' : 'tekst';
    return inner.startsWith('.') ? 'enumeratie' : 'getal';
  }
  return /^[+-]?\d/.test(t) ? 'getal' : 'enumeratie';
}

/**
 * Welke verschillen van O0 kan (b) terugzetten? Een slot (geen heel stuk, geen argument zonder slot in de uitvoer), geen
 * structuur (`structural`), van een stuk dat eenduidig paarde (BLOKKEERT 5), niet uit een stuk met de oude letterlijke
 * codering als het tekst draagt (§4.5: die tekst leest een lezer van de uitvoer anders), elke verwijzing van de bron heeft
 * een eenduidige tegenhanger, en elke verwijzing die de writer in dat slot zet, is de tegenhanger van een verwijzing van
 * de bron (de structuur van de writer blijft: de bron voegt alleen toe, zoals een gedeelde eenheid in de projecteenheden).
 * Wat (b) niet terugzet, blijft een verschil in O0: dan weigert de merge.
 */
function planRestores(input: LossCheckInput, p0: Pairing, diffs: readonly LossDiff[]): SlotRestore[] {
  const { index } = input;
  const restores: SlotRestore[] = [];
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
    if (d.whole || d.slotless === 'bron' || d.outArg === undefined || !line || d.ambiguous
      || (input.cls.classes[d.chunk] !== 1 && !copy) || structural(line.type, d.outArg, line)) continue;
    const token = d.slotless === 'uitvoer' ? '$' : d.source;
    // Oude letterlijke codering (§4.9): alleen tekst die in beide coderingen hetzelfde leest (ASCII zonder `\`).
    if (index.literalText(d.chunk) && token.includes("'") && !/^[\x20-\x5b\x5d-\x7e]*$/.test(token)) continue;
    const props = COMPOSITE_PROPS[psetNameOf(index, d.chunk)];
    const composite = COMPOSITE_SLOTS[line.type]?.includes(d.outArg) === true
      || (line.type === 'IFCPROPERTYSINGLEVALUE' && d.outArg === 2 && !!props && (props.includes('*') || props.includes(index.name(d.chunk) ?? '')));
    // Een lijst STEP-ids die de writer uit zijn eigen nummering schrijft (`WorkingExceptionIds`), is geen waarde die de
    // lezer deels draagt. Wijst elk id naar de tegenhanger van hetzelfde stuk, dan is er geen verschil (`sameIdList`) en
    // geldt de lijst van de writer, met de nieuwe ids (#886). Komt hij hier toch, dan wijst de bron naar een stuk zonder
    // tegenhanger; (b) zet de bronwaarde terug zolang de planner het veld niet wijzigde, en bij een bewerking van het veld
    // vervalt ze (fixronde 5, plek 6).
    const idList = isIdListSlot(index, d.chunk, line.type, d.outArg);
    const kind = idList ? 'tekst' : slotKind(line.type, d.outArg, token, line.args[d.outArg], text(d.chunk), composite);
    const sourceRefs = new Set(refsOutsideText(token).map(id => index.chunkOf(String(id))));
    const writerRefsKept = refsOutsideText(line.args[d.outArg]).every(r => {
      const c = sourceChunkOf(input, r, p0);
      return c !== undefined && sourceRefs.has(c);
    });
    if (!writerRefsKept || mapToken(input, token, p0) === undefined) continue;
    restores.push({ chunk: d.chunk, arg: d.arg, outArg: d.outArg, token, kind });
  }
  return restores;
}

/** Het bronstuk achter uitvoer-id `r`: een tegenhanger, of een stuk dat niet P is (dat heeft in de uitvoer zijn eigen id). */
function sourceChunkOf(input: LossCheckInput, r: number, p: Pairing): number | undefined {
  const c = p.sourceOf.get(r);
  if (c !== undefined) return c;
  const own = input.index.chunkOf(String(r));
  return own >= 0 && input.cls.classes[own] !== 1 ? own : undefined;
}

/** Het brontoken met elke verwijzing naar een P-stuk vervangen door zijn tegenhanger in `p` (een stuk dat niet P is, houdt
 *  zijn id). `undefined` als een P-stuk geen tegenhanger heeft, of geen eenduidige (BLOKKEERT 5). */
function mapToken(input: LossCheckInput, token: string, p: Pairing): string | undefined {
  let ok = true;
  const out = replaceRefsOutsideText(token, id => {
    const c = input.index.chunkOf(String(id));
    if (c < 0) { ok = false; return `#${id}`; }
    if (input.cls.classes[c] !== 1) return `#${id}`;
    const o = p.pairedOut.get(c)?.[0];
    if (o === undefined || p.ambiguous[c]) { ok = false; return `#${id}`; }
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
export function replaceRefsOutsideText(token: string, f: (id: number) => string): string {
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
export function isRootLine(line: Pick<OutLine, 'args'>): boolean {
  return isGuidToken(line.args[0] ?? '') && /^(#\d+|\$)$/.test((line.args[1] ?? '').trim());
}
function isGuidToken(token: string): boolean {
  return /^'[0-9A-Za-z_$]{22}'$/.test(token.trim());
}

/** Wat er tussen het gelezen en het bewerkte domein veranderde (`changedScopes`). */
export interface ChangedScopes { readonly any: boolean; readonly keys: ReadonlySet<string> }

/** De soorten domeinobjecten met een eigen stuk in de bron (`stepIds`). Een verschil in een stuk van zo'n object mag
 *  alleen als het veld veranderde dat de writer daar schrijft (fixronde 4, plek 3: per veld, `explainScope`). */
const OBJECT_KINDS: ReadonlySet<string> = new Set(['task', 'res', 'seq', 'cal']);

/**
 * Wat er in het domein veranderde (fixronde 4, BLOKKEERT 1: per veld, geen algemene vlag). De sleutels:
 *  - `task:<id>` (met de toewijzingen van de taak), `seq:<id>`, `res:<id>`, `cal:<id>` (de projectkalender en de
 *    resourcekalenders): een object dat veranderde, verdween of erbij kwam;
 *  - `order:task`, `order:seq`, `order:res`, `order:cal`, `order:assignment`: alleen de volgorde veranderde;
 *  - `project.<veld>`: een veld van het project (`project.name`, `project.modifiedAt`, `project.calendarId`, …);
 *  - de naam van elk ander veld van het domein dat veranderde (`activityCodeTypes`, `baselines`, …).
 * `ifcSource` (bron) en `writeMode` (schrijfroute) zijn geen planning en tellen niet. Zonder sleutel is het domein gelijk
 * aan het gelezen domein, en schrijft de writer hetzelfde als in O0.
 */
export function changedScopes(originalDomain: WriteIFCInput, originalPristine: ImportResult, session?: ImportResult): ChangedScopes {
  const domain = planningIdentityInput(originalDomain), pristine = planningIdentityInput(originalPristine);
  const keys = new Set<string>();
  // Vergelijk op IFC-identiteit, maar houd ook de sessiesleutels voor objectKey/bySource beschikbaar.
  const aliases = new Map<string, Set<string>>();
  for (const input of [originalDomain, originalPristine, ...(session ? [session] : [])]) {
    const ids = planningIdentities(input);
    for (const [kind, objects, mapped] of [['res', input.resources, ids.resource],
      ['cal', [input.calendar, ...(input.resourceCalendars ?? [])], ids.calendar]] as const) {
      for (const object of objects) {
        const key = `${kind}:${mapped.get(object.id) ?? object.id}`, list = aliases.get(key) ?? new Set([key]);
        list.add(`${kind}:${object.id}`); aliases.set(key, list);
      }
    }
  }
  const json = (x: unknown) => JSON.stringify(x) ?? 'undefined';
  /** De toewijzingen per taak, zonder hun `id`: dat staat niet in het bestand (de lezer maakt het bij elk lezen nieuw). */
  const byTask = (list: readonly { id: string; taskId: string }[]) => {
    const m = new Map<string, unknown[]>();
    for (const { id: _id, ...x } of list) {
      const l = m.get(x.taskId);
      if (l) l.push(x); else m.set(x.taskId, [x]);
    }
    return m;
  };
  /** Per object: `kind:id` als het veranderde, verdween of erbij kwam; daarnaast per veld `kind:id#veld` (de velden
   *  van het object, en `#assignments` voor de toewijzingen van een taak), `kind:id#@` als het object maar aan één kant
   *  bestaat, en `kind:id#*` als het id vaker voorkomt (dan telt elk veld als veranderd). */
  const diff = <T extends { id: string }>(kind: string, a: readonly T[], b: readonly T[], extraA?: (x: T) => unknown, extraB?: (x: T) => unknown) => {
    const byId = (list: readonly T[]) => {
      const m = new Map<string, T[]>();
      for (const x of list) {
        const l = m.get(x.id);
        if (l) l.push(x); else m.set(x.id, [x]);
      }
      return m;
    };
    const add = (id: string, suffix = '') => {
      const key = `${kind}:${id}`;
      for (const alias of aliases.get(key) ?? [key]) keys.add(alias + suffix);
    };
    const ma = byId(a);
    const mb = byId(b);
    for (const id of new Set([...ma.keys(), ...mb.keys()])) {
      const xs = ma.get(id) ?? [];
      const ys = mb.get(id) ?? [];
      if (xs.length !== 1 || ys.length !== 1) {
        if (json(xs.map(x => [x, extraA?.(x)])) !== json(ys.map(y => [y, extraB?.(y)]))) {
          add(id);
          add(id, xs.length === 0 || ys.length === 0 ? '#@' : '#*');
        }
        continue;
      }
      const x = xs[0] as unknown as Record<string, unknown>;
      const y = ys[0] as unknown as Record<string, unknown>;
      const plain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (json(x[k]) === json(y[k])) continue;
        add(id);
        add(id, `#${k}`);
        // Een veld dat zelf een object is (`time` van een taak): ook per deel, `kind:id#time.scheduleStart` (fixronde 5,
        // VERVOLG: een tijdslot volgt uit zijn eigen delen van `time`, niet uit het hele object).
        const a = x[k];
        const b = y[k];
        if (plain(a) && plain(b)) {
          for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) if (json(a[s]) !== json(b[s])) add(id, `#${k}.${s}`);
        } else if (plain(a) || plain(b)) {
          for (const s of Object.keys((plain(a) ? a : b) as Record<string, unknown>)) add(id, `#${k}.${s}`);
        }
      }
      if (extraA && json(extraA(xs[0])) !== json(extraB?.(ys[0]))) { add(id); add(id, '#assignments'); }
    }
    if (a.map(x => x.id).join('\n') !== b.map(x => x.id).join('\n')) keys.add(`order:${kind}`);
  };
  const asgnA = byTask(domain.assignments);
  const asgnB = byTask(pristine.assignments);
  diff('task', domain.tasks, pristine.tasks, t => asgnA.get(t.id), t => asgnB.get(t.id));
  const order = (list: readonly { taskId: string; resourceId: string }[]) => list.map(x => `${x.taskId}>${x.resourceId}`).join('\n');
  if (order(domain.assignments) !== order(pristine.assignments)) keys.add('order:assignment');
  diff('seq', domain.sequences, pristine.sequences);
  diff('res', domain.resources, pristine.resources);
  // De kalenders zoals de writer ze schrijft: de projectkalender, en de bibliotheek zonder de kopie onder het id van de
  // projectkalender (`ifcWriter.ts`). Na openen via de store staat die kopie er altijd in (`promoteProjectCalendarToLibrary`).
  const calendars = (x: ImportResult) => [x.calendar, ...(x.resourceCalendars ?? []).filter(c => c.id !== x.project.calendarId)];
  diff('cal', calendars(domain), calendars(pristine));
  const pa = domain.project as unknown as Record<string, unknown>;
  const pb = pristine.project as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) if (json(pa[k]) !== json(pb[k])) keys.add(`project.${k}`);
  const skip = new Set(['tasks', 'sequences', 'resources', 'assignments', 'calendar', 'resourceCalendars', 'project', 'ifcSource', 'writeMode']);
  const a = domain as unknown as Record<string, unknown>;
  const b = pristine as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!skip.has(k) && json(a[k]) !== json(b[k])) keys.add(k);
  return { any: keys.size > 0, keys };
}

/** Het domeinobject van een bronstuk (`task:<id>`, `res:<id>`, `seq:<id>`, `cal:<id>`; een eigen baselinekop: `baselines`),
 *  of `undefined` voor het werkplan, het live-schema, het project en elk stuk zonder eigen object. */
function objectKey(input: LossCheckInput, c: number): string | undefined {
  const o = input.bySource.get(Number(input.index.id(c)));
  if (o && OBJECT_KINDS.has(o.kind)) return `${o.kind}:${o.id}`;
  if (!o && input.fixed.has(Number(input.index.id(c))) && isBaselineHead(input.index, c)) return 'baselines';
  return undefined;
}

/**
 * Bij welke domeinobjecten hoort elk P-stuk van de bron, en langs welke weg (fixronde 4, plek 2 en 3: verklaren per
 * veld). Een scope is `<object>|<weg>`; het object is `task:<id>`, `res:<id>`, `seq:<id>`, `cal:<id>`, `baselines` of
 * `project` (werkplan, live-schema, project en elk ander D-stuk). De weg:
 *  - `self`: het D-stuk zelf;
 *  - `slot:<k>`: wat het D-stuk via argument k bereikt (de taaktijd van een taak: `slot:11`; de werkweek van een
 *    kalender: `slot:6`, de uitzonderingen: `slot:7`);
 *  - `rel`: een relatie die naar het D-stuk wijst;
 *  - `pset:<naam>`: een pset van het D-stuk (via `IfcRelDefinesByProperties`), met haar properties.
 */
function sourceScopes(input: LossCheckInput): Map<number, Set<string>> {
  const { index, cls } = input;
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const scopes = new Map<number, Set<string>>();
  const rootOf = (d: number): string => objectKey(input, d) ?? 'project';
  const add = (x: number, scope: string) => {
    let set = scopes.get(x);
    if (!set) scopes.set(x, set = new Set());
    set.add(scope);
  };
  const spread = (start: number, scope: readonly string[]) => {
    const stack = [start];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const s of scope) add(x, s);
      for (let k = index.outStart(x); k < index.outEnd(x); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && isP(t) && !inD[t] && !cls.inR[t]) stack.push(t);
      }
    }
  };
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || !isP(i)) continue;
    if (inD[i]) {
      const root = rootOf(i);
      add(i, `${root}|self`);
      // Het slot zoals de writer het schrijft (een oude lay-out: `alignment`).
      const a = index.argTokens(i) ?? [];
      const type = index.type(i);
      const arity = type === 'IFCWORKCALENDAR' ? WORK_CALENDAR_ARITY
        : type === 'IFCWORKPLAN' || type === 'IFCWORKSCHEDULE' ? WORK_CONTROL_ARITY
        : type === 'IFCTASK' && a.length === 12 ? 13 : a.length;
      const map = alignment(type, a, arity);
      for (let k = index.outStart(i); k < index.outEnd(i); k++) {
        const t = index.outTarget(k);
        const arg = index.outArg(k);
        if (t >= 0 && isP(t) && !inD[t] && !cls.inR[t]) spread(t, [`${root}|slot:${map?.[arg] ?? arg}`]);
      }
    } else if (cls.inR[i]) {
      const roots = new Set<string>();
      for (let k = index.outStart(i); k < index.outEnd(i); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && inD[t]) roots.add(rootOf(t));
      }
      if (roots.size === 0) roots.add('project');
      for (const r of roots) add(i, `${r}|rel`);
      const pset = index.type(i) === 'IFCRELDEFINESBYPROPERTIES' ? index.refAt(i, 5) : -1;
      const way = pset >= 0 ? `pset:${index.name(pset) ?? ''}` : `rel:${index.type(i)}`;
      for (let k = index.outStart(i); k < index.outEnd(i); k++) {
        const t = index.outTarget(k);
        if (t >= 0 && isP(t) && !inD[t] && !cls.inR[t]) spread(t, [...roots].map(r => `${r}|${way}`));
      }
    }
  }
  return scopes;
}

// ── O1: welk verschil een bewerking aantoonbaar verklaart (fixronde 4, BLOKKEERT 1) ──

/** De properties van `OPS_ProjectSettings` en het projectveld dat de writer erin schrijft (`ifcWriter.ts`, de
 *  projectinstellingen). Alleen een wijziging van dat veld verklaart een verschil in die property. */
const PROJECT_SETTINGS_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [PROP.ProjectSettings.InternalProjectId]: ['id'],
  [PROP.ProjectSettings.wbsAutoNumber]: ['wbsAutoNumber'],
  [PROP.ProjectSettings.DefaultTaskDurationUnit]: ['defaultTaskDurationUnit'],
  [PROP.ProjectSettings.DefaultWorkRule]: ['defaultWorkRule'],
  [PROP.ProjectSettings.StatusDate]: ['statusDate'],
  [PROP.ProjectSettings.ProgressMode]: ['progressMode'],
  [PROP.ProjectSettings.ProjectStartDate]: ['startDate'],
  [PROP.ProjectSettings.ProjectEndDate]: ['endDate'],
  [PROP.ProjectSettings.CreatedAt]: ['createdAt'],
  [PROP.ProjectSettings.ModifiedAt]: ['modifiedAt'],
  [PROP.ProjectSettings.CompanyId]: ['companyId'],
  [PROP.ProjectSettings.CompanyName]: ['companyName'],
  [PROP.ProjectSettings.IfcSchemaConfirmed]: ['ifcSchema', 'ifcSchemaUnconfirmed'],
  [PROP.ProjectSettings.IfcSchemaUnconfirmed]: ['ifcSchema', 'ifcSchemaUnconfirmed'],
  [PROP.ProjectSettings.P6ProjectCode]: ['p6ProjectCode'],
  [PROP.ProjectSettings.DependentProjectsFolder]: ['dependentProjectsFolder'],
  [PROP.ProjectSettings.ProjectName]: ['name'],
  [PROP.ProjectSettings.ProjectDescription]: ['description'],
  [PROP.ProjectSettings.Author]: ['author'],
  [PROP.ProjectSettings.Organization]: ['company'],
};

/**
 * Per veld (fixronde 4, plek 3): de velden van het domeinobject die de writer in elk slot schrijft. Een verschil in een
 * slot zonder veld hier (een constante, de GlobalId, een verwijzing naar een hulpstuk) verklaart geen bewerking.
 * `IfcTask`: `IFC_TASK_SLOTS` (`ifcTaskSlots.ts`); `IfcTaskTime`: `IFC_TASKTIME_SLOTS` (de naam is die van de taak, de
 * rest komt uit de delen van `task.time` in `TASKTIME_SLOT_FIELDS`; StatusTime ook uit de statusdatum van het project).
 * Dezelfde tabellen zeggen of de planner het veld van een slot wijzigde (fixronde 5, plek 6): dan vervalt de bronwaarde.
 */
const TASK_SLOT_FIELDS: Readonly<Record<number, readonly string[]>> = {
  2: ['name'], 3: ['description'], 4: ['customTaskTypeId', 'taskType'], 5: ['wbsCode'],
  // Status: `'STARTED'` bij een lopende taak op 100 % (`isRunningAtFullCompletion` in `ifcTaskSlots.ts`).
  7: ['status', 'time.completion', 'time.actualFinish', 'isSummary', 'childIds'], 9: ['isMilestone'],
  10: ['priority'], 12: ['customTaskTypeId', 'taskType'],
};
/** Per slot van `IfcTaskTime` de velden van de taak waar de writer het uit schrijft (`IFC_TASKTIME_SLOTS` en `writeTask` in
 *  `ifcWriter.ts`; fixronde 5, VERVOLG van Terra). Een datum hangt ook af van de eenheid van de taak (de formatter,
 *  `taskDateTimeFormatter`); een duur ook van het type, de eenheid en de kalender van de taak (minuten per dag, `PT…` of
 *  `P…D`); een speling ook van haar minuten (het record in `ExactFloat`). De rekenslots kunnen achtergehouden zijn ("datums
 *  zoals opgeslagen", `withheldTaskTimeFields`). Dit is de ene definitie van "de planner wijzigde het veld van dit slot":
 *  ook de merge-writer leest haar (`taskTimeSlotFields`, vervolg-PR van #867). */
const T = (...parts: string[]) => parts.map(p => `time.${p}`);
const DATE_FORMAT = T('durationUnit', 'durationMinutes');
const WITHHELD = '@withheldTaskTimeFields';
const TASKTIME_SLOT_FIELDS: Readonly<Record<number, readonly string[]>> = {
  0: ['name'],
  3: T('durationType'),
  4: [...T('scheduleDuration', 'durationMinutes', 'durationUnit', 'durationType'), 'calendarId'],
  5: [...T('scheduleStart'), ...DATE_FORMAT],
  6: [...T('scheduleFinish'), ...DATE_FORMAT],
  7: [...T('earlyStart'), ...DATE_FORMAT, WITHHELD],
  8: [...T('earlyFinish'), ...DATE_FORMAT, WITHHELD],
  9: [...T('lateStart'), ...DATE_FORMAT, WITHHELD],
  10: [...T('lateFinish'), ...DATE_FORMAT, WITHHELD],
  11: [...T('freeFloat', 'freeFloatMinutes'), WITHHELD],
  12: [...T('totalFloat', 'totalFloatMinutes'), WITHHELD],
  13: [...T('isCritical'), WITHHELD],
  14: [...T('actualStart', 'actualFinish'), ...DATE_FORMAT],
  15: [...T('actualDuration', 'durationType'), 'calendarId'],
  16: [...T('actualStart'), ...DATE_FORMAT],
  17: [...T('actualFinish'), ...DATE_FORMAT],
  18: [...T('remainingTime', 'remainingMinutes', 'durationUnit', 'durationType'), 'calendarId'],
  19: T('completion'),
};
/** De velden waar de writer deze slots van `IfcTaskTime` uit schrijft, als pad (`time.scheduleDuration`, `calendarId`),
 *  zonder de achtergehouden velden. */
export function taskTimeSlotFields(...slots: number[]): string[] {
  return [...new Set(slots.flatMap(slot => TASKTIME_SLOT_FIELDS[slot] ?? []).filter(f => !f.startsWith('@')))];
}
/** De waarde van een veld van een taak op zijn pad uit `taskTimeSlotFields`. */
export function taskField(task: unknown, path: string): unknown {
  const t = task as Record<string, unknown>;
  return path.startsWith('time.') ? (t.time as Record<string, unknown> | undefined)?.[path.slice(5)] : t[path];
}
/** `IfcRelSequence` en zijn `IfcLagTime` (`writeSequence`); ook de merge-writer leest dit (`sourceDayLagIds`). */
export const LAG_VALUE_FIELDS: readonly string[] = ['lagDays', 'lagMinutes', 'lagPercent'];
export const LAG_FIELDS: readonly string[] = [...LAG_VALUE_FIELDS, 'lagUnit'];
const SEQ_SLOT_FIELDS: Readonly<Record<number, readonly string[]>> = {
  4: ['predecessorId'], 5: ['successorId'], 6: LAG_FIELDS, 7: ['type'],
};
/** Een resource (`writeResource`): naam, omschrijving, en bij een kostenresource het type. */
const RES_SLOT_FIELDS: Readonly<Record<number, readonly string[]>> = { 2: ['name'], 3: ['description'], 4: ['type'], 10: ['type'] };
/** `OPS_Resource` (`writeResourceMeta`): property → veld. */
const RES_PROP_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [PROP.Resource.MaxUnits]: ['maxUnits'], [PROP.Resource.CostPerHour]: ['costPerHour'],
  [PROP.Resource.UnitOfMeasure]: ['unitOfMeasure'], [PROP.Resource.Color]: ['color'],
  [PROP.Resource.AvailabilitySteps]: ['availabilitySteps'], [PROP.Resource.ParentGuid]: ['parentId'],
  [PROP.Resource.LibraryOrigin]: ['libraryOrigin'],
};
/** Een kalender (`writeCalendar`): de werkweek (WorkingTimes, slot 6, met alles wat eronder hangt) en de uitzonderingen
 *  (ExceptionTimes, slot 7). */
const WEEK_FIELDS = ['workDays', 'workTime', 'workStartHour', 'workEndHour'];
const EXCEPTION_FIELDS = ['holidays', 'workingExceptions'];
const CAL_SLOT_FIELDS: Readonly<Record<number, readonly string[]>> = {
  2: ['name'], 3: ['description'], 4: ['shift'], 6: WEEK_FIELDS, 7: EXCEPTION_FIELDS, 8: ['shift'],
};
/** `OPS_Calendar` (`writeCalendarGenerationMeta`): property → velden. `LiteralTimes` staat er niet in: een kalender die
 *  bij het openen letterlijk was, blijft letterlijk (#872, `ifcLiteralCalendarIds`; knownbug 1026 is daarmee opgelost);
 *  voor een andere kalender kiest de writer het op grond van alle taken (`minuteModelWriteView`). Geen bewerking van de
 *  kalender verklaart dus een andere waarde. */
const CAL_PROP_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [PROP.Calendar.RuleSetId]: ['generation'], [PROP.Calendar.Region]: ['generation'], [PROP.Calendar.BreakChoice]: ['generation'],
  [PROP.Calendar.GeneratedFromYear]: ['generation'], [PROP.Calendar.GeneratedToYear]: ['generation'],
  [PROP.Calendar.LibraryOrigin]: ['libraryOrigin'],
  [PROP.Calendar.HoursPerDay]: ['hoursPerDay', ...WEEK_FIELDS],
  [PROP.Calendar.WorkStartHour]: WEEK_FIELDS, [PROP.Calendar.WorkEndHour]: WEEK_FIELDS,
  [PROP.Calendar.SimpleBreakStart]: ['simpleBreakStartMinute', 'workTime'],
  [PROP.Calendar.SimpleBreakDuration]: ['simpleBreakDurationMinutes', 'workTime'],
  [PROP.Calendar.IsHourCalendar]: ['workTime'],
  [PROP.Calendar.WorkingExceptionKeysV1]: ['workingExceptions'],
  [PROP.Calendar.WorkingExceptionIds]: EXCEPTION_FIELDS,
  [PROP.Calendar.P6Source]: ['p6Source'], [PROP.Calendar.P6NonWorkPenaltyDates]: ['p6NonWorkPenaltyDates', 'p6Source'],
  [PROP.Calendar.P6NonWorkPenaltyDatesState]: ['p6NonWorkPenaltyDatesState'],
};
/** De psets van een taak die de writer buiten `PER_TASK_PSETS` schrijft: pset → taakvelden (en velden van het project,
 *  met `@`). */
const TASK_PSET_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [PSET.Assignments]: ['assignments', 'resourceIds'],
  [PSET.Timephased]: ['assignments'],
  [PSET.DurationWalks]: ['timephasedDurationWalks'],
  [PSET.CustomFields]: ['customFields', '@customFieldDefs'],
  [PSET.ActivityCodes]: ['activityCodes', '@activityCodeTypes'],
};
/** Per-taak-psets die ook gegevens uit `writeTask` krijgen (`PerTaskWriteOptions`): die volgen ook uit `task.time` (en bij
 *  een mijlpaal uit `isMilestone`). */
const TASK_PSET_OPTION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  [PSET.Analysis]: ['time'], [PSET.WorkRule]: ['time'], [PSET.Milestone]: ['time', 'isMilestone'],
};

/**
 * Slots die de writer altijd als dezelfde constante schrijft (fixronde 5): DataOrigin en UserDefinedDataOrigin van een
 * werktijd en een taaktijd (`.PREDICTED.`, `$`), de naam en herkomst van een `IfcLagTime` (`'Lag'`, `.PREDICTED.`, `$`), de
 * vaste slots van een `IfcRecurrencePattern` (het type per soort, en `$`), Description en Unit van een property (`$`), Unit
 * van een `IfcPropertyEnumeration`, Description van een pset en Name en Description van haar relatie (`$`). Gemeten in
 * `ifcWriter.ts` (`writeCalendar`, `writeSequence`, `IFC_TASKTIME_SLOTS`; elke `IFCPROPERTYSINGLEVALUE` is
 * `(naam,$,waarde,$)`).
 */
const CONSTANT_SLOTS: Readonly<Record<string, readonly number[]>> = {
  IFCWORKTIME: [1, 2], IFCTASKTIME: [1, 2], IFCLAGTIME: [0, 1, 2], IFCRECURRENCEPATTERN: [0, 1, 3, 4, 5, 6],
  IFCPROPERTYSINGLEVALUE: [1, 3], IFCPROPERTYENUMERATEDVALUE: [1, 3], IFCPROPERTYENUMERATION: [2], IFCPROPERTYSET: [3],
  IFCRELDEFINESBYPROPERTIES: [2, 3],
};

/** Wat `explainO1` nodig heeft. */
interface O1Context {
  readonly input: LossCheckInput;
  /** De paren van de bron met O1, met de bronwaarden van (b) erin. */
  readonly p: Pairing;
  readonly scopes: ReadonlyMap<number, ReadonlySet<string>>;
  readonly changed: ChangedScopes;
  /** De persoon en de organisatie van de eigen owner history van de writer in O1 (auteur en bedrijf). */
  readonly ownPerson: number;
  readonly ownOrg: number;
  /** De taken van het gelezen en van het bewerkte domein, per id. */
  readonly tasks0: ReadonlyMap<string, Task>;
  readonly tasks1: ReadonlyMap<string, Task>;
  /** Draagt de lezing van de bron dit slot volledig (zie `lossCheck`, "Gedragen")? Per bronstuk en uitvoerslot. */
  readonly carried: (chunk: number, outArg: number) => boolean;
  /** Wat de planner wijzigde (`LossCheckInput.plannerChanged`, anders `changed`). */
  readonly plannerChanged: ReadonlySet<string>;
}

function o1Context(input: LossCheckInput, p: Pairing, changed: ChangedScopes, carried: O1Context['carried']): O1Context {
  const pao = p.out.get(refOf(p.out.get(input.owner1 ?? -1)?.args[0]));
  return {
    input, p, scopes: sourceScopes(input), changed, ownPerson: refOf(pao?.args[0]), ownOrg: refOf(pao?.args[1]),
    tasks0: new Map(input.pristine.tasks.map(t => [t.id, t])), tasks1: new Map(input.domain.tasks.map(t => [t.id, t])),
    carried, plannerChanged: input.plannerChanged ?? changed.keys,
  };
}

/** De keten van de owner history: auteur en bedrijf (`explainField`), voor elk object. */
const OWNER_CHAIN: ReadonlySet<string> = new Set(['IFCOWNERHISTORY', 'IFCPERSONANDORGANIZATION', 'IFCPERSON', 'IFCORGANIZATION', 'IFCAPPLICATION']);

/**
 * Verklaart een bewerking dit verschil tussen de bron (met (b)) en O1 aantoonbaar? Geeft de regel, of `undefined`: dan
 * weigert de merge. Geen algemene vrijstelling (fixronde 4, BLOKKEERT 1) en niets per object (plek 3); alleen:
 *  1. `leden`: de leden van een relatie, per lid (`explainMembers`);
 *  2. per veld, voor elke scope van het stuk (`sourceScopes`): het domeinveld dat de writer in dat slot (of die property)
 *     schrijft, veranderde (`explainScope`). Elke scope moet het verklaren.
 * Een stuk dat zijn tegenhanger deelt (`gedeeld`), verklaart niets.
 */
function explainO1(ctx: O1Context, d: LossDiff): string | undefined {
  const { input } = ctx;
  if (d.whole === 'nieuw') return undefined;
  const type = input.index.type(d.chunk);
  const arg = d.whole ? -1 : (d.outArg ?? d.arg);
  if (d.whole === 'gedeeld' || d.slotless) return undefined;
  // Een slot dat de writer altijd als dezelfde constante schrijft, volgt uit geen enkel veld (fixronde 5, plek 6 en
  // BLOKKEERT 4): geen bewerking verklaart een verschil daar.
  if (!d.whole && CONSTANT_SLOTS[type]?.includes(arg)) return undefined;
  const provenance = explainImportProvenance(ctx, d);
  if (provenance !== undefined) return provenance;
  const rel = memberRelation(type);
  if (!d.whole && rel?.related === arg) return explainMembers(ctx, d);
  if (OWNER_CHAIN.has(type)) return explainField(ctx, d, type, arg);
  // Een relatie (buiten haar leden) hoort bij haar ouder: de relating, of bij een pset de eigenaren. Haar naam en of ze
  // er is, volgen uit dat object (`explainRelation`), niet uit haar leden.
  if (input.cls.inR[d.chunk] && !input.cls.selection.inD[d.chunk] && rel) {
    const owners = type === 'IFCRELDEFINESBYPROPERTIES'
      ? input.index.refsAt(d.chunk, 4).filter(c => c >= 0).map(c => objectKey(input, c) ?? 'project')
      : [objectKey(input, input.index.refAt(d.chunk, rel.relating)) ?? 'project'];
    const whys = new Set<string>();
    for (const obj of owners.length > 0 ? owners : ['project']) {
      const why = obj === 'project' ? (d.whole === 'ontbreekt' ? membersGone(ctx, d.chunk, type) : explainField(ctx, d, type, arg)) : explainRelation(ctx, d, type, arg, obj);
      if (why === undefined) return undefined;
      whys.add(why);
    }
    return [...whys].join('; ');
  }
  const scopes = ctx.scopes.get(d.chunk);
  if (!scopes || scopes.size === 0) return explainField(ctx, d, type, arg);
  const whys = new Set<string>();
  for (const scope of scopes) {
    const why = explainScope(ctx, d, type, arg, scope);
    if (why === undefined) return undefined;
    whys.add(why);
  }
  return [...whys].join('; ');
}

/**
 * 1116: de eerste bewerking wist importPristine. Alleen de bijbehorende vlagproperty mag dan weg; de lege pset en
 * haar koppeling volgen mee. Andere bronproperties, beschrijvingen en koppelingen blijven onder de gewone bewaking.
 * Met SourceFormat blijft de pset bestaan en mag haar ledenlijst uitsluitend deze vlag verliezen.
 */
function explainImportProvenance(ctx: O1Context, d: LossDiff): string | undefined {
  const { input, p } = ctx;
  if ((input.opened ?? input.pristine).importPristine !== true || input.domain.importPristine === true
    || !ctx.plannerChanged.has('importPristine')) return undefined;
  const { index } = input;
  const type = index.type(d.chunk);
  const parents = (chunk: number, type: string, arg: number) => {
    const found = new Set<number>();
    for (let k = index.inStart(chunk); k < index.inEnd(chunk); k++) {
      const from = index.inSource(k);
      if (from >= 0 && index.type(from) === type && index.inArg(k) === arg) found.add(from);
    }
    return [...found];
  };
  const sets = type === 'IFCPROPERTYSINGLEVALUE' ? parents(d.chunk, 'IFCPROPERTYSET', 4)
    : type === 'IFCPROPERTYSET' ? [d.chunk]
    : type === 'IFCRELDEFINESBYPROPERTIES' ? [index.refAt(d.chunk, 5)] : [];
  if (sets.length !== 1) return undefined;
  const set = sets[0];
  if (set < 0 || index.type(set) !== 'IFCPROPERTYSET' || index.name(set) !== PSET.ImportProvenance) return undefined;
  const setArgs = index.argTokens(set) ?? [];
  if (setArgs.length !== 5 || setArgs[3].trim() !== '$') return undefined;
  const members = index.refsAt(set, 4);
  const flags = members.filter(c => c >= 0 && index.name(c) === PROP.ImportProvenance.UnchangedSinceImport);
  if (flags.length !== 1) return undefined;
  const flag = flags[0];
  const flagArgs = (index.argTokens(flag) ?? []).map(t => t.trim());
  if (index.type(flag) !== 'IFCPROPERTYSINGLEVALUE' || flagArgs.length !== 4 || flagArgs[1] !== '$'
    || flagArgs[2] !== 'IFCBOOLEAN(.T.)' || flagArgs[3] !== '$' || parents(flag, 'IFCPROPERTYSET', 4).length !== 1) return undefined;
  const rels = parents(set, 'IFCRELDEFINESBYPROPERTIES', 5);
  if (rels.length !== 1) return undefined;
  const rel = rels[0];
  const relArgs = index.argTokens(rel) ?? [];
  const owners = index.refsAt(rel, 4);
  if (relArgs.length !== 6 || relArgs[2].trim() !== '$' || relArgs[3].trim() !== '$' || owners.length !== 1
    || owners[0] < 0 || index.type(owners[0]) !== 'IFCWORKSCHEDULE' || isBaselineHead(index, owners[0])
    || !input.fixed.has(Number(index.id(owners[0])))) return undefined;
  if (d.whole === 'ontbreekt') {
    if (d.chunk === flag || (members.length === 1 && (d.chunk === set || d.chunk === rel))) return 'importPristine vervalt';
  } else if (!d.whole && d.chunk === set && (d.outArg ?? d.arg) === 4) {
    const line = p.out.get(p.pairedOut.get(set)?.[0] ?? -1);
    if (!line) return undefined;
    const before = members.filter(c => c !== flag);
    const after = refList(line.args[4]).map(id => sourceChunkOf(input, id, p));
    if (before.length === after.length && before.every((c, i) => c === after[i])) return 'importPristine vervalt';
  }
  return undefined;
}

/** Eén regel voor beide eigen kaarten: volledig gedragen bron, alle oude paren exact behouden,
 * uitsluitend de door de aanroeper bewezen nieuwe koppelingen. Geen gedeeltelijke JSON-samenvoeging. */
function ownMapGrows(ctx: O1Context, d: LossDiff, before: unknown, after: unknown, expected: ReadonlyMap<string, string>): boolean {
  if (!ctx.carried(d.chunk, 2) || !stringMap(before) || !stringMap(after)) return false;
  const old = Object.keys(before);
  return old.every(k => Object.prototype.hasOwnProperty.call(after, k) && after[k] === before[k])
    && Object.keys(after).length === old.length + expected.size
    && [...expected].every(([k, value]) => !Object.prototype.hasOwnProperty.call(before, k) && Object.prototype.hasOwnProperty.call(after, k) && after[k] === value);
}
function jsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function stringMap(value: unknown): value is Record<string, string> {
  return jsonObject(value) && Object.values(value).every(v => typeof v === 'string');
}
function mapJson(token: string, decode: (quoted: string) => string): unknown {
  const m = /^IFCTEXT\s*\(\s*('[\s\S]*')\s*\)$/.exec(token.trim());
  if (!m) return undefined;
  try { return JSON.parse(decode(m[1])); } catch { return undefined; }
}
/** De writer bewaart de domeinvolgorde. Alle bestaande definities blijven exact op hun plaats;
 * alleen werkelijk nieuwe ids mogen achteraan, met precies de domeininhoud. */
function ownDefinitionsGrow(before: readonly unknown[], domain: readonly { id: string }[], after: unknown): boolean {
  if (!Array.isArray(after) || domain.length <= before.length || after.length !== domain.length) return false;
  const ids = new Set<string>();
  return domain.every((v, i) => !ids.has(v.id) && !!ids.add(v.id)
    && JSON.stringify(after[i]) === JSON.stringify(v)
    && (i >= before.length || JSON.stringify(before[i]) === JSON.stringify(v)));
}
/** Alleen de templatelijst van onze activiteitscodes; een nieuwe verwijzing bewijst haar echte template en enumeratie. */
function explainCodeDefinitions(ctx: O1Context, d: LossDiff): string | false | undefined {
  const { input, p } = ctx, { index } = input;
  if (d.whole || d.slotless || d.ambiguous || p.ambiguous[d.chunk] || d.arg !== 6 || (d.outArg ?? d.arg) !== 6
    || index.type(d.chunk) !== 'IFCPROPERTYSETTEMPLATE' || index.name(d.chunk) !== PSET.ActivityCodes
    || ctx.scopes.get(d.chunk)?.size !== 1) return undefined;
  const before = (input.opened ?? input.pristine).activityCodeTypes ?? [], domain = input.domain.activityCodeTypes ?? [];
  if (!ctx.plannerChanged.has('activityCodeTypes') || domain.length <= before.length) return undefined;
  if (!ctx.carried(d.chunk, 6) || !ownDefinitionsGrow(before, domain, domain)) return false;
  const oldRefs = index.refsAt(d.chunk, 6), refs = refList(d.out);
  if (oldRefs.length !== before.length || refs.length !== domain.length || new Set(refs).size !== refs.length) return false;
  for (let i = 0; i < domain.length; i++) {
    const code = domain[i], line = p.out.get(refs[i]);
    if (i < oldRefs.length && p.pairedOut.get(oldRefs[i])?.[0] !== refs[i]) return false;
    if (!line || line.type !== 'IFCSIMPLEPROPERTYTEMPLATE' || line.args.length !== 12
      || decodeStepText(unquote(line.args[2])) !== code.name || line.args[3] !== '$' || line.args[4] !== '.P_ENUMERATEDVALUE.'
      || [5, 6, 8, 9, 10, 11].some(k => line.args[k] !== '$')) return false;
    if (!code.values.length) { if (line.args[7] !== '$') return false; }
    else {
      const enumeration = p.out.get(refOf(line.args[7]));
      if (!enumeration || enumeration.type !== 'IFCPROPERTYENUMERATION' || enumeration.args.length !== 3
        || decodeStepText(unquote(enumeration.args[0])) !== code.name || enumeration.args[2] !== '$') return false;
      // Vergelijk getypeerde labels na STEP-decodering, ook voor oude letterlijk geschreven bronnen.
      const labels = splitStepArgs(enumeration.args[1].slice(1, -1));
      if (labels.length !== code.values.length || labels.some((token, k) => {
        const m = /^IFCLABEL\(('[\s\S]*')\)$/.exec(token);
        return !m || decodeStepText(unquote(m[1])) !== code.values[k].code;
      })) return false;
    }
  }
  return 'nieuwe activiteitscodedefinities';
}
/** Lees de echte IFCTASK-regel bij de domeinsleutel van de writer; geen eigen GUID-afleiding. */
function writtenTaskGuids(ctx: O1Context): ReadonlyMap<string, string> | undefined {
  const guids = new Map<string, string>();
  for (const [id, key] of ctx.input.objects1 ?? []) if (key.startsWith('task:')) {
    const line = ctx.p.out.get(id), taskId = key.slice(5);
    if (line?.type !== 'IFCTASK' || guids.has(taskId)) return undefined;
    guids.set(taskId, unquote(line.args[0]));
  }
  return guids;
}
/** Alleen deze twee properties in hun ene eigen project/live-schema-pset, eenduidig gepaard op waardeslot 2. */
function explainOwnMapGrowth(ctx: O1Context, d: LossDiff, way: string): string | false | undefined {
  const { input, p } = ctx, { index } = input;
  if (d.whole || d.slotless || d.ambiguous || p.ambiguous[d.chunk] || index.type(d.chunk) !== 'IFCPROPERTYSINGLEVALUE'
    || d.arg !== 2 || (d.outArg ?? d.arg) !== 2 || ctx.scopes.get(d.chunk)?.size !== 1) return undefined;
  const name = index.name(d.chunk);
  const baseline = way === `pset:${PSET.Baselines}` && name === PROP.Baselines.TaskGuids;
  const taskTypes = way === `pset:${PSET.TaskTypes}` && name === PROP.TaskTypes.TaskTypes;
  if (!baseline && !taskTypes) return undefined;
  const parents = new Set<number>();
  for (let k = index.inStart(d.chunk); k < index.inEnd(d.chunk); k++) {
    const parent = index.inSource(k);
    if (parent >= 0) {
      if (index.type(parent) !== 'IFCPROPERTYSET' || index.inArg(k) !== 4) return undefined;
      parents.add(parent);
    }
  }
  const ids = p.pairedOut.get(d.chunk);
  const line = ids?.length === 1 ? p.out.get(ids[0]) : undefined;
  if (parents.size !== 1 || index.name([...parents][0]) !== (baseline ? PSET.Baselines : PSET.TaskTypes)
    || !line || line.type !== 'IFCPROPERTYSINGLEVALUE' || line.args.length !== 4 || unquote(line.args[0]) !== name) return undefined;
  const before = mapJson(d.source, q => index.tokenText(d.chunk, q));
  const after = mapJson(d.out, q => decodeStepText(unquote(q)));
  const expected = new Map<string, string>(), taskGuids = writtenTaskGuids(ctx);
  if (!taskGuids) return undefined;
  if (baseline) {
    const added = addedBaselineIds(ctx);
    if (!added.size || !stringMap(before)) return undefined;
    for (const b of input.domain.baselines ?? []) if (added.has(b.id)) {
      for (const row of b.tasks) if (!Object.prototype.hasOwnProperty.call(before, row.taskId)) {
        const guid = taskGuids.get(row.taskId);
        if (!guid) return undefined;
        expected.set(row.taskId, guid);
      }
    }
    if (!expected.size) return undefined;
    return ownMapGrows(ctx, d, before, after, expected) ? 'nieuwe baselinekoppelingen' : false;
  }
  if (!jsonObject(before) || !jsonObject(after)
    || Object.keys(before).sort().join(',') !== 'definitions,taskTypeIds'
    || Object.keys(after).sort().join(',') !== 'definitions,taskTypeIds'
    || !Array.isArray(before.definitions) || !stringMap(before.taskTypeIds) || !stringMap(after.taskTypeIds)) return undefined;
  const used = new Set(input.domain.tasks.map(t => t.customTaskTypeId).filter(Boolean));
  const definitions = (input.domain.customTaskTypes ?? []).filter(t => used.has(t.id));
  const grows = definitions.length > before.definitions.length;
  if (grows ? !ctx.plannerChanged.has('customTaskTypes') || !ownDefinitionsGrow(before.definitions, definitions, after.definitions)
    : JSON.stringify(before.definitions) !== JSON.stringify(after.definitions)
      || JSON.stringify(definitions) !== JSON.stringify(after.definitions)) return false;
  const valid = new Set(definitions.map(t => t.id));
  const oldTasks = new Map((input.opened ?? input.pristine).tasks.map(t => [t.id, t]));
  const replacements = new Map<string, string | undefined>();
  for (const task of input.domain.tasks) {
    const typeId = task.customTaskTypeId, oldType = oldTasks.get(task.id)?.customTaskTypeId;
    const guid = taskGuids.get(task.id);
    if (!guid) return undefined;
    if (typeId === oldType) continue;
    if (!(ctx.plannerChanged.has(`task:${task.id}#@`) || ctx.plannerChanged.has(`task:${task.id}#customTaskTypeId`))
      || (typeId && !valid.has(typeId))) return false;
    if (Object.prototype.hasOwnProperty.call(before.taskTypeIds, guid)) replacements.set(guid, typeId);
    else if (typeId) expected.set(guid, typeId);
  }
  if (!grows && !replacements.size && !expected.size) return undefined;
  const unchanged: Record<string, string> = { ...before.taskTypeIds };
  for (const [guid, type] of replacements) {
    delete unchanged[guid];
    if (type) expected.set(guid, type);
  }
  // Dezelfde kaartcontrole bewaakt alle overige paren en de volledige verwachte uitvoer.
  return ownMapGrows(ctx, d, unchanged, after.taskTypeIds, expected)
    ? 'taaktypedefinities en koppelingen volgens de bewerking' : false;

}

/** Een echte keuze uit de behouden baselines, ook na toevoegen; nooit een vrijstelling voor de hele pset. */
function explainActiveBaseline(ctx: O1Context, d: LossDiff, way: string): string | false | undefined {
  const { input, p } = ctx, { index } = input;
  if (way !== `pset:${PSET.Baselines}` || index.type(d.chunk) !== 'IFCPROPERTYSINGLEVALUE'
    || index.name(d.chunk) !== PROP.Baselines.ActiveBaselineId || d.slotless || d.ambiguous || p.ambiguous[d.chunk]
    || ctx.scopes.get(d.chunk)?.size !== 1 || !ctx.plannerChanged.has('activeBaselineId')) return undefined;
  const id = input.domain.activeBaselineId;
  if (!ctx.carried(d.chunk, 2)) return false;
  // De gewone writer laat de property weg als de planner de actieve baseline uitzet.
  if (!id) return input.domain.baselines?.length && d.whole === 'ontbreekt' ? 'actieve baseline uitgezet' : false;
  if (d.whole || d.arg !== 2 || (d.outArg ?? d.arg) !== 2 || !input.domain.baselines?.some(b => b.id === id)) return false;
  const m = /^IFCTEXT\(('[\s\S]*')\)$/.exec(d.out);
  return m && decodeStepText(unquote(m[1])) === id ? 'actieve baseline volgens de keuze' : false;
}
/** Eén scope `<object>|<weg>` (zie `sourceScopes`). */
function explainScope(ctx: O1Context, d: LossDiff, type: string, arg: number, scope: string): string | undefined {
  const { input, changed } = ctx;
  const { index } = input;
  const bar = scope.indexOf('|');
  const obj = scope.slice(0, bar);
  const way = scope.slice(bar + 1);
  if (obj === 'project') {
    const codes = explainCodeDefinitions(ctx, d);
    if (codes) return codes;
    const active = explainActiveBaseline(ctx, d, way);
    if (active) return active;
    const mapGrowth = explainOwnMapGrowth(ctx, d, way);
    if (mapGrowth) return mapGrowth;
    // De live-schema-pset hoort bij project, maar deze twee waarden volgen uit de baselineactie.
    // Alleen hun waardeslot; andere properties, namen en beschrijvingen krijgen geen vrijstelling.
    if (!d.whole && type === 'IFCPROPERTYSINGLEVALUE' && arg === 2 && way === `pset:${PSET.Baselines}`
      && changed.keys.has('baselines') && addedBaselineIds(ctx).size > 0) {
      const name = index.name(d.chunk);
      if (name === PROP.Baselines.Baselines) return 'baselinegegevens';
    }
    return explainField(ctx, d, type, arg) ?? literalBaselineForm(ctx, d, type, arg);
  }
  if (obj === 'baselines') return changed.keys.has('baselines') ? 'baselines' : undefined;
  const kind = obj.slice(0, obj.indexOf(':'));
  const has = (f: string) => changed.keys.has(`${obj}#${f}`) || changed.keys.has(`${obj}#*`);
  const any = (fields: readonly string[] | undefined) => {
    const f = fields?.find(x => (x.startsWith('@') ? changed.keys.has(x.slice(1)) : has(x)));
    return f === undefined ? undefined : `${obj}#${f}`;
  };
  if (has('@')) return undefined; // het object kwam erbij of verdween; dan is dit stuk geen stuk van hetzelfde object
  const prop = type === 'IFCPROPERTYSINGLEVALUE' ? index.name(d.chunk) ?? '' : undefined;
  if (kind === 'task') {
    if (way === 'self') return type === 'IFCTASK' && !d.whole ? any(TASK_SLOT_FIELDS[arg]) : undefined;
    if (type === 'IFCTASKTIME' && way.startsWith('slot:')) {
      if (d.whole) return undefined;
      if (arg === 14 && changed.keys.has('project.statusDate')) return 'statusdatum';
      return any(TASKTIME_SLOT_FIELDS[arg]) ?? literalWriterForm(ctx, d, type, arg, scope);
    }
    if (way.startsWith('pset:')) return explainTaskPset(ctx, d, type, arg, obj.slice(5), way.slice(5), prop);
    return undefined;
  }
  if (kind === 'seq') {
    if (way === 'self') return type === 'IFCRELSEQUENCE' && !d.whole ? any(SEQ_SLOT_FIELDS[arg]) : undefined;
    if (type === 'IFCLAGTIME' && way === 'slot:6') return any(LAG_FIELDS);
    return undefined;
  }
  if (kind === 'res') {
    if (way === 'self') return d.whole === 'type' ? any(['type']) : d.whole ? undefined : any(RES_SLOT_FIELDS[arg]);
    if (way === `pset:${PSET.Resource}`) return any(prop !== undefined ? RES_PROP_FIELDS[prop] : Object.values(RES_PROP_FIELDS).flat());
    return undefined;
  }
  if (kind === 'cal') {
    if (way === 'self') return type === 'IFCWORKCALENDAR' && !d.whole ? any(CAL_SLOT_FIELDS[arg]) : undefined;
    if (way === 'slot:6') return any(WEEK_FIELDS) ?? literalWriterForm(ctx, d, type, arg, scope);
    if (way === 'slot:7') return any(EXCEPTION_FIELDS);
    if (way === `pset:${PSET.Calendar}`) return any(prop !== undefined ? CAL_PROP_FIELDS[prop] : Object.values(CAL_PROP_FIELDS).flat());
    return undefined;
  }
  return undefined;
}

/** De slots die de writer op een letterlijke kalender in zijn eigen vorm schrijft: de datums en tijden (`DATETIME_SLOTS`)
 *  en de lijst periodes van een patroon (een werkweek met één periode wordt blokken). Of de lezer de waarde draagt, zegt
 *  deze lijst niet; dat doet `carried`. */
const writerFormSlot = (type: string, arg: number) =>
  DATETIME_SLOTS[type]?.slots.includes(arg) === true || (type === 'IFCRECURRENCEPATTERN' && arg === 7);

/**
 * Was knownbug 1102 (#886, besluit van Trias, 10 november 2026). Wordt de kalender van `scope` (`scopeCalendar`) bij
 * deze opslag letterlijk (`literalCalendarIds`), dan schrijft de writer elke datum en werktijd op die kalender als tijdstip, ook waar de planner
 * niets wijzigde; dat doet een gewone opslag op main ook (`minuteModelPending`). Zo'n datum is een vorm van OPS zelf, die
 * de lezer volledig draagt. Verklaard alleen als: het stuk P is (alleen P-stukken hebben een scope, `sourceScopes`); het
 * slot een datum of tijd is (`writerFormSlot`); en de lezing van deze bron de waarde van dat slot volledig draagt
 * (`carried`: de writer op de lezing geeft dezelfde waarde als de bron). Fixronde 1 van #886: een geldige schrijfwijze
 * bewijst dat niet; `'07:30:00'` in de enige periode van een scalaire kalender leest de lezer als 07:00. Zo'n slot houdt
 * de bronwaarde via (b), of de merge weigert.
 * De herleestoets (`sourceFormProblems`) vergelijkt met het domein waarin de lezer een waarde al kan zijn kwijtgeraakt;
 * de bewaking rekent er hier niet op.
 */
function literalWriterForm(ctx: O1Context, d: LossDiff, type: string, arg: number, scope: string): string | undefined {
  const { input } = ctx;
  const calendarId = scopeCalendar(ctx, scope, type);
  if (calendarId === undefined || !input.literalCalendarIds?.has(calendarId)) return undefined;
  if (d.whole) return undefined;
  if (!writerFormSlot(type, arg) || !ctx.carried(d.chunk, arg)) return undefined;
  return `kalender ${calendarId} wordt letterlijk`;
}

/**
 * De baselines (`OPS_Baselines.Baselines`, een pset van het live-schema: scope `project`) als een kalender bij deze opslag letterlijk wordt (#886, besluit van Trias): de
 * writer schrijft de datums van een rij op zo'n kalender, en het einde van het project op een letterlijke projectkalender,
 * als tijdstip (`minuteModelWriteView`), zoals een gewone opslag op main. Verklaard alleen als de JSON verder gelijk is:
 * dezelfde baselines en rijen in dezelfde volgorde, met alleen `start`/`finish` (en `projectEnd`) anders. En alleen als de
 * lezing van de bron de JSON volledig draagt (`carried`: O0 is hier gelijk aan de bron) en de planner de baselines niet
 * wijzigde tegenover wat de app na het openen liet zien (`plannerChanged`): dan is elk verschil de vorm van de writer voor
 * een waarde die de planner zag (fixronde 1 van #886). Sectie 1 ziet de datums in deze JSON niet. De herleestoets gaat de
 * baselines na (`sourceForm.ts`).
 */
function literalBaselineForm(ctx: O1Context, d: LossDiff, type: string, arg: number): string | undefined {
  const { input } = ctx;
  const literal = input.literalCalendarIds;
  if (!literal?.size || d.whole || type !== 'IFCPROPERTYSINGLEVALUE' || arg !== 2 || input.index.name(d.chunk) !== PROP.Baselines.Baselines
    || psetNameOf(input.index, d.chunk) !== PSET.Baselines) return undefined;
  if (!ctx.carried(d.chunk, arg) || ctx.plannerChanged.has('baselines')) return undefined;
  const src = mapJson(d.source, q => input.index.tokenText(d.chunk, q));
  const out = mapJson(d.out, q => decodeStepText(unquote(q)));
  type Obj = Record<string, unknown>;
  const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
  /** Gelijk, op `free` na: daar mag een datum een andere vorm krijgen. `tasks` vergelijkt de aanroeper. */
  const sameBut = (a: Obj, b: Obj, free: readonly string[]) => [...new Set([...Object.keys(a), ...Object.keys(b)])].every(k =>
    k === 'tasks' || JSON.stringify(a[k]) === JSON.stringify(b[k]) || (free.includes(k) && typeof a[k] === 'string' && typeof b[k] === 'string'));
  const { domain } = input;
  const calendarOf = (taskId: unknown) =>
    resolveCalendar(ctx.tasks1.get(String(taskId))?.calendarId, domain.resourceCalendars ?? [], domain.calendar).id;
  if (!Array.isArray(src) || !Array.isArray(out) || src.length !== out.length) return undefined;
  const ends = literal.has(domain.calendar.id) ? ['projectEnd'] : [];
  for (let i = 0; i < src.length; i++) {
    const a: unknown = src[i], b: unknown = out[i];
    if (!isObj(a) || !isObj(b) || !sameBut(a, b, ends) || !Array.isArray(a.tasks) || !Array.isArray(b.tasks)) return undefined;
    const rowsA: unknown[] = a.tasks, rowsB: unknown[] = b.tasks;
    if (rowsA.length !== rowsB.length) return undefined;
    for (let k = 0; k < rowsA.length; k++) {
      const ra = rowsA[k], rb = rowsB[k];
      if (!isObj(ra) || !isObj(rb) || ra.taskId !== rb.taskId) return undefined;
      if (!sameBut(ra, rb, literal.has(calendarOf(rb.taskId)) ? ['start', 'finish'] : [])) return undefined;
    }
  }
  return 'baselines op een kalender die letterlijk wordt';
}

/** De kalender van een scope met datums: de kalender van de taak bij haar taaktijd, of de kalender zelf bij haar werkweek. */
function scopeCalendar(ctx: O1Context, scope: string, type: string): string | undefined {
  const { domain } = ctx.input;
  if (type === 'IFCTASKTIME' && /^task:.*\|slot:\d+$/.test(scope)) {
    const task = ctx.tasks1.get(scope.slice(5, scope.lastIndexOf('|')));
    return task && resolveCalendar(task.calendarId, domain.resourceCalendars ?? [], domain.calendar).id;
  }
  return scope.startsWith('cal:') && scope.endsWith('|slot:6') ? scope.slice(4, scope.lastIndexOf('|')) : undefined;
}

/** Schrijft de merge dit verschil in de vorm van de writer omdat zijn kalender letterlijk wordt (`literalWriterForm`), voor
 *  elke scope van het stuk? Dan zet (b) de bronwaarde daar niet terug. */
function inLiteralWriterForm(ctx: O1Context, d: LossDiff): boolean {
  const scopes = ctx.scopes.get(d.chunk);
  if (!scopes || scopes.size === 0 || d.whole) return false;
  const type = ctx.input.index.type(d.chunk);
  const arg = d.outArg ?? d.arg;
  return [...scopes].every(scope => literalWriterForm(ctx, d, type, arg, scope) !== undefined);
}

/**
 * Verving de planner deze datum van een taaktijd zelf (fixronde 1 van #886)? Alleen dan geldt de waarde van de writer in
 * een slot dat bij de samengestelde soorten staat (`COMPOSITE_SLOTS`): het datumveld van dat slot wijkt af van wat de app
 * na het openen liet zien (`plannerChanged`; een andere duur van dezelfde taak telt niet), en de lezing van de bron droeg
 * de waarde volledig (`carried`). Anders blijft de bronwaarde staan of weigert de merge.
 */
function plannerReplacedDate(ctx: O1Context, r: SlotRestore): boolean {
  const type = ctx.input.index.type(r.chunk);
  if (type !== 'IFCTASKTIME' || r.outArg === 14 || !DATETIME_SLOTS[type].slots.includes(r.outArg) || !ctx.carried(r.chunk, r.outArg)) return false;
  const field = TASKTIME_SLOT_FIELDS[r.outArg]?.[0];
  const scopes = ctx.scopes.get(r.chunk);
  if (!field || !scopes || scopes.size === 0) return false;
  return [...scopes].every(scope => {
    const bar = scope.indexOf('|');
    return scope.startsWith('task:') && ctx.plannerChanged.has(`${scope.slice(0, bar)}#${field}`);
  });
}

/** Minuten per dag van de bron-taak van dit slot; gedeelde slots moeten dezelfde maat hebben. */
function taskTimeMinutesPerDay(input: LossCheckInput, chunk: number): number | undefined {
  const { index, pristine } = input;
  if (index.type(chunk) !== 'IFCTASKTIME') return undefined;
  const values = new Set<number>();
  for (let k = index.inStart(chunk); k < index.inEnd(chunk); k++) {
    const from = index.inSource(k);
    if (from < 0 || index.type(from) !== 'IFCTASK') continue;
    const owner = input.bySource.get(Number(index.id(from)));
    const task = owner?.kind === 'task' ? pristine.tasks.find(t => t.id === owner.id) : undefined;
    if (!task) return undefined;
    const cal = resolveCalendar(task.calendarId, pristine.resourceCalendars ?? [], pristine.calendar);
    values.add(taskMinutesPerDay(task, effHoursPerDay(cal)));
  }
  return values.size === 1 ? [...values][0] : undefined;
}

/**
 * Heeft het brontoken van een datum-, tijd- of duurslot dezelfde betekenis als het token van de writer in O0 (fixronde 1 van
 * #886)? De betekenis van de tekst, niet hoe de lezer haar in dit slot leest (die kan een deel weglaten): een moment of
 * klok zoals de ISO-norm het leest (`parseInstant`, vaste tijdas, met seconden en expliciete tijdzone; een klok op een vaste dag), de oude uurbreuk
 * `'7.25:00:00'` die de lezer in de enige periode van het enige patroon exact leest (`scalarHourFromClock`), een datum als
 * tekst. Een duur telt alleen binnen de bestaande vormenlijst, met de parser en kalendermaat van de lezer.
 * Een tekst zonder betekenis, of een ander slot: niet gedragen (de writer schreef iets anders).
 */
export function sameMeaning(index: StepIndex, r: SlotRestore, o0Token: string | undefined, minutesPerDay?: number): boolean {
  if (r.kind === 'duur') {
    const slot = index.type(r.chunk) === 'IFCTASKTIME' ? TASK_TIME_DURATION_SLOTS.get(r.arg) : undefined;
    if (!slot || !minutesPerDay || !Number.isFinite(minutesPerDay) || minutesPerDay <= 0) return false;
    const src = index.tokenText(r.chunk, r.token);
    const out = decodeStepText(unquote(o0Token));
    if (!durationForm(src, slot) || !durationForm(out, slot)) return false;
    // Dezelfde parser en kalendermaat als de lezer. Geen tolerantie en geen afronding; de vormenlijst bepaalt of
    // deze parser dit slot volledig leest. Een gewijzigde rest mag zo van P…D naar PT… gaan.
    const days = (text: string) => { const d = parseIfcDuration(text); return d.days + (d.timeMinutes ?? 0) / minutesPerDay; };
    return days(src) === days(out);
  }
  const at = DATETIME_SLOTS[index.type(r.chunk)];
  const src = r.token.trim(), out = o0Token?.trim() ?? '';
  if (!at || !at.slots.includes(r.arg) || !src.startsWith("'") || !out.startsWith("'")) return false;
  const oldClock = at.kind === 'tijd' && onlyPeriodOfOnlyPattern(index, r.chunk);
  const DAY = '1970-01-01T';
  const meaning = (text: string): number | string | undefined => {
    if (!existingDateTime(text, at.kind, oldClock)) return undefined;
    if (at.kind === 'datum') return text;
    const ms = at.kind === 'tijd' ? parseInstant(DAY + text).getTime() - parseInstant(`${DAY}00:00:00`).getTime() : parseInstant(text).getTime();
    if (Number.isFinite(ms)) return ms;
    return oldClock && OLD_FRACTIONAL_CLOCK.test(text) ? scalarHourFromClock(text) * 3_600_000 : undefined;
  };
  const a = meaning(index.tokenText(r.chunk, src)), b = meaning(decodeStepText(unquote(out)));
  return a !== undefined && a === b;
}

/**
 * Een pset van een taak. Bij een per-taak-pset (`PER_TASK_PSETS`) schrijft de toets de pset zelf voor de taak zoals
 * gelezen en zoals bewerkt (`write`): een property is verklaard als haar waarde daar verschilt; de pset en haar relatie
 * als de namen van haar properties verschillen. Een pset met gegevens uit `writeTask` (`TASK_PSET_OPTION_FIELDS`) ook als
 * dat veld veranderde. Een andere pset van de taak: via `TASK_PSET_FIELDS`.
 */
function explainTaskPset(ctx: O1Context, d: LossDiff, type: string, arg: number, taskId: string, pset: string, prop: string | undefined): string | undefined {
  const { changed } = ctx;
  const has = (f: string) => (f.startsWith('@') ? changed.keys.has(f.slice(1)) : changed.keys.has(`task:${taskId}#${f}`) || changed.keys.has(`task:${taskId}#*`));
  const viaField = (TASK_PSET_OPTION_FIELDS[pset] ?? []).find(has);
  if (viaField) return `task:${taskId}#${viaField} (${pset})`;
  const desc = PER_TASK_PSET_BY_NAME.get(pset);
  if (!desc) {
    const f = (TASK_PSET_FIELDS[pset] ?? []).find(has);
    return f === undefined ? undefined : `task:${taskId}#${f.replace(/^@/, '')} (${pset})`;
  }
  const t0 = ctx.tasks0.get(taskId);
  const t1 = ctx.tasks1.get(taskId);
  if (!t0 || !t1) return undefined;
  const props = (t: Task) => new Map((desc.write(t) ?? []).map(x => [x.name, x.value]));
  const a = props(t0);
  const b = props(t1);
  if (prop !== undefined) return a.get(prop) !== b.get(prop) ? `${pset}.${prop}` : undefined;
  const names = (m: ReadonlyMap<string, string>) => [...m.keys()].join('\u0000');
  const membersOrWhole = (type === 'IFCPROPERTYSET' && (arg === 4 || d.whole === 'ontbreekt'))
    || (type === 'IFCRELDEFINESBYPROPERTIES' && d.whole === 'ontbreekt');
  return membersOrWhole && names(a) !== names(b) ? `${pset} (properties)` : undefined;
}

/**
 * Een relatie van object `obj` (haar ouder: de relating, of bij een pset de eigenaar), buiten de leden (die verklaart
 * `explainMembers`): een relatie die verdween, of de naam van een `IfcRelNests` (de writer schrijft `WBS <naam>` en
 * `Ploeg <naam>` van de ouder). Een relatie verdwijnt verklaard als het veld van de ouder dat haar leden geeft, veranderde
 * (`childIds`, de toewijzingen), als elk lid verdween of wisselde (`membersGone`), of, bij de pset van een taak, als die
 * pset verdween (`explainTaskPset`).
 */
function explainRelation(ctx: O1Context, d: LossDiff, type: string, arg: number, obj: string): string | undefined {
  const { input, changed } = ctx;
  const { index } = input;
  if (changed.keys.has(`${obj}#@`)) return undefined;
  const has = (f: string) => changed.keys.has(`${obj}#${f}`) || changed.keys.has(`${obj}#*`);
  if (type === 'IFCRELNESTS' && arg === 2) return has('name') ? `${obj}#name` : undefined;
  if (d.whole !== 'ontbreekt') return undefined;
  if (type === 'IFCRELNESTS') return has('childIds') ? `${obj}#childIds` : membersGone(ctx, d.chunk, type);
  if (type === 'IFCRELASSIGNSTOPROCESS') return has('assignments') ? `${obj}#assignments` : undefined;
  if (type === 'IFCRELDEFINESBYPROPERTIES') {
    // De pset verdween: alleen als een veld veranderde dat de writer erin schrijft.
    const pset = index.refAt(d.chunk, 5);
    const name = pset >= 0 ? index.name(pset) ?? '' : '';
    if (obj.startsWith('task:')) return explainTaskPset(ctx, d, type, arg, obj.slice(5), name, undefined);
    const fields = obj.startsWith('res:') && name === PSET.Resource ? Object.values(RES_PROP_FIELDS).flat()
      : obj.startsWith('cal:') && name === PSET.Calendar ? Object.values(CAL_PROP_FIELDS).flat() : [];
    const f = fields.find(has);
    return f === undefined ? undefined : `${obj}#${f} (${name})`;
  }
  return membersGone(ctx, d.chunk, type);
}

/** Verdween of wisselde elk lid van de relatie (zie `memberMoved`)? Dan mag de relatie weg zijn. */
function membersGone(ctx: O1Context, r: number, type: string): string | undefined {
  const slot = memberRelation(type)?.related;
  if (slot === undefined) return undefined;
  const members = ctx.input.index.refsAt(r, slot).filter(c => c >= 0);
  return members.length > 0 && members.every(c => memberMoved(ctx, type, objectKey(ctx.input, c))) ? 'leden weg' : undefined;
}

/** Nieuwe baseline-ids tegenover de toestand bij openen; geen automatische wijziging van bestaande baselinerijen. */
function addedBaselineIds(ctx: O1Context): ReadonlySet<string> {
  if (!ctx.plannerChanged.has('baselines')) return new Set();
  const before = new Set(((ctx.input.opened ?? ctx.input.pristine).baselines ?? []).map(b => b.id));
  return new Set((ctx.input.domain.baselines ?? []).filter(b => !before.has(b.id)).map(b => b.id));
}

/** Is het object van een lid verdwenen/erbij gekomen, of wisselde het zijn ouder/kalender? */
function memberMoved(ctx: O1Context, type: string, key: string | undefined): boolean {
  if (key === undefined) return false;
  const has = (f: string) => ctx.changed.keys.has(`${key}#${f}`) || ctx.changed.keys.has(`${key}#*`);
  if (has('@')) return true;
  if (type === 'IFCRELNESTS') return has('parentId');
  if (type === 'IFCRELASSIGNSTOCONTROL') return has('calendarId');
  return false;
}

/**
 * De leden van een relatie in O1, per veld (fixronde 4). Weg uit beide lijsten: de leden waarvan het object verdween,
 * erbij kwam of zijn ouder of kalender wisselde (`memberMoved`). Wat overblijft, moet gelijk zijn, in dezelfde volgorde;
 * de volgorde mag alleen anders als de volgorde van die objecten in het domein veranderde (`order:…`). Bij de kinderen
 * van een taak (`IfcRelNests`) draagt de ouder de lijst (`childIds`), bij de toewijzingen van een taak
 * (`IfcRelAssignsToProcess`) de toewijzingen van de taak: veranderde dat veld, dan mag de lijst anders zijn.
 */
function explainMembers(ctx: O1Context, d: LossDiff): string | undefined {
  const { input, p, changed } = ctx;
  const { index } = input;
  const s = d.chunk;
  const type = index.type(s);
  const line = p.out.get(p.pairedOut.get(s)?.[0] ?? -1);
  if (!line || d.outArg === undefined) return undefined;
  const keyOf = (c: number) => objectKey(input, c);
  const relating = index.refAt(s, memberRelation(type)!.relating);
  const relatingKey = relating >= 0 ? keyOf(relating) : undefined;
  const relHas = (f: string) => !!relatingKey && (changed.keys.has(`${relatingKey}#${f}`) || changed.keys.has(`${relatingKey}#*`));
  if (type === 'IFCRELNESTS' && relatingKey?.startsWith('task:') && relHas('childIds')) return `leden: ${relatingKey}#childIds`;
  if (type === 'IFCRELASSIGNSTOPROCESS' && relatingKey?.startsWith('task:') && (relHas('assignments') || relHas('resourceIds'))) {
    return `leden: ${relatingKey}#assignments`;
  }
  const src = index.refsAt(s, d.arg).filter(c => c >= 0 && !memberMoved(ctx, type, keyOf(c)));
  const out: number[] = [];
  const newHeads = type === 'IFCRELAGGREGATES' && relating >= 0 && index.type(relating) === 'IFCWORKPLAN'
    && input.cls.classes[relating] === 1 && input.fixed.has(Number(index.id(relating))) ? addedBaselineIds(ctx).size : 0;
  let addedHeads = 0;
  for (const id of refList(line.args[d.outArg])) {
    const known = input.objects1?.get(id);
    if (known !== undefined && memberMoved(ctx, type, known)) continue; // een object dat erbij kwam of hierheen ging
    const c = sourceChunkOf(input, id, p);
    // Alleen de toegevoegde koppen; bestaande baselineleden blijven exact en in volgorde vergeleken.
    const head = p.out.get(id);
    if (c === undefined && known === 'baselines' && addedHeads < newHeads && head?.type === 'IFCWORKSCHEDULE'
      && head.args[workControlSlots(head.args).predefinedType]?.trim() === '.BASELINE.') { addedHeads++; continue; }
    if (c === undefined) return undefined; // een lid zonder bronstuk dat geen nieuw object is
    if (!memberMoved(ctx, type, keyOf(c))) out.push(c);
  }
  if (src.length === out.length && src.every((c, i) => c === out[i])) return 'leden';
  const sorted = (xs: readonly number[]) => [...xs].sort((x, y) => x - y).join(',');
  const kinds = new Set([...src, ...out].map(c => keyOf(c)?.split(':')[0]).filter((k): k is string => !!k));
  if (sorted(src) === sorted(out) && [...kinds].some(k => changed.keys.has(`order:${k}`))) return 'leden: de volgorde veranderde';
  return undefined;
}

/** Een veld dat de writer uit één domeinveld schrijft (buiten de objecten van `OBJECT_KINDS`), en dat veld veranderde. */
function explainField(ctx: O1Context, d: LossDiff, type: string, arg: number): string | undefined {
  const { input, changed, p } = ctx;
  const { index } = input;
  const s = d.chunk;
  const field = (f: string) => changed.keys.has(`project.${f}`);
  const name = index.name(s) ?? '';
  // OPS_ProjectSettings: een property en het projectveld dat erin staat; de leden van de pset (een veld erbij of eraf).
  if (type === 'IFCPROPERTYSINGLEVALUE' && psetNameOf(index, s) === PSET.ProjectSettings) {
    const f = PROJECT_SETTINGS_FIELDS[name]?.find(field);
    return f ? `projectveld ${f} (${name})` : undefined;
  }
  if (type === 'IFCPROPERTYSET' && name === PSET.ProjectSettings && arg === 4) return explainSettingsMembers(ctx, d);
  if (d.whole) return undefined;
  // De velden en codes van het project: het JSON in `OPS_StructureMeta`, en de waarden van een code (`IfcPropertyEnumeration`
  // met de naam van die code).
  if (type === 'IFCPROPERTYSINGLEVALUE' && arg === 2 && psetNameOf(index, s) === PSET.StructureMeta
    && (changed.keys.has('activityCodeTypes') || changed.keys.has('customFieldDefs'))) return 'velden en codes';
  if (type === 'IFCPROPERTYENUMERATION' && arg === 1 && changedCodeNames(input).has(index.tokenText(s, index.argTokens(s)?.[0]))) {
    return 'de waarden van een code';
  }
  const live = input.fixed.has(Number(index.id(s))) && !isBaselineHead(index, s);
  if ((type === 'IFCPROJECT' || (type === 'IFCWORKPLAN' && live)) && arg === 2 && field('name')) return 'projectnaam';
  if ((type === 'IFCPROJECT' || (type === 'IFCWORKPLAN' && live)) && arg === 3 && field('description')) return 'projectomschrijving';
  // StartTime en FinishTime van het eigen werkplan en live-schema: de vroegste start en het laatste einde van de taken
  // (zonder taken: het project).
  if ((type === 'IFCWORKPLAN' || type === 'IFCWORKSCHEDULE') && live && (arg === 11 || arg === 12)
    && ([...changed.keys].some(k => /^task:.*#(time|@|\*)$/.test(k)) || field(arg === 11 ? 'startDate' : 'endDate'))) return 'planperiode';
  const o = p.pairedOut.get(s)?.[0];
  if (type === 'IFCPERSON' && o === ctx.ownPerson && arg === 1 && field('author')) return 'auteur';
  if (type === 'IFCORGANIZATION' && o === ctx.ownOrg && arg === 1 && field('company')) return 'bedrijf';
  return undefined;
}

/** De namen (oud en nieuw) van de codes (`activityCodeTypes`) die veranderden. */
function changedCodeNames(input: LossCheckInput): Set<string> {
  const names = new Set<string>();
  const before = new Map((input.pristine.activityCodeTypes ?? []).map(t => [t.id, t]));
  const after = new Map((input.domain.activityCodeTypes ?? []).map(t => [t.id, t]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id);
    const b = after.get(id);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (a) names.add(a.name);
    if (b) names.add(b.name);
  }
  return names;
}

/** De leden van `OPS_ProjectSettings` in O1: gelijk aan die van de bron, op de properties na van een projectveld dat
 *  veranderde (erbij of eraf). */
function explainSettingsMembers(ctx: O1Context, d: LossDiff): string | undefined {
  const { input, p, changed } = ctx;
  const { index } = input;
  const line = p.out.get(p.pairedOut.get(d.chunk)?.[0] ?? -1);
  if (!line) return undefined;
  const fieldChanged = (prop: string) => (PROJECT_SETTINGS_FIELDS[prop] ?? []).some(f => changed.keys.has(`project.${f}`));
  const all = index.refsAt(d.chunk, 4).filter(c => c >= 0);
  const names = new Set(all.map(c => index.name(c) ?? ''));
  const src = all.filter(c => !fieldChanged(index.name(c) ?? ''));
  const out: number[] = [];
  for (const id of refList(line.args[4])) {
    const c = sourceChunkOf(input, id, p);
    if (c === undefined) {
      // Een property erbij: van een veld dat veranderde, of een toevoeging zoals in O0 (`sameMembers`: een nieuwe naam in
      // een pset met eigen herkomst).
      const added = unquote(p.out.get(id)?.args[0]);
      if (fieldChanged(added) || (hasOwnOrigin(index, d.chunk) && !names.has(added))) continue;
      return undefined;
    }
    if (!fieldChanged(index.name(c) ?? '')) out.push(c);
  }
  return src.length === out.length && src.every((c, i) => c === out[i]) ? 'projectvelden' : undefined;
}

/** De domeinobjecten (`task:<id>`, …) waar pset `s` bij hoort, via haar `IfcRelDefinesByProperties`; een eigenaar zonder
 *  object telt als `project`. */
function psetOwners(input: LossCheckInput, s: number): string[] {
  const { index } = input;
  const keys: string[] = [];
  for (let k = index.inStart(s); k < index.inEnd(s); k++) {
    const from = index.inSource(k);
    if (from < 0 || index.type(from) !== 'IFCRELDEFINESBYPROPERTIES' || index.inArg(k) !== 5) continue;
    for (const owner of index.refsAt(from, 4)) if (owner >= 0) keys.push(objectKey(input, owner) ?? 'project');
  }
  return keys;
}

/** De naam van de pset die property `s` als lid heeft (de eerste), of ''. */
function psetNameOf(index: StepIndex, s: number): string {
  for (let k = index.inStart(s); k < index.inEnd(s); k++) {
    const from = index.inSource(k);
    if (from >= 0 && index.type(from) === 'IFCPROPERTYSET' && index.inArg(k) === 4) return index.name(from) ?? '';
  }
  return '';
}

/** Is dit stuk de kop van een baseline (`IfcWorkSchedule` met `.BASELINE.`)? Die draagt haar eigen CreationDate. */
function isBaselineHead(index: StepIndex, s: number): boolean {
  if (index.type(s) !== 'IFCWORKSCHEDULE') return false;
  const a = index.argTokens(s) ?? [];
  return a[workControlSlots(a).predefinedType]?.trim() === '.BASELINE.';
}

/**
 * Een decimaal getal als exacte waarde (fixronde 4, BLOKKEERT 4): het teken, de cijfers zonder voorloop- en sluitnullen,
 * en de exponent (`8`, `8.`, `8.0` en `8.E0` → `8e0`; `8.0000000000000001` → `80000000000000001e-16`). Geen JavaScript-
 * `Number`: dat rondt af op 53 bits. Nul is `0`, met het teken erbij (`-0.` is niet gelijk aan `0.`). `undefined` als het
 * geen decimaal getal is. `comma`: ook een decimaalkomma (een onderdeel van een ISO 8601-duur).
 */
export function decimalKey(s: string, comma = false): string | undefined {
  const m = (comma ? /^([+-]?)(\d+)(?:[.,](\d*))?$/ : /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/).exec(s.trim());
  if (!m) return undefined;
  const sign = m[1] === '-' ? '-' : '';
  let digits = `${m[2]}${m[3] ?? ''}`.replace(/^0+/, '');
  if (digits === '') return `${sign}0`;
  let exp = BigInt(m[4] ?? 0) - BigInt((m[3] ?? '').length);
  const trimmed = digits.replace(/0+$/, '');
  exp += BigInt(digits.length - trimmed.length);
  digits = trimmed;
  return `${sign}${digits}e${exp}`;
}

/** Normalisatie `getal`: twee STEP-getallen met precies dezelfde waarde (`8`, `8.`, `8.0`, `8.E0`; `decimalKey`). Het
 *  type van het attribuut of van de getypeerde waarde (`IFCREAL(…)`) bepaalt wat een lezer ervan maakt; de waarde is
 *  gelijk. */
export function sameNumber(a: string, b: string): boolean {
  const x = decimalKey(a);
  return x !== undefined && x === decimalKey(b);
}

/** Normalisatie `duur`: twee ISO 8601-duren met dezelfde onderdelen, elk exact (`decimalKey`); een ontbrekend onderdeel
 *  telt als 0. */
export function sameDuration(a: string, b: string): boolean {
  const parts = (x: string) => {
    const m = /^(-?)P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/.exec(x);
    if (!m || x === 'P' || x.endsWith('T') || x === '-P') return undefined;
    return [m[1], ...m.slice(2).map(v => decimalKey(v ?? '0', true))];
  };
  const x = parts(a);
  const y = parts(b);
  return !!x && !!y && x.every((v, i) => v === y[i]);
}

/** Een duur zoals de lezer haar ziet, met het slot waarin ze staat (`durationTexts`, `durationForms.ts`). */
export interface DurationText {
  /** De duur na de STEP-decodering; een token dat geen tekst is (een getypeerde waarde, een enum), letterlijk. */
  readonly text: string;
  readonly slot: DurationSlot;
  /** Het argument van een `IfcTaskTime` (4 duur, 11 vrije speling, 12 totale speling, 15 werkelijk, 18 rest). */
  readonly arg?: number;
}

/** De duurslots van een `IfcTaskTime` (argumentindex → slot in `durationForms.ts`). */
const TASK_TIME_DURATION_SLOTS: ReadonlyMap<number, DurationSlot> = new Map([
  [4, 'duur'], [11, 'speling'], [12, 'speling'], [15, 'werkelijk'], [18, 'rest'],
]);

/**
 * De duren van stuk `i` die de lezer leest, elk met haar slot (fixronde 6): de vijf duurslots van een `IfcTaskTime`, en
 * de waarde van een `IfcLagTime` in het slot dat de lezer kiest (`lagValueSlot`, dezelfde functie als de lezer; een
 * procent telt niet). De tekst is de tekst zoals de lezer haar ziet: met de STEP-decodering van dat stuk (`tokenText`,
 * dezelfde regel als de lezer, ook voor de oude letterlijke codering; fixronde 5, BLOKKEERT 1). Zo is
 * `'P2\X2\0044\X0\T12H'` de duur `P2DT12H`. Een slot met `$` slaat hij over; een token dat geen tekst is, komt
 * letterlijk mee, zodat de lijst hem weigert (de lezer leest ook dat, maar niet als de waarde die er staat).
 * Een `IFCDURATION` elders (in een pset van een ander programma) leest de lezer niet; die hoort niet in deze toets.
 */
export function durationTexts(index: StepIndex, i: number): DurationText[] {
  const type = index.type(i);
  const tokens = (index.argTokens(i) ?? []).map(t => t.trim());
  const text = (token: string) => (token.startsWith("'") ? index.tokenText(i, token) : token);
  const out: DurationText[] = [];
  if (type === 'IFCTASKTIME') {
    for (const [k, slot] of TASK_TIME_DURATION_SLOTS) {
      const token = tokens[k];
      if (token !== undefined && token !== '' && token !== '$') out.push({ text: text(token), slot, arg: k });
    }
  } else if (type === 'IFCLAGTIME') {
    const value = lagValueSlot(tokens);
    if (value.kind === 'oud') {
      out.push({ text: text(value.text.trim()), slot: 'lag-oud' });
    } else if (value.kind !== 'ratio') {
      out.push({ text: text(value.text.trim()), slot: /ELAPSEDTIME/i.test(tokens[4] ?? '') ? 'lag-kalendertijd' : 'lag-werktijd' });
    }
  }
  return out;
}

/** Wat in een datumslot staat: een datum-tijd (`IfcDateTime`), een tijd (`IfcTime`) of een datum (`IfcDate`). */
export type DateTimeKind = 'datum-tijd' | 'tijd' | 'datum';

/**
 * De slots met een datum-tijd, tijd of datum die de lezer leest (fixronde 5, zoektocht punt 4; fixronde 6, zoektocht 2):
 * de taaktijd, de tijdblokken, en het begin en einde van een feestdag of uitzondering (`IfcWorkTime`, argument 5 en 6).
 * Die laatste leest de lezer met `parseDateFromIFC`: de eerste tien tekens, zonder toets. Het begin en einde van werkplan
 * en werkschema leest hij ook zo, als datum van het project; daar schrijft OPS zelf een tijd achter
 * (`2027-03-01T07:00:00`) die de lezer bewust niet leest. Die staan dus niet in deze toets (zoektocht 3 in de PR-tekst).
 */
const DATETIME_SLOTS: Readonly<Record<string, { readonly slots: readonly number[]; readonly kind: DateTimeKind }>> = {
  IFCTASKTIME: { slots: [5, 6, 7, 8, 9, 10, 14, 16, 17], kind: 'datum-tijd' },
  IFCTIMEPERIOD: { slots: [0, 1], kind: 'tijd' },
  IFCWORKTIME: { slots: [4, 5], kind: 'datum' },
};

/** Waarom de lezer een datum-tijd, tijd of datum anders leest dan haar tekst zegt: een tijdzone (`zone`, de lezer laat
 *  haar weg, `parseImportedInstant` en `clockToMinutes`), of een andere vorm (`vorm`: seconden die niet 0 zijn, die de
 *  lezer weglaat; een spatie in plaats van `T`, waarna hij de tijd niet leest; een uur van één cijfer; bij een datum alles
 *  behalve `JJJJ-MM-DD`, want de lezer neemt de eerste tien tekens). */
export type PartialDateTime = 'zone' | 'vorm';

/** Een klok als uurbreuk, zoals OPS tot `32b6222de` (v2026.9.0 en ouder) het begin of einde van de werkdag schreef:
 *  `${String(cal.workStartHour).padStart(2, '0')}:00:00`, dus `7.5:00:00` voor half acht. */
export const OLD_FRACTIONAL_CLOCK = /^\d+\.\d+:00:00$/;

/** Kalendergeldigheid vóór de vormcontrole én de betekenisvergelijking. JavaScript mag een onmogelijke datum
 *  niet doorschuiven en zo alsnog gedragen laten heten. De bestaande ISO-toets bewaakt ook de klok en offset;
 *  Alleen in een tijdslot is precies 24:00 een bestaande daggrens; een datum-tijd met T24:00 weigert.
 *  De oude uurbreuk blijft alleen geldig
 *  op de plek waar de lezer haar exact draagt, binnen dezelfde klokdag. */
function existingDateTime(text: string, kind: DateTimeKind, oldClock: boolean): boolean {
  if (kind === 'tijd' && /^24:00(?::00(?:\.0+)?)?$/.test(text)) return true;
  if (oldClock && kind === 'tijd' && OLD_FRACTIONAL_CLOCK.test(text)) {
    const hour = scalarHourFromClock(text);
    return Number.isFinite(hour) && hour >= 0 && hour < 24;
  }
  return (kind !== 'datum' || text.length === 10)
    && isStrictIsoDateTime(kind === 'tijd' ? `1970-01-01T${text}` : text,
      { maxFractionDigits: text.length, offsetColonOptional: true });
}

/** Leest de lezer deze waarde anders dan haar tekst zegt? Een lijst van vormen die mogen; zie `PartialDateTime`.
 *  `oldClock`: de tijd staat waar de lezer een oude klok als uurbreuk exact leest (`dateTimeTexts`); daar mag ook die vorm
 *  (`OLD_FRACTIONAL_CLOCK`, fixronde 7 van #867). */
export function partialDateTime(text: string, kind: DateTimeKind, oldClock = false): PartialDateTime | undefined {
  const t = text.trim();
  if (!existingDateTime(t, kind, oldClock)) return 'vorm';
  const clock = '\\d\\d:\\d\\d(?::00(?:\\.0+)?)?';
  const date = '\\d{4}-\\d\\d-\\d\\d';
  const allowed = kind === 'tijd' ? `^${clock}$` : kind === 'datum' ? `^${date}$` : `^${date}(?:T${clock})?$`;
  if (new RegExp(allowed).test(t)) return undefined;
  if (oldClock && kind === 'tijd' && OLD_FRACTIONAL_CLOCK.test(t)) return undefined;
  if (kind === 'datum') return 'vorm';
  return /\d:\d\d(?::\d\d(?:\.\d+)?)?(?:[Zz]|[+-]\d\d(?::?\d\d)?)$/.test(t) ? 'zone' : 'vorm';
}

/** De datum-tijden, tijden en datums van een stuk zoals de lezer ze ziet: na dezelfde tekstdecodering (`tokenText`).
 *  `oldClock`: een tijd in de enige periode van het enige patroon van een werkweek (`onlyPeriodOfOnlyPattern`). */
export function dateTimeTexts(index: StepIndex, i: number): { readonly text: string; readonly kind: DateTimeKind; readonly oldClock: boolean }[] {
  const at = DATETIME_SLOTS[index.type(i)];
  if (!at) return [];
  const oldClock = at.kind === 'tijd' && onlyPeriodOfOnlyPattern(index, i);
  const out: { text: string; kind: DateTimeKind; oldClock: boolean }[] = [];
  (index.argTokens(i) ?? []).forEach((token, k) => {
    const t = token.trim();
    if (at.slots.includes(k) && t.startsWith("'")) out.push({ text: index.tokenText(i, t), kind: at.kind, oldClock });
  });
  return out;
}

/** De stukken van de bron die naar `t` wijzen, elk één keer. */
function parentsOf(index: StepIndex, t: number): number[] {
  const out: number[] = [];
  for (let k = index.inStart(t); k < index.inEnd(t); k++) {
    const from = index.inSource(k);
    if (from >= 0 && !out.includes(from)) out.push(from);
  }
  return out;
}

/**
 * Is dit `IfcTimePeriod` de enige periode van het enige patroon in de werkweek van elke kalender die het gebruikt? Alleen
 * daar leest de lezer begin en einde met `scalarHourFromClock` (de weg met één periode in `ifcReader.ts`, "ook voor oude
 * klokken als '7.5:00:00'"), dus een uurbreuk exact. In een tweede periode of een tweede patroon leest hij de klok met
 * `clockToMinutes`, en die kent geen uurbreuk. Op die andere wegen schreef OPS hem ook nooit (fixronde 7 van #867).
 */
function onlyPeriodOfOnlyPattern(index: StepIndex, tp: number): boolean {
  const patterns = parentsOf(index, tp);
  if (patterns.length !== 1 || index.type(patterns[0]) !== 'IFCRECURRENCEPATTERN') return false;
  const pattern = patterns[0];
  const periods = index.refsAt(pattern, 7);
  if (periods.length !== 1 || periods[0] !== tp) return false;
  const workTimes = parentsOf(index, pattern);
  if (workTimes.length === 0 || !workTimes.every(w => index.type(w) === 'IFCWORKTIME')) return false;
  return workTimes.every(wt => {
    const calendars = parentsOf(index, wt);
    return calendars.length > 0 && calendars.every(cal => {
      if (index.type(cal) !== 'IFCWORKCALENDAR') return false;
      const working = index.refsAt(cal, workCalendarSlots(index.argTokens(cal) ?? []).workingTimes);
      if (!working.includes(wt)) return false;
      const withPattern = working.filter(w => w >= 0 && index.type(w) === 'IFCWORKTIME' && index.refsAt(w, 3).some(r => r >= 0));
      return withPattern.length === 1;
    });
  });
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
/**
 * Heeft deze `OPS_Assignments` van de bron een kale sleutel (`GUID` zonder `#N`)? Dat is de vorm van OPS op main tussen
 * `e1ac01947` en `87ebd4d46` (3 juli 2026). De lezer leest een kale sleutel als de toewijzing van die resource; een
 * resource staat er hoogstens één keer in (de lezer neemt per naam de laatste). De writer schrijft nu `GUID#N`, met N de
 * plek in de lijst van de taak. Zo'n pset paart daarom ook in O0 op de resource (fixronde 7 van #867).
 */
function hasBareAssignmentKey(index: StepIndex, pset: number): boolean {
  return index.refsAt(pset, 4).some(p => p >= 0 && !/#\d+$/.test(index.name(p) ?? ''));
}

/**
 * Een kale sleutel in `OPS_Assignments` die in O1 alleen de vorm van de writer kreeg (fixronde 7 van #867): de bron heeft
 * `GUID`, O1 `GUID#N`, en die resource staat zowel in de bron als in O1 één keer in de pset. De lezer leest beide als
 * dezelfde toewijzing. Schoof de lijst na een bewerking (`unstableLists`), dan hoeft de naam niet terug: zo weigert het
 * wissen van een toewijzing in een bestand met kale sleutels niet om de naam van een andere toewijzing.
 */
function bareKeyInWriterForm(input: LossCheckInput, p1: Pairing, r: SlotRestore, now: string): boolean {
  const { index } = input;
  if (r.arg !== 0 || index.type(r.chunk) !== 'IFCPROPERTYSINGLEVALUE') return false;
  const source = index.name(r.chunk) ?? '';
  if (/#\d+$/.test(source) || assignmentKey(decodeStepText(unquote(now))) !== source) return false;
  const pset = onlyParent(index, r.chunk);
  if (pset < 0 || index.type(pset) !== 'IFCPROPERTYSET' || index.name(pset) !== PSET.Assignments) return false;
  if (index.refsAt(pset, 4).filter(m => m >= 0 && assignmentKey(index.name(m) ?? '') === source).length !== 1) return false;
  const o1 = p1.pairedOut.get(r.chunk)?.[0];
  const holder = o1 === undefined ? undefined
    : [...p1.out.values()].find(l => l.type === 'IFCPROPERTYSET' && refList(l.args[4]).includes(o1));
  if (!holder) return false;
  const keys = refList(holder.args[4]).map(id => p1.out.get(id)).filter(l => l?.type === 'IFCPROPERTYSINGLEVALUE')
    .map(l => assignmentKey(decodeStepText(unquote(l!.args[0]))));
  return keys.filter(k => k === source).length === 1;
}

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
