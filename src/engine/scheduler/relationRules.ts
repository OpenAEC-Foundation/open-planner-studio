import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { expandSummaryRelations } from './expandSummaryRelations';
import { detectCycleInEdges, detectIntroducedCycle } from './graphWalk';

export interface RelationEndpoints {
  predecessorId: string;
  successorId: string;
}

export type RelationRejection = 'self' | 'unknown-task' | 'ancestor' | 'duplicate';
export type RelationVerdict = { ok: true } | { ok: false; reason: RelationRejection };
export type TaskLookup = (id: string) => Task | undefined;

export function isSummaryTask(task: Task | undefined): boolean {
  return (task?.childIds.length ?? 0) > 0;
}

function isAncestor(lookup: TaskLookup, maybeAncestorId: string, id: string): boolean {
  const visited = new Set<string>();
  let current = lookup(id)?.parentId ?? null;
  while (current) {
    if (current === maybeAncestorId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = lookup(current)?.parentId ?? null;
  }
  return false;
}

/**
 * Weigert alleen een taak aan zichzelf of zijn eigen WBS-(voor)ouder, in beide richtingen.
 * Gewone summary-eindpunten zijn legaal: `expandSummaryRelations` rekent die door naar bladeren.
 * Deze aanmaakregel volgt `parentId`; de solverguard volgt `childIds`. Bij reeds corrupte bomen
 * blijven dat bewust twee onafhankelijke vangnetten en kan de strengste van beide de relatie weren.
 */
export function isAncestorRelation(lookup: TaskLookup, relation: RelationEndpoints): boolean {
  return isAncestor(lookup, relation.predecessorId, relation.successorId)
    || isAncestor(lookup, relation.successorId, relation.predecessorId);
}

/** Structurele regels zonder duplicaatcheck, gedeeld door setplanners en losse schrijvers. */
export function relationStructureVerdict(
  lookup: TaskLookup,
  relation: RelationEndpoints,
): RelationVerdict {
  if (relation.predecessorId === relation.successorId) return { ok: false, reason: 'self' };
  if (!lookup(relation.predecessorId) || !lookup(relation.successorId)) {
    return { ok: false, reason: 'unknown-task' };
  }
  return isAncestorRelation(lookup, relation) ? { ok: false, reason: 'ancestor' } : { ok: true };
}

/**
 * Zou één NIEUWE relatie een kring sluiten? Getoetst zoals de solver rekent: over de bladgraaf na
 * `expandSummaryRelations`, dus een samenvattingseindpunt telt mee (een relatie naar een fase kan
 * via een van haar kinderen rondlopen). Alleen de kring door de nieuwe relatie telt
 * (`detectIntroducedCycle`): een al bestaande kring elders — bv. uit een import — blokkeert geen
 * onschuldige relatie.
 *
 * @returns de kring (bladtaak-ids, begint bij de nieuwe relatie, begin = eind) of `null`.
 */
export function relationCycle(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  relation: RelationEndpoints,
): string[] | null {
  const before = expandSummaryRelations(tasks, sequences).sequences;
  // Expansie is per relatie onafhankelijk (op de MAX_EXPANDED_RELATIONS-klem na): alleen de
  // kandidaat apart uitvouwen volstaat.
  const candidate = expandSummaryRelations(tasks, [{
    id: '__candidate-relation',
    predecessorId: relation.predecessorId,
    successorId: relation.successorId,
    type: 'FINISH_START',
    lagDays: 0,
  }]).sequences;
  if (candidate.length === 0) return null;
  return detectIntroducedCycle(before, [...before, ...candidate]);
}

/** Een relatiegraaf zoals de solver hem ziet: de boom (wie is fase, wie is blad) plus de relaties. */
export interface RelationTree {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
}

/**
 * De kring die `after` ten opzichte van `before` TOEVOEGT, getoetst zoals de solver rekent: beide
 * over de bladgraaf na `expandSummaryRelations`. Een relatie op een fase geldt voor elke taak in die
 * fase, dus niet alleen een nieuwe relatie maar ook een andere BOOM kan een kring maken — hang een
 * taak onder een fase en haar relaties gelden voortaan ook voor die taak (audit taakmutaties, S4);
 * spring een taak uit haar fase en een relatie tussen die twee, die zolang niet meetelde, telt weer.
 * Gebruikt door de verhangregel (`hierarchyChangeVerdict`: zelfde relaties, andere boom); de vorm
 * (vóór/na als volledige graaf) past ook op een bewerking die de relaties verandert.
 *
 * Alleen een NIEUWE kring telt (`detectIntroducedCycle`, zoals `relationCycle`): een kring die er al
 * was — bv. uit een import — blokkeert geen onschuldige bewerking.
 *
 * Kosten: de gewone weg (geen kring na de bewerking) is één uitvouwing plus één DFS; de graaf van
 * vóór wordt alleen uitgevouwen als er na de bewerking een kring is.
 *
 * @returns de kring (bladtaak-ids, begint bij een nieuwe kant, begin = eind) of `null`.
 */
export function introducedCycle(before: RelationTree, after: RelationTree): string[] | null {
  if (after.sequences.length === 0) return null;
  const expandedAfter = expandSummaryRelations(after.tasks, after.sequences).sequences;
  if (!detectCycleInEdges(expandedAfter)) return null;
  return detectIntroducedCycle(expandSummaryRelations(before.tasks, before.sequences).sequences, expandedAfter);
}
