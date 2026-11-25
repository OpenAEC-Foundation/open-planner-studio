import { TASK_TYPES, type Task, type TaskStatus, type TaskTime, type TaskTimephasedContour } from '@/types/task';
import { DEFAULT_PRIORITY } from '../../ifcConstants';
import {
  arrayOf, BOOLEAN, CALENDAR_DATE, enumOf, FRACTION, integer, LOCAL_MOMENT_OR_EMPTY, membersOf, NON_EMPTY_TEXT, objectOf,
  readFields, REAL, REFERENCE, TEXT, writeFields, type IfcxField, type IfcxValue, type SharedField,
} from '../fieldTable';
import type { SharedSpan } from '../dateProjection';
import { ALL_RECORDED_SLOT_KEYS, type RecordedFieldKey } from '../../ifcTaskSlots';

export interface TaskWriteSource {
  readonly task: Task;
  readonly path: string;
  readonly parentPath?: string;
  readonly calendarPath?: string;
  readonly place?: number;
  readonly span: SharedSpan;
  readonly derivesDays: boolean;
  readonly unrecorded: readonly RecordedFieldKey[];
}

export interface TaskReadTarget {
  readonly task: Task;
  readonly path: string;
  parentPath?: string;
  calendarPath?: string;
  place?: number;
  unrecorded: readonly RecordedFieldKey[];
}

interface TimeWriteSource {
  readonly time: TaskTime;
  readonly derivesDays: boolean;
}

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;
type TimeField = IfcxField<TimeWriteSource, TaskTime>;

export function derivedTaskStatus(time: Pick<TaskTime, 'actualStart' | 'actualFinish' | 'completion'>): TaskStatus {
  return time.actualFinish ? 'COMPLETED' : time.actualStart || time.completion > 0 ? 'STARTED' : 'NOT_STARTED';
}

export function remainingIsDerived(time: Pick<TaskTime, 'durationUnit' | 'remainingMinutes'>): boolean {
  return time.durationUnit === 'hours' && time.remainingMinutes !== undefined;
}

function timeField<K extends keyof TaskTime>(key: K, value: IfcxValue, optional = false,
  write: (source: TimeWriteSource) => unknown = source => source.time[key]): TimeField {
  return {
    key, value, optional, write,
    read: (v, time) => { if (v !== undefined) (time as unknown as Record<string, unknown>)[key] = v; },
  };
}

export const TASK_TIME_FIELDS: readonly TimeField[] = [
  timeField('durationUnit', enumOf(['days', 'hours'])),
  timeField('scheduleDuration', REAL, true, s => (s.derivesDays ? undefined : s.time.scheduleDuration)),
  timeField('durationMinutes', REAL, true),
  timeField('scheduleStart', LOCAL_MOMENT_OR_EMPTY),
  timeField('scheduleFinish', LOCAL_MOMENT_OR_EMPTY),
  timeField('resume', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('stop', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('earlyStart', LOCAL_MOMENT_OR_EMPTY),
  timeField('earlyFinish', LOCAL_MOMENT_OR_EMPTY),
  timeField('lateStart', LOCAL_MOMENT_OR_EMPTY),
  timeField('lateFinish', LOCAL_MOMENT_OR_EMPTY),
  timeField('freeFloat', REAL),
  timeField('totalFloat', REAL),
  timeField('totalFloatMinutes', REAL, true),
  timeField('freeFloatMinutes', REAL, true),
  timeField('isCritical', BOOLEAN),
  timeField('actualStart', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('actualFinish', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('actualDuration', REAL, true),
  timeField('remainingTime', REAL, true, s => (remainingIsDerived(s.time) ? undefined : s.time.remainingTime)),
  timeField('remainingMinutes', REAL, true),
];

function setOptional<K extends keyof Task>(task: Task, key: K, value: Task[K] | undefined): void {
  if (value !== undefined) task[key] = value;
}

interface ContourValue {
  readonly resourceUid?: number;
  readonly resourceId?: string;
  readonly periods: TaskTimephasedContour['periods'];
}

const CONTOURS: IfcxValue = arrayOf(objectOf({
  resourceUid: { value: REAL, optional: true },
  resourceId: { value: TEXT, optional: true },
  periods: { value: arrayOf(objectOf({
    afterMinutes: { value: REAL }, minutes: { value: REAL }, workMinutes: { value: REAL }, kind: { value: enumOf(['actual', 'remaining']) },
  })) },
}));

const periodsOf = (periods: TaskTimephasedContour['periods']) => periods.map(period => ({
  afterMinutes: period.afterMinutes, minutes: period.minutes, workMinutes: period.workMinutes, kind: period.kind,
}));

function contoursOut(contours: readonly TaskTimephasedContour[]): ContourValue[] {
  return contours.map(contour => ({
    ...(contour.resourceUid !== null ? { resourceUid: contour.resourceUid } : {}),
    ...(contour.resourceId !== undefined ? { resourceId: contour.resourceId } : {}),
    periods: periodsOf(contour.periods),
  }));
}

function contoursIn(contours: readonly ContourValue[]): TaskTimephasedContour[] {
  return contours.map(contour => ({
    resourceUid: contour.resourceUid ?? null,
    ...(contour.resourceId !== undefined ? { resourceId: contour.resourceId } : {}),
    periods: periodsOf(contour.periods),
  }));
}

export const TASK_SHARED_FIELDS: readonly SharedField<TaskWriteSource>[] = [
  { key: 'name', value: TEXT, write: s => s.task.name },
  { key: 'description', value: TEXT, optional: true, write: s => s.task.description || undefined },
  { key: 'identification', value: TEXT, optional: true, write: s => s.task.wbsCode || undefined },
  { key: 'parent', value: REFERENCE, optional: true, write: s => s.parentPath },
  { key: 'predefinedType', value: enumOf(TASK_TYPES), write: s => s.task.taskType },
  { key: 'isMilestone', value: BOOLEAN, optional: true, write: s => (s.task.isMilestone ? true : undefined) },
  { key: 'priority', value: integer(), optional: true, write: s => (s.task.priority !== DEFAULT_PRIORITY ? s.task.priority : undefined) },
  { key: 'calendar', value: REFERENCE, optional: true, write: s => s.calendarPath },
  {
    key: 'durationType', value: enumOf(['WORKTIME', 'ELAPSEDTIME']), optional: true,
    write: s => (s.task.time.durationType !== 'WORKTIME' ? s.task.time.durationType : undefined),
  },
  { key: 'completion', value: FRACTION, optional: true, write: s => (s.task.time.completion !== 0 ? s.task.time.completion : undefined) },
  { key: 'start', value: CALENDAR_DATE, optional: true, write: s => s.span.start },
  { key: 'endExclusive', value: CALENDAR_DATE, optional: true, write: s => s.span.endExclusive },
];

export const TASK_FIELDS: readonly TaskField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.task.id !== s.path ? s.task.id : undefined),
    read: (v, t) => { t.task.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'name', value: TEXT,
    write: s => s.task.name,
    read: (v, t) => { t.task.name = v as string; },
  },
  {
    key: 'description', value: TEXT, optional: true,
    write: s => s.task.description || undefined,
    read: (v, t) => { t.task.description = (v as string | undefined) ?? ''; },
  },
  {
    key: 'wbsCode', value: TEXT, optional: true,
    write: s => s.task.wbsCode || undefined,
    read: (v, t) => { t.task.wbsCode = (v as string | undefined) ?? ''; },
  },
  {
    key: 'taskType', value: enumOf(TASK_TYPES),
    write: s => s.task.taskType,
    read: (v, t) => { t.task.taskType = v as Task['taskType']; },
  },
  {
    key: 'isMilestone', value: BOOLEAN, optional: true,
    write: s => (s.task.isMilestone ? true : undefined),
    read: (v, t) => { t.task.isMilestone = v === true; },
  },
  {
    key: 'priority', value: integer(), optional: true,
    write: s => (s.task.priority !== DEFAULT_PRIORITY ? s.task.priority : undefined),
    read: (v, t) => { t.task.priority = (v as number | undefined) ?? DEFAULT_PRIORITY; },
  },
  {
    key: 'parent', value: REFERENCE, optional: true,
    write: s => s.parentPath,
    read: (v, t) => { t.parentPath = v as string | undefined; },
  },
  {
    key: 'place', value: integer(0), optional: true,
    write: s => s.place,
    read: (v, t) => { t.place = v as number | undefined; },
  },
  {
    key: 'durationType', value: enumOf(['WORKTIME', 'ELAPSEDTIME']), optional: true,
    write: s => (s.task.time.durationType !== 'WORKTIME' ? s.task.time.durationType : undefined),
    read: (v, t) => { t.task.time.durationType = (v as TaskTime['durationType'] | undefined) ?? 'WORKTIME'; },
  },
  {
    key: 'completion', value: FRACTION, optional: true,
    write: s => (s.task.time.completion !== 0 ? s.task.time.completion : undefined),
    read: (v, t) => { t.task.time.completion = (v as number | undefined) ?? 0; },
  },
  {
    key: 'time', value: objectOf(membersOf(TASK_TIME_FIELDS)),
    write: s => writeFields(TASK_TIME_FIELDS, { time: s.task.time, derivesDays: s.derivesDays }),
    read: (v, t) => {
      readFields(TASK_TIME_FIELDS, v as Record<string, unknown>, t.task.time);
      t.task.status = derivedTaskStatus(t.task.time);
    },
  },
  {
    key: 'milestoneKind', value: enumOf(['START', 'FINISH']), optional: true,
    write: s => s.task.milestoneKind,
    read: (v, t) => setOptional(t.task, 'milestoneKind', v as Task['milestoneKind']),
  },
  {
    key: 'mandatory', value: BOOLEAN, optional: true,
    write: s => s.task.mandatory,
    read: (v, t) => setOptional(t.task, 'mandatory', v as boolean | undefined),
  },
  {
    key: 'isSummary', value: BOOLEAN, optional: true,
    write: s => s.task.isSummary,
    read: (v, t) => setOptional(t.task, 'isSummary', v as boolean | undefined),
  },
  {
    key: 'manuallyScheduled', value: BOOLEAN, optional: true,
    write: s => s.task.manuallyScheduled,
    read: (v, t) => setOptional(t.task, 'manuallyScheduled', v as boolean | undefined),
  },
  {
    key: 'calendar', value: REFERENCE, optional: true,
    write: s => s.calendarPath,
    read: (v, t) => { t.calendarPath = v as string | undefined; },
  },
  {
    key: 'timephasedContours', value: CONTOURS, optional: true,
    write: s => (s.task.timephasedContours ? contoursOut(s.task.timephasedContours) : undefined),
    read: (v, t) => setOptional(t.task, 'timephasedContours', v ? contoursIn(v as ContourValue[]) : undefined),
  },
  {
    key: 'unrecorded', value: arrayOf(enumOf(ALL_RECORDED_SLOT_KEYS)), optional: true,
    write: s => (s.unrecorded.length > 0 ? [...s.unrecorded] : undefined),
    read: (v, t) => { t.unrecorded = (v as RecordedFieldKey[] | undefined) ?? []; },
  },
];

export const TASK_KEYS_CARRIED: readonly (keyof Task)[] = [
  'id', 'name', 'description', 'wbsCode', 'taskType', 'status', 'isMilestone', 'milestoneKind', 'mandatory', 'priority',
  'isSummary', 'parentId', 'childIds', 'time', 'calendarId', 'manuallyScheduled',
  'resourceIds', 'timephasedContours',
];

export const TASK_TIME_KEYS_CARRIED: readonly (keyof TaskTime)[] = [
  'durationType', 'completion', ...TASK_TIME_FIELDS.map(field => field.key as keyof TaskTime),
];

export function emptyTask(): Task {
  return {
    id: '', name: '', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: DEFAULT_PRIORITY, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 0, scheduleStart: '', scheduleFinish: '',
      earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
  };
}
