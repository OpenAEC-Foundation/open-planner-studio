import type { MspTaskType } from '@/types/task';
import type { WorkRule } from '@/types/workRule';

export const MSPDI_TASK_TYPE_CODE: Record<MspTaskType, 0 | 1 | 2> = {
  FIXED_UNITS: 0,
  FIXED_DURATION: 1,
  FIXED_WORK: 2,
};

const MSP_TASK_TYPES_BY_CODE: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];

export function mspTaskTypeFromCode(code: number | null | undefined): MspTaskType | undefined {
  if (code === null || code === undefined || !Number.isInteger(code)) return undefined;
  return MSP_TASK_TYPES_BY_CODE[code];
}

export function workRuleFromMsp(type: MspTaskType | undefined, effortDriven: boolean | undefined): WorkRule | undefined {
  switch (type) {
    case 'FIXED_UNITS': return 'FIXED_RATE';
    case 'FIXED_DURATION': return effortDriven ? 'FIXED_DURATION_WORK' : 'FIXED_DURATION_RATE';
    case 'FIXED_WORK': return 'FIXED_WORK';
    default: return undefined;
  }
}

export function mspFromWorkRule(rule: WorkRule, effortDriven: boolean | undefined): { type: MspTaskType; effortDriven: boolean } {
  switch (rule) {
    case 'FIXED_RATE': return { type: 'FIXED_UNITS', effortDriven: effortDriven ?? true };
    case 'FIXED_DURATION_RATE': return { type: 'FIXED_DURATION', effortDriven: effortDriven ?? false };
    case 'FIXED_DURATION_WORK': return { type: 'FIXED_DURATION', effortDriven: effortDriven ?? true };
    case 'FIXED_WORK': return { type: 'FIXED_WORK', effortDriven: true };
  }
}

export const P6_DURATION_TYPE_NAME: Record<WorkRule, string> = {
  FIXED_DURATION_RATE: 'Fixed Duration and Units/Time',
  FIXED_DURATION_WORK: 'Fixed Duration and Units',
  FIXED_WORK: 'Fixed Units',
  FIXED_RATE: 'Fixed Units/Time',
};

const P6_NAME_TO_RULE: ReadonlyMap<string, WorkRule> = new Map(
  (Object.entries(P6_DURATION_TYPE_NAME) as [WorkRule, string][]).map(([rule, name]) => [normalizeP6Name(name), rule]),
);

function normalizeP6Name(name: string): string {
  return name.trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ');
}

export function workRuleFromP6DurationType(name: string | null | undefined): WorkRule | undefined {
  if (!name) return undefined;
  return P6_NAME_TO_RULE.get(normalizeP6Name(name));
}

export const XER_DURATION_TYPE_TOKEN: Record<WorkRule, string> = {
  FIXED_DURATION_RATE: 'DT_FixedDrtn',
  FIXED_DURATION_WORK: 'DT_FixedDUR2',
  FIXED_WORK: 'DT_FixedQty',
  FIXED_RATE: 'DT_FixedRate',
};

const XER_TOKEN_TO_RULE: ReadonlyMap<string, WorkRule> = new Map(
  (Object.entries(XER_DURATION_TYPE_TOKEN) as [WorkRule, string][]).map(([rule, token]) => [token, rule]),
);

export function workRuleFromXerDurationType(token: string | null | undefined): WorkRule | undefined {
  if (!token) return undefined;
  return XER_TOKEN_TO_RULE.get(token.trim());
}

const RATE_REL_EPS = 1e-5;

export function importedAssignmentRate(
  plannedRate: number,
  remainingRate: number | undefined,
  remainingWork: number | undefined,
): { unitsPerDay: number; plannedUnitsPerDay?: number } {
  const hasRemainingWork = typeof remainingWork === 'number' && Number.isFinite(remainingWork) && remainingWork > 0;
  const usableRemaining = typeof remainingRate === 'number' && Number.isFinite(remainingRate) && remainingRate > 0;
  if (!hasRemainingWork || !usableRemaining) return { unitsPerDay: plannedRate };
  const scale = Math.max(Math.abs(plannedRate), Math.abs(remainingRate));
  if (Math.abs(remainingRate - plannedRate) <= RATE_REL_EPS * scale) return { unitsPerDay: plannedRate };
  return { unitsPerDay: remainingRate, plannedUnitsPerDay: plannedRate };
}

const WORK_EPS_MINUTES = 1;

export function importedWorkFields(
  source: { plannedMinutes?: number; actualMinutes?: number; remainingMinutes?: number },
  derivedWorkMinutes: number,
): { plannedWorkMinutes?: number; actualWorkMinutes?: number; remainingWorkMinutes?: number } {
  const clean = (v: number | undefined): number | undefined =>
    (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const planned = clean(source.plannedMinutes);
  const actual = clean(source.actualMinutes);
  const remaining = clean(source.remainingMinutes);
  if (planned === undefined && actual === undefined && remaining === undefined) return {};
  const derived = Number.isFinite(derivedWorkMinutes) && derivedWorkMinutes >= 0 ? derivedWorkMinutes : 0;
  const plannedDeviates = planned !== undefined && Math.abs(planned - derived) > WORK_EPS_MINUTES;
  const actualPresent = actual !== undefined && actual > WORK_EPS_MINUTES;
  const expectedRemaining = (planned ?? derived) - (actual ?? 0);
  const remainingDeviates = remaining !== undefined && Math.abs(remaining - expectedRemaining) > WORK_EPS_MINUTES;
  if (!plannedDeviates && !remainingDeviates) return actualPresent ? { actualWorkMinutes: actual } : {};
  return {
    ...(planned !== undefined ? { plannedWorkMinutes: planned } : {}),
    ...(actual !== undefined ? { actualWorkMinutes: actual } : {}),
    ...(remaining !== undefined ? { remainingWorkMinutes: remaining } : {}),
  };
}
