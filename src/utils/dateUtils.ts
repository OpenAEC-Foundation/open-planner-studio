/** Parse an ISO date string to a Date object at midnight UTC */
export function parseDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Format a Date as ISO date string (YYYY-MM-DD) */
export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Format a Date as ISO datetime string */
export function formatDateTime(d: Date): string {
  return d.toISOString().replace('Z', '');
}

/** Get the ISO day of week (1=Monday, 7=Sunday) */
export function isoDayOfWeek(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Get the difference in calendar days between two dates */
export function diffCalendarDays(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/** Add calendar days to a date */
export function addCalendarDays(d: Date, days: number): Date {
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Get the Monday of the week containing the given date */
export function getWeekStart(d: Date): Date {
  const result = new Date(d.getTime());
  const day = isoDayOfWeek(result);
  result.setUTCDate(result.getUTCDate() - (day - 1));
  return result;
}

/** Get the Sunday of the week containing the given date (used when weekStartDay='sunday') */
export function getWeekStartSunday(d: Date): Date {
  const result = new Date(d.getTime());
  const dow = result.getUTCDay(); // 0=Sun..6=Sat
  result.setUTCDate(result.getUTCDate() - dow);
  return result;
}

/** Get the start of the week respecting the week-start-day preference */
export function getWeekStartFor(d: Date, startDay: 'monday' | 'sunday'): Date {
  return startDay === 'sunday' ? getWeekStartSunday(d) : getWeekStart(d);
}

/** Get the first day of the month */
export function getMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Format a date for display (e.g., "2 Mar 2026") using Intl */
export function formatDisplayDate(d: Date, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Difference in calendar days between two ISO date strings */
export function diffDays(a: string, b: string): number {
  return diffCalendarDays(parseDate(a), parseDate(b));
}

/** Get week number (ISO 8601) */
export function getWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/**
 * Add work days to a date counting only weekends as non-working (Mon–Fri),
 * with the start day counting as day 1. Mirrors CalendarEngine.addWorkDays but
 * without holiday awareness — used for placeholder/default finish dates before
 * CPM runs. The real, calendar-aware schedule is computed by runCPM (F5).
 */
export function addBusinessDays(start: Date, workDays: number): Date {
  // Guard tegen een ongeldige datum (bv. uit een corrupte import): isoDayOfWeek(Invalid)=NaN,
  // NaN<=5 is altijd false → `remaining` daalt nooit → oneindige lus. Geef de (ongeldige) datum
  // gewoon terug; de CPM-solver vangt de ongeldige startdatum verderop netjes af.
  if (workDays <= 0 || isNaN(start.getTime())) return new Date(start.getTime());
  let current = new Date(start.getTime());
  // Ensure we start on a weekday (met scan-grens tegen vastlopen)
  let scan = 0;
  while (isoDayOfWeek(current) > 5) {
    current = addCalendarDays(current, 1);
    if (++scan > 366) break;
  }
  let remaining = workDays - 1; // the start day counts as day 1
  let steps = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, 1);
    if (isoDayOfWeek(current) <= 5) remaining--;
    if (++steps > 200_000) break;
  }
  return current;
}

/** Get week number with configurable week start. ISO 8601 when 'monday', US-style when 'sunday'. */
export function getWeekNumberFor(d: Date, startDay: 'monday' | 'sunday' = 'monday'): number {
  if (startDay === 'monday') return getWeekNumber(d);
  // US-style: week 1 contains Jan 1; weeks start Sunday.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jan1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((target.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
}
