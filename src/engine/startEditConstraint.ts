import type { Sequence } from '@/types/sequence';
import type { Task, TaskConstraint } from '@/types/task';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { computedStart } from '@/utils/taskDates';
import { isManuallyScheduled } from '@/utils/manualScheduling';

export function predecessorDrivenTaskIds(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
): Set<string> {
  const driven = new Set<string>();
  for (const sequence of expandSummaryRelations(tasks, sequences).sequences) {
    driven.add(sequence.successorId);
  }
  return driven;
}

export function isLooseDayEndMilestone(
  task: Task,
  tasks: readonly Task[],
  sequences: readonly Sequence[],
  dayEndConvention: boolean,
): boolean {
  if (!dayEndConvention || !task.isMilestone || isManuallyScheduled(task)) return false;
  if ([task.constraint, task.constraint2].some(c => c?.type === 'MSO' || c?.type === 'MFO')) return false;
  const expanded = expandSummaryRelations(tasks, sequences).sequences;
  if (expanded.some(seq => seq.successorId === task.id)) return false;
  return task.milestoneKind === 'FINISH' || !expanded.some(seq => seq.predecessorId === task.id);
}

export type StartConstraintChange = 'created' | 'updated';

export interface StartConstraintEdit {
  constraint: TaskConstraint;
  change: StartConstraintChange;
}

function startRuleApplies(task: Task, drivenByPredecessor: boolean): boolean {
  if (!drivenByPredecessor) return false;
  if (task.childIds.length > 0 || isManuallyScheduled(task) || task.isHammock === true) return false;
  return !task.time.actualStart && !(task.time.completion > 0);
}

export function startConstraintAfterEdit(
  task: Task,
  start: string,
  drivenByPredecessor: boolean,
): StartConstraintEdit | undefined {
  if (!start || !startRuleApplies(task, drivenByPredecessor)) return undefined;
  const current = task.constraint;
  if (!current || current.type === 'ASAP') {
    return { constraint: { type: 'SNET', date: start }, change: 'created' };
  }
  if (current.type === 'SNET' && current.date !== start) {
    return { constraint: { ...current, date: start }, change: 'updated' };
  }
  return undefined;
}

export function constraintBlockingStart(task: Task, drivenByPredecessor: boolean): TaskConstraint | undefined {
  if (!startRuleApplies(task, drivenByPredecessor)) return undefined;
  const current = task.constraint;
  return current && current.type !== 'ASAP' && current.type !== 'SNET' ? current : undefined;
}

export function constraintForDraggedStart(
  original: Task,
  start: string,
  drivenByPredecessor: boolean,
): StartConstraintEdit | undefined {
  if (start === computedStart(original)) return undefined;
  return startConstraintAfterEdit(original, start, drivenByPredecessor);
}
