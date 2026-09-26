/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Poort van `FieldMap.java`/`FieldMap14.java`: de veld→locatie-mapping (fixed-data-offset of
 * var-data-sleutel per veld) wordt DATA-GEDREVEN uit een `Props`-blok gelezen (`TASK_FIELD_MAP`
 * e.d.) — geen statische offsettabel. In het corpus (MS Project 16.0) wijken de echte offsets af van
 * FieldMap14.java's `getDefaultTaskData()`-fallback (bv. UNIQUE_ID op offset 4 i.p.v. 0, ID op 0
 * i.p.v. 4), dus de data-gedreven parse is de enige correcte weg.
 *
 * De terugval is ALLES-OF-NIETS per veld-map: de default-tabel beschrijft een ANDERE fysieke
 * recordlayout, dus per ontbrekend veld mengen zou een offset uit de ene layout tegen bytes uit de
 * andere lezen — stil verkeerde waarden. FieldMap.java's `createTaskFieldMap` doet precies dit:
 * `TASK_FIELD_MAP`/`TASK_FIELD_MAP2` beide afwezig ⇒ volledig `getDefaultTaskData()`; aanwezig ⇒
 * uitsluitend `createFieldMap(bytes)`. Zie `buildFieldMap`.
 *
 * Vereenvoudiging t.o.v. de Java-bron: MPXJ's `FieldTypeHelper` vertaalt een ruwe veld-id via een
 * prefix naar een `TaskField`-enumwaarde, met een MPP14-override-tabel (`MPPTaskField.mapMpp14`).
 * Voor de velden die deze lezer gebruikt IS de ruwe 16-bit-index (`typeValue & 0xFFFF`) al gelijk aan
 * de canonieke post-override-waarde (29→SCHEDULED_DURATION, 35→SCHEDULED_START, 36→SCHEDULED_FINISH
 * zijn precies de overrides; de overige id's hier, o.a. 20, 178, 1283, 1284, 1288, 1289, hebben er
 * geen). De veld-id-constanten hieronder ZIJN dus de indices om op te zoeken.
 *
 * Milestone/summary zitten BEWUST niet in dit bestand: MPXJ leest die via bit-vlaggen in de
 * FixedMeta-recordbytes (`MPP14Reader`'s `PROJECT20xx_TASK_META_DATA_BIT_FLAGS`) resp. leidt
 * `summary` af uit "heeft kindtaken" (`MPPReader.java`: `task.setSummary(task.hasChildTasks() ||
 * ...)`) — de outline-level-stack in `mppReader.ts`.
 *
 * `parseFieldMapBytes` registreert naast blok 0 (FixedData) ook BLOK-1-entries (`Fixed2Data`,
 * `location: 'fixed2'`), nodig voor het MANUALLY_SCHEDULED-veldpaar (1283/1284) en de handmatige duur
 * (1288/1289).
 *
 * Poort-bronnen: FieldMap.java (`createFieldMap`, `createTaskFieldMap`/`createResourceFieldMap`/
 * `createAssignmentFieldMap`), FieldMap14.java (`getDefaultTaskData`/`getDefaultResourceData`/
 * `getDefaultAssignmentData`, MPP14-veld-id's), PropsKey.java (FIELD_MAP-sleutels).
 */
import { getInt, getShort } from './mppPrimitives';
import type { Props } from './mppContainer';

/** Waar een veld leeft binnen de FixedData/Fixed2Data/Var2Data-blokken van een backend-storage
 *  (TBkndTask/TBkndRsc/TBkndAssn) — spiegelt `FieldMap.FieldItem`, alleen de drie locaties die
 *  deze lezer gebruikt (META_DATA/UNKNOWN worden genegeerd). `'fixed'` = blok 0 (FixedData),
 *  `'fixed2'` = blok 1 (Fixed2Data, `dataBlockIndex=1`); blok ≥2 wordt genegeerd (geen van onze
 *  velden leeft daar). */
export interface FieldEntry {
  location: 'fixed' | 'fixed2' | 'var';
  /** Bij `location === 'fixed'` of `'fixed2'` — byte-offset in het betreffende FixedData-item
   *  (blok 0 resp. blok 1 — twee FYSIEK GESCHEIDEN records per taak/resource/assignment, geen
   *  doorlopende adressering: offset 50 in blok 1 is dus een ANDERE byte dan offset 50 in blok 0). */
  fixedOffset?: number;
  /** Alleen bij `location === 'var'` — sleutel voor `Var2Data.getByteArray`/`getUnicodeString`. */
  varDataKey?: number;
}

/** Veld-id → locatie, voor precies de velden die deze lezer nodig heeft. */
export type FieldMapTable = ReadonlyMap<number, FieldEntry>;

const FIELD_MAP_ENTRY_SIZE = 28;
/** FieldMap.java: category 0x0B/0x64 zijn boolean-vlaggen in een apart meta-blok — de generieke
 *  field map kent daar geen locatie voor ("we just haven't worked out how to convert this into the
 *  actual location... For now we rely on the location in the file being fixed"). Geen van onze
 *  velden valt in deze categorie. `parseFieldMapBytes` slaat zulke entries over; dankzij de
 *  alles-of-niets-terugval kan zo'n gat nooit alsnog met een default-offset gevuld worden. */
const META_DATA_CATEGORIES = new Set([0x0b, 0x64]);
/** FieldMap.java: dataBlockOffset 65535 ⇒ dit veld heeft geen vaste plek, dus VAR_DATA (of
 *  UNKNOWN als de var-data-sleutel ook 0 is — niet relevant voor onze velden). */
const NO_FIXED_OFFSET = 65535;

/**
 * Poort van `FieldMap.createFieldMap(byte[])`. Loopt in stappen van 28 bytes over de
 * veld-map-data (structuur: mask(4) + dataBlockOffset(2)@4 + ongebruikt(2) + typeValue(4)@12 +
 * ongebruikt(4) + category(2)@20 + ongebruikt(6)) en bouwt een generieke `id → FieldEntry`-tabel.
 * `useTypeAsVarDataKey()` is voor FieldMap14 altijd `true` (MPP14 gebruikt de typewaarde zelf als
 * var-data-sleutel; er is geen substitutietabel nodig voor de velden hier — corpus-geverifieerd),
 * dus de var-data-sleutel is simpelweg dezelfde 16-bit-index als de fixed-data-veld-id.
 */
function parseFieldMapBytes(bytes: Uint8Array): Map<number, FieldEntry> {
  const entries = new Map<number, FieldEntry>();
  let lastDataBlockOffset = 0;
  let dataBlockIndex = 0;
  for (let pos = 0; pos + FIELD_MAP_ENTRY_SIZE <= bytes.length; pos += FIELD_MAP_ENTRY_SIZE) {
    const dataBlockOffset = getShort(bytes, pos + 4, 'fieldMap14 dataBlockOffset');
    const typeValue = getInt(bytes, pos + 12, 'fieldMap14 typeValue');
    const category = getShort(bytes, pos + 20, 'fieldMap14 category');
    const index = typeValue & 0xffff;

    if (META_DATA_CATEGORIES.has(category)) continue;

    if (dataBlockOffset !== NO_FIXED_OFFSET) {
      if (dataBlockOffset < lastDataBlockOffset) dataBlockIndex++;
      lastDataBlockOffset = dataBlockOffset;
      // Blok 0 (FixedData) én blok 1 (Fixed2Data) zijn relevant; blok ≥2 blijft bewust weg i.p.v.
      // een offset tegen het verkeerde blok te suggereren.
      if (dataBlockIndex === 0) {
        entries.set(index, { location: 'fixed', fixedOffset: dataBlockOffset });
      } else if (dataBlockIndex === 1) {
        entries.set(index, { location: 'fixed2', fixedOffset: dataBlockOffset });
      }
    } else if (index !== 0) {
      entries.set(index, { location: 'var', varDataKey: index });
    }
  }
  return entries;
}

/** Bouwt de uiteindelijke tabel — ALLES-OF-NIETS per bron (zie de moduleheader):
 *  - `fieldMapBytes` ontbreekt ⇒ volledig `defaults` (MPXJ: `createTaskFieldMap`'s
 *    `populateDefaultData`-tak).
 *  - `fieldMapBytes` aanwezig ⇒ UITSLUITEND de data-gedreven entries; `defaults` wordt niet
 *    geraadpleegd, ook niet voor een ontbrekend veld. `fixedOffsetOf`/`varDataKeyOf` geven dan `null`;
 *    `readTasks`' harde veldmap-check maakt van een té leeg resultaat een duidelijke fout. */
function buildFieldMap(fieldMapBytes: Uint8Array | null, defaults: Readonly<Record<number, FieldEntry>>): FieldMapTable {
  if (!fieldMapBytes) {
    const result = new Map<number, FieldEntry>();
    for (const key of Object.keys(defaults)) result.set(Number(key), defaults[Number(key)]);
    return result;
  }
  return parseFieldMapBytes(fieldMapBytes);
}

function firstByteArray(props: Props, keys: number[]): Uint8Array | null {
  for (const key of keys) {
    const value = props.getByteArray(key);
    if (value) return value;
  }
  return null;
}

// ── PropsKey-sleutels voor de drie field maps (PropsKey.java) ───────────────────────────────────
const PROPS_KEY_TASK_FIELD_MAP = 131092;
const PROPS_KEY_TASK_FIELD_MAP2 = 50331668;
const PROPS_KEY_RESOURCE_FIELD_MAP = 131093;
const PROPS_KEY_RESOURCE_FIELD_MAP2 = 50331669;
const PROPS_KEY_ASSIGNMENT_FIELD_MAP = 131095;
const PROPS_KEY_ASSIGNMENT_FIELD_MAP2 = 50331671;

// ── Taak-veld-id's (FieldMap14.java `getDefaultTaskData()` + MPP14-veld-id's; zie moduleheader
// voor waarom hier geen aparte mapMpp14-override nodig is) ──────────────────────────────────────
export const TaskFieldId = {
  UniqueId: 86,
  Id: 23,
  Name: 14,
  Wbs: 16,
  OutlineLevel: 249,
  ScheduledStart: 35,
  ScheduledFinish: 36,
  ScheduledDuration: 29,
  /** ACTUAL_DURATION_UNITS — dient als eenheden-bron voor SCHEDULED_DURATION (TaskField.java:
   *  `SCHEDULED_DURATION(DataType.DURATION, TaskField.ACTUAL_DURATION_UNITS)`). */
  DurationUnits: 181,
  /** REMAINING_DURATION (TaskField.java: `REMAINING_DURATION(DataType.DURATION,
   *  TaskField.ACTUAL_DURATION_UNITS)`) — zelfde eenhedenbron als SCHEDULED_DURATION. MSP's eigen
   *  opgeslagen restduur, rechtstreeks gebruikt i.p.v. teruggerekend uit het afgeronde
   *  `PercentComplete`. */
  RemainingDuration: 31,
  ConstraintType: 17,
  ConstraintDate: 18,
  Deadline: 437,
  PercentComplete: 32,
  ActualStart: 41,
  ActualFinish: 42,
  /** Rauwe kalender-uniqueID; `readTasks` vertaalt die naar een `WorkCalendar`-referentie. */
  CalendarUniqueId: 401,
  /** Blok 0, offset 58 (`FieldMap14.java`: `new FieldItem(TaskField.LEVELING_DELAY, FIXED_DATA, 0,
   *  58, 20, 0, 0)`). */
  LevelingDelay: 20,
  /** Eenheid/elapsed-vlag bij `LevelingDelay` (zelfde SHORT-vorm als `DurationUnits`). Blok 0,
   *  offset 62 (`FieldMap14.java`: `..., FIXED_DATA, 0, 62, 178, 0, 0`). */
  LevelingDelayUnits: 178,
  /** MANUALLY_SCHEDULED-taken ankeren hierop i.p.v. `ScheduledStart`/`ScheduledFinish` (zie
   *  `mppReader.ts`'s moduleheader-toelichting bij TASK_MODE). BLOK 1 (Fixed2Data), offset 50
   *  (`FieldMap14.java`: `new FieldItem(TaskField.START, FIXED_DATA, 1, 50, 1283, 0, 0)`). */
  Start: 1283,
  /** Spiegelt `Start` hierboven. Blok 1, offset 54 (`FieldMap14.java`: `..., 1, 54, 1284, 0,
   *  0)`). */
  Finish: 1284,
  /** MSP's EIGEN opgeslagen duur voor een MANUALLY_SCHEDULED-taak (los van `ScheduledDuration`).
   *  Blok 1, offset 58 (`FieldMap14.java`: `..., 1, 58, 1288, 0, 0)`). */
  ManualDuration: 1288,
  /** Eenheid/elapsed-vlag bij `ManualDuration` hierboven. Blok 1, offset 62 (`FieldMap14.java`:
   *  `..., 1, 62, 1289, 0, 0)`). */
  ManualDurationUnits: 1289,
  /** `TaskField.RESUME` (`DataType.DATE`): MSP's eigen opgeslagen hervattingsinstant voor een lopende
   *  taak, letterlijk uit het bestand. Blok 0, offset 20 (`FieldMap14.java`: `new
   *  FieldItem(TaskField.RESUME, FIELD_LOCATION.FIXED_DATA, 0, 20, 99, 0, 0)`). In het corpus is
   *  `finish = addWork(resume, remaining)` op de taakkalender 17/17 exact voor
   *  out-of-sequence-lopende bladtaken. Niet te verwarren met `AssignmentFieldId.Resume` (24,
   *  andere veldkaart). */
  Resume: 99,
  /** `TaskField.STOP` (`DataType.DATE`), MSP's eigen grens van het afgewerkte deel. Blok 0, offset 16
   *  (`FieldMap14.java`: `..., FIXED_DATA, 0, 16, 100, 0, 0`). Niet nodig voor de
   *  `addWork(resume, remaining)`-formule; meegenomen als rauw feit. */
  Stop: 100,
  /** `TaskField.TYPE` (`DataType.TASK_TYPE`, SHORT): MSP's Task Type (Fixed Units/Fixed Duration/
   *  Fixed Work). Blok 0, offset 94 (`FieldMap14.java`: `new FieldItem(TaskField.TYPE, FIXED_DATA,
   *  0, 94, 128, 0, 0)`); geen `mapMpp14`-override. */
  Type: 128,
  /** "Datums zoals opgeslagen" voor `.mpp` — MSP's EIGEN
   *  rekenuitvoer, uitsluitend als apart weergavekanaal (`ImportResult.recordedTimes`), nooit
   *  solverinvoer. Letterlijk uit `FieldMap14.getDefaultTaskData()`:
   *  `EARLY_START (FIXED_DATA, 0, 106, 37)`, `EARLY_FINISH (0, 8, 38)`, `LATE_START (0, 12, 39)`,
   *  `LATE_FINISH (0, 110, 40)`, `FREE_SLACK (0, 24, 21)`, `START_SLACK (0, 28, 438)`,
   *  `FINISH_SLACK (0, 32, 439)`. TOTAL_SLACK heeft in MPP14 GEEN eigen opslagveld (MPXJ
   *  `TaskField.TOTAL_SLACK(DataType.DURATION)` zonder FieldItem); de lezer neemt het minimum van
   *  start- en finish-slack, MS Project's eigen definitie van Total Slack. */
  EarlyStart: 37,
  EarlyFinish: 38,
  LateStart: 39,
  LateFinish: 40,
  FreeSlack: 21,
  StartSlack: 438,
  FinishSlack: 439,
} as const;

/** Letterlijk uit `FieldMap14.getDefaultTaskData()` — alleen de entries voor `TaskFieldId`
 *  hierboven, voor blok 0 en blok 1 (`location: 'fixed2'`). Terugval voor het (zeldzame) geval dat
 *  `TASK_FIELD_MAP`/`TASK_FIELD_MAP2` in `Props` beide ontbreken. */
const DEFAULT_TASK_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [TaskFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [TaskFieldId.Id]: { location: 'fixed', fixedOffset: 4 },
  [TaskFieldId.OutlineLevel]: { location: 'fixed', fixedOffset: 40 },
  [TaskFieldId.ScheduledDuration]: { location: 'fixed', fixedOffset: 42 },
  [TaskFieldId.DurationUnits]: { location: 'fixed', fixedOffset: 46 },
  [TaskFieldId.RemainingDuration]: { location: 'fixed', fixedOffset: 52 },
  [TaskFieldId.ConstraintType]: { location: 'fixed', fixedOffset: 56 },
  [TaskFieldId.LevelingDelay]: { location: 'fixed', fixedOffset: 58 },
  [TaskFieldId.LevelingDelayUnits]: { location: 'fixed', fixedOffset: 62 },
  [TaskFieldId.ScheduledStart]: { location: 'fixed', fixedOffset: 64 },
  [TaskFieldId.ScheduledFinish]: { location: 'fixed', fixedOffset: 68 },
  [TaskFieldId.ActualStart]: { location: 'fixed', fixedOffset: 72 },
  [TaskFieldId.ActualFinish]: { location: 'fixed', fixedOffset: 76 },
  [TaskFieldId.ConstraintDate]: { location: 'fixed', fixedOffset: 80 },
  [TaskFieldId.PercentComplete]: { location: 'fixed', fixedOffset: 90 },
  [TaskFieldId.CalendarUniqueId]: { location: 'fixed', fixedOffset: 118 },
  [TaskFieldId.Deadline]: { location: 'fixed', fixedOffset: 122 },
  [TaskFieldId.Wbs]: { location: 'var', varDataKey: TaskFieldId.Wbs },
  [TaskFieldId.Name]: { location: 'var', varDataKey: TaskFieldId.Name },
  [TaskFieldId.Start]: { location: 'fixed2', fixedOffset: 50 },
  [TaskFieldId.Finish]: { location: 'fixed2', fixedOffset: 54 },
  [TaskFieldId.ManualDuration]: { location: 'fixed2', fixedOffset: 58 },
  [TaskFieldId.ManualDurationUnits]: { location: 'fixed2', fixedOffset: 62 },
  // Letterlijke offsets uit `FieldMap14.getDefaultTaskData()`.
  [TaskFieldId.Resume]: { location: 'fixed', fixedOffset: 20 },
  [TaskFieldId.Stop]: { location: 'fixed', fixedOffset: 16 },
  // "Datums zoals opgeslagen" — zie de toelichting bij `TaskFieldId.EarlyStart`.
  [TaskFieldId.EarlyStart]: { location: 'fixed', fixedOffset: 106 },
  [TaskFieldId.EarlyFinish]: { location: 'fixed', fixedOffset: 8 },
  [TaskFieldId.LateStart]: { location: 'fixed', fixedOffset: 12 },
  [TaskFieldId.LateFinish]: { location: 'fixed', fixedOffset: 110 },
  [TaskFieldId.FreeSlack]: { location: 'fixed', fixedOffset: 24 },
  [TaskFieldId.StartSlack]: { location: 'fixed', fixedOffset: 28 },
  [TaskFieldId.FinishSlack]: { location: 'fixed', fixedOffset: 32 },
  // Letterlijke offset uit `FieldMap14.getDefaultTaskData()`.
  [TaskFieldId.Type]: { location: 'fixed', fixedOffset: 94 },
};

/** Poort van `FieldMap.createTaskFieldMap(Props)`. */
export function createTaskFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_TASK_FIELD_MAP, PROPS_KEY_TASK_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_TASK_FIELDS);
}

// ── Resource-veld-id's ─────────────────────────────────────────────────────────────────────────
export const ResourceFieldId = {
  UniqueId: 27,
  Name: 1,
  MaxUnits: 4,
} as const;

/** Geëxporteerd zodat de fixtures in `check-mpp-relations.ts` deze tabel hergebruiken i.p.v. een
 *  duplicaat dat uit de pas kan lopen. */
export const DEFAULT_RESOURCE_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [ResourceFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [ResourceFieldId.MaxUnits]: { location: 'fixed', fixedOffset: 44 },
  [ResourceFieldId.Name]: { location: 'var', varDataKey: ResourceFieldId.Name },
};

/** Poort van `FieldMap.createResourceFieldMap(Props)`. */
export function createResourceFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_RESOURCE_FIELD_MAP, PROPS_KEY_RESOURCE_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_RESOURCE_FIELDS);
}

// ── Assignment-veld-id's ───────────────────────────────────────────────────────────────────────
export const AssignmentFieldId = {
  UniqueId: 0,
  TaskUniqueId: 1,
  ResourceUniqueId: 2,
  Units: 7,
  /** `AssignmentField.START`: ankerpunt van `getCompleteWork` en van `getPlannedWork` zonder complete
   *  work (zie mppTimephased.ts). De DEFAULT-tabel zet hem op blok 0 offset 12, maar de data-gedreven
   *  veldkaart plaatst hem in 136 gemeten bestanden op offset 52 — `fixedOffsetOf` volgt altijd de
   *  per-bestand-offset zodra de Props-key aanwezig is. */
  Start: 20,
  /** `AssignmentField.RESUME` (id 24): ankerpunt van `getPlannedWork` MÉT complete work. GEEN
   *  default-entry in de Java-bron, dus bewust ook niet in `DEFAULT_ASSIGNMENT_FIELDS`:
   *  `fixedOffsetOf` levert `null` tenzij het bestand zelf een entry draagt. */
  Resume: 24,
  /** `AssignmentField.FINISH` (id 21; default blok 0 offset 16, data-gedreven in 136 gemeten
   *  bestanden offset 56): MSP's eigen berekende afsluitdatum van deze toewijzing (contour, restwerk
   *  en resourcekalender meegenomen). LET OP: dit veld rechtstreeks als CPM-antwoord gebruiken is een
   *  cirkelmeting en bevriest de motor ná import (geen invalidatie bij edits); `mppReader.ts` gebruikt
   *  hem alleen in de gelaagde beslistabel (laag 3). */
  Finish: 21,
  /** Timephased-categorieën, alle vier VAR_DATA (`FieldLocation.VAR_DATA, block 0, dataBlockOffset
   *  65535`). Alleen deze vier — niet de 11 baseline-varianten, niet de kostcategorieën. Var-data-
   *  sleutel = de typewaarde zelf (`useTypeAsVarDataKey`), dus gelijk aan de id.
   *  `RemainingRegularWork` (49) en `ActualRegularWork` (50) staan letterlijk in
   *  `FieldMap14.getDefaultAssignmentData()` (`new FieldItem(AssignmentField.
   *  RAW_TIMEPHASED_REMAINING_REGULAR_WORK, VAR_DATA, 0, 65535, 49, 0, 0)` resp. `...50, 0, 0)`).
   *  `ActualOvertimeWork` (51) en `ActualIrregularWork` (87) ontbreken daar (MPXJ-omissie; wél in
   *  `org.mpxj.common.MPPAssignmentField`'s omgekeerde index: 51→`RAW_TIMEPHASED_ACTUAL_OVERTIME_WORK`,
   *  87→`TIMEPHASED_ACTUAL_IRREGULAR_WORK`); `DEFAULT_ASSIGNMENT_FIELDS` voegt ze symmetrisch toe. */
  RemainingRegularWork: 49,
  ActualRegularWork: 50,
  ActualOvertimeWork: 51,
  ActualIrregularWork: 87,
} as const;

/** Geëxporteerd, zelfde reden als `DEFAULT_RESOURCE_FIELDS`. */
export const DEFAULT_ASSIGNMENT_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [AssignmentFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [AssignmentFieldId.TaskUniqueId]: { location: 'fixed', fixedOffset: 4 },
  [AssignmentFieldId.ResourceUniqueId]: { location: 'fixed', fixedOffset: 8 },
  [AssignmentFieldId.Units]: { location: 'fixed', fixedOffset: 46 },
  [AssignmentFieldId.Start]: { location: 'fixed', fixedOffset: 12 },
  [AssignmentFieldId.Finish]: { location: 'fixed', fixedOffset: 16 },
  [AssignmentFieldId.RemainingRegularWork]: { location: 'var', varDataKey: AssignmentFieldId.RemainingRegularWork },
  [AssignmentFieldId.ActualRegularWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualRegularWork },
  [AssignmentFieldId.ActualOvertimeWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualOvertimeWork },
  [AssignmentFieldId.ActualIrregularWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualIrregularWork },
};

/** Poort van `FieldMap.createAssignmentFieldMap(Props)`. */
export function createAssignmentFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_ASSIGNMENT_FIELD_MAP, PROPS_KEY_ASSIGNMENT_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_ASSIGNMENT_FIELDS);
}

// ── Accessors ─────────────────────────────────────────────────────────────────────────────────

/** Fixed-data-byte-offset (BLOK 0) voor `fieldId`, of `null` als het veld niet in FIXED_DATA leeft
 *  (of helemaal niet in de tabel voorkomt). */
export function fixedOffsetOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'fixed' && entry.fixedOffset !== undefined ? entry.fixedOffset : null;
}

/** Fixed2Data-byte-offset (BLOK 1) voor `fieldId`, of `null` als het veld niet in blok 1 leeft (of
 *  niet in de tabel voorkomt). Bewust een aparte accessor i.p.v. een blok-parameter: blok 0 en
 *  blok 1 zijn fysiek gescheiden records. */
export function fixed2OffsetOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'fixed2' && entry.fixedOffset !== undefined ? entry.fixedOffset : null;
}

/** Var-data-sleutel voor `fieldId`, of `null` als het veld niet in VAR_DATA leeft. */
export function varDataKeyOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'var' && entry.varDataKey !== undefined ? entry.varDataKey : null;
}
