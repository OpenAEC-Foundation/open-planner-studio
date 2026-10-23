import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';
import { isPinnedComplete } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { DayClockCache, mapTaskDates, normalizeTaskDate, taskDateContext, taskDateFieldSide,
  type TaskDateContext, type TaskDateField } from '@/state/migrations/minuteModel';
import { dayEndInstant, workdayOfInstant, isDateOnly } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatDate, parseDate, parseInstant } from '@/utils/dateUtils';

/** Een moment is afleidbaar als D1–D7 exact hetzelfde moment teruggeeft. Ook nachtblokken
 * en het exclusieve kalendertijdeinde worden zo gespiegeld, zonder tijd af te kappen. */
function anchor(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!value || isDateOnly(value)) return value;
  // Onleesbare brondata blijft letterlijk; een ongeldig moment heeft geen daganker.
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

/** T17 is een schrijfkeuze van dit document. Er komt geen vlag in een bibliotheekkalender. */
export function minuteModelWriteView(input: Pick<ImportResult, 'tasks' | 'calendar' | 'resourceCalendars' | 'baselines'>,
  options: { literalAutomaticMilestones?: boolean } = {}) {
  const calendars = input.resourceCalendars ?? [];
  const clocks = new DayClockCache(input.calendar, calendars);
  const literalCalendarIds = new Set<string>();
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
        // MSPDI heeft geen AtDayEnd-hint. Bewaar daar de momenten van deze hele kalender.
        if (options.literalAutomaticMilestones) literalCalendarIds.add(effective(task).id);
        ctx = { ...ctx, milestoneKind: 'FINISH' };
      }
    }
    contexts.set(task.id, ctx);
    const cal = effective(task);
    if (task.time.durationUnit === 'hours') literalCalendarIds.add(cal.id);
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
  const tasks = input.tasks.map(task => literalCalendarIds.has(effective(task).id) ? task
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
