import { TASK_TYPES, type Task, type TaskStatus, type TaskTime } from '@/types/task';
import { DEFAULT_PRIORITY } from '../../ifcConstants';
import {
  BOOLEAN, CALENDAR_DATE, enumOf, integer, LOCAL_MOMENT_OR_EMPTY, objectOf, membersOf, readFields, REAL, REFERENCE, TEXT,
  writeFields, type IfcxField, type IfcxValue,
} from '../fieldTable';
import type { IfcxIdentity } from '../globalIdUuid';
import type { SharedSpan } from '../dateProjection';

export interface TaskWriteSource {
  readonly task: Task;
  readonly identity: IfcxIdentity;
  readonly parentPath?: string;
  readonly calendarPath?: string;
  readonly place?: number;
  readonly span: SharedSpan;
}

export interface TaskReadTarget {
  readonly task: Task;
  readonly path: string;
  globalIdOutsidePath?: string;
  parentPath?: string;
  calendarPath?: string;
  place?: number;
  span: { start?: string; endExclusive?: string };
}

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;
type TimeField = IfcxField<TaskTime, TaskTime>;

export function derivedTaskStatus(time: Pick<TaskTime, 'actualStart' | 'actualFinish' | 'completion'>): TaskStatus {
  return time.actualFinish ? 'COMPLETED' : time.actualStart || time.completion > 0 ? 'STARTED' : 'NOT_STARTED';
}

function timeField<K extends keyof TaskTime>(key: K, value: IfcxValue, optional = false): TimeField {
  return {
    key, value, optional,
    write: time => time[key],
    read: (v, time) => { if (v !== undefined) (time as unknown as Record<string, unknown>)[key] = v; },
  };
}

export const TASK_TIME_FIELDS: readonly TimeField[] = [
  timeField('durationUnit', enumOf(['days', 'hours'])),
  timeField('scheduleDuration', REAL),
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
  timeField('interferingFloat', REAL, true),
  timeField('isNearCritical', BOOLEAN, true),
  timeField('floatPath', REAL, true),
  timeField('actualStart', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('actualFinish', LOCAL_MOMENT_OR_EMPTY, true),
  timeField('actualDuration', REAL, true),
  timeField('remainingTime', REAL, true),
  timeField('remainingMinutes', REAL, true),
];

function setOptional<K extends keyof Task>(task: Task, key: K, value: Task[K] | undefined): void {
  if (value !== undefined) task[key] = value;
}

export const TASK_ACTIVITY_FIELDS: readonly TaskField[] = [
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
    key: 'identification', value: TEXT, optional: true,
    write: s => s.task.wbsCode || undefined,
    read: (v, t) => { t.task.wbsCode = (v as string | undefined) ?? ''; },
  },
  {
    key: 'parent', value: REFERENCE, optional: true,
    write: s => s.parentPath,
    read: (v, t) => { t.parentPath = v as string | undefined; },
  },
  {
    key: 'predefinedType', value: enumOf(TASK_TYPES),
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
    key: 'calendar', value: REFERENCE, optional: true,
    write: s => s.calendarPath,
    read: (v, t) => { t.calendarPath = v as string | undefined; },
  },
  {
    key: 'durationType', value: enumOf(['WORKTIME', 'ELAPSEDTIME']), optional: true,
    write: s => (s.task.time.durationType !== 'WORKTIME' ? s.task.time.durationType : undefined),
    read: (v, t) => { t.task.time.durationType = (v as TaskTime['durationType'] | undefined) ?? 'WORKTIME'; },
  },
  {
    key: 'completion', value: REAL, optional: true,
    write: s => (s.task.time.completion !== 0 ? s.task.time.completion : undefined),
    read: (v, t) => { t.task.time.completion = (v as number | undefined) ?? 0; },
  },
  {
    key: 'start', value: CALENDAR_DATE, optional: true,
    write: s => s.span.start,
    read: (v, t) => { t.span.start = v as string | undefined; },
  },
  {
    key: 'endExclusive', value: CALENDAR_DATE, optional: true,
    write: s => s.span.endExclusive,
    read: (v, t) => { t.span.endExclusive = v as string | undefined; },
  },
];

export const TASK_OPS_FIELDS: readonly TaskField[] = [
  {
    key: 'id', value: TEXT, optional: true,
    write: s => (s.task.id !== s.identity.path ? s.task.id : undefined),
    read: (v, t) => { t.task.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'globalId', value: TEXT, optional: true,
    write: s => s.identity.globalIdOutsidePath,
    read: (v, t) => { t.globalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'place', value: integer(0), optional: true,
    write: s => s.place,
    read: (v, t) => { t.place = v as number | undefined; },
  },
  {
    key: 'time', value: objectOf(membersOf(TASK_TIME_FIELDS)),
    write: s => writeFields(TASK_TIME_FIELDS, s.task.time),
    read: (v, t) => readFields(TASK_TIME_FIELDS, v as Record<string, unknown>, t.task.time),
  },
  {
    key: 'status', value: enumOf(['NOT_STARTED', 'STARTED', 'COMPLETED']), optional: true,
    write: s => (s.task.status !== derivedTaskStatus(s.task.time) ? s.task.status : undefined),
    read: (v, t) => { t.task.status = (v as TaskStatus | undefined) ?? derivedTaskStatus(t.task.time); },
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
    key: 'calendarId', value: TEXT, optional: true,
    write: s => (s.task.calendarId !== undefined && s.calendarPath === undefined ? s.task.calendarId : undefined),
    read: (v, t) => setOptional(t.task, 'calendarId', v as string | undefined),
  },
];

export const TASK_KEYS_CARRIED: readonly (keyof Task)[] = [
  'id', 'name', 'description', 'wbsCode', 'taskType', 'status', 'isMilestone', 'milestoneKind', 'mandatory', 'priority',
  'isSummary', 'parentId', 'childIds', 'time', 'calendarId', 'manuallyScheduled',
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
