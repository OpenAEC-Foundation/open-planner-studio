import { Task, TaskConstraint, ConstraintType, type MilestoneKind } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { parseInstant, parseDate, localTodayIso } from '@/utils/dateUtils';
import { normalizeImportedProgress, deriveImportedWorkRules, rebuildImportedHierarchy, reconstructResourceIds } from '@/services/importNormalize';
import { emptyMissingScheduleDates, isoDatePrefixOrToday, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { descendantText, toInt, toFloat } from '@/services/xmlDom';
import { hasMsProjectImportLoss, type ImportResult } from '@/services/importTypes';
import { scanMspdiImportLoss } from '@/services/msproject/mspdiImportLoss';
import type { CustomTaskType } from '@/types/taskType';
import {
  MSP_LINK_TYPE_CODE,
  OPS_CUSTOM_TASK_TYPE_FIELD_ID,
  OPS_DURATION_UNIT_FIELD_ID,
  OPS_DURATION_UNIT_LEGACY_FIELD_ID,
  OPS_DURATION_UNIT_FIELD_NAME,
  OPS_DAY_MEASURE_DURATIONS_FIELD_ID,
  OPS_DAY_MEASURE_LAGS_FIELD_ID,
  OPS_EXACT_MINUTES_FIELD_ID,
  OPS_LAG_CALENDAR_FIELD_ID,
  OPS_LITERAL_CALENDARS_FIELD_ID,
  OPS_MILESTONE_KIND_FIELD_ID,
  OPS_MILESTONE_KIND_FIELD_NAME,
  WORKCONTOUR_TO_CURVE,
} from './mspdiWriter';
import { invertRecord } from '@/utils/collections';
import {
  OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME, OPS_LAG_CALENDAR_NAME,
  dayMeasureMinutesPerDay, lagFromRecord, lagRecordHolds, lagRecordKey, lagWorkMinutesPerDay, normalizeKeepingDayRest,
  parseFieldRecords, parseLagCalendarOption, parseLagRecords, readMeasure, type LagRecord,
} from '@/services/xmlDayMeasure';
import { ELAPSED_MINUTES_PER_DAY } from '@/services/ifc/dayMeasureIo';
import {
  decodeCustomTaskType, OPS_LITERAL_CALENDARS_NAME, parseLiteralCalendars, statusDateFromXml, xmlTaskDate,
  xmlTimeRule, xmlTimeSignal, type XmlTimeRule,
} from '@/services/xmlInterchange';
import {
  canonicalizeBands, clockToMinutes, isSubDayMinutes,
  milestoneKindAt, opsDayWithBreak, promoteHourCalendars, registerCalendarBands, workDayFromBlocks,
  deriveHoursPerDay, sameBlocks, scalarHourFromClock, sharedWeekBlocks,
} from '@/services/subdayIo';

// MSPDI-uitzonderingssemantiek gebruikt dezelfde `buildContributions` (record-opbouw MET budgetklem
// TIJDENS de opbouw) en `resolveContributions` (precedentie-/invariantmotor) als de MPP-kant; deze
// module bouwt alleen haar eigen `RawException[]` uit `<Exception>`-elementen. Materialiseer niet
// eerst zelf: dat omzeilt het budget (445 KB XML kostte zo 5 s/478 MB). `RECURRENCE_TYPES`/
// `RELATIVE_MAP` zijn letterlijk dezelfde codetabellen als MSPDI's `<Type>` (MPXJ's `MSPDIReader`
// gebruikt identieke tabellen).
//
// Importeer rechtstreeks uit de formaat-neutrale bladmodule `@/services/calendarRecurrence`, NIET
// uit de MPP-kalendermodule: dat zou de hele MPP-parser de main-chunk in trekken
// (`tests/planning/check-mpp-chunk-boundary.ts`).
import {
  buildContributions, resolveContributions, mergeInherited, newHolidayBudget, RECURRENCE_TYPES, RELATIVE_MAP,
  MAX_CALENDAR_EXCEPTIONS, MAX_BASE_CHAIN_DEPTH,
} from '@/services/calendarRecurrence';
import type { RecurrenceSpec, RawException, HolidayBudget } from '@/services/calendarRecurrence';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine, seedScalarBands } from '@/utils/effectiveWorkTime';
import { MSPDI_WORKCONTOUR_CONTOURED } from '@/engine/contour/contourEngine';
import {
  absoluteItemsToContourPeriods, attachContours, collectContour, mspdiValueToMinutes, type AbsoluteWorkItem,
} from '@/services/contourIo';
import type { TaskTimephasedContour } from '@/types/task';
import { importedWorkFields, mspTaskTypeFromCode } from '@/engine/work/workRuleMapping';
import { taskWorkMinutes } from '@/engine/contour/contourEngine';
import { buildRecordedTime, leafRecordedTimes, recordedFloatDays, type RecordedTime } from '@/engine/scheduler/recordedDates';

function taskDurationType(te: Element): 'WORKTIME' | 'ELAPSEDTIME' {
  const format = Number.parseInt(getElementText(te, 'DurationFormat'), 10);
  return [4, 6, 8, 10, 12].includes(format) ? 'ELAPSEDTIME' : 'WORKTIME';
}

/** Draagt de projectkop een OPS-definitie met exact dit FieldID én deze OPS-naam? Alleen dan zijn de
 *  taakwaarden van dat veld een OPS-marker (duureenheid, soort mijlpaal); een vreemd bestand dat
 *  hetzelfde Text-veld zelf gebruikt, matcht zo nooit per ongeluk. */
function hasOpsFieldDefinition(root: Element, fieldId: string, fieldName: string): boolean {
  const containers = root.getElementsByTagName('ExtendedAttributes');
  for (let i = 0; i < containers.length; i++) {
    if (containers[i].parentElement !== root) continue;
    const definitions = containers[i].getElementsByTagName('ExtendedAttribute');
    for (let j = 0; j < definitions.length; j++) {
      if (getElementText(definitions[j], 'FieldID') === fieldId
        && getElementText(definitions[j], 'FieldName') === fieldName) return true;
    }
  }
  return false;
}

/** De eerste geldige waarde (uit `allowed`) van het OPS-taakveld `fieldId` op deze taak (direct-kind
 *  `<ExtendedAttribute>`), of `undefined`. */
function opsTaskFieldValue<T extends string>(te: Element, fieldId: string, allowed: readonly T[]): T | undefined {
  const values = te.getElementsByTagName('ExtendedAttribute');
  for (let i = 0; i < values.length; i++) {
    if (values[i].parentElement !== te) continue;
    if (getElementText(values[i], 'FieldID') !== fieldId) continue;
    const value = getElementText(values[i], 'Value');
    if ((allowed as readonly string[]).includes(value)) return value as T;
  }
  return undefined;
}

/** Het FieldID waarop dit bestand de OPS-duureenheid draagt: Text30 (huidig), of het oude Flag9-ID
 *  van eerdere OPS-exports (zie `OPS_DURATION_UNIT_FIELD_ID`); `null` zonder OPS-definitie. */
/** De tekst van het OPS-taakveld `fieldId` op deze taak (direct-kind `<ExtendedAttribute>`), of
 *  `undefined`. Voor de maatrecords (JSON); `enabled` = de projectdefinitie draagt de OPS-naam. */
function opsTaskFieldText(te: Element, fieldId: string, enabled: boolean): string | undefined {
  if (!enabled) return undefined;
  const values = te.getElementsByTagName('ExtendedAttribute');
  for (let i = 0; i < values.length; i++) {
    if (values[i].parentElement !== te) continue;
    if (getElementText(values[i], 'FieldID') === fieldId) return getElementText(values[i], 'Value');
  }
  return undefined;
}

/** De twee duurvelden van MSPDI, zoals de writer ze als sleutel in de records gebruikt. */
const MSPDI_DURATION_FIELDS = { duration: 'Duration', remaining: 'RemainingDuration' } as const;

function opsDurationUnitFieldId(root: Element): string | null {
  for (const id of [OPS_DURATION_UNIT_FIELD_ID, OPS_DURATION_UNIT_LEGACY_FIELD_ID]) {
    if (hasOpsFieldDefinition(root, id, OPS_DURATION_UNIT_FIELD_NAME)) return id;
  }
  return null;
}

function explicitOpsDurationUnit(te: Element, fieldId: string | null): 'days' | 'hours' | undefined {
  return fieldId ? opsTaskFieldValue(te, fieldId, ['days', 'hours'] as const) : undefined;
}

/** Soort mijlpaal uit de OPS-marker (zie `OPS_MILESTONE_KIND_FIELD_ID`): START/FINISH, `'AUTO'` voor
 *  een expliciet automatische mijlpaal, `undefined` als er geen (geldige) marker is — dan beslist de
 *  bestaande afleiding, precies zoals voor een bestand van MS Project zelf. */
function explicitOpsMilestoneKind(te: Element, enabled: boolean): MilestoneKind | 'AUTO' | undefined {
  return enabled ? opsTaskFieldValue(te, OPS_MILESTONE_KIND_FIELD_ID, ['START', 'FINISH', 'AUTO'] as const) : undefined;
}

/**
 * Alleen een door OPS zelf gedefinieerde marker is een expliciete taakeenheid. DurationFormat is in
 * MSPDI een presentatieformaat en mag een bestaand uurproject dus niet stil herinterpreteren. Een
 * vreemd of legacy bestand zonder marker gebruikt altijd minuten als bron (T15).
 */
function taskDurationUnit(te: Element, opsMarkerFieldId: string | null): 'days' | 'hours' {
  return explicitOpsDurationUnit(te, opsMarkerFieldId) ?? 'hours';
}

/** Bovengrens op het aantal `<Calendar>`-elementen dat de resourcekalenderlus materialiseert. Een
 *  tekstueel (goedkoop op te blazen) XML-bestand met N minimale `<Calendar>`-elementen zou anders N
 *  volledige `WorkCalendar`-objecten alloceren, die via `ImportResult.resourceCalendars` in de
 *  app-state, undo-snapshots en IFC-saves belanden. Dezelfde bugklasse en dezelfde grens als
 *  `MAX_CALENDARS` in `mppCalendars.ts`; `MAX_CALENDAR_EXCEPTIONS`/het gedeelde `HolidayBudget`
 *  begrenzen alleen de uitzonderingen, niet het aantal kalenders. Het corpus heeft 9–13 kalenders per
 *  bestand. */
const MAX_MSPDI_CALENDARS = 1_024;

// De rauwe-bandenregistry en `synth*BandsFromScalar` staan in subdayIo. WORKCONTOUR_TO_CURVE (spiegel
// van mspdiWriter's CURVE_TO_WORKCONTOUR) komt uit de writer, waar hij programmatisch is afgeleid,
// dus reader en writer kunnen niet divergeren.

// Dunne lokale wrappers rond de gedeelde XML-primitieven. MSPDI leest DESCENDANT-tags
// (`getElementsByTagName`), waar P6 alleen directe kinderen leest — die scope-keuze blijft per
// formaat bewaard terwijl de parse-fallback-conventie gedeeld is.
function getElementText(parent: Element, tagName: string): string {
  return descendantText(parent, tagName);
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  return toInt(getElementText(parent, tagName), fallback);
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  return toFloat(getElementText(parent, tagName), fallback);
}

/** MS Project-datum in DAG-modus (`2026-03-09T08:00:00` → `2026-03-09`); gedeeld met P6. */
function parseMSPDate(s: string): string {
  return isoDatePrefixOrToday(s);
}

/** ISO-8601-duur → minuten. Een dagcomponent telt verstreken dagen (1440 min), zoals het oude
 *  dagpad. Decimalen (`PT22.5H`) zijn toegestaan; oudere OPS-exports schreven ze. */
function mspDurationMinutes(s: string): number | null {
  if (!s) return null;
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  return Math.round(parseFloat(m[1] || '0') * 1440 + parseFloat(m[2] || '0') * 60
    + parseFloat(m[3] || '0') + parseFloat(m[4] || '0') / 60);
}

/**
 * Duur in DAGEN (dag-modus): de uren uit `mspDurationMinutes` gedeeld door `hoursPerDay` (geen vaste
 * `/8`). `PnD` blijft elapsed-dagen. In uur-modus gebruikt de reader `mspDurationMinutes`
 * rechtstreeks (geen afronding).
 */
function parseMSPDuration(s: string, hoursPerDay: number): number {
  if (!s) return 0;
  const dayMatch = s.match(/^P(\d+(?:\.\d+)?)D$/);
  if (dayMatch) return parseFloat(dayMatch[1]);
  const mins = mspDurationMinutes(s);
  if (mins != null) {
    const perDay = hoursPerDay * 60;
    return perDay > 0 ? mins / perDay : 0;
  }
  return 0;
}

/**
 * Baselineduur in DAGEN, met dezelfde dag als de taakduur en als `mspdiWriter` hem schrijft. Urentaak:
 * werkminuten ÷ de werktijd per dag van de taakkalender (`hourTaskScheduleDuration`), zonder afronding —
 * ook als de kalender een eigen, afwijkende uren per dag houdt (`MinutesPerDay` 480 bij blokken van
 * 10 u). Dagtaak (of een duur zonder uren): `parseMSPDuration` met de uren per dag van de taakduur (sinds
 * F5a-2 de werktijd per dag, T13; in een ouder OPS-bestand de opgeslagen uren per dag).
 */
export function mspdiBaselineDays(text: string, hourTask: boolean, cal: WorkCalendar, hoursPerDay: number): number {
  const minutes = hourTask ? mspDurationMinutes(text) : null;
  return minutes != null ? hourTaskScheduleDuration(minutes, cal) : parseMSPDuration(text, hoursPerDay);
}

/** Eigen MSPDI-uitbreiding; andere clients mogen de vrije ExtendedAttribute negeren. */
function readOpsCustomTaskType(task: Element): { id: string; name?: string } | undefined {
  const attrs = task.getElementsByTagName('ExtendedAttribute');
  for (const attr of attrs) {
    if (attr.parentElement !== task || getElementText(attr, 'FieldID') !== OPS_CUSTOM_TASK_TYPE_FIELD_ID) continue;
    // Vreemde vrije attributen zijn geen taaktype; zoek dan door naar een volgende.
    const decoded = decodeCustomTaskType(getElementText(attr, 'Value'));
    if (decoded) return decoded;
  }
  return undefined;
}

const SEQUENCE_TYPE_BY_MSP_CODE: Partial<Record<number, SequenceType>> = invertRecord(MSP_LINK_TYPE_CODE);

/** Geëxporteerd zodat `mppReader.ts`'s TBkndCons-relatielezer dezelfde codetabel gebruikt: MPXJ's
 *  `RelationType.getInstance` (ConstraintFactory.java) gebruikt dezelfde 0=FF/1=FS/2=SF/3=SS-codering
 *  met dezelfde FS-terugval voor een onbekende waarde. */
export function mspTypeToSequenceType(type: number): SequenceType {
  return SEQUENCE_TYPE_BY_MSP_CODE[type] ?? 'FINISH_START';
}

/**
 * MSPDI `ConstraintType`-code → OPS-constraint (spiegel van `mspConstraintCode`). 2/3 (Must
 * Start/Finish On) zijn HARD ⇒ `MSO`/`MFO` mét `hard:true`; 4-7 zijn de soft SNET/SNLT/FNET/FNLT;
 * 0 (ASAP, default) en onbekend ⇒ `undefined` (geen constraint).
 */
export function mspCodeToConstraint(code: number): { type: ConstraintType; hard?: boolean } | undefined {
  switch (code) {
    case 1: return { type: 'ALAP' };
    case 2: return { type: 'MSO', hard: true };
    case 3: return { type: 'MFO', hard: true };
    case 4: return { type: 'SNET' };
    case 5: return { type: 'SNLT' };
    case 6: return { type: 'FNET' };
    case 7: return { type: 'FNLT' };
    default: return undefined;
  }
}

export function readMSPDI(content: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  const root = doc.documentElement;
  const durationUnitMarkerFieldId = opsDurationUnitFieldId(root);
  const opsMilestoneKindMarkerEnabled = hasOpsFieldDefinition(root, OPS_MILESTONE_KIND_FIELD_ID, OPS_MILESTONE_KIND_FIELD_NAME);
  // De maatrecords (T21, T14; `xmlDayMeasure.ts`). De definitie van `OPS_DayMeasureDurations` zegt ook dat
  // de writer de dagenmaat in de werktijd per dag schreef (T13). Zonder die definitie (OPS tot en met
  // F5a-1) telt een dag de opgeslagen uren per dag, zoals die writer hem schreef.
  const dayMeasureDurationsEnabled = hasOpsFieldDefinition(root, OPS_DAY_MEASURE_DURATIONS_FIELD_ID, OPS_DAY_MEASURE_DURATIONS_NAME);
  const exactMinutesEnabled = hasOpsFieldDefinition(root, OPS_EXACT_MINUTES_FIELD_ID, OPS_EXACT_MINUTES_NAME);
  const dayMeasureLagsEnabled = hasOpsFieldDefinition(root, OPS_DAY_MEASURE_LAGS_FIELD_ID, OPS_DAY_MEASURE_LAGS_NAME);
  const workdayIsWorkTime = dayMeasureDurationsEnabled;
  // De tijdregel van dit bestand (I8, `xmlTimeRule`): 08:00 is alleen een anker in een bestand van OPS.
  // De definitie van de duureenheid zegt "OPS schreef dit" (zoals `opsFile` in `readCalendars`); die van
  // `OPS_LiteralCalendars` zegt "sinds F5b: elke taakdatum met zijn echte tijd".
  const literalCalendarsEnabled = hasOpsFieldDefinition(root, OPS_LITERAL_CALENDARS_FIELD_ID, OPS_LITERAL_CALENDARS_NAME);
  const timeRule = xmlTimeRule(durationUnitMarkerFieldId !== null, literalCalendarsEnabled);

  // Parse project
  const project = parseProject(root, timeRule);
  // De lagkalender (I7) staat in `OPS_LagCalendar` op de projectsamenvattingstaak (UID 0). Zonder dat veld
  // rekent de lezer met de standaard (de voorganger); een lagrecord dat met een andere lagkalender is
  // geschreven, telt dan niet (`lagRecordHolds`).
  let summaryTask: Element | undefined;
  const allTasks = root.getElementsByTagName('Task');
  for (let i = 0; i < allTasks.length && !summaryTask; i++) {
    const te = allTasks[i];
    if (te.parentElement?.tagName === 'Tasks' && getElementInt(te, 'UID', -1) === 0
      && getElementInt(te, 'OutlineLevel', 1) === 0) summaryTask = te;
  }
  const lagCalendarOption = summaryTask
    ? parseLagCalendarOption(opsTaskFieldText(summaryTask, OPS_LAG_CALENDAR_FIELD_ID,
      hasOpsFieldDefinition(root, OPS_LAG_CALENDAR_FIELD_ID, OPS_LAG_CALENDAR_NAME)))
    : undefined;
  if (lagCalendarOption) project.schedulingOptions = { ...project.schedulingOptions, lagCalendar: lagCalendarOption };
  // De letterlijke kalenders van een F5b-export (kalender-UID's); geen geldige lijst ⇒ `null`.
  const literalCalendarUids = summaryTask
    ? parseLiteralCalendars(opsTaskFieldText(summaryTask, OPS_LITERAL_CALENDARS_FIELD_ID, literalCalendarsEnabled))
    : null;
  const projectStartRaw = getElementText(root, 'StartDate');
  const missingDates = emptyMissingScheduleDates();
  // Eén gedeeld `HolidayBudget` over ALLE kalenders in dit document (projectkalender + elke
  // resourcekalender) — zie `applyCalendarBody`.
  const holidayBudget = newHolidayBudget();
  const { calendar, resourceCalendars, calUidToId, projectCalUid, projectFileHoursPerDay } = readCalendars(root, holidayBudget);
  const hoursPerDay = calendar.hoursPerDay;

  // Resources
  const resourcesRoot = root.getElementsByTagName('Resources')[0];
  const resources: Resource[] = [];
  const resUidToId = new Map<number, string>();
  if (resourcesRoot) {
    const resElements = resourcesRoot.getElementsByTagName('Resource');
    for (let i = 0; i < resElements.length; i++) {
      const resEl = resElements[i];
      if (resEl.parentElement !== resourcesRoot) continue;
      const uid = getElementInt(resEl, 'UID', -1);
      if (uid < 0) continue;
      const id = generateId('res');
      resUidToId.set(uid, id);

      const name = getElementText(resEl, 'Name') || 'Resource';
      const type = getElementInt(resEl, 'Type', 1);
      const maxUnits = getElementFloat(resEl, 'MaxUnits', 1);
      const materialLabel = getElementText(resEl, 'MaterialLabel');
      const calUid = getElementInt(resEl, 'CalendarUID', -1);
      const standardRate = getElementText(resEl, 'StandardRate');

      // MSP maakt geen onderscheid tussen LABOR/EQUIPMENT/CREW/SUBCONTRACTOR (Type=1 =
      // "Work") — zonder verdere hint komt dat terug als LABOR (geaccepteerd verlies).
      const resource: Resource = {
        id,
        name,
        type: type === 0 ? 'MATERIAL' : 'LABOR',
        description: '',
        maxUnits,
      };
      if (materialLabel) resource.unitOfMeasure = materialLabel;
      if (calUid >= 0 && calUidToId.has(calUid)) resource.calendarId = calUidToId.get(calUid);
      const rate = parseFloat(standardRate);
      if (Number.isFinite(rate) && standardRate) resource.costPerHour = rate;
      resources.push(resource);
    }
  }

  // Parse tasks
  const taskElements = root.getElementsByTagName('Task');
  const tasks: Task[] = [];
  /** Zie de toelichting bij de vastlegging in de taaklus. */
  const recordedTimes: Record<string, RecordedTime> = {};
  const customTaskTypes = new Map<string, CustomTaskType>();
  const uidToId = new Map<number, string>();
  const uidToWbs = new Map<number, string>();
  // `<OutlineLevel>` per taak, parallel aan `tasks` (undefined = element ontbreekt).
  const outlineLevels: (number | undefined)[] = [];
  // Effectieve uren/dag per taak, voor de werkafleiding bij de toewijzingen.
  const effHpdByTaskId = new Map<string, number>();
  /** De effectieve kalender per taak (na de uur-promotie), voor de lagkalender van een lagrecord. */
  const effCalByTaskId = new Map<string, WorkCalendar>();
  const pendingLinks: { successorId: string; predUid: number; type: number; lag: number; lagFormat: number; record?: LagRecord }[] = [];
  // Baseline 0: per taak de gesnapshotte Start/Finish/Duration.
  const baselineEntries: BaselineTask[] = [];

  // Uur-modus-beslissing per kalender (discriminator a/b/c) vóór het bouwen van de taken.
  // `effCalIdOfUid` geeft per taak de effectieve kalender-id (de projectkalender, -1 of ontbrekend =
  // projectkalender).
  const calById = new Map<string, WorkCalendar>([calendar, ...resourceCalendars].map(c => [c.id, c]));
  const effCalIdOfUid = (calUid: number): string => calUidToId.get(calUid) ?? calendar.id;
  // `opsLiteral` met een geldige lijst: de lijst beslist over de tijdsignalen, niet de tijden zelf (die zijn
  // allemaal echt, ook op een scalaire kalender). Een onbekend nummer telt niet.
  const literalCalIds = timeRule === 'opsLiteral' && literalCalendarUids
    ? new Set([...literalCalendarUids].flatMap(uid => uid === projectCalUid ? [calendar.id] : calUidToId.has(uid) ? [calUidToId.get(uid)!] : []))
    : null;

  const cSignalCalIds = new Set<string>();
  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    if (te.parentElement?.tagName !== 'Tasks') continue;
    const calId = effCalIdOfUid(getElementInt(te, 'CalendarUID', -1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durMin = mspDurationMinutes(getElementText(te, 'Duration'));
    const durSignal = durMin != null && isSubDayMinutes(durMin, cal.hoursPerDay);
    // Ook een werkelijke datum met een eigen tijd telt: een feit uit de bron. Anders blijft de kalender
    // scalair, kapt de lezer "11:00" af tot de datum, en maakt de laadnormalisatie er het blokeinde van
    // (review ronde 3 van PR #559, deel B). In een F5b-export beslist de lijst (`literalCalIds`).
    const dateSignal = literalCalIds
      ? literalCalIds.has(calId)
      : ['Start', 'Finish', 'ActualStart', 'ActualFinish'].some(field => xmlTimeSignal(getElementText(te, field)));
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  // MSPDI valt terug op de scalar-synth zodra de geregistreerde canonical geen werkdag draagt
  // (preferCanonicalWhenEmpty = false) — zie `promoteHourCalendar`.
  const hourModeCalIds = promoteHourCalendars(calById, id => cSignalCalIds.has(id), false);
  // Een uurkalender rekent met zijn blokken; de pauzevelden van een dagkalender met pauze
  // (`applyCalendarBody`) horen daar niet bij. De lezer zet ze nergens anders.
  for (const id of hourModeCalIds) {
    const promoted = calById.get(id);
    if (!promoted) continue;
    delete promoted.simpleBreakStartMinute;
    delete promoted.simpleBreakDurationMinutes;
  }
  // `<MinutesPerDay>` (authoritatief voor de projectkalender, zie `readCalendars`) gaat na de promotie
  // terug, zoals bij XER en IFC: de omrekening tussen dagen en uren mag afwijken van de blokken.
  if (projectFileHoursPerDay !== undefined) calendar.hoursPerDay = projectFileHoursPerDay;

  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    // Skip if this is nested inside another element (like PredecessorLink)
    if (te.parentElement?.tagName !== 'Tasks') continue;

    const uid = getElementInt(te, 'UID', -1);
    if (uid < 0) continue;

    // Skip project summary task (UID 0)
    const outlineLevel = getElementInt(te, 'OutlineLevel', 1);
    if (uid === 0 && outlineLevel === 0) continue;

    const id = generateId('task');
    uidToId.set(uid, id);

    const name = getElementText(te, 'Name') || 'Task';
    const wbs = getElementText(te, 'WBS') || `${uid}`;
    uidToWbs.set(uid, wbs);
    // Taakkalender: effectieve <CalendarUID> → task.calendarId. De projectkalender (of -1/ontbrekend)
    // staat niet in `calUidToId` ⇒ undefined.
    const taskCalUid = getElementInt(te, 'CalendarUID', -1);
    const taskCalendarId = calUidToId.get(taskCalUid);
    // Uur- vs dag-modus voor deze taak.
    const effCalId = effCalIdOfUid(taskCalUid);
    const isHour = hourModeCalIds.has(effCalId);
    const effCal = calById.get(effCalId) ?? calendar;
    const effHpd = effCal.hoursPerDay;
    // Het werk van een toewijzing rekent met dezelfde uren per dag als `mspdiWriter` hem schreef (`<Work>` =
    // dagen × uren per dag): sinds F5a-2 de werktijd per dag (T13/T14), daarvoor de opgeslagen uren per
    // dag. Met een andere waarde zou een dagtaak van 5 d op 8 u/dag met blokken van 10 u haar werk als
    // vastgelegd werk terugkrijgen, en bij een langere duur niet meer meegroeien.
    effHpdByTaskId.set(id, workdayIsWorkTime ? effHoursPerDay(effCal) : effHpd);
    effCalByTaskId.set(id, effCal);
    // MSP's <Type> (0/1/2 = Fixed Units/Duration/Work) en <EffortDriven> — dezelfde bewaarvelden als
    // de .mpp-lezer; de werkregel volgt eruit via `deriveImportedWorkRules`. Ontbrekend/ongeldig ⇒
    // geen veld.
    const mspTaskType = mspTaskTypeFromCode(getElementInt(te, 'Type', -1));
    const effortDrivenRaw = getElementText(te, 'EffortDriven').trim().toLowerCase();
    const effortDriven = mspTaskType !== undefined && (effortDrivenRaw === '1' || effortDrivenRaw === 'true');

    const durationStr = getElementText(te, 'Duration');
    const remainingRaw = getElementText(te, 'RemainingDuration');
    // Duur en rest (alleen uren §3.10; `readMeasure`): urenmaat ⇒ minuten (bron van waarheid, geen
    // afronding; een `OPS_ExactMinutes`-record geeft een breuk in minuten terug). Dagenmaat (OPS-markering
    // `days`) ⇒ het record `[dagen, minuten]` zolang de duur nog de geschreven minuten draagt, anders
    // minuten ÷ minuten per dag. Een dag is de werktijd per dag (T13; kalendertijd 1440), of in een
    // ouder OPS-bestand de opgeslagen uren per dag.
    const markerUnit = taskDurationUnit(te, durationUnitMarkerFieldId);
    const dayMinutesPerDay = workdayIsWorkTime
      ? dayMeasureMinutesPerDay(effCal, taskDurationType(te) === 'ELAPSEDTIME') : effHpd * 60;
    const wholeDays = (raw: string): number | undefined => {
      const m = raw.match(/^P(\d+(?:\.\d+)?)D$/);
      return m ? parseFloat(m[1]) : undefined;
    };
    const durationDays = markerUnit === 'days' ? wholeDays(durationStr) : undefined;
    const remainingDays = markerUnit === 'days' ? wholeDays(remainingRaw) : undefined;
    const measure = readMeasure({
      unit: markerUnit,
      durationMinutes: mspDurationMinutes(durationStr) ?? 0,
      ...(durationDays !== undefined ? { durationDays } : {}),
      remainingMinutes: remainingRaw ? (mspDurationMinutes(remainingRaw) ?? undefined) : undefined,
      ...(remainingDays !== undefined ? { remainingDays } : {}),
      minutesPerDay: dayMinutesPerDay,
      calendar: effCal,
      dayRecords: markerUnit === 'days'
        ? parseFieldRecords(opsTaskFieldText(te, OPS_DAY_MEASURE_DURATIONS_FIELD_ID, dayMeasureDurationsEnabled), MSPDI_DURATION_FIELDS) : {},
      exactRecords: markerUnit === 'hours'
        ? parseFieldRecords(opsTaskFieldText(te, OPS_EXACT_MINUTES_FIELD_ID, exactMinutesEnabled), MSPDI_DURATION_FIELDS) : {},
    });
    const durationUnit = measure.durationUnit;
    const durationMinutes = measure.durationMinutes;
    const duration = measure.scheduleDuration;
    const startRaw = getElementText(te, 'Start');
    const finishRaw = getElementText(te, 'Finish');
    // De tijdregel van het bestand (I8): 08:00 is alleen in een OPS-export van v2026.9.0 tot F5b een anker.
    const parseTaskDate = (raw: string): string | undefined => xmlTaskDate(raw, timeRule, isHour);
    const sourceStart = parseTaskDate(startRaw);
    const sourceFinish = parseTaskDate(finishRaw);
    const start = sourceStart ?? localTodayIso();
    const finish = sourceFinish ?? localTodayIso();
    // Onleesbaar is ontbrekend: dezelfde plaatshouder en ankerregel, zonder kapotte bronuitvoer.
    if (sourceStart === undefined) missingDates.start.add(id);
    if (sourceFinish === undefined) missingDates.finish.add(id);

    // "Datums zoals opgeslagen" voor MSPDI: MS Project's EIGEN rekenuitvoer — `EarlyStart`/
    // `EarlyFinish` (terugval `Start`/`Finish`), `LateStart`/`LateFinish`, `TotalSlack`/`FreeSlack`
    // (tienden van een minuut) en `Critical` (0/1) — als apart kanaal (`ImportResult.recordedTimes`),
    // nooit solverinvoer. Ontbrekende assen ontbreken.
    {
      const slackDays = (raw: string): number | undefined => {
        if (!raw) return undefined;
        const tenths = Number.parseFloat(raw);
        // Op een uurkalender in werktijd per dag, zoals XER (`readXerRecordedTimes`): de werktijd rekent
        // en toont (eigenaarsbesluit 2026-10-15, "een dag"); `<MinutesPerDay>` telt hier niet.
        return Number.isFinite(tenths) ? recordedFloatDays(tenths / 10, effHoursPerDay(effCal) * 60) : undefined;
      };
      const criticalRaw = getElementText(te, 'Critical');
      const earlyStartRaw = getElementText(te, 'EarlyStart');
      const earlyFinishRaw = getElementText(te, 'EarlyFinish');
      const recorded = buildRecordedTime({
        start: parseTaskDate(earlyStartRaw) ?? sourceStart,
        finish: parseTaskDate(earlyFinishRaw) ?? sourceFinish,
        lateStart: parseTaskDate(getElementText(te, 'LateStart')),
        lateFinish: parseTaskDate(getElementText(te, 'LateFinish')),
        totalFloat: slackDays(getElementText(te, 'TotalSlack')),
        freeFloat: slackDays(getElementText(te, 'FreeSlack')),
        isCritical: criticalRaw === '1' ? true : criticalRaw === '0' ? false : undefined,
      });
      if (recorded) recordedTimes[id] = recorded;
    }
    const isMilestone = getElementInt(te, 'Milestone') === 1;
    // Een UUR-modus-mijlpaal krijgt `milestoneKind` wanneer het opgeslagen anker (finish, of start als
    // finish ontbreekt) exact op een bandgrens van de EFFECTIEVE (gepromoveerde) kalender ligt
    // (`milestoneKindAt`, spiegel van de .mpp-lezer). `finish`/`start` zijn al de per-taakmodus
    // geparste waarden, zodat dit nooit een ander Finish-element raakt dan `time.scheduleFinish`.
    //
    // `isMilestone` impliceert GEEN duur 0: `Milestone=1` mét een reële duur is MSP-legitiem (zie
    // `CPMSolver.isZeroDurationMilestone`). Zonder de `durationMinutes === 0`-guard zou zo'n taak een
    // `milestoneKind` krijgen die haar opvolger via `snapSuccessorEarlyStart` verkeerd laat landen.
    //
    // Een door OPS geschreven bestand draagt de soort expliciet (`OPS_MilestoneKind`) — die marker
    // wint, ook in dagmodus en ook als hij "AUTO" zegt. Zonder marker geldt de afleiding hieronder.
    const effCalForMilestone = calById.get(effCalId);
    const opsMilestoneKind = isMilestone ? explicitOpsMilestoneKind(te, opsMilestoneKindMarkerEnabled) : undefined;
    const milestoneKind = opsMilestoneKind !== undefined
      ? (opsMilestoneKind === 'AUTO' ? undefined : opsMilestoneKind)
      : isMilestone && isHour && durationMinutes === 0 && effCalForMilestone
        ? milestoneKindAt(effCalForMilestone, parseInstant(finish || start))
        : undefined;
    const percentComplete = getElementInt(te, 'PercentComplete');
    const priority = getElementInt(te, 'Priority', 500);
    const description = getElementText(te, 'Notes');
    const customTaskType = readOpsCustomTaskType(te);
    if (customTaskType?.name && !customTaskTypes.has(customTaskType.id)) {
      customTaskTypes.set(customTaskType.id, { id: customTaskType.id, name: customTaskType.name });
    }

    // Actuals — leeg ⇒ undefined (invarianten volgen bij normalizeImportedProgress).
    const actualStartRaw = getElementText(te, 'ActualStart');
    const actualFinishRaw = getElementText(te, 'ActualFinish');
    const actualStart = parseTaskDate(actualStartRaw);
    const actualFinish = parseTaskDate(actualFinishRaw);
    // RemainingDuration: zie `measure` hierboven (urenmaat minuten, dagenmaat dagen).
    const remainingMinutes = measure.remainingMinutes;
    const remainingTime = measure.remainingTime;

    // Datumconstraint: ConstraintType/ConstraintDate. 0/ontbrekend ⇒ geen constraint. MSPDI kent geen
    // secundaire constraint. Datum: uur ⇒ echte tijd, dag ⇒ strip.
    let constraint: TaskConstraint | undefined;
    const cTypeRaw = getElementText(te, 'ConstraintType');
    if (cTypeRaw) {
      const mapped = mspCodeToConstraint(parseInt(cTypeRaw, 10));
      if (mapped) {
        const cdate = parseTaskDate(getElementText(te, 'ConstraintDate'));
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdate ? { date: cdate } : {}),
        };
      }
    }
    // Zachte deadline: native <Deadline> → task.deadline.
    const deadline = parseTaskDate(getElementText(te, 'Deadline'));

    // Baseline 0: eerste direct-kind <Baseline> met <Number>0</Number>.
    const baselineEls = te.getElementsByTagName('Baseline');
    for (let b = 0; b < baselineEls.length; b++) {
      const bEl = baselineEls[b];
      if (bEl.parentElement !== te) continue;
      if (getElementInt(bEl, 'Number', -1) !== 0) continue;
      // Dezelfde regel als de taakdatums (`parseTaskDate`): op een urenkalender houdt de baseline zijn
      // tijdstip (`YYYY-MM-DDTHH:mm`, zoals `saveBaseline` hem zelf vastlegt; PR #392, fixronde 5), en sinds
      // F5b ook in een vreemd bestand of een F5b-export (I8).
      const baselineStart = parseTaskDate(getElementText(bEl, 'Start'));
      const baselineFinish = parseTaskDate(getElementText(bEl, 'Finish'));
      // Onleesbaar (`NA`) = ontbrekend: zonder start én einde krijgt de taak geen baseline-entry, want
      // `BaselineTask` eist beide datums en een verzonnen datum (vandaag) zou een valse afwijking tonen.
      // Vóór deze regel brak `NA` bij een urentaak de hele import af (`RangeError`, VERVOLG 13 van #392).
      if (baselineStart === undefined || baselineFinish === undefined) break;
      baselineEntries.push({
        taskId: id,
        start: baselineStart,
        finish: baselineFinish,
        // Dezelfde dag als de taakduur (`mspdiBaselineDays`), anders leest een 24/7-taak haar eigen
        // baseline als 2,33 dagen terug, of een urentaak van 1870 u op 8 u/dag met blokken van 10 u
        // haar baseline als 234 d naast een taak van 187 d.
        duration: mspdiBaselineDays(getElementText(bEl, 'Duration'), durationUnit === 'hours', effCal, dayMinutesPerDay / 60),
        isMilestone,
      });
      break;
    }

    tasks.push({
      id,
      name,
      description,
      wbsCode: wbs,
      taskType: customTaskType ? 'USERDEFINED' : 'CONSTRUCTION',
      ...(customTaskType ? { customTaskTypeId: customTaskType.id } : {}),
      status: 'NOT_STARTED', // afgeleid door normalizeImportedProgress uit completion/actuals
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority,
      parentId: null,
      childIds: [],
      time: {
        durationType: taskDurationType(te),
        // DurationFormat bepaalt in MSPDI de schrijfnotatie (en elapsed-vlag), niet een
        // afzonderlijke dagtaaksemantiek. De bestaande precisiediscriminator bepaalt de
        // blijvende OPS-eenheid zodat de geplande brondata niet van betekenis verandert.
        durationUnit,
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
        remainingTime,
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
      ...(mspTaskType ? { mspTaskType } : {}),
      ...(effortDriven ? { effortDriven: true } : {}),
    });
    outlineLevels.push(getElementText(te, 'OutlineLevel') ? outlineLevel : undefined);

    // Parse predecessor links within task element. De lagrecords van deze opvolger (T21) staan in één
    // OPS-veld, met als sleutel voorganger-UID plus relatietype. Een sleutel die hier twee keer voorkomt,
    // is dubbelzinnig en telt niet.
    const lagRecords = dayMeasureLagsEnabled
      ? parseLagRecords(opsTaskFieldText(te, OPS_DAY_MEASURE_LAGS_FIELD_ID, true)) : new Map<string, LagRecord>();
    const predLinks = te.getElementsByTagName('PredecessorLink');
    const taskLinks: (typeof pendingLinks)[number][] = [];
    for (let j = 0; j < predLinks.length; j++) {
      const pl = predLinks[j];
      const predUid = getElementInt(pl, 'PredecessorUID', -1);
      const linkType = getElementInt(pl, 'Type', 1);
      const linkLag = getElementInt(pl, 'LinkLag', 0);
      const lagFormat = getElementInt(pl, 'LagFormat', 7);
      if (predUid >= 0) {
        taskLinks.push({
          successorId: id,
          predUid,
          type: linkType,
          lag: linkLag,
          lagFormat,
        });
      }
    }
    const keyCount = new Map<string, number>();
    const keyOf = (link: (typeof pendingLinks)[number]) => lagRecordKey(link.predUid, mspTypeToSequenceType(link.type));
    for (const link of taskLinks) keyCount.set(keyOf(link), (keyCount.get(keyOf(link)) ?? 0) + 1);
    for (const link of taskLinks) {
      const record = keyCount.get(keyOf(link)) === 1 ? lagRecords.get(keyOf(link)) : undefined;
      // MSPDI zegt kalendertijd met LagFormat; een record met een eigen eenheid hoort bij P6 XML.
      pendingLinks.push(record && record.length === 2 ? { ...link, record } : link);
    }
  }

  // Parent-child-hiërarchie: `<OutlineLevel>` + documentvolgorde, met de gepunte WBS als
  // scheidsrechter én terugval — de beslisregel staat bij `rebuildImportedHierarchy` (gedeeld met CSV).
  rebuildImportedHierarchy(tasks, outlineLevels);

  // Resolve sequences. LagFormat (subset van MSPDI DurationFormat): 19/20 = (elapsed) procent
  // met LinkLag in tienden van een procent; 4/6/8/10/12 = elapsed duren (24/7); rest = werktijd
  // in tienden van minuten.
  //
  // LinkLag draagt altijd tienden van minuten. Bij werktijd is LagFormat de weergave-eenheid (I1, T15):
  // zonder record is de lag urenmaat. Bij kalendertijd zegt LagFormat de eenheid (alleen uren §3.3):
  // 8 (ed) ⇒ kalenderdagen, zonder afronding (I2); 4/6/10/12 (em/eh/ew/emo) ⇒ kalenderminuten.
  // Een lag in de dagenmaat staat als record `[dagen, minuten]` in `OPS_DayMeasureLags` van de opvolger
  // (T21); de dagen tellen alleen als LinkLag nog de geschreven minuten draagt, en als de dagen met de
  // lagkalender van deze lezer nog die minuten geven (`lagRecordHolds`; review #585 r1, punt 1).
  const ELAPSED_DURATION_FORMATS = new Set([4, 6, 8, 10, 12]);
  const sequences: Sequence[] = [];
  for (const link of pendingLinks) {
    const predId = uidToId.get(link.predUid);
    if (!predId) continue;
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: link.successorId,
      type: mspTypeToSequenceType(link.type),
      lagDays: 0,
    };
    if (link.lagFormat === 19 || link.lagFormat === 20) {
      seq.lagPercent = link.lag / 10;
      if (link.lagFormat === 20) seq.lagUnit = 'ELAPSEDTIME';
    } else if (link.lagFormat === 8) {
      seq.lagDays = link.lag / 10 / ELAPSED_MINUTES_PER_DAY;
      seq.lagUnit = 'ELAPSEDTIME';
    } else if (!ELAPSED_DURATION_FORMATS.has(link.lagFormat) && lagRecordHolds(link.record, link.lag / 10,
      lagWorkMinutesPerDay(seq, lagCalendarOption, calendar, effCalByTaskId))) {
      Object.assign(seq, lagFromRecord(link.record));
    } else {
      seq.lagMinutes = Math.round(link.lag / 10);
      if (ELAPSED_DURATION_FORMATS.has(link.lagFormat)) seq.lagUnit = 'ELAPSEDTIME';
    }
    sequences.push(seq);
  }

  // Assignments
  const assignmentsRoot = root.getElementsByTagName('Assignments')[0];
  const assignments: ResourceAssignment[] = [];
  // Taak-lookup + kalender-engine per taakkalender voor de as-vertaling van `<TimephasedData>`
  // (zie `contourIo.ts`). Kalenders zijn hierboven al gepromoveerd, dus `calendarForEngine` levert
  // de juiste modus.
  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  const engineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = engineCache.get(key);
    if (!eng) {
      eng = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, resourceCalendars, calendar)));
      engineCache.set(key, eng);
    }
    return eng;
  };
  const contoursByTaskId = new Map<string, TaskTimephasedContour[]>();
  if (assignmentsRoot) {
    const asgnElements = assignmentsRoot.getElementsByTagName('Assignment');
    for (let i = 0; i < asgnElements.length; i++) {
      const asgnEl = asgnElements[i];
      if (asgnEl.parentElement !== assignmentsRoot) continue;
      const taskUid = getElementInt(asgnEl, 'TaskUID', -1);
      const resourceUid = getElementInt(asgnEl, 'ResourceUID', -1);
      if (taskUid < 0 || resourceUid < 0) continue;
      const taskId = uidToId.get(taskUid);
      const resourceId = resUidToId.get(resourceUid);
      if (!taskId || !resourceId) continue;

      const unitsText = getElementText(asgnEl, 'Units');
      const units = parseFloat(unitsText);
      const contour = getElementInt(asgnEl, 'WorkContour', 0);
      const curve = WORKCONTOUR_TO_CURVE[contour];
      const unitsPerDay = Number.isFinite(units) && unitsText ? units : 1;
      // <Work>/<ActualWork>/<RemainingWork> in minuten, alleen bewaard wanneer ze iets zeggen dat
      // `duur × inzet` niet al zegt (`importedWorkFields`).
      const workTask = taskById.get(taskId);
      const derivedWork = workTask ? taskWorkMinutes(workTask.time, effHpdByTaskId.get(taskId) ?? hoursPerDay) * unitsPerDay : 0;
      const workFields = importedWorkFields({
        plannedMinutes: mspDurationMinutes(getElementText(asgnEl, 'Work')) ?? undefined,
        actualMinutes: mspDurationMinutes(getElementText(asgnEl, 'ActualWork')) ?? undefined,
        remainingMinutes: mspDurationMinutes(getElementText(asgnEl, 'RemainingWork')) ?? undefined,
      }, derivedWork);

      assignments.push({
        id: generateId('asgn'),
        taskId,
        resourceId,
        unitsPerDay,
        ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
        ...workFields,
      });

      // Native `<TimephasedData>` (Type 1 = resterend, 2 = verricht werk; MPXJ
      // `MSPDIReader.readTimephasedWork`) → contourperiodes op de taak-as van déze taak, gekoppeld aan
      // de toewijzing via `resourceId`. Vlakke data (één item, of alleen nul-werk) levert géén contour
      // op. `WorkContour === 8` (Contoured) is het MSP-signaal, maar de data zelf is leidend.
      const task = taskById.get(taskId);
      if (task) {
        const items: AbsoluteWorkItem[] = [];
        const tpElements = asgnEl.getElementsByTagName('TimephasedData');
        for (let j = 0; j < tpElements.length; j++) {
          const tp = tpElements[j];
          if (tp.parentElement !== asgnEl) continue;
          const type = getElementInt(tp, 'Type', -1);
          if (type !== 1 && type !== 2) continue;
          const startRaw = getElementText(tp, 'Start');
          const finishRaw = getElementText(tp, 'Finish');
          if (!startRaw || !finishRaw) continue;
          const workMinutes = mspdiValueToMinutes(getElementText(tp, 'Value'));
          if (workMinutes === null) continue;
          items.push({
            start: parseImportedInstant(startRaw), finish: parseImportedInstant(finishRaw), workMinutes,
            kind: type === 2 ? 'actual' : 'remaining',
          });
        }
        if (items.length > 0 && task.time.scheduleStart) {
          const periods = absoluteItemsToContourPeriods(
            engineForTask(task), parseInstant(task.time.scheduleStart), items,
          );
          const hasWork = periods.some(p => p.workMinutes > 0);
          const informative = periods.length > 1 || contour === MSPDI_WORKCONTOUR_CONTOURED;
          if (hasWork && informative) collectContour(contoursByTaskId, taskId, { resourceUid, resourceId, periods });
        }
      }
    }
  }
  // Contouren én de daaruit afgeleide werkonderbrekingen op de taken zetten — dezelfde afleiding als
  // de .mpp-lezer (MSPDI kent geen andere split-bron).
  attachContours(taskById, contoursByTaskId);
  reconstructResourceIds(tasks, assignments);

  // Baseline 0 → één actieve OPS-baseline "Baseline (MSPDI)".
  const baselines: Baseline[] = [];
  let activeBaselineId: string | null = null;
  if (baselineEntries.length > 0) {
    const id = generateId('baseline');
    const finishes = baselineEntries.map(b => b.finish).filter(Boolean).sort();
    baselines.push({
      id,
      name: 'Baseline (MSPDI)',
      createdAt: new Date().toISOString(),
      tasks: baselineEntries,
      projectEnd: finishes[finishes.length - 1] || '',
      projectDuration: 0,
    });
    activeBaselineId = id;
  }

  // Ontbrekende Start/Finish (gedeelde regel, vóór de voortgang-invarianten): anker = de projectstart
  // uit het bestand, anders de vroegste aanwezige taakstart; finish uit start + duur op de effectieve
  // kalender van de taak (MSPDI levert elke kalender mee, dus eenduidig voor hele werkdagen).
  project.startDate = resolveMissingScheduleDates(tasks, missingDates, projectStartRaw ? project.startDate : '',
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));

  // Voortgang-invarianten op de rauw ingelezen actuals. De vastgelegde rest van een taak in de dagenmaat
  // blijft exact (B3), zoals de restminuten van een urentaak.
  normalizeKeepingDayRest(tasks, () => normalizeImportedProgress(tasks, project.statusDate));
  deriveImportedWorkRules(tasks); // werkregel uit <Type>/<EffortDriven>

  // Importverslag (issue #391): wat deze lezer niet overneemt. De OPS-transportvelden die hierboven
  // zijn gebruikt, tellen niet als eigen veld.
  const msProjectReport = scanMspdiImportLoss(root, (fieldId, value) =>
    (durationUnitMarkerFieldId !== null && fieldId === durationUnitMarkerFieldId)
    || (opsMilestoneKindMarkerEnabled && fieldId === OPS_MILESTONE_KIND_FIELD_ID)
    || (dayMeasureDurationsEnabled && fieldId === OPS_DAY_MEASURE_DURATIONS_FIELD_ID)
    || (exactMinutesEnabled && fieldId === OPS_EXACT_MINUTES_FIELD_ID)
    || (dayMeasureLagsEnabled && fieldId === OPS_DAY_MEASURE_LAGS_FIELD_ID)
    || (fieldId === OPS_CUSTOM_TASK_TYPE_FIELD_ID && decodeCustomTaskType(value) !== undefined));

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
    ...(hasMsProjectImportLoss(msProjectReport) ? { msProjectReport } : {}),
    customTaskTypes: [...customTaskTypes.values()],
    baselines,
    activeBaselineId,
    // Rekenprofielen: MSPDI opent als OPS.
    suggestedProfileId: 'ops',
    // Alleen bladtaken — zie `leafRecordedTimes`.
    ...(() => {
      const leafTimes = leafRecordedTimes(tasks, recordedTimes);
      return Object.keys(leafTimes).length > 0 ? { recordedTimes: leafTimes, recordedTimesOrigin: 'mspdi' as const } : {};
    })(),
  };
}

function parseProject(root: Element, timeRule: XmlTimeRule): Project {
  // Een ontbrekende FinishDate blijft leeg (de writer laat hem weg voor een project zonder
  // einddatum); `parseMSPDate` zou er de datum van vandaag van maken.
  const finishRaw = getElementText(root, 'FinishDate');
  const project: Project = {
    id: generateId('proj'),
    name: getElementText(root, 'Name') || getElementText(root, 'Title') || 'MS Project Import',
    description: '',
    startDate: parseMSPDate(getElementText(root, 'StartDate')),
    endDate: finishRaw ? parseMSPDate(finishRaw) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: getElementText(root, 'Author'),
    company: getElementText(root, 'Company'),
  };
  // Statusdatum → project.statusDate. Alleen wanneer aanwezig; de tijd blijft (uur-modus). In een bestand
  // van OPS betekent het dag-anker "geen tijd" — gedeeld met P6 (`statusDateFromXml`).
  const statusDateRaw = getElementText(root, 'StatusDate');
  if (statusDateRaw) project.statusDate = statusDateFromXml(statusDateRaw, timeRule);
  // CriticalSlackLimit → criticalDefinition.threshold (dagen, mode 'totalFloat'). Alleen wanneer het
  // element aanwezig is (spiegel van de writer). threshold 0 is de default (tf≤0) en dus inert. De
  // overige opties zitten niet in MSPDI (alleen via IFC).
  const cslRaw = getElementText(root, 'CriticalSlackLimit');
  if (cslRaw) {
    const csl = parseInt(cslRaw, 10);
    if (Number.isFinite(csl)) {
      project.schedulingOptions = { criticalDefinition: { mode: 'totalFloat', threshold: csl } };
    }
  }
  return project;
}

/** Poort van `MSPDIReader.readRecurringData` (org.mpxj.mspdi) — MSPDI-equivalent van
 *  mppCalendars.ts's `readRecurringData`, maar leest genaamde XML-elementen i.p.v. byte-offsets.
 *  `<Type>` draagt LETTERLIJK dezelfde codewaarde als MPP se `recurrenceTypeValue` (geverifieerd
 *  tegen de MPXJ-bron — `RECURRENCE_TYPES`/`RELATIVE_MAP` zijn daarom hergebruikt, niet gekopieerd).
 *  Retourneert `null` voor een out-of-range/afwezig `<Type>` ÉÉN voor een geflattende DAILY-
 *  recurrentie (frequentie 1 — spiegelt MSPDIReader se eigen slotblok: "flatten daily recurring
 *  exceptions if they only result in one date range"). */
function readMspdiRecurringData(exc: Element, fromDate: Date, toDate: Date | null): RecurrenceSpec | null {
  const typeValue = getElementInt(exc, 'Type', 0);
  const type = typeValue >= 0 && typeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[typeValue] : null;
  if (type === null) return null;
  const relative = typeValue < RELATIVE_MAP.length ? RELATIVE_MAP[typeValue] : false;
  const occurrences = getElementInt(exc, 'Occurrences', 0);
  // `getFrequency` (MSPDIReader.java): `<Period>` afwezig ⇒ 1 — spiegelt mppCalendars.ts's
  // DAILY-`@76`-asymmetrie functioneel (bij een niet-recurrente Type=1-export schrijft MSPDIWriter
  // nooit `<Period>`, dus de default-1 hier heeft hetzelfde effect als MPP se harde `frequency=1`
  // bij recurrenceTypeValue===1).
  const period = getElementInt(exc, 'Period', 1);

  let frequency = 1;
  let weeklyDayMask = 0;
  let dayNumber = 0;
  let dayOfWeekValue = 0;
  let monthNumber = 0;

  switch (type) {
    case 'DAILY':
      frequency = period;
      break;
    case 'WEEKLY':
      // `<DaysOfWeek>` is al de bitmap in DAY_MASKS-layout (bit0=zondag..bit6=zaterdag) — zelfde
      // conventie als MPP se `weeklyDayMask` (geverifieerd: MSPDIReader se `DAY_MASKS` is byte-voor-
      // byte gelijk aan mppCalendars.ts's aanname), dus geen vertaalslag nodig.
      weeklyDayMask = getElementInt(exc, 'DaysOfWeek', 0);
      frequency = period;
      break;
    case 'MONTHLY':
      if (relative) {
        dayOfWeekValue = getElementInt(exc, 'MonthItem', 0) - 2;
        dayNumber = getElementInt(exc, 'MonthPosition', 0) + 1;
      } else {
        dayNumber = getElementInt(exc, 'MonthDay', 0);
      }
      frequency = period;
      break;
    case 'YEARLY':
      if (relative) {
        dayOfWeekValue = getElementInt(exc, 'MonthItem', 0) - 2;
        dayNumber = getElementInt(exc, 'MonthPosition', 0) + 1;
      } else {
        dayNumber = getElementInt(exc, 'MonthDay', 0);
      }
      monthNumber = getElementInt(exc, 'Month', 0) + 1;
      // MSPDIReader leest hier GEEN `<Period>` (YEARLY kent geen frequentie-veld in het schema) —
      // `frequency` blijft op de default (1), ongebruikt door `expandRecurrence`'s YEARLY-tak.
      break;
  }

  if (type === 'DAILY' && frequency === 1) return null; // flatten, spiegelt MSPDIReader
  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

/** De banden (minuten) van een `<WorkingTimes><WorkingTime>`-lijst die DIRECT onder `parent` staat,
 *  plus de tekst van het eerste `<WorkingTime>` (voor de scalaire uren van een weekdag). Gedeeld door
 *  de werkweek, `<Exception>` en de oude `DayType 0`-vorm. */
function readWorkingTimes(parent: Element): { bands: { start: number; end: number }[]; first?: { from: string; to: string } } {
  const bands: { start: number; end: number }[] = [];
  let first: { from: string; to: string } | undefined;
  const roots = parent.getElementsByTagName('WorkingTimes');
  for (let r = 0; r < roots.length; r++) {
    const timesRoot = roots[r];
    if (timesRoot.parentElement !== parent) continue;
    const workingTimeEls = timesRoot.getElementsByTagName('WorkingTime');
    for (let k = 0; k < workingTimeEls.length; k++) {
      const wt = workingTimeEls[k];
      if (wt.parentElement !== timesRoot) continue;
      const fromText = getElementText(wt, 'FromTime');
      const toText = getElementText(wt, 'ToTime');
      if (!first) first = { from: fromText, to: toText };
      const st = clockToMinutes(fromText);
      const en = clockToMinutes(toText);
      if (st != null && en != null) bands.push({ start: st, end: en });
    }
    break;
  }
  return { bands, first };
}

/** De banden van een werkende uitzondering in de canonieke vorm van `WorkingException.bands`
 *  (`end > start`, zie `types/calendar.ts`). Een tijdvak dat op of vóór zijn begin eindigt, loopt over
 *  middernacht en krijgt `+1440`. MS Project (en een Asta-export) schrijft een hele werkdag als
 *  `00:00:00`–`00:00:00`; zonder deze stap werd dat `{0, 0}`: nul werkminuten in de uurrekening. De
 *  werkweek loopt al via `canonicalizeBands`, de P6 XML-, XER- en `.mpp`-lezer leveren al canoniek, en
 *  de IFC-lezer canoniseert bij het teruglezen. Zonder deze stap rekende F5 dus vóór en ná een
 *  IFC-rondgang anders (Miraya.xml, 2026-10-19). Ook gebruikt voor het ene blok van de scalaire
 *  werkdag (`applyCalendarBody`): dezelfde regel als `canonicalizeBands`. */
function canonicalExceptionBands(bands: { start: number; end: number }[]): { start: number; end: number }[] {
  return bands.map((b) => (b.end <= b.start ? { start: b.start, end: b.end + 1440 } : b));
}

/** Leest alle `<Exception>`-elementen van één `<Calendar>` in RUWE vorm — geklemd op
 *  `MAX_CALENDAR_EXCEPTIONS` (gedeeld met de MPP-kant via `@/services/calendarRecurrence`). Spiegelt
 *  MSPDIReader.readException's guard: een record zonder BEIDE FromDate/ToDate wordt overgeslagen
 *  ("Vico Schedule Planner"-leeg-record-guard); een record met een fromDate maar zonder toDate is
 *  alleen bruikbaar als het een RECURRENTE (occurrences-begrensde) uitzondering is.
 *
 *  Retourneert de formaat-neutrale `RawException[]` voor `buildContributions`. `periodCount` spiegelt
 *  MPP's `periodCount>0`-signaal (alleen "> 0" telt): `Math.max(bands.length, 1)` bij een werkende
 *  uitzondering, zodat ook een werkende uitzondering ZONDER `<WorkingTimes>` als werkend blijft
 *  signaleren (zie de fallbackketen van `WorkingException` in `types/calendar.ts`), anders `0`. */
function readRawMspdiExceptions(calEl: Element): RawException[] {
  const exceptionsRoot = calEl.getElementsByTagName('Exceptions')[0];
  if (!exceptionsRoot) return readLegacyDayExceptions(calEl);
  const exceptionEls = exceptionsRoot.getElementsByTagName('Exception');
  const out: RawException[] = [];
  const limit = Math.min(exceptionEls.length, MAX_CALENDAR_EXCEPTIONS); // zie MAX_CALENDAR_EXCEPTIONS (calendarRecurrence.ts)
  for (let i = 0; i < limit; i++) {
    const exc = exceptionEls[i];
    if (exc.parentElement !== exceptionsRoot) continue;

    const timePeriod = exc.getElementsByTagName('TimePeriod')[0];
    if (!timePeriod) continue;
    const fromDateRaw = getElementText(timePeriod, 'FromDate');
    const toDateRaw = getElementText(timePeriod, 'ToDate');
    if (!fromDateRaw && !toDateRaw) continue; // beide leeg — spiegelt MSPDIReader's Vico-guard
    if (!fromDateRaw) continue; // startdatum is altijd vereist om te kunnen materialiseren

    const fromDate = parseDate(parseMSPDate(fromDateRaw));
    const toDate = toDateRaw ? parseDate(parseMSPDate(toDateRaw)) : null;

    const dayWorking = getElementInt(exc, 'DayWorking', 0) === 1;
    const name = getElementText(exc, 'Name');

    const bands = dayWorking ? canonicalExceptionBands(readWorkingTimes(exc).bands) : [];

    const recurring = readMspdiRecurringData(exc, fromDate, toDate);
    if (!recurring && !toDate) continue; // niet-recurrent bereik zonder einddatum: geen bruikbaar bereik

    const periodCount = dayWorking ? Math.max(bands.length, 1) : 0;
    out.push({ fromDate, toDate, periodCount, bands, name, recurring });
  }
  return out.length > 0 ? out : readLegacyDayExceptions(calEl);
}

/** Uitzonderingen in het oude MSPDI-formaat (Project 2003 en ouder): een `<WeekDays><WeekDay>` met
 *  `DayType` 0 en een `<TimePeriod>`. Alleen gelezen als de kalender geen `<Exception>` oplevert,
 *  zoals MPXJ `MSPDIReader.readDay`/`readExceptionDay` (`readExceptionsFromDays`). Net als daar is
 *  zo'n dag werkend als hij `<WorkingTimes>` met banden heeft, anders vrij. Geen naam in dit formaat. */
function readLegacyDayExceptions(calEl: Element): RawException[] {
  const weekDays = calEl.getElementsByTagName('WeekDay');
  const out: RawException[] = [];
  for (let i = 0; i < weekDays.length && out.length < MAX_CALENDAR_EXCEPTIONS; i++) {
    const wd = weekDays[i];
    if (wd.parentElement?.tagName !== 'WeekDays' || wd.parentElement.parentElement !== calEl) continue;
    if (getElementInt(wd, 'DayType', -1) !== 0) continue;
    const timePeriod = wd.getElementsByTagName('TimePeriod')[0];
    if (!timePeriod) continue;
    const fromDateRaw = getElementText(timePeriod, 'FromDate');
    const toDateRaw = getElementText(timePeriod, 'ToDate');
    if (!fromDateRaw || !toDateRaw) continue;
    const bands = canonicalExceptionBands(readWorkingTimes(wd).bands);
    out.push({
      fromDate: parseDate(parseMSPDate(fromDateRaw)),
      toDate: parseDate(parseMSPDate(toDateRaw)),
      periodCount: bands.length,
      bands,
      name: '',
      recurring: null,
    });
  }
  return out;
}

/**
 * Werkdagen/uren/feestdagen uit een `<Calendar>`-element in `calendar` toepassen (spiegel van
 * `writeCalendarBlock`) — gedeeld tussen de projectkalender en elke bibliotheekkalender
 * (`readCalendars`). `week` is de effectieve werkweek (`effectiveWeek`). Ontbrekende WeekDay/WorkingTime-elementen laten de werkweek en uren van
 * `createDefaultCalendar()` ongemoeid. De feestdagen volgen de regel onderaan (basis, eigen
 * uitzonderingen, eigen werkweek ⇒ leeg, alleen een kale kalender houdt de NL-standaard).
 *
 * `budget` is één gedeeld `HolidayBudget` over ALLE kalenders in één `readMSPDI`-aanroep (zoals
 * `MAX_TOTAL_HOLIDAY_SLOTS` in mppCalendars.ts): anders kunnen N kalenders elk binnen
 * `MAX_CALENDAR_EXCEPTIONS` blijven maar samen een onbegrensde materialisatie forceren.
 */
function applyCalendarBody(
  calEl: Element, calendar: WorkCalendar, budget: HolidayBudget,
  inherit: { declared: boolean; base: WorkCalendar | null }, week: WeekEntry[] | null, opsFile: boolean,
): void {
  const workDays: number[] = [];
  // ALLE <WorkingTime>-banden per weekdag lezen → rauwe banden voor de uur-modus-beslissing.
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};

  // Werkdagen met tijden: daaruit komt de scalaire werkdag (hieronder).
  const timedDays: WeekEntry[] = [];

  // `week` is de effectieve standaardwerkweek (eigen dagen, en bij een afgeleide kalender de rest van
  // de basis — `effectiveWeek`). `null` ⇒ geen werkweek bekend: de werkweek en uren van
  // `createDefaultCalendar()` blijven staan.
  for (const day of week ?? []) {
    if (!day.working) continue;
    // Convert MSP day (1=Sun, 2=Mon, ..., 7=Sat) to ISO (1=Mon, ..., 7=Sun)
    const isoDay = day.dayType === 1 ? 7 : day.dayType - 1;
    workDays.push(isoDay);
    if (day.bands.length > 0) rawByWeekday[isoDay as 1] = day.bands;
    if (day.firstTime) timedDays.push(day);
  }
  // De scalaire werkdag: de eerste werkdag met tijden in MS Project-volgorde (zondag eerst,
  // `SCALAR_DAY_ORDER`), niet in bestandsvolgorde: de eigen schrijver zet maandag eerst, en dan koos een
  // rondgang een andere dag. Daarvan de tijden van het eerste `WorkingTime`-element (alleen nog de
  // terugval voor een onleesbare kloktijd) en de leesbare blokken.
  const scalarDay = [...timedDays].sort((a, b) => a.dayType - b.dayType)[0];
  const firstWorkingTime = scalarDay?.firstTime;
  const firstDayBands = scalarDay?.bands;

  if (workDays.length > 0) {
    calendar.workDays = workDays.sort((a, b) => a - b);
  }

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const shared = sharedWeekBlocks(bands);
  // Dagkalender met pauze uit een eigen export: de schrijver zet de effectieve blokken van een
  // dagkalender (`effectiveWorkTimeBands`) op elke werkdag, dus twee gelijke blokken per werkdag. Alleen
  // in een bestand van OPS zelf (de OPS-marker): een bestand van MS Project met 08:00–12:00 +
  // 13:00–17:00 blijft een uurkalender, zoals de `.mpp`-lezer hem leest. Een echte pauze tussen de
  // blokken, binnen de dag.
  const dayWithBreak = opsFile ? opsDayWithBreak(bands) : undefined;
  // Uurkalender bij een afwijking van de enkelvoudige werkdag (`canonicalizeBands`: meer blokken,
  // over middernacht, een hele dag), en bij werkdagen met verschillende blokken: één werkdag voor de hele
  // week kan dat niet bewaren. Zo'n kalender las vroeger als dagkalender met de werktijd van de eerste
  // werkdag op alle werkdagen (0402ScheduleMSP.xml: zondag 00:08–00:16, ma–vr 08:00–16:00).
  const hourShape = (deviates && !dayWithBreak) || shared === 'verschilt';

  // Scalaire werkdag (dag-pad, en wat de kalenderdialoog toont) uit de standaardwerkweek hierboven,
  // niet het eerste `WorkingTime` van de hele kalender: dat kan van een uitzondering of een tijdelijke
  // werkweek zijn (een kalender zonder eigen `WeekDays` houdt zo zijn standaarduren).
  const blocked = firstDayBands && firstDayBands.length > 1 ? workDayFromBlocks(firstDayBands) : undefined;
  const singleBand = firstDayBands?.length === 1 ? canonicalExceptionBands(firstDayBands)[0] : undefined;
  if (dayWithBreak) {
    // Begin, einde en uren per dag op de minuut. De pauze krijgt alleen eigen velden als de afleiding
    // zonder pauzevelden (`seedScalarBands`: het verschil rond 12:00) andere blokken geeft; zo komt
    // een kalender zonder pauzevelden (de standaard 07:00–16:00, 8 uur) ook zo terug.
    const [first, second] = dayWithBreak;
    const net = (first.end - first.start) + (second.end - second.start);
    calendar.workStartHour = first.start / 60;
    calendar.workEndHour = second.end / 60;
    calendar.hoursPerDay = net / 60;
    if (!sameBlocks(seedScalarBands(first.start, second.end, net / 60), dayWithBreak)) {
      calendar.simpleBreakStartMinute = first.end;
      calendar.simpleBreakDurationMinutes = second.start - first.end;
    }
  } else if (blocked) {
    // Meer blokken: begin eerste / einde laatste blok (MS Projects 08:00–12:00 + 13:00–17:00 ⇒ 8–17),
    // zoals de P6 XML- en XER-lezer. De tussenwaarde `hoursPerDay` vóór promotie is NETTO (de som van
    // de blokken, modaal over de week — precies wat `promoteHourCalendar` daarna zet); einde min begin
    // zou de pauze meetellen.
    calendar.workStartHour = blocked.startHour;
    calendar.workEndHour = blocked.endHour;
    calendar.hoursPerDay = deriveHoursPerDay(bands, blocked.netHours);
  } else if (singleBand) {
    // Eén blok: begin, einde en uren per dag op de minuut, in de canonieke vorm (`end > start`;
    // `00:00:00`–`00:00:00` is 0–1440, een nachtblok 22:00–06:00 is 1320–1800 ⇒ 22–30). Vroeger telde
    // alleen het uurdeel van de kloktijd: 07:30–16:00 werd 7–16 met 9 uur per dag.
    calendar.workStartHour = singleBand.start / 60;
    calendar.workEndHour = singleBand.end / 60;
    calendar.hoursPerDay = (singleBand.end - singleBand.start) / 60;
  } else if (firstWorkingTime) {
    // Terugval voor een kloktijd zonder `HH:MM`-vorm (`clockToMinutes` geeft dan geen blok): het
    // getal vóór de eerste `:`. Een oudere eigen export schreef 07:30 als `7.5:00:00`; dat wordt 7,5.
    const fromTime = firstWorkingTime.from;
    const toTime = firstWorkingTime.to;
    if (fromTime) {
      const h = scalarHourFromClock(fromTime);
      if (!isNaN(h)) calendar.workStartHour = h;
    }
    if (toTime) {
      const h = scalarHourFromClock(toTime);
      // `00:00:00` als eindtijd is middernacht ná de start (MS Project's eigen "24 Hours"-kalender en
      // onze writer schrijven dat zo) ⇒ 24, niet 0.
      if (!isNaN(h)) calendar.workEndHour = h <= calendar.workStartHour ? h + 24 : h;
    }
    calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    if (calendar.hoursPerDay <= 0) calendar.hoursPerDay = 8;
  }

  registerCalendarBands(calendar, { canonical: bands, deviates: hourShape });

  // Uitzonderingen (holidays + werkende uitzonderingen + recurrente expansie) via
  // `buildContributions` + `resolveContributions`. Welke feestdagen een kalender krijgt:
  //  1. Afgeleide kalender met een gevonden basis: de uitzonderingen van de basis, met de eigen
  //     eroverheen (eigen wint per datum) — zoals MS Project. Altijd via `mergeInherited` onder het
  //     gedeelde budget, zoals `.mpp`: ook een "lege" afgeleide kalender telt mee in
  //     `MAX_TOTAL_HOLIDAY_SLOTS` (anders: N afgeleide kalenders × een grote basis zonder grens).
  //  2. Een basis-UID die niet bestaat (`0` in Project 2013+, `-65533`, onbekend) maakt de kalender
  //     een wortel: zijn eigen week en uitzonderingen (regels 3–4). Zit hij in een cyclus of ligt hij te
  //     diep: idem, zonder overerving. In geen van beide een NL-terugval: zoals `.mpp` (besluit
  //     orkestrator 2026-10-13, review #335) — "kaal" betekent "geen basis genoemd".
  //  3. Eigen uitzonderingen: precies die. De beslissing hangt af van het AANTAL ruwe records, niet
  //     van de resolved lengte (die is 0 bij een kalender met alleen werkende uitzonderingen).
  //  4. Eigen werkweek zonder uitzonderingen: een volledige MS Project-kalender ⇒ GEEN feestdagen.
  //     Zelfde regel als de P6 XML-lezer; `.mpp` begint altijd leeg.
  //  5. Kale kalender (`<BaseCalendarUID>` -1 of ontbrekend, geen werkweek, geen uitzonderingen): de
  //     NL-standaard van `createDefaultCalendar()` blijft staan.
  const rawExceptions = readRawMspdiExceptions(calEl);
  let parsed: { holidays: WorkCalendar['holidays']; workingExceptions: NonNullable<WorkCalendar['workingExceptions']> } | null = null;
  if (inherit.base) {
    parsed = mergeInherited(
      { holidays: inherit.base.holidays, workingExceptions: inherit.base.workingExceptions ?? [] },
      buildContributions(rawExceptions, budget), budget);
  } else if (inherit.declared || rawExceptions.length > 0) {
    parsed = resolveContributions(buildContributions(rawExceptions, budget), budget);
  } else if (week !== null) {
    parsed = { holidays: [], workingExceptions: [] };
  }
  if (parsed) {
    calendar.holidays = parsed.holidays;
    // `workingExceptions` blijft AFWEZIG (niet `[]`) wanneer leeg, zoals in mppCalendars.ts.
    if (parsed.workingExceptions.length > 0) calendar.workingExceptions = parsed.workingExceptions;
    else delete calendar.workingExceptions;
  }
}

/** Eén dag van de standaardwerkweek (`<WeekDays><WeekDay>` met `DayType` 1–7). */
interface WeekEntry {
  /** MSP-dagcode: 1 = zondag … 7 = zaterdag. */
  dayType: number;
  working: boolean;
  bands: { start: number; end: number }[];
  /** Tekst van het eerste `<WorkingTime>` (voor de scalaire uren); afwezig zonder werktijden. */
  firstTime?: { from: string; to: string };
}

/** De EIGEN standaardwerkweek van een `<Calendar>`, in documentvolgorde. Alleen
 *  `<Calendar><WeekDays><WeekDay>`: een tijdelijke werkweek (`<WorkWeeks><WorkWeek><WeekDays>`, bv. een
 *  zomerrooster met zaterdag) heeft óók een `WeekDays`-ouder; zonder de grootouder-check werden die
 *  dagen permanente werkdagen van het hele jaar. `DayType` 0 is een uitzondering (oude vorm). */
function readOwnWeek(calEl: Element): WeekEntry[] {
  const weekDays = calEl.getElementsByTagName('WeekDay');
  const out: WeekEntry[] = [];
  for (let i = 0; i < weekDays.length; i++) {
    const wd = weekDays[i];
    if (wd.parentElement?.tagName !== 'WeekDays' || wd.parentElement.parentElement !== calEl) continue;
    const dayType = getElementInt(wd, 'DayType');
    if (dayType < 1 || dayType > 7) continue;
    const working = getElementInt(wd, 'DayWorking') === 1;
    const times = working ? readWorkingTimes(wd) : { bands: [] as { start: number; end: number }[], first: undefined };
    out.push({ dayType, working, bands: times.bands, firstTime: times.first });
  }
  return out;
}

/** Effectieve werkweek. Zonder (bekende) week van de basis: de eigen week (leeg ⇒ `null`, de
 *  app-standaard blijft). Anders per weekdag: de eigen `<WeekDay>` wint, een niet-genoemde dag komt van
 *  de basis — zoals MS Project en MPXJ (`DayType.DEFAULT` ⇒ ouderkalender). Volgorde zo → za. */
function effectiveWeek(own: WeekEntry[], baseWeek: WeekEntry[] | null): WeekEntry[] | null {
  if (!baseWeek) return own.length > 0 ? own : null;
  const byDay = new Map<number, WeekEntry>();
  for (const d of baseWeek) byDay.set(d.dayType, d);
  for (const d of own) byDay.set(d.dayType, d);
  return [...byDay.values()].sort((x, y) => x.dayType - y.dayType);
}

/** Leest alle `<Calendar>`-elementen. De projectkalender is die van `<Project><CalendarUID>`; ontbreekt
 *  die of wijst hij naar niets, dan het eerste element (het oude gedrag). Alle andere kalenders worden
 *  bibliotheekkalenders, ook UID 1 — zoals `.mpp` (`mppCalendars.ts`: projectkalender via de
 *  project-UID, de rest wordt resourcekalender). `calUidToId` kent alleen de bibliotheekkalenders: een
 *  verwijzing naar de projectkalender (of -1) blijft "projectkalender".
 *
 *  Een afgeleide kalender (`<BaseCalendarUID>` ≠ -1) erft in MS Project de werkweek en de
 *  uitzonderingen van zijn basis. Of hij erft, hangt alleen van de structuur af, niet van de
 *  documentvolgorde: de keten naar een wortel wordt eerst gemeten (`chainOk`). Een wortel is een
 *  kalender waarvan de basis-UID niet in het bestand staat (`-1`, `0`, …). Alleen een keten die in een
 *  cyclus eindigt (ook een zelfverwijzing) of langer is dan `MAX_BASE_CHAIN_DEPTH`, erft niet. */
function readCalendars(root: Element, budget: HolidayBudget): {
  calendar: WorkCalendar; resourceCalendars: WorkCalendar[]; calUidToId: Map<number, string>;
  /** De UID van de projectkalender (niet in `calUidToId`); ontbreekt zonder kalenders. */
  projectCalUid?: number;
  /** `<MinutesPerDay>` / 60 als hij op de projectkalender staat; zie de promotie in `readMSPDI`. */
  projectFileHoursPerDay?: number;
} {
  const fileMinutesPerDay = getElementInt(root, 'MinutesPerDay');
  // Een bestand van OPS zelf (de OPS-taakeenheid is gedefinieerd): zie `dayWithBreak` in `applyCalendarBody`.
  const opsFile = opsDurationUnitFieldId(root) !== null;
  const projectFileHoursPerDay = fileMinutesPerDay > 0 ? fileMinutesPerDay / 60 : undefined;
  const calendarsRoot = root.getElementsByTagName('Calendars')[0];
  const allEls = new Map<number, Element>();
  if (calendarsRoot) {
    const calElements = calendarsRoot.getElementsByTagName('Calendar');
    for (let i = 0; i < calElements.length; i++) {
      const calEl = calElements[i];
      if (calEl.parentElement !== calendarsRoot) continue;
      const uid = getElementInt(calEl, 'UID', -1);
      if (uid < 0 || allEls.has(uid)) continue;
      allEls.set(uid, calEl);
    }
  }
  const calUidToId = new Map<number, string>();
  const first = allEls.keys().next();
  if (first.done) return { calendar: createDefaultCalendar(), resourceCalendars: [], calUidToId };

  // `<CalendarUID>` als DIRECT kind van `<Project>` — taken en resources hebben hun eigen.
  let declared = -1;
  const uidEls = root.getElementsByTagName('CalendarUID');
  for (let i = 0; i < uidEls.length; i++) {
    if (uidEls[i].parentElement !== root) continue;
    declared = toInt(uidEls[i].textContent ?? '', -1);
    break;
  }
  const projectCalUid = allEls.has(declared) ? declared : first.value;

  const baseUidOf = (uid: number): number => getElementInt(allEls.get(uid)!, 'BaseCalendarUID', -1);
  /** Bereikt de keten vanaf `uid` binnen `MAX_BASE_CHAIN_DEPTH` stappen een WORTEL: een kalender
   *  waarvan de `<BaseCalendarUID>` niet naar een `<Calendar>` in het bestand wijst? Dat is `-1`
   *  (Project 2007/2010), `0` (Project 2013 en later: UID 0 bestaat niet), `-65533` of elk ander
   *  onbekend nummer — zoals MPXJ (`map.get` geeft `null`: geen ouder) en `.mpp`
   *  (`baseCalendarUniqueId <= 0` = basiskalender). Nee alleen bij een cyclus (ook een
   *  zelfverwijzing) of een te lange keten: een cyclus bereikt nooit een wortel en loopt dus tegen de
   *  stapgrens — dat is de cyclusbewaking. */
  const chainMemo = new Map<number, boolean>();
  const chainOk = (uid: number): boolean => {
    const known = chainMemo.get(uid);
    if (known !== undefined) return known;
    let cur = uid;
    let ok = false;
    for (let steps = 0; steps <= MAX_BASE_CHAIN_DEPTH; steps++) {
      const b = baseUidOf(cur);
      if (!allEls.has(b)) { ok = true; break; }
      cur = b;
    }
    chainMemo.set(uid, ok);
    return ok;
  };

  const resolved = new Map<number, WorkCalendar>();
  const weekOf = new Map<number, WeekEntry[] | null>();
  // Recursie alleen langs een gemeten, eindige keten (`chainOk`): diepte ≤ MAX_BASE_CHAIN_DEPTH.
  const resolve = (uid: number): WorkCalendar => {
    const done = resolved.get(uid);
    if (done) return done;
    const calEl = allEls.get(uid)!;
    const baseUid = baseUidOf(uid);
    // `declaredBase`: het bestand noemt een basis (alles behalve -1/ontbrekend). Alleen voor de
    // NL-terugval (regel 5 in `applyCalendarBody`): een kalender met een genoemde basis is nooit "kaal".
    const declaredBase = baseUid !== -1;
    const base = allEls.has(baseUid) && chainOk(uid) ? resolve(baseUid) : null;
    const week = effectiveWeek(readOwnWeek(calEl), base ? weekOf.get(baseUid) ?? null : null);
    const cal = createDefaultCalendar();
    if (uid === projectCalUid) {
      cal.name = getElementText(calEl, 'Name') || 'Imported Calendar';
    } else {
      cal.id = generateId('rescal');
      cal.name = getElementText(calEl, 'Name') || cal.name;
    }
    // MSPDI kent geen regelset-herkomst — createDefaultCalendar() zet 'm altijd (nieuwe projecten zijn
    // per definitie gegenereerd); een uit MSPDI gelezen kalender is dat niet.
    delete cal.generation;
    applyCalendarBody(calEl, cal, budget, { declared: declaredBase, base }, week, opsFile);
    if (uid === projectCalUid) {
      // `<MinutesPerDay>` op projectniveau is authoritatief voor de projectkalender en overschrijft de
      // WorkingTime-afgeleide waarde uit applyCalendarBody. Alleen voor de projectkalender: een
      // afgeleide kalender rekent zijn `hoursPerDay` uit zijn eigen (geërfde) blokken, net als elke
      // andere bibliotheekkalender.
      if (projectFileHoursPerDay !== undefined) cal.hoursPerDay = projectFileHoursPerDay;
    }
    resolved.set(uid, cal);
    weekOf.set(uid, week);
    return cal;
  };

  const calendar = resolve(projectCalUid);
  // MAX_MSPDI_CALENDARS begrenst het AANTAL bibliotheekkalenders; volgorde = documentvolgorde.
  const resourceCalendars: WorkCalendar[] = [];
  for (const uid of allEls.keys()) {
    if (resourceCalendars.length >= MAX_MSPDI_CALENDARS) break;
    if (uid === projectCalUid) continue;
    const cal = resolve(uid);
    calUidToId.set(uid, cal.id);
    resourceCalendars.push(cal);
  }
  return { calendar, resourceCalendars, calUidToId, projectCalUid, ...(projectFileHoursPerDay !== undefined ? { projectFileHoursPerDay } : {}) };
}
