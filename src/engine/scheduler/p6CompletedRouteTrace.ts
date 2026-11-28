import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';
import {
  explainP6CompletedDataDateWindowResolved,
  type P6CompletedWindowReason,
} from '@/engine/scheduler/p6CompletedTargetWindow';

export type CompletedXerLoeActualFinishReason =
  | 'eligible'
  | 'missingDataDate'
  | 'invalidDataDate'
  | 'conventionOff'
  | 'remainingStartOff'
  | 'preserveActualDatesOff'
  | 'preserveActualInstantsOff'
  | 'missingProjectProvenance'
  | 'missingTaskProvenance'
  | 'wrongActivityType'
  | 'wrongCompletePctType'
  | 'wrongDurationType'
  | 'missingExplicitTargetWindow'
  | 'notCompleted'
  | 'invalidCompletion'
  | 'hasSuspendResume'
  | 'milestoneOrZeroDuration'
  | 'missingScheduleStart'
  | 'missingScheduleFinish'
  | 'missingActualFinish'
  | 'invalidScheduleStart'
  | 'invalidScheduleFinish'
  | 'invalidActualFinish'
  | 'targetWindowInverted'
  | 'actualFinishBeforeTargetFinish'
  | 'actualFinishAfterDataDate'
  | 'missingIncomingStartStart'
  | 'incomingNotOnlyStartStart'
  | 'hasOutgoingRelation';

export interface CompletedXerLoeActualFinishDecision {
  eligible: boolean;
  reason: CompletedXerLoeActualFinishReason;
}

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

export function explainCompletedXerLoeActualFinishEligibilityResolved(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
  incoming: readonly Sequence[],
  outgoing: readonly Sequence[],
): CompletedXerLoeActualFinishDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (!Number.isFinite(dataDate.getTime())) return { eligible: false, reason: 'invalidDataDate' };
  if (schedulingOptions?.p6CompletedLoeActualFinish !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  if (schedulingOptions.preserveActualDatesInBackwardPass !== true) {
    return { eligible: false, reason: 'preserveActualDatesOff' };
  }
  if (schedulingOptions.p6PreserveActualInstants !== true) {
    return { eligible: false, reason: 'preserveActualInstantsOff' };
  }
  if (task.p6ProjectId === undefined || task.p6ProjectId === '') {
    return { eligible: false, reason: 'missingProjectProvenance' };
  }
  if (task.p6TaskId === undefined || task.p6TaskId === '') {
    return { eligible: false, reason: 'missingTaskProvenance' };
  }
  if (task.p6ActivityType !== 'TT_LOE') return { eligible: false, reason: 'wrongActivityType' };
  if (task.p6CompletePctType !== 'CP_Drtn') return { eligible: false, reason: 'wrongCompletePctType' };
  if (task.p6DurationType !== 'DT_FixedDrtn') return { eligible: false, reason: 'wrongDurationType' };
  if (task.p6ExplicitTargetWindow !== true) {
    return { eligible: false, reason: 'missingExplicitTargetWindow' };
  }
  if (task.status !== 'COMPLETED' || task.time.completion < 1) {
    return { eligible: false, reason: 'notCompleted' };
  }
  if (!Number.isFinite(task.time.completion)) return { eligible: false, reason: 'invalidCompletion' };
  if (task.time.stop !== undefined || task.time.resume !== undefined || task.p6SuspendResume === true) {
    return { eligible: false, reason: 'hasSuspendResume' };
  }
  if (task.isMilestone || !Number.isFinite(task.time.scheduleDuration) || task.time.scheduleDuration <= 0) {
    return { eligible: false, reason: 'milestoneOrZeroDuration' };
  }
  if (!task.time.scheduleStart) return { eligible: false, reason: 'missingScheduleStart' };
  if (!task.time.scheduleFinish) return { eligible: false, reason: 'missingScheduleFinish' };
  if (!task.time.actualFinish) return { eligible: false, reason: 'missingActualFinish' };
  const scheduleStart = parseInstant(task.time.scheduleStart);
  const scheduleFinish = parseInstant(task.time.scheduleFinish);
  const actualFinish = parseInstant(task.time.actualFinish);
  if (!Number.isFinite(scheduleStart.getTime())) return { eligible: false, reason: 'invalidScheduleStart' };
  if (!Number.isFinite(scheduleFinish.getTime())) return { eligible: false, reason: 'invalidScheduleFinish' };
  if (!Number.isFinite(actualFinish.getTime())) return { eligible: false, reason: 'invalidActualFinish' };
  if (scheduleStart > scheduleFinish) return { eligible: false, reason: 'targetWindowInverted' };
  if (actualFinish < scheduleFinish) {
    return { eligible: false, reason: 'actualFinishBeforeTargetFinish' };
  }
  if (actualFinish > dataDate) return { eligible: false, reason: 'actualFinishAfterDataDate' };
  if (incoming.length === 0) return { eligible: false, reason: 'missingIncomingStartStart' };
  if (incoming.some(sequence => sequence.type !== 'START_START')) {
    return { eligible: false, reason: 'incomingNotOnlyStartStart' };
  }
  if (outgoing.length > 0) return { eligible: false, reason: 'hasOutgoingRelation' };
  return { eligible: true, reason: 'eligible' };
}

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

export type P6CompletedLateRemainingWindowReason =
  | 'eligible'
  | CpmBackwardActualPinReason
  | 'conventionOff'
  | 'flagOff'
  | P6CompletedWindowReason;

export interface P6CompletedLateRemainingWindowDecision {
  eligible: boolean;
  reason: P6CompletedLateRemainingWindowReason;
}

export function explainP6CompletedLateRemainingWindowEligibilityResolved(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedLateRemainingWindowDecision {
  const pin = explainBackwardActualPinEligibility(task, dataDate, schedulingOptions);
  if (!pin.eligible) return { eligible: false, reason: pin.reason };
  if (schedulingOptions?.p6CompletedDataDateWindow !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6CompletedLateFromRemainingWindow !== true) {
    return { eligible: false, reason: 'flagOff' };
  }
  const window = explainP6CompletedDataDateWindowResolved(task, dataDate, schedulingOptions);
  if (!window.eligible) return { eligible: false, reason: window.reason };
  return { eligible: true, reason: 'eligible' };
}
