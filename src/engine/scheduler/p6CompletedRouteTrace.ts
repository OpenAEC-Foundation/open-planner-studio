import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

export type CompletedXerLoeActualFinishReason =
  | 'eligible'
  | 'missingDataDate'
  | 'invalidDataDate'
  | 'notXerSource'
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

/**
 * Smalle, pure en fail-closed diagnose voor één bewezen P6-XER-vorm: een voltooide LOE met
 * uitsluitend inkomende SS-relaties en zonder opvolger. Alleen deze vorm mag in `forwardPass`
 * door de generieke hammock-route vallen zodat de bestaande completed-actualroute haar concrete
 * actualFinish gebruikt. De helper leest uitsluitend toegestane invoer/bronprovenance, nooit P6's
 * opgeslagen early/late/float-uitkomst.
 */
export function explainCompletedXerLoeActualFinishEligibility(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
  incoming: readonly Sequence[],
  outgoing: readonly Sequence[],
): CompletedXerLoeActualFinishDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (!Number.isFinite(dataDate.getTime())) return { eligible: false, reason: 'invalidDataDate' };
  if (schedulingOptions?.p6Source !== 'XER') return { eligible: false, reason: 'notXerSource' };
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  if (schedulingOptions.preserveActualDatesInBackwardPass !== true) {
    return { eligible: false, reason: 'preserveActualDatesOff' };
  }
  if (schedulingOptions.p6PreserveActualInstants !== true) {
    return { eligible: false, reason: 'preserveActualInstantsOff' };
  }
  // De forward-route valt daarna door naar de bestaande completed-actualverwerking. Die
  // bewaart XER-instanten alleen voor echte P6-taken; zonder beide herkomstsleutels zou deze
  // uitzondering dus een andere route openen dan de gemeten Harbour-vorm.
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
  // Een LOE die als mijlpaal of met een niet-positieve duur binnenkomt is niet de gemeten
  // Harbour-vorm. Ook wanneer het targetvenster toevallig een span toont, openen we die
  // tegenstrijdige bronvorm niet met deze uitzondering.
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
