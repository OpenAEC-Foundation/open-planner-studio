import { RESOURCE_CURVES, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import {
  arrayOf, enumOf, LOCAL_MOMENT_OR_EMPTY, REAL, REFERENCE, TEXT, type IfcxField, type IfcxValue,
} from '../fieldTable';
import type { IfcxIdentity } from '../globalIdUuid';

export interface AssignmentWriteSource {
  readonly assignment: ResourceAssignment;
  readonly identity: IfcxIdentity;
  readonly taskPath: string;
  readonly resourcePath: string;
}

export interface AssignmentReadTarget {
  readonly assignment: ResourceAssignment;
  readonly path: string;
  taskPath: string;
  resourcePath: string;
  work: Partial<Record<WorkKey, string>>;
}

type AssignmentField = IfcxField<AssignmentWriteSource, AssignmentReadTarget>;
type WorkKey = 'plannedWorkMinutes' | 'actualWorkMinutes' | 'remainingWorkMinutes';

const WORK_DURATION: IfcxValue = {
  dataType: 'String', form: { name: 'ISO 8601-duur PT<minuten>M', pattern: /^PT\d+(\.\d+)?M$/ },
};

function isoWork(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined;
  const text = String(minutes);
  return /^\d+(\.\d+)?$/.test(text) ? `PT${text}M` : undefined;
}

function minutesOfWork(iso: string | undefined): number | undefined {
  return iso === undefined ? undefined : Number(iso.slice(2, -1));
}

function setOptional<K extends keyof ResourceAssignment>(assignment: ResourceAssignment, key: K, value: ResourceAssignment[K] | undefined): void {
  if (value !== undefined) assignment[key] = value;
}

function sharedWork(sharedKey: string, key: WorkKey): AssignmentField {
  return {
    key: sharedKey, value: WORK_DURATION, optional: true,
    write: s => isoWork(s.assignment[key]),
    read: (v, t) => { if (v !== undefined) t.work[key] = v as string; },
  };
}

function exactWork(key: WorkKey): AssignmentField {
  return {
    key, value: REAL, optional: true,
    write: s => (minutesOfWork(isoWork(s.assignment[key])) !== s.assignment[key] ? s.assignment[key] : undefined),
    read: (v, t) => setOptional(t.assignment, key, (v as number | undefined) ?? minutesOfWork(t.work[key])),
  };
}

export const ASSIGNMENT_PLANNING_FIELDS: readonly AssignmentField[] = [
  {
    key: 'relatingProcess', value: REFERENCE,
    write: s => s.taskPath,
    read: (v, t) => { t.taskPath = v as string; },
  },
  {
    key: 'relatedResource', value: REFERENCE,
    write: s => s.resourcePath,
    read: (v, t) => { t.resourcePath = v as string; },
  },
  {
    key: 'unitsPerDay', value: REAL,
    write: s => s.assignment.unitsPerDay,
    read: (v, t) => { t.assignment.unitsPerDay = v as number; },
  },
  {
    key: 'plannedUnitsPerDay', value: REAL, optional: true,
    write: s => s.assignment.plannedUnitsPerDay,
    read: (v, t) => setOptional(t.assignment, 'plannedUnitsPerDay', v as number | undefined),
  },
  {
    key: 'scheduleContour', value: enumOf(RESOURCE_CURVES), optional: true,
    write: s => s.assignment.curve,
    read: (v, t) => setOptional(t.assignment, 'curve', v as ResourceCurve | undefined),
  },
  sharedWork('scheduleWork', 'plannedWorkMinutes'),
  sharedWork('actualWork', 'actualWorkMinutes'),
  sharedWork('remainingWork', 'remainingWorkMinutes'),
  {
    key: 'costAmount', value: REAL, optional: true,
    write: s => s.assignment.costAmount,
    read: (v, t) => setOptional(t.assignment, 'costAmount', v as number | undefined),
  },
];

export const ASSIGNMENT_OPS_FIELDS: readonly AssignmentField[] = [
  {
    key: 'id', value: TEXT, optional: true,
    write: s => (s.assignment.id !== s.identity.path ? s.assignment.id : undefined),
    read: (v, t) => { t.assignment.id = (v as string | undefined) ?? t.path; },
  },
  exactWork('plannedWorkMinutes'),
  exactWork('actualWorkMinutes'),
  exactWork('remainingWorkMinutes'),
  {
    key: 'curveValues', value: arrayOf(REAL), optional: true,
    write: s => (s.assignment.curveValues ? [...s.assignment.curveValues] : undefined),
    read: (v, t) => setOptional(t.assignment, 'curveValues', v ? [...(v as number[])] : undefined),
  },
  {
    key: 'workWindowStart', value: LOCAL_MOMENT_OR_EMPTY, optional: true,
    write: s => s.assignment.workWindowStart,
    read: (v, t) => setOptional(t.assignment, 'workWindowStart', v as string | undefined),
  },
  {
    key: 'workWindowFinish', value: LOCAL_MOMENT_OR_EMPTY, optional: true,
    write: s => s.assignment.workWindowFinish,
    read: (v, t) => setOptional(t.assignment, 'workWindowFinish', v as string | undefined),
  },
];

export const ASSIGNMENT_KEYS_CARRIED: readonly (keyof ResourceAssignment)[] = [
  'id', 'taskId', 'resourceId', 'unitsPerDay', 'plannedUnitsPerDay', 'curve', 'curveValues', 'workWindowStart', 'workWindowFinish',
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes', 'costAmount',
];

export function emptyAssignment(): ResourceAssignment {
  return { id: '', taskId: '', resourceId: '', unitsPerDay: 1 };
}
