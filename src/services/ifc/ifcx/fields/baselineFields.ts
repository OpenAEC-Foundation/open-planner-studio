import { baselineStart, type Baseline, type BaselineTask } from '@/types/baseline';
import type { MilestoneKind } from '@/types/task';
import {
  arrayOf, BOOLEAN, CALENDAR_DATE, enumOf, NON_EMPTY_TEXT, objectOf, REAL, REFERENCE, TEXT, type IfcxField, type IfcxValue,
  type SharedField,
} from '../fieldTable';
import { existingDatePart } from '../dateProjection';

export interface BaselineWriteSource {
  readonly baseline: Baseline;
  readonly path: string;
  readonly taskPathById: ReadonlyMap<string, string>;
  readonly sourceStart?: string;
}

export interface BaselineReadTarget {
  readonly baseline: Baseline;
  readonly path: string;
  rowTaskPaths: (string | undefined)[];
}

export interface BaselineSetWriteSource {
  readonly activeBaselinePath?: string;
  readonly comparedBaselinePaths: readonly (string | undefined)[];
  readonly removedTasks: Readonly<Record<string, string>>;
}

export interface BaselineSetReadTarget {
  activeBaselinePath?: string;
  comparedBaselinePaths: (string | undefined)[];
  removedTasks: Record<string, string>;
}

type BaselineField = IfcxField<BaselineWriteSource, BaselineReadTarget>;

interface RowValue {
  readonly task?: string;
  readonly removedTask?: string;
  readonly sourceTaskId?: string;
  readonly sourceTaskCode?: string;
  readonly start: string;
  readonly finish: string;
  readonly duration: number;
  readonly isMilestone?: boolean;
  readonly milestoneKind?: MilestoneKind;
}

const ROW: IfcxValue = objectOf({
  task: { value: REFERENCE, optional: true },
  removedTask: { value: TEXT, optional: true },
  sourceTaskId: { value: TEXT, optional: true },
  sourceTaskCode: { value: TEXT, optional: true },
  start: { value: TEXT },
  finish: { value: TEXT },
  duration: { value: REAL },
  isMilestone: { value: BOOLEAN, optional: true },
  milestoneKind: { value: enumOf(['START', 'FINISH']), optional: true },
});

const COMPARED: IfcxValue = objectOf({ 1: { value: REFERENCE, optional: true }, 2: { value: REFERENCE, optional: true } });
const REMOVED_TASK: IfcxValue = objectOf({ id: { value: TEXT }, globalId: { value: TEXT } });

function rowOut(row: BaselineTask, taskPathById: ReadonlyMap<string, string>): RowValue {
  const path = taskPathById.get(row.taskId);
  return {
    ...(path !== undefined ? { task: path } : { removedTask: row.taskId }),
    ...(row.sourceTaskId !== undefined ? { sourceTaskId: row.sourceTaskId } : {}),
    ...(row.sourceTaskCode !== undefined ? { sourceTaskCode: row.sourceTaskCode } : {}),
    start: row.start, finish: row.finish, duration: row.duration,
    ...(row.isMilestone ? { isMilestone: true } : {}),
    ...(row.milestoneKind !== undefined ? { milestoneKind: row.milestoneKind } : {}),
  };
}

function rowIn(value: RowValue): BaselineTask {
  return {
    taskId: value.removedTask ?? '',
    ...(value.sourceTaskId !== undefined ? { sourceTaskId: value.sourceTaskId } : {}),
    ...(value.sourceTaskCode !== undefined ? { sourceTaskCode: value.sourceTaskCode } : {}),
    start: value.start, finish: value.finish, duration: value.duration, isMilestone: value.isMilestone === true,
    ...(value.milestoneKind !== undefined ? { milestoneKind: value.milestoneKind } : {}),
  };
}

export const BASELINE_SHARED_FIELDS: readonly SharedField<BaselineWriteSource>[] = [
  { key: 'name', value: TEXT, write: s => s.baseline.name },
  { key: 'start', value: CALENDAR_DATE, optional: true, write: s => existingDatePart(baselineStart(s.baseline)) ?? s.sourceStart },
  { key: 'finish', value: CALENDAR_DATE, optional: true, write: s => existingDatePart(s.baseline.projectEnd) },
];

export const BASELINE_FIELDS: readonly BaselineField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.baseline.id !== s.path ? s.baseline.id : undefined),
    read: (v, t) => { t.baseline.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'sourceProjectId', value: TEXT, optional: true,
    write: s => s.baseline.sourceProjectId,
    read: (v, t) => { if (v !== undefined) t.baseline.sourceProjectId = v as string; },
  },
  {
    key: 'name', value: TEXT,
    write: s => s.baseline.name,
    read: (v, t) => { t.baseline.name = v as string; },
  },
  {
    key: 'createdAt', value: TEXT,
    write: s => s.baseline.createdAt,
    read: (v, t) => { t.baseline.createdAt = v as string; },
  },
  {
    key: 'tasks', value: arrayOf(ROW),
    write: s => s.baseline.tasks.map(row => rowOut(row, s.taskPathById)),
    read: (v, t) => {
      t.baseline.tasks = (v as RowValue[]).map(rowIn);
      t.rowTaskPaths = (v as RowValue[]).map(row => row.task);
    },
  },
  {
    key: 'projectEnd', value: TEXT,
    write: s => s.baseline.projectEnd,
    read: (v, t) => { t.baseline.projectEnd = v as string; },
  },
  {
    key: 'projectDuration', value: REAL,
    write: s => s.baseline.projectDuration,
    read: (v, t) => { t.baseline.projectDuration = v as number; },
  },
];

export const BASELINE_SET_FIELDS: readonly IfcxField<BaselineSetWriteSource, BaselineSetReadTarget>[] = [
  {
    key: 'activeBaseline', value: REFERENCE, optional: true,
    write: s => s.activeBaselinePath,
    read: (v, t) => { t.activeBaselinePath = v as string | undefined; },
  },
  {
    key: 'comparedBaselines', value: COMPARED, optional: true,
    write: s => {
      const [first, second] = s.comparedBaselinePaths;
      return first === undefined && second === undefined ? undefined
        : { ...(first !== undefined ? { 1: first } : {}), ...(second !== undefined ? { 2: second } : {}) };
    },
    read: (v, t) => {
      const compared = v as Partial<Record<'1' | '2', string>> | undefined;
      t.comparedBaselinePaths = [compared?.[1], compared?.[2]];
    },
  },
  {
    key: 'removedTasks', value: arrayOf(REMOVED_TASK), optional: true,
    write: s => {
      const removed = Object.entries(s.removedTasks);
      return removed.length > 0 ? removed.map(([id, globalId]) => ({ id, globalId })) : undefined;
    },
    read: (v, t) => {
      t.removedTasks = Object.fromEntries(((v as { id: string; globalId: string }[] | undefined) ?? []).map(item => [item.id, item.globalId]));
    },
  },
];

export const BASELINE_KEYS_CARRIED: readonly (keyof Baseline)[] = [
  'id', 'sourceProjectId', 'name', 'createdAt', 'tasks', 'projectEnd', 'projectDuration',
];

export const BASELINE_TASK_KEYS_CARRIED: readonly (keyof BaselineTask)[] = [
  'taskId', 'sourceTaskId', 'sourceTaskCode', 'start', 'finish', 'duration', 'isMilestone', 'milestoneKind',
];

export function emptyBaseline(): Baseline {
  return { id: '', name: '', createdAt: '', tasks: [], projectEnd: '', projectDuration: 0 };
}
