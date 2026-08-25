import type { Sequence } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';

export interface InternalTaskRelationEntry {
  kind: 'internal';
  taskId: string;
  direction: 'predecessor' | 'successor';
  otherTaskId: string;
  sequence: Sequence;
}

export interface ExternalTaskRelationEntry {
  kind: 'external';
  taskId: string;
  direction: 'predecessor' | 'successor';
  otherTaskId: string;
  link: ExternalLink;
}

export type TaskRelationEntry = InternalTaskRelationEntry | ExternalTaskRelationEntry;

export interface TaskRelationIndex {
  predecessorsByTaskId: ReadonlyMap<string, readonly TaskRelationEntry[]>;
  successorsByTaskId: ReadonlyMap<string, readonly TaskRelationEntry[]>;
  internalByTaskId: ReadonlyMap<string, readonly InternalTaskRelationEntry[]>;
  externalByTaskId: ReadonlyMap<string, readonly ExternalTaskRelationEntry[]>;
}

function append<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

/** Bouwt in één pass over sequences en één pass over task.externalLinks het enige taakgrid-readmodel
 * voor interne en externe voorgangers/opvolgers. Descriptors lezen uitsluitend deze maps. */
export function buildTaskRelationIndex(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
): TaskRelationIndex {
  const predecessors = new Map<string, TaskRelationEntry[]>();
  const successors = new Map<string, TaskRelationEntry[]>();
  const internal = new Map<string, InternalTaskRelationEntry[]>();
  const external = new Map<string, ExternalTaskRelationEntry[]>();

  for (const sequence of sequences) {
    const asSuccessor: InternalTaskRelationEntry = {
      kind: 'internal',
      taskId: sequence.successorId,
      direction: 'predecessor',
      otherTaskId: sequence.predecessorId,
      sequence,
    };
    const asPredecessor: InternalTaskRelationEntry = {
      kind: 'internal',
      taskId: sequence.predecessorId,
      direction: 'successor',
      otherTaskId: sequence.successorId,
      sequence,
    };
    append(predecessors, sequence.successorId, asSuccessor);
    append(successors, sequence.predecessorId, asPredecessor);
    append(internal, sequence.successorId, asSuccessor);
    append(internal, sequence.predecessorId, asPredecessor);
  }

  for (const task of tasks) {
    for (const link of task.externalLinks ?? []) {
      const entry: ExternalTaskRelationEntry = {
        kind: 'external',
        taskId: task.id,
        direction: link.direction,
        otherTaskId: link.sourceRef.taskId,
        link,
      };
      append(link.direction === 'predecessor' ? predecessors : successors, task.id, entry);
      append(external, task.id, entry);
    }
  }

  return {
    predecessorsByTaskId: predecessors,
    successorsByTaskId: successors,
    internalByTaskId: internal,
    externalByTaskId: external,
  };
}

export function taskRelations(
  index: TaskRelationIndex,
  taskId: string,
  direction: 'predecessor' | 'successor',
): readonly TaskRelationEntry[] {
  return (direction === 'predecessor'
    ? index.predecessorsByTaskId
    : index.successorsByTaskId).get(taskId) ?? [];
}
