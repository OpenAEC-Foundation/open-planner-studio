/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Poort van `FieldMap.java`/`FieldMap14.java`: de veld→locatie-mapping (fixed-data-offset of
 * var-data-sleutel per veld) wordt DATA-GEDREVEN uit een `Props`-blok gelezen (`TASK_FIELD_MAP`
 * e.d.) — geen giga-statische offsettabel. Corpus-geverifieerd (2026-08-14, alle drie
 * ground-truth-bestanden, MS Project 16.0/2016+): de ECHTE offsets in het bestand wijken af van
 * FieldMap14.java's `getDefaultTaskData()`-fallback (bv. UNIQUE_ID op offset 4 i.p.v. 0, ID op
 * offset 0 i.p.v. 4) — de data-gedreven parse is dus geen overdreven voorzichtigheid maar de
 * enige correcte weg.
 *
 * De terugval-tabel is ALLES-OF-NIETS, per veld-map (T5-spec-review, I3 — correctie t.o.v. een
 * eerdere versie die per ONTBREKEND VELD terugviel op de default): de default-tabel beschrijft
 * een ANDERE fysieke recordlayout dan wat het bestand daadwerkelijk gebruikt (zie het
 * UNIQUE_ID-voorbeeld hierboven — dat is geen slordigheidje, het is een structureel andere
 * lay-out). Een enkel ontbrekend veld in een overigens data-gedreven field map per-veld met de
 * default MENGEN zou dus een offset uit de ÉÉN layout tegen bytes uit de ANDERE layout lezen —
 * stil verkeerde waarden, geen fout. `createTaskFieldMap` in FieldMap.java doet dan ook precies
 * dit: `TASK_FIELD_MAP`/`TASK_FIELD_MAP2` beide afwezig ⇒ volledig `getDefaultTaskData()`;
 * aanwezig ⇒ UITSLUITEND `createFieldMap(bytes)`, geen mix. Zie `buildFieldMap` hieronder.
 *
 * Vereenvoudiging t.o.v. de Java-bron (bewust, binnen scope): MPXJ's `FieldTypeHelper` vertaalt
 * een ruwe veld-id via een prefix (TASK_FIELD_BASE|...) naar een `TaskField`-enumwaarde, met een
 * MPP14-specifieke override-tabel (`MPPTaskField.mapMpp14`) voor een handvol velden (o.a.
 * SCHEDULED_START/FINISH/DURATION). Voor UITSLUITEND de velden die deze lezer nodig heeft, IS de
 * ruwe 16-bit-index (`typeValue & 0xFFFF`) al identiek aan de canonieke post-override-waarde die
 * `FieldMap14.getDefaultTaskData()` gebruikt (letterlijk gecontroleerd: 29→SCHEDULED_DURATION,
 * 35→SCHEDULED_START, 36→SCHEDULED_FINISH — precies de mapMpp14-overrides — de rest heeft sowieso
 * geen override). Er is dus geen aparte `mapMpp14`-poort nodig: de veld-id-constanten hieronder
 * ZIJN de indices om op te zoeken, zonder tussenlaag.
 *
 * Milestone/summary zitten BEWUST niet in dit bestand: MPXJ leest die niet via de field map maar
 * via losse bit-vlaggen in de FixedMeta-recordbytes zelf (`MPP14Reader`'s
 * `PROJECT20xx_TASK_META_DATA_BIT_FLAGS`) resp. leidt `summary` af uit "heeft kindtaken"
 * (`MPPReader.java`: `task.setSummary(task.hasChildTasks() || ...)`) — dat laatste is precies de
 * outline-level-stack-hiërarchie die `mppReader.ts` bouwt, dus hoeft niet via een apart veld.
 *
 * Poort-bronnen: FieldMap.java (`createFieldMap`, `createTaskFieldMap`/`createResourceFieldMap`/
 * `createAssignmentFieldMap`), FieldMap14.java (`getDefaultTaskData`/`getDefaultResourceData`/
 * `getDefaultAssignmentData`, MPP14-veld-id's), PropsKey.java (FIELD_MAP-sleutels).
 *
 * Z2 (etappe "nul afwijkingen"): `parseFieldMapBytes` registreert sinds deze taak ook BLOK-1-
 * entries (`Fixed2Data` — `location: 'fixed2'`, zie `FieldEntry`), nodig voor het MANUALLY_
 * SCHEDULED-veldpaar (`TaskFieldId.Start`/`Finish`, 1283/1284) en de handmatige duur (1288/1289).
 * Geverifieerd (net als hierboven bij 29/35/36): geen van deze zes nieuwe id's (20, 178, 1283,
 * 1284, 1288, 1289) heeft een `mapMpp14`-override — de rest-clausule hierboven ("de rest heeft
 * sowieso geen override") dekt ze dus al.
 *
 * Z3 (etappe "nul afwijkingen"): `AssignmentFieldId` krijgt de vier timephased-var-data-
 * categorieën (`RemainingRegularWork`/`ActualRegularWork`/`ActualOvertimeWork`/
 * `ActualIrregularWork`, zie hun eigen toelichting hieronder) die `mppTimephased.ts`/
 * `mppEntities.ts` nodig hebben — geen `mapMpp14`-override-zorg hier (ze zijn altijd VAR_DATA,
 * geen FIXED_DATA-offset-vertaling van toepassing).
 *
 * Z4-fixronde (etappe "nul afwijkingen"): `AssignmentFieldId.Start`/`Resume` toegevoegd
 * (`ResourceAssignment.java`/`TimephasedDataFactory.getPlannedWork`: `getCompleteWork` ankert
 * ALTIJD op `resourceAssignment.getStart()`, `getPlannedWork` ankert op `assignment.getStart()`
 * ZONDER complete work, op `assignment.getResume()` MET complete work) — `mppReader.ts` heeft ze
 * nodig om timephased-periodes van de ASSIGNMENT-as naar de TAAK-as te verschuiven (zie
 * `mppTimephased.ts`'s moduleheader). `Start` (id 20) heeft een `mapMpp14`-vrije default in
 * `FieldMap14.java` (`new FieldItem(AssignmentField.START, FIXED_DATA, 0, 12, 20, 0, 0)`) — hier
 * overgenomen in `DEFAULT_ASSIGNMENT_FIELDS`. `Resume` (id 24) heeft GEEN default-entry in de
 * Java-bron (MPXJ's `getDefaultAssignmentData()` bevat 'm niet) — dus ook hier bewust GEEN
 * hardcoded terugval: `fixedOffsetOf` levert `null` tenzij het BESTAND zelf een field-map-entry
 * voor id 24 draagt (het bestaande "aanwezig ⇒ data-gedreven"-contract, ongewijzigd toegepast).
 */
import { getInt, getShort } from './mppPrimitives';
import type { Props } from './mppContainer';

/** Waar een veld leeft binnen de FixedData/Fixed2Data/Var2Data-blokken van een backend-storage
 *  (TBkndTask/TBkndRsc/TBkndAssn) — spiegelt `FieldMap.FieldItem`, alleen de drie locaties die
 *  deze lezer daadwerkelijk gebruikt (META_DATA/UNKNOWN worden genegeerd, zie moduleheader).
 *
 *  Z2 (etappe "nul afwijkingen"): vóór deze taak was `'fixed'` altijd blok 0 (FixedData) — block ≥1
 *  (Fixed2Data) werd domweg overgeslagen (zie `parseFieldMapBytes`'s oude commentaar). MANUALLY_
 *  SCHEDULED-taken ankeren echter op een veldpaar (START/FINISH, 1283/1284) dat uitsluitend in
 *  BLOK 1 leeft (`FieldMap14.java`: `dataBlockIndex=1`), dus dat blok is nu een EIGEN locatie
 *  (`'fixed2'`) i.p.v. stilzwijgend te blijven negeren. Blok ≥2 blijft wél genegeerd (geen van de
 *  velden die deze lezer nodig heeft leeft daar, corpus-geverifieerd). */
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
 *  field map kent geen locatie daarvoor (net als de Java-bron: "we just haven't worked out how to
 *  convert this into the actual location... For now we rely on the location in the file being
 *  fixed"). Geen van de velden die déze lezer nodig heeft valt in deze categorie (corpus-
 *  geverifieerd). `parseFieldMapBytes` hieronder SLAAT zulke entries simpelweg over (geen
 *  `entries.set(...)`-aanroep) — sinds I3's alles-of-niets-terugval (zie `buildFieldMap`) is dat
 *  vanzelf voldoende: een META_DATA-veld-id ontbreekt dan gewoon in `entries`, en er is geen
 *  merge-met-defaults-pad meer dat zo'n gat alsnog met een FIXED_DATA/VAR_DATA-offset zou kunnen
 *  vullen (T5-slot — een eerdere versie hield hiervoor een aparte `metaDataIds`-verzameling bij;
 *  die is met I3's herstructurering ongebruikt komen te staan en is verwijderd, dezelfde
 *  opruimnorm als de `stack.id`-opruiming elders in deze commit). */
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
      // Z2: blok 0 (FixedData) én blok 1 (Fixed2Data) zijn beide relevant (zie moduleheader) — blok
      // ≥2 blijft genegeerd, dus zulke entries blijven bewust ongebruikt in de tabel i.p.v. een
      // verkeerde offset tegen het verkeerde blok te suggereren.
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

/** Bouwt de uiteindelijke tabel — ALLES-OF-NIETS per bron (T5-spec-review, I3; zie de
 *  moduleheader voor waarom een per-veld-mix stil verkeerde bytes zou lezen):
 *  - `fieldMapBytes` ontbreekt (geen `TASK_FIELD_MAP`/`TASK_FIELD_MAP2` e.d. in `Props`) ⇒
 *    volledig `defaults` (MPXJ: `createTaskFieldMap`'s `populateDefaultData`-tak).
 *  - `fieldMapBytes` aanwezig ⇒ UITSLUITEND de data-gedreven entries uit `parseFieldMapBytes` —
 *    `defaults` wordt dan HELEMAAL niet geraadpleegd, ook niet voor een veld dat toevallig
 *    ontbreekt in de geparste field map (inclusief een META_DATA-veld-id, zie de toelichting bij
 *    `META_DATA_CATEGORIES`). `fixedOffsetOf`/`varDataKeyOf` geven voor zo'n veld dan `null` (net
 *    als voor elk ander onbekend veld) — de aanroeper (`readTasks`'s harde veldmap-check) bewaakt
 *    dat een té leeg resultaat een duidelijke fout geeft i.p.v. stil door te lezen met verkeerde
 *    offsets. */
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
   *  TaskField.ACTUAL_DURATION_UNITS)`) — deelt dus dezelfde eenhedenbron als SCHEDULED_DURATION
   *  (`DurationUnits` hierboven). T9: MSP's EIGEN opgeslagen restduur, rechtstreeks gebruikt in
   *  plaats van teruggerekend uit het afgeronde `PercentComplete` (zie de moduleheader van
   *  `mppReader.ts`'s voortgangs-tak). */
  RemainingDuration: 31,
  ConstraintType: 17,
  ConstraintDate: 18,
  Deadline: 437,
  PercentComplete: 32,
  ActualStart: 41,
  ActualFinish: 42,
  /** Alleen de rauwe kalender-uniqueID; T6 vertaalt dit naar een echte `WorkCalendar`-referentie.
   *  T5 leest 'm nog niet uit (er is nog geen kalenderlaag om naar te verwijzen). */
  CalendarUniqueId: 401,
  /** T12, VERHUISD naar hier in Z2 (was een losse `TASK_FIELD_LEVELING_DELAY`-constante in
   *  `mppReader.ts` — die had bewust geen plek in deze tabel omdat `fieldMap14.ts` toen buiten
   *  T12's bestandenlijst viel; Z2 heropent dit bestand voor de Fixed2-infrastructuur, dus de
   *  constante hoort nu structureel hier, bij haar zusjes). Blok 0, offset 58
   *  (`FieldMap14.java`: `new FieldItem(TaskField.LEVELING_DELAY, FIXED_DATA, 0, 58, 20, 0, 0)`). */
  LevelingDelay: 20,
  /** Z2 — eenheid/elapsed-vlag bij `LevelingDelay` hierboven (zelfde SHORT-vorm als `DurationUnits`).
   *  Blok 0, offset 62 (`FieldMap14.java`: `..., FIXED_DATA, 0, 62, 178, 0, 0`). Nog UITSLUITEND
   *  gelezen en opgeslagen in `RawTaskScan` door deze taak — de decodering tot een echte
   *  eenheden-/elapsed-beslissing is Z5-werk (spiegelt `DurationUnits`'s eigen decodeerpad). */
  LevelingDelayUnits: 178,
  /** Z2 — MANUALLY_SCHEDULED-taken ankeren hierop i.p.v. `ScheduledStart`/`ScheduledFinish` (zie
   *  `mppReader.ts`'s moduleheader-toelichting bij TASK_MODE). BLOK 1 (Fixed2Data), offset 50
   *  (`FieldMap14.java`: `new FieldItem(TaskField.START, FIXED_DATA, 1, 50, 1283, 0, 0)`). */
  Start: 1283,
  /** Z2 — spiegelt `Start` hierboven. Blok 1, offset 54 (`FieldMap14.java`: `..., 1, 54, 1284, 0,
   *  0)`). */
  Finish: 1284,
  /** Z2 — MSP's EIGEN opgeslagen duur voor een MANUALLY_SCHEDULED-taak (los van `ScheduledDuration`).
   *  Blok 1, offset 58 (`FieldMap14.java`: `..., 1, 58, 1288, 0, 0)`). */
  ManualDuration: 1288,
  /** Z2 — eenheid/elapsed-vlag bij `ManualDuration` hierboven. Blok 1, offset 62 (`FieldMap14.java`:
   *  `..., 1, 62, 1289, 0, 0)`). */
  ManualDurationUnits: 1289,
  /** Z12-herwerk (dossier out-of-sequence-actuals) — `TaskField.RESUME` (`DataType.DATE`). MSP's
   *  EIGEN opgeslagen hervattingsinstant voor een IN-PROGRESS-taak — géén afgeleide/herberekende
   *  waarde, de invoer staat letterlijk in het bestand. Blok 0, offset 20 (`FieldMap14.java`:
   *  `new FieldItem(TaskField.RESUME, FIELD_LOCATION.FIXED_DATA, 0, 20, 99, 0, 0)`). Corpusmeting
   *  (fase 1, scratchpad): `finish = addWork(resume, remaining)` op de taak-EIGEN kalender is
   *  17/17 exact op alle out-of-sequence-in-progress-bladtaken corpusbreed, 4/4 op de gemeten
   *  OzBuild-snapshots minuut-exact. Niet te verwarren met `AssignmentFieldId.Resume` (24) —
   *  andere veldkaart (TBkndAssn, Z4), toevallig dezelfde Engelse naam. */
  Resume: 99,
  /** Z12-herwerk — `TaskField.STOP` (`DataType.DATE`), MSP's eigen grens van het reeds-afgewerkte
   *  deel. Blok 0, offset 16 (`FieldMap14.java`: `..., FIXED_DATA, 0, 16, 100, 0, 0`). Corpusmeting:
   *  niet nodig gebleken voor de `finish = addWork(resume, remaining)`-formule (die haalde 17/17
   *  zonder `stop`) — hier alleen MEEGENOMEN als rauw, ongebruikt veld voor een latere taak
   *  (splits/actual-grens-rendering); geen enkele solverberekening leest 'm momenteel. */
  Stop: 100,
  /** Z14b (eigenaarsbesluit 2026-08-18, punt 1) — `TaskField.TYPE` (`DataType.TASK_TYPE`, SHORT).
   *  MSP's eigen Task Type (Fixed Units/Fixed Duration/Fixed Work). Blok 0, offset 94
   *  (`FieldMap14.java`: `new FieldItem(TaskField.TYPE, FIXED_DATA, 0, 94, 128, 0, 0)`). Puur data —
   *  geen `mapMpp14`-override (zelfde "de rest heeft sowieso geen override"-clausule als de andere
   *  velden hier, corpus-geverifieerd: geen van de gemeten bestanden wijkt af van deze offset). */
  Type: 128,
} as const;

/** Letterlijk uit `FieldMap14.getDefaultTaskData()` — alleen de entries voor `TaskFieldId`
 *  hierboven. Terugval voor het (zeldzame) geval dat `TASK_FIELD_MAP`/`TASK_FIELD_MAP2` in
 *  `Props` beide ontbreken.
 *
 *  Z2: `LevelingDelay`/`LevelingDelayUnits` (blok 0) en `Start`/`Finish`/`ManualDuration`/
 *  `ManualDurationUnits` (blok 1, `location: 'fixed2'`) toegevoegd — net als elke andere entry
 *  hier zijn dit de LETTERLIJKE offsets uit `FieldMap14.getDefaultTaskData()` (zie de
 *  `TaskFieldId`-toelichtingen hierboven), dus geen nieuwe/afwijkende laag t.o.v. I3's alles-of-
 *  niets-contract: deze tabel blijft in zijn geheel de default-layout, alleen nu voor twee blokken
 *  i.p.v. één. */
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
  // Z12-herwerk — letterlijke offsets uit `FieldMap14.getDefaultTaskData()`, zie de
  // `TaskFieldId.Resume`/`.Stop`-toelichtingen hierboven.
  [TaskFieldId.Resume]: { location: 'fixed', fixedOffset: 20 },
  [TaskFieldId.Stop]: { location: 'fixed', fixedOffset: 16 },
  // Z14b — letterlijke offset uit `FieldMap14.getDefaultTaskData()`, zie `TaskFieldId.Type`'s
  // toelichting hierboven.
  [TaskFieldId.Type]: { location: 'fixed', fixedOffset: 94 },
};

/** Poort van `FieldMap.createTaskFieldMap(Props)`. */
export function createTaskFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_TASK_FIELD_MAP, PROPS_KEY_TASK_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_TASK_FIELDS);
}

// ── Resource-veld-id's (T7 gebruikt deze; hier al gebouwd zoals het plan voorschrijft) ──────────
export const ResourceFieldId = {
  UniqueId: 27,
  Name: 1,
  MaxUnits: 4,
} as const;

/** T7-kwaliteitsreview (M6): geëxporteerd zodat `check-mpp-relations.ts` se hostile-fixtures deze
 *  hergebruiken i.p.v. een hardgecodeerd duplicaat aan te houden dat stilzwijgend uit de pas kan
 *  lopen zodra deze tabel ooit verandert. */
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

// ── Assignment-veld-id's (T7 gebruikt deze) ──────────────────────────────────────────────────────
export const AssignmentFieldId = {
  UniqueId: 0,
  TaskUniqueId: 1,
  ResourceUniqueId: 2,
  Units: 7,
  /** Z4-fixronde — `AssignmentField.START` (`ResourceAssignmentFactory`/`FieldMap14.java`, blok 0
   *  offset 12 in de DEFAULT-tabel hieronder). Ankerpunt van `getCompleteWork`/de gatenloze tak van
   *  `getPlannedWork` (zie de moduleheader). L2-correctie (Z8-herwerkronde, Opus-review): dit is
   *  UITSLUITEND de hardcoded `DEFAULT_ASSIGNMENT_FIELDS`-terugval — de werkelijke, DATA-GEDREVEN
   *  veldkaart (`createAssignmentFieldMap`, uit de Props van het bestand zelf) plaatst dit veld op
   *  136 van de gemeten bestanden op een ANDERE offset (52, niet 12) — de field-map-parser volgt die
   *  correct (`fixedOffsetOf` leest de PER-BESTAND offset, nooit de default, zolang de Props-key
   *  aanwezig is), dus dit is GEEN gedragsfout, maar de eerdere docblok-claim "blok 0 offset 12" als
   *  ALGEMENE waarheid was dat wél. */
  Start: 20,
  /** Z4-fixronde — `AssignmentField.RESUME` (id 24). GEEN default-entry in de Java-bron (zie de
   *  moduleheader) — bewust GEEN vermelding in `DEFAULT_ASSIGNMENT_FIELDS` hieronder. */
  Resume: 24,
  /** Z8 (etappe "nul afwijkingen") — `AssignmentField.FINISH` (`FieldMap14.java`, blok 0 offset 16
   *  in de DEFAULT-tabel hieronder, id 21 — pal naast `Start`, zelfde recordindeling). L2-correctie
   *  (Z8-herwerkronde): zelfde kanttekening als `Start` hierboven — 136 gemeten bestanden dragen dit
   *  veld data-gedreven op offset 56, niet 16; de field-map-parser vangt dat al op, alleen deze
   *  docblok-claim was te absoluut. MSP's EIGEN al berekende afsluitdatum voor déze toewijzing
   *  (rekening houdend met haar contour/restwerk EN haar eigen resourcekalender — zie
   *  `mppReader.ts`'s Z8-toelichting voor het corpusbewijs). LET OP (Z8-herwerkronde, Opus-review,
   *  blokkerend): rechtstreeks lezen van dit veld als CPM-antwoord bleek een vrijwel volledige
   *  cirkelmeting (91% van de taken, 3102/3103 gelijk aan de rauwe import) plus een bevroren motor
   *  ná import (geen invalidatie bij latere edits) — de herwerkronde onderzoekt een kalenderwandeling-
   *  formule (AssignmentField.START + restwerk door de toewijzings-eigen resourcekalender) als
   *  vervanging; zie het Z8-herwerkrapport voor de matchgraad-metingen. Heeft, net als `Start`, een
   *  hardcoded default (hieronder in `DEFAULT_ASSIGNMENT_FIELDS`). */
  Finish: 21,
  /** Z3 (etappe "nul afwijkingen") — timephased-categorieën, alle vier VAR_DATA (geen vaste
   *  offset: `FieldMap14.java`'s `FieldLocation.VAR_DATA, block 0, dataBlockOffset 65535`).
   *  Scope-begrenzing (plan-Z3, §"Scope-begrenzing"): UITSLUITEND deze vier — niet de 11
   *  baseline-varianten, niet de kostcategorieën (die dragen niets bij aan datums). Var-data-
   *  sleutel = de typewaarde zelf (`useTypeAsVarDataKey`, zie de moduleheader hierboven), dus
   *  identiek aan de id hier — spiegelt `TaskFieldId.Wbs`/`Name`.
   *  `RemainingRegularWork` (49) en `ActualRegularWork` (50) staan LETTERLIJK zo in
   *  `FieldMap14.getDefaultAssignmentData()` (`new FieldItem(AssignmentField.
   *  RAW_TIMEPHASED_REMAINING_REGULAR_WORK, VAR_DATA, 0, 65535, 49, 0, 0)` resp. `...50, 0, 0)`).
   *  `ActualOvertimeWork` (51) en `ActualIrregularWork` (87) komen NIET in diezelfde default-
   *  tabel voor (MPXJ's eigen omissie — geverifieerd: afwezig uit `getDefaultAssignmentData()`,
   *  maar wél aanwezig in `org.mpxj.common.MPPAssignmentField`'s omgekeerde index, dat typewaarde
   *  51→`RAW_TIMEPHASED_ACTUAL_OVERTIME_WORK` en 87→`TIMEPHASED_ACTUAL_IRREGULAR_WORK` bevestigt).
   *  Onschadelijk hier: `useTypeAsVarDataKey` is altijd `true`, dus een data-gedreven field map
   *  (het normale pad, elk bestand in dit corpus draagt er een) levert deze twee sowieso via
   *  dezelfde `typeValue`-route als 49/50 — alleen de RUWE `DEFAULT_ASSIGNMENT_FIELDS`-terugval
   *  hieronder (het zeldzame "Props mist de field-map-key volledig"-pad) had ze zonder deze
   *  toevoeging gemist; nu symmetrisch met de andere twee. */
  RemainingRegularWork: 49,
  ActualRegularWork: 50,
  ActualOvertimeWork: 51,
  ActualIrregularWork: 87,
} as const;

/** T7-kwaliteitsreview (M6): geëxporteerd, zelfde reden als `DEFAULT_RESOURCE_FIELDS` hierboven. */
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

/** Z2 — Fixed2Data-byte-offset (BLOK 1) voor `fieldId`, of `null` als het veld niet in BLOK 1 leeft
 *  (of helemaal niet in de tabel voorkomt). Spiegelt `fixedOffsetOf` hierboven exact, alleen voor
 *  de andere locatie — zie `FieldEntry`'s toelichting voor waarom dit een aparte accessor is
 *  i.p.v. één functie met een blok-parameter (`'fixed'`/`'fixed2'` zijn twee fysiek gescheiden
 *  records, een verwarde aanroep tussen de twee accessors kan dus nooit per ongeluk de verkeerde
 *  offset tegen het verkeerde blok opleveren — een typefout zou een compile-fout geven, geen
 *  stille misslag). */
export function fixed2OffsetOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'fixed2' && entry.fixedOffset !== undefined ? entry.fixedOffset : null;
}

/** Var-data-sleutel voor `fieldId`, of `null` als het veld niet in VAR_DATA leeft. */
export function varDataKeyOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'var' && entry.varDataKey !== undefined ? entry.varDataKey : null;
}
