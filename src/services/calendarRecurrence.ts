/**
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj,
 * © Jon Iles e.a., LGPL-2.1) — structuurkennis/datumgeneratie-algoritmes geport naar TypeScript
 * voor Open Planner Studio (LGPL-3.0), zelfde vermelding als `services/mpp/mppReader.ts`/
 * `mppCalendars.ts`/`limits.ts`.
 */
import { formatDate, parseDate, addCalendarDays } from '@/utils/dateUtils';

export const UNNAMED_HOLIDAY_NAME = 'Holiday';
export const UNNAMED_WORKING_EXCEPTION_NAME = 'Working exception';
export const MAX_TOTAL_HOLIDAY_SLOTS = 100_000;

export const MAX_BASE_CHAIN_DEPTH = 32;

export const MAX_CALENDAR_EXCEPTIONS = 2000;

export const MAX_HOLIDAY_RANGE_DAYS = 366;

export const MAX_RECURRENCE_DATES = 3_660;

export const MAX_RECURRENCE_ITERATIONS = MAX_RECURRENCE_DATES + 16;

export interface HolidayBudget {
  remaining: number;
}

export function newHolidayBudget(): HolidayBudget {
  return { remaining: MAX_TOTAL_HOLIDAY_SLOTS };
}

export interface ParsedExceptions {
  holidays: { name: string; startDate: string; endDate: string }[];
  workingExceptions: { name: string; startDate: string; endDate: string; bands?: { start: number; end: number }[] }[];
}

export interface RecurrenceSpec {
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  relative: boolean;
  startDate: Date;
  finishDate: Date | null;
  occurrences: number;
  frequency: number;
  weeklyDayMask: number;
  dayNumber: number;
  dayOfWeekValue: number;
  monthNumber: number;
}

export const RECURRENCE_TYPES: ReadonlyArray<RecurrenceSpec['type'] | null> = [
  null, 'DAILY', 'YEARLY', 'YEARLY', 'MONTHLY', 'MONTHLY', 'WEEKLY', 'DAILY',
];
export const RELATIVE_MAP: ReadonlyArray<boolean> = [false, false, false, true, false, true];
export const RECURRENCE_PRECEDENCE_ORDER: ReadonlyArray<RecurrenceSpec['type']> = ['WEEKLY', 'MONTHLY', 'YEARLY', 'DAILY'];

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function mpxjDayValue(d: Date): number {
  return d.getUTCDay() + 1;
}

function moreDates(date: Date, generatedCount: number, finishDate: Date | null, occurrences: number): boolean {
  if (!finishDate) {
    const occ = occurrences < 1 ? 1 : occurrences;
    return generatedCount < occ;
  }
  return date.getTime() <= finishDate.getTime();
}

function ordinalRelativeDay(date: Date, dayNumber: number, dayOfWeekValue: number): Date {
  const currentDayOfWeek = mpxjDayValue(date);
  let offset = 0;
  if (dayOfWeekValue > currentDayOfWeek) offset = dayOfWeekValue - currentDayOfWeek;
  else if (dayOfWeekValue < currentDayOfWeek) offset = 7 - (currentDayOfWeek - dayOfWeekValue);
  let d = offset !== 0 ? addCalendarDays(date, offset) : date;
  if (dayNumber > 1) d = addCalendarDays(d, 7 * (dayNumber - 1));
  return d;
}

function lastRelativeDay(date: Date, dayOfWeekValue: number): Date {
  const year = date.getUTCFullYear();
  const month0 = date.getUTCMonth();
  let d = new Date(Date.UTC(year, month0, daysInMonthUtc(year, month0)));
  const currentDayOfWeek = mpxjDayValue(d);
  let offset = 0;
  if (currentDayOfWeek > dayOfWeekValue) offset = dayOfWeekValue - currentDayOfWeek;
  else if (currentDayOfWeek < dayOfWeekValue) offset = -7 + (dayOfWeekValue - currentDayOfWeek);
  if (offset !== 0) d = addCalendarDays(d, offset);
  return d;
}

function getDailyDates(startDate: Date, frequency: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = startDate;
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    dates.push(date);
    date = addCalendarDays(date, frequency);
  }
  return dates;
}

function getWeeklyDates(startDate: Date, frequency: number, dayMask: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = startDate;
  let currentDay = date.getUTCDay();
  if (currentDay !== 0) {
    date = addCalendarDays(date, -currentDay);
    currentDay = 0;
  }
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    let offset = 0;
    for (let dayIndex = 0; dayIndex < 7 && dates.length < MAX_RECURRENCE_DATES; dayIndex++) {
      if ((dayMask & (1 << currentDay)) !== 0) {
        if (offset !== 0) {
          date = addCalendarDays(date, offset);
          offset = 0;
        }
        if (!moreDates(date, dates.length, finishDate, occurrences)) break;
        if (date.getTime() >= startDate.getTime()) dates.push(date);
      }
      offset++;
      currentDay = (currentDay + 1) % 7;
    }
    if (frequency > 1) offset += 7 * (frequency - 1);
    date = addCalendarDays(date, offset);
  }
  return dates;
}

function getMonthlyAbsoluteDates(startDate: Date, frequency: number, dayNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  const currentDayNumber = startDate.getUTCDate();
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  if (dayNumber < currentDayNumber) date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const year = date.getUTCFullYear();
    const month0 = date.getUTCMonth();
    const useDay = Math.min(dayNumber, daysInMonthUtc(year, month0));
    date = new Date(Date.UTC(year, month0, useDay));
    dates.push(date);
    date = new Date(Date.UTC(year, month0, 1));
    date = new Date(Date.UTC(year, month0 + frequency, 1));
  }
  return dates;
}

function getMonthlyRelativeDates(startDate: Date, frequency: number, dayOfWeekValue: number, dayNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const cursor = date;
    date = dayNumber > 4 ? lastRelativeDay(date, dayOfWeekValue) : ordinalRelativeDay(date, dayNumber, dayOfWeekValue);
    if (date.getTime() >= startDate.getTime()) {
      dates.push(date);
      if (!moreDates(date, dates.length, finishDate, occurrences)) break;
    }
    const nextDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + frequency, 1));
    if (nextDate.getTime() <= cursor.getTime()) break;
    date = nextDate;
  }
  return dates;
}

function getYearlyAbsoluteDates(startDate: Date, dayNumber: number, monthNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), monthNumber - 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const year = date.getUTCFullYear();
    const month0 = date.getUTCMonth();
    const useDay = Math.min(dayNumber, daysInMonthUtc(year, month0));
    date = new Date(Date.UTC(year, month0, useDay));
    if (date.getTime() < startDate.getTime()) {
      const bumpedYear = year + 1;
      const bumpedDay = Math.min(useDay, daysInMonthUtc(bumpedYear, month0));
      date = new Date(Date.UTC(bumpedYear, month0, bumpedDay));
    }
    dates.push(date);
    date = new Date(Date.UTC(date.getUTCFullYear(), month0, 1));
    date = new Date(Date.UTC(date.getUTCFullYear() + 1, month0, 1));
  }
  return dates;
}

function getYearlyRelativeDates(startDate: Date, dayOfWeekValue: number, dayNumber: number, monthNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), monthNumber - 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    date = dayNumber > 4 ? lastRelativeDay(date, dayOfWeekValue) : ordinalRelativeDay(date, dayNumber, dayOfWeekValue);
    if (date.getTime() >= startDate.getTime()) {
      dates.push(date);
      if (!moreDates(date, dates.length, finishDate, occurrences)) break;
    }
    date = new Date(Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), 1));
  }
  return dates;
}

export function expandRecurrence(spec: RecurrenceSpec): Date[] {
  const frequency = spec.frequency < 1 ? 1 : spec.frequency;
  switch (spec.type) {
    case 'DAILY':
      return getDailyDates(spec.startDate, frequency, spec.finishDate, spec.occurrences);
    case 'WEEKLY':
      return getWeeklyDates(spec.startDate, frequency, spec.weeklyDayMask, spec.finishDate, spec.occurrences);
    case 'MONTHLY':
      return spec.relative
        ? getMonthlyRelativeDates(spec.startDate, frequency, spec.dayOfWeekValue, spec.dayNumber, spec.finishDate, spec.occurrences)
        : getMonthlyAbsoluteDates(spec.startDate, frequency, spec.dayNumber, spec.finishDate, spec.occurrences);
    case 'YEARLY':
      return spec.relative
        ? getYearlyRelativeDates(spec.startDate, spec.dayOfWeekValue, spec.dayNumber, spec.monthNumber, spec.finishDate, spec.occurrences)
        : getYearlyAbsoluteDates(spec.startDate, spec.dayNumber, spec.monthNumber, spec.finishDate, spec.occurrences);
  }
}

export interface RawException {
  fromDate: Date;
  toDate: Date | null;
  periodCount: number;
  bands: { start: number; end: number }[];
  name: string;
  recurring: RecurrenceSpec | null;
}

export interface RecordContribution {
  ownDates: Date[];
  working: boolean;
  bands: { start: number; end: number }[];
  name: string;
}

export function buildContributions(raw: RawException[], budget: HolidayBudget): RecordContribution[] {
  const contributions: RecordContribution[] = [];
  const recurringByType = new Map<RecurrenceSpec['type'], { dates: Date[]; working: boolean; bands: { start: number; end: number }[]; name: string }[]>();
  const nonRecurringEquivalent: RecordContribution[] = [];
  let remaining = budget.remaining;

  for (const exc of raw) {
    if (remaining <= 0) break;

    if (exc.recurring) {
      const dates = expandRecurrence(exc.recurring);
      if (dates.length === 0) continue;

      if (dates.length === 1) {
        nonRecurringEquivalent.push({ ownDates: dates, working: exc.periodCount > 0, bands: exc.bands, name: exc.name });
        remaining -= 1;
        continue;
      }

      const clamped = dates.length <= remaining ? dates : dates.slice(0, remaining);
      remaining -= clamped.length;
      if (clamped.length === 0) continue;
      const entry = { dates: clamped, working: exc.periodCount > 0, bands: exc.bands, name: exc.name };
      const bucket = recurringByType.get(exc.recurring.type);
      if (bucket) bucket.push(entry);
      else recurringByType.set(exc.recurring.type, [entry]);
    } else if (exc.toDate) {
      let clampedTo = exc.toDate;
      const rangeDays = Math.round((exc.toDate.getTime() - exc.fromDate.getTime()) / 86_400_000);
      if (rangeDays >= MAX_HOLIDAY_RANGE_DAYS) {
        clampedTo = addCalendarDays(exc.fromDate, MAX_HOLIDAY_RANGE_DAYS - 1);
      } else if (rangeDays < 0) {
        clampedTo = exc.fromDate;
      }
      const ownDates: Date[] = [];
      let cursor = exc.fromDate;
      while (cursor.getTime() <= clampedTo.getTime() && remaining > 0) {
        ownDates.push(cursor);
        remaining--;
        cursor = addCalendarDays(cursor, 1);
      }
      if (ownDates.length > 0) nonRecurringEquivalent.push({ ownDates, working: exc.periodCount > 0, bands: exc.bands, name: exc.name });
    }
  }

  for (const type of RECURRENCE_PRECEDENCE_ORDER) {
    for (const entry of recurringByType.get(type) ?? []) {
      contributions.push({ ownDates: entry.dates, working: entry.working, bands: entry.bands, name: entry.name });
    }
  }
  contributions.push(...nonRecurringEquivalent);

  return contributions;
}

function isNextCalendarDay(prevIso: string, iso: string): boolean {
  return formatDate(addCalendarDays(parseDate(prevIso), 1)) === iso;
}

export function resolveContributions(contributions: RecordContribution[], budget: HolidayBudget): ParsedExceptions {
  const authority = new Map<string, number>();
  outer: for (let i = 0; i < contributions.length; i++) {
    for (const date of contributions[i].ownDates) {
      if (budget.remaining <= 0) break outer;
      authority.set(formatDate(date), i);
      budget.remaining--;
    }
  }

  const holidays: ParsedExceptions['holidays'] = [];
  const workingExceptions: ParsedExceptions['workingExceptions'] = [];
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    let runStart: string | null = null;
    let runEnd: string | null = null;
    const flush = (): void => {
      if (runStart === null || runEnd === null) return;
      const name = c.name || (c.working ? UNNAMED_WORKING_EXCEPTION_NAME : UNNAMED_HOLIDAY_NAME);
      if (c.working) workingExceptions.push({ name, startDate: runStart, endDate: runEnd, bands: c.bands.length ? c.bands : undefined });
      else holidays.push({ name, startDate: runStart, endDate: runEnd });
    };
    for (const date of c.ownDates) {
      const iso = formatDate(date);
      const survives = authority.get(iso) === i;
      if (!survives) {
        flush();
        runStart = null;
        runEnd = null;
        continue;
      }
      if (runStart === null) {
        runStart = iso;
      } else if (runEnd !== null && !isNextCalendarDay(runEnd, iso)) {
        flush();
        runStart = iso;
      }
      runEnd = iso;
    }
    flush();
  }

  return { holidays, workingExceptions };
}

function reExpandRange(startIso: string, endIso: string): Date[] {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const rangeDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const cappedDays = Math.min(rangeDays, MAX_RECURRENCE_DATES - 1);
  const out: Date[] = [];
  for (let i = 0; i <= cappedDays; i++) out.push(addCalendarDays(start, i));
  return out;
}

export function mergeInherited(base: ParsedExceptions, ownContributions: RecordContribution[], budget: HolidayBudget): ParsedExceptions {
  let room = budget.remaining;
  const take = (startIso: string, endIso: string): Date[] | null => {
    if (room <= 0) return null;
    const dates = reExpandRange(startIso, endIso);
    if (dates.length > room) dates.length = room;
    room -= dates.length;
    return dates;
  };
  const baseContributions: RecordContribution[] = [];
  for (const h of base.holidays) {
    const ownDates = take(h.startDate, h.endDate);
    if (!ownDates) break;
    baseContributions.push({ ownDates, working: false, bands: [], name: h.name });
  }
  for (const w of base.workingExceptions) {
    const ownDates = take(w.startDate, w.endDate);
    if (!ownDates) break;
    baseContributions.push({ ownDates, working: true, bands: w.bands ?? [], name: w.name });
  }
  return resolveContributions([...baseContributions, ...ownContributions], budget);
}
