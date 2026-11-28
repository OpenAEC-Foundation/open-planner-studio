import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { appStoreContext, type AppState, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  applyProgressInvariants, rememberProgressBeforeRecalculation,
} from '@/engine/taskMutationRules';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { startAnchorAfterEdit, startIsActual } from '@/utils/taskDates';
import {
  constraintBlockingStart, predecessorDrivenTaskIds, startConstraintAfterEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit, type StartEditNotice } from '@/state/startConstraintNotice';
import {
  hasRecordedProgress, planProgressEntry, type ProgressEdit, type ProgressEntryContext, type ProgressEntryPlan,
} from '@/engine/progressEntry';
import { progressPlannedDatesAfterEdit } from '@/state/progressPlannedDates';
import { durationBelowDoneWorkNotice, statusDateSetTodayNotice } from '@/state/progressEntryNotice';
import { durationEditRefusal } from '@/engine/work/workRuleApply';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import { getPersonalTaskTypes } from '@/services/taskTypes/personalTaskTypes';
import type { Task } from '@/types/task';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import type { PhaseAssignmentChoice } from '@/state/structuralTransition';

export interface TaskDialogInitialDuration {
  unit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
}

export interface TaskDialogStartEdit {
  date: string;
  completion: number;
}

export type TaskDialogDraft = Task & {
  inferredActualStart?: true;
  inferredActualFinish?: true;
};

type TaskDialogProgressPlan = Extract<ProgressEntryPlan, { ok: false }>
  | { ok: true; change: { task: TaskDialogDraft; statusDateToday?: string } | null };

export interface TaskDialogSaveInput {
  editingTaskId: string | null;
  draft: TaskDialogDraft;
  startDate?: string | TaskDialogStartEdit;
  initialDuration?: TaskDialogInitialDuration | null;
  session?: HistorySessionMark | null;
  today?: string;
  phaseAssignments?: PhaseAssignmentChoice;
}

const PROGRESS_KEYS = ['completion', 'actualStart', 'actualFinish'] as const;

function planTaskDialogStart(
  state: Pick<AppState, 'tasks' | 'sequences'>, editingTask: Task, draft: Task,
  startDate: TaskDialogSaveInput['startDate'],
): { anchor?: string; constraint: Task['constraint']; notice?: StartEditNotice } {
  const unchanged = { constraint: draft.constraint };
  if (!startDate) return unchanged;
  const entered = typeof startDate === 'object' ? startDate : undefined;
  const date = typeof startDate === 'string' ? startDate : startDate.date;
  const timeBeforeProgress = entered
    ? { ...editingTask.time, completion: entered.completion, actualStart: undefined }
    : startIsActual(draft) ? editingTask.time : draft.time;
  const hasActualStart = !entered && startIsActual({ ...editingTask, time: timeBeforeProgress });
  const anchor = date && !hasActualStart ? startAnchorAfterEdit(editingTask, date) : undefined;
  if (anchor === undefined) return unchanged;
  const explicitConstraint = JSON.stringify(draft.constraint) !== JSON.stringify(editingTask.constraint)
    || JSON.stringify(draft.constraint2) !== JSON.stringify(editingTask.constraint2);
  const driven = !explicitConstraint && predecessorDrivenTaskIds(state.tasks, state.sequences).has(editingTask.id);
  const prospective = { ...editingTask, isHammock: draft.isHammock, time: timeBeforeProgress };
  const blocked = constraintBlockingStart(prospective, driven);
  if (blocked) return {
    ...unchanged, notice: { kind: 'blocked', name: draft.name, constraint: blocked, taskId: editingTask.id },
  };
  const snet = startConstraintAfterEdit(prospective, anchor, driven);
  return {
    anchor,
    constraint: snet?.constraint ?? draft.constraint,
    notice: snet ? { kind: 'snet', name: draft.name, date: anchor, change: snet.change } : undefined,
  };
}

export function planTaskDialogProgress(
  state: AppState, draft: TaskDialogDraft, startDate: TaskDialogSaveInput['startDate'], edit: ProgressEdit,
  { initialDuration, ...context }: Pick<ProgressEntryContext, 'today' | 'actualStart'>
    & Pick<TaskDialogSaveInput, 'initialDuration'>,
): TaskDialogProgressPlan {
  const live = state.tasks.find(task => task.id === draft.id);
  const start = live ? planTaskDialogStart(state, live, draft, startDate) : undefined;
  const time = live ? savedTime(live, draft, initialDuration) : { ...draft.time };
  const task = { ...draft, constraint: live ? start?.constraint : draft.constraint, time };
  if (start?.anchor !== undefined) time.scheduleStart = start.anchor;
  if (edit.field === 'completion') {
    if (edit.value > 0 && draft.inferredActualStart) time.actualStart = undefined;
  }
  if (edit.field !== 'actualFinish' && draft.inferredActualFinish) time.actualFinish = undefined;
  const plan = planProgressEntry(task, edit, {
    ...context,
    statusDate: state.project.statusDate,
    calendar: resolveCalendar(task.calendarId, state.calendars, state.calendar),
    plannedDates: live ? candidate => progressPlannedDatesAfterEdit(state, live, {
      ...candidate, status: live.status, time: { ...candidate.time, completion: live.time.completion },
    }, (edit.field === 'completion' ? edit.value : time.completion) >= 1) : undefined,
  });
  if (!plan.ok) return plan;
  const next = plan.change?.task ?? task;
  const { completion, actualStart, actualFinish, remainingTime, remainingMinutes } = next.time;
  const inferredActualStart = actualStart && edit.field !== 'actualStart' && !context.actualStart
    && (draft.inferredActualStart || (edit.field === 'completion' && !time.actualStart)) ? true : undefined;
  const inferredActualFinish = actualFinish && edit.field !== 'actualFinish'
    && (draft.inferredActualFinish || (edit.field === 'completion' && !time.actualFinish)) ? true : undefined;
  if (!plan.change && draft.inferredActualStart === inferredActualStart
    && draft.inferredActualFinish === inferredActualFinish) return { ok: true, change: null };
  return {
    ok: true,
    change: {
      ...plan.change,
      task: {
        ...draft, status: next.status, inferredActualStart, inferredActualFinish,
        time: { ...draft.time, completion, actualStart, actualFinish, remainingTime, remainingMinutes },
      },
    },
  };
}

export function prepareTaskDialogSaveProgress(
  state: AppState,
  { draft, startDate, today, initialDuration }: Pick<TaskDialogSaveInput, 'draft' | 'startDate' | 'today' | 'initialDuration'>,
  actualStart?: string,
): TaskDialogProgressPlan {
  if (!draft.inferredActualFinish && (!draft.inferredActualStart || draft.time.completion <= 0)) {
    return { ok: true, change: null };
  }
  const plan = planTaskDialogProgress(state, draft, startDate, { field: 'completion', value: draft.time.completion },
    { today, initialDuration, actualStart });
  if (!plan.ok) return plan;
  const ready = plan.change?.task ?? draft;
  return { ok: true, change: {
    ...plan.change,
    task: { ...ready, inferredActualStart: undefined, inferredActualFinish: undefined },
  } };
}

function savedTime(
  editingTask: Task,
  draft: Task,
  initialDuration: TaskDialogInitialDuration | null | undefined,
): Task['time'] {
  const durationTouched = !initialDuration
    || draft.time.durationUnit !== initialDuration.unit
    || draft.time.scheduleDuration !== initialDuration.scheduleDuration
    || draft.time.durationMinutes !== initialDuration.durationMinutes;
  const time = {
    ...editingTask.time,
    ...(durationTouched ? {
      durationUnit: draft.time.durationUnit,
      scheduleDuration: draft.time.scheduleDuration,
      durationMinutes: draft.time.durationUnit === 'hours' ? draft.time.durationMinutes : undefined,
    } : {}),
  };
  const milestoneTransition = taskMilestoneTransition(editingTask, draft.isMilestone);
  if (milestoneTransition.time) Object.assign(time, milestoneTransition.time);
  if (!isSummaryTask(editingTask)) {
    time.completion = draft.time.completion;
    time.actualStart = draft.time.actualStart;
    time.actualFinish = draft.time.actualFinish;
  } else {
    time.completion = editingTask.time.completion;
    time.actualStart = editingTask.time.actualStart;
    time.actualFinish = editingTask.time.actualFinish;
  }
  return time;
}

export function createTaskDialogSave(context: AppStoreContext): (input: TaskDialogSaveInput) => boolean {
  const batch = createBatchTransactions(context);
  const S = () => context.store.getState();

  const save = (
    { editingTaskId, draft, startDate, initialDuration, today, phaseAssignments }: TaskDialogSaveInput,
    notices: StartEditNotice[],
  ): void => {
    const phaseOpts = phaseAssignments ? { phaseAssignments, answered: true } : undefined;
    if (draft.customTaskTypeId) {
      const definition = S().customTaskTypes.find(type => type.id === draft.customTaskTypeId)
        ?? getPersonalTaskTypes().find(type => type.id === draft.customTaskTypeId);
      if (definition) S().ensureProjectTaskType(definition);
    }

    const editingTask = editingTaskId ? S().tasks.find(task => task.id === editingTaskId) : undefined;
    if (editingTask) {
      const time = savedTime(editingTask, draft, initialDuration);
      const start = planTaskDialogStart(S(), editingTask, draft, startDate);
      if (start.anchor !== undefined) time.scheduleStart = start.anchor;
      if (start.notice) notices.push(start.notice);
      const patch: Partial<Task> = {
        name: draft.name,
        description: draft.description,
        wbsCode: draft.wbsCode,
        taskType: draft.taskType,
        customTaskTypeId: draft.customTaskTypeId,
        calendarId: draft.calendarId,
        isMilestone: draft.isMilestone,
        milestoneKind: draft.milestoneKind,
        mandatory: draft.mandatory,
        isHammock: draft.isHammock,
        constraint: start.constraint,
        constraint2: draft.constraint2,
        deadline: draft.deadline,
        notes: draft.notes,
        time,
      };
      if (PROGRESS_KEYS.some(key => time[key] !== editingTask.time[key])) {
        const merged: Task = { ...editingTask, ...patch, time };
        let statusDate = S().project.statusDate;
        if (!statusDate && today && hasRecordedProgress(merged.time)) {
          S().setStatusDate(today);
          S().notify(statusDateSetTodayNotice(today, S().ui.dateNotation));
          statusDate = today;
        }
        applyProgressInvariants(merged, statusDate, resolveCalendar(merged.calendarId, S().calendars, S().calendar));
        rememberProgressBeforeRecalculation(editingTask, merged);
        patch.status = merged.status;
      }
      S().updateTask(editingTask.id, patch);
      if (draft.parentId !== editingTask.parentId) S().moveTask(editingTask.id, draft.parentId, undefined, phaseOpts);
      return;
    }

    const newStart = (typeof startDate === 'object' ? startDate.date : startDate) ?? draft.time.scheduleStart;
    S().addTask({
      name: draft.name,
      description: draft.description,
      wbsCode: draft.wbsCode,
      taskType: draft.taskType,
      customTaskTypeId: draft.customTaskTypeId,
      workRule: draft.workRule,
      isMilestone: draft.isMilestone,
      parentId: draft.parentId || null,
      calendarId: draft.calendarId,
      time: {
        ...draft.time,
        durationUnit: draft.isMilestone ? 'days' : draft.time.durationUnit,
        scheduleDuration: draft.isMilestone ? 0 : draft.time.scheduleDuration,
        durationMinutes: draft.isMilestone || draft.time.durationUnit === 'days' ? undefined : draft.time.durationMinutes,
        scheduleStart: newStart,
        scheduleFinish: newStart,
        earlyStart: newStart,
        earlyFinish: newStart,
        lateStart: newStart,
        lateFinish: newStart,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        completion: 0,
      },
    }, phaseOpts);
  };

  return (input) => {
    const current = input.editingTaskId ? S().tasks.find(task => task.id === input.editingTaskId) : undefined;
    if (current) {
      const hoursPerDay = taskCalendarHoursPerDay({ ...current, calendarId: input.draft.calendarId }, S().calendars, S().calendar);
      if (durationEditRefusal(current, savedTime(current, input.draft, input.initialDuration), hoursPerDay)) {
        S().notify(durationBelowDoneWorkNotice(current));
        return false;
      }
    }
    if (current) {
      const progress = prepareTaskDialogSaveProgress(S(), input);
      if (!progress.ok) return false;
      if (progress.change) input = { ...input, draft: progress.change.task };
    }
    const notices: StartEditNotice[] = [];
    if (input.session) {
      save(input, notices);
      S().squashHistorySince(input.session, 'Taak bewerken');
    } else {
      batch.withTransaction(() => save(input, notices));
    }
    notifyStartEdit(S().notify, notices, S().ui.dateNotation, S().ui.timeNotation);
    return true;
  };
}

export const saveTaskDialog = createTaskDialogSave(appStoreContext);
