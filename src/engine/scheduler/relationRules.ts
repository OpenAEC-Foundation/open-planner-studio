import type { Task } from '@/types/task';
import { isSummaryTask as taskIsSummary } from '@/utils/taskHierarchy';
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

export function isAncestorRelation(lookup: TaskLookup, relation: RelationEndpoints): boolean {
  return isAncestor(lookup, relation.predecessorId, relation.successorId)
    || isAncestor(lookup, relation.successorId, relation.predecessorId);
}

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

export function relationCycle(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  relation: RelationEndpoints,
): string[] | null {
  const before = expandSummaryRelations(tasks, sequences).sequences;
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

export interface RelationTree {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
}

export function introducedCycle(before: RelationTree, after: RelationTree): string[] | null {
  if (after.sequences.length === 0) return null;
  const expandedAfter = expandSummaryRelations(after.tasks, after.sequences).sequences;
  if (!detectCycleInEdges(expandedAfter)) return null;
  return detectIntroducedCycle(expandSummaryRelations(before.tasks, before.sequences).sequences, expandedAfter);
}
