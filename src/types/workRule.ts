export type WorkRule =
  | 'FIXED_DURATION_RATE'
  | 'FIXED_DURATION_WORK'
  | 'FIXED_WORK'
  | 'FIXED_RATE';

const WORK_RULE_TABLE = {
  FIXED_DURATION_RATE: true,
  FIXED_DURATION_WORK: true,
  FIXED_WORK: true,
  FIXED_RATE: true,
} satisfies Record<WorkRule, true>;

export const WORK_RULES = Object.keys(WORK_RULE_TABLE) as WorkRule[];

export const DEFAULT_WORK_RULE: WorkRule = 'FIXED_DURATION_RATE';
