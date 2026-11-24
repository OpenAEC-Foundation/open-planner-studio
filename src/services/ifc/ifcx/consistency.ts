import type { WriteIFCInput } from '../ifcWriter';
import { identityProblems, type GlobalIdOfObject, type PlanningModel } from './identity';

export interface Inconsistency {
  readonly field: string;
  readonly detail: string;
}

export interface RuleSubject {
  readonly model: PlanningModel;
  readonly globalIdOf: GlobalIdOfObject;
}

export interface ConsistencyRule {
  readonly id: string;
  readonly reason: string;
  readonly problems: (subject: RuleSubject) => Inconsistency[];
}

export const CONSISTENCY_RULES: readonly ConsistencyRule[] = [
  {
    id: 'identiteit',
    reason: 'Het pad van een object is zijn GlobalId en een verwijzing is een pad: elk id is uniek binnen zijn soort, elke GlobalId is uniek over alle objecten (project, werkplan en werkschema inbegrepen), en elke verwijzing heeft een doel.',
    problems: ({ model, globalIdOf }) => identityProblems(model, globalIdOf),
  },
];

export function planningRuleProblems(subject: RuleSubject): Inconsistency[] {
  return CONSISTENCY_RULES.flatMap(rule => rule.problems(subject));
}

export function inconsistentContent(input: WriteIFCInput, globalIdOf: GlobalIdOfObject): Inconsistency[] {
  return planningRuleProblems({ model: input, globalIdOf });
}
