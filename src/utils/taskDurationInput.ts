import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addCalendarDays, parseDate } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { calendarWithEffectiveWorkTime } from '@/utils/effectiveWorkTime';

export interface ParsedTaskDuration {
  unit: TaskDurationUnit;
  scheduleDuration?: number;
  durationMinutes?: number;
  explicitUnit: boolean;
}

function safeWhole(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Eén taakduur-parser voor dialoog en eigenschappenpaneel. `u` blijft invoeralias naast `h`. */
export function parseTaskDurationInput(input: string, selectedUnit: TaskDurationUnit): ParsedTaskDuration | null {
  const value = input.trim().toLowerCase();
  const days = value.match(/^(\d+)\s*(?:d|day|days)$/);
  if (days) {
    const amount = safeWhole(days[1]);
    return amount == null ? null : { unit: 'days', scheduleDuration: amount, explicitUnit: true };
  }
  const hours = value.match(/^(\d+)(?:\.(\d+))?\s*(?:h|u|hour|hours)(?:\s*(\d+)m)?$/);
  if (hours) {
    const hourAmount = Number(`${hours[1]}${hours[2] ? `.${hours[2]}` : ''}`);
    const minuteAmount = safeWhole(hours[3] ?? '0');
    const durationMinutes = Number.isFinite(hourAmount) && minuteAmount != null
      ? Math.round(hourAmount * 60) + minuteAmount
      : Number.NaN;
    if (!Number.isSafeInteger(durationMinutes)) return null;
    return {
      unit: 'hours',
      durationMinutes,
      explicitUnit: true,
    };
  }
  const numeric = value.match(/^(\d+)(?:\.(\d+))?$/);
  if (numeric) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || (numeric[2] && selectedUnit === 'days')) return null;
    if (selectedUnit === 'hours') {
      const durationMinutes = Math.round(amount * 60);
      if (!Number.isSafeInteger(durationMinutes)) return null;
      return { unit: 'hours', durationMinutes, explicitUnit: false };
    }
    const wholeDays = safeWhole(value);
    if (wholeDays == null) return null;
    return selectedUnit === 'days'
      ? { unit: 'days', scheduleDuration: wholeDays, explicitUnit: false }
      : { unit: 'hours', durationMinutes: wholeDays * 60, explicitUnit: false };
  }
  return null;
}

export function formatTaskDurationInput(task: Task): string {
  if (task.time.durationUnit === 'days') return String(task.time.scheduleDuration);
  const minutes = task.time.durationMinutes ?? 0;
  return (minutes / 60).toFixed(6).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
}

function workMinutesForDay(engine: CalendarEngine, day: Date): number {
  return engine.effectiveBandsOn(day).reduce((sum, band) => sum + (band.end - band.start), 0);
}

function nextWorkDay(engine: CalendarEngine, day: Date): Date {
  return engine.nextWorkDay(day);
}

/** Exact voorstel op de concrete kalender vanaf de taakstart; nooit een modale-uren-per-dag-gok. */
export function proposeTaskDurationConversion(
  task: Task,
  target: TaskDurationUnit,
  calendar: WorkCalendar,
): ParsedTaskDuration | null {
  if (target === task.time.durationUnit) return null;
  if (!hasConcreteWorkBlocks(calendar)) return null;
  const effectiveCalendar = calendarWithEffectiveWorkTime(calendar);
  if (!effectiveCalendar) return null;
  const engine = new CalendarEngine(effectiveCalendar);
  let day = nextWorkDay(engine, parseDate(task.time.earlyStart || task.time.scheduleStart));

  if (target === 'hours') {
    let minutes = 0;
    for (let i = 0; i < task.time.scheduleDuration; i++) {
      minutes += workMinutesForDay(engine, day);
      day = nextWorkDay(engine, addCalendarDays(day, 1));
    }
    return { unit: 'hours', durationMinutes: minutes, explicitUnit: true };
  }

  const wanted = task.time.durationMinutes ?? 0;
  if (wanted === 0) return { unit: 'days', scheduleDuration: 0, explicitUnit: true };
  let accumulated = 0;
  for (let days = 1; days <= 200_000; days++) {
    accumulated += workMinutesForDay(engine, day);
    if (accumulated === wanted) return { unit: 'days', scheduleDuration: days, explicitUnit: true };
    if (accumulated > wanted) return null;
    day = nextWorkDay(engine, addCalendarDays(day, 1));
  }
  return null;
}
