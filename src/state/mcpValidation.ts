import { isElapsedTask } from '@/engine/scheduler/duration';

import type { AppState } from './appStore';
import type { Task, TaskTime } from '@/types/task';
import {
  applyProgressInvariants, datesForProgress, fillMissingActualStart, isActualFinishBeforeStart, isTaskActualPastStatusDate,
  normalizeActualDate, rememberProgressBeforeRecalculation,
  type PlannedProgressDates,
} from '@/engine/taskMutationRules';
import { captureProgressWork, durationCompletionDates, settleProgressWork } from '@/engine/work/workRuleApply';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { actualStartQuestionFor } from '@/engine/progressEntry';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { clearLevelingGaps } from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { introducedCycle } from '@/engine/scheduler/relationRules';
import type { Sequence } from '@/types/sequence';
import { isValidUnits } from '@/types/resource';
import { isSummaryTask } from '@/utils/taskHierarchy';

export interface ItemError {
  id: string;
  reason: string;
}

export type GuardResult = { ok: true } | { ok: false; reason: string };

export type ProgressResult = { applied: true } | { applied: false; reason: string };

type ReadableState = Pick<AppState, 'tasks' | 'sequences' | 'assignments'>;
type ProgressState = ReadableState & Pick<AppState, 'calendars' | 'calendar' | 'project' | 'resources'>;

export const validate = {
  taskExists(state: ReadableState, id: string): ItemError | null {
    return state.tasks.some((t) => t.id === id)
      ? null
      : { id, reason: `task '${id}' does not exist` };
  },

  tasksExist(state: ReadableState, ids: string[]): ItemError[] {
    const existing = new Set(state.tasks.map((t) => t.id));
    const errors: ItemError[] = [];
    for (const id of ids) {
      if (!existing.has(id)) errors.push({ id, reason: `task '${id}' does not exist` });
    }
    return errors;
  },

  noCycle(
    state: ReadableState,
    newSequences: { predecessorId: string; successorId: string }[],
  ): string[] | null {
    const proposed: Sequence[] = newSequences.map((s, index) => ({
      id: `__proposed-${index}`,
      predecessorId: s.predecessorId,
      successorId: s.successorId,
      type: 'FINISH_START',
      lagDays: 0,
    }));
    return introducedCycle(state, { tasks: state.tasks, sequences: [...state.sequences, ...proposed] });
  },

  assignmentAllowed(
    state: ReadableState, taskId: string, resourceId: string, units: number,
    resource?: { type: string },
  ): GuardResult {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, reason: `task '${taskId}' does not exist` };
    if (task.isMilestone && resource?.type !== 'COST') {
      return { ok: false, reason: `task '${taskId}' is a milestone; a milestone carries no work or material resources (only a COST resource)` };
    }
    if (isSummaryTask(task)) return { ok: false, reason: `task '${taskId}' is a summary task; assign resources to the leaf tasks` };
    if (!isValidUnits(units)) return { ok: false, reason: `invalid units/day ${String(units)} (strictly positive required)` };
    if (state.assignments.some((a) => a.taskId === taskId && a.resourceId === resourceId)) {
      return { ok: false, reason: `resource '${resourceId}' is already assigned to task '${taskId}' (a second assignment would double-count the load)` };
    }
    return { ok: true };
  },
};

export const progress = {
  applyProgressUpdate(
    draftState: ProgressState,
    taskId: string,
    update: { completion?: number; actualStart?: string; actualFinish?: string },
    statusDate: string | undefined,
    getPlannedDates?: (task: Task) => PlannedProgressDates | undefined,
    beforeDuration?: TaskTime,
  ): ProgressResult {
    const task = draftState.tasks.find((t) => t.id === taskId) as Task | undefined;
    if (!task) return { applied: false, reason: `task '${taskId}' does not exist` };

    const time = { ...task.time };
    const scratch = { ...task, time, status: task.status } as Task;

    if (update.completion !== undefined) {
      if (!Number.isFinite(update.completion) || update.completion < 0 || update.completion > 100) {
        return { applied: false, reason: `completion ${update.completion} is outside the range 0–100` };
      }
      time.completion = update.completion / 100;
    }

    if ('actualStart' in update) time.actualStart = update.actualStart || undefined;
    if ('actualFinish' in update) time.actualFinish = update.actualFinish || undefined;

    const calendar = resolveCalendar(task.calendarId, draftState.calendars, draftState.calendar);
    for (const field of ['actualStart', 'actualFinish'] as const) {
      if (field in update) time[field] = normalizeActualDate(task, field, time[field], statusDate, calendar);
    }
    const suppliedActualStart = time.actualStart;
    const suppliedActualFinish = time.actualFinish;

    if (update.completion !== undefined && time.completion < 1) time.actualFinish = undefined;

    if (statusDate) {
      if (update.actualStart && isTaskActualPastStatusDate(task, 'actualStart', suppliedActualStart!, statusDate, calendar)) {
        return { applied: false, reason: `actualStart ${update.actualStart} lies after the status date ${statusDate}` };
      }
      if (update.actualFinish && isTaskActualPastStatusDate(task, 'actualFinish', suppliedActualFinish!, statusDate, calendar)) {
        return { applied: false, reason: `actualFinish ${update.actualFinish} lies after the status date ${statusDate}` };
      }
    }

    if ('actualFinish' in update && !update.actualFinish && update.completion === undefined && time.completion >= 1) {
      time.completion = 0;
    }

    if (isActualFinishBeforeStart(time)) {
      return { applied: false, reason: `actualFinish ${time.actualFinish} lies before actualStart ${time.actualStart}` };
    }

    const touchesProgress =
      update.completion !== undefined || 'actualStart' in update || 'actualFinish' in update;
    if (!statusDate && touchesProgress) {
      return {
        applied: false,
        reason: 'no status date set: progress/actuals are measured up to the status date and cannot be ' +
          'recorded without one. First set the status date (the reporting date of this progress) with ' +
          'planner_update_project → `statusDate` and then repeat this update; the AI connection does not ' +
          'choose that date itself',
      };
    }

    if (isSummaryTask(task)) {
      return { applied: false, reason: `task '${taskId}' is a summary task (has children); progress, status and actual dates are derived from the leaf tasks below it, not set directly — set the progress on those leaf tasks` };
    }

    const afterDuration = beforeDuration && time.completion >= 1 && !time.actualFinish
      ? durationCompletionDates(scratch, beforeDuration, calendar,
        effectiveSchedulingOptions(draftState.project).workdayDurationMeasure === true) : undefined;
    const planned = afterDuration ?? (update.completion === undefined
      ? undefined : datesForProgress(scratch, time.completion, () => getPlannedDates?.(task)));
    if (time.completion > 0) fillMissingActualStart(scratch, statusDate, calendar, planned);
    applyProgressInvariants(scratch, statusDate, calendar, planned);
    const question = actualStartQuestionFor(task, scratch, statusDate, {
      actualStart: !!update.actualStart,
      actualFinish: !!update.actualFinish,
    }, isElapsedTask(task) ? undefined : calendar, () => planned?.earlyStart);
    if (question) {
      const plannedStart = planned?.earlyStart ?? (scratch.time.earlyStart || scratch.time.scheduleStart);
      return {
        applied: false,
        reason: `task '${taskId}' has no actual start yet and was planned to start only after the status ` +
          `date (${question.statusDate}) (planned start ${plannedStart}): progress means it has already started, ` +
          'but only the user knows when. Pass the actual start in `progress.actualStart` (at the latest ' +
          `${question.latest}); the AI connection does not derive it`,
      };
    }
    if (sameValue(task, scratch)) return { applied: true };
    rememberProgressBeforeRecalculation(task, scratch);
    const progressWork = captureProgressWork(task, draftState);
    Object.assign(task.time, scratch.time);
    task.status = scratch.status;
    settleProgressWork(task, draftState.assignments, progressWork);
    clearLevelingGaps(task);
    return { applied: true };
  },
};
