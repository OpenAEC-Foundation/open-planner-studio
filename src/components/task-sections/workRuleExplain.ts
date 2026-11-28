import type { WorkRule } from '@/types/workRule';

export const WORK_RULE_SENTENCES = [
  'followsWork',
  'followsUnits',
  'followsDuration',
  'followsUnitsFromWork',
  'workAdjustsUnits',
  'unitsAdjustsWork',
  'durationAdjustsUnits',
  'durationAdjustsWork',
  'unitsOrDurationAdjustsWork',
  'resourceAddsWork',
  'resourceSharesWork',
  'resourceShorter',
  'resourceAddsWorkSameDuration',
] as const;

export type WorkRuleSentence = typeof WORK_RULE_SENTENCES[number];

export interface WorkRuleExplanation {
  lead: WorkRuleSentence;
  rest: readonly WorkRuleSentence[];
}

export function workRuleExplanation(
  rule: WorkRule,
  effortDriven: boolean | undefined,
): WorkRuleExplanation {
  const shorter: WorkRuleSentence = 'resourceShorter';
  switch (rule) {
    case 'FIXED_DURATION_RATE':
      return { lead: 'followsWork', rest: ['workAdjustsUnits', 'resourceAddsWork'] };
    case 'FIXED_DURATION_WORK':
      return effortDriven === true
        ? { lead: 'followsUnitsFromWork', rest: ['unitsOrDurationAdjustsWork', 'resourceSharesWork'] }
        : { lead: 'followsUnits', rest: ['unitsAdjustsWork', 'resourceSharesWork'] };
    case 'FIXED_WORK':
      return { lead: 'followsDuration', rest: ['durationAdjustsUnits', shorter] };
    case 'FIXED_RATE':
      return {
        lead: 'followsDuration',
        rest: ['durationAdjustsWork', effortDriven === false ? 'resourceAddsWorkSameDuration' : shorter],
      };
  }
}
