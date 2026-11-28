import { formatDate, formatInstant, parseDate, parseInstant, localTodayIso } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isDateOnly } from '@/engine/calendar/workdayRules';

export function parseImportedInstant(raw: string): Date {
  return parseInstant(raw.includes('T') ? raw.replace(/(?:[Zz]|[+-]\d{2}:?\d{2})$/, '') : raw);
}

export function isoDatePrefixOrToday(s: string): string {
  if (!s) return localTodayIso();
  return s.substring(0, 10);
}

export function importDateTime(s: string, hour: boolean): string {
  if (!s) return localTodayIso();
  return hour && !isDateOnly(s) ? formatInstant(parseImportedInstant(s), 'hour') : s.substring(0, 10);
}

export function importDateTimeOrUndefined(s: string, hour: boolean): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(parseImportedInstant(s).getTime())) return undefined;
  return importDateTime(s, hour);
}

export function importStatusDate(v: string): string {
  const day = v.substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return day;
  const instant = parseImportedInstant(v);
  return Number.isNaN(instant.getTime()) ? day : formatInstant(instant, 'hour');
}

export function csvDate(s: string): string | undefined {
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return undefined;
}

export function csvDateOrToday(s: string): string {
  return csvDate(s) ?? localTodayIso();
}

export interface MissingScheduleDates {
  start: Set<string>;
  finish: Set<string>;
}

export function emptyMissingScheduleDates(): MissingScheduleDates {
  return { start: new Set(), finish: new Set() };
}

function finishFromStartAndDuration(task: Task, calendar: WorkCalendar): string | undefined {
  const t = task.time;
  if (t.scheduleDuration === 0 && !t.durationMinutes) return t.scheduleStart;
  if (t.scheduleStart.includes('T')) return undefined;
  if (t.durationType !== 'WORKTIME') return undefined;
  if (t.durationUnit !== 'days' && (t.durationUnit !== 'hours' || calendar.workTime)) return undefined;
  if (!Number.isInteger(t.scheduleDuration) || t.scheduleDuration < 0) return undefined;
  const start = parseDate(t.scheduleStart);
  if (isNaN(start.getTime())) return undefined;
  const { date, capped } = new CalendarEngine(calendarForEngine(calendar))
    .addWorkDaysChecked(start, t.scheduleDuration);
  return capped ? undefined : formatDate(date);
}

export function resolveMissingScheduleDates(
  tasks: Task[],
  missing: MissingScheduleDates,
  fileProjectStart: string,
  calendarOf: (task: Task) => WorkCalendar,
): string {
  let earliest = '';
  for (const t of tasks) {
    if (missing.start.has(t.id)) continue;
    const st = t.time.scheduleStart;
    if (st && (!earliest || st < earliest)) earliest = st;
  }
  const anchor = fileProjectStart
    ? fileProjectStart.substring(0, 10)
    : (earliest ? earliest.substring(0, 10) : localTodayIso());
  for (const t of tasks) {
    const time = t.time;
    if (missing.start.has(t.id)) {
      const placeholder = time.scheduleStart;
      time.scheduleStart = anchor;
      if (time.earlyStart === placeholder) time.earlyStart = anchor;
      if (time.lateStart === placeholder) time.lateStart = anchor;
    }
    if (missing.finish.has(t.id)) {
      const derived = finishFromStartAndDuration(t, calendarOf(t));
      if (derived === undefined) continue;
      const placeholder = time.scheduleFinish;
      time.scheduleFinish = derived;
      if (time.earlyFinish === placeholder) time.earlyFinish = derived;
      if (time.lateFinish === placeholder) time.lateFinish = derived;
    }
  }
  return anchor;
}

export function csvDateOrUndefined(s: string): string | undefined {
  const trimmed = s.trim();
  let y: number, m: number, d: number;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = iso ? null : trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (dmy) { y = Number(dmy[3]); m = Number(dmy[2]); d = Number(dmy[1]); }
  else return undefined;
  if (m < 1 || m > 12 || d < 1) return undefined;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
