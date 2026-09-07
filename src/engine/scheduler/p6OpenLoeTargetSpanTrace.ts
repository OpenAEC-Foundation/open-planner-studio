import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

export type OpenXerLoeTargetSpanReason =
  | 'eligible'
  | 'notXerSource'
  | 'missingProjectProvenance'
  | 'missingTaskProvenance'
  | 'wrongActivityType'
  | 'notHammock'
  | 'wrongCompletePctType'
  | 'wrongDurationType'
  | 'notNotStarted'
  | 'invalidCompletion'
  | 'hasActuals'
  | 'hasSuspendResume'
  | 'milestoneOrZeroDuration'
  | 'missingExplicitTargetWindow'
  | 'missingScheduleStart'
  | 'missingScheduleFinish'
  | 'invalidScheduleStart'
  | 'invalidScheduleFinish'
  | 'targetWindowNotPositive'
  | 'targetWindowDurationMismatch'
  | 'targetStartConflictsWithRelation'
  | 'missingIncomingStartStart'
  | 'incomingNotOnlyStartStart'
  | 'missingOutgoingFinishFinish'
  | 'outgoingNotOnlyFinishFinish'
  | 'nonZeroRelationLag';

export interface OpenXerLoeTargetSpanDecision {
  eligible: boolean;
  reason: OpenXerLoeTargetSpanReason;
}

function hasOnlyZeroLag(sequences: readonly Sequence[]): boolean {
  return sequences.every(sequence => sequence.lagDays === 0
    && (sequence.lagMinutes === undefined || sequence.lagMinutes === 0)
    && sequence.lagPercent === undefined);
}

/**
 * Pure, fail-closed diagnose voor precies de bewezen Ashspace-vorm: een niet-gestarte XER-LOE
 * met een volledig, positief targetvenster, uitsluitend nul-lag SS-ingang en uitsluitend nul-lag
 * FF-uitgang. De relationele startdruk wordt als al-berekende productinvoer meegegeven; zo mag
 * target_start_date hem nooit overschrijven. P6 early/late/float/driving-uitvoer wordt niet gelezen.
 */
export function explainOpenXerLoeTargetSpanEligibility(
  task: Task,
  schedulingOptions: SchedulingOptions | undefined,
  incoming: readonly Sequence[],
  outgoing: readonly Sequence[],
  relationalEarlyStart: Date,
  targetWindowWorkMinutes: number,
  targetWindowToleranceMinutes: number,
): OpenXerLoeTargetSpanDecision {
  if (schedulingOptions?.p6Source !== 'XER') return { eligible: false, reason: 'notXerSource' };
  if (task.p6ProjectId === undefined || task.p6ProjectId === '') {
    return { eligible: false, reason: 'missingProjectProvenance' };
  }
  if (task.p6TaskId === undefined || task.p6TaskId === '') {
    return { eligible: false, reason: 'missingTaskProvenance' };
  }
  if (task.p6ActivityType !== 'TT_LOE') return { eligible: false, reason: 'wrongActivityType' };
  if (task.isHammock !== true) return { eligible: false, reason: 'notHammock' };
  if (task.p6CompletePctType !== 'CP_Drtn') return { eligible: false, reason: 'wrongCompletePctType' };
  if (task.p6DurationType !== 'DT_FixedDUR2') return { eligible: false, reason: 'wrongDurationType' };
  if (task.status !== 'NOT_STARTED') return { eligible: false, reason: 'notNotStarted' };
  if (!Number.isFinite(task.time.completion) || task.time.completion !== 0) {
    return { eligible: false, reason: 'invalidCompletion' };
  }
  if (task.time.actualStart !== undefined || task.time.actualFinish !== undefined) {
    return { eligible: false, reason: 'hasActuals' };
  }
  if (task.time.stop !== undefined || task.time.resume !== undefined || task.p6SuspendResume === true) {
    return { eligible: false, reason: 'hasSuspendResume' };
  }
  const durationMinutes = task.time.durationMinutes;
  if (task.isMilestone || !Number.isFinite(task.time.scheduleDuration) || task.time.scheduleDuration <= 0
    || durationMinutes === undefined || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { eligible: false, reason: 'milestoneOrZeroDuration' };
  }
  if (task.p6ExplicitTargetWindow !== true) return { eligible: false, reason: 'missingExplicitTargetWindow' };
  if (!task.time.scheduleStart) return { eligible: false, reason: 'missingScheduleStart' };
  if (!task.time.scheduleFinish) return { eligible: false, reason: 'missingScheduleFinish' };
  const targetStart = parseInstant(task.time.scheduleStart);
  const targetFinish = parseInstant(task.time.scheduleFinish);
  if (!Number.isFinite(targetStart.getTime())) return { eligible: false, reason: 'invalidScheduleStart' };
  if (!Number.isFinite(targetFinish.getTime())) return { eligible: false, reason: 'invalidScheduleFinish' };
  if (targetFinish <= targetStart) return { eligible: false, reason: 'targetWindowNotPositive' };
  if (!Number.isFinite(relationalEarlyStart.getTime()) || targetStart.getTime() !== relationalEarlyStart.getTime()) {
    return { eligible: false, reason: 'targetStartConflictsWithRelation' };
  }
  // P6 bewaart een targetvenster met inclusieve eindgrens: op de normale 5×8-kalender kan de
  // bronduur daarom precies één werkdag groter zijn dan `workMinutesBetween(start, finish)`.
  // Buiten die kleine, meetbare representatieband sluit de route; een willekeurige taakduur mag
  // dus geen spanroute openen.
  if (!Number.isFinite(targetWindowWorkMinutes) || targetWindowWorkMinutes <= 0
    || !Number.isFinite(targetWindowToleranceMinutes) || targetWindowToleranceMinutes < 0
    || Math.abs(durationMinutes - Math.round(targetWindowWorkMinutes)) > targetWindowToleranceMinutes) {
    return { eligible: false, reason: 'targetWindowDurationMismatch' };
  }
  if (incoming.length === 0) return { eligible: false, reason: 'missingIncomingStartStart' };
  if (incoming.some(sequence => sequence.type !== 'START_START')) {
    return { eligible: false, reason: 'incomingNotOnlyStartStart' };
  }
  if (outgoing.length === 0) return { eligible: false, reason: 'missingOutgoingFinishFinish' };
  if (outgoing.some(sequence => sequence.type !== 'FINISH_FINISH')) {
    return { eligible: false, reason: 'outgoingNotOnlyFinishFinish' };
  }
  if (!hasOnlyZeroLag([...incoming, ...outgoing])) return { eligible: false, reason: 'nonZeroRelationLag' };
  return { eligible: true, reason: 'eligible' };
}
