import { OPS_DURATION_UNIT_NAME, isTaskDurationUnit } from '@/services/xmlInterchange';
import {
  OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME,
} from '@/services/xmlDayMeasure';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import type { XerRow, XerTables } from './xerTables';

export const OPS_XER_INHERITED_WORK_RULE_NAME = 'OPS_InheritedWorkRule';
export const OPS_XER_DEFAULT_WORK_RULE_NAME = 'OPS_DefaultWorkRule';
export const OPS_XER_FLAT_CAPACITY_NAME = 'OPS_FlatCapacity';
export const OPS_XER_CAPACITY_STEPS_NAME = 'OPS_CapacitySteps';

export type CapacityStepRecord = readonly [perDay: number, writtenPerHour: number];

const STEP_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function capacityStepsJson(records: ReadonlyMap<string, CapacityStepRecord>): string {
  return JSON.stringify(Object.fromEntries([...records].sort(([a], [b]) => a.localeCompare(b))));
}

export function parseCapacitySteps(text: string): ReadonlyMap<string, CapacityStepRecord> {
  const records = new Map<string, CapacityStepRecord>();
  let value: unknown;
  try { value = JSON.parse(text); } catch { return records; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return records;
  for (const [date, record] of Object.entries(value as Record<string, unknown>)) {
    if (!STEP_DATE.test(date) || !Array.isArray(record) || record.length !== 2) continue;
    const [perDay, writtenPerHour] = record as unknown[];
    if (typeof perDay !== 'number' || typeof writtenPerHour !== 'number') continue;
    if (!Number.isFinite(perDay) || !Number.isFinite(writtenPerHour) || perDay < 0 || writtenPerHour < 0) continue;
    records.set(date, [perDay, writtenPerHour]);
  }
  return records;
}

export const XER_DURATION_FIELDS = { duration: 'target_drtn_hr_cnt', remaining: 'remain_drtn_hr_cnt' } as const;

export type XerOpsField = 'unit' | 'dayRecords' | 'exactRecords' | 'lagRecords' | 'inheritedWorkRule' | 'defaultWorkRule'
  | 'flatCapacity' | 'capacitySteps';

export const OPS_XER_UDFS: readonly { field: XerOpsField; label: string; table: 'TASK' | 'PROJECT' | 'RSRC' }[] = [
  { field: 'unit', label: OPS_DURATION_UNIT_NAME, table: 'TASK' },
  { field: 'dayRecords', label: OPS_DAY_MEASURE_DURATIONS_NAME, table: 'TASK' },
  { field: 'exactRecords', label: OPS_EXACT_MINUTES_NAME, table: 'TASK' },
  { field: 'lagRecords', label: OPS_DAY_MEASURE_LAGS_NAME, table: 'TASK' },
  { field: 'inheritedWorkRule', label: OPS_XER_INHERITED_WORK_RULE_NAME, table: 'TASK' },
  { field: 'defaultWorkRule', label: OPS_XER_DEFAULT_WORK_RULE_NAME, table: 'PROJECT' },
  { field: 'flatCapacity', label: OPS_XER_FLAT_CAPACITY_NAME, table: 'RSRC' },
  { field: 'capacitySteps', label: OPS_XER_CAPACITY_STEPS_NAME, table: 'RSRC' },
];

export interface XerOpsFields {
  unitByTask: ReadonlyMap<string, 'days' | 'hours'>;
  dayRecordsByTask: ReadonlyMap<string, string>;
  exactRecordsByTask: ReadonlyMap<string, string>;
  lagRecordsByTask: ReadonlyMap<string, string>;
  inheritedWorkRuleByTask: ReadonlyMap<string, WorkRule>;
  defaultWorkRuleByProject: ReadonlyMap<string, WorkRule>;
  flatCapacityByResource: ReadonlyMap<string, number>;
  capacityStepsByResource: ReadonlyMap<string, ReadonlyMap<string, CapacityStepRecord>>;
}

const EMPTY: XerOpsFields = {
  unitByTask: new Map(), dayRecordsByTask: new Map(), exactRecordsByTask: new Map(),
  lagRecordsByTask: new Map(), inheritedWorkRuleByTask: new Map(), defaultWorkRuleByProject: new Map(), flatCapacityByResource: new Map(),
  capacityStepsByResource: new Map(),
};

export function opsUdfFieldOf(row: XerRow): XerOpsField | undefined {
  if (!row.cells.udf_type_id?.trim() || row.cells.logical_data_type?.trim().toUpperCase() !== 'FT_TEXT') return undefined;
  const label = row.cells.udf_type_label?.trim();
  const table = row.cells.table_name?.trim().toUpperCase();
  return OPS_XER_UDFS.find(entry => entry.label === label && entry.table === table)?.field;
}

function opsUdfFieldsByTypeId(tables: XerTables): ReadonlyMap<string, XerOpsField> {
  const fieldByTypeId = new Map<string, XerOpsField>();
  for (const row of tables.tables.get('UDFTYPE')?.rows ?? []) {
    const field = opsUdfFieldOf(row);
    if (field) fieldByTypeId.set(row.cells.udf_type_id.trim(), field);
  }
  return fieldByTypeId;
}

export function readXerOpsFields(tables: XerTables): XerOpsFields {
  const fieldByTypeId = opsUdfFieldsByTypeId(tables);
  if (fieldByTypeId.size === 0) return EMPTY;
  const units = new Map<string, 'days' | 'hours' | null>();
  const texts: Record<'dayRecords' | 'exactRecords' | 'lagRecords', Map<string, string>> = {
    dayRecords: new Map(), exactRecords: new Map(), lagRecords: new Map(),
  };
  const defaultWorkRuleByProject = new Map<string, WorkRule>();
  const inheritedWorkRuleByTask = new Map<string, WorkRule>();
  const flatCapacityByResource = new Map<string, number>();
  const capacityStepsByResource = new Map<string, ReadonlyMap<string, CapacityStepRecord>>();
  for (const row of tables.tables.get('UDFVALUE')?.rows ?? []) {
    const field = fieldByTypeId.get(row.cells.udf_type_id?.trim() ?? '');
    const key = row.cells.fk_id?.trim() ?? '';
    if (!field || !key) continue;
    const text = (row.cells.udf_text ?? '').trim();
    if (field === 'unit') {
      const unit = isTaskDurationUnit(text) ? text : null;
      const seen = units.get(key);
      units.set(key, seen === undefined || seen === unit ? unit : null);
    } else if (field === 'defaultWorkRule' || field === 'inheritedWorkRule') {
      const rule = WORK_RULES.find(candidate => candidate === text);
      const target = field === 'defaultWorkRule' ? defaultWorkRuleByProject : inheritedWorkRuleByTask;
      if (rule && !target.has(key)) target.set(key, rule);
    } else if (field === 'flatCapacity') {
      const value = text === '' ? NaN : Number(text);
      if (Number.isFinite(value) && value >= 0 && !flatCapacityByResource.has(key)) flatCapacityByResource.set(key, value);
    } else if (field === 'capacitySteps') {
      if (!capacityStepsByResource.has(key)) capacityStepsByResource.set(key, parseCapacitySteps(text));
    } else if (!texts[field].has(key)) {
      texts[field].set(key, text);
    }
  }
  const unitByTask = new Map<string, 'days' | 'hours'>();
  for (const [key, unit] of units) if (unit) unitByTask.set(key, unit);
  return {
    unitByTask,
    dayRecordsByTask: texts.dayRecords,
    exactRecordsByTask: texts.exactRecords,
    lagRecordsByTask: texts.lagRecords,
    inheritedWorkRuleByTask,
    defaultWorkRuleByProject,
    flatCapacityByResource,
    capacityStepsByResource,
  };
}
