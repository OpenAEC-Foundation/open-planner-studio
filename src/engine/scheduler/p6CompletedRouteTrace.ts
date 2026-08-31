import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';

export type CpmBackwardActualPinReason =
  | 'eligible'
  | 'missingDataDate'
  | 'preserveActualDatesOff'
  | 'missingActualFinish'
  | 'notCompleted';

export interface CpmBackwardActualPinDecision {
  eligible: boolean;
  reason: CpmBackwardActualPinReason;
}

export type CpmDisplayActualLateReason =
  | 'eligible'
  | 'missingDataDate'
  | 'notCompleted'
  | 'preserveActualDatesOff';

export interface CpmDisplayActualLateDecision {
  eligible: boolean;
  reason: CpmDisplayActualLateReason;
}

/**
 * Pure, fail-closed diagnose van de completed actual-pin in `CPMSolver.backwardPass`.
 * Guardvolgorde volgt bewust exact de bestaande runtimepoort: dataDate → preserve → actualFinish
 * → completion. De eerste afwijzing is de enige gerapporteerde reden.
 */
export function explainBackwardActualPinEligibility(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): CpmBackwardActualPinDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (schedulingOptions?.preserveActualDatesInBackwardPass !== true) {
    return { eligible: false, reason: 'preserveActualDatesOff' };
  }
  if (!task.time.actualFinish) return { eligible: false, reason: 'missingActualFinish' };
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  return { eligible: true, reason: 'eligible' };
}

/**
 * Pure, fail-closed diagnose van de zichtbare late-datumprojectie in `scheduleAnalysis`.
 * Guardvolgorde volgt exact de bestaande runtimepoort: dataDate → completion → preserve.
 */
export function explainDisplayActualLateEligibility(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): CpmDisplayActualLateDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  if (schedulingOptions?.preserveActualDatesInBackwardPass !== true) {
    return { eligible: false, reason: 'preserveActualDatesOff' };
  }
  return { eligible: true, reason: 'eligible' };
}
