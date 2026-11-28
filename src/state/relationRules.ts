import {
  relationCycle,
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationRejection,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Task } from '@/types/task';

export {
  isAncestorRelation,
  isSummaryTask,
  relationCycle,
  relationStructureVerdict,
  type RelationEndpoints,
  type RelationRejection,
  type RelationVerdict,
  type TaskLookup,
} from '@/engine/scheduler/relationRules';

export function relationKey(relation: RelationEndpoints & { type: string }): string {
  return `${relation.predecessorId}|${relation.successorId}|${relation.type}`;
}

export function relationVerdict(
  lookup: TaskLookup,
  sequences: readonly Sequence[],
  relation: RelationEndpoints & { type: SequenceType },
): RelationVerdict {
  const structure = relationStructureVerdict(lookup, relation);
  if (!structure.ok) return structure;
  const exists = sequences.some(sequence => (
    sequence.predecessorId === relation.predecessorId
      && sequence.successorId === relation.successorId
      && sequence.type === relation.type
  ));
  return exists ? { ok: false, reason: 'duplicate' } : { ok: true };
}

export type RelationAddRejection = RelationRejection | 'cycle';
export type RelationAddVerdict =
  | { ok: true }
  | { ok: false; reason: RelationRejection }
  | { ok: false; reason: 'cycle'; cycle: readonly string[] };

export function relationAddVerdict(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  relation: RelationEndpoints & { type: SequenceType },
): RelationAddVerdict {
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const local = relationVerdict(id => byId.get(id), sequences, relation);
  if (!local.ok) return local;
  const cycle = relationCycle(tasks, sequences, relation);
  return cycle ? { ok: false, reason: 'cycle', cycle } : { ok: true };
}
