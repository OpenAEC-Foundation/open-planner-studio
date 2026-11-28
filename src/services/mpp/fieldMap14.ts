// Bron: MPXJ, © Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import { getInt, getShort } from './mppPrimitives';
import type { Props } from './mppContainer';

export interface FieldEntry {
  location: 'fixed' | 'fixed2' | 'var';
  fixedOffset?: number;
  varDataKey?: number;
}

export type FieldMapTable = ReadonlyMap<number, FieldEntry>;

const FIELD_MAP_ENTRY_SIZE = 28;
const META_DATA_CATEGORIES = new Set([0x0b, 0x64]);
const NO_FIXED_OFFSET = 65535;

function parseFieldMapBytes(bytes: Uint8Array): Map<number, FieldEntry> {
  const entries = new Map<number, FieldEntry>();
  let lastDataBlockOffset = 0;
  let dataBlockIndex = 0;
  for (let pos = 0; pos + FIELD_MAP_ENTRY_SIZE <= bytes.length; pos += FIELD_MAP_ENTRY_SIZE) {
    const dataBlockOffset = getShort(bytes, pos + 4, 'fieldMap14 dataBlockOffset');
    const typeValue = getInt(bytes, pos + 12, 'fieldMap14 typeValue');
    const category = getShort(bytes, pos + 20, 'fieldMap14 category');
    const index = typeValue & 0xffff;

    if (META_DATA_CATEGORIES.has(category)) continue;

    if (dataBlockOffset !== NO_FIXED_OFFSET) {
      if (dataBlockOffset < lastDataBlockOffset) dataBlockIndex++;
      lastDataBlockOffset = dataBlockOffset;
      if (dataBlockIndex === 0) {
        entries.set(index, { location: 'fixed', fixedOffset: dataBlockOffset });
      } else if (dataBlockIndex === 1) {
        entries.set(index, { location: 'fixed2', fixedOffset: dataBlockOffset });
      }
    } else if (index !== 0) {
      entries.set(index, { location: 'var', varDataKey: index });
    }
  }
  return entries;
}

function buildFieldMap(fieldMapBytes: Uint8Array | null, defaults: Readonly<Record<number, FieldEntry>>): FieldMapTable {
  if (!fieldMapBytes) {
    const result = new Map<number, FieldEntry>();
    for (const key of Object.keys(defaults)) result.set(Number(key), defaults[Number(key)]);
    return result;
  }
  return parseFieldMapBytes(fieldMapBytes);
}

function firstByteArray(props: Props, keys: number[]): Uint8Array | null {
  for (const key of keys) {
    const value = props.getByteArray(key);
    if (value) return value;
  }
  return null;
}

const PROPS_KEY_TASK_FIELD_MAP = 131092;
const PROPS_KEY_TASK_FIELD_MAP2 = 50331668;
const PROPS_KEY_RESOURCE_FIELD_MAP = 131093;
const PROPS_KEY_RESOURCE_FIELD_MAP2 = 50331669;
const PROPS_KEY_ASSIGNMENT_FIELD_MAP = 131095;
const PROPS_KEY_ASSIGNMENT_FIELD_MAP2 = 50331671;

export const TaskFieldId = {
  UniqueId: 86,
  Id: 23,
  Name: 14,
  Wbs: 16,
  OutlineLevel: 249,
  ScheduledStart: 35,
  ScheduledFinish: 36,
  ScheduledDuration: 29,
  DurationUnits: 181,
  RemainingDuration: 31,
  ConstraintType: 17,
  ConstraintDate: 18,
  Deadline: 437,
  PercentComplete: 32,
  ActualStart: 41,
  ActualFinish: 42,
  CalendarUniqueId: 401,
  LevelingDelay: 20,
  LevelingDelayUnits: 178,
  Start: 1283,
  Finish: 1284,
  ManualDuration: 1288,
  ManualDurationUnits: 1289,
  Resume: 99,
  Stop: 100,
  Type: 128,
  EarlyStart: 37,
  EarlyFinish: 38,
  LateStart: 39,
  LateFinish: 40,
  FreeSlack: 21,
  StartSlack: 438,
  FinishSlack: 439,
  FixedCost: 8,
} as const;

const DEFAULT_TASK_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [TaskFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [TaskFieldId.Id]: { location: 'fixed', fixedOffset: 4 },
  [TaskFieldId.OutlineLevel]: { location: 'fixed', fixedOffset: 40 },
  [TaskFieldId.ScheduledDuration]: { location: 'fixed', fixedOffset: 42 },
  [TaskFieldId.DurationUnits]: { location: 'fixed', fixedOffset: 46 },
  [TaskFieldId.RemainingDuration]: { location: 'fixed', fixedOffset: 52 },
  [TaskFieldId.ConstraintType]: { location: 'fixed', fixedOffset: 56 },
  [TaskFieldId.LevelingDelay]: { location: 'fixed', fixedOffset: 58 },
  [TaskFieldId.LevelingDelayUnits]: { location: 'fixed', fixedOffset: 62 },
  [TaskFieldId.ScheduledStart]: { location: 'fixed', fixedOffset: 64 },
  [TaskFieldId.ScheduledFinish]: { location: 'fixed', fixedOffset: 68 },
  [TaskFieldId.ActualStart]: { location: 'fixed', fixedOffset: 72 },
  [TaskFieldId.ActualFinish]: { location: 'fixed', fixedOffset: 76 },
  [TaskFieldId.ConstraintDate]: { location: 'fixed', fixedOffset: 80 },
  [TaskFieldId.PercentComplete]: { location: 'fixed', fixedOffset: 90 },
  [TaskFieldId.CalendarUniqueId]: { location: 'fixed', fixedOffset: 118 },
  [TaskFieldId.Deadline]: { location: 'fixed', fixedOffset: 122 },
  [TaskFieldId.Wbs]: { location: 'var', varDataKey: TaskFieldId.Wbs },
  [TaskFieldId.Name]: { location: 'var', varDataKey: TaskFieldId.Name },
  [TaskFieldId.Start]: { location: 'fixed2', fixedOffset: 50 },
  [TaskFieldId.Finish]: { location: 'fixed2', fixedOffset: 54 },
  [TaskFieldId.ManualDuration]: { location: 'fixed2', fixedOffset: 58 },
  [TaskFieldId.ManualDurationUnits]: { location: 'fixed2', fixedOffset: 62 },
  [TaskFieldId.Resume]: { location: 'fixed', fixedOffset: 20 },
  [TaskFieldId.Stop]: { location: 'fixed', fixedOffset: 16 },
  [TaskFieldId.EarlyStart]: { location: 'fixed', fixedOffset: 106 },
  [TaskFieldId.EarlyFinish]: { location: 'fixed', fixedOffset: 8 },
  [TaskFieldId.LateStart]: { location: 'fixed', fixedOffset: 12 },
  [TaskFieldId.LateFinish]: { location: 'fixed', fixedOffset: 110 },
  [TaskFieldId.FreeSlack]: { location: 'fixed', fixedOffset: 24 },
  [TaskFieldId.StartSlack]: { location: 'fixed', fixedOffset: 28 },
  [TaskFieldId.FinishSlack]: { location: 'fixed', fixedOffset: 32 },
  [TaskFieldId.Type]: { location: 'fixed', fixedOffset: 94 },
  [TaskFieldId.FixedCost]: { location: 'fixed', fixedOffset: 158 },
};

export function createTaskFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_TASK_FIELD_MAP, PROPS_KEY_TASK_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_TASK_FIELDS);
}

export const ResourceFieldId = {
  UniqueId: 27,
  Name: 1,
  MaxUnits: 4,
  StandardRate: 6,
  OvertimeRate: 7,
  CostPerUse: 18,
} as const;

export const DEFAULT_RESOURCE_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [ResourceFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [ResourceFieldId.MaxUnits]: { location: 'fixed', fixedOffset: 44 },
  [ResourceFieldId.StandardRate]: { location: 'fixed', fixedOffset: 28 },
  [ResourceFieldId.OvertimeRate]: { location: 'fixed', fixedOffset: 36 },
  [ResourceFieldId.CostPerUse]: { location: 'fixed', fixedOffset: 84 },
  [ResourceFieldId.Name]: { location: 'var', varDataKey: ResourceFieldId.Name },
};

export function createResourceFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_RESOURCE_FIELD_MAP, PROPS_KEY_RESOURCE_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_RESOURCE_FIELDS);
}

export const AssignmentFieldId = {
  UniqueId: 0,
  TaskUniqueId: 1,
  ResourceUniqueId: 2,
  Units: 7,
  Start: 20,
  Resume: 24,
  Finish: 21,
  RemainingRegularWork: 49,
  ActualRegularWork: 50,
  ActualOvertimeWork: 51,
  ActualIrregularWork: 87,
} as const;

export const DEFAULT_ASSIGNMENT_FIELDS: Readonly<Record<number, FieldEntry>> = {
  [AssignmentFieldId.UniqueId]: { location: 'fixed', fixedOffset: 0 },
  [AssignmentFieldId.TaskUniqueId]: { location: 'fixed', fixedOffset: 4 },
  [AssignmentFieldId.ResourceUniqueId]: { location: 'fixed', fixedOffset: 8 },
  [AssignmentFieldId.Units]: { location: 'fixed', fixedOffset: 46 },
  [AssignmentFieldId.Start]: { location: 'fixed', fixedOffset: 12 },
  [AssignmentFieldId.Finish]: { location: 'fixed', fixedOffset: 16 },
  [AssignmentFieldId.RemainingRegularWork]: { location: 'var', varDataKey: AssignmentFieldId.RemainingRegularWork },
  [AssignmentFieldId.ActualRegularWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualRegularWork },
  [AssignmentFieldId.ActualOvertimeWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualOvertimeWork },
  [AssignmentFieldId.ActualIrregularWork]: { location: 'var', varDataKey: AssignmentFieldId.ActualIrregularWork },
};

export function createAssignmentFieldMap(props: Props): FieldMapTable {
  const bytes = firstByteArray(props, [PROPS_KEY_ASSIGNMENT_FIELD_MAP, PROPS_KEY_ASSIGNMENT_FIELD_MAP2]);
  return buildFieldMap(bytes, DEFAULT_ASSIGNMENT_FIELDS);
}

export function fixedOffsetOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'fixed' && entry.fixedOffset !== undefined ? entry.fixedOffset : null;
}

export function fixed2OffsetOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'fixed2' && entry.fixedOffset !== undefined ? entry.fixedOffset : null;
}

export function varDataKeyOf(map: FieldMapTable, fieldId: number): number | null {
  const entry = map.get(fieldId);
  return entry && entry.location === 'var' && entry.varDataKey !== undefined ? entry.varDataKey : null;
}
