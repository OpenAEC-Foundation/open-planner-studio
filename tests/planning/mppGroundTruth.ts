// Onafhankelijke her-implementatie van de TBkndTask-scan (fase 3.8, etappe "MSP-pariteit", T1).
//
// T16-VEEGLIJST (herkomstvermelding aangevuld): net als `mppReader.ts`/`mppCalendars.ts`/
// `limits.ts` is de veldkennis in dit bestand (TaskField-id's, `Fixed2Meta`-bit-flags,
// `MPP14Reader.java`-leesvolgorde) afgeleid van de MPXJ-broncode
// (https://github.com/joniles/mpxj, © Jon Iles e.a., LGPL-2.1) — geport naar TypeScript voor
// Open Planner Studio (LGPL-3.0). Test-only (`tests/planning/`), maar wél een EIGEN, tweede poort
// van die veldkennis (zie "BEWUST EEN TWEEDE LUS" hieronder), dus draagt zijn eigen vermelding
// i.p.v. stilzwijgend op de src/-vermelding te leunen.
//
// BEWUST EEN TWEEDE LUS, GEEN HERGEBRUIK VAN `readTasks`. Dit bestand bestaat om `mppFidelity.ts`
// een grondwaarheid te geven die NIET via dezelfde code loopt als de lezer die getoetst wordt
// (`src/services/mpp/mppReader.ts`'s `readTasks`) — een bug in `readTasks` (bv. een verkeerd
// veld-offset, een verkeerde byte-volgorde) zou anders onopgemerkt blijven, want de "grondwaarheid"
// zou dezelfde fout maken. Deze module leest daarom ZELF, met een eigen lus, MS Projects eigen
// opgeslagen `SCHEDULED_START`/`SCHEDULED_FINISH` (TaskField 35/36) rechtstreeks uit `TBkndTask`'s
// `FixedMeta`/`FixedData`.
//
// EERLIJKE REIKWIJDTE VAN "ONAFHANKELIJK" (reviewbevinding L8): dit bestand deelt WEL
// `openMppProject` (dus ook `assertReadable`/CFB-parse/`detectApplicationVersion`/de Props-
// preambule) met `mppReader.ts` — die containerlaag ís de lezer, er bestaat geen tweede manier om
// een CFB-bestand te openen zonder 'm te herschrijven, en een bug dáár zou toch al als een
// leesfout naar voren komen (niet als een stille datumafwijking). Wat WEL onafhankelijk blijft —
// en waar de garantie van deze module om draait — is de TAAK-SCAN zelf: de `FixedMeta`/
// `FixedData`/`VarMeta`/`Var2Data`-lus over `TBkndTask` en de waardedecodering. Deelt UITSLUITEND
// de laagste-niveau-primitieven (`mppPrimitives.ts`) en de veldkaart-opzoeker (`fieldMap14.ts`'s
// `fixedOffsetOf`/`varDataKeyOf`) — geen enkele aanroep naar `readTasks` zelf. LET OP (eindreview
// F7): die gedeelde veldkaart is daarmee common-mode voor meetlat én lezer — een fout offset zou
// beide identiek raken en is voor deze scheiding onzichtbaar; dat gat wordt afgedekt door de
// synthetische Z1-fixtures en de MPXJ-referentie-offsets, niet door deze module.
//
// TASK_MODE-BEWUST SINDS Z1 (etappe "nul afwijkingen", 2026-08-17 — vervangt de vorige
// "BEKENDE BEPERKING (L5)"-alinea, die de discrepantie hieronder alleen als HYPOTHESE
// documenteerde). `SCHEDULED_START`/`SCHEDULED_FINISH` (veld 35/36) zijn de door MS Project
// herberekende datums voor AUTO_SCHEDULED-taken. Een HANDMATIG geplande taak (MPXJ
// `TaskMode.MANUALLY_SCHEDULED`) ankert bij MSP op een ANDER veld-paar: `TaskField.START`/
// `FINISH` (veld-id 1283/1284, `Fixed2Data` BLOK 1 van `TBkndTask`, `FieldMap14.java`: offset 50
// resp. 54). Welk paar een taak daadwerkelijk gebruikt, wordt nu ZELF gelezen — de TASK_MODE-bit
// in `Fixed2Meta` (`MPP14Reader.java`: `PROJECT2010_TASK_META_DATA2_BIT_FLAGS`, offset 8 masker
// `0x08`; `PROJECT2013_`/`PROJECT2016_TASK_META_DATA2_BIT_FLAGS`, offset 8 masker `0x80` — zelfde
// `≤14`/`>14`-`applicationVersion`-grens als `mppReader.ts`'s `milestoneBitFlag`, hier BEWUST
// ONAFHANKELIJK herschreven i.p.v. geïmporteerd, zie `taskModeBitFlag` hieronder) — en de
// overschrijfregel wordt exact gespiegeld: `MPP14Reader.java` schrijft `SCHEDULED_START` alléén
// naar `task.getStart()` als die nog leeg is, óf de taak AUTO_SCHEDULED is (regel ~1162–1176); zie
// `resolveScheduleField` hieronder.
//
// CORPUSMETING (Z1-probe, 2026-08-17, wegwerpscript — cijfers, geen code gecommit): over de 216
// leesbare bestanden (3 corpus + 213 crawl) dragen 70 bestanden (1 corpus + 69 crawl) samen 1659
// taken met de TASK_MODE-bit aan. Van die 1659 manual-taken verschilt bij 261 taken `START`/
// `FINISH` daadwerkelijk van `SCHEDULED_START`/`SCHEDULED_FINISH` — verspreid over 15 bestanden
// (1 corpus + 14 crawl). Van de 20 destijds afwijkende bestanden bevat er 1 zo'n taak (het reeds
// bekende gemengde leveling-/manual-bestand); van de 196 destijds 100%-exacte bestanden bevatten
// er 14 minstens één taak waar deze meetlatwissel het gemeten resultaat daadwerkelijk verschuift
// — ruim onder de "STOP-boven-15"-drempel uit het plandocument (§4, taak Z1). Alle drie
// `applicationVersion`-groepen (14/15/16 — dus zowel de `≤14`- als de `>14`-tak van de
// versiegrens) komen in het corpus voor, en alle 216 bestanden dragen zowel de `Fixed2Meta`/
// `Fixed2Data`-streams als een data-gedreven block-1-veldkaart met `START`/`FINISH` exact op
// offset 50/54 — de bit-decodering is dus NIET ambigu gebleken. Die 14 tijdelijk-nieuw-afwijkende
// bestanden krijgen een `reason`-pin in `mpp-fidelity-baseline.json` (toegestaan volgens plan §3a
// — "het enige moment in de etappe" — en verdwijnt weer bij Z9a, dat de manual-planningsmodus in
// de motor implementeert).
//
// Overgenomen (nagenoeg letterlijk) uit het scratchpad-audit-harnas (`measure.ts`'s `rawScan()`,
// gepind op snapshot 97368f7d — zie het plandocument §5 "Het gedeelde meetscript"). Het filter voor
// verwijderde/spooktaken spiegelt bewust `mppReader.ts`'s `collectValidTaskIndices` (zelfde
// `DELETED_TASK_FLAG`/null-blok-check) — niet omdat dit bestand die functie hergebruikt (dat zou de
// onafhankelijkheid weer opheffen), maar omdat de RUWE TBkndTask-laag dezelfde structurele
// eigenaardigheden kent ongeacht wie hem leest.
import { openMppProject } from '@/services/mpp/mppReader';
import {
  createTaskFieldMap, TaskFieldId, fixedOffsetOf, varDataKeyOf, type FieldMapTable,
} from '@/services/mpp/fieldMap14';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12, getInt, getShort, getTimestamp, getDurationTimeUnits,
} from '@/services/mpp/mppPrimitives';
import type { Props } from '@/services/mpp/mppContainer';
import { MAX_VAR_TEXT_BYTES } from '@/services/mpp/limits';

const TASK_FIXED_META_ITEM_SIZE = 47;
const NULL_TASK_BLOCK_SIZE = 16;
const DELETED_TASK_FLAG = 0x02;
const FIRST_TASK_INDEX = 3;

// ── TASK_MODE (Z1) — Fixed2Meta-bit-vlag, EIGEN kopie van mppReader.ts's `milestoneBitFlag`- ────
// versiegrens-logica (BEWUST GEDUPLICEERD, geen import: zie de moduleheader "BEWUST EEN TWEEDE
// LUS" — deze module importeert buiten `openMppProject` en de laagste-niveau-primitieven
// (`mppPrimitives.ts`, `fieldMap14.ts`'s block-0-opzoeker) niets uit de productie-lezer, en al
// helemaal niets van Z2's toekomstige Fixed2-lezer in `mppReader.ts` zelf).
//
// `MPP14Reader.java`: `PROJECT2010_TASK_META_DATA2_BIT_FLAGS` (`applicationVersion` ≤ 2010,
// TASK_MODE op offset 8 masker `0x08`) vs. `PROJECT2013_`/`PROJECT2016_TASK_META_DATA2_BIT_FLAGS`
// (offset 8 masker `0x80` — beide identiek, alleen andere, voor ons irrelevante velden
// verschillen). Zelfde `≤14`/`>14`-grens als `milestoneBitFlag`; ONBEKENDE versie ⇒ 2010-tabel
// (MPXJ: `NumberHelper.getInt(null) === 0`, en `0 ≤ PROJECT_2010 (14)`).
function taskModeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  const version = applicationVersion ?? 0;
  return version <= 14
    ? { offset: 8, mask: 0x08 } // PROJECT2010_TASK_META_DATA2_BIT_FLAGS
    : { offset: 8, mask: 0x80 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA2_BIT_FLAGS
}

/** `FieldMap14.java`: `TaskField.START` (veld-id 1283) op `Fixed2Data` blok 1, offset 50;
 *  `TaskField.FINISH` (1284) offset 54 — de LETTERLIJKE `getDefaultTaskData()`-default, gebruikt
 *  als terugval wanneer geen data-gedreven veldkaart te vinden is (zelfde rol als
 *  `DEFAULT_TASK_FIELDS` in `fieldMap14.ts` voor blok-0-velden). Corpusbreed gemeten (Z1-probe):
 *  alle 216 leesbare bestanden dragen een data-gedreven kaart met START/FINISH exact hier, dus
 *  deze terugval raakt het corpus niet — maar blijft de correcte "geen giswerk"-vorm. */
const TASK_MODE_BLOCK1_START_OFFSET_FALLBACK = 50;
const TASK_MODE_BLOCK1_FINISH_OFFSET_FALLBACK = 54;
const TASK_MODE_FIELD_START = 1283;
const TASK_MODE_FIELD_FINISH = 1284;
const PROPS_KEY_TASK_FIELD_MAP = 131092; // PropsKey.java — zelfde waarde als fieldMap14.ts, hier
const PROPS_KEY_TASK_FIELD_MAP2 = 50331668; // gedupliceerd (niet geëxporteerd door dat bestand).
const FIELD_MAP_ENTRY_SIZE = 28;
const NO_FIXED_OFFSET = 65535;
/** `fieldMap14.ts`'s `META_DATA_CATEGORIES` (FieldMap.java: category 0x0B/0x64 zijn boolean-
 *  vlaggen in een apart meta-blok, geen FIXED_DATA/VAR_DATA-locatie) — hier gedupliceerd i.p.v.
 *  geïmporteerd (dezelfde onafhankelijkheidsreden als de rest van dit bestand), zodat
 *  `block1TaskStartFinishOffsets` hieronder de entries in dezelfde VOLGORDE overslaat als
 *  `parseFieldMapBytes` (vóór de `dataBlockOffset`-boekhouding — een META_DATA-entry telt anders
 *  onterecht mee in de blokindex-telling). Reviewbevinding (fixronde 1): eerder ontbrak dit
 *  filter hier; corpusbreed gemeten op alle 216 leesbare bestanden gaf dat 0 divergentie t.o.v.
 *  het gefilterde resultaat (START/FINISH lagen nooit in een META_DATA-categorie), maar het
 *  docblok claimde ten onrechte een spiegeling die er niet was — nu wél echt. */
const META_DATA_CATEGORIES = new Set([0x0b, 0x64]);

/** Eigen, MINIMALE data-gedreven veldkaart-parser voor BLOK 1 (Fixed2Data) — bewust gedupliceerd
 *  t.o.v. `fieldMap14.ts`'s `parseFieldMapBytes`, die blok ≥1 bewust weggooit (block-1-lezen is
 *  Z2/baan-L-werk in `mppReader.ts`/`fieldMap14.ts`, niet dit bestand — zie de moduleheader
 *  aldaar). Retourneert de offsets voor START(1283)/FINISH(1284) binnen blok 1, alles-of-niets:
 *  UITSLUITEND als BEIDE gevonden worden in een aanwezige `TASK_FIELD_MAP`/`TASK_FIELD_MAP2`
 *  (zelfde I3-discipline als de rest van dit project); anders de letterlijke
 *  `FieldMap14.java`-default (offset 50/54). */
function block1TaskStartFinishOffsets(props: Props): { start: number; finish: number } {
  const bytes = props.getByteArray(PROPS_KEY_TASK_FIELD_MAP) ?? props.getByteArray(PROPS_KEY_TASK_FIELD_MAP2);
  if (bytes) {
    let lastDataBlockOffset = 0;
    let dataBlockIndex = 0;
    let start: number | null = null;
    let finish: number | null = null;
    for (let pos = 0; pos + FIELD_MAP_ENTRY_SIZE <= bytes.length; pos += FIELD_MAP_ENTRY_SIZE) {
      const dataBlockOffset = getShort(bytes, pos + 4, 'groundTruth fieldMap dataBlockOffset');
      const typeValue = getInt(bytes, pos + 12, 'groundTruth fieldMap typeValue');
      const category = getShort(bytes, pos + 20, 'groundTruth fieldMap category');
      const index = typeValue & 0xffff;
      if (META_DATA_CATEGORIES.has(category)) continue;
      if (dataBlockOffset === NO_FIXED_OFFSET) continue;
      if (dataBlockOffset < lastDataBlockOffset) dataBlockIndex++;
      lastDataBlockOffset = dataBlockOffset;
      if (dataBlockIndex !== 1) continue;
      if (index === TASK_MODE_FIELD_START) start = dataBlockOffset;
      else if (index === TASK_MODE_FIELD_FINISH) finish = dataBlockOffset;
    }
    if (start !== null && finish !== null) return { start, finish };
  }
  return { start: TASK_MODE_BLOCK1_START_OFFSET_FALLBACK, finish: TASK_MODE_BLOCK1_FINISH_OFFSET_FALLBACK };
}

/** `MPP14Reader.java`'s overschrijfregel (r. ~1162–1176): `SCHEDULED_START`/`FINISH` gaat alléén
 *  naar het opgeslagen `START`/`FINISH`-veld als dat leeg is, óf de taak AUTO_SCHEDULED is. Een
 *  MANUAL taak MET een rauw `START`/`FINISH` houdt dat dus ONGESNAPT aan; AUTO (of een taak zónder
 *  rauwe waarde, ongeacht modus) valt terug op `SCHEDULED_START`/`FINISH`. Deze functie ís de
 *  "welk paar gebruikt MSP zelf"-beslissing — precies wat Z1 aan de grondwaarheid toevoegt. */
function resolveScheduleField(raw: Date | null, scheduled: Date | null, isManual: boolean): Date | null {
  const overrideWithScheduled = raw === null || (scheduled !== null && !isManual);
  return overrideWithScheduled ? scheduled : raw;
}

/** `MPP14Reader.java` r. 995: `taskFixed2Meta`-itemgrootte-KANDIDATEN
 *  (`new FixedMeta(..., taskFixedData, 92, 93, 94, 95, 96)` — de heuristische variant,
 *  `FixedMeta.withHeuristicItemSize`). Andere kandidaten dan het resource-precedent in
 *  `mppEntities.ts` (50/51) — taken en resources delen dit blokformaat niet. */
const TASK_FIXED2_META_ITEM_SIZE_CANDIDATES = [92, 93, 94, 95, 96];

// ── Late datums en speling (meetopdracht 2026-09-11, "late/float-meting") ────────────────────
// Veld-id's + blok-0-offsets letterlijk uit `FieldMap14.java`'s `getDefaultTaskData()` (MPXJ
// 16.7.0, commit ac7aa7b8):
//   r. 67  `new FieldItem(TaskField.LATE_START,   FIXED_DATA, 0,  12,  39, 0, 0)`
//   r. 95  `new FieldItem(TaskField.LATE_FINISH,  FIXED_DATA, 0, 110,  40, 0, 0)`
//   r. 70  `new FieldItem(TaskField.FREE_SLACK,   FIXED_DATA, 0,  24,  21, 0, 0)`
//   r. 71  `new FieldItem(TaskField.START_SLACK,  FIXED_DATA, 0,  28, 438, 0, 0)`
//   r. 72  `new FieldItem(TaskField.FINISH_SLACK, FIXED_DATA, 0,  32, 439, 0, 0)`
//   r. 84  `new FieldItem(TaskField.ACTUAL_START, FIXED_DATA, 0,  72,  41, 0, 0)`
//   r. 85  `new FieldItem(TaskField.ACTUAL_FINISH,FIXED_DATA, 0,  76,  42, 0, 0)`
// TOTAL_SLACK (MPP-veld-id 22, `common/MPPTaskField.java` r. 385) heeft GEEN entry in
// `getDefaultTaskData()`: MPXJ leest 'm nooit uit een MPP14-bestand maar berekent 'm
// (`Task.java` r. 7274 `CALCULATED_FIELD_MAP.put(TaskField.TOTAL_SLACK, Task::calculateTotalSlack)`
// → `cpm/MicrosoftSlackCalculator.java` `calculateTotalSlack`). Het id wordt hier tóch opgezocht in
// de DATA-GEDREVEN veldkaart (`fixedOffsetOf`), zodat de meting kan RAPPORTEREN of een bestand het
// veld alsnog opgeslagen draagt (corpusbreed te meten, niet aan te nemen).
//
// EENHEID (spelingen): `TaskField.java` r. 73/287/288 — `FREE_SLACK`/`START_SLACK`/`FINISH_SLACK`
// zijn `DataType.DURATION` met eenhedenbron `ACTUAL_DURATION_UNITS` (id 181, offset 46) — precies
// het veld dat hieronder al als `durUnit` gelezen wordt. De ruwe int is TIENDEN VAN EEN MINUUT
// (`MPPUtility.getDuration(double, TimeUnit)` r. 504: "Value is given in 1/10 of minute";
// `getAdjustedDuration` r. 694 e.v. deelt voor DAYS door `minutesPerDay × 10`, voor HOURS door
// 600 — dus raw/10 is altijd het aantal (werk-)minuten, ongeacht de weergave-eenheid; bij een
// ELAPSED-eenheid zijn het kalenderminuten). Sentinel: raw === -1 ⇒ `null` (`getAdjustedDuration`
// r. 698 `if (duration != -1)`).
const TASK_FIELD_LATE_START = 39;
const TASK_FIELD_LATE_FINISH = 40;
const TASK_FIELD_FREE_SLACK = 21;
const TASK_FIELD_START_SLACK = 438;
const TASK_FIELD_FINISH_SLACK = 439;
const TASK_FIELD_TOTAL_SLACK = 22;
const TASK_FIELD_ACTUAL_START = 41;
const TASK_FIELD_ACTUAL_FINISH = 42;
const DURATION_NULL_SENTINEL = -1;

/** Ruwe duur-int (tienden van een minuut) of `null` bij afwezig veld/te kort record/-1-sentinel. */
function readRawDuration(data: Uint8Array, offset: number | null, ctx: string): number | null {
  if (offset === null || data.length < offset + 4) return null;
  const raw = getInt(data, offset, ctx);
  return raw === DURATION_NULL_SENTINEL ? null : raw;
}

function readOptionalTimestamp(data: Uint8Array, offset: number | null, ctx: string): Date | null {
  if (offset === null || data.length < offset + 4) return null;
  return getTimestamp(data, offset, ctx);
}

export interface RawTask {
  uniqueId: number;
  /** Taak-ID (kolomvolgorde in MS Project) — de join-sleutel naar `Task.id` in `readMPP`'s output. */
  id: number;
  name: string;
  start: Date | null;
  finish: Date | null;
  /** SCHEDULED_DURATION, ruwe tienden-van-minuut — niet gebruikt door de pariteitsmeting zelf
   *  (die vergelijkt alleen start/finish), aangehouden voor toekomstige metingen op dezelfde scan
   *  (ELAPSED-duur e.d.) zodat die geen derde lus hoeven te bouwen. */
  durationRaw: number;
  durUnit: string;
  /** Late/float-meting (2026-09-11) — zie de constantenblok-toelichting hierboven. Alle velden
   *  OPTIONEEL op storage-niveau (`null` bij een ontbrekend veld in de veldkaart, een te kort
   *  record of de -1-sentinel); `durUnit` hierboven is de eenheid van de drie spelingen. */
  isManual: boolean;
  lateStart: Date | null;
  lateFinish: Date | null;
  /** Ruwe tienden-van-een-minuut (raw/10 = minuten), `null` ⇒ niet opgeslagen. */
  startSlackRaw: number | null;
  finishSlackRaw: number | null;
  freeSlackRaw: number | null;
  /** Alleen gevuld als de data-gedreven veldkaart veld-id 22 in blok 0 draagt — MPXJ kent geen
   *  default-offset voor dit veld en berekent het; de meting rapporteert of het corpus het tóch
   *  opgeslagen heeft. */
  totalSlackRaw: number | null;
  totalSlackFieldPresent: boolean;
  actualStart: Date | null;
  actualFinish: Date | null;
}

/**
 * Eigen TBkndTask-lus: leest MS Projects EIGEN opgeslagen Start/Finish + duur per taak.
 * Gesorteerd op taak-ID (dezelfde volgorde als `readMPP`'s `tasks` — beide sorteren op ID), zodat
 * de aanroeper positioneel kan aligneren zonder een aparte join-stap.
 */
export function scanGroundTruthTasks(bytes: Uint8Array): { raws: RawTask[]; fieldMap: FieldMapTable } {
  const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
  const fm = createTaskFieldMap(projectProps);
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta'])!;
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedData'])!;
  const varMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'VarMeta'])!;
  const var2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Var2Data']);
  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, TASK_FIXED_META_ITEM_SIZE, 'ground-truth/meta');
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, 'ground-truth/data');
  const varMeta = new VarMeta12(varMetaBytes, 'ground-truth/varmeta');
  const varData = new Var2Data(varMeta, var2DataBytes);

  // Z1: Fixed2Meta/Fixed2Data zijn OPTIONEEL op storage-niveau (spiegelt het bestaande
  // resource-precedent in `mppEntities.ts`'s `isFixed2MetaCostBit`/`readResourcesUnsafe` — een
  // ontbrekende of onparsebare stream ⇒ `fixed2Meta`/`fixed2Data` blijven `null`, en élke taak
  // valt dan terug op `SCHEDULED_START`/`FINISH` via `resolveScheduleField`'s `raw === null`-tak
  // — geen exceptie, geen half-gelezen toestand. Twee APARTE fixtures in `check-mpp-fidelity.ts`
  // bewijzen dat, elk een ander pad: acceptatiepunt 4 (stream ontbreekt volledig) bewijst de
  // `if (fixed2MetaBytes && fixed2DataBytes)`-guard hieronder; een vijandige fixture met een
  // AANWEZIGE maar onparsebare `Fixed2Meta` (ongeldig magic-getal) bewijst de `catch`-tak zelf
  // (mutatiebewijs: de `catch`-body vervangen door een rethrow maakt precies díe fixture rood,
  // de rest — die nooit door de `catch` gaat — blijft groen).
  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Meta']);
  const fixed2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Data']);
  let fixed2Meta: FixedMeta | null = null;
  let fixed2Data: FixedData | null = null;
  if (fixed2MetaBytes && fixed2DataBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, TASK_FIXED2_META_ITEM_SIZE_CANDIDATES, 'ground-truth/meta2');
      fixed2Data = FixedData.fromMeta(fixed2Meta, fixed2DataBytes, 0, 0, 'ground-truth/data2');
    } catch {
      fixed2Meta = null;
      fixed2Data = null;
    }
  }
  const { offset: tmOffset, mask: tmMask } = taskModeBitFlag(applicationVersion);
  const { start: manualStartOffset, finish: manualFinishOffset } = block1TaskStartFinishOffsets(projectProps);

  const offUid = fixedOffsetOf(fm, TaskFieldId.UniqueId)!;
  const offId = fixedOffsetOf(fm, TaskFieldId.Id)!;
  const offStart = fixedOffsetOf(fm, TaskFieldId.ScheduledStart)!;
  const offFinish = fixedOffsetOf(fm, TaskFieldId.ScheduledFinish)!;
  const offDur = fixedOffsetOf(fm, TaskFieldId.ScheduledDuration);
  const offDurUnits = fixedOffsetOf(fm, TaskFieldId.DurationUnits);
  const nameKey = varDataKeyOf(fm, TaskFieldId.Name)!;
  // Late/float-meting: alle zes optioneel (`null` ⇒ het bestand/de veldkaart kent het veld niet).
  const offLateStart = fixedOffsetOf(fm, TASK_FIELD_LATE_START);
  const offLateFinish = fixedOffsetOf(fm, TASK_FIELD_LATE_FINISH);
  const offFreeSlack = fixedOffsetOf(fm, TASK_FIELD_FREE_SLACK);
  const offStartSlack = fixedOffsetOf(fm, TASK_FIELD_START_SLACK);
  const offFinishSlack = fixedOffsetOf(fm, TASK_FIELD_FINISH_SLACK);
  const offTotalSlack = fixedOffsetOf(fm, TASK_FIELD_TOTAL_SLACK);
  const offActualStart = fixedOffsetOf(fm, TASK_FIELD_ACTUAL_START);
  const offActualFinish = fixedOffsetOf(fm, TASK_FIELD_ACTUAL_FINISH);

  const byUid = new Map<number, number>();
  const deleted = new Set<number>();
  const count = fixedMeta.getAdjustedItemCount();
  for (let i = FIRST_TASK_INDEX; i < count; i++) {
    const data = fixedData.getByteArrayValue(i);
    if (!data) continue;
    const meta = fixedMeta.getByteArrayValue(i);
    if (!meta || meta.length < 4) continue;
    if ((getInt(meta, 0, 'f') & DELETED_TASK_FLAG) !== 0) {
      if (data.length >= 2) deleted.add(getShort(data, 0, 'd'));
      continue;
    }
    if (data.length === NULL_TASK_BLOCK_SIZE) continue;
    if (data.length < offUid + 4) continue;
    byUid.set(getInt(data, offUid, 'uid'), i);
  }
  for (const uid of deleted) if (byUid.has(uid) && !varMeta.containsKey(uid)) byUid.delete(uid);

  const raws: RawTask[] = [];
  for (const [uid, idx] of byUid) {
    if (uid === 0) continue; // projectsamenvattingstaak — readTasks slaat 'm ook over
    const data = fixedData.getByteArrayValue(idx)!;

    // Z1: TASK_MODE-bit + het rauwe manual-veldpaar — beide OPTIONEEL per taak (defensief: een
    // te kort/afwezig Fixed2-item geeft `null`/`false`, nooit een throw).
    const metaItem2 = fixed2Meta ? fixed2Meta.getByteArrayValue(idx) : null;
    const isManual = !!metaItem2 && metaItem2.length >= tmOffset + 4
      && (getInt(metaItem2, tmOffset, 'tm') & tmMask) !== 0;
    const data2 = fixed2Data ? fixed2Data.getByteArrayValue(idx) : null;
    const scheduledStart = data.length >= offStart + 4 ? getTimestamp(data, offStart, 's') : null;
    const scheduledFinish = data.length >= offFinish + 4 ? getTimestamp(data, offFinish, 'f') : null;
    const rawStart = data2 && data2.length >= manualStartOffset + 4 ? getTimestamp(data2, manualStartOffset, 'ms') : null;
    const rawFinish = data2 && data2.length >= manualFinishOffset + 4 ? getTimestamp(data2, manualFinishOffset, 'mf') : null;

    raws.push({
      uniqueId: uid,
      id: data.length >= offId + 4 ? getInt(data, offId, 'id') : uid,
      name: varData.getUnicodeString(uid, nameKey, MAX_VAR_TEXT_BYTES, 'n') || 'Task',
      start: resolveScheduleField(rawStart, scheduledStart, isManual),
      finish: resolveScheduleField(rawFinish, scheduledFinish, isManual),
      durationRaw: offDur !== null && data.length >= offDur + 4 ? getInt(data, offDur, 'du') : 0,
      durUnit: offDurUnits !== null && data.length >= offDurUnits + 2 ? getDurationTimeUnits(getShort(data, offDurUnits, 'dun')) : '?',
      isManual,
      lateStart: readOptionalTimestamp(data, offLateStart, 'ls'),
      lateFinish: readOptionalTimestamp(data, offLateFinish, 'lf'),
      startSlackRaw: readRawDuration(data, offStartSlack, 'ssl'),
      finishSlackRaw: readRawDuration(data, offFinishSlack, 'fsl'),
      freeSlackRaw: readRawDuration(data, offFreeSlack, 'frs'),
      totalSlackRaw: readRawDuration(data, offTotalSlack, 'tsl'),
      totalSlackFieldPresent: offTotalSlack !== null,
      actualStart: readOptionalTimestamp(data, offActualStart, 'as'),
      actualFinish: readOptionalTimestamp(data, offActualFinish, 'af'),
    });
  }
  raws.sort((a, b) => a.id - b.id);
  return { raws, fieldMap: fm };
}
