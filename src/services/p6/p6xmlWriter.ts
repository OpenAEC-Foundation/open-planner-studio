import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { isoDayOfWeek, parseDate } from '@/utils/dateUtils';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import {
  CONTOUR_SHAPE_VALUES, CURVE_TO_SHAPE, isFlatCurveValues, matchContoursToAssignments,
} from '@/engine/contour/contourEngine';
import { contourPeriodsToP6Spread, countSplitTasksWithoutContour } from '@/services/contourIo';
import { Project } from '@/types/project';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { exportCalendarLayout, minutesToClock, taskMinutesForWrite } from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import { projectFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { isOpsInternalProjectId, OPS_INTERNAL_PROJECT_ID_PREFIX } from '@/utils/opsInternalProjectId';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { flattenOrder } from '@/utils/wbs';
import type { CustomTaskType } from '@/types/taskType';
import {
  encodeCustomTaskType, literalCalendarsJson, OPS_DURATION_UNIT_NAME, OPS_LITERAL_CALENDARS_NAME, toXmlDateTime,
} from '@/services/xmlInterchange';
import { minuteModelWriteView } from '@/services/ifc/minuteModelWrite';
import { p6ConstraintLabel } from './p6ConstraintTypes';
import { p6XmlScheduleOptionFields } from './p6xmlScheduleOptionLabels';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { leaf, node, renderP6XmlWithReport, P6_ID_MAX_LENGTH, type P6Node } from './p6xmlSchemaOrder';
import { isElapsedTask, isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { effHoursPerDay } from '@/utils/taskDuration';
import { computedStart, computedFinish } from '@/utils/taskDates';
import {
  LagRecordCollector, OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME,
  OPS_LAG_CALENDAR_NAME, dayMeasureMinutesPerDay, fieldRecordsJson, lagRecordKey, lagWorkMinutesPerDay,
  withElapsedUnit, writeDays, writeMinutes, type LagRecord, type WrittenAmount,
} from '@/services/xmlDayMeasure';
import { ELAPSED_MINUTES_PER_DAY, dayMeasureRecord } from '@/services/ifc/dayMeasureIo';
import { P6_DURATION_TYPE_NAME } from '@/engine/work/workRuleMapping';
import { DEFAULT_WORK_RULE } from '@/types/workRule';

export const OPS_CUSTOM_TASK_TYPE_UDF_TITLE = 'OPS Custom Task Type';
const OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID = 900000001;

const OPS_P6_DURATION_UNIT_UDF_OBJECT_ID = 1;

const OPS_DAY_MEASURE_DURATIONS_UDF_OBJECT_ID = 900000003;
const OPS_EXACT_MINUTES_UDF_OBJECT_ID = 900000004;
const OPS_DAY_MEASURE_LAGS_UDF_OBJECT_ID = 900000005;
const OPS_LAG_CALENDAR_UDF_OBJECT_ID = 900000006;
const OPS_LITERAL_CALENDARS_UDF_OBJECT_ID = 900000007;

export const P6_CURVE_TO_NAME: Record<ResourceCurve, string | undefined> = {
  UNIFORM: undefined,
  FRONT_LOADED: 'Front Loaded',
  BACK_LOADED: 'Back Loaded',
  BELL: 'Bell Shaped',
  EARLY_PEAK: 'Early Peak',
  LATE_PEAK: 'Late Peak',
  DOUBLE_PEAK: 'Double Peak',
  TURTLE: 'Turtle',
};

export const P6_NAME_TO_CURVE: Record<string, ResourceCurve> = {
  'Linear': 'UNIFORM',
  'Front Loaded': 'FRONT_LOADED',
  'Back Loaded': 'BACK_LOADED',
  'Bell Shaped': 'BELL',
  'Early Peak': 'EARLY_PEAK',
  'Late Peak': 'LATE_PEAK',
  'Double Peak': 'DOUBLE_PEAK',
  'Turtle': 'TURTLE',
};

export function resourceTypeToP6(type: ResourceType): 'Labor' | 'Nonlabor' | 'Material' {
  switch (type) {
    case 'LABOR':
    case 'CREW':
      return 'Labor';
    case 'MATERIAL':
    case 'COST':
      return 'Material';
    case 'EQUIPMENT':
    case 'SUBCONTRACTOR':
      return 'Nonlabor';
  }
}

export const P6_LINK_TYPE: Record<SequenceType, string> = {
  FINISH_START: 'Finish to Start',
  FINISH_FINISH: 'Finish to Finish',
  START_START: 'Start to Start',
  START_FINISH: 'Start to Finish',
};

export const OPS_DESCRIPTION_TOPIC_NAME = 'OPS Description';
const OPS_DESCRIPTION_TOPIC_OBJECT_ID = 900000002;

export function taskStatusToP6(task: Task): 'Completed' | 'In Progress' | 'Not Started' {
  const runningAtFull = task.status === 'STARTED' && !task.time.actualFinish;
  if (task.status === 'COMPLETED' || task.time.actualFinish || (task.time.completion >= 1 && !runningAtFull)) return 'Completed';
  if (task.status === 'STARTED' || task.time.actualStart || task.time.completion > 0) return 'In Progress';
  return 'Not Started';
}

function taskTypeToP6(task: Task): string {
  if (isZeroDurationMilestone(task)) {
    return task.milestoneKind === 'FINISH' ? 'Finish Milestone' : 'Start Milestone';
  }
  if (isSummaryTask(task)) return 'WBS Summary';
  if (task.isHammock) return 'Level of Effort';
  if (task.p6ActivityType === 'TT_Rsrc') return 'Resource Dependent';
  if (task.p6ActivityType === 'TT_WBS') return 'WBS Summary';
  return 'Task Dependent';
}

const P6_XML_PERCENT_COMPLETE: Readonly<Record<NonNullable<Task['p6CompletePctType']>, { label: string; column: string }>> = {
  CP_Phys: { label: 'Physical', column: 'PhysicalPercentComplete' },
  CP_Drtn: { label: 'Duration', column: 'DurationPercentComplete' },
  CP_Units: { label: 'Units', column: 'UnitsPercentComplete' },
};

export const P6_DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function p6FinishClock(endMinutes: number): string {
  return minutesToClock(endMinutes - 1);
}

function workTimeNodes(bands: readonly { start: number; end: number }[]): P6Node[] {
  return bands.map(b => node('WorkTime', [...leaf('Start', minutesToClock(b.start)), ...leaf('Finish', p6FinishClock(b.end))]));
}

function weekdayBands(cal: WorkCalendar, workTime: ReturnType<typeof effectiveWorkTimeBands> | undefined, day: number): { start: number; end: number }[] {
  if (workTime) return [...(workTime.byWeekday[day as 1] ?? [])];
  return cal.workDays.includes(day) ? [{ start: cal.workStartHour * 60, end: cal.workEndHour * 60 }] : [];
}

function standardWorkWeekNode(cal: WorkCalendar): P6Node {
  const workTime = cal.workTime ?? effectiveWorkTimeBands(cal);
  const days: P6Node[] = [];
  for (let day = 1; day <= 7; day++) {
    const bands = weekdayBands(cal, workTime, day);
    days.push(node('StandardWorkHours', [
      ...leaf('DayOfWeek', P6_DAY_NAMES[day]),
      ...(bands.length > 0 ? workTimeNodes(bands) : [{ tag: 'WorkTime', nil: true }]),
    ]));
  }
  return node('StandardWorkWeek', days);
}

export function splitWholeDay(bands: readonly { start: number; end: number }[]): { start: number; end: number }[] {
  if (bands.length === 1 && bands[0].start === 0 && bands[0].end >= 1440) {
    return [{ start: 0, end: 720 }, { start: 720, end: bands[0].end }];
  }
  return [...bands];
}

function isoDaysInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let d = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const last = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  while (Number.isFinite(d) && d <= last && out.length < 3660) {
    out.push(new Date(d).toISOString().slice(0, 10));
    d += 86_400_000;
  }
  return out;
}

function holidayOrExceptionsNode(cal: WorkCalendar): P6Node[] {
  const workTime = cal.workTime ?? effectiveWorkTimeBands(cal);
  const byDate = new Map<string, P6Node>();
  for (const h of cal.holidays) {
    for (const date of isoDaysInclusive(h.startDate, holidayEndDate(h))) {
      byDate.set(date, node('HolidayOrException', [...leaf('Date', toXmlDateTime(date)), { tag: 'WorkTime', nil: true }]));
    }
  }
  const firstWorkday = [...cal.workDays].sort((a, b) => a - b)[0] ?? 1;
  for (const w of cal.workingExceptions ?? []) {
    for (const date of isoDaysInclusive(w.startDate, w.endDate || w.startDate)) {
      let bands = w.bands && w.bands.length > 0 ? w.bands : weekdayBands(cal, workTime, isoDayOfWeek(parseDate(date)));
      if (bands.length === 0) bands = weekdayBands(cal, workTime, firstWorkday);
      if (bands.length === 0) bands = [{ start: cal.workStartHour * 60, end: cal.workEndHour * 60 }];
      byDate.set(date, node('HolidayOrException', [...leaf('Date', toXmlDateTime(date)), ...workTimeNodes(splitWholeDay(bands))]));
    }
  }
  if (byDate.size === 0) return [];
  return [node('HolidayOrExceptions', [...byDate.keys()].sort().map(date => byDate.get(date)!))];
}

function p6Lag(
  seq: Sequence,
  taskById: ReadonlyMap<string, Task>,
  effCalByTask: ReadonlyMap<string, WorkCalendar>,
  calendar: WorkCalendar,
  minutesPerLagDay: number,
): { hours: number; record?: LagRecord } {
  const lag = p6RelationshipLag(seq, taskById, effCalByTask, calendar, minutesPerLagDay);
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    console.warn(`P6-export: procent-lag (${seq.lagPercent}%) uitgebakken naar ${lag.minutes} minuten — P6 kent geen procent-lag.`);
  } else if (seq.lagUnit === 'ELAPSEDTIME') {
    console.warn('P6-export: kalenderdag-lag geëxporteerd als gewone lag-uren — P6 heeft geen lag-eenheid per relatie.');
  }
  return { hours: lag.hours, ...(lag.record ? { record: lag.record } : {}) };
}

export function p6RelationshipLag(
  seq: Sequence,
  taskById: ReadonlyMap<string, Task>,
  effCalByTask: ReadonlyMap<string, WorkCalendar>,
  calendar: WorkCalendar,
  minutesPerLagDay: number,
): { hours: number; minutes?: number; record?: LagRecord } {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    const pred = taskById.get(seq.predecessorId);
    const predCal = pred ? effCalByTask.get(pred.id) ?? calendar : calendar;
    const predHpd = pred?.time.durationType === 'ELAPSEDTIME' ? 24 : effHoursPerDay(predCal);
    const predMinutes = pred && !isZeroDurationMilestone(pred) ? taskMinutesForWrite(pred, predHpd) : 0;
    const minutes = Math.round(predMinutes * seq.lagPercent / 100);
    return { hours: minutes / 60, minutes };
  }
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) {
    return {
      hours: seq.lagMinutes / 60,
      ...(elapsed ? { record: [seq.lagMinutes, Math.round(seq.lagMinutes), 'eu'] as const } : {}),
    };
  }
  const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  const written = writeDays(days, minutesPerLagDay);
  if (days === 0 && !elapsed) return { hours: 0 };
  const [recordDays] = dayMeasureRecord(days, minutesPerLagDay);
  const record: LagRecord = elapsed ? [recordDays, written.minutes, 'ed'] : [recordDays, written.minutes];
  return { hours: written.minutes / 60, record };
}

export function writeP6XML(...args: Parameters<typeof writeP6XMLWithReport>): string {
  return writeP6XMLWithReport(...args).xml;
}

export function writeP6XMLWithReport(
  project: Project,
  calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  resourceCalendars: WorkCalendar[] = [],
  customTaskTypes: readonly CustomTaskType[] = [],
  projectCode: string | null | undefined = documentProjectCode(project),
): { xml: string; truncated: number; invalidXmlChars: number } {
  const costIds = new Set(resources.filter(r => r.type === 'COST').map(r => r.id));
  if (costIds.size > 0) {
    resources = resources.filter(r => !costIds.has(r.id));
    assignments = assignments.filter(a => !costIds.has(a.resourceId));
  }
  const extLinkCount = tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0);
  if (extLinkCount > 0) {
    console.warn(`P6-export: ${extLinkCount} externe (cross-project) dependency(s) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  const noteCount = tasks.reduce((n, t) => n + (t.notes?.length ?? 0), 0);
  if (noteCount > 0) {
    console.warn(`P6-export: ${noteCount} taak-aantekening(en) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  const elapsedTaskCount = tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length;
  if (elapsedTaskCount > 0) {
    console.warn(`P6-export: ${elapsedTaskCount} taak/taken met ELAPSEDTIME-duur (24/7-klokrekenen) geëxporteerd als gewone werktijd-duur — geen P6-equivalent (§6).`);
  }

  const manualCount = tasks.filter(t => t.manuallyScheduled).length;
  if (manualCount > 0) {
    console.warn(`P6-export: ${manualCount} handmatig geplande taak/taken geëxporteerd als gewone taak met berekende datums — geen geverifieerd P6-equivalent (§6).`);
  }
  const levelingPrecisionCount = tasks.filter(t => t.levelingDelayMinutes != null).length;
  if (levelingPrecisionCount > 0) {
    console.warn(`P6-export: ${levelingPrecisionCount} taak/taken met sub-dag-nivelleervertraging (levelingDelayMinutes) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }
  const splitWithoutContour = countSplitTasksWithoutContour(tasks);
  if (splitWithoutContour > 0) {
    console.warn(`P6-export: ${splitWithoutContour} onderbroken taak/taken zonder urenverdeling geëxporteerd ZONDER hun onderbrekingen (gebruikers-, nivelleer- of importsplits) — alleen een contour wordt als spreiding geschreven (§6; de gebruiker krijgt een melding via exportAs).`);
  }
  const resumeStopCount = tasks.filter(t => t.time.resume || t.time.stop).length;
  if (resumeStopCount > 0) {
    console.warn(`P6-export: ${resumeStopCount} taak/taken met resume/stop (uit-volgorde-hervatting) weggelaten — niet uitdrukbaar in P6-XML (§6).`);
  }

  const writeView = minuteModelWriteView({ tasks, calendar, resourceCalendars, baselines: [] },
    { literalAutomaticMilestones: true, realTimes: true });
  tasks = writeView.tasks;

  const taskObjMap = new Map<string, number>();
  let nextObjId = 1;
  for (const task of tasks) {
    taskObjMap.set(task.id, nextObjId++);
  }

  const resObjMap = new Map<string, number>();
  let nextResObjId = 1;
  for (const res of resources) {
    resObjMap.set(res.id, nextResObjId++);
  }
  const {
    libraryCalendars, calendarNumber: calObjMap, effCalByTask,
  } = exportCalendarLayout(tasks, calendar, resourceCalendars);

  tasks = [...flattenOrder(tasks)];
  const wbsTasks = tasks.filter(isSummaryTask);
  const leafTasks = tasks.filter(isLeafTask);
  const sequenceNumberByTask = new Map(tasks.map((t, i) => [t.id, i + 1]));

  const top: P6Node[] = [];
  const inProject: P6Node[] = [];

  top.push(node('UDFType', [
    ...leaf('DataType', 'Text'),
    ...leaf('ObjectId', OPS_P6_DURATION_UNIT_UDF_OBJECT_ID),
    ...leaf('SubjectArea', 'Activity'),
    ...leaf('Title', OPS_DURATION_UNIT_NAME),
  ]));
  for (const [objectId, title] of [
    [OPS_DAY_MEASURE_DURATIONS_UDF_OBJECT_ID, OPS_DAY_MEASURE_DURATIONS_NAME],
    [OPS_EXACT_MINUTES_UDF_OBJECT_ID, OPS_EXACT_MINUTES_NAME],
    [OPS_DAY_MEASURE_LAGS_UDF_OBJECT_ID, OPS_DAY_MEASURE_LAGS_NAME],
  ] as const) {
    top.push(node('UDFType', [
      ...leaf('DataType', 'Text'),
      ...leaf('ObjectId', objectId),
      ...leaf('SubjectArea', 'Activity'),
      ...leaf('Title', title),
    ]));
  }
  top.push(node('UDFType', [
    ...leaf('DataType', 'Text'),
    ...leaf('ObjectId', OPS_LITERAL_CALENDARS_UDF_OBJECT_ID),
    ...leaf('SubjectArea', 'Project'),
    ...leaf('Title', OPS_LITERAL_CALENDARS_NAME),
  ]));
  const lagCalendarOption = project.schedulingOptions?.lagCalendar;
  if (lagCalendarOption) {
    top.push(node('UDFType', [
      ...leaf('DataType', 'Text'),
      ...leaf('ObjectId', OPS_LAG_CALENDAR_UDF_OBJECT_ID),
      ...leaf('SubjectArea', 'Project'),
      ...leaf('Title', OPS_LAG_CALENDAR_NAME),
    ]));
  }
  const customTasks = leafTasks.filter(task => task.customTaskTypeId);
  if (customTasks.length > 0) {
    top.push(node('UDFType', [
      ...leaf('DataType', 'Text'),
      ...leaf('ObjectId', OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID),
      ...leaf('SubjectArea', 'Activity'),
      ...leaf('Title', OPS_CUSTOM_TASK_TYPE_UDF_TITLE),
    ]));
  }
  const describedTasks = leafTasks.filter(task => task.description);
  if (describedTasks.length > 0) {
    top.push(node('NotebookTopic', [
      ...leaf('AvailableForActivity', 1),
      ...leaf('AvailableForEPS', 0),
      ...leaf('AvailableForProject', 0),
      ...leaf('AvailableForWBS', 0),
      ...leaf('Name', OPS_DESCRIPTION_TOPIC_NAME),
      ...leaf('ObjectId', OPS_DESCRIPTION_TOPIC_OBJECT_ID),
    ]));
  }

  const taskCalendarIds = new Set(tasks.map(t => t.calendarId).filter((id): id is string => !!id));
  for (const cal of [calendar, ...libraryCalendars]) {
    top.push(node('Calendar', [
      ...leaf('HoursPerDay', cal.hoursPerDay),
      ...leaf('HoursPerMonth', cal.hoursPerDay * 20),
      ...leaf('HoursPerWeek', cal.hoursPerDay * cal.workDays.length),
      ...leaf('Name', cal.name),
      ...leaf('ObjectId', calObjMap.get(cal.id)!),
      ...leaf('Type', cal === calendar || taskCalendarIds.has(cal.id) ? 'Global' : 'Resource'),
      standardWorkWeekNode(cal),
      ...holidayOrExceptionsNode(cal),
    ]));
  }

  const curveObjIdByKey = new Map<string, number>();
  const curveDefs: { objId: number; name: string; values: readonly number[] }[] = [];
  const curveObjIdFor = (a: ResourceAssignment): number | undefined => {
    const values = a.curveValues ?? (a.curve && a.curve !== 'UNIFORM' ? CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[a.curve]] : undefined);
    if (!values || isFlatCurveValues(values)) return undefined;
    const key = values.map(v => String(v)).join(',');
    let objId = curveObjIdByKey.get(key);
    if (objId === undefined) {
      objId = curveDefs.length + 1;
      curveObjIdByKey.set(key, objId);
      const name = (a.curve ? P6_CURVE_TO_NAME[a.curve] : undefined) ?? `Curve ${objId}`;
      curveDefs.push({ objId, name, values });
    }
    return objId;
  };
  const curveObjIdByAssignment = new Map<string, number>();
  for (const a of assignments) {
    const objId = curveObjIdFor(a);
    if (objId !== undefined) curveObjIdByAssignment.set(a.id, objId);
  }
  for (const def of curveDefs) {
    top.push(node('ResourceCurve', [
      ...leaf('Name', def.name),
      ...leaf('ObjectId', def.objId),
      node('Values', def.values.flatMap((v, i) => leaf(`Value${i * 5}`, v))),
    ]));
  }

  for (const res of resources) {
    top.push(node('Resource', [
      ...leaf('CalendarObjectId', (res.calendarId && calObjMap.get(res.calendarId)) || 1),
      ...leaf('Id', res.id),
      ...leaf('MaxUnitsPerTime', res.maxUnits),
      ...leaf('Name', res.name),
      ...leaf('ObjectId', resObjMap.get(res.id)!),
      ...(res.parentId && resObjMap.has(res.parentId) ? leaf('ParentObjectId', resObjMap.get(res.parentId)) : []),
      ...leaf('ResourceType', resourceTypeToP6(res.type)),
      ...(res.type === 'MATERIAL' && res.unitOfMeasure ? leaf('UnitOfMeasureAbbreviation', res.unitOfMeasure) : []),
    ]));
  }

  let rateObjId = 1;
  for (const res of resources) {
    if (res.costPerHour === undefined) continue;
    top.push(node('ResourceRate', [
      ...leaf('EffectiveDate', toXmlDateTime(project.startDate)),
      ...leaf('ObjectId', rateObjId++),
      ...leaf('PricePerUnit', res.costPerHour),
      ...leaf('ResourceObjectId', resObjMap.get(res.id)!),
    ]));
  }

  for (const wbsTask of wbsTasks) {
    const parentObjId = wbsTask.parentId ? taskObjMap.get(wbsTask.parentId) : undefined;
    inProject.push(node('WBS', [
      ...leaf('Code', wbsTask.wbsCode),
      ...leaf('Name', wbsTask.name),
      ...leaf('ObjectId', taskObjMap.get(wbsTask.id)!),
      ...(parentObjId !== undefined ? leaf('ParentObjectId', parentObjId) : []),
      ...leaf('ProjectObjectId', 1),
      ...leaf('SequenceNumber', sequenceNumberByTask.get(wbsTask.id)),
    ]));
  }

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const lagCalendar = project.schedulingOptions?.lagCalendar;
  const relationshipLagHours = new Map<string, number>();
  const lagRecords = new LagRecordCollector();
  for (const seq of sequences) {
    const predObjId = taskObjMap.get(seq.predecessorId);
    if (predObjId === undefined || !taskObjMap.has(seq.successorId)) continue;
    const { hours, record } = p6Lag(seq, taskById, effCalByTask, calendar,
      lagWorkMinutesPerDay(seq, lagCalendar, calendar, effCalByTask));
    relationshipLagHours.set(seq.id, hours);
    lagRecords.add(seq.successorId, lagRecordKey(predObjId, seq.type), record);
  }

  let noteObjId = 1;
  for (const task of leafTasks) {
    const objId = taskObjMap.get(task.id)!;
    const wbsObjId = task.parentId ? taskObjMap.get(task.parentId) : undefined;
    const percentComplete = P6_XML_PERCENT_COMPLETE[task.p6CompletePctType ?? 'CP_Phys'];
    const durationTypeLabel = task.workRule ? P6_DURATION_TYPE_NAME[task.workRule] : undefined;
    const effCal = effCalByTask.get(task.id) ?? calendar;
    const isHour = taskDurationUnit(task) === 'hours';
    const elapsed = isElapsedTask(task);
    const workHpd = effHoursPerDay(effCal);
    const dayMinutesPerDay = dayMeasureMinutesPerDay(effCal, false);
    const tagElapsed = (written: WrittenAmount, value: number): WrittenAmount =>
      (elapsed ? withElapsedUnit(written, value, isHour ? 'eu' : 'ed') : written);
    const durationMinutesForWrite = taskMinutesForWrite(task, workHpd);
    const writtenDuration: WrittenAmount = isHour
      ? tagElapsed(writeMinutes(durationMinutesForWrite), durationMinutesForWrite)
      : tagElapsed(writeDays(task.time.scheduleDuration, dayMinutesPerDay), task.time.scheduleDuration);
    const plannedDur = writtenDuration.minutes / 60;
    const remainingMinutes = task.time.remainingMinutes;
    const remainingTime = task.time.remainingTime;
    const hourRestMinutes = isHour && remainingMinutes == null && remainingTime != null
      ? Math.round(remainingTime * (elapsed ? ELAPSED_MINUTES_PER_DAY : workHpd * 60)) : undefined;
    const writtenRemaining: WrittenAmount | undefined = isHour && remainingMinutes != null
      ? tagElapsed(writeMinutes(remainingMinutes), remainingMinutes)
      : remainingTime == null ? undefined
      : hourRestMinutes !== undefined ? tagElapsed({ minutes: hourRestMinutes }, hourRestMinutes)
      : tagElapsed(writeDays(remainingTime, dayMinutesPerDay), remainingTime);
    const remainingHours = writtenRemaining ? writtenRemaining.minutes / 60 : undefined;
    const durationRecords = fieldRecordsJson({ PlannedDuration: writtenDuration.record, RemainingDuration: writtenRemaining?.record });
    const lagRecordsJson = lagRecords.json(task.id);
    const code = task.constraint ? p6ConstraintLabel(task.constraint) : undefined;
    const code2 = task.constraint2 ? p6ConstraintLabel({ ...task.constraint2, hard: false }) : undefined;
    const udfs: P6Node[] = [
      node('UDF', [...leaf('TypeObjectId', OPS_P6_DURATION_UNIT_UDF_OBJECT_ID), ...leaf('TextValue', taskDurationUnit(task))]),
      ...(durationRecords !== undefined
        ? [node('UDF', [
          ...leaf('TypeObjectId', isHour ? OPS_EXACT_MINUTES_UDF_OBJECT_ID : OPS_DAY_MEASURE_DURATIONS_UDF_OBJECT_ID),
          ...leaf('TextValue', durationRecords),
        ])]
        : []),
      ...(lagRecordsJson !== undefined
        ? [node('UDF', [...leaf('TypeObjectId', OPS_DAY_MEASURE_LAGS_UDF_OBJECT_ID), ...leaf('TextValue', lagRecordsJson)])]
        : []),
      ...(task.customTaskTypeId
        ? [node('UDF', [
          ...leaf('TypeObjectId', OPS_CUSTOM_TASK_TYPE_UDF_OBJECT_ID),
          ...leaf('TextValue', encodeCustomTaskType(task.customTaskTypeId, customTaskTypes)),
        ])]
        : []),
    ];
    inProject.push(node('Activity', [
      ...leaf('ActualFinishDate', task.time.actualFinish ? toXmlDateTime(task.time.actualFinish) : undefined),
      ...leaf('ActualStartDate', task.time.actualStart ? toXmlDateTime(task.time.actualStart) : undefined),
      ...leaf('CalendarObjectId', (task.calendarId && calObjMap.get(task.calendarId)) || 1),
      ...(durationTypeLabel && !isZeroDurationMilestone(task) ? leaf('DurationType', durationTypeLabel) : []),
      ...leaf('ExpectedFinishDate', task.p6ExpectedFinish ? toXmlDateTime(task.p6ExpectedFinish) : undefined),
      ...leaf('Id', task.wbsCode || task.id),
      ...leaf('Name', task.name),
      ...leaf('ObjectId', objId),
      ...leaf('PercentCompleteType', percentComplete.label),
      ...(task.time.completion > 0 ? leaf(percentComplete.column, task.time.completion) : []),
      ...leaf('PlannedDuration', plannedDur),
      ...leaf('PlannedFinishDate', toXmlDateTime(computedFinish(task))),
      ...leaf('PlannedStartDate', toXmlDateTime(computedStart(task))),
      ...(code && task.constraint?.date ? leaf('PrimaryConstraintDate', toXmlDateTime(task.constraint.date)) : []),
      ...leaf('PrimaryConstraintType', code),
      ...leaf('ProjectObjectId', 1),
      ...leaf('RemainingDuration', remainingHours),
      ...(code2 && task.constraint2?.date ? leaf('SecondaryConstraintDate', toXmlDateTime(task.constraint2.date)) : []),
      ...leaf('SecondaryConstraintType', code2),
      ...leaf('Status', taskStatusToP6(task)),
      ...leaf('Type', taskTypeToP6(task)),
      ...(wbsObjId !== undefined ? leaf('WBSObjectId', wbsObjId) : []),
      ...udfs,
    ]));
    if (task.description) {
      inProject.push(node('ActivityNote', [
        ...leaf('ActivityObjectId', objId),
        ...leaf('Note', task.description),
        ...leaf('NotebookTopicObjectId', OPS_DESCRIPTION_TOPIC_OBJECT_ID),
        ...leaf('ObjectId', noteObjId++),
        ...leaf('ProjectObjectId', 1),
      ]));
    }
  }

  let relObjId = 1;
  for (const seq of sequences) {
    const predObjId = taskObjMap.get(seq.predecessorId);
    const succObjId = taskObjMap.get(seq.successorId);
    const lagHours = relationshipLagHours.get(seq.id);
    if (predObjId === undefined || succObjId === undefined || lagHours === undefined) continue;

    inProject.push(node('Relationship', [
      ...leaf('Lag', lagHours),
      ...leaf('ObjectId', relObjId++),
      ...leaf('PredecessorActivityObjectId', predObjId),
      ...leaf('PredecessorProjectObjectId', 1),
      ...leaf('SuccessorActivityObjectId', succObjId),
      ...leaf('SuccessorProjectObjectId', 1),
      ...leaf('Type', P6_LINK_TYPE[seq.type]),
    ]));
  }

  const assignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByTask.get(a.taskId) ?? [];
    list.push(a);
    assignmentsByTask.set(a.taskId, list);
  }
  const contourMatchCache = new Map<string, ReturnType<typeof matchContoursToAssignments>>();
  const contourOf = (task: Task, a: ResourceAssignment) => {
    if (!task.timephasedContours || task.timephasedContours.length === 0) return undefined;
    let m = contourMatchCache.get(task.id);
    if (!m) {
      m = matchContoursToAssignments(task.timephasedContours, assignmentsByTask.get(task.id) ?? [a]);
      contourMatchCache.set(task.id, m);
    }
    return m.get(a.id);
  };

  let asgnObjId = 1;
  for (const a of assignments) {
    const actObjId = taskObjMap.get(a.taskId);
    const resObjId = resObjMap.get(a.resourceId);
    if (actObjId === undefined || resObjId === undefined) continue;
    const task = taskById.get(a.taskId);
    const contour = task ? contourOf(task, a) : undefined;
    const taskStartIso = task ? computedStart(task) : '';
    const taskFinishIso = task ? computedFinish(task) : '';
    const actualPeriods = contour ? contour.periods.filter(p => p.kind === 'actual') : [];
    const remainingPeriods = contour ? contour.periods.filter(p => p.kind === 'remaining') : [];
    const actualSpread = actualPeriods.length > 0 ? contourPeriodsToP6Spread(actualPeriods) : null;
    const remainingSpread = remainingPeriods.length > 0 ? contourPeriodsToP6Spread(remainingPeriods) : null;
    const plannedSpread = contour ? contourPeriodsToP6Spread(contour.periods) : null;
    const anchorIso = taskStartIso ? toXmlDateTime(taskStartIso) : '';
    const curveObjId = curveObjIdByAssignment.get(a.id);

    inProject.push(node('ResourceAssignment', [
      ...leaf('ActivityObjectId', actObjId),
      ...(actualSpread && anchorIso ? [...leaf('ActualCurve', actualSpread), ...leaf('ActualStartDate', anchorIso)] : []),
      ...(a.actualWorkMinutes !== undefined ? leaf('ActualUnits', a.actualWorkMinutes / 60) : []),
      ...leaf('ObjectId', asgnObjId++),
      ...(plannedSpread && anchorIso
        ? [
          ...leaf('PlannedCurve', plannedSpread),
          ...(taskFinishIso ? leaf('PlannedFinishDate', toXmlDateTime(taskFinishIso)) : []),
          ...leaf('PlannedStartDate', anchorIso),
        ]
        : []),
      ...(a.plannedWorkMinutes !== undefined ? leaf('PlannedUnits', a.plannedWorkMinutes / 60) : []),
      ...leaf('PlannedUnitsPerTime', a.plannedUnitsPerDay ?? a.unitsPerDay),
      ...leaf('ProjectObjectId', 1),
      ...(remainingSpread && anchorIso ? [...leaf('RemainingCurve', remainingSpread), ...leaf('RemainingStartDate', anchorIso)] : []),
      ...(a.remainingWorkMinutes !== undefined ? leaf('RemainingUnits', a.remainingWorkMinutes / 60) : []),
      ...(a.plannedUnitsPerDay !== undefined ? leaf('RemainingUnitsPerTime', a.unitsPerDay) : []),
      ...(curveObjId !== undefined ? leaf('ResourceCurveObjectId', curveObjId) : []),
      ...leaf('ResourceObjectId', resObjId),
    ]));
  }

  const projectIdentity = p6ProjectIdentity(project, projectCode);
  const scheduleFields = p6XmlScheduleOptionFields(project, effectiveSchedulingOptions(project), calendar.hoursPerDay);
  top.push(node('Project', [
    ...leaf('ActivityDefaultCalendarObjectId', 1),
    ...leaf('ActivityDefaultDurationType', P6_DURATION_TYPE_NAME[project.defaultWorkRule ?? DEFAULT_WORK_RULE]),
    ...scheduleFields.project.flatMap(([name, value]) => leaf(name, value)),
    ...(project.statusDate ? leaf('DataDate', toXmlDateTime(project.statusDate)) : []),
    ...leaf('Description', project.description),
    ...leaf('Id', projectIdentity.id),
    ...(project.endDate ? leaf('MustFinishByDate', toXmlDateTime(project.endDate)) : []),
    ...leaf('Name', projectIdentity.name),
    ...leaf('ObjectId', 1),
    ...leaf('PlannedStartDate', toXmlDateTime(project.startDate)),
    ...leaf('Status', project.endDate ? 'Active' : 'Planned'),
    ...(lagCalendarOption
      ? [node('UDF', [...leaf('TypeObjectId', OPS_LAG_CALENDAR_UDF_OBJECT_ID), ...leaf('TextValue', lagCalendarOption)])]
      : []),
    node('UDF', [
      ...leaf('TypeObjectId', OPS_LITERAL_CALENDARS_UDF_OBJECT_ID),
      ...leaf('TextValue', literalCalendarsJson([...writeView.literalCalendarIds].flatMap(id => calObjMap.get(id) ?? []))),
    ]),
    ...inProject,
    node('ScheduleOptions', [
      ...scheduleFields.schedule.flatMap(([name, value]) => leaf(name, value)),
      ...leaf('ProjectObjectId', 1),
    ]),
  ]));

  return renderP6XmlWithReport(
    node('APIBusinessObjects', top),
    'xmlns="http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  );
}

export function p6ProjectIdentity(
  project: Pick<Project, 'id' | 'name'>,
  code: string | null | undefined,
): { name: string; id: string } {
  const id = (code ?? '').trim();
  return {
    name: projectFileBase(project.name),
    id: id || `${OPS_INTERNAL_PROJECT_ID_PREFIX}${project.id}`.slice(0, P6_ID_MAX_LENGTH),
  };
}

export { isOpsInternalProjectId };

const LEGACY_OPS_PROJECT_ID = /^proj-(?:ifc-(?:step-)?[0-9A-Za-z_$]+|([0-9a-z]{8})[0-9a-z]{4}\d+)$/;
const LEGACY_OPS_PROJECT_ID_FROM = Date.UTC(2026, 0, 1);
export function isLegacyOpsProjectId(id: string, now: number = Date.now()): boolean {
  const m = LEGACY_OPS_PROJECT_ID.exec(id);
  if (!m) return false;
  if (m[1] === undefined) return true;
  const ms = parseInt(m[1], 36);
  return ms >= LEGACY_OPS_PROJECT_ID_FROM && ms <= now + 86_400_000;
}
