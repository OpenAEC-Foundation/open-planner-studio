import { Task, TaskConstraint, ConstraintType, type MilestoneKind } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { availabilityFromPeriods, type MspdiAvailabilityPeriod } from '@/services/msproject/mspdiAvailability';
import { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { Baseline, BaselineTask } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { parseInstant, parseDate, localTodayIso } from '@/utils/dateUtils';
import { normalizeImportedProgress, deriveImportedWorkRules, rebuildImportedHierarchy, reconstructResourceIds } from '@/services/importNormalize';
import { emptyMissingScheduleDates, isoDatePrefixOrToday, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { childElementNames, childElements, directChildText, startsWithNames, toInt, toFloat } from '@/services/xmlDom';
import { hasMsProjectImportLoss, type ImportResult } from '@/services/importTypes';
import { scanMspdiImportLoss } from '@/services/msproject/mspdiImportLoss';
import type { CustomTaskTypeDraft } from '@/types/taskType';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
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
  dayMeasureMinutesPerDay, lagFromRecord, lagRecordHolds, lagRecordKey, lagWorkMinutesPerDay,
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

export function isLegacyOpsMspdi(root: Element): boolean {
  const head = childElementNames(root);
  if (root.localName !== 'Project' || head.includes('SaveVersion')
    || !startsWithNames(head, ['Name', 'Title', 'Author', 'Company', 'CreationDate', 'StartDate'])) return false;
  if (!/^\d{4}-\d{2}-\d{2}T08:00:00$/.test(directChildText(root, 'CreationDate'))) return false;
  const containers = childElements(root, 'Tasks');
  if (containers.length !== 1) return false;
  const tasks = childElements(containers[0], 'Task');
  const summary = tasks[0];
  if (!summary || directChildText(summary, 'UID') !== '0'
    || childElementNames(summary).join() !== 'UID,ID,Name,OutlineLevel,Summary') return false;
  return tasks.slice(1).every(te => startsWithNames(childElementNames(te),
    ['UID', 'ID', 'Name', 'Duration', 'Start', 'Finish', 'WBS', 'OutlineLevel', 'Summary', 'Milestone']));
}

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

function opsTaskFieldText(te: Element, fieldId: string, enabled: boolean): string | undefined {
  if (!enabled) return undefined;
  const values = te.getElementsByTagName('ExtendedAttribute');
  for (let i = 0; i < values.length; i++) {
    if (values[i].parentElement !== te) continue;
    if (getElementText(values[i], 'FieldID') === fieldId) return getElementText(values[i], 'Value');
  }
  return undefined;
}

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

function explicitOpsMilestoneKind(te: Element, enabled: boolean): MilestoneKind | 'AUTO' | undefined {
  return enabled ? opsTaskFieldValue(te, OPS_MILESTONE_KIND_FIELD_ID, ['START', 'FINISH', 'AUTO'] as const) : undefined;
}

function taskDurationUnit(te: Element, opsMarkerFieldId: string | null): 'days' | 'hours' {
  return explicitOpsDurationUnit(te, opsMarkerFieldId) ?? 'hours';
}

const MAX_MSPDI_CALENDARS = 1_024;

function getElementText(parent: Element, tagName: string): string {
  return directChildText(parent, tagName);
}

function isXmlTrue(text: string): boolean {
  return text === '1' || text.trim().toLowerCase() === 'true';
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  return toInt(getElementText(parent, tagName), fallback);
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  return toFloat(getElementText(parent, tagName), fallback);
}

function readAvailabilityPeriods(resEl: Element): MspdiAvailabilityPeriod[] {
  const rows = resEl.getElementsByTagName('AvailabilityPeriod');
  const periods: MspdiAvailabilityPeriod[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    periods.push({
      from: getElementText(row, 'AvailableFrom').slice(0, 10),
      to: getElementText(row, 'AvailableTo').slice(0, 10),
      units: getElementFloat(row, 'AvailableUnits', NaN),
    });
  }
  return periods;
}

function firstRatesStandardRate(resEl: Element): string {
  const ratesEl = childElements(resEl, 'Rates')[0];
  if (!ratesEl) return '';
  const rate = childElements(ratesEl, 'Rate')[0];
  return rate ? directChildText(rate, 'StandardRate') : '';
}

function parseMSPDate(s: string): string {
  return isoDatePrefixOrToday(s);
}

function mspDurationMinutes(s: string): number | null {
  if (!s) return null;
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  return Math.round(parseFloat(m[1] || '0') * 1440 + parseFloat(m[2] || '0') * 60
    + parseFloat(m[3] || '0') + parseFloat(m[4] || '0') / 60);
}

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

export function mspdiBaselineDays(text: string, hourTask: boolean, cal: WorkCalendar, hoursPerDay: number): number {
  const minutes = hourTask ? mspDurationMinutes(text) : null;
  return minutes != null ? hourTaskScheduleDuration(minutes, cal) : parseMSPDuration(text, hoursPerDay);
}

function readOpsCustomTaskType(task: Element): { id: string; name?: string } | undefined {
  const attrs = task.getElementsByTagName('ExtendedAttribute');
  for (const attr of attrs) {
    if (attr.parentElement !== task || getElementText(attr, 'FieldID') !== OPS_CUSTOM_TASK_TYPE_FIELD_ID) continue;
    const decoded = decodeCustomTaskType(getElementText(attr, 'Value'));
    if (decoded) return decoded;
  }
  return undefined;
}

const SEQUENCE_TYPE_BY_MSP_CODE: Partial<Record<number, SequenceType>> = invertRecord(MSP_LINK_TYPE_CODE);

export function mspTypeToSequenceType(type: number): SequenceType {
  return SEQUENCE_TYPE_BY_MSP_CODE[type] ?? 'FINISH_START';
}

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
  const dayMeasureDurationsEnabled = hasOpsFieldDefinition(root, OPS_DAY_MEASURE_DURATIONS_FIELD_ID, OPS_DAY_MEASURE_DURATIONS_NAME);
  const exactMinutesEnabled = hasOpsFieldDefinition(root, OPS_EXACT_MINUTES_FIELD_ID, OPS_EXACT_MINUTES_NAME);
  const dayMeasureLagsEnabled = hasOpsFieldDefinition(root, OPS_DAY_MEASURE_LAGS_FIELD_ID, OPS_DAY_MEASURE_LAGS_NAME);
  const workdayIsWorkTime = dayMeasureDurationsEnabled;
  const literalCalendarsEnabled = hasOpsFieldDefinition(root, OPS_LITERAL_CALENDARS_FIELD_ID, OPS_LITERAL_CALENDARS_NAME);
  const timeRule = xmlTimeRule(durationUnitMarkerFieldId !== null || isLegacyOpsMspdi(root), literalCalendarsEnabled);

  const project = parseProject(root, timeRule);
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
  const literalCalendarUids = summaryTask
    ? parseLiteralCalendars(opsTaskFieldText(summaryTask, OPS_LITERAL_CALENDARS_FIELD_ID, literalCalendarsEnabled))
    : null;
  const projectStartRaw = getElementText(root, 'StartDate');
  const missingDates = emptyMissingScheduleDates();
  const holidayBudget = newHolidayBudget();
  const { calendar, resourceCalendars, calUidToId, projectCalUid, projectFileHoursPerDay } = readCalendars(root, holidayBudget);
  const hoursPerDay = calendar.hoursPerDay;

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
      const standardRate = getElementText(resEl, 'StandardRate')
        || firstRatesStandardRate(resEl);

      const availability = availabilityFromPeriods(maxUnits, readAvailabilityPeriods(resEl));
      const resource: Resource = {
        id,
        name,
        type: type === 0 ? 'MATERIAL' : 'LABOR',
        description: '',
        maxUnits: availability.maxUnits,
      };
      if (availability.availabilitySteps) resource.availabilitySteps = availability.availabilitySteps;
      if (materialLabel) resource.unitOfMeasure = materialLabel;
      if (calUid >= 0 && calUidToId.has(calUid)) resource.calendarId = calUidToId.get(calUid);
      const rate = parseFloat(standardRate);
      if (Number.isFinite(rate) && standardRate) resource.costPerHour = rate;
      resources.push(resource);
    }
  }

  const taskElements = root.getElementsByTagName('Task');
  const tasks: Task[] = [];
  const recordedTimes: Record<string, RecordedTime> = {};
  const runningAtFullIds = new Set<string>();
  const customTaskTypes = new Map<string, CustomTaskTypeDraft>();
  const uidToId = new Map<number, string>();
  const uidToWbs = new Map<number, string>();
  const outlineLevels: (number | undefined)[] = [];
  const effHpdByTaskId = new Map<string, number>();
  const effCalByTaskId = new Map<string, WorkCalendar>();
  const pendingLinks: {
    successorId: string; predUid: number; type: number; lag: number; lagFormat: number; record?: LagRecord;
    crossProject?: true;
  }[] = [];
  const externalTaskUids = new Set<number>();
  const baselineEntries: BaselineTask[] = [];

  const calById = new Map<string, WorkCalendar>([calendar, ...resourceCalendars].map(c => [c.id, c]));
  const effCalIdOfUid = (calUid: number): string => calUidToId.get(calUid) ?? calendar.id;
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
    const dateSignal = literalCalIds
      ? literalCalIds.has(calId)
      : ['Start', 'Finish', 'ActualStart', 'ActualFinish'].some(field => xmlTimeSignal(getElementText(te, field)));
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  const hourModeCalIds = promoteHourCalendars(calById, id => cSignalCalIds.has(id), false);
  for (const id of hourModeCalIds) {
    const promoted = calById.get(id);
    if (!promoted) continue;
    delete promoted.simpleBreakStartMinute;
    delete promoted.simpleBreakDurationMinutes;
  }
  if (projectFileHoursPerDay !== undefined) calendar.hoursPerDay = projectFileHoursPerDay;

  for (let i = 0; i < taskElements.length; i++) {
    const te = taskElements[i];
    if (te.parentElement?.tagName !== 'Tasks') continue;

    const uid = getElementInt(te, 'UID', -1);
    if (uid < 0) continue;

    const outlineLevel = getElementInt(te, 'OutlineLevel', 1);
    if (uid === 0 && outlineLevel === 0) continue;

    const id = generateId('task');
    uidToId.set(uid, id);
    if (isXmlTrue(getElementText(te, 'ExternalTask'))) externalTaskUids.add(uid);

    const name = getElementText(te, 'Name') || 'Task';
    const wbs = getElementText(te, 'WBS') || `${uid}`;
    uidToWbs.set(uid, wbs);
    const taskCalUid = getElementInt(te, 'CalendarUID', -1);
    const taskCalendarId = calUidToId.get(taskCalUid);
    const effCalId = effCalIdOfUid(taskCalUid);
    const isHour = hourModeCalIds.has(effCalId);
    const effCal = calById.get(effCalId) ?? calendar;
    const effHpd = effCal.hoursPerDay;
    effHpdByTaskId.set(id, workdayIsWorkTime ? effHoursPerDay(effCal) : effHpd);
    effCalByTaskId.set(id, effCal);
    const mspTaskType = mspTaskTypeFromCode(getElementInt(te, 'Type', -1));
    const effortDrivenRaw = getElementText(te, 'EffortDriven').trim().toLowerCase();
    const effortDriven = mspTaskType !== undefined && (effortDrivenRaw === '1' || effortDrivenRaw === 'true');

    const durationStr = getElementText(te, 'Duration');
    const remainingRaw = getElementText(te, 'RemainingDuration');
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
    const parseTaskDate = (raw: string): string | undefined => xmlTaskDate(raw, timeRule, isHour);
    const sourceStart = parseTaskDate(startRaw);
    const sourceFinish = parseTaskDate(finishRaw);
    const start = sourceStart ?? localTodayIso();
    const finish = sourceFinish ?? localTodayIso();
    if (sourceStart === undefined) missingDates.start.add(id);
    if (sourceFinish === undefined) missingDates.finish.add(id);

    {
      const slackDays = (raw: string): number | undefined => {
        if (!raw) return undefined;
        const tenths = Number.parseFloat(raw);
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

    const actualStartRaw = getElementText(te, 'ActualStart');
    const actualFinishRaw = getElementText(te, 'ActualFinish');
    const actualStart = parseTaskDate(actualStartRaw);
    const actualFinish = parseTaskDate(actualFinishRaw);
    const remainingMinutes = measure.remainingMinutes;
    const remainingTime = measure.remainingTime;

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
    const deadline = parseTaskDate(getElementText(te, 'Deadline'));

    const baselineEls = te.getElementsByTagName('Baseline');
    for (let b = 0; b < baselineEls.length; b++) {
      const bEl = baselineEls[b];
      if (bEl.parentElement !== te) continue;
      if (getElementInt(bEl, 'Number', -1) !== 0) continue;
      const baselineStart = parseTaskDate(getElementText(bEl, 'Start'));
      const baselineFinish = parseTaskDate(getElementText(bEl, 'Finish'));
      if (baselineStart === undefined || baselineFinish === undefined) break;
      baselineEntries.push({
        taskId: id,
        start: baselineStart,
        finish: baselineFinish,
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
      status: 'NOT_STARTED',
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority,
      parentId: null,
      childIds: [],
      time: {
        durationType: taskDurationType(te),
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
    if (!actualFinish && ((remainingMinutes ?? 0) > 0 || (remainingTime ?? 0) > 0)) runningAtFullIds.add(id);

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
      const crossProject = isXmlTrue(getElementText(pl, 'CrossProject'));
      if (predUid >= 0) {
        taskLinks.push({
          successorId: id,
          predUid,
          type: linkType,
          lag: linkLag,
          lagFormat,
          ...(crossProject ? { crossProject: true as const } : {}),
        });
      }
    }
    const keyCount = new Map<string, number>();
    const keyOf = (link: (typeof pendingLinks)[number]) => lagRecordKey(link.predUid, mspTypeToSequenceType(link.type));
    for (const link of taskLinks) keyCount.set(keyOf(link), (keyCount.get(keyOf(link)) ?? 0) + 1);
    for (const link of taskLinks) {
      const record = keyCount.get(keyOf(link)) === 1 ? lagRecords.get(keyOf(link)) : undefined;
      pendingLinks.push(record && record.length === 2 ? { ...link, record } : link);
    }
  }

  rebuildImportedHierarchy(tasks, outlineLevels);

  const ELAPSED_DURATION_FORMATS = new Set([4, 6, 8, 10, 12]);
  const sequences: Sequence[] = [];
  for (const link of pendingLinks) {
    if (link.crossProject && !externalTaskUids.has(link.predUid)) continue;
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
      seq.lagMinutes = link.lag / 10;
      if (ELAPSED_DURATION_FORMATS.has(link.lagFormat)) seq.lagUnit = 'ELAPSEDTIME';
    }
    sequences.push(seq);
  }

  const assignmentsRoot = root.getElementsByTagName('Assignments')[0];
  const assignments: ResourceAssignment[] = [];
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
  attachContours(taskById, contoursByTaskId);
  reconstructResourceIds(tasks, assignments);

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

  project.startDate = resolveMissingScheduleDates(tasks, missingDates, projectStartRaw ? project.startDate : '',
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));

  normalizeImportedProgress(tasks, project.statusDate, runningAtFullIds);
  deriveImportedWorkRules(tasks);

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
    customTaskTypes: withTaskTypeColors([...customTaskTypes.values()]),
    baselines,
    activeBaselineId,
    suggestedProfileId: 'ops',
    ...(() => {
      const leafTimes = leafRecordedTimes(tasks, recordedTimes);
      return Object.keys(leafTimes).length > 0 ? { recordedTimes: leafTimes, recordedTimesOrigin: 'mspdi' as const } : {};
    })(),
  };
}

function parseProject(root: Element, timeRule: XmlTimeRule): Project {
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
  const statusDateRaw = getElementText(root, 'StatusDate');
  if (statusDateRaw) project.statusDate = statusDateFromXml(statusDateRaw, timeRule);
  const cslRaw = getElementText(root, 'CriticalSlackLimit');
  if (cslRaw) {
    const csl = parseInt(cslRaw, 10);
    if (Number.isFinite(csl)) {
      project.schedulingOptions = { criticalDefinition: { mode: 'totalFloat', threshold: csl } };
    }
  }
  return project;
}

function readMspdiRecurringData(exc: Element, fromDate: Date, toDate: Date | null): RecurrenceSpec | null {
  const typeValue = getElementInt(exc, 'Type', 0);
  const type = typeValue >= 0 && typeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[typeValue] : null;
  if (type === null) return null;
  const relative = typeValue < RELATIVE_MAP.length ? RELATIVE_MAP[typeValue] : false;
  const occurrences = getElementInt(exc, 'Occurrences', 0);
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
      break;
  }

  if (type === 'DAILY' && frequency === 1) return null;
  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

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

function canonicalExceptionBands(bands: { start: number; end: number }[]): { start: number; end: number }[] {
  return bands.map((b) => (b.end <= b.start ? { start: b.start, end: b.end + 1440 } : b));
}

function readRawMspdiExceptions(calEl: Element): RawException[] {
  const exceptionsRoot = calEl.getElementsByTagName('Exceptions')[0];
  if (!exceptionsRoot) return readLegacyDayExceptions(calEl);
  const exceptionEls = exceptionsRoot.getElementsByTagName('Exception');
  const out: RawException[] = [];
  const limit = Math.min(exceptionEls.length, MAX_CALENDAR_EXCEPTIONS);
  for (let i = 0; i < limit; i++) {
    const exc = exceptionEls[i];
    if (exc.parentElement !== exceptionsRoot) continue;

    const timePeriod = exc.getElementsByTagName('TimePeriod')[0];
    if (!timePeriod) continue;
    const fromDateRaw = getElementText(timePeriod, 'FromDate');
    const toDateRaw = getElementText(timePeriod, 'ToDate');
    if (!fromDateRaw && !toDateRaw) continue;
    if (!fromDateRaw) continue;

    const fromDate = parseDate(parseMSPDate(fromDateRaw));
    const toDate = toDateRaw ? parseDate(parseMSPDate(toDateRaw)) : null;

    const dayWorking = getElementInt(exc, 'DayWorking', 0) === 1;
    const name = getElementText(exc, 'Name');

    const bands = dayWorking ? canonicalExceptionBands(readWorkingTimes(exc).bands) : [];

    const recurring = readMspdiRecurringData(exc, fromDate, toDate);
    if (!recurring && !toDate) continue;

    const periodCount = dayWorking ? Math.max(bands.length, 1) : 0;
    out.push({ fromDate, toDate, periodCount, bands, name, recurring });
  }
  return out.length > 0 ? out : readLegacyDayExceptions(calEl);
}

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

function applyCalendarBody(
  calEl: Element, calendar: WorkCalendar, budget: HolidayBudget,
  inherit: { declared: boolean; base: WorkCalendar | null }, week: WeekEntry[] | null, opsFile: boolean,
): void {
  const workDays: number[] = [];
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};

  const timedDays: WeekEntry[] = [];

  for (const day of week ?? []) {
    if (!day.working) continue;
    const isoDay = day.dayType === 1 ? 7 : day.dayType - 1;
    workDays.push(isoDay);
    if (day.bands.length > 0) rawByWeekday[isoDay as 1] = day.bands;
    if (day.firstTime) timedDays.push(day);
  }
  const scalarDay = [...timedDays].sort((a, b) => a.dayType - b.dayType)[0];
  const firstWorkingTime = scalarDay?.firstTime;
  const firstDayBands = scalarDay?.bands;

  if (workDays.length > 0) {
    calendar.workDays = workDays.sort((a, b) => a - b);
  }

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const shared = sharedWeekBlocks(bands);
  const dayWithBreak = opsFile ? opsDayWithBreak(bands) : undefined;
  const hourShape = (deviates && !dayWithBreak) || shared === 'verschilt';

  const blocked = firstDayBands && firstDayBands.length > 1 ? workDayFromBlocks(firstDayBands) : undefined;
  const singleBand = firstDayBands?.length === 1 ? canonicalExceptionBands(firstDayBands)[0] : undefined;
  if (dayWithBreak) {
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
    calendar.workStartHour = blocked.startHour;
    calendar.workEndHour = blocked.endHour;
    calendar.hoursPerDay = deriveHoursPerDay(bands, blocked.netHours);
  } else if (singleBand) {
    calendar.workStartHour = singleBand.start / 60;
    calendar.workEndHour = singleBand.end / 60;
    calendar.hoursPerDay = (singleBand.end - singleBand.start) / 60;
  } else if (firstWorkingTime) {
    const fromTime = firstWorkingTime.from;
    const toTime = firstWorkingTime.to;
    if (fromTime) {
      const h = scalarHourFromClock(fromTime);
      if (!isNaN(h)) calendar.workStartHour = h;
    }
    if (toTime) {
      const h = scalarHourFromClock(toTime);
      if (!isNaN(h)) calendar.workEndHour = h <= calendar.workStartHour ? h + 24 : h;
    }
    calendar.hoursPerDay = calendar.workEndHour - calendar.workStartHour;
    if (calendar.hoursPerDay <= 0) calendar.hoursPerDay = 8;
  }

  registerCalendarBands(calendar, { canonical: bands, deviates: hourShape });

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
    if (parsed.workingExceptions.length > 0) calendar.workingExceptions = parsed.workingExceptions;
    else delete calendar.workingExceptions;
  }
}

interface WeekEntry {
  dayType: number;
  working: boolean;
  bands: { start: number; end: number }[];
  firstTime?: { from: string; to: string };
}

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

function effectiveWeek(own: WeekEntry[], baseWeek: WeekEntry[] | null): WeekEntry[] | null {
  if (!baseWeek) return own.length > 0 ? own : null;
  const byDay = new Map<number, WeekEntry>();
  for (const d of baseWeek) byDay.set(d.dayType, d);
  for (const d of own) byDay.set(d.dayType, d);
  return [...byDay.values()].sort((x, y) => x.dayType - y.dayType);
}

function readCalendars(root: Element, budget: HolidayBudget): {
  calendar: WorkCalendar; resourceCalendars: WorkCalendar[]; calUidToId: Map<number, string>;
  projectCalUid?: number;
  projectFileHoursPerDay?: number;
} {
  const fileMinutesPerDay = getElementInt(root, 'MinutesPerDay');
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

  let declared = -1;
  const uidEls = root.getElementsByTagName('CalendarUID');
  for (let i = 0; i < uidEls.length; i++) {
    if (uidEls[i].parentElement !== root) continue;
    declared = toInt(uidEls[i].textContent ?? '', -1);
    break;
  }
  const projectCalUid = allEls.has(declared) ? declared : first.value;

  const baseUidOf = (uid: number): number => getElementInt(allEls.get(uid)!, 'BaseCalendarUID', -1);
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
  const resolve = (uid: number): WorkCalendar => {
    const done = resolved.get(uid);
    if (done) return done;
    const calEl = allEls.get(uid)!;
    const baseUid = baseUidOf(uid);
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
    delete cal.generation;
    applyCalendarBody(calEl, cal, budget, { declared: declaredBase, base }, week, opsFile);
    if (uid === projectCalUid) {
      if (projectFileHoursPerDay !== undefined) cal.hoursPerDay = projectFileHoursPerDay;
    }
    resolved.set(uid, cal);
    weekOf.set(uid, week);
    return cal;
  };

  const calendar = resolve(projectCalUid);
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
