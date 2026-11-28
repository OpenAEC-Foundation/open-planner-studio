import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';
import { isPinnedComplete } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { DayClockCache, mapTaskDates, normalizeTaskDate, taskDateContext, taskDateFieldSide,
  type TaskDateContext, type TaskDateField } from '@/state/migrations/minuteModel';
import { dayEndInstant, workdayOfInstant, isDateOnly } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatDate, parseDate, parseInstant } from '@/utils/dateUtils';
import { taskDurationWritesMinutes } from './dayMeasureIo';

function anchor(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!value || isDateOnly(value)) return value;
  if (!Number.isFinite(parseInstant(value).getTime())) return null;
  const date = value.slice(0, 10);
  const days = new Set([date, workdayOfInstant(ctx.clock, value, taskDateFieldSide(field)),
    formatDate(addCalendarDays(parseDate(date), -1))]);
  for (const day of days) {
    const normalized = normalizeTaskDate(day, field, ctx);
    if (normalized && parseInstant(normalized).getTime() === parseInstant(value).getTime()) return day;
  }
  return null;
}

const LITERAL_END_FIELDS: ReadonlySet<TaskDateField> = new Set(['scheduleFinish', 'earlyFinish', 'lateFinish', 'actualFinish']);
const MILESTONE_OWN_STARTS: ReadonlySet<TaskDateField> = new Set(['scheduleStart', 'earlyStart', 'lateStart', 'actualStart']);

export function minuteModelWriteView(input: Pick<ImportResult, 'tasks' | 'calendar' | 'resourceCalendars' | 'baselines'>,
  options: {
    literalAutomaticMilestones?: boolean; realTimes?: boolean; keepLiteralCalendarIds?: readonly string[];
    sourceDurationTaskIds?: ReadonlySet<string>; sourceBandCalendarIds?: ReadonlySet<string>;
  } = {}) {
  const calendars = input.resourceCalendars ?? [];
  const clocks = new DayClockCache(input.calendar, calendars);
  const literalCalendarIds = new Set<string>(options.keepLiteralCalendarIds ?? []);
  const atDayEnd = new Set<string>();
  const contexts = new Map<string, TaskDateContext>();
  const effective = (task?: Task) => resolveCalendar(task?.calendarId, calendars, input.calendar);
  const tasksById = new Map(input.tasks.map(task => [task.id, task]));
  for (const cal of [input.calendar, ...calendars]) if (cal.workTime) literalCalendarIds.add(cal.id);
  for (const task of input.tasks) {
    let ctx = taskDateContext(task, clocks);
    if (ctx.milestoneKind !== null && !task.milestoneKind) {
      const day = workdayOfInstant(ctx.clock, task.time.earlyFinish, 'end');
      if (dayEndInstant(ctx.clock, day) === task.time.earlyFinish) {
        atDayEnd.add(task.id);
        if (options.literalAutomaticMilestones) literalCalendarIds.add(effective(task).id);
        ctx = { ...ctx, milestoneKind: 'FINISH' };
      }
    }
    contexts.set(task.id, ctx);
    const cal = effective(task);
    const hours = task.time.durationUnit === 'hours';
    const bandHourTask = hours && options.sourceBandCalendarIds?.has(cal.id) === true;
    if (bandHourTask) continue;
    if (hours || (taskDurationWritesMinutes(task) && !options.sourceDurationTaskIds?.has(task.id))) {
      literalCalendarIds.add(cal.id);
    }
    mapTaskDates(task, (value, field) => {
      if (anchor(value, field, ctx) === null) literalCalendarIds.add(cal.id);
      return value;
    });
  }
  const baselineContext = (bt: Baseline['tasks'][number]) => {
    const task = tasksById.get(bt.taskId);
    const base = contexts.get(bt.taskId) ?? { clock: clocks.calendarClock(undefined), milestoneKind: null };
    const ctx: TaskDateContext = { ...base, milestoneKind: bt.isMilestone && bt.duration === 0
      ? bt.milestoneKind ?? (atDayEnd.has(bt.taskId) ? 'FINISH' : 'START') : null };
    return { task, ctx, finishField: task && isPinnedComplete(task.time) ? 'baselineFinishCompleted' as const : 'baselineFinish' as const };
  };
  for (const b of input.baselines ?? []) {
    for (const bt of b.tasks) {
      const { task, ctx, finishField } = baselineContext(bt);
      if (anchor(bt.start, 'baselineStart', ctx) === null || anchor(bt.finish, finishField, ctx) === null) {
        literalCalendarIds.add(effective(task).id);
      }
    }
    const ctx = { clock: clocks.calendarClock(undefined), milestoneKind: null };
    if (anchor(b.projectEnd, 'deadline', ctx) === null) literalCalendarIds.add(input.calendar.id);
  }
  if (options.realTimes) {
    const real = (value: string, field: TaskDateField, ctx: TaskDateContext) => normalizeTaskDate(value, field, ctx) ?? value;
    const tasks = input.tasks.map(task => mapTaskDates(task, (value, field) => real(value, field, contexts.get(task.id)!)));
    const baselines = (input.baselines ?? []).map(b => ({ ...b,
      tasks: b.tasks.map(bt => {
        const { ctx, finishField } = baselineContext(bt);
        return { ...bt, start: real(bt.start, 'baselineStart', ctx), finish: real(bt.finish, finishField, ctx) };
      }),
    }));
    return { tasks, baselines, literalCalendarIds, atDayEnd };
  }
  const literalEndOf = (value: string, field: TaskDateField, ctx: TaskDateContext): string => {
    if (!isDateOnly(value)) return value;
    const endLike = LITERAL_END_FIELDS.has(field) || (ctx.milestoneKind === 'FINISH' && MILESTONE_OWN_STARTS.has(field));
    return endLike ? normalizeTaskDate(value, field, ctx) ?? value : value;
  };
  const literalDates = (task: Task) => literalCalendarIds.has(effective(task).id)
    || (task.time.durationUnit === 'hours' && options.sourceBandCalendarIds?.has(effective(task).id) === true);
  const tasks = input.tasks.map(task => literalDates(task)
    ? mapTaskDates(task, (value, field) => literalEndOf(value, field, contexts.get(task.id)!))
    : mapTaskDates(task, (value, field) => anchor(value, field, contexts.get(task.id)!) ?? value));
  const baselines = (input.baselines ?? []).map(b => ({ ...b,
    projectEnd: literalCalendarIds.has(input.calendar.id) ? b.projectEnd
      : anchor(b.projectEnd, 'deadline', { clock: clocks.calendarClock(undefined), milestoneKind: null }) ?? b.projectEnd,
    tasks: b.tasks.map(bt => {
      const { task, ctx, finishField } = baselineContext(bt);
      return literalCalendarIds.has(effective(task).id) ? bt : { ...bt,
        start: anchor(bt.start, 'baselineStart', ctx) ?? bt.start,
        finish: anchor(bt.finish, finishField, ctx) ?? bt.finish };
    }),
  }));
  return { tasks, baselines, literalCalendarIds, atDayEnd };
}
