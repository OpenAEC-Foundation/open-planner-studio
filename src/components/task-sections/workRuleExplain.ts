import type { WorkRule } from '@/types/workRule';

/**
 * Uitleg per werkregel voor het i-icoon in het veld *Werkregel* (besluit eigenaar 2026-10-15).
 * Elke uitleg heeft drie delen: wat er volgt (vet), wat er gebeurt als je zelf de andere grootheid
 * wijzigt, en wat een extra resource doet. Pure module zonder React: de check
 * `tests/planning/check-work-rule-explain.ts` legt elke zin naast de rekenkern (`workTriangle.ts`),
 * zodat tekst en rekenkern niet uit elkaar lopen.
 *
 * Het bewaarde MS Project-vinkje (`effortDriven`) verandert alleen de twee cellen waar de rekenkern
 * het leest: FIXED_DURATION_WORK + `true` (een duurwijziging past het werk aan, case wt-11b) en
 * FIXED_RATE + `false` (een extra resource voegt werk toe, de duur blijft).
 *
 * Beide maten rekenen exact (F3a/T14); een extra resource gebruikt daarom dezelfde korte zin.
 */
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

/** De zinnen van één uitleg: `lead` staat vet, `rest` volgt erachter. */
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
      // MS Project effort-driven: een duurwijziging past het werk aan, niet de inzet (wt-11b).
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
