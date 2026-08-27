import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addCalendarDays, parseDate } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';

export interface ParsedTaskDuration {
  unit: TaskDurationUnit;
  scheduleDuration?: number;
  durationMinutes?: number;
  explicitUnit: boolean;
}

/** Eén taakduur-parser voor dialoog en eigenschappenpaneel. `u` blijft invoeralias; output gebruikt h. */
export function parseTaskDurationInput(input: string, selectedUnit: TaskDurationUnit): ParsedTaskDuration | null {
  const value = input.trim().toLowerCase();
  const days = value.match(/^(\d+)d$/);
  if (days) return { unit: 'days', scheduleDuration: Number(days[1]), explicitUnit: true };
  const hours = value.match(/^(\d+)[hu](?:\s*(\d+)m)?$/);
  if (hours) {
    return {
      unit: 'hours',
      durationMinutes: Number(hours[1]) * 60 + Number(hours[2] ?? 0),
      explicitUnit: true,
    };
  }
  if (/^\d+$/.test(value)) {
    const amount = Number(value);
    return selectedUnit === 'days'
      ? { unit: 'days', scheduleDuration: amount, explicitUnit: false }
      : { unit: 'hours', durationMinutes: amount * 60, explicitUnit: false };
  }
  return null;
}

export function formatTaskDurationInput(task: Task): string {
  if (task.time.durationUnit === 'days') return `${task.time.scheduleDuration}d`;
  const minutes = task.time.durationMinutes ?? 0;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
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
  const engine = new CalendarEngine(calendar);
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
  let accumulated = 0;
  for (let days = 1; days <= 200_000; days++) {
    accumulated += workMinutesForDay(engine, day);
    if (accumulated === wanted) return { unit: 'days', scheduleDuration: days, explicitUnit: true };
    if (accumulated > wanted) return null;
    day = nextWorkDay(engine, addCalendarDays(day, 1));
  }
  return null;
}
