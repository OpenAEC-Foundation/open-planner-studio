import { RESOURCE_CURVES, type ResourceAssignment } from '@/types/resource';
import { arrayOf, enumOf, NON_EMPTY_TEXT, REAL, REFERENCE, TEXT, type IfcxField, type IfcxValue, type SharedField } from '../fieldTable';

export interface AssignmentWriteSource {
  readonly assignment: ResourceAssignment;
  readonly path: string;
  readonly taskPath: string;
  readonly resourcePath: string;
}

export interface AssignmentReadTarget {
  readonly assignment: ResourceAssignment;
  readonly path: string;
  taskPath: string;
  resourcePath: string;
}

type AssignmentField = IfcxField<AssignmentWriteSource, AssignmentReadTarget>;
type OptionalKey = Exclude<keyof ResourceAssignment, 'id' | 'taskId' | 'resourceId' | 'unitsPerDay'>;

const DEFAULT_UNITS_PER_DAY = 1;
const CURVE = enumOf(RESOURCE_CURVES);

const copied = (value: unknown) => (Array.isArray(value) ? [...value] : value);

function optionalField(key: OptionalKey, value: IfcxValue): AssignmentField {
  return {
    key, value, optional: true,
    write: s => copied(s.assignment[key]),
    read: (v, t) => { if (v !== undefined) (t.assignment as unknown as Record<string, unknown>)[key] = copied(v); },
  };
}

export const ASSIGNMENT_SHARED_FIELDS: readonly SharedField<AssignmentWriteSource>[] = [
  { key: 'relatingProcess', value: REFERENCE, write: s => s.taskPath },
  { key: 'relatedResource', value: REFERENCE, write: s => s.resourcePath },
  { key: 'scheduleUsage', value: REAL, write: s => s.assignment.unitsPerDay },
  { key: 'scheduleContour', value: CURVE, optional: true, write: s => s.assignment.curve },
];

export const ASSIGNMENT_FIELDS: readonly AssignmentField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.assignment.id !== s.path ? s.assignment.id : undefined),
    read: (v, t) => { t.assignment.id = (v as string | undefined) ?? t.path; },
  },
  {
    key: 'task', value: REFERENCE,
    write: s => s.taskPath,
    read: (v, t) => { t.taskPath = v as string; },
  },
  {
    key: 'resource', value: REFERENCE,
    write: s => s.resourcePath,
    read: (v, t) => { t.resourcePath = v as string; },
  },
  {
    key: 'unitsPerDay', value: REAL, optional: true,
    write: s => (s.assignment.unitsPerDay !== DEFAULT_UNITS_PER_DAY ? s.assignment.unitsPerDay : undefined),
    read: (v, t) => { t.assignment.unitsPerDay = (v as number | undefined) ?? DEFAULT_UNITS_PER_DAY; },
  },
  optionalField('plannedUnitsPerDay', REAL),
  optionalField('curve', CURVE),
  optionalField('curveValues', arrayOf(REAL)),
  optionalField('workWindowStart', TEXT),
  optionalField('workWindowFinish', TEXT),
  optionalField('plannedWorkMinutes', REAL),
  optionalField('actualWorkMinutes', REAL),
  optionalField('remainingWorkMinutes', REAL),
  optionalField('costAmount', REAL),
];

export const ASSIGNMENT_KEYS_CARRIED: readonly (keyof ResourceAssignment)[] = [
  'id', 'taskId', 'resourceId', 'unitsPerDay', 'plannedUnitsPerDay', 'curve', 'curveValues', 'workWindowStart', 'workWindowFinish',
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes', 'costAmount',
];

export function emptyAssignment(): ResourceAssignment {
  return { id: '', taskId: '', resourceId: '', unitsPerDay: DEFAULT_UNITS_PER_DAY };
}
