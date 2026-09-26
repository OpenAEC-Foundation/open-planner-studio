import type { Task } from '@/types/task';
import { isSummaryTask as taskIsSummary } from '@/utils/taskHierarchy';
import type { Sequence } from '@/types/sequence';
import { expandSummaryRelations } from './expandSummaryRelations';
import { detectIntroducedCycle } from './graphWalk';

export interface RelationEndpoints {
  predecessorId: string;
  successorId: string;
}

export type RelationRejection = 'self' | 'unknown-task' | 'ancestor' | 'duplicate';
export type RelationVerdict = { ok: true } | { ok: false; reason: RelationRejection };
export type TaskLookup = (id: string) => Task | undefined;

/** Delegeert naar de gedeelde WBS-semantiek: een taak met kinderen én een expliciet gemarkeerde
 *  lege WBS-taak (P6 PROJWBS) zijn allebei samenvattingen. Zo gebruiken scheduler, renderer,
 *  resourcepaden en IFC exact hetzelfde begrip. */
export function isSummaryTask(task: Task | undefined): boolean {
  return taskIsSummary(task);
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
