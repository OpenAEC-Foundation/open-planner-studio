import type { Sequence } from '@/types/sequence';
import type { ExternalLink, Task } from '@/types/task';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';

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

export type InternalRelationWarning =
  | 'dropped'
  | 'truncated-lead'
  | 'lead-exceeds-duration'
  | 'out-of-sequence';
export type ExternalRelationWarning = 'source-missing';

export interface InternalRelationAnalysis {
  driving: boolean;
  freeFloat?: number;
  warnings: readonly InternalRelationWarning[];
}

export interface RelationTraceEdge {
  otherTaskId: string;
  sequenceId: string;
  driving: boolean;
}

/** Alleen de relationele CPM-afgeleiden die dit readmodel nodig heeft; een volledig CPMResult past. */
export interface RelationIndexAnalysisInput {
  drivingSequenceIds: readonly string[];
  sequenceFreeFloat: Readonly<Record<string, number>>;
  truncatedLeadSequenceIds: readonly string[];
  outOfSequenceSequenceIds: readonly string[];
  droppedSequenceIds?: readonly string[];
}

export interface TaskRelationIndex {
  predecessorsByTaskId: ReadonlyMap<string, readonly TaskRelationEntry[]>;
  successorsByTaskId: ReadonlyMap<string, readonly TaskRelationEntry[]>;
  internalByTaskId: ReadonlyMap<string, readonly InternalTaskRelationEntry[]>;
  externalByTaskId: ReadonlyMap<string, readonly ExternalTaskRelationEntry[]>;
  analysisBySequenceId: ReadonlyMap<string, InternalRelationAnalysis>;
  warningsByExternalLinkId: ReadonlyMap<string, readonly ExternalRelationWarning[]>;
  tracePredecessorsByTaskId: ReadonlyMap<string, readonly RelationTraceEdge[]>;
  traceSuccessorsByTaskId: ReadonlyMap<string, readonly RelationTraceEdge[]>;
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
  analysis?: RelationIndexAnalysisInput | null,
): TaskRelationIndex {
  const predecessors = new Map<string, TaskRelationEntry[]>();
  const successors = new Map<string, TaskRelationEntry[]>();
  const internal = new Map<string, InternalTaskRelationEntry[]>();
  const external = new Map<string, ExternalTaskRelationEntry[]>();
  const analysisBySequenceId = new Map<string, InternalRelationAnalysis>();
  const warningsByExternalLinkId = new Map<string, readonly ExternalRelationWarning[]>();
  const tracePredecessors = new Map<string, RelationTraceEdge[]>();
  const traceSuccessors = new Map<string, RelationTraceEdge[]>();
  const drivingIds = new Set(analysis?.drivingSequenceIds ?? []);
  const droppedIds = new Set(analysis?.droppedSequenceIds ?? []);
  const truncatedLeadIds = new Set(analysis?.truncatedLeadSequenceIds ?? []);
  const outOfSequenceIds = new Set(analysis?.outOfSequenceSequenceIds ?? []);
  const tasksById = new Map(tasks.map(task => [task.id, task] as const));

  for (const sequence of sequences) {
    const driving = drivingIds.has(sequence.id);
    const warnings: InternalRelationWarning[] = [];
    if (droppedIds.has(sequence.id)) warnings.push('dropped');
    if (truncatedLeadIds.has(sequence.id)) warnings.push('truncated-lead');
    const predecessor = tasksById.get(sequence.predecessorId);
    if (predecessor) {
      const effectiveLag = resolveEffectiveLagDays(sequence, predecessor);
      const predecessorDuration = predecessor.isMilestone
        ? 0
        : predecessor.time?.scheduleDuration ?? 0;
      if (effectiveLag < 0 && Math.abs(effectiveLag) > predecessorDuration) {
        warnings.push('lead-exceeds-duration');
      }
    }
    if (outOfSequenceIds.has(sequence.id)) warnings.push('out-of-sequence');
    const freeFloat = analysis?.sequenceFreeFloat[sequence.id];
    analysisBySequenceId.set(sequence.id, {
      driving,
      ...(freeFloat !== undefined ? { freeFloat } : {}),
      warnings,
    });
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
    append(tracePredecessors, sequence.successorId, {
      otherTaskId: sequence.predecessorId, sequenceId: sequence.id, driving,
    });
    append(traceSuccessors, sequence.predecessorId, {
      otherTaskId: sequence.successorId, sequenceId: sequence.id, driving,
    });
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
      warningsByExternalLinkId.set(link.id, link.sourceMissing ? ['source-missing'] : []);
    }
  }

  return {
    predecessorsByTaskId: predecessors,
    successorsByTaskId: successors,
    internalByTaskId: internal,
    externalByTaskId: external,
    analysisBySequenceId,
    warningsByExternalLinkId,
    tracePredecessorsByTaskId: tracePredecessors,
    traceSuccessorsByTaskId: traceSuccessors,
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
