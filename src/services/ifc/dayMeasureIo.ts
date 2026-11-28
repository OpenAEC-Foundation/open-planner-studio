import type { Task } from '@/types/task';
import { taskDurationUnit } from '@/engine/scheduler/duration';

export type DayMeasureRecord = readonly [days: number, minutes: number];

export const DAY_MEASURE_DURATION_KEYS = ['ScheduleDuration', 'RemainingTime', 'ActualDuration'] as const;
export type DayMeasureDurationKey = typeof DAY_MEASURE_DURATION_KEYS[number];
export type DayMeasureDurationRecords = Partial<Record<DayMeasureDurationKey, DayMeasureRecord>>;

export const EXACT_FLOAT_KEYS = ['TotalFloat', 'FreeFloat'] as const;
export type ExactFloatKey = typeof EXACT_FLOAT_KEYS[number];
export type ExactFloatRecord = readonly [days: number, minutes: number | null];
export type ExactFloatRecords = Partial<Record<ExactFloatKey, ExactFloatRecord>>;

export const EXACT_MINUTES_KEYS = ['ScheduleDuration', 'RemainingTime'] as const;
export type ExactMinutesKey = typeof EXACT_MINUTES_KEYS[number];
export type ExactMinutesRecord = readonly [minutes: number, written: number];
export type ExactMinutesRecords = Partial<Record<ExactMinutesKey, ExactMinutesRecord>>;

export const DAY_MEASURE_DURATIONS_PROP = 'DayMeasureDurations';
export const EXACT_MINUTES_PROP = 'ExactMinutes';
export const DAY_MEASURE_LAGS_PROP = 'DayMeasureLags';
export const EXACT_MINUTE_LAGS_PROP = 'ExactMinuteLags';
export const EXACT_FLOAT_PROP = 'ExactFloat';

export const ELAPSED_MINUTES_PER_DAY = 1440;

export function roundDays(days: number): number {
  return Math.round(days * 1e6) / 1e6;
}

export function isWholeDays(days: number): boolean {
  return !Number.isFinite(days) || Number.isInteger(roundDays(days));
}

export function dayMeasureMinutes(days: number, minutesPerDay: number): number {
  return Math.round(days * minutesPerDay);
}

export function recordDayValue(days: number, minutesPerDay: number): number {
  const rounded = roundDays(days);
  return dayMeasureMinutes(rounded, minutesPerDay) === dayMeasureMinutes(days, minutesPerDay) ? rounded : days;
}

export function dayMeasureRecord(days: number, minutesPerDay: number): DayMeasureRecord {
  return [recordDayValue(days, minutesPerDay), dayMeasureMinutes(days, minutesPerDay)];
}

export function dayTaskWritesMinutes(task: Task): boolean {
  if (taskDurationUnit(task) === 'hours') return false;
  const t = task.time;
  return !isWholeDays(t.scheduleDuration) || (t.remainingTime != null && !isWholeDays(t.remainingTime));
}

export function taskDurationWritesMinutes(task: Task): boolean {
  return taskDurationUnit(task) === 'hours' || dayTaskWritesMinutes(task);
}

export function taskMinutesPerDay(task: Task, workHoursPerDay: number): number {
  return task.time.durationType === 'ELAPSEDTIME' ? ELAPSED_MINUTES_PER_DAY : workHoursPerDay * 60;
}

export function exactMinutesRecord(minutes: number | undefined): ExactMinutesRecord | undefined {
  if (minutes === undefined || !Number.isFinite(minutes) || Number.isInteger(minutes)) return undefined;
  return [minutes, Math.round(minutes)];
}

export function wholeFloatDays(days: number): number {
  if (!Number.isFinite(days)) return days;
  const rounded = Math.round(days);
  return rounded === 0 ? 0 : rounded;
}

export function exactFloatRecord(days: number, minutes: number | undefined): ExactFloatRecord | undefined {
  if (!Number.isFinite(days)) return undefined;
  const hasMinutes = minutes !== undefined && Number.isFinite(minutes);
  if (!hasMinutes && isWholeDays(days)) return undefined;
  return [roundDays(days), hasMinutes ? minutes : null];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseDayMeasureRecord(value: unknown): DayMeasureRecord | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [days, minutes] = value as unknown[];
  if (!finite(days) || !finite(minutes) || !Number.isInteger(minutes)) return undefined;
  return [days, minutes];
}

function parseExactFloatRecord(value: unknown): ExactFloatRecord | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [days, minutes] = value as unknown[];
  if (!finite(days) || (minutes !== null && !finite(minutes))) return undefined;
  return [days, minutes];
}

function parseJsonObject(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

export function parseDayMeasureDurations(raw: unknown): DayMeasureDurationRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in DayMeasureDurationKey]?: DayMeasureRecord } = {};
  for (const key of DAY_MEASURE_DURATION_KEYS) {
    const record = parseDayMeasureRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseExactMinutes(raw: unknown): ExactMinutesRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in ExactMinutesKey]?: ExactMinutesRecord } = {};
  for (const key of EXACT_MINUTES_KEYS) {
    const record = parseDayMeasureRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseExactFloat(raw: unknown): ExactFloatRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in ExactFloatKey]?: ExactFloatRecord } = {};
  for (const key of EXACT_FLOAT_KEYS) {
    const record = parseExactFloatRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseDayMeasureLags(raw: unknown): Map<string, DayMeasureRecord> | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out = new Map<string, DayMeasureRecord>();
  for (const [guid, value] of Object.entries(obj)) {
    const record = parseDayMeasureRecord(value);
    if (guid && record) out.set(guid, record);
  }
  return out;
}
