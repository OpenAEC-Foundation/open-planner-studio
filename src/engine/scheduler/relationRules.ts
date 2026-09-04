import type { Task } from '@/types/task';
import { isSummaryTask as taskIsSummary } from '@/utils/taskHierarchy';

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
