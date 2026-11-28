import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { parseInstant } from '@/utils/dateUtils';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import { isLeafTask } from '@/utils/taskHierarchy';

export type P6CompletedWindowReason =
  | 'eligible'
  | 'missingDataDate'
  | 'conventionOff'
  | 'remainingStartOff'
  | 'notLeafTask'
  | 'missingProjectProvenance'
  | 'missingTaskProvenance'
  | 'missingExplicitTargetWindow'
  | 'wrongCompletePctType'
  | 'wrongDurationType'
  | 'wrongActivityType'
  | 'hasSuspendResume'
  | 'notCompleted'
  | 'zeroDurationMilestone';

export interface P6CompletedWindowDecision {
  eligible: boolean;
  reason: P6CompletedWindowReason;
}

interface P6CompletedGateFields {
  projectId: string | undefined;
  taskId: string | undefined;
  explicitTargetWindow: boolean | undefined;
  completePctType: Task['p6CompletePctType'];
  durationType: Task['p6DurationType'];
  activityType: Task['p6ActivityType'];
  suspendResume: boolean | undefined;
}

function p6CompletedGateFields(task: Task): P6CompletedGateFields {
  return {
    projectId: task.p6ProjectId,
    taskId: task.p6TaskId,
    explicitTargetWindow: task.p6ExplicitTargetWindow,
    completePctType: task.p6CompletePctType,
    durationType: task.p6DurationType,
    activityType: task.p6ActivityType,
    suspendResume: task.p6SuspendResume,
  };
}

function provenanceRejection(task: Task, fields: P6CompletedGateFields): P6CompletedWindowReason | null {
  if (!isLeafTask(task)) return 'notLeafTask';
  if (fields.projectId === undefined || fields.projectId === '') return 'missingProjectProvenance';
  if (fields.taskId === undefined || fields.taskId === '') return 'missingTaskProvenance';
  if (fields.explicitTargetWindow !== true) return 'missingExplicitTargetWindow';
  return null;
}

function mayUseSuspendResumeCompletedWindow(
  task: Task,
  fields: P6CompletedGateFields,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  if (fields.suspendResume !== true) return false;
  if (task.time.completion < 1) return false;
  if (fields.activityType !== 'TT_Task') return false;
  if (dataDate === null) return false;
  if (schedulingOptions?.preserveActualDatesInBackwardPass !== true) return false;
  if (!task.time.actualFinish) return false;
  const actualFinishTime = parseInstant(task.time.actualFinish).getTime();
  if (!Number.isFinite(actualFinishTime)) return false;
  const targetFinishTime = parseInstant(task.time.scheduleFinish).getTime();
  if (!Number.isFinite(targetFinishTime)) return false;
  if (actualFinishTime < targetFinishTime) return false;
  if (actualFinishTime > dataDate.getTime()) return false;
  if (!hasValidP6SuspendResume(task)) return false;
  if (!task.time.resume) return false;
  const resumeTime = parseInstant(task.time.resume).getTime();
  return Number.isFinite(resumeTime) && resumeTime <= actualFinishTime;
}

export function explainP6CompletedDataDateWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  return explainP6CompletedDataDateWindowResolved(task, dataDate, schedulingOptions);
}

export function explainP6CompletedDataDateWindowResolved(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (schedulingOptions?.p6CompletedDataDateWindow !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  const fields = p6CompletedGateFields(task);
  const provenance = provenanceRejection(task, fields);
  if (provenance !== null) return { eligible: false, reason: provenance };
  const isPhysicalCompletion = fields.completePctType === 'CP_Phys';
  if (fields.completePctType !== 'CP_Drtn' && !isPhysicalCompletion) {
    return { eligible: false, reason: 'wrongCompletePctType' };
  }
  if (fields.durationType !== 'DT_FixedDUR2') return { eligible: false, reason: 'wrongDurationType' };
  const validActivity = fields.activityType === 'TT_Task'
    || (!isPhysicalCompletion && fields.activityType === 'TT_Rsrc');
  if (!validActivity) {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (fields.suspendResume === true
    && (isPhysicalCompletion || !mayUseSuspendResumeCompletedWindow(task, fields, dataDate, schedulingOptions))) {
    return { eligible: false, reason: 'hasSuspendResume' };
  }
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  if (isZeroDurationMilestone(task)) return { eligible: false, reason: 'zeroDurationMilestone' };
  if (isPhysicalCompletion) {
    const actualFinish = task.time.actualFinish ? parseInstant(task.time.actualFinish) : null;
    if (actualFinish === null || !Number.isFinite(actualFinish.getTime()) || actualFinish > dataDate) {
      return { eligible: false, reason: 'notCompleted' };
    }
    return { eligible: false, reason: 'wrongCompletePctType' };
  }
  return { eligible: true, reason: 'eligible' };
}

export function usesP6CompletedDataDateWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  return explainP6CompletedDataDateWindow(task, dataDate, schedulingOptions).eligible;
}

export function explainP6CompletedPhysicalPoint(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (schedulingOptions?.p6CompletedPhysicalAtDataDate !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  const fields = p6CompletedGateFields(task);
  const provenance = provenanceRejection(task, fields);
  if (provenance !== null) return { eligible: false, reason: provenance };
  if (fields.completePctType !== 'CP_Phys') return { eligible: false, reason: 'wrongCompletePctType' };
  if (fields.activityType !== 'TT_Task' && fields.activityType !== 'TT_Mile'
    && fields.activityType !== 'TT_FinMile') {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (fields.suspendResume === true) return { eligible: false, reason: 'hasSuspendResume' };
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  const actualFinish = task.time.actualFinish ? parseInstant(task.time.actualFinish) : null;
  if (actualFinish === null || !Number.isFinite(actualFinish.getTime()) || actualFinish > dataDate) {
    return { eligible: false, reason: 'notCompleted' };
  }
  return { eligible: true, reason: 'eligible' };
}
