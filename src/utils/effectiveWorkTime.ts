import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { ISO_WEEK_DAYS } from '@/utils/weekDays';

const NOON = 12 * 60;

export function seedScalarBands(
  startMin: number,
  endMin: number,
  hoursPerDay: number,
  simpleBreakStartMinute?: number,
  simpleBreakDurationMinutes?: number,
): { start: number; end: number }[] {
  const span = endMin - startMin;
  if (span <= 0) return [];

  if (simpleBreakStartMinute !== undefined || simpleBreakDurationMinutes !== undefined) {
    const issue = scalarBreakIssue(startMin, endMin, simpleBreakStartMinute, simpleBreakDurationMinutes);
    if (issue) return [];
    const gap = simpleBreakDurationMinutes ?? 0;
    if (gap === 0) return [{ start: startMin, end: endMin }];
    const gapStart = simpleBreakStartMinute ?? NOON;
    return [{ start: startMin, end: gapStart }, { start: gapStart + gap, end: endMin }]
      .filter((band) => band.end > band.start);
  }

  const target = Math.round(hoursPerDay * 60);
  if (target <= 0 || target > span) return [];
  if (span === target) return [{ start: startMin, end: endMin }];
  const gap = span - target;
  const gapStart = Math.min(Math.max(NOON, startMin), endMin - gap);
  const gapEnd = gapStart + gap;
  const bands: { start: number; end: number }[] = [];
  if (gapStart > startMin) bands.push({ start: startMin, end: gapStart });
  if (gapEnd < endMin) bands.push({ start: gapEnd, end: endMin });
  return bands;
}

export function seedScalarWorkTime(
  workDays: number[],
  workStartHour: number,
  workEndHour: number,
  hoursPerDay: number,
  simpleBreakStartMinute?: number,
  simpleBreakDurationMinutes?: number,
): WorkTimeBands {
  return makeBands(workDays, seedScalarBands(
    workStartHour * 60,
    workEndHour * 60,
    hoursPerDay,
    simpleBreakStartMinute,
    simpleBreakDurationMinutes,
  ));
}

export function makeBands(days: readonly number[], bands: readonly { start: number; end: number }[]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const weekday of days) {
    if (ISO_WEEK_DAYS.includes(weekday as typeof ISO_WEEK_DAYS[number])) {
      byWeekday[weekday as typeof ISO_WEEK_DAYS[number]] = bands.map((band) => ({ ...band }));
    }
  }
  return { byWeekday };
}

export type ScalarBreakIssue = 'invalidDuration' | 'outsideWorkingDay' | 'consumesWorkingDay';

export function scalarBreakIssue(
  startMin: number,
  endMin: number,
  breakStartMinute: number | undefined,
  breakDurationMinutes: number | undefined,
): ScalarBreakIssue | undefined {
  if (breakDurationMinutes === undefined && breakStartMinute === undefined) return undefined;
  const duration = breakDurationMinutes ?? 0;
  if (!Number.isInteger(duration) || duration < 0) return 'invalidDuration';
  if (duration === 0) return undefined;
  const start = breakStartMinute ?? NOON;
  if (!Number.isInteger(start) || start < startMin || start >= endMin || start + duration > endMin) {
    return 'outsideWorkingDay';
  }
  if (duration >= endMin - startMin) return 'consumesWorkingDay';
  return undefined;
}

export function calendarScalarBreakIssue(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
): ScalarBreakIssue | undefined {
  return scalarBreakIssue(
    calendar.workStartHour * 60,
    calendar.workEndHour * 60,
    calendar.simpleBreakStartMinute,
    calendar.simpleBreakDurationMinutes,
  );
}

export function simpleBreakNetHours(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>,
): number | undefined {
  if (calendar.simpleBreakStartMinute === undefined && calendar.simpleBreakDurationMinutes === undefined) {
    return undefined;
  }
  const start = calendar.workStartHour * 60;
  const end = calendar.workEndHour * 60;
  if (scalarBreakIssue(start, end, calendar.simpleBreakStartMinute, calendar.simpleBreakDurationMinutes)) {
    return undefined;
  }
  return (end - start - (calendar.simpleBreakDurationMinutes ?? 0)) / 60;
}

type ScalarCalendar = Pick<WorkCalendar,
  'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes' | 'workTime'>;

export function legacySimpleBreakDurationMinutes(calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>): number {
  return Math.max(0, Math.round((calendar.workEndHour - calendar.workStartHour - calendar.hoursPerDay) * 60));
}

const SCALAR_DAY_ORDER = [7, 1, 2, 3, 4, 5, 6] as const;

export function firstBlockedDay(
  bands: Pick<WorkTimeBands, 'byWeekday'> | undefined,
): ReadonlyArray<{ start: number; end: number }> | undefined {
  const byWeekday = bands?.byWeekday;
  if (!byWeekday) return undefined;
  for (const wd of SCALAR_DAY_ORDER) {
    const day = byWeekday[wd];
    if (Array.isArray(day) && day.length > 0) return day;
  }
  return undefined;
}

export function inferredSimpleBreak(
  calendar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>,
): { startMinute: number; durationMinutes: number } {
  return { startMinute: NOON, durationMinutes: legacySimpleBreakDurationMinutes(calendar) };
}

export function scalarTimesValid(calendar: ScalarCalendar, patch: Partial<WorkCalendar>): boolean {
  const next = { ...calendar, ...patch };
  const start = Math.round(next.workStartHour * 60);
  const end = Math.round(next.workEndHour * 60);
  if (start < 0 || start >= 24 * 60 || end <= 0 || end > 24 * 60 || start >= end) return false;
  const inferred = inferredSimpleBreak(calendar);
  const breakStart = next.simpleBreakStartMinute ?? inferred.startMinute;
  const breakDuration = next.simpleBreakDurationMinutes ?? inferred.durationMinutes;
  return breakStart >= start && breakStart < end
    && scalarBreakIssue(start, end, breakStart, breakDuration) === undefined;
}

export function simpleBreakPatch(calendar: ScalarCalendar, patch: Partial<WorkCalendar>): Partial<WorkCalendar> {
  const changesScalarTime = patch.workStartHour !== undefined
    || patch.workEndHour !== undefined
    || patch.simpleBreakStartMinute !== undefined
    || patch.simpleBreakDurationMinutes !== undefined;
  if (!changesScalarTime) return patch;
  const inferred = calendar.simpleBreakDurationMinutes === undefined ? inferredSimpleBreak(calendar) : undefined;
  const materializedLegacyDuration = inferred
    ? {
        simpleBreakStartMinute: calendar.simpleBreakStartMinute ?? inferred.startMinute,
        simpleBreakDurationMinutes: inferred.durationMinutes,
      }
    : {};
  const next = { ...calendar, ...materializedLegacyDuration, ...patch };
  const netHours = simpleBreakNetHours(next);
  return { ...materializedLegacyDuration, ...patch, ...(netHours !== undefined ? { hoursPerDay: netHours } : {}) };
}

function hasAnyBands(bands: WorkTimeBands): boolean {
  return ISO_WEEK_DAYS.some((weekday) => bands.byWeekday[weekday].some(
    (band) => Number.isFinite(band.start) && Number.isFinite(band.end) && band.end > band.start,
  ));
}

export function effectiveWorkTimeBands(calendar: WorkCalendar): WorkTimeBands | undefined {
  if (calendar.workTime) return hasAnyBands(calendar.workTime) ? calendar.workTime : undefined;
  const {
    workDays, workStartHour, workEndHour, hoursPerDay, simpleBreakStartMinute, simpleBreakDurationMinutes,
  } = calendar;
  if (!Array.isArray(workDays) || workDays.length === 0
    || !Number.isFinite(workStartHour) || !Number.isFinite(workEndHour) || !Number.isFinite(hoursPerDay)
    || workStartHour < 0 || workEndHour > 24 || hoursPerDay <= 0) return undefined;
  const bands = seedScalarWorkTime(
    workDays, workStartHour, workEndHour, hoursPerDay, simpleBreakStartMinute, simpleBreakDurationMinutes,
  );
  return hasAnyBands(bands) ? bands : undefined;
}

export function calendarWithEffectiveWorkTime(calendar: WorkCalendar): WorkCalendar | undefined {
  const workTime = effectiveWorkTimeBands(calendar);
  return workTime ? { ...calendar, workTime } : undefined;
}

const engineCalendars = new WeakMap<WorkCalendar, WorkCalendar>();
const scalarEngineCalendars = new WeakSet<WorkCalendar>();

export function calendarHasOwnWorkBlocks(calendar: WorkCalendar): boolean {
  return calendar.workTime !== undefined && !scalarEngineCalendars.has(calendar);
}

export function calendarForEngine(calendar: WorkCalendar): WorkCalendar {
  if (calendar.workTime) return calendar;
  const cached = engineCalendars.get(calendar);
  if (cached) return cached;
  const effective = calendarWithEffectiveWorkTime(calendar) ?? calendar;
  if (effective !== calendar) scalarEngineCalendars.add(effective);
  engineCalendars.set(calendar, effective);
  return effective;
}
