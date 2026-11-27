export function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(iso);
  if (isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const MS_PER_DAY = 86_400_000;

export function utcDayStart(d: Date): Date {
  return new Date(utcDayIndex(d.getTime()) * MS_PER_DAY);
}

export function utcDayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  if (y >= 0 && y <= 9999) {
    return `${String(y).padStart(4, '0')}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return d.toISOString().split('T')[0];
}

export function localTodayIso(now: Date = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function localNowOnDayAxis(now: Date = new Date()): Date {
  const d = new Date(0);
  d.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  d.setUTCHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return d;
}

export type DateMode = 'day' | 'hour';

export function parseInstant(iso: string): Date {
  if (iso.includes('T')) {
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    return new Date(hasTz ? iso : `${iso}Z`);
  }
  return parseDate(iso);
}

export function formatInstant(d: Date, mode: DateMode): string {
  return mode === 'hour' ? d.toISOString().slice(0, 16) : formatDate(d);
}

export function isoDayOfWeek(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

export function diffCalendarDays(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function addCalendarDays(d: Date, days: number): Date {
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getWeekStart(d: Date): Date {
  const result = new Date(d.getTime());
  const day = isoDayOfWeek(result);
  result.setUTCDate(result.getUTCDate() - (day - 1));
  return result;
}

export function getWeekStartSunday(d: Date): Date {
  const result = new Date(d.getTime());
  const dow = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - dow);
  return result;
}

export function getWeekStartFor(d: Date, startDay: 'monday' | 'sunday'): Date {
  return startDay === 'sunday' ? getWeekStartSunday(d) : getWeekStart(d);
}

export function getMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addCalendarMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDayOfTarget)));
}

export function isExistingYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-](\d{2})(:?)(\d{2}))?)?$/;

export function isStrictIsoDateTime(
  value: string,
  format: { maxFractionDigits: number; offsetColonOptional?: boolean },
): boolean {
  const m = ISO_DATE_TIME.exec(value);
  if (!m || !isExistingYmd(Number(m[1]), Number(m[2]), Number(m[3]))) return false;
  if (m[4] === undefined) return true;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || (m[6] !== undefined && Number(m[6]) > 59)) return false;
  if (m[7] !== undefined && m[7].length > format.maxFractionDigits) return false;
  if (m[8] !== undefined) {
    if (m[9] === '' && !format.offsetColonOptional) return false;
    const offsetHour = Number(m[8]);
    const offsetMinute = Number(m[10]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}

export function diffDays(a: string, b: string): number {
  return diffCalendarDays(parseDate(a), parseDate(b));
}

export function getWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

export function addBusinessDays(start: Date, workDays: number): Date {
  if (workDays <= 0 || isNaN(start.getTime())) return new Date(start.getTime());
  let current = new Date(start.getTime());
  let scan = 0;
  while (isoDayOfWeek(current) > 5) {
    current = addCalendarDays(current, 1);
    if (++scan > 366) break;
  }
  let remaining = workDays - 1;
  let steps = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, 1);
    if (isoDayOfWeek(current) <= 5) remaining--;
    if (++steps > 200_000) break;
  }
  return current;
}

export function getWeekNumberFor(d: Date, startDay: 'monday' | 'sunday' = 'monday'): number {
  if (startDay === 'monday') return getWeekNumber(d);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jan1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((target.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
}
