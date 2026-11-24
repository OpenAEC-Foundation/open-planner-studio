import type { Baseline, BaselineTask } from '@/types/baseline';
import type { MilestoneKind } from '@/types/task';
import {
  arrayOf, BOOLEAN, CALENDAR_DATE, enumOf, integer, LOCAL_MOMENT_OR_EMPTY, objectOf, REAL, TEXT, type IfcxField, type IfcxValue,
} from '../fieldTable';
import type { IfcxIdentity } from '../globalIdUuid';
import { sharedProjectDate } from './documentFields';

export interface BaselineRowIdentity {
  readonly path: string;
  readonly id?: string;
  readonly globalId?: string;
}

export interface BaselineWriteSource {
  readonly baseline: Baseline;
  readonly identity: IfcxIdentity;
  readonly rowPaths: readonly (string | undefined)[];
  readonly rowIdentities: readonly BaselineRowIdentity[];
  readonly active: boolean;
  readonly comparedSlot?: 1 | 2;
}

export interface BaselineRowRead {
  readonly task?: string;
  readonly start: string;
  readonly finish: string;
  readonly duration: number;
  readonly isMilestone: boolean;
  readonly milestoneKind?: MilestoneKind;
  readonly sourceTaskId?: string;
  readonly sourceTaskCode?: string;
}

export interface BaselineReadTarget {
  readonly path: string;
  globalIdOutsidePath?: string;
  id: string;
  sourceProjectId?: string;
  name: string;
  createdAt: string;
  sharedFinish?: string;
  projectEnd: string;
  projectDuration: number;
  rows: BaselineRowRead[];
  rowIdentities: BaselineRowIdentity[];
  active: boolean;
  comparedSlot?: 1 | 2;
}

type BaselineField = IfcxField<BaselineWriteSource, BaselineReadTarget>;

const UUID_TEXT: IfcxValue = {
  dataType: 'String', form: { name: 'UUID in kleine letters', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/ },
};

const ROW: IfcxValue = objectOf({
  task: { value: UUID_TEXT, optional: true },
  start: { value: LOCAL_MOMENT_OR_EMPTY },
  finish: { value: LOCAL_MOMENT_OR_EMPTY },
  duration: { value: REAL },
  isMilestone: { value: BOOLEAN, optional: true },
  milestoneKind: { value: enumOf(['START', 'FINISH']), optional: true },
  sourceTaskId: { value: TEXT, optional: true },
  sourceTaskCode: { value: TEXT, optional: true },
});

const ROW_IDENTITY: IfcxValue = objectOf({
  task: { value: UUID_TEXT }, id: { value: TEXT, optional: true }, globalId: { value: TEXT, optional: true },
});

function rowOut(row: BaselineTask, path: string | undefined) {
  return {
    ...(path !== undefined ? { task: path } : {}),
    start: row.start, finish: row.finish, duration: row.duration,
    ...(row.isMilestone ? { isMilestone: true } : {}),
    ...(row.milestoneKind !== undefined ? { milestoneKind: row.milestoneKind } : {}),
    ...(row.sourceTaskId !== undefined ? { sourceTaskId: row.sourceTaskId } : {}),
    ...(row.sourceTaskCode !== undefined ? { sourceTaskCode: row.sourceTaskCode } : {}),
  };
}

function rowIn(value: Record<string, unknown>): BaselineRowRead {
  return {
    ...(value.task !== undefined ? { task: value.task as string } : {}),
    start: value.start as string, finish: value.finish as string, duration: value.duration as number,
    isMilestone: value.isMilestone === true,
    ...(value.milestoneKind !== undefined ? { milestoneKind: value.milestoneKind as MilestoneKind } : {}),
    ...(value.sourceTaskId !== undefined ? { sourceTaskId: value.sourceTaskId as string } : {}),
    ...(value.sourceTaskCode !== undefined ? { sourceTaskCode: value.sourceTaskCode as string } : {}),
  };
}

const rowIdentityOut = (identity: BaselineRowIdentity) => ({
  task: identity.path,
  ...(identity.id !== undefined ? { id: identity.id } : {}),
  ...(identity.globalId !== undefined ? { globalId: identity.globalId } : {}),
});

export const BASELINE_PLANNING_FIELDS: readonly BaselineField[] = [
  {
    key: 'name', value: TEXT,
    write: s => s.baseline.name,
    read: (v, t) => { t.name = v as string; },
  },
  {
    key: 'creationDate', value: TEXT, optional: true,
    write: s => s.baseline.createdAt || undefined,
    read: (v, t) => { t.createdAt = (v as string | undefined) ?? ''; },
  },
  {
    key: 'finish', value: CALENDAR_DATE, optional: true,
    write: s => sharedProjectDate(s.baseline.projectEnd),
    read: (v, t) => { t.sharedFinish = v as string | undefined; },
  },
  {
    key: 'tasks', value: arrayOf(ROW),
    write: s => s.baseline.tasks.map((row, index) => rowOut(row, s.rowPaths[index])),
    read: (v, t) => { t.rows = (v as Record<string, unknown>[]).map(rowIn); },
  },
];

export const BASELINE_OPS_FIELDS: readonly BaselineField[] = [
  {
    key: 'id', value: TEXT, optional: true,
    write: s => (s.baseline.id !== s.identity.path ? s.baseline.id : undefined),
    read: (v, t) => { t.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'globalId', value: TEXT, optional: true,
    write: s => s.identity.globalIdOutsidePath,
    read: (v, t) => { t.globalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'sourceProjectId', value: TEXT, optional: true,
    write: s => s.baseline.sourceProjectId,
    read: (v, t) => { if (v !== undefined) t.sourceProjectId = v as string; },
  },
  {
    key: 'projectEnd', value: TEXT, optional: true,
    write: s => (s.baseline.projectEnd !== (sharedProjectDate(s.baseline.projectEnd) ?? '') ? s.baseline.projectEnd : undefined),
    read: (v, t) => { t.projectEnd = (v as string | undefined) ?? t.sharedFinish ?? ''; },
  },
  {
    key: 'projectDuration', value: REAL, optional: true,
    write: s => (s.baseline.projectDuration !== 0 ? s.baseline.projectDuration : undefined),
    read: (v, t) => { t.projectDuration = (v as number | undefined) ?? 0; },
  },
  {
    key: 'active', value: BOOLEAN, optional: true,
    write: s => (s.active ? true : undefined),
    read: (v, t) => { t.active = v === true; },
  },
  {
    key: 'comparedSlot', value: integer(1, 2), optional: true,
    write: s => s.comparedSlot,
    read: (v, t) => { if (v !== undefined) t.comparedSlot = v as 1 | 2; },
  },
  {
    key: 'taskIds', value: arrayOf(ROW_IDENTITY), optional: true,
    write: s => (s.rowIdentities.length > 0 ? s.rowIdentities.map(rowIdentityOut) : undefined),
    read: (v, t) => { t.rowIdentities = ((v as Record<string, string>[] | undefined) ?? []).map(item => ({
      path: item.task, ...(item.id !== undefined ? { id: item.id } : {}), ...(item.globalId !== undefined ? { globalId: item.globalId } : {}),
    })); },
  },
];

export const BASELINE_KEYS_CARRIED: readonly (keyof Baseline)[] = [
  'id', 'sourceProjectId', 'name', 'createdAt', 'tasks', 'projectEnd', 'projectDuration',
];

export const BASELINE_TASK_KEYS_CARRIED: readonly (keyof BaselineTask)[] = [
  'taskId', 'sourceTaskId', 'sourceTaskCode', 'start', 'finish', 'duration', 'isMilestone', 'milestoneKind',
];

export function emptyBaselineTarget(path: string): BaselineReadTarget {
  return { path, id: '', name: '', createdAt: '', projectEnd: '', projectDuration: 0, rows: [], rowIdentities: [], active: false };
}

export function baselineOf(target: BaselineReadTarget, taskIdOfRow: (row: BaselineRowRead) => string): Baseline {
  return {
    id: target.id,
    ...(target.sourceProjectId !== undefined ? { sourceProjectId: target.sourceProjectId } : {}),
    name: target.name,
    createdAt: target.createdAt,
    tasks: target.rows.map(row => ({
      taskId: taskIdOfRow(row),
      ...(row.sourceTaskId !== undefined ? { sourceTaskId: row.sourceTaskId } : {}),
      ...(row.sourceTaskCode !== undefined ? { sourceTaskCode: row.sourceTaskCode } : {}),
      start: row.start, finish: row.finish, duration: row.duration, isMilestone: row.isMilestone,
      ...(row.milestoneKind !== undefined ? { milestoneKind: row.milestoneKind } : {}),
    })),
    projectEnd: target.projectEnd,
    projectDuration: target.projectDuration,
  };
}
