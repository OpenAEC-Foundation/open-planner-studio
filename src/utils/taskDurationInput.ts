import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { taskCountsInWorkdays } from '@/engine/scheduler/conventions/durationMeasure';
import { durationMinutesOf, elapsedMinutesOf } from '@/engine/scheduler/duration';
import { parseInstant } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { EffectiveSchedulingOptions } from '@/types/project';
import type { Task, TaskDurationUnit } from '@/types/task';
import type { DurationDisplay } from '@/types/view';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { shownStart } from '@/utils/taskDates';
import { durationHoursPerDay } from '@/utils/taskDuration';

export interface ParsedTaskDuration {
  unit: TaskDurationUnit;
  scheduleDuration?: number;
  durationMinutes?: number;
  explicitUnit: boolean;
}

export interface DurationInputContext {
  dayMeasure?: boolean;
  hoursPerDay?: number;
  shownUnit?: TaskDurationUnit;
}

export function taskDurationInputContext(
  task: Pick<Task, 'time'>,
  opts: { countsWorkdays: boolean; hoursPerDay: number; display: DurationDisplay },
): DurationInputContext {
  return {
    dayMeasure: opts.countsWorkdays || task.time.durationType === 'ELAPSEDTIME',
    hoursPerDay: durationHoursPerDay(task, opts.hoursPerDay),
    shownUnit: opts.display === 'auto' ? task.time.durationUnit : opts.display,
  };
}

const MAX_SAFE_MINUTES = Number.MAX_SAFE_INTEGER;

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

function dayAmount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 24 * 60))) return null;
  return Number(value.toFixed(6));
}

function minutesOf(value: number): number | null {
  const minutes = Math.round(value);
  return Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= MAX_SAFE_MINUTES ? minutes : null;
}

function validHoursPerDay(hoursPerDay: number | undefined): hoursPerDay is number {
  return hoursPerDay !== undefined && Number.isFinite(hoursPerDay) && hoursPerDay > 0;
}

function daysAsHours(days: number, hoursPerDay: number, explicitUnit: boolean): ParsedTaskDuration | null {
  const durationMinutes = minutesOf(days * hoursPerDay * 60);
  return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit };
}

export function parseTaskDurationInput(
  input: string,
  selectedUnit: TaskDurationUnit,
  context: DurationInputContext = {},
): ParsedTaskDuration | null {
  const value = input.trim().toLowerCase();
  const dayMeasure = context.dayMeasure !== false;
  const days = value.match(new RegExp(String.raw`^${NUMBER}\s*(?:d|day|days)$`));
  if (days) {
    const amount = dayAmount(toNumber(days[1]));
    if (amount === null) return null;
    if (!dayMeasure && validHoursPerDay(context.hoursPerDay)) return daysAsHours(amount, context.hoursPerDay, true);
    return { unit: 'days', scheduleDuration: amount, explicitUnit: true };
  }
  const hours = value.match(new RegExp(String.raw`^${NUMBER}\s*(?:h|u|hour|hours)(?:\s*(\d+)\s*m)?$`));
  if (hours) {
    const hourAmount = toNumber(hours[1]);
    const minuteAmount = Number(hours[2] ?? '0');
    if (!Number.isFinite(hourAmount) || !Number.isSafeInteger(minuteAmount)) return null;
    const durationMinutes = minutesOf(Math.round(hourAmount * 60) + minuteAmount);
    return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit: true };
  }
  const numeric = value.match(new RegExp(String.raw`^${NUMBER}$`));
  if (!numeric) return null;
  const amount = toNumber(numeric[1]);
  if (!Number.isFinite(amount)) return null;
  const shown = context.shownUnit ?? selectedUnit;
  if (shown === selectedUnit || !validHoursPerDay(context.hoursPerDay)) {
    if (shown === 'hours') {
      const durationMinutes = minutesOf(amount * 60);
      return durationMinutes === null ? null : { unit: 'hours', durationMinutes, explicitUnit: false };
    }
    const scheduleDuration = dayAmount(amount);
    return scheduleDuration === null ? null : { unit: 'days', scheduleDuration, explicitUnit: false };
  }
  if (shown === 'days') {
    const shownDays = dayAmount(amount);
    return shownDays === null ? null : daysAsHours(shownDays, context.hoursPerDay, false);
  }
  const scheduleDuration = dayAmount(amount / context.hoursPerDay);
  return scheduleDuration === null ? null : { unit: 'days', scheduleDuration, explicitUnit: false };
}

export function formatTaskDurationInput(
  task: Task,
  opts: { shownUnit?: TaskDurationUnit; hoursPerDay?: number } = {},
): string {
  const own = task.time.durationUnit === 'hours' ? 'hours' : 'days';
  const shown = validHoursPerDay(opts.hoursPerDay) ? opts.shownUnit ?? own : own;
  const days = own === 'days' ? task.time.scheduleDuration : (task.time.durationMinutes ?? 0) / (60 * (opts.hoursPerDay ?? 1));
  const hours = own === 'hours' ? (task.time.durationMinutes ?? 0) / 60 : task.time.scheduleDuration * (opts.hoursPerDay ?? 0);
  return trimDecimals(shown === 'days' ? days : hours);
}

function trimDecimals(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(6).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
}

function conversionStart(task: Task, engine: CalendarEngine): Date {
  return engine.nextWorkInstant(parseInstant(shownStart(task)));
}

export type DurationMeasure = Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>;

export function proposeTaskDurationConversion(
  task: Task,
  target: TaskDurationUnit,
  calendar: WorkCalendar,
  measure: DurationMeasure,
): ParsedTaskDuration | null {
  if (target === task.time.durationUnit) return null;
  const engine = new CalendarEngine(calendarForEngine(calendar));
  if (!engine.isHourMode) return null;
  const dayMeasure = taskCountsInWorkdays(
    { time: { durationUnit: 'days', durationType: task.time.durationType } }, measure,
  );
  if (!dayMeasure) return proposeFixedDayConversion(task, target, engine);
  const start = conversionStart(task, engine);
  if (Number.isNaN(start.getTime())) return null;

  if (target === 'hours') {
    const days = task.time.scheduleDuration;
    if (!Number.isFinite(days) || days < 0) return null;
    if (days === 0) return { unit: 'hours', durationMinutes: 0, explicitUnit: true };
    const end = engine.addMeasuredWorkdaysChecked(start, days);
    if (end.capped) return null;
    return { unit: 'hours', durationMinutes: Math.round(engine.workMinutesBetween(start, end.date)), explicitUnit: true };
  }

  const wanted = task.time.durationMinutes ?? 0;
  if (!Number.isFinite(wanted) || wanted < 0) return null;
  if (wanted === 0) return { unit: 'days', scheduleDuration: 0, explicitUnit: true };
  const end = engine.addWorkMinutes(start, wanted);
  const days = engine.measuredWorkdaysBetween(start, end);
  if (!Number.isFinite(days) || days <= 0) return null;
  return { unit: 'days', scheduleDuration: Number(days.toFixed(6)), explicitUnit: true };
}

function fixedDayMinutes(task: Task, engine: CalendarEngine): number {
  return task.time.durationType === 'ELAPSEDTIME'
    ? elapsedMinutesOf(task, engine)
    : Math.round(durationMinutesOf(task, engine));
}

export function elapsedClockDuration(task: Task, minutes: number): ParsedTaskDuration | null {
  const clockMinutes = minutesOf(minutes);
  if (clockMinutes === null) return null;
  if (task.time.durationUnit === 'days') {
    const scheduleDuration = Number((clockMinutes / (24 * 60)).toFixed(6));
    const candidate: Task = { ...task, time: { ...task.time, scheduleDuration } };
    if (elapsedMinutesOf(candidate, { isHourMode: true, hoursPerDay: 24 }) === clockMinutes) {
      return { unit: 'days', scheduleDuration, explicitUnit: false };
    }
  }
  return { unit: 'hours', durationMinutes: clockMinutes, explicitUnit: true };
}

function proposeFixedDayConversion(task: Task, target: TaskDurationUnit, engine: CalendarEngine): ParsedTaskDuration | null {
  const minutesPerDay = task.time.durationType === 'ELAPSEDTIME' ? 24 * 60 : engine.hoursPerDay * 60;
  if (!Number.isFinite(minutesPerDay) || minutesPerDay <= 0) return null;
  if (target === 'hours') {
    const days = task.time.scheduleDuration;
    if (!Number.isFinite(days) || days < 0) return null;
    const minutes = fixedDayMinutes(task, engine);
    if (!Number.isSafeInteger(minutes)) return null;
    return { unit: 'hours', durationMinutes: minutes, explicitUnit: true };
  }
  const wanted = task.time.durationMinutes ?? 0;
  if (!Number.isSafeInteger(wanted) || wanted < 0) return null;
  const scheduleDuration = Number((wanted / minutesPerDay).toFixed(6));
  const candidate: Task = { ...task, time: { ...task.time, durationUnit: 'days', scheduleDuration, durationMinutes: undefined } };
  if (fixedDayMinutes(candidate, engine) !== wanted) return null;
  return { unit: 'days', scheduleDuration, explicitUnit: true };
}

export function convertTaskDurationUnit(
  task: Task,
  target: TaskDurationUnit,
  calendar: WorkCalendar,
  measure: DurationMeasure,
): ParsedTaskDuration | null {
  return proposeTaskDurationConversion(task, target, calendar, measure);
}
