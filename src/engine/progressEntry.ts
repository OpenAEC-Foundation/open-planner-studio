import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import { sameValue } from '@/utils/sameValue';
import {
  applyActualDateEdit, applyCompletionEdit, applyProgressInvariants, datesForProgress, isActualFinishBeforeStart,
  isActualPastStatusDate, isTaskActualPastStatusDate, normalizeActualDate, rememberProgressBeforeRecalculation,
  type PlannedProgressDates,
} from '@/engine/taskMutationRules';

export type ProgressEdit =
  | { field: 'completion'; value: number }
  | { field: 'actualStart' | 'actualFinish'; value: string | undefined };

export function hasRecordedProgress(time: Pick<TaskTime, 'completion' | 'actualStart' | 'actualFinish'>): boolean {
  return time.completion > 0 || !!time.actualStart || !!time.actualFinish;
}

export function progressEntryStatusDate(statusDate: string | undefined, today: string | undefined): string | undefined {
  return statusDate || today || undefined;
}

export function applyProgressEdit(
  task: Task,
  edit: ProgressEdit,
  statusDate: string | undefined,
  actualStart?: string,
  calendar?: WorkCalendar,
  planned?: PlannedProgressDates,
): void {
  if (actualStart) task.time.actualStart = actualStart;
  if (edit.field === 'completion') {
    applyCompletionEdit(task, Math.max(0, Math.min(1, edit.value)), statusDate, calendar, planned);
    applyProgressInvariants(task, statusDate, calendar, planned);
  } else {
    applyActualDateEdit(task, edit.field, edit.value, statusDate, calendar, planned);
  }
}

export interface ActualStartQuestion {
  taskId: string;
  statusDate: string;
  latest: string;
}

export function actualStartQuestionFor(
  before: Pick<Task, 'time'>,
  after: Task,
  statusDate: string | undefined,
  supplied: { actualStart?: boolean; actualFinish?: boolean },
  calendar?: WorkCalendar,
  plannedStart?: () => string | undefined,
): ActualStartQuestion | null {
  if (!statusDate || before.time.actualStart || supplied.actualStart || !after.time.actualStart) return null;
  if (after.isMilestone && supplied.actualFinish) return null;
  const originalStart = isZeroDurationMilestone(after) && after.time.completion < 1 ? undefined : plannedStart?.();
  const planned = originalStart ?? (after.time.earlyStart || after.time.scheduleStart);
  if (!planned || !isTaskActualPastStatusDate(after, 'actualStart', planned, statusDate, calendar)) return null;
  const latest = supplied.actualFinish && after.time.actualFinish ? after.time.actualFinish : statusDate;
  return { taskId: after.id, statusDate, latest };
}

export function actualStartAnswerIssue(
  answer: string,
  question: Pick<ActualStartQuestion, 'statusDate' | 'latest'>,
  calendar?: WorkCalendar,
): 'afterStatusDate' | 'actualFinishBeforeStart' | null {
  if (isActualPastStatusDate(answer, question.statusDate, calendar, 'start')) return 'afterStatusDate';
  if (isActualFinishBeforeStart({ actualStart: answer, actualFinish: question.latest })) return 'actualFinishBeforeStart';
  return null;
}

export interface ProgressEntryContext {
  statusDate: string | undefined;
  today?: string;
  actualStart?: string;
  calendar?: WorkCalendar;
  plannedDates?: (task: Task) => PlannedProgressDates | undefined;
}

export type ProgressEntryRefusal =
  | { ok: false; reason: 'afterStatusDate' }
  | { ok: false; reason: 'actualFinishBeforeStart' }
  | { ok: false; reason: 'needsActualStart'; question: ActualStartQuestion };

export type ProgressEntryResult =
  | { ok: true }
  | ProgressEntryRefusal
  | { ok: false; reason: 'summaryTask' };

export type ProgressEntryPlan =
  | { ok: true; change: null }
  | { ok: true; change: { task: Task; statusDateToday?: string } }
  | ProgressEntryRefusal;

export function planProgressEntry(task: Task, edit: ProgressEdit, ctx: ProgressEntryContext): ProgressEntryPlan {
  const statusDate = progressEntryStatusDate(ctx.statusDate, ctx.today);
  const answer = ctx.today ? normalizeActualDate(task, 'actualStart', ctx.actualStart, statusDate, ctx.calendar) : undefined;
  if (edit.field !== 'completion') edit = {
    ...edit, value: normalizeActualDate(task, edit.field, edit.value, statusDate, ctx.calendar),
  };
  for (const [field, date] of [
    [edit.field === 'completion' ? 'actualStart' : edit.field, edit.field === 'completion' ? undefined : edit.value],
    ['actualStart', answer],
  ] as const) {
    if (date && statusDate && isTaskActualPastStatusDate(task, field, date, statusDate, ctx.calendar)) {
      return { ok: false, reason: 'afterStatusDate' };
    }
  }
  const actualStart = edit.field === 'actualStart' ? edit.value : answer ?? task.time.actualStart;
  const plannedTask = actualStart === task.time.actualStart ? task : { ...task, time: { ...task.time, actualStart } };
  const planned = edit.field === 'completion'
    ? datesForProgress(task, edit.value, () => ctx.plannedDates?.(plannedTask))
    : edit.field === 'actualStart' && task.time.completion >= 1 && !task.time.actualFinish
      ? ctx.plannedDates?.(plannedTask) : undefined;
  const run = (date: string | undefined): Task => {
    const next: Task = { ...task, time: { ...task.time } };
    applyProgressEdit(next, edit, date, answer, ctx.calendar, planned);
    return next;
  };
  let next = run(statusDate);
  if (sameValue(task, next)) return { ok: true, change: null };
  if (ctx.today && isActualFinishBeforeStart(next.time)) return { ok: false, reason: 'actualFinishBeforeStart' };
  if (ctx.today) {
    const question = actualStartQuestionFor(task, next, statusDate, {
      actualStart: !!answer || (edit.field === 'actualStart' && !!edit.value),
      actualFinish: edit.field === 'actualFinish' && !!edit.value,
    }, isElapsedTask(task) ? undefined : ctx.calendar, () => planned?.earlyStart);
    if (question) return { ok: false, reason: 'needsActualStart', question };
  }
  const statusDateToday = !ctx.statusDate && ctx.today && hasRecordedProgress(next.time) ? ctx.today : undefined;
  if (!ctx.statusDate && !statusDateToday && statusDate) {
    next = run(undefined);
    if (sameValue(task, next)) return { ok: true, change: null };
  }
  rememberProgressBeforeRecalculation(task, next);
  return { ok: true, change: statusDateToday ? { task: next, statusDateToday } : { task: next } };
}
