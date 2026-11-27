import {
  blocksClock, ELAPSED_CLOCK, isInstant, milestoneWorkdayOf, workdayBoundaryLabel, workdayEdgeAt, type DayClock,
  type InstantSide,
} from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

const clockCache = new WeakMap<WorkCalendar, DayClock>();

export function calendarClock(calendar: WorkCalendar): DayClock {
  let clock = clockCache.get(calendar);
  if (!clock) {
    clock = blocksClock(calendar);
    clockCache.set(calendar, clock);
  }
  return clock;
}

export function taskDateClock(task: Task, calendar: WorkCalendar): DayClock {
  return isElapsedTask(task) ? ELAPSED_CLOCK : calendarClock(calendar);
}

export function momentLabel(clock: DayClock, value: string, side: InstantSide, milestoneSide?: InstantSide): string {
  if (!milestoneSide) return workdayBoundaryLabel(clock, value, side);
  if (!isInstant(value)) return value;
  const day = milestoneWorkdayOf(clock, value, milestoneSide);
  return day && workdayEdgeAt(clock, day, value) ? day : value;
}

export function milestoneKindSide(task: Task): InstantSide {
  return task.milestoneKind === 'FINISH' ? 'end' : 'start';
}

export function milestoneDay(task: Task, value: string, calendar: WorkCalendar): string {
  return milestoneWorkdayOf(taskDateClock(task, calendar), value, milestoneKindSide(task));
}

export interface TaskDateLabelOptions {
  milestoneOwn?: boolean;
}

export function taskDateLabel(
  task: Task,
  value: string,
  side: InstantSide,
  calendar: WorkCalendar,
  opts: TaskDateLabelOptions = {},
): string {
  if (!value) return value;
  const clock = taskDateClock(task, calendar);
  const milestone = (opts.milestoneOwn ?? true) && isZeroDurationMilestone(task);
  if (!milestone) return momentLabel(clock, value, side);
  return momentLabel(clock, value, side, milestoneKindSide(task));
}

export function taskDateLabelIn(
  task: Task,
  value: string,
  side: InstantSide,
  calendars: { calendar: WorkCalendar; calendars: readonly WorkCalendar[] },
  opts: TaskDateLabelOptions = {},
): string {
  const calendar = resolveCalendar(task.calendarId, calendars.calendars as WorkCalendar[], calendars.calendar);
  return taskDateLabel(task, value, side, calendar, opts);
}
