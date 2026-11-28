import type { Task, TaskSplitGap, TaskTime } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';

export function isPinnedComplete(time: TaskTime): time is TaskTime & { actualFinish: string } {
  return !!time.actualFinish && time.completion >= 1;
}

export function isPinnedInProgress(time: TaskTime): boolean {
  return (!!time.actualStart || time.completion > 0) && time.completion < 1;
}

export function taskDurationUnit(task: Task): 'days' | 'hours' {
  const legacy = task.time as Task['time'] & { durationUnit?: 'days' | 'hours' };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

export function isZeroDurationMilestone(task: Pick<Task, 'isMilestone' | 'time'>): boolean {
  return task.isMilestone && task.time.scheduleDuration === 0;
}

export function isElapsedTask(task: Task): boolean {
  return !isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME';
}

export interface DurationCalendar {
  readonly isHourMode: boolean;
  readonly hoursPerDay: number;
}

export interface SpanCalendar extends DurationCalendar {
  readonly hasOwnWorkBlocks?: boolean;
  workMinutesBetween(a: Date, b: Date): number;
  workDaysBetween(start: Date, end: Date): number;
}

export function writeDerivedSpan(task: Task, es: Date, ef: Date, cal: SpanCalendar, preserveScalarDays = false): void {
  const scalarDays = preserveScalarDays && cal.hasOwnWorkBlocks === false;
  const spanDays = task.time.durationType === 'ELAPSEDTIME'
    ? (ef.getTime() - es.getTime()) / (24 * 60 * MS_PER_MIN)
    : cal.workMinutesBetween(es, ef) / (cal.hoursPerDay * 60);
  task.time.durationUnit = cal.isHourMode && !(scalarDays && Number.isInteger(spanDays)) ? 'hours' : 'days';
  if (task.time.durationType === 'ELAPSEDTIME') {
    if (cal.isHourMode) {
      const mins = Math.round((ef.getTime() - es.getTime()) / MS_PER_MIN);
      task.time.durationMinutes = task.time.durationUnit === 'hours' ? mins : undefined;
      task.time.scheduleDuration = mins / (24 * 60);
    } else {
      task.time.durationMinutes = undefined;
      task.time.scheduleDuration = (ef.getTime() - es.getTime()) / (24 * 60 * MS_PER_MIN);
    }
  } else if (cal.isHourMode) {
    const mins = cal.workMinutesBetween(es, ef);
    task.time.durationMinutes = task.time.durationUnit === 'hours' ? mins : undefined;
    task.time.scheduleDuration = mins / (cal.hoursPerDay * 60);
  } else {
    task.time.durationMinutes = undefined;
    task.time.scheduleDuration = cal.workDaysBetween(es, ef);
  }
}

export function durationMinutesOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * effCal.hoursPerDay * 60;
}

export function durationDaysOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') {
    return (task.time.durationMinutes ?? 0) / (effCal.hoursPerDay * 60);
  }
  return task.time.scheduleDuration;
}

const MS_PER_MIN = 60_000;
const MAX_ELAPSED_MINUTES = 200_000 * 24 * 60;

function clampElapsedMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  if (minutes > MAX_ELAPSED_MINUTES) return MAX_ELAPSED_MINUTES;
  if (minutes < -MAX_ELAPSED_MINUTES) return -MAX_ELAPSED_MINUTES;
  return minutes;
}

export function elapsedMinutesOf(task: Task, effCal: DurationCalendar): number {
  void effCal;
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * 24 * 60;
}

export function elapsedMilliseconds(minutes: number): number {
  return Math.sign(minutes) * Math.round(Math.abs(minutes) * MS_PER_MIN);
}

export function addElapsedMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + elapsedMilliseconds(clampElapsedMinutes(minutes)));
}

export function subtractElapsedMinutes(end: Date, minutes: number): Date {
  return new Date(end.getTime() - elapsedMilliseconds(clampElapsedMinutes(minutes)));
}

export function signedElapsedSpan(a: Date, b: Date, effCal: DurationCalendar): number {
  void effCal;
  return (b.getTime() - a.getTime()) / (24 * 60 * MS_PER_MIN);
}

export function splitTotalSpanMinutes(gaps: readonly TaskSplitGap[] | undefined, workMinutes: number): number {
  if (!gaps || gaps.length === 0 || !(workMinutes > 0)) return Math.max(0, workMinutes || 0);
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  let axisPos = 0;
  let workDone = 0;
  for (const g of sorted) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || g.gapMinutes <= 0) continue;
    const gapStart = Math.max(g.afterMinutes, axisPos);
    const gapEnd = g.afterMinutes + g.gapMinutes;
    if (gapEnd <= gapStart) continue;
    const segment = gapStart - axisPos;
    if (workDone + segment >= workMinutes) {
      return axisPos + (workMinutes - workDone);
    }
    workDone += segment;
    axisPos = gapEnd;
  }
  return axisPos + (workMinutes - workDone);
}

export function splitTotalSpanDays(task: Task, eng: DurationCalendar): number {
  const base = durationDaysOf(task, eng);
  if (!task.splitGaps || task.splitGaps.length === 0) return base;
  const workMinutes = durationMinutesOf(task, eng);
  const extraMinutes = splitTotalSpanMinutes(task.splitGaps, workMinutes) - workMinutes;
  return base + extraMinutes / (eng.hoursPerDay * 60);
}

export function finishOfTaskDuration(task: Task, eng: CalendarEngine, start: Date, workdays: boolean): Date {
  if (isZeroDurationMilestone(task)) return new Date(start.getTime());
  if (isElapsedTask(task)) return addElapsedMinutes(start, elapsedMinutesOf(task, eng));
  if (workdays) {
    const days = splitTotalSpanDays(task, eng);
    return days > 0 ? eng.addMeasuredWorkdays(start, days) : new Date(start.getTime());
  }
  const minutes = durationMinutesOf(task, eng);
  const work = taskDurationUnit(task) === 'hours' ? minutes : Math.round(minutes);
  return eng.addWorkMinutes(start, splitTotalSpanMinutes(task.splitGaps, work));
}
