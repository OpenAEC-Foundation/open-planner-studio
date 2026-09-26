/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Entry point: `readMPP(bytes, labels) → ImportResult`. Flow: CfbFile → assertReadable
 * (formaatdetectie + wachtwoordpoort) → Props (projecteigenschappen, `"   114"/Props`) →
 * FieldMap14 → kalenders uit `"   114"/TBkndCal` (`mppCalendars.ts`) → taken uit
 * `"   114"/TBkndTask` (FixedMeta/FixedData + VarMeta/Var2Data, leesvolgorde van
 * `MPP14Reader.processTaskData`) → relaties uit `"   114"/TBkndCons` (LET OP: MPP-jargon voor
 * RELATIES, niet datumconstraints), resources uit `TBkndRsc` en assignments uit `TBkndAssn`
 * (`mppEntities.ts`).
 *
 * Veldsemantiek is gespiegeld aan `readMSPDI` (mspdiReader.ts) — zelfde afronding voor duur,
 * dezelfde constrainttype-codes (`mspCodeToConstraint`), dezelfde progress-normalisatie
 * (`normalizeImportedProgress`).
 *
 * UURMODUS: dezelfde (c)-discriminator-orkestratie als `mspdiReader.ts` (zie `@/services/subdayIo`).
 * Een kalender promoveert naar uur-modus zodra ze zelf afwijkt ((a)/(b): meerdere banden per
 * werkdag, of een band over middernacht) ÓF minstens één taak op die kalender een (c)-signaal draagt
 * (sub-dag-duur `isSubDayMinutes`, of een Start/Finish die van het kalender-eigen anker afwijkt,
 * `hasNonAnchorTime`/`mppAnchorClock`). Promotie (`promoteCalendarsForHourMode`) kan pas ná een
 * volledige taak-scan, dus `readTasks` doet drie passes: (A) ruwe scan zonder `Task`-object,
 * (B) signaalverzameling + promotie, (C) de `Task`-objecten met de dag/uur-beslissing per taak. In
 * uur-modus komt `durationMinutes` uit de rauwe tienden-van-minuten-duur, behouden datums hun
 * tijdcomponent (`formatInstant(..., 'hour')`) en krijgt `TBkndCons`-lag naar een uur-opvolger
 * `lagMinutes` (`mppLagToSequenceFields`). Dag-modus-bestanden doorlopen dezelfde code met
 * `isHour=false`.
 *
 * PARITEIT MET MSPDI geldt alleen bij `workStartHour === 8`: MSPDI's anker is een vaste 08:00, deze
 * lezer gebruikt het kalender-eigen startuur (zie `mppAnchorClock`). Bij een ander startuur
 * divergeren de lezers op een taak die precies op dat startuur landt (gepind in
 * `check-mpp-import.ts`, "ankerdivergentie").
 *
 * TWEE ASYMMETRISCHE REKENPADEN (bewust):
 *  - `scheduleDuration`: het UUR-pad rekent op de `hoursPerDay` van de effectieve taakkalender
 *    (`effHpd`, ná promotie); het DAG-pad op de projectbrede `hoursPerDay` (Props/MINUTES_PER_DAY,
 *    of 8u), ook als de taak een kalender-override met een ander `hoursPerDay` draagt.
 *  - `Sequence.lagMinutes`: een relatie naar een uur-opvolger krijgt altijd `lagMinutes`, ook `0`
 *    (spiegelt mspdiReader's `taskHourById`-tak). Dat verandert de serialisatievorm t.o.v. een
 *    relatie zonder het veld; geaccepteerd.
 *
 * HIËRARCHIE: MPXJ vult `PARENT_TASK_UNIQUE_ID` wel, maar `ProjectFile.updateStructure()` bouwt de
 * boom uit de taken gesorteerd op ID, met het outline-level als enige dieptesignaal. Deze lezer
 * doet precies dat (outline-level-stack); in het corpus is het veld 100% consistent met de stack.
 *
 * Afwijkingen tegen de MSPDI-ground-truth in het corpus komen doordat de `.mpp.xml`-bestanden een
 * andere documentrevisie zijn dan de `.mpp`'s (hernummerde UID's, verplaatste taken, afwijkende
 * projectstart) — niet te overbruggen door een lezer; zie de per-veld-budgetten in
 * `check-mpp-import.ts`.
 *
 * Twee MPXJ-kwaliteitsfilters zijn niet geport: `createTaskMap` eist ook (a) een niet-`null`
 * `Fixed2Data`-record en (b) een FixedData-recordlengte van minstens 75% van
 * `fieldMap.getMaxFixedDataSize(0)` (maximum over álle ~100 taakvelden, met onze veldenlijst niet
 * betrouwbaar te berekenen). De eenvoudiger validatie in `collectValidTaskIndices` haalt
 * taakaantal-pariteit op alle ground-truth-bestanden; wijkt een telling ooit af, port dan deze filters.
 */
import type { Project } from '@/types/project';
import type {
  Task, TaskConstraint, TaskSplitGap, MspTaskType, TaskTimephasedContour, TimephasedContourPeriod,
} from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceType } from '@/types/resource';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';
import { normalizeImportedProgress, deriveImportedWorkRules, reconstructResourceIds } from '@/services/importNormalize';
import { emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { tenthsOfMinutesToDays } from '@/services/importDurations';
import { mspCodeToConstraint } from '@/services/msproject/mspdiReader';
import { statusDateFromXml, toXmlDateTime } from '@/services/xmlInterchange';
import { hasNonAnchorTime, isSubDayMinutes, milestoneKindAt } from '@/services/subdayIo';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { CfbFile } from './cfb';
import { assertReadable, detectApplicationVersion, Props } from './mppContainer';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12,
  getInt, getShort, getTimestamp, getUnicodeString, getDurationTimeUnits,
} from './mppPrimitives';
import {
  TaskFieldId, AssignmentFieldId,
  createAssignmentFieldMap, createResourceFieldMap, createTaskFieldMap,
  fixedOffsetOf, fixed2OffsetOf, varDataKeyOf, type FieldMapTable,
} from './fieldMap14';
import { readCalendars, promoteCalendarsForHourMode, type CalendarReadResult } from './mppCalendars';
import { MAX_VAR_TEXT_BYTES, clampRemainingDurationTenths, clampManualDurationTenths, clampLevelingDelayTenths } from './limits';
import { readRelations, readResources, readAssignments, readAssignmentTimephasedRaw } from './mppEntities';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { buildRecordedTime, leafRecordedTimes, recordedFloatDays, type RecordedTime } from '@/engine/scheduler/recordedDates';
import {
  decodeRegularTimephasedWork, decodePlannedRegularTimephasedWork,
  deriveSplitGapsFromPeriods, deriveTaskSplitGaps, shiftPeriods, hasAnyTimephasedData,
  type AssignmentTimephasedRaw, type TimephasedWorkPeriod,
} from './mppTimephased';

// ── PropsKey-sleutels voor projecteigenschappen (PropsKey.java; gelezen uit `"   114"/Props`,
// NIET uit de root-`Props14`-stream — die draagt alleen de wachtwoordvlag, zie mppContainer.ts). ──
const PROPS_KEY_TITLE = 37748744;
const PROPS_KEY_PROJECT_START_DATE = 37748738;
const PROPS_KEY_PROJECT_FINISH_DATE = 37748739;
const PROPS_KEY_STATUS_DATE = 37748805;
const PROPS_KEY_MINUTES_PER_DAY = 37748765;
/** PropsKey CRITICAL_SLACK_LIMIT — MPXJ `ProjectPropertiesReader`: `props.getInt(...)` in dagen. */
const PROPS_KEY_CRITICAL_SLACK_LIMIT = 37748756;
/** MSP's instelling loopt in de UI tot een paar duizend dagen; een waarde daarbuiten is een corrupt
 *  of vijandig veld en valt terug op de MSP-default 0 (alleen een vergelijkingsgrens, geen
 *  allocatie). */
const MAX_CRITICAL_SLACK_LIMIT_DAYS = 36500;

/**
 * Totale speling (tienden van een minuut) zoals MPXJ hem voor een `.mpp` afleidt — MPP14 slaat geen
 * eigen TOTAL_SLACK op. Gestarte taak ⇒ de finish slack (ontbreekt die, dan GEEN speling). Anders het
 * minimum van beide; ontbreekt er één, dan GEEN speling — exact MPXJ
 * `MicrosoftSlackCalculator.calculateTotalSlack`. `null` = niet vastgelegd.
 */
export function mppTotalSlackTenths(started: boolean, startSlack: number | null, finishSlack: number | null): number | null {
  if (started) return finishSlack;
  if (startSlack === null || finishSlack === null) return null;
  return Math.min(startSlack, finishSlack);
}

/** De kritiekgrens (dagen) uit de projecteigenschappen; ontbrekend of onzinnig ⇒ 0. */
export function criticalSlackLimitDaysOf(props: { getInt(key: number): number }): number {
  const days = props.getInt(PROPS_KEY_CRITICAL_SLACK_LIMIT);
  return Number.isInteger(days) && Math.abs(days) <= MAX_CRITICAL_SLACK_LIMIT_DAYS ? days : 0;
}

/** TBkndTask/FixedMeta-itemgrootte (MPP14Reader.java r. 993: `new FixedMeta(..., 47)`). */
const TASK_FIXED_META_ITEM_SIZE = 47;
/** TBkndTask/Fixed2Meta-itemgrootte-KANDIDATEN (MPP14Reader.java: `new FixedMeta(stream,
 *  taskFixedData, 92, 93, 94, 95, 96)` — de heuristische variant, `FixedMeta.withHeuristicItemSize`). */
const TASK_FIXED2_META_ITEM_SIZES = [92, 93, 94, 95, 96];
/** Fixed-data-blokken kleiner dan dit zijn "null-taak"-plaatshouders (verwijderde/vrijgemaakte
 *  unique-ID's die geen echte taak dragen) — MPP14Reader.java's `NULL_TASK_BLOCK_SIZE`. */
const NULL_TASK_BLOCK_SIZE = 16;
/** Bit 0x02 in de eerste 4 bytes van een FixedMeta-item markeert een verwijderde taak
 *  (`createTaskMap`'s `flags & 0x02`-check). */
const DELETED_TASK_FLAG = 0x02;
/** De eerste drie FixedData-slots zijn geen taken (MPP14Reader.java's `createTaskMap`: "First
 *  three items are not tasks, so let's skip them"). */
const FIRST_TASK_INDEX = 3;

/**
 * Klem op het RUWE outline-level (SHORT, 0..65535). Dat veld stuurt zowel de stackdiepte in
 * `assignHierarchyAndWbs` als de lengte van de gegenereerde WBS-string (één segment per niveau);
 * ongeklemd geeft een geprepareerd bestand met strikt oplopende niveaus O(N²) WBS-tekst (20.000
 * niveaus ≈ 461 MB piekgeheugen). 256 ligt ruim boven elke realistische WBS-diepte; dieper
 * genummerde taken worden siblings op de klemdiepte i.p.v. eindeloos te nesten.
 */
export const MAX_OUTLINE_LEVEL = 256;

/** Klemt een ruw outline-level naar `[1, MAX_OUTLINE_LEVEL]`. Geëxporteerd zodat
 *  `check-mpp-import.ts` de grenzen zonder CFB-bestand kan testen. */
export function clampOutlineLevel(raw: number): number {
  return Math.min(Math.max(raw, 1), MAX_OUTLINE_LEVEL);
}

/*
 * `MAX_VAR_TEXT_BYTES` (limits.ts): var-data-tekst (taaknaam, WBS-tekst) kan door meerdere
 * unique-ID's naar dezelfde gedeelde Var2Data-offset wijzen; zonder bovengrens kost uitlezen
 * O(N × S). Geef de grens aan élke `getUnicodeString`-aanroep hieronder mee: dat de callsites hem
 * gebruiken is niet end-to-end getest (een >64 KiB-stream past niet door de fixturebouwer).
 */

/** Gedeelde 2010-vs-2013+-versiegrens (`applicationVersion <= PROJECT_2010(14)`) voor élke
 *  bit-flag-tabelkeuze in dit bestand. MPXJ onderscheidt 2010/2013/2016, maar 2013 en 2016 delen
 *  voor elk hier gebruikt bit dezelfde offset/mask. */
function isLegacyBitFlagVersion(applicationVersion: number | null): boolean {
  return (applicationVersion ?? 0) <= 14; // MPXJ: NumberHelper.getInt(null) === 0
}

/** Milestone-vlag: `MppBitFlag(TaskField.MILESTONE, offset, mask, ...)` uit MPP14Reader.java's
 *  `PROJECT20xx_TASK_META_DATA_BIT_FLAGS`-tabellen. Een ONBEKENDE versie (`null`) valt terug op de
 *  2010-tabel, net als MPXJ (`NumberHelper.getInt(null) === 0`, en `0 <= PROJECT_2010`). */
function milestoneBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x20 } // PROJECT2010_TASK_META_DATA_BIT_FLAGS
    : { offset: 10, mask: 0x02 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA_BIT_FLAGS
}

/** TASK_MODE-bit (MANUALLY_SCHEDULED vs. AUTO_SCHEDULED), gelezen uit de taak-eigen `Fixed2Meta`
 *  (NIET `FixedMeta`). `MPP14Reader.java`: `PROJECT2010_TASK_META_DATA2_BIT_FLAGS` (offset 8,
 *  masker 0x08) vs. `PROJECT2013_/PROJECT2016_TASK_META_DATA2_BIT_FLAGS` (beide offset 8, masker 0x80). */
function taskModeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x08 } // PROJECT2010_TASK_META_DATA2_BIT_FLAGS
    : { offset: 8, mask: 0x80 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA2_BIT_FLAGS
}

/** EFFORT_DRIVEN-bit, zelfde FixedMeta-tabel als `milestoneBitFlag` (NIET de `_META_DATA2_`-tabel
 *  van `taskModeBitFlag`). `MPP14Reader.java`: `new MppBitFlag(TaskField.EFFORT_DRIVEN, 11, 0x10, ...)`
 *  op de 2010-tabel, `(..., 13, 0x08, ...)` op 2013/2016. `Task.effortDriven` voedt de
 *  werkregel-afleiding (`workRuleFromMsp`). */
function effortDrivenBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 11, mask: 0x10 } // PROJECT2010_TASK_META_DATA_BIT_FLAGS
    : { offset: 13, mask: 0x08 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA_BIT_FLAGS
}

/** Spiegelt MPXJ's `TaskTypeHelper.getInstance(int)`: 0/1/2 → FIXED_UNITS/FIXED_DURATION/FIXED_WORK,
 *  elke andere waarde → FIXED_WORK (MPXJ's terugval; ordinal 3 `FIXED_DURATION_AND_UNITS` komt in de
 *  .mpp-bytelaag niet voor). `raw === null` (veld ontbreekt of record te kort) ⇒ geen Task-veld: de
 *  terugval geldt alleen voor een aanwezige maar ongeldige waarde. Geëxporteerd voor
 *  `check-mpp-import.ts`. */
const MSP_TASK_TYPE_VALUES: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];
export function mspTaskTypeFromRaw(raw: number | null): MspTaskType | undefined {
  if (raw === null) return undefined;
  return MSP_TASK_TYPE_VALUES[raw] ?? 'FIXED_WORK';
}

/** MPXJ's `MPP14Reader.java`-overschrijfregel: `SCHEDULED_START`/`SCHEDULED_FINISH` (35/36)
 *  overschrijven het opgeslagen `START`/`FINISH` (1283/1284) alleen als dat manual-veldpaar leeg is,
 *  óf de taak AUTO_SCHEDULED is. Een MANUALLY_SCHEDULED-taak moet in `scheduleStart`/`scheduleFinish`
 *  dus het manual-paar dragen, want de forwardPass bevriest dat anker rauw.
 *
 *  BEWUST GEDUPLICEERD uit `tests/planning/mppGroundTruth.ts`'s `resolveScheduleField`, geen import:
 *  die meetlat moet een bug hier kunnen ontmaskeren, niet delen. Houd parameternamen en de exacte
 *  boolean-uitdrukking identiek. In het corpus verschilt 1283/1284 van 35/36 bij 261 manual-taken
 *  in 15 bestanden. */
function resolveScheduleField(manual: Date | null, scheduled: Date | null, isManual: boolean): Date | null {
  const overrideWithScheduled = manual === null || (scheduled !== null && !isManual);
  return overrideWithScheduled ? scheduled : manual;
}

interface RawTaskRecord {
  uniqueId: number;
  id: number;
  /** Al geklemd via `clampOutlineLevel` — nooit de rauwe SHORT-waarde. */
  outlineLevel: number;
  /** Expliciet door de gebruiker ingevoerde WBS-tekst, `null` als afwezig (het gebruikelijke geval:
   *  MPP slaat een auto-WBS niet op) — dan genereert `assignHierarchyAndWbs` de code, net als MPXJ's
   *  `updateStructure()`. */
  storedWbs: string | null;
  task: Task;
}

/** Structurele ondergrens voor `assignHierarchyAndWbs` — bewust niet de volledige `Task`, zodat een
 *  test duizenden lichte fixture-objecten kan bouwen. */
interface HierarchyTaskLike {
  id: string;
  parentId: string | null;
  childIds: string[];
  wbsCode: string;
}

/**
 * Hiërarchie via een outline-level-stack over de taken GESORTEERD OP ID — letterlijk MPXJ's
 * `updateStructure()` (zie de moduleheader). Genereert tegelijk de WBS-code als outline-nummering
 * ("1", "1.1", "1.2.1", …), want MPP slaat een auto-WBS niet op; een expliciet ingevoerde WBS-tekst
 * wint. Verwacht `entries` al gesorteerd op `id`; muteert `entries[i].task` in-place. Geëxporteerd
 * zodat `check-mpp-import.ts` de outline-klem met lichte fixtures kan testen.
 */
export function assignHierarchyAndWbs<T extends HierarchyTaskLike>(
  entries: { outlineLevel: number; storedWbs: string | null; task: T }[],
): void {
  const stack: { task: T; wbs: string; level: number; childCount: number }[] = [];
  let rootCount = 0;
  for (const rec of entries) {
    while (stack.length > 0 && stack[stack.length - 1].level >= rec.outlineLevel) stack.pop();
    const parent = stack[stack.length - 1];
    let generatedWbs: string;
    if (parent) {
      parent.childCount++;
      generatedWbs = `${parent.wbs}.${parent.childCount}`;
      rec.task.parentId = parent.task.id;
      parent.task.childIds.push(rec.task.id);
    } else {
      rootCount++;
      generatedWbs = `${rootCount}`;
    }
    rec.task.wbsCode = rec.storedWbs || generatedWbs;
    stack.push({ task: rec.task, wbs: generatedWbs, level: rec.outlineLevel, childCount: 0 });
  }
}

/** Poort van `MPP14Reader.processTaskData`'s `createTaskMap`, vereenvoudigd tot een
 *  `uniqueID → FixedData-index`-tabel zonder verwijderde/null-/spooktaken (KRITIEK voor
 *  taakaantal-pariteit met MS Project). Java itereert achterwaarts en voegt alleen toe als de sleutel
 *  nog niet bestaat (hoogste index wint); hier voorwaarts met overschrijven — zelfde resultaat. */
function collectValidTaskIndices(fixedMeta: FixedMeta, fixedData: FixedData, varMeta: VarMeta12, uniqueIdOffset: number): Map<number, number> {
  const itemCount = fixedMeta.getAdjustedItemCount();
  const validIndexByUniqueId = new Map<number, number>();
  const deletedIds = new Set<number>();

  for (let index = FIRST_TASK_INDEX; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);
    if (!metaItem || metaItem.length < 4) continue;

    const flags = getInt(metaItem, 0, 'TBkndTask/FixedMeta-flags');
    if ((flags & DELETED_TASK_FLAG) !== 0) {
      // Verwijderde-taak-marker: alleen de unique-ID onthouden (voor de spooktaak-check
      // hieronder) — MPP14Reader.java leest 'm hier als SHORT ("Only a short stored for deleted
      // tasks?"), niet als de gebruikelijke INT.
      if (data.length >= 2) deletedIds.add(getShort(data, 0, 'TBkndTask/FixedData deleted-uid'));
      continue;
    }
    // Null-taak-plaatshouder: MPXJ voegt deze wél toe (`task.setNull(true)`) om ID-continuïteit te
    // bewaren, maar hij is nooit zichtbaar in de UI of een XML-export, dus hier overgeslagen. Dit
    // verklaart ID-gaten in een rauwe TBkndTask/FixedData-dump.
    if (data.length === NULL_TASK_BLOCK_SIZE) continue;

    if (data.length < uniqueIdOffset + 4) continue;
    const uniqueId = getInt(data, uniqueIdOffset, 'TBkndTask/FixedData uniqueId');
    validIndexByUniqueId.set(uniqueId, index); // latere/hogere index wint
  }

  // Spooktaak-check (MPP14Reader.java): een unique-ID die zowel als verwijderd gemarkeerd staat
  // ALS een normaal record heeft, telt alleen mee als er var-data voor bestaat.
  for (const uid of deletedIds) {
    if (validIndexByUniqueId.has(uid) && !varMeta.containsKey(uid)) {
      validIndexByUniqueId.delete(uid);
    }
  }

  return validIndexByUniqueId;
}

/** Percent complete: SHORT, 0..100 direct (MPPUtility.getPercentage) — buiten dat bereik ⇒ 0
 *  (spiegelt de Java-bron: een ongeldige waarde levert daar `null`, hier de neutrale 0). */
function readPercentComplete(data: Uint8Array, offset: number | null): number {
  if (offset === null || data.length < offset + 2) return 0;
  const raw = getShort(data, offset, 'TBkndTask percentComplete');
  return raw >= 0 && raw <= 100 ? raw : 0;
}

/** Rauwe timestamp (Date, tijdcomponent behouden). De dag/uur-beslissing valt pas ná de signaal-scan
 *  (Fase B), dus Fase A bewaart de rauwe `Date`; Fase C formatteert met `formatDate` (dag) of
 *  `formatInstant(...,'hour')` (uur). */
function readTimestampField(data: Uint8Array, offset: number | null, ctx: string): Date | null {
  if (offset === null || data.length < offset + 4) return null;
  return getTimestamp(data, offset, ctx);
}

/**
 * Synthetisch anker voor datumdiscriminator (c): het kalender-eigen startuur (`workStartHour`, de nog
 * niet-gepromoveerde, uit de eerste band afgeleide waarde), niet mspdiReader's vaste `08:00`. Een
 * rauwe MPP-timestamp kent geen "date-only vs. echte tijd"-schrijfkeuze, dus de juiste vraag is "wijkt
 * de tijd af van het dagbegin van déze kalender". Gevolg: bij `workStartHour !== 8` divergeert deze
 * lezer van `readMSPDI` op een taak die precies op het startuur landt (gepind in
 * `check-mpp-import.ts`, "ankerdivergentie").
 *
 * GRANULARITEIT: het anker is een heel uur. Een kalender die om een half uur begint (07:30) krijgt
 * anker 07:00, waardoor `hasNonAnchorTime` voor élke taak op die kalender vuurt. Meestal gemaskeerd
 * (zo'n kalender promoveert doorgaans al via haar banden), maar een verder "ronde" half-uurkalender
 * belandt zo altijd in uur-modus — bekende, ongeteste rand.
 */
function mppAnchorClock(cal: WorkCalendar): string {
  return `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
}

/*
 * Detectie voor de eenmalige openingsmelding ("dit bestand bevat N taken met een onderbroken,
 * genivelleerde of resource-gedreven planning", `fileSlice.ts`). Zulke taken rekenen we wél door
 * zoals MS Project; de melding is puur informatief. Geen taakveld, alleen een telling op
 * `ImportResult`. Drie signalen, één per woord in de meldingstekst:
 *
 * 1. `leveled` — `Task.levelingDelayMinutes` gezet (`TaskField.LEVELING_DELAY` ≠ 0; FieldMap14.java:
 *    `new FieldItem(TaskField.LEVELING_DELAY, FieldLocation.FIXED_DATA, 0, 58, 20, 0, 0)`).
 * 2. `split` — `Task.splitGaps` niet-leeg, afgeleid uit de timephased-werksegmenten van de
 *    toewijzingen (`mppTimephased.ts`; MPXJ: `ResourceAssignment.getWorkSplits()`).
 * 3. `timephased` — `Task.timephasedFinishFloor` of `timephasedDurationWalks` gezet: een toewijzing
 *    met een echt gedecodeerde timephased-periode bepaalt het venster of de herberekening.
 *
 * Resource-contouring wordt bewust NIET via MPXJ's `AssignmentField.WORK_CONTOUR`-bit gedetecteerd
 * (`ResourceAssignmentFactory.java`: `new MppBitFlag(AssignmentField.WORK_CONTOUR, 8, 0x00000010,
 * WorkContour.FLAT, WorkContour.CONTOURED)` voor ≤2010, masker `0x00040000` voor 2013+; staat niet in
 * `FieldMap14.java`'s veldentabel). Getoetst op MPXJ's eigen `mpxj/junit/data/mpp14resource.mpp`
 * (taak "Contoured Task", assignment-UID 8; `mspdiresource.xml` geeft `<WorkContour>7</WorkContour>`):
 * een brute-force-scan van het 34-byte FixedMeta-record vond geen enkele bitpositie die alleen voor
 * die assignment aan staat — het bit is niet betrouwbaar. Signaal 3 vangt die taak wél, via de
 * gedecodeerde periode.
 */

/** Telt de drie signalen (zie hierboven) op reeds gevulde `Task`-objecten voor
 *  `ImportResult.sourceScheduleNotes`. Moet in `readMPP` NÁ de `splitGaps`- én de
 *  `timephasedFinishFloor`/`timephasedDurationWalks`-lus draaien (beide muteren `tasks` in-place),
 *  anders zijn `split`/`timephased` altijd 0. */
export function countScheduleNotes(
  tasks: readonly Task[],
): { total: number; leveled: number; split: number; timephased: number } {
  let leveled = 0, split = 0, timephased = 0, total = 0;
  for (const task of tasks) {
    const isLeveled = task.levelingDelayMinutes != null;
    const isSplit = (task.splitGaps?.length ?? 0) > 0;
    const isTimephased = task.timephasedFinishFloor != null || task.timephasedDurationWalks != null;
    if (isLeveled) leveled++;
    if (isSplit) split++;
    if (isTimephased) timephased++;
    if (isLeveled || isSplit || isTimephased) total++;
  }
  return { total, leveled, split, timephased };
}

/** Invoer voor `readTasks`. `calResult` zijn de kalenders van `readCalendars`, nog NIET gepromoveerd
 *  (zie mppCalendars.ts) — daarom leest `readMPP` kalenders vóór taken, net als mspdiReader.
 *  Geëxporteerd (met `readTasks`/`parseProjectProperties`) zodat `check-mpp-import.ts`
 *  `ReadTasksResult.rawScans` direct kan inspecteren. */
export interface ReadTasksContext {
  cfb: CfbFile;
  taskFieldMap: FieldMapTable;
  hoursPerDay: number;
  statusDate: string | undefined;
  applicationVersion: number | null;
  calResult: CalendarReadResult;
  /** Projectstart uit de Props (leeg/weggelaten ⇒ niet in het bestand): anker voor taken zonder
   *  ScheduledStart (`resolveMissingScheduleDates`). Optioneel zodat bestaande testaanroepers
   *  ongewijzigd blijven. */
  projectStart?: string;
  /** "Datums zoals opgeslagen": MSP's kritiekgrens ("taken zijn kritiek als de speling kleiner of
   *  gelijk is aan N dagen", PropsKey CRITICAL_SLACK_LIMIT) in dagen. Afwezig ⇒ 0 (MSP-default). */
  criticalSlackLimitDays?: number;
}

/** - `taskIdByUniqueId`: TBkndCons-relaties en TBkndAssn-assignments verwijzen naar taken via hun
 *    MPP-uniqueID; dit is de vertaling naar `Task.id` (spiegelt mspdiReader's `uidToId`).
 *  - `taskHourById`: per taak of ze in uur-modus is — `readRelations` kiest daarmee de lag-eenheid
 *    (spiegelt mspdiReader's `taskHourById`). */
export interface ReadTasksResult {
  tasks: Task[];
  taskIdByUniqueId: Map<number, string>;
  taskHourById: Map<string, boolean>;
  /** TEST-/METINGSVELD: de rauwe Fase-A-scan van elke geldige taak. `readMPP` geeft dit niet door
   *  aan `ImportResult`; alleen voor `check-mpp-import.ts`. */
  rawScans: readonly RawTaskScan[];
  /** Projectstart-anker dat `resolveMissingScheduleDates` gebruikte (voor `readMPP` wanneer de Props
   *  geen projectstart droegen). */
  startAnchor: string;
  /** "Datums zoals opgeslagen": MSP's eigen rekenuitvoer per taak-id, weergavekanaal — `readMPP`
   *  geeft dit als `ImportResult.recordedTimes` door. */
  recordedTimes: Record<string, RecordedTime>;
}

/** Fase A — rauwe scan: alle velden die `readTasks` nodig heeft, als getal/`Date`/string, NOG GEEN
 *  `Task`-object. Kalender-/dag-of-uur-modus-afhankelijke velden (start/finish/duur/actuals/
 *  constraintdatum/deadline) staan hier als rauwe waarde; Fase C formatteert ze pas, ná Fase B's
 *  signaal-scan + promotie. `effCal` is de EFFECTIEVE kalender (taak-override, anders de
 *  projectkalender) — al hier bepaald zodat Fase B er direct het (c)-signaal aan kan toekennen. */
export interface RawTaskScan {
  uniqueId: number;
  id: number;
  outlineLevel: number;
  storedWbs: string | null;
  name: string;
  startTs: Date | null;
  finishTs: Date | null;
  durationRaw: number; // tienden van een minuut
  /** DurationUnits (veld-id 181, ACTUAL_DURATION_UNITS — de eenhedenbron voor SCHEDULED_DURATION, zie
   *  `TaskFieldId.DurationUnits`) gedecodeerd tot "is dit een ELAPSED-eenheid"
   *  (elapsedMinutes/Hours/Days/Weeks/Months/Percent). Ontbreekt het veld, dan `false` (WORKTIME). */
  isElapsedDuration: boolean;
  /** Rauwe REMAINING_DURATION (tienden van een minuut, zelfde eenheid + eenhedenbron als
   *  `durationRaw`). `null` als het veld ontbreekt of het record te kort is — Fase C laat
   *  `remainingMinutes`/`remainingTime` dan ongezet; `normalizeImportedProgress` leidt ze bij een
   *  taak met voortgang af uit `completion`. */
  remainingDurationRaw: number | null;
  /** Rauwe LEVELING_DELAY (tienden van een minuut), geklemd (`clampLevelingDelayTenths`, limits.ts)
   *  omdat Fase C hem als duur decodeert (`Task.levelingDelayMinutes`). `0` als het veld ontbreekt. */
  levelingDelayRaw: number;
  /** Eenheid/elapsed-vlag RUW (SHORT, veld-id 178, `TaskFieldId.LevelingDelayUnits`) bij
   *  `levelingDelayRaw`; Fase C decodeert dit tot `Task.levelingDelayElapsed`. `null` als het veld
   *  ontbreekt of het record te kort is ⇒ `levelingDelayElapsed` ongezet (WORKTIME-default). */
  levelingDelayUnits: number | null;
  /** TASK_MODE (Fixed2Meta-bit, zie `taskModeBitFlag`). `'AUTO_SCHEDULED'` als het
   *  `Fixed2Meta`-record ontbreekt of te kort is. */
  taskMode: MppTaskMode;
  /** MANUALLY_SCHEDULED-ankerpaar uit Fixed2Data blok 1 (`TaskFieldId.Start`/`Finish`,
   *  1283/1284) — spiegelt `startTs`/`finishTs` hierboven qua vorm (rauwe `Date`, nog niet
   *  geformatteerd), maar uit het ANDERE blok/veldpaar. `null` als de Fixed2-infrastructuur
   *  ontbreekt, het veld niet in de field map staat, of het record te kort is voor deze offset. */
  manualStartTs: Date | null;
  manualFinishTs: Date | null;
  /** "Datums zoals opgeslagen" — MSP's eigen rekenuitvoer, rauw:
   *  `null` bij een ontbrekend veld in de veldkaart of een leeg record. Slack in tienden van een
   *  minuut (zelfde eenheid als `durationRaw`, eenhedenbron ACTUAL_DURATION_UNITS). Alleen het
   *  weergavekanaal `ImportResult.recordedTimes` leest dit; `task.time` nooit. */
  earlyStartTs: Date | null;
  earlyFinishTs: Date | null;
  lateStartTs: Date | null;
  lateFinishTs: Date | null;
  freeSlackRaw: number | null;
  startSlackRaw: number | null;
  finishSlackRaw: number | null;
  /** Rauwe MANUAL_DURATION (Fixed2Data blok 1, offset 58, veld-id 1288, tienden van een minuut,
   *  geklemd via `clampManualDurationTenths`). `null` bij ontbrekend veld/te kort record. */
  manualDurationRaw: number | null;
  /** Eenheid van `manualDurationRaw` (`TaskFieldId.ManualDurationUnits`, 1289), gedecodeerd tot "is
   *  dit een ELAPSED-eenheid" zoals `isElapsedDuration`. `false` als het eenhedenveld ontbreekt. */
  manualDurationIsElapsed: boolean;
  isMilestone: boolean;
  constraintCode: number | null;
  constraintDateTs: Date | null;
  deadlineTs: Date | null;
  percentComplete: number;
  actualStartTs: Date | null;
  actualFinishTs: Date | null;
  /** `TaskField.RESUME`/`STOP` (veld-id 99/100, `DataType.DATE`, blok 0): MSP's opgeslagen
   *  hervattingsinstant/afgewerkt-grens voor een lopende taak. `null` bij ontbrekend veld/te kort
   *  record. */
  resumeTs: Date | null;
  stopTs: Date | null;
  effCal: WorkCalendar;
  /** Alleen gezet als de taak een echte, gevonden kalender-override droeg (`calendarUniqueIdRaw >= 0`
   *  én verwijzend naar een gelezen kalender) — bepaalt of Fase C `Task.calendarId` zet. */
  calendarOverride: WorkCalendar | null;
  /** Rauwe `TaskField.TYPE` (SHORT), `null` bij
   *  ontbrekend veld/te kort record. Fase C decodeert dit via `mspTaskTypeFromRaw`. */
  mspTaskTypeRaw: number | null;
  /** Rauwe EFFORT_DRIVEN-bit, al gedecodeerd tot boolean (zoals `isMilestone`). */
  effortDrivenRaw: boolean;
}

/** Spiegelt MPXJ's `TaskMode`-enum letterlijk. */
type MppTaskMode = 'AUTO_SCHEDULED' | 'MANUALLY_SCHEDULED';

export function readTasks(ctx: ReadTasksContext): ReadTasksResult {
  const { cfb, taskFieldMap, hoursPerDay, statusDate, applicationVersion, calResult } = ctx;
  const missingDates = emptyMissingScheduleDates();
  const criticalSlackLimitDays = ctx.criticalSlackLimitDays ?? 0;
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    throw new Error('MPP: "   114"/TBkndTask mist een vereiste stream (FixedMeta/FixedData/VarMeta)');
  }
  const var2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Var2Data']); // legitiem afwezig (zie mppPrimitives.ts)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, TASK_FIXED_META_ITEM_SIZE, 'TBkndTask/FixedMeta');
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, 'TBkndTask/FixedData');
  const varMeta = new VarMeta12(varMetaBytes, 'TBkndTask/VarMeta');
  const varData = new Var2Data(varMeta, var2DataBytes);

  // `Fixed2Meta`/`Fixed2Data` zijn optioneel (zelfde defensieve patroon als `TBkndRsc/Fixed2Meta` in
  // mppEntities.ts): ontbreken/onleesbaar ⇒ `null`, en de Fixed2-velden in `RawTaskScan` blijven
  // leeg/AUTO_SCHEDULED. `fixed2Meta` wordt heuristisch gedimensioneerd tegen de itemcount van
  // `fixedData`; alle vier blokken delen dezelfde item-index per taak.
  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Meta']);
  const fixed2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Data']);
  let fixed2Meta: FixedMeta | null = null;
  let fixed2Data: FixedData | null = null;
  if (fixed2MetaBytes && fixed2DataBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, TASK_FIXED2_META_ITEM_SIZES, 'TBkndTask/Fixed2Meta');
      fixed2Data = FixedData.fromMeta(fixed2Meta, fixed2DataBytes, 0, 0, 'TBkndTask/Fixed2Data');
    } catch {
      fixed2Meta = null;
      fixed2Data = null;
    }
  }

  const uniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.UniqueId);
  const idOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Id);
  const outlineLevelOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.OutlineLevel);
  const scheduledStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledStart);
  const scheduledFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledFinish);
  const durationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledDuration);
  const durationUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.DurationUnits);
  const remainingDurationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.RemainingDuration);
  const constraintTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintType);
  const constraintDateOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintDate);
  const deadlineOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Deadline);
  const percentCompleteOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.PercentComplete);
  const actualStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualStart);
  const actualFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualFinish);
  const resumeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Resume);
  const stopOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Stop);
  const calendarUniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.CalendarUniqueId);
  const levelingDelayOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelay);
  const levelingDelayUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelayUnits);
  // Blok-1-offsets (Fixed2Data): `fixed2OffsetOf`, NIET `fixedOffsetOf` — blok 0 en blok 1 zijn
  // fysiek gescheiden records.
  const manualStartOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Start);
  const manualFinishOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Finish);
  const manualDurationOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDuration);
  const manualDurationUnitsOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDurationUnits);
  const nameKey = varDataKeyOf(taskFieldMap, TaskFieldId.Name);
  const wbsKey = varDataKeyOf(taskFieldMap, TaskFieldId.Wbs);
  const mspTaskTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Type);
  // "Datums zoals opgeslagen" — weergavekanaal, zie `TaskFieldId.EarlyStart`.
  const earlyStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.EarlyStart);
  const earlyFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.EarlyFinish);
  const lateStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LateStart);
  const lateFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LateFinish);
  const freeSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.FreeSlack);
  const startSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.StartSlack);
  const finishSlackOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.FinishSlack);
  const slackAt = (data: Uint8Array, offset: number | null, ctx: string): number | null =>
    offset !== null && data.length >= offset + 4 ? getInt(data, offset, ctx) : null;

  // Harde veldmap-check: een taaklijst zonder NAME (var-data) of zonder SCHEDULED_START/FINISH
  // (fixed-data) is geen leesbaar bestand maar een mis-parse (bv. de verkeerde
  // `TASK_FIELD_MAP`/`TASK_FIELD_MAP2`-sleutel) — beter hard falen dan taken zonder naam/datum.
  if (uniqueIdOffset === null || idOffset === null || nameKey === null || scheduledStartOffset === null || scheduledFinishOffset === null) {
    throw new Error('MPP: taak-veldmap mist UNIQUE_ID/ID/NAME/SCHEDULED_START/SCHEDULED_FINISH — kan taken niet betrouwbaar lezen');
  }

  const validIndices = collectValidTaskIndices(fixedMeta, fixedData, varMeta, uniqueIdOffset);
  const { offset: msOffset, mask: msMask } = milestoneBitFlag(applicationVersion);
  const { offset: tmOffset, mask: tmMask } = taskModeBitFlag(applicationVersion);
  const { offset: edOffset, mask: edMask } = effortDrivenBitFlag(applicationVersion);

  // ── Fase A: rauwe scan (zie moduleheader "UURMODUS" + `RawTaskScan`) — nog geen `Task`-object,
  // wél al de effectieve kalender per taak (nodig voor Fase B's signaal-scan). ────────────────────
  const raws: RawTaskScan[] = [];
  for (const [uniqueId, index] of validIndices) {
    if (uniqueId === 0) continue; // projectsamenvattingstaak (net als mspdiReader's uid===0-skip)
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);

    const id = data.length >= idOffset + 4 ? getInt(data, idOffset, 'TBkndTask id') : uniqueId;
    const outlineLevelRaw = outlineLevelOffset !== null && data.length >= outlineLevelOffset + 2
      ? getShort(data, outlineLevelOffset, 'TBkndTask outlineLevel')
      : 1;
    const outlineLevel = clampOutlineLevel(outlineLevelRaw);

    const name = varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, 'TBkndTask name') || 'Task';
    // MPP slaat een AUTO-gegenereerde WBS-code niet op (het var-data-veld is in het corpus altijd
    // leeg); `assignHierarchyAndWbs` genereert hem zoals MPXJ's `updateStructure()`. Hier alleen een
    // EXPLICIET ingevoerde WBS-tekst vasthouden, die dan wint.
    const storedWbs = wbsKey !== null ? varData.getUnicodeString(uniqueId, wbsKey, MAX_VAR_TEXT_BYTES, 'TBkndTask wbs') : null;

    const startTs = readTimestampField(data, scheduledStartOffset, 'TBkndTask scheduledStart');
    const finishTs = readTimestampField(data, scheduledFinishOffset, 'TBkndTask scheduledFinish');

    const durationRaw = durationOffset !== null && data.length >= durationOffset + 4
      ? getInt(data, durationOffset, 'TBkndTask duration')
      : 0;

    // DurationUnits (short) → MppTimeUnit → "is dit een ELAPSED-eenheid" (spiegelt
    // MPPUtility.getDurationTimeUnits + de DataType.DURATION-tak in FieldMap.java's readFixedData,
    // die ACTUAL_DURATION_UNITS als eenhedenbron voor SCHEDULED_DURATION gebruikt). Ontbreekt het
    // veld, dan WORKTIME.
    const durationUnitsRaw = durationUnitsOffset !== null && data.length >= durationUnitsOffset + 2
      ? getShort(data, durationUnitsOffset, 'TBkndTask durationUnits')
      : null;
    const isElapsedDuration = durationUnitsRaw !== null
      && getDurationTimeUnits(durationUnitsRaw).startsWith('elapsed');

    // REMAINING_DURATION — zelfde INT-vorm/eenheid als SCHEDULED_DURATION. `null` bij ontbrekend
    // veld/te kort record (Fase C valt dan terug op afleiding uit `completion`). Geklemd vóór de
    // datumrekenkunde (`clampRemainingDurationTenths`, limits.ts).
    const remainingDurationRaw = remainingDurationOffset !== null && data.length >= remainingDurationOffset + 4
      ? clampRemainingDurationTenths(getInt(data, remainingDurationOffset, 'TBkndTask remainingDuration'))
      : null;

    // LEVELING_DELAY — zelfde INT-vorm als SCHEDULED_DURATION (tienden van een minuut), geklemd
    // (`clampLevelingDelayTenths`, limits.ts). De eenheid ernaast wordt in Fase C gedecodeerd.
    const levelingDelayRaw = levelingDelayOffset !== null && data.length >= levelingDelayOffset + 4
      ? clampLevelingDelayTenths(getInt(data, levelingDelayOffset, 'TBkndTask levelingDelay'))
      : 0;
    const levelingDelayUnits = levelingDelayUnitsOffset !== null && data.length >= levelingDelayUnitsOffset + 2
      ? getShort(data, levelingDelayUnitsOffset, 'TBkndTask levelingDelayUnits')
      : null;

    const isMilestone = !!metaItem && metaItem.length >= msOffset + 4
      && (getInt(metaItem, msOffset, 'TBkndTask milestone-flag') & msMask) !== 0;

    // EFFORT_DRIVEN: zelfde FixedMeta-record als isMilestone (andere regel in dezelfde bit-flag-tabel).
    const effortDrivenRaw = !!metaItem && metaItem.length >= edOffset + 4
      && (getInt(metaItem, edOffset, 'TBkndTask effortDriven-flag') & edMask) !== 0;
    // TYPE (MSP's Task Type), FixedData blok 0, SHORT. `null` bij ontbrekend veld/te kort record —
    // zie mspTaskTypeFromRaw voor "onbekend" vs. "aanwezig maar ongeldig".
    const mspTaskTypeRaw = mspTaskTypeOffset !== null && data.length >= mspTaskTypeOffset + 2
      ? getShort(data, mspTaskTypeOffset, 'TBkndTask type')
      : null;

    // TASK_MODE uit het taak-eigen `Fixed2Meta`-record op dezelfde index als `metaItem`/`data`.
    // Ontbreekt de stream of is het record te kort ⇒ AUTO_SCHEDULED.
    const metaData2 = fixed2Meta?.getByteArrayValue(index) ?? null;
    const taskMode: MppTaskMode = metaData2 && metaData2.length > tmOffset && (metaData2[tmOffset] & tmMask) !== 0
      ? 'MANUALLY_SCHEDULED'
      : 'AUTO_SCHEDULED';

    // MANUALLY_SCHEDULED-ankerpaar + handmatige duur uit het taak-eigen `Fixed2Data`-record (blok 1).
    // `fixed2Record` is `null` als de Fixed2-infrastructuur ontbreekt of het record leeg is; elk veld
    // degradeert dan naar zijn ontbrekend-default, een te kort record geeft `null` (geen
    // out-of-bounds-lees).
    const fixed2Record = fixed2Data?.getByteArrayValue(index) ?? null;
    const manualStartTs = fixed2Record ? readTimestampField(fixed2Record, manualStartOffset, 'TBkndTask/Fixed2Data manualStart') : null;
    const manualFinishTs = fixed2Record ? readTimestampField(fixed2Record, manualFinishOffset, 'TBkndTask/Fixed2Data manualFinish') : null;
    const manualDurationRaw = fixed2Record && manualDurationOffset !== null && fixed2Record.length >= manualDurationOffset + 4
      ? clampManualDurationTenths(getInt(fixed2Record, manualDurationOffset, 'TBkndTask/Fixed2Data manualDuration'))
      : null;
    const manualDurationUnitsRaw = fixed2Record && manualDurationUnitsOffset !== null && fixed2Record.length >= manualDurationUnitsOffset + 2
      ? getShort(fixed2Record, manualDurationUnitsOffset, 'TBkndTask/Fixed2Data manualDurationUnits')
      : null;
    const manualDurationIsElapsed = manualDurationUnitsRaw !== null
      && getDurationTimeUnits(manualDurationUnitsRaw).startsWith('elapsed');

    const constraintCode = constraintTypeOffset !== null && data.length >= constraintTypeOffset + 2
      ? getShort(data, constraintTypeOffset, 'TBkndTask constraintType')
      : null;
    const constraintDateTs = readTimestampField(data, constraintDateOffset, 'TBkndTask constraintDate');
    const deadlineTs = readTimestampField(data, deadlineOffset, 'TBkndTask deadline');
    const percentComplete = readPercentComplete(data, percentCompleteOffset);
    const actualStartTs = readTimestampField(data, actualStartOffset, 'TBkndTask actualStart');
    const actualFinishTs = readTimestampField(data, actualFinishOffset, 'TBkndTask actualFinish');
    const resumeTs = readTimestampField(data, resumeOffset, 'TBkndTask resume');
    const stopTs = readTimestampField(data, stopOffset, 'TBkndTask stop');

    // CALENDAR_UNIQUE_ID: -1 (of ontbrekend veld) = geen taak-kalender-override, spiegelt
    // MPP14Reader.java's `calendarID.intValue() == -1 ⇒ task.setCalendarUniqueID(null)`. `effCal` =
    // de gevonden override, anders de projectkalender (spiegelt mspdiReader's `effCalIdOfUid`);
    // `calendarOverride` alleen als de referentie echt naar een gelezen kalender wees.
    const calendarUniqueIdRaw = calendarUniqueIdOffset !== null && data.length >= calendarUniqueIdOffset + 4
      ? getInt(data, calendarUniqueIdOffset, 'TBkndTask calendarUniqueId')
      : -1;
    const calendarOverride = calendarUniqueIdRaw >= 0 ? (calResult.calendarByUniqueId.get(calendarUniqueIdRaw) ?? null) : null;
    const effCal = calendarOverride ?? calResult.projectCalendar;

    raws.push({
      uniqueId, id, outlineLevel, storedWbs, name, startTs, finishTs, durationRaw, isElapsedDuration,
      remainingDurationRaw, levelingDelayRaw, levelingDelayUnits, taskMode, manualStartTs, manualFinishTs,
      manualDurationRaw, manualDurationIsElapsed, isMilestone, constraintCode, constraintDateTs, deadlineTs,
      percentComplete, actualStartTs, actualFinishTs, resumeTs, stopTs, effCal, calendarOverride,
      mspTaskTypeRaw, effortDrivenRaw,
      earlyStartTs: readTimestampField(data, earlyStartOffset, 'TBkndTask earlyStart'),
      earlyFinishTs: readTimestampField(data, earlyFinishOffset, 'TBkndTask earlyFinish'),
      lateStartTs: readTimestampField(data, lateStartOffset, 'TBkndTask lateStart'),
      lateFinishTs: readTimestampField(data, lateFinishOffset, 'TBkndTask lateFinish'),
      freeSlackRaw: slackAt(data, freeSlackOffset, 'TBkndTask freeSlack'),
      startSlackRaw: slackAt(data, startSlackOffset, 'TBkndTask startSlack'),
      finishSlackRaw: slackAt(data, finishSlackOffset, 'TBkndTask finishSlack'),
    });
  }

  // ── Fase B: (c)-signaal per kalender verzamelen + promoveren (spiegelt mspdiReader's
  // `cSignalCalIds`- en `promoteHourCalendar`-lus). Gebruikt per taak de nog NIET gepromoveerde
  // scalaire `hoursPerDay` van de effectieve kalender, net als mspdiReader. ─────────────────────
  const cSignalCals = new Set<WorkCalendar>();
  for (const raw of raws) {
    const cal = raw.effCal;
    const durMinutes = raw.durationRaw / 10;
    const durSignal = isSubDayMinutes(durMinutes, cal.hoursPerDay);
    const anchor = mppAnchorClock(cal);
    const dateSignal =
      (raw.startTs != null && hasNonAnchorTime(formatInstant(raw.startTs, 'hour'), anchor)) ||
      (raw.finishTs != null && hasNonAnchorTime(formatInstant(raw.finishTs, 'hour'), anchor));
    if (durSignal || dateSignal) cSignalCals.add(cal);
  }
  const hourModeCals = promoteCalendarsForHourMode(calResult.calendarByUniqueId, cSignalCals);

  // ── Fase C: de `Task`-objecten, met de nu bekende dag/uur-beslissing per taak. ─────────────────
  const taskIdByUniqueId = new Map<number, string>();
  const taskHourById = new Map<string, boolean>();
  const records: RawTaskRecord[] = [];
  /** "Datums zoals opgeslagen" — per taak-id MSP's eigen rekenuitvoer (zie `TaskFieldId.EarlyStart`). */
  const recordedTimes: Record<string, RecordedTime> = {};
  for (const raw of raws) {
    const cal = raw.effCal;
    const isHour = hourModeCals.has(cal);
    const effHpd = cal.hoursPerDay;

    // Duur: uur ⇒ minuten (bron van waarheid, geen dag-afronding); dag ⇒ werkdagen op de
    // PROJECT-brede `hoursPerDay` (niet `effHpd`, zie de moduleheader). `durationMinutes` is
    // klok-neutraal (een minuut is een minuut); de solver past ELAPSEDTIME 24/7 toe (`duration.ts`).
    // Beperkingen daar: MSO/MFO-snaps op een ELAPSEDTIME-taak (`CPMSolver.hardPinStart`) en de
    // vrije-speling-eenheid bij een elapsed voorganger (`scheduleAnalysis.ts`).
    const durationMinutes = isHour ? Math.round(raw.durationRaw / 10) : undefined;
    // Valkuil: een ELAPSED-duur ligt in MPP al vast in KLOK-minuten (MPPUtility.getAdjustedDuration's
    // ELAPSED-takken: vaste 24-uursdag, geen minutes-per-day-factor). `tenthsOfMinutesToDays` deelt
    // door `hoursPerDay × 60` (werktijd) en zou dus onterecht een tweede keer door `hoursPerDay`
    // delen; dag-modus + elapsed rekent daarom met de vaste klokdag (24 × 60 × 10 tienden).
    const duration = isHour
      ? (effHpd > 0 ? durationMinutes! / (effHpd * 60) : 0)
      : raw.isElapsedDuration
        ? raw.durationRaw / (24 * 60 * 10)
        : tenthsOfMinutesToDays(raw.durationRaw, hoursPerDay);

    // REMAINING_DURATION rechtstreeks meenemen, met dezelfde eenheden-/elapsed-conversie als
    // `duration`. `null` ⇒ beide ongezet en de solver leidt de rest af uit `completion`. Waarom:
    // MSP's eigen restduur is exact (4 werkdagen = 1920 min), terwijl `completion` afgerond is
    // opgeslagen (33% i.p.v. 33,33…%) — de afleiding zou op een klokstand landen die MSP nooit toont.
    // In DAG-modus overschrijft `normalizeImportedProgress` `remainingTime` alsnog met de afgeleide
    // waarde; `remainingMinutes` (UUR-modus) laat hij staan.
    const remainingMinutes = isHour && raw.remainingDurationRaw !== null
      ? Math.round(raw.remainingDurationRaw / 10)
      : undefined;
    const remainingTime = !isHour && raw.remainingDurationRaw !== null
      ? (raw.isElapsedDuration
        ? raw.remainingDurationRaw / (24 * 60 * 10)
        : tenthsOfMinutesToDays(raw.remainingDurationRaw, hoursPerDay))
      : undefined;

    const formatField = (ts: Date | null): string | undefined =>
      ts ? (isHour ? formatInstant(ts, 'hour') : formatDate(ts)) : undefined;
    // `scheduleStart`/`scheduleFinish` dragen het veldpaar dat MSP zelf voor deze taak gebruikt
    // (`resolveScheduleField`): het manual-ankerpaar (1283/1284) voor een MANUALLY_SCHEDULED-taak met
    // een gevuld anker, anders SCHEDULED_START/FINISH (35/36).
    const isManual = raw.taskMode === 'MANUALLY_SCHEDULED';
    const resolvedStartTs = resolveScheduleField(raw.manualStartTs, raw.startTs, isManual);
    const resolvedFinishTs = resolveScheduleField(raw.manualFinishTs, raw.finishTs, isManual);
    const start = formatField(resolvedStartTs) ?? formatDate(new Date());
    const finish = formatField(resolvedFinishTs) ?? start;
    const actualStart = formatField(raw.actualStartTs);
    const actualFinish = formatField(raw.actualFinishTs);
    const resume = formatField(raw.resumeTs);
    const stop = formatField(raw.stopTs);

    let constraint: TaskConstraint | undefined;
    if (raw.constraintCode !== null) {
      const mapped = mspCodeToConstraint(raw.constraintCode);
      if (mapped) {
        const constraintDate = formatField(raw.constraintDateTs);
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(constraintDate ? { date: constraintDate } : {}),
        };
      }
    }
    const deadline = formatField(raw.deadlineTs);

    // `milestoneKind` alleen voor een UUR-modus-mijlpaal. `raw.finishTs ?? raw.startTs` is het
    // opgeslagen anker (bij duur 0 gelijk; finish ontbreekt alleen bij een kapot record).
    // `milestoneKindAt` geeft `undefined` buiten uur-modus of als het anker niet op een bandgrens ligt.
    //
    // `raw.isMilestone` alléén is niet genoeg: MSP staat de vlag toe op een taak met reële duur
    // (bewezen op `mpp14task.mpp`/`mpp14task-from2013.mpp`/`taskFlags-mpp14Project2010/2013.mpp`).
    // Zo'n taak is voor de planning geen mijlpaal (`CPMSolver.isZeroDurationMilestone` eist hetzelfde);
    // zonder de `durationRaw === 0`-guard zou `snapSuccessorEarlyStart` op de verkeerde taak werken.
    const milestoneAnchor = raw.finishTs ?? raw.startTs;
    const milestoneKind = raw.isMilestone && raw.durationRaw === 0 && isHour && milestoneAnchor
      ? milestoneKindAt(cal, milestoneAnchor)
      : undefined;

    // LEVELING_DELAY als echte duur, in tienden van een minuut zoals `durationRaw`
    // (MPPUtility.getDuration: "Value is given in 1/10 of minute"). `levelingDelayUnits`
    // (LEVELING_DELAY_UNITS, veld-id 178) levert de elapsed-vlag via `getDurationTimeUnits`.
    // AFWEZIG (raw === 0) ⇒ geen van beide velden gezet. Het werkdagveld `Task.levelingDelay` (van de
    // eigen nivelleerder) blijft bewust leeg: de solver past `levelingDelayMinutes` zelf toe.
    const levelingDelayMinutes = raw.levelingDelayRaw !== 0
      ? Math.round(raw.levelingDelayRaw / 10)
      : undefined;
    const levelingDelayElapsed = raw.levelingDelayRaw !== 0 && raw.levelingDelayUnits !== null
      && getDurationTimeUnits(raw.levelingDelayUnits).startsWith('elapsed');

    const mspTaskType = mspTaskTypeFromRaw(raw.mspTaskTypeRaw);

    const task: Task = {
      id: generateId('task'),
      name: raw.name,
      description: '',
      wbsCode: '', // wordt hieronder gezet — outline-nummering volgt pas ná de hiërarchie-opbouw
      taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED', // afgeleid door normalizeImportedProgress uit completion/actuals
      isMilestone: raw.isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId: null,
      childIds: [],
      time: {
        durationType: raw.isElapsedDuration ? 'ELAPSEDTIME' : 'WORKTIME',
        // MPP bewaart geplande duur in werkminuten; DurationUnits is uitsluitend het
        // invoer-/weergaveformaat. De precisiediscriminator hierboven bepaalt daarom de
        // betekenisvolle blijvende OPS-eenheid, net als vóór het expliciete taakmodel.
        durationUnit: isHour ? 'hours' : 'days',
        scheduleDuration: duration,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        ...(resume != null ? { resume } : {}),
        ...(stop != null ? { stop } : {}),
        ...(remainingTime != null ? { remainingTime } : {}),
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: raw.percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(raw.calendarOverride ? { calendarId: raw.calendarOverride.id } : {}),
      ...(levelingDelayMinutes != null ? { levelingDelayMinutes } : {}),
      ...(levelingDelayElapsed ? { levelingDelayElapsed } : {}),
      ...(isManual ? { manuallyScheduled: true } : {}),
      ...(mspTaskType ? { mspTaskType } : {}),
      ...(raw.effortDrivenRaw ? { effortDriven: true } : {}),
    };
    // Lege ScheduledStart/-Finish ("NA"): plaatshouder hierboven (vandaag, resp. finish = start),
    // vervangen door de gedeelde `resolveMissingScheduleDates` hieronder.
    if (!resolvedStartTs) missingDates.start.add(task.id);
    if (!resolvedFinishTs) missingDates.finish.add(task.id);
    records.push({ uniqueId: raw.uniqueId, id: raw.id, outlineLevel: raw.outlineLevel, storedWbs: raw.storedWbs, task });
    taskIdByUniqueId.set(raw.uniqueId, task.id);
    taskHourById.set(task.id, isHour);

    // "Datums zoals opgeslagen": MSP's eigen uitvoer als apart kanaal. Start/einde:
    // EARLY_START/EARLY_FINISH, terugval het opgeslagen (manual-bewuste) paar van `task.time`. Slack:
    // tienden van een minuut → werkdagen op de effectieve kalender; ELAPSED-eenheden via de vaste
    // 24-uursdag, net als de duur. Total slack: zie `mppTotalSlackTenths` (MPXJ
    // MicrosoftSlackCalculator, SMALLEST_SLACK — een .mpp kent geen TotalSlackCalculationType).
    // Kritiek volgt MPXJ `Task.calculateCritical`: werkelijk einde of 100% ⇒ NOOIT kritiek; anders
    // total slack ≤ CRITICAL_SLACK_LIMIT (dagen). Zonder total slack geen oordeel. NIET gevolgd:
    // MPXJ's uitzondering voor handmatige taken met tekstuele duur/start/einde (die tekstvelden leest
    // deze lezer niet). Ontbrekende assen ontbreken.
    {
      const slackDays = (tenths: number | null): number | undefined => {
        if (tenths === null) return undefined;
        return raw.isElapsedDuration
          ? recordedFloatDays(tenths / 10, 24 * 60)
          : recordedFloatDays(tenths / 10, (isHour ? effHpd : hoursPerDay) * 60);
      };
      const totalSlackRaw = mppTotalSlackTenths(raw.actualStartTs !== null, raw.startSlackRaw, raw.finishSlackRaw);
      const totalFloat = slackDays(totalSlackRaw);
      const completed = raw.actualFinishTs !== null || raw.percentComplete >= 100;
      const recorded = buildRecordedTime({
        start: formatField(raw.earlyStartTs) ?? formatField(resolvedStartTs),
        finish: formatField(raw.earlyFinishTs) ?? formatField(resolvedFinishTs),
        lateStart: formatField(raw.lateStartTs),
        lateFinish: formatField(raw.lateFinishTs),
        totalFloat,
        freeFloat: slackDays(raw.freeSlackRaw),
        isCritical: completed ? false : totalFloat === undefined ? undefined : totalFloat <= criticalSlackLimitDays,
      });
      if (recorded) recordedTimes[task.id] = recorded;
    }
  }

  // ID-volgorde = de rijvolgorde van MS Project's eigen XML-export én wat MPXJ's
  // `ProjectFile.updateStructure()` gebruikt om de boom op te bouwen (zie moduleheader).
  records.sort((a, b) => a.id - b.id);
  assignHierarchyAndWbs(records);

  const tasks = records.map((r) => r.task);
  // Gedeelde regel vóór de voortgang-invarianten: start ⇒ projectstart (anders de vroegste aanwezige
  // taakstart), finish ⇒ start + duur op de eigen kalender van de taak waar eenduidig.
  const startAnchor = resolveMissingScheduleDates(tasks, missingDates, ctx.projectStart ?? '',
    (task) => taskCalendar(task, calResult));
  normalizeImportedProgress(tasks, statusDate);
  deriveImportedWorkRules(tasks); // werkregel uit mspTaskType/effortDriven
  return {
    tasks, taskIdByUniqueId, taskHourById, startAnchor, recordedTimes,
    rawScans: raws, // alleen voor tests; readMPP geeft dit niet door
  };
}

/** `calendarHoursPerDayOverride` is `null` wanneer MINUTES_PER_DAY afwezig/ongeldig was: dan blijft
 *  de uit de werktijdbanden afgeleide `hoursPerDay` van de kalender staan i.p.v. de 8-uursdag-terugval
 *  die `hoursPerDay` zelf gebruikt voor de taakduur-afronding — spiegelt mspdiReader's
 *  `if (minutesPerDay > 0) calendar.hoursPerDay = ...`. Geëxporteerd voor `check-mpp-import.ts`. */
export function parseProjectProperties(
  props: Props,
  labels: ImportLabels | undefined,
): { project: Project; hoursPerDay: number; calendarHoursPerDayOverride: number | null; projectStartFromFile: boolean } {
  const titleBytes = props.getByteArray(PROPS_KEY_TITLE);
  const name = (titleBytes ? getUnicodeString(titleBytes, 0, MAX_VAR_TEXT_BYTES, 'Props title') : '') || labels?.importedProject || 'MS Project Import';

  const startBytes = props.getByteArray(PROPS_KEY_PROJECT_START_DATE);
  const finishBytes = props.getByteArray(PROPS_KEY_PROJECT_FINISH_DATE);
  const startDate = startBytes && startBytes.length >= 4 ? getTimestamp(startBytes, 0, 'Props startDate') : null;
  const finishDate = finishBytes && finishBytes.length >= 4 ? getTimestamp(finishBytes, 0, 'Props finishDate') : null;

  // Een dag heeft hoogstens 1440 minuten: een corrupt Props-veld valt terug op de 8-uursdag i.p.v.
  // een absurde `hoursPerDay` (en dus absurde duur-in-dagen-afronding).
  const minutesPerDay = props.getInt(PROPS_KEY_MINUTES_PER_DAY);
  const minutesPerDayValid = minutesPerDay > 0 && minutesPerDay <= 1440;
  const hoursPerDay = minutesPerDayValid ? minutesPerDay / 60 : 8;

  const project: Project = {
    id: generateId('proj'),
    name,
    description: '',
    startDate: startDate ? formatDate(startDate) : formatDate(new Date()),
    endDate: finishDate ? formatDate(finishDate) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    // Het MS Project-profiel draagt MSP's eigen conventies, o.a. hervatting van restwerk op
    // `actualStart + reeds verstreken duur` (`CPMSolver.ts`, `resumeFromActualElapsed`) en géén
    // verschuiving van niet-gestarte taken naar de statusdatum (`unstartedIgnoresStatusDate`,
    // `src/types/project.ts`). Out-of-sequence-hervatting is veldgedreven: `task.time.resume`
    // (MPP-veld-id 99) is het signaal, er is geen projectvlag.
    schedulingProfile: builtInProfile('msproject'),
  };

  // Statusdatum mét tijd: MS Project bewaart hem op de standaard eindtijd (17:00 = einde van die
  // dag) en schrijft dezelfde waarde in MSPDI als `<StatusDate>…T17:00:00`. Daarom in precies die vorm
  // gelezen met de regel van de MSPDI-lezer (`statusDateFromXml`): een tijd blijft, het dag-anker
  // (08:00) geeft exact de datum — zo levert `.mpp` voor hetzelfde project hetzelfde op als MSPDI.
  const statusBytes = props.getByteArray(PROPS_KEY_STATUS_DATE);
  const statusDate = statusBytes && statusBytes.length >= 4 ? getTimestamp(statusBytes, 0, 'Props statusDate') : null;
  if (statusDate) project.statusDate = statusDateFromXml(toXmlDateTime(formatInstant(statusDate, 'hour')));

  return {
    project, hoursPerDay, calendarHoursPerDayOverride: minutesPerDayValid ? hoursPerDay : null,
    projectStartFromFile: !!startDate,
  };
}

/**
 * Container-/Props-/versiepreambule van `readMPP` (CfbFile → `assertReadable` →
 * `detectApplicationVersion` → `"   114"/Props`) als losse functie, zodat tests bij `readCalendars`
 * kunnen zonder een eigen kopie van deze stappen.
 */
export interface OpenMppProject {
  cfb: CfbFile;
  projectProps: Props;
  applicationVersion: number | null;
}

export function openMppProject(bytes: Uint8Array): OpenMppProject {
  const cfb = new CfbFile(bytes);
  assertReadable(cfb); // gooit MppUnsupportedError voor legacy/versleuteld, of een gewone Error
  // voor een onherkenbaar bestand.

  const applicationVersion = detectApplicationVersion(cfb);

  const projectPropsBytes = cfb.getStream(['   114', 'Props']);
  if (!projectPropsBytes) {
    throw new Error('MPP: "   114"/Props ontbreekt — geen geldig MPP14-bestand');
  }
  const projectProps = new Props(projectPropsBytes, '   114/Props');

  return { cfb, projectProps, applicationVersion };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Splitsegmenten koppelen aan de taak. Het AFLEIDEN van `TaskSplitGap[]` uit periodes gebeurt in
// `mppTimephased.ts`; hier gebeurt de KOPPELING (welke `TBkndAssn`-uniqueId hoort bij welke `Task`,
// met welk ankerpunt) en de enige kalenderwandeling (assignment-start/resume → taakrelatieve
// werkminuten via `CalendarEngine.workMinutesBetween`), die bewust buiten de kalendervrije decoder
// valt.
//
// UID→TAAK, NIET UID→`ResourceAssignment.id`: `readAssignments` (mppEntities.ts) sluit een
// `TBkndAssn`-record zonder echte resource (`resourceUid === -65535`, MPXJ's
// `ASSIGNMENT_NULL_RESOURCE_ID`) uit, maar juist onbemande toewijzingen kunnen splits dragen (de
// referentie `mpp14splittask.mpp` heeft alleen zulke records). Deze functie leest daarom
// rechtstreeks taskUid/start/resume uit `TBkndAssn/FixedMeta`+`FixedData`.
//
// Anders dan `readAssignmentsUnsafe` toetst deze brug `varMeta.containsKey(uid)` niet. Onschadelijk:
// de aanroeper itereert over de uid's van `readAssignmentTimephasedRaw`, die zelf al uit VarMeta
// komen; een extra uid hier wordt nooit opgevraagd.
//
// Een aparte lus over hetzelfde `TBkndAssn`-storage, omdat `readAssignmentsUnsafe` een vast
// testcontract (`ResourceAssignment[]`) heeft. De itemgroottes (34/110 —
// `ResourceAssignmentFactory.java`) zijn daarom hier herhaald; die van mppEntities.ts zijn niet
// geëxporteerd.
const Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE = 34;
const Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE = 110;

/** Koppelinformatie van één `TBkndAssn`-record: bij welke taak hoort het, en de eigen
 *  `AssignmentField.START`/`RESUME` — de twee ankerpunten van `TimephasedDataFactory.java`. `null` ⇒
 *  het veld staat niet in de field map of het record is te kort; de aanroeper valt dan terug op de
 *  taakstart (shift 0), zoals MPXJ's `calculateStart()` (`ResourceAssignment.java`). */
interface AssignmentUidLink {
  taskId: string;
  assignmentStart: Date | null;
  assignmentResume: Date | null;
  /** `AssignmentField.FINISH` (id 21, blok 0 offset 16, naast `Start`): MSP's eigen berekende
   *  afsluitdatum van deze toewijzing (zie `deriveTimephasedWindowsForTasks`). `null` volgens
   *  hetzelfde terugvalcontract als `assignmentStart`/`assignmentResume`. */
  assignmentFinish: Date | null;
  /** `AssignmentField.ResourceUniqueId` (id 2): welke resource — dus welke resourcekalender — deze
   *  toewijzing draagt. `null` bij een ontbrekend veld; MPXJ's `ASSIGNMENT_NULL_RESOURCE_ID` (-65535)
   *  komt gewoon door als een niet-vindbare resource-id. */
  resourceUid: number | null;
}

/** Geëxporteerd zodat `check-mpp-import.ts` hem met een kleine synthetische `TBkndAssn`-fixture kan
 *  aanroepen i.p.v. via de volledige `readMPP`. */
export function buildAssignmentUidLinks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  try {
    return buildAssignmentUidLinksUnsafe(cfb, assignmentFieldMap, taskIdByUniqueId);
  } catch {
    return new Map();
  }
}

function buildAssignmentUidLinksUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  const label = '"   114"/TBkndAssn';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedData']);
  if (!fixedMetaBytes || !fixedDataBytes) return new Map(); // legitiem afwezig (bv. geen assignments)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withoutMeta(Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);

  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  if (uniqueIdOffset === null || taskUidOffset === null) return new Map();
  // Start/Resume/Finish zijn optioneel: ontbreekt de veldmap-entry, dan overal `null` (shift 0),
  // geen stille default-offset.
  const startOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Start);
  const resumeOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Resume);
  const finishOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Finish);
  // ResourceUniqueId staat in de praktijk altijd in de veldmap, maar hetzelfde terugvalcontract kost
  // niets.
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);

  const result = new Map<number, AssignmentUidLink>();
  // Geklemd via FixedMeta.getItemCount(), net als readAssignmentsUnsafe.
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const meta = fixedMeta.getByteArrayValue(index);
    // Verwijderd-vlag: spiegelt readAssignmentsUnsafe letterlijk (BYTE, niet SHORT).
    if (!meta || meta.length < 8 || meta[0] !== 0) continue;
    const offset = getInt(meta, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(offset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < Math.max(uniqueIdOffset, taskUidOffset) + 4) continue;
    const uid = getInt(data, uniqueIdOffset, `${label}/FixedData uniqueId`);
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    if (!taskId) continue; // onvindbare taak ⇒ overslaan, spiegelt readAssignmentsUnsafe
    // Per-veld-grens, ook `offset >= 0`: een corrupte veldmap kan een NEGATIEVE offset claimen,
    // waarvoor `data.length >= offset + 4` triviaal waar is. Zonder deze klem zou de buitenste
    // try/catch alle al verzamelde links weggooien; nu kost één corrupt veld alleen dat veld.
    const assignmentStart = startOffset !== null && startOffset >= 0 && data.length >= startOffset + 4
      ? getTimestamp(data, startOffset, `${label}/FixedData start`)
      : null;
    const assignmentResume = resumeOffset !== null && resumeOffset >= 0 && data.length >= resumeOffset + 4
      ? getTimestamp(data, resumeOffset, `${label}/FixedData resume`)
      : null;
    const assignmentFinish = finishOffset !== null && finishOffset >= 0 && data.length >= finishOffset + 4
      ? getTimestamp(data, finishOffset, `${label}/FixedData finish`)
      : null;
    const resourceUid = resourceUidOffset !== null && resourceUidOffset >= 0 && data.length >= resourceUidOffset + 4
      ? getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`)
      : null;
    result.set(uid, { taskId, assignmentStart, assignmentResume, assignmentFinish, resourceUid });
  }
  return result;
}

/** Kalender van `task` via `Task.calendarId` (zelfde keuze als `effCal` in `readTasks`).
 *  `calResult.resourceCalendars` bevat álle overige kalenders, dus ook taakkalender-overrides.
 *  Terugval: de projectkalender. */
function taskCalendar(task: Task, calResult: CalendarReadResult): WorkCalendar {
  if (!task.calendarId || task.calendarId === calResult.projectCalendar.id) return calResult.projectCalendar;
  return calResult.resourceCalendars.find((c) => c.id === task.calendarId) ?? calResult.projectCalendar;
}

/** De per-toewijzing decodeer-/verschuifstap, gedeeld door `deriveSplitGapsForTasks` en
 *  `deriveTimephasedContoursForTasks`, zodat een fix aan de shift-formule op beide landt.
 *  `null` bij "geen data". */
function computeShiftedAssignmentPeriods(
  raw: AssignmentTimephasedRaw,
  link: AssignmentUidLink,
  engine: CalendarEngine,
  taskStart: Date,
): { actualPeriods: readonly TimephasedWorkPeriod[]; remainingPeriods: readonly TimephasedWorkPeriod[] } | null {
  // BEIDE decoders ankeren op de eigen `AssignmentField.START` van de toewijzing (`getCompleteWork`
  // altijd; `getPlannedWork` zónder al verricht werk) — NIET op taakstart. Verschuiving =
  // werkminuten taakstart→assignmentStart (0 als het veld ontbreekt, zoals MPXJ's
  // `calculateStart()`-terugval naar `task.getStart()`).
  //
  // `engine.isHourMode`-guard: `workMinutesBetween` is een uur-modus-primitief en gooit op een
  // dag-modus-kalender (geen `workTime`) — zelfde guard als in `CPMSolver.ts`. Dag-modus-taken
  // krijgen shift 0; er is geen gemeten dag-granulaire formule.
  const assignmentStartShift = engine.isHourMode && link.assignmentStart
    ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentStart))
    : 0;

  // Referentie-instant alleen voor de (hier ongebruikte) `approxStart`/`approxFinish`-velden van de
  // decoder. GEEN `referenceFinish`: een ongedeeld `blockCount===0`-samenvattingsrecord kan geen gat
  // tonen, en zou met een klokminuten-lengte op de werkminuten-as een écht gat kunnen overbruggen.
  const actualPeriodsRaw = raw.actualRegularWork
    ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
    : [];
  const remainingPeriodsRaw = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
    : [];
  if (actualPeriodsRaw.length === 0 && remainingPeriodsRaw.length === 0) return null; // geen data ⇒ uitsluiten

  const actualPeriods = shiftPeriods(actualPeriodsRaw, assignmentStartShift);

  // De REMAINING-track ankert op `assignment.getResume()` zodra er al complete work is
  // (`getPlannedWork`: `timephasedComplete.isEmpty() ? getStart() : getResume()`). Voorkeur: het
  // echte RESUME-veld; zonder dat veld de benadering "einde van de verschoven actual-track" (geen
  // MPXJ-garantie — `AssignmentField.RESUME` heeft geen `mapMpp14`-default, zie fieldMap14.ts).
  let remainingShift = assignmentStartShift;
  if (actualPeriods.length > 0) {
    remainingShift = engine.isHourMode && link.assignmentResume
      ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentResume))
      : Math.max(...actualPeriods.map((p) => p.elapsedWorkMinutesEnd));
  }
  const remainingPeriods = shiftPeriods(remainingPeriodsRaw, remainingShift);

  return { actualPeriods, remainingPeriods };
}

/**
 * Gedeelde decodeer-/verschuifstap van `deriveSplitGapsForTasks` en `deriveTimephasedContoursForTasks`:
 * per toewijzing met timephased-data de periodes op de TAAK-as, alleen voor bladtaken met een start —
 * MPXJ toont nooit splits op een samenvattingstaak (`Task.calculateWorkSplits`: `if (getSummary())
 * return emptyList()`). Zo dekken splits en contouren exact dezelfde populatie.
 */
function* shiftedAssignmentPeriods(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Generator<{ link: AssignmentUidLink } & NonNullable<ReturnType<typeof computeShiftedAssignmentPeriods>>> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap); // zelf al try/catch-veilig
  if (rawByUid.size === 0) return;
  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return;

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  // Lokale cache (geen module-level singleton): meerdere toewijzingen op dezelfde taakkalender
  // delen één `CalendarEngine`.
  const engineByCalendarId = new Map<string, CalendarEngine>();
  const engineFor = (cal: WorkCalendar): CalendarEngine => {
    let engine = engineByCalendarId.get(cal.id);
    if (!engine) {
      engine = new CalendarEngine(cal);
      engineByCalendarId.set(cal.id, engine);
    }
    return engine;
  };

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task?.time?.scheduleStart) continue;
    if (isSummaryTask(task)) continue;
    const shifted = computeShiftedAssignmentPeriods(
      raw, link, engineFor(taskCalendar(task, calResult)), parseInstant(task.time.scheduleStart),
    );
    if (shifted) yield { link, ...shifted };
  }
}

/** Decodeert + leidt `TaskSplitGap[]` per taak af: `readAssignmentTimephasedRaw` → uid→taak-koppeling
 *  + ankerdatums → decodering zonder `referenceFinish` → verschuiving naar de TAAK-as
 *  (`shiftPeriods`) → per-toewijzing afleiding (`deriveSplitGapsFromPeriods`) → taakniveau-aggregatie
 *  (`deriveTaskSplitGaps`, zonder samenvattingstaken).
 *
 *  Bewust GEEN try/catch: elke sub-aanroep vangt zelf (`readAssignmentTimephasedRaw`,
 *  `buildAssignmentUidLinks`) of werpt aantoonbaar niet (`CalendarEngine.ts` bevat geen `throw`; de
 *  pure afleiders evenmin). Crashes worden bij de bron voorkomen (zie de `isHourMode`-guard), niet
 *  weggevangen. Geëxporteerd voor `check-mpp-import.ts`. */
export function deriveSplitGapsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Map<string, TaskSplitGap[]> {
  // Per taak: één TaskSplitGap[]-item PER toewijzing die periodes decodeerde — de invoervorm van
  // `deriveTaskSplitGaps`. Een toewijzing zonder data wordt uitgesloten, niet als "altijd stil" geteld.
  const gapsByAssignmentPerTask = new Map<string, TaskSplitGap[][]>();
  for (const { link, actualPeriods, remainingPeriods } of shiftedAssignmentPeriods(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult,
  )) {
    const gaps = deriveSplitGapsFromPeriods([...actualPeriods, ...remainingPeriods]);
    const list = gapsByAssignmentPerTask.get(link.taskId) ?? [];
    list.push(gaps);
    gapsByAssignmentPerTask.set(link.taskId, list);
  }

  const result = new Map<string, TaskSplitGap[]>();
  for (const [taskId, gapsByAssignment] of gapsByAssignmentPerTask) {
    const combined = deriveTaskSplitGaps(gapsByAssignment);
    if (combined.length > 0) result.set(taskId, combined); // leeg ⇒ veld niet zetten
  }
  return result;
}

/** Bewaart de RAUWE gedecodeerde timephased-periodes per taak, ook als ze niet tot een
 *  `TaskSplitGap` leiden: er mag geen broninformatie stil verloren gaan, ook niet ná bewerken.
 *  Deelt de decodeer-/verschuifstap en de filters met `deriveSplitGapsForTasks`, zodat precies
 *  dezelfde toewijzingen gedekt worden. Gelezen door de contourmotor (`contourEngine.ts`) en
 *  `ResourceLoad.ts`. */
export function deriveTimephasedContoursForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
  // MSP-resource-uid → OPS-resource-id, zodat elke contour haar `resourceId` krijgt en
  // `contourEngine.ts` haar aan de juiste toewijzing kan koppelen. Optioneel (test-aanroepen zonder
  // resources) ⇒ alleen `resourceUid`.
  resourceIdByUniqueId?: ReadonlyMap<number, string>,
): Map<string, TaskTimephasedContour[]> {
  const contoursByTask = new Map<string, TaskTimephasedContour[]>();
  const toContourPeriods = (
    periods: readonly TimephasedWorkPeriod[],
    kind: 'actual' | 'remaining',
  ): TimephasedContourPeriod[] => periods.map((p) => ({
    afterMinutes: p.elapsedWorkMinutesStart,
    minutes: p.elapsedWorkMinutesEnd - p.elapsedWorkMinutesStart,
    workMinutes: p.workMinutes,
    kind,
  }));

  for (const { link, actualPeriods, remainingPeriods } of shiftedAssignmentPeriods(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult,
  )) {
    const periods: TimephasedContourPeriod[] = [
      ...toContourPeriods(actualPeriods, 'actual'),
      ...toContourPeriods(remainingPeriods, 'remaining'),
    ];
    const list = contoursByTask.get(link.taskId) ?? [];
    const resourceId = link.resourceUid !== null ? resourceIdByUniqueId?.get(link.resourceUid) : undefined;
    list.push({ resourceUid: link.resourceUid, ...(resourceId ? { resourceId } : {}), periods });
    contoursByTask.set(link.taskId, list);
  }
  return contoursByTask;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// GELAAGDE BESLISKOLOM per taak: timephased-venster (gelezen) vs. herberekening. Een gelezen
// `AssignmentField.FINISH` reageert niet op latere edits; een onvoorwaardelijke venster-override
// zou de motor ná import bevriezen en alleen de import naspiegelen. De regel, in volgorde:
//   1. `time.completion >= 1` (VOLTOOID) ⇒ geen venster; `CPMSolver.ts` plant op actuals.
//   2. `0 < completion < 1` (IN-PROGRESS) ⇒ geen venster; de resume/actuals-paden zijn de bron.
//   3. ≥1 ÉCHTE gedecodeerde timephased-periode (Format A/B, zonder `referenceFinish`, dus het
//      vlakke `blockCount===0`-samenvattingsrecord telt NIET) ⇒ `timephasedFinishFloor`/
//      `timephasedStartAnchor`: MSP's eigen `AssignmentField.FINISH`/`START` rechtstreeks gelezen
//      (geen kalenderwandeling; 0 afwijkingen op de contour-taken in het corpus).
//   4. Vlak, MAAR de toewijzing draagt een resourcekalender die afwijkt van de effectieve
//      taakkalender (banden of gematerialiseerde uitzonderingen, `calendarDiffersIncludingExceptions`)
//      ⇒ `timephasedDurationWalks`: een VERSE herberekening. Bij precies 1 toewijzing wandelt
//      `CPMSolver.ts` `task.time.durationMinutes` (edit-live) door de resourcekalender. Bij >1
//      toewijzing wandelt elke toewijzing alleen haar eigen gedecodeerde werk-aandeel
//      (`decodeAssignmentWorkMinutes`; de volle duur per toewijzing gaf op "Task A" ~2× te laat).
//      Beide nemen het MAXIMUM ("langste toewijzing bepaalt de finish"). Let op: de >1-tak wandelt
//      BEVROREN `workMinutes` uit de import; daarom wissen `updateTask`/`updateTaskFields`/
//      `patchTaskFields` (`taskDefaults.ts`) de lijst bij een bewerking
//      (`clearTimephasedDurationWalks`, gepoort op `timephasedDurationWalksHaveFrozenWork`) en valt de
//      taak terug op punt 5 tot een volgende import.
//   5. Anders ⇒ geen van beide velden, de gewone duurberekening.
// Lagen 3 en 4 zijn MUTUEEL EXCLUSIEF per taak; lagen 1/2 zetten geen laag-3-veld, dus de
// VOLTOOID-/IN-PROGRESS-takken van `CPMSolver.ts` hoeven dat niet te raadplegen.
//
// Weerlegd: (a) een onvoorwaardelijke venster-override; (b) een kalenderwandeling op de som van
// `workMinutes` als vervanger van de duurwandeling voor de hele populatie — periodes dragen voor de
// vlakke meerderheid alleen een totaalwerk, en MSPDI bevestigt dat `<Work>` en `<Duration>`
// verschillende grootheden zijn (de werkverdeling bij >1 toewijzing is een andere vraag); (c) een
// fout in de uid→taak-brug — de koppeling is een schone 1:1-reeks.
//
// SAMENVATTINGSTAKEN: uitgesloten — MSP toont geen contour-eigen venster op een WBS-samenvatting,
// haar datums komen uit de rollup.
export interface TimephasedWindowResult {
  finishFloor: Date | null;                 // laag 3
  startAnchor: Date | null;                 // lagen 3+4 (vroegste anker)
  /** laag 4. `workMinutes` ONTBREEKT bij precies 1 toewijzing (de wandeling gebruikt dan de volle
   *  `task.time.durationMinutes`) en is GEZET bij >1 toewijzing (eigen werk-aandeel, zie
   *  `decodeAssignmentWorkMinutes`). */
  durationWalks: { anchor: Date; resourceCalendarId: string; workMinutes?: number }[];
}

function sortedRanges(list: readonly { startDate: string; endDate: string }[] | undefined): string {
  if (!list || list.length === 0) return '[]';
  const sorted = [...list].sort((x, y) => x.startDate.localeCompare(y.startDate) || x.endDate.localeCompare(y.endDate));
  return JSON.stringify(sorted.map((h) => [h.startDate, h.endDate]));
}

/** Vergelijkt de weekbanden van twee kalenders puur structureel — geen id-vergelijking: elke resource
 *  krijgt een eigen kalender-object, ook bij identieke inhoud. Ontbrekend `workTime` (dag-modus) ⇒
 *  geen zinvolle vergelijking ⇒ `false`. */
function calendarBandsDiffer(a: WorkCalendar, b: WorkCalendar): boolean {
  if (!a.workTime || !b.workTime) return false;
  return JSON.stringify(a.workTime.byWeekday) !== JSON.stringify(b.workTime.byWeekday);
}

/** `calendarBandsDiffer` plus GEMATERIALISEERDE uitzonderingen (`holidays`/`workingExceptions`): een
 *  resource met dezelfde weekbanden maar een extra vrije dag ("resource holiday") wijkt even echt af
 *  (corpus: mpp14timephased2.mpp, de `timephased-budget*.mpp`-familie). Geldt voor elke
 *  completion-staat.
 *
 *  "toewijzingswerk wandelt op de EIGEN resourcekalender, inclusief haar uitzonderingen" is MSP's
 *  semantiek. Valkuil: in `mpp14timephasedsegments(manual).mpp` ("Task Seven"/"Task Eight") heffen
 *  holiday en working exception elkaar bij de opgeslagen duur (4800 min) netto op, dus de fidelity is
 *  daar gelijk; bij een ANDERE, bewerkte duur (bv. 960 of 1920 min) divergeert de finish 1–2
 *  werkdagen. Die divergentie is met het huidige harnas onverifieerbaar (er is geen ground truth voor
 *  bewerkte duren) en bewust geaccepteerd. */
function calendarDiffersIncludingExceptions(a: WorkCalendar, b: WorkCalendar): boolean {
  if (calendarBandsDiffer(a, b)) return true;
  if (!a.workTime || !b.workTime) return false;
  if (sortedRanges(a.holidays) !== sortedRanges(b.holidays)) return true;
  if (sortedRanges(a.workingExceptions) !== sortedRanges(b.workingExceptions)) return true;
  return false;
}

/** Het TOTALE per toewijzing gedecodeerde werk in minuten: som van `actualRegularWork` +
 *  `remainingRegularWork` via dezelfde decoders als de laag-3-detectie. Bij >1 gelijktijdige
 *  toewijzing wandelt elke toewijzing haar EIGEN werk-aandeel en bepaalt de langste de finish
 *  (corpus: "Task A", `mpp14resource.mpp`: 3 × 1440 werkminuten bij taakduur 2880 — geen partitie,
 *  elke toewijzing draagt een eigen opgeslagen hoeveelheid).
 *
 *  Beperking: wandelt WERKMINUTEN zonder `ResourceAssignment.unitsPerDay` (een 25%-toewijzing zou in
 *  MSP langer duren). Ongetoetst: geen corpusgeval in deze populatie heeft niet-100%-units.
 *
 *  `assignmentFinish` is alleen voor de `blockCount===0`-tak van `decodePlannedRegularTimephasedWork`
 *  een verplicht niet-`null` ankerpunt; de werkwaarde zelf hangt er niet van af (gemeten op "Task A"),
 *  dus dit is geen cirkelmeting. Ontbreekt hij, dan de terugval `taskStart + 1 min` (getest in
 *  `check-mpp-import.ts`, waarvoor deze functie geëxporteerd is). Geen gedecodeerd werk ⇒ `null`: de
 *  aanroeper laat de taak dan op laag 5 vallen. */
export function decodeAssignmentWorkMinutes(
  raw: AssignmentTimephasedRaw, taskStart: Date, assignmentFinish: Date | null,
): number | null {
  const actual = raw.actualRegularWork ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart) : [];
  const referenceFinish = assignmentFinish ?? new Date(taskStart.getTime() + 60_000);
  const remaining = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart, referenceFinish)
    : [];
  const total = actual.reduce((sum, p) => sum + p.workMinutes, 0)
    + remaining.reduce((sum, p) => sum + p.workMinutes, 0);
  return total > 0 ? total : null;
}

export function deriveTimephasedWindowsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
  resources: readonly Resource[],
): Map<string, TimephasedWindowResult> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap); // zelf al try/catch-veilig
  if (rawByUid.size === 0) return new Map();

  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return new Map();

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const resourceById = new Map(resources.map((r) => [r.id, r] as const));
  const finishesByTask = new Map<string, Date[]>();
  const startsByTask = new Map<string, Date[]>();
  // `resourceType` is alleen een lokale filtersleutel voor de finalisatielus (komt niet in
  // `TimephasedWindowResult`). `null` = resource niet gevonden; telt net als `'MATERIAL'` als "niet
  // meewandelen" — conservatief bij twijfel.
  const durationWalksByTask = new Map<string, { anchor: Date; resourceCalendarId: string; workMinutes: number | null; resourceType: ResourceType | null }[]>();
  // Laag 4 is een taakbrede activering (≥1 toewijzing met een afwijkende resourcekalender) die
  // vervolgens ALLE vlakke toewijzingen van die taak meeneemt in de MAX-wandeling ("Task A": twee van
  // de drie dragen een taakgelijke kalender, de derde geeft de doorslag).
  const layer4ActivatedTasks = new Set<string>();

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task || isSummaryTask(task)) continue; // samenvattingstaak uitgesloten
    if (!task.time.scheduleStart) continue;
    const completion = task.time.completion ?? 0;

    // Laag 3 (gelezen venster) alleen bij `completion === 0`. De laag-4-KALENDERKEUZE is geen gelezen
    // datum maar een edit-live gegeven en wordt voor elke completion-staat bepaald; `CPMSolver.ts`
    // gebruikt hem ook voor het resume-anker van lopende taken.
    if (completion === 0) {
      const taskStart = parseInstant(task.time.scheduleStart);
      const actualPeriods = raw.actualRegularWork
        ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
        : [];
      // GEEN referenceFinish — het vlakke `blockCount===0`-geval telt NIET als echte periode.
      const remainingPeriods = raw.remainingRegularWork
        ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
        : [];
      const hasGenuinePeriod = actualPeriods.length > 0 || remainingPeriods.length > 0;

      if (hasGenuinePeriod) {
        // LAAG 3: gelezen venster.
        if (link.assignmentFinish) {
          const list = finishesByTask.get(link.taskId) ?? [];
          list.push(link.assignmentFinish);
          finishesByTask.set(link.taskId, list);
        }
        if (link.assignmentStart) {
          const list = startsByTask.get(link.taskId) ?? [];
          list.push(link.assignmentStart);
          startsByTask.set(link.taskId, list);
        }
        continue;
      }
    }

    // Vlak, dus geen laag-3-signaal, maar mogelijk een laag-4-wandelkandidaat. Geen gelezen terugval
    // op `AssignmentField.FINISH`: dat zou het opgeslagen antwoord zonder herberekening teruglezen.
    if (!hasAnyTimephasedData(raw)) continue; // geen enkel timephased-signaal ⇒ laag 5, niets doen
    if (!link.assignmentStart || link.resourceUid === null) continue;
    const resourceId = resourceIdByUniqueId.get(link.resourceUid);
    const resource = resourceId ? resourceById.get(resourceId) : null;
    const resCal = resource?.calendarId
      ? calResult.resourceCalendars.find((c) => c.id === resource.calendarId)
      : null;
    if (!resCal) continue;
    const taskCal = taskCalendar(task, calResult);
    // Bands én gematerialiseerde uitzonderingen tellen mee, voor elke completion-staat.
    const activates = calendarDiffersIncludingExceptions(resCal, taskCal);
    if (activates) layer4ActivatedTasks.add(link.taskId);
    const walkList = durationWalksByTask.get(link.taskId) ?? [];
    // Werk-hoeveelheid voor de >1-toewijzing-tak; bij precies 1 toewijzing genegeerd.
    const workMinutes = decodeAssignmentWorkMinutes(raw, parseInstant(task.time.scheduleStart), link.assignmentFinish);
    walkList.push({
      anchor: link.assignmentStart, resourceCalendarId: resCal.id, workMinutes,
      // `null` bij een onvindbare resource: wordt hieronder net als MATERIAL uitgesloten.
      resourceType: resource?.type ?? null,
    });
    durationWalksByTask.set(link.taskId, walkList);
  }

  const result = new Map<string, TimephasedWindowResult>();
  for (const [taskId, finishes] of finishesByTask) {
    const finishFloor = new Date(Math.max(...finishes.map((d) => d.getTime())));
    const starts = startsByTask.get(taskId);
    const startAnchor = starts ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    result.set(taskId, { finishFloor, startAnchor, durationWalks: [] });
  }
  // Laag 4 (`durationWalksByTask`) is hier de enige bron. Twee takken:
  //  - PRECIES 1 toewijzing met afwijkende kalender (`layer4ActivatedTasks`): de wandeling gebruikt
  //    de volle `task.time.durationMinutes` (`workMinutes` wordt niet doorgegeven).
  //  - >1 toewijzing: werkverdeling. Is voor elke meewandelende toewijzing `workMinutes` gedecodeerd
  //    (`null` ⇒ de hele taak blijft op laag 5, geen gedeeltelijke gok), dan wandelt `CPMSolver.ts`
  //    per toewijzing haar eigen aandeel en neemt het MAXIMUM. Hier is GEEN kalenderverschil nodig:
  //    `walks.length > 1` betekent al "≥2 toewijzingen met een echt timephased-blok" (elke push staat
  //    achter `hasAnyTimephasedData`). Corpus: twee toewijzingen met gestaggerde eigen
  //    START/FINISH-vensters op een taakgelijke resourcekalender (a69fec157074d056).
  for (const [taskId, walks] of durationWalksByTask) {
    if (result.has(taskId)) continue; // laag 3 heeft deze taak al (mutueel exclusief per taak)
    if (walks.length === 1 && layer4ActivatedTasks.has(taskId)) {
      // Precies 1 toewijzing: geen MATERIAL-filter (er valt niets te kiezen) en de volle taakduur
      // is het wandelgetal, ongeacht het toewijzingstype.
      const startAnchor = new Date(Math.min(...walks.map((w) => w.anchor.getTime())));
      result.set(taskId, {
        finishFloor: null, startAnchor,
        durationWalks: walks.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId })),
      });
    } else if (walks.length > 1) {
      // Werkverdeling. MATERIAL-toewijzingen wandelen NIET mee: hun "werk" is een budgethoeveelheid,
      // geen kalenderwerk (`timephased-cost-rollup.mpp`, "Task 8": ~4 werkdagen te vroeg). Dit
      // filtert alleen WELKE toewijzingen meewandelen: blijft er na filtering één over ("Task A":
      // alleen de LABOR-toewijzing), dan wandelt die nog steeds haar eigen aandeel (1440 min, niet de
      // volle 2880) — vandaar `>= 1`. Alleen MATERIAL en een onvindbare resource (`null`) vallen af;
      // EQUIPMENT/SUBCONTRACTOR/CREW zijn ongetoetst maar typisch kalenderbindend.
      const laborWalks = walks.filter((w) => w.resourceType !== 'MATERIAL' && w.resourceType !== null);
      if (laborWalks.length >= 1 && laborWalks.every((w) => w.workMinutes !== null)) {
        // `startAnchor` gaat over ALLE toewijzingen, ook MATERIAL: het is het vroegste ankerpunt voor
        // een taak zonder voorganger, geen wandelinvoer. In "Task A" dragen juist de MATERIAL-
        // toewijzingen het vroegste anker (08:00); zonder hen landt de start op 23:00.
        const startAnchor = new Date(Math.min(...walks.map((w) => w.anchor.getTime())));
        result.set(taskId, {
          finishFloor: null, startAnchor,
          durationWalks: laborWalks.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId, workMinutes: w.workMinutes! })),
        });
      }
      // Anders: laag 5 (na filtering geen enkele niet-MATERIAL toewijzing over, of onvolledig
      // gedecodeerd werk — geen gedeeltelijke gok).
    }
    // Anders: laag 5, niets gezet (0 toewijzingen actief).
  }
  return result;
}

export function readMPP(bytes: Uint8Array, labels?: ImportLabels): ImportResult {
  const { cfb, projectProps, applicationVersion } = openMppProject(bytes);

  const { project, hoursPerDay, calendarHoursPerDayOverride, projectStartFromFile } = parseProjectProperties(projectProps, labels);

  const taskFieldMap = createTaskFieldMap(projectProps);

  // Kalenders vóór taken: `readTasks` heeft de nog NIET gepromoveerde kalenders nodig voor het
  // (c)-signaal en promoveert ze daarna in-place (zelfde object-referenties), dus `calendar` en
  // `calResult.resourceCalendars` zijn na `readTasks` volledig gepromoveerd.
  // `calendarHoursPerDayOverride` (alleen bij een geldige MINUTES_PER_DAY) spiegelt mspdiReader's
  // MinutesPerDay-override in `parseCalendar`.
  const calResult = readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride);
  const calendar = calResult.projectCalendar;
  project.calendarId = calendar.id;

  // `readTasks` zet `Task.calendarId` zelf; `taskHourById` bepaalt de lag-eenheid in `readRelations`.
  const { tasks, taskIdByUniqueId, taskHourById, startAnchor, recordedTimes } = readTasks({
    cfb, taskFieldMap, hoursPerDay, statusDate: project.statusDate, applicationVersion, calResult,
    projectStart: projectStartFromFile ? project.startDate : '',
    criticalSlackLimitDays: criticalSlackLimitDaysOf(projectProps),
  });
  // Geen projectstart in de Props ⇒ het anker (vroegste aanwezige taakstart) i.p.v. vandaag.
  if (!projectStartFromFile) project.startDate = startAnchor;

  const sequences = readRelations(cfb, applicationVersion, hoursPerDay, taskIdByUniqueId, taskHourById);

  const resourceFieldMap = createResourceFieldMap(projectProps);
  const { resources, resourceIdByUniqueId } = readResources(cfb, resourceFieldMap, applicationVersion, calResult, labels);

  const assignmentFieldMap = createAssignmentFieldMap(projectProps);
  const assignments = readAssignments(cfb, assignmentFieldMap, taskIdByUniqueId, resourceIdByUniqueId);

  // `task.resourceIds` is een projectie van de toewijzingen (zelfde `reconstructResourceIds` als de
  // IFC-lezer); `CPMSolver.ts`'s `resumeOverride`-gate leest hem.
  reconstructResourceIds(tasks, assignments);

  // Splitsegmenten koppelen aan de taak (zie hierboven en mppTimephased.ts).
  const splitGapsByTaskId = deriveSplitGapsForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult);
  for (const task of tasks) {
    const gaps = splitGapsByTaskId.get(task.id);
    if (gaps) task.splitGaps = gaps;
  }

  // De RAUWE contourperiodes, naast `splitGaps`: deze bron wordt bij latere edit-invalidatie van
  // `splitGaps`/het venster (taskSlice.ts/mcpTransaction.ts) nooit gewist.
  const contoursByTaskId = deriveTimephasedContoursForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult, resourceIdByUniqueId);
  for (const task of tasks) {
    const contours = contoursByTaskId.get(task.id);
    if (contours && contours.length > 0) task.timephasedContours = contours;
  }

  // Gelaagde beslistabel (zie hierboven): laag 3 zet `timephasedFinishFloor` (gelezen), laag 4
  // `timephasedDurationWalks` (herberekening); mutueel exclusief. `startAnchor` is bij laag 4 alleen
  // wandel-oorsprong (zie `Task.timephasedStartAnchor`).
  const timephasedWindowByTaskId = deriveTimephasedWindowsForTasks(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult, resourceIdByUniqueId, resources,
  );
  for (const task of tasks) {
    const window = timephasedWindowByTaskId.get(task.id);
    if (!window) continue;
    if (window.finishFloor) task.timephasedFinishFloor = formatInstant(window.finishFloor, 'hour');
    if (window.startAnchor) task.timephasedStartAnchor = formatInstant(window.startAnchor, 'hour');
    if (window.durationWalks.length > 0) {
      // `workMinutes` alleen als het item uit de >1-toewijzing-tak komt, conditioneel gespreid (geen
      // `workMinutes: undefined`). Valkuil: na de MATERIAL-filter kan de uiteindelijke lijst toch
      // lengte 1 hebben mét `workMinutes` ("Task A") — de garantie zit op de tak, niet op de lengte.
      task.timephasedDurationWalks = window.durationWalks.map((w) => ({
        anchor: formatInstant(w.anchor, 'hour'), resourceCalendarId: w.resourceCalendarId,
        ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
      }));
    }
    // `workWindowStart`/`workWindowFinish` (round-trippen via het `OPS_Timephased`-pset) alleen voor
    // laag 3 — een gelezen antwoord; laag 4 heeft geen bevroren venster. `readAssignments` geeft elke
    // toewijzing een vers `id` en sluit null-resource-toewijzingen uit, dus een exacte koppeling zou
    // nog een `TBkndAssn`-lus vergen voor een informatief veld (exportmeldingen tellen alleen de
    // aanwezigheid). Daarom de taakbrede aggregaten op elke toewijzing van de taak.
    if (task.timephasedFinishFloor) {
      for (const assignment of assignments) {
        if (assignment.taskId !== task.id) continue;
        assignment.workWindowFinish = task.timephasedFinishFloor;
        if (task.timephasedStartAnchor) assignment.workWindowStart = task.timephasedStartAnchor;
      }
    }
  }

  // Pas ná beide mutatielussen staan `splitGaps` en de timephased-velden op de taak.
  const scheduleNotes = countScheduleNotes(tasks);

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars: calResult.resourceCalendars,
    // Rekenprofielen: .mpp ⇒ MS Project.
    suggestedProfileId: 'msproject',
    // Alleen gezet als ≥1 taak een signaal draagt, zodat `fileSlice.ts` met
    // `parsed.sourceScheduleNotes?.total` volstaat.
    ...(scheduleNotes.total > 0 ? { sourceScheduleNotes: scheduleNotes } : {}),
    // Alleen bladtaken — zie `leafRecordedTimes`.
    ...(() => {
      const leafTimes = leafRecordedTimes(tasks, recordedTimes);
      return Object.keys(leafTimes).length > 0 ? { recordedTimes: leafTimes, recordedTimesOrigin: 'mpp' as const } : {};
    })(),
  };
}
