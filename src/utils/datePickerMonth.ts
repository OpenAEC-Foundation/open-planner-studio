import { addCalendarDays, addCalendarMonths, formatDate, getWeekNumberFor, getWeekStartFor, isoDayOfWeek, parseDate } from './dateUtils';
import { gregorianDateFormat } from './monthLabel';

export type WeekStartDay = 'monday' | 'sunday';

export interface DatePickerDay {
  iso: string;
  day: number;
  inMonth: boolean;
  isoWeekday: number;
}

export interface DatePickerWeek {
  weekNumber: number;
  days: DatePickerDay[];
}

const WEEKS = 6;

export function monthOf(iso: string): { year: number; month: number } {
  const d = parseDate(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function addMonthsClamped(iso: string, months: number): string {
  return formatDate(addCalendarMonths(parseDate(iso), months));
}

export function monthGrid(year: number, month: number, weekStartDay: WeekStartDay): DatePickerWeek[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = getWeekStartFor(first, weekStartDay);
  const weeks: DatePickerWeek[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addCalendarDays(start, w * 7);
    const days: DatePickerDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addCalendarDays(weekStart, i);
      days.push({
        iso: formatDate(d),
        day: d.getUTCDate(),
        inMonth: d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year,
        isoWeekday: isoDayOfWeek(d),
      });
    }
    weeks.push({ weekNumber: getWeekNumberFor(weekStart, weekStartDay), days });
  }
  return weeks;
}

export function datePickerKeyTarget(
  iso: string,
  key: string,
  opts: { shift: boolean; rtl: boolean; weekStartDay: WeekStartDay },
): string | null {
  const d = parseDate(iso);
  const day = (n: number) => formatDate(addCalendarDays(d, n));
  const forward = opts.rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = opts.rtl ? 'ArrowRight' : 'ArrowLeft';
  switch (key) {
    case forward: return day(1);
    case back: return day(-1);
    case 'ArrowUp': return day(-7);
    case 'ArrowDown': return day(7);
    case 'Home': return formatDate(getWeekStartFor(d, opts.weekStartDay));
    case 'End': return formatDate(addCalendarDays(getWeekStartFor(d, opts.weekStartDay), 6));
    case 'PageUp': return addMonthsClamped(iso, opts.shift ? -12 : -1);
    case 'PageDown': return addMonthsClamped(iso, opts.shift ? 12 : 1);
    default: return null;
  }
}

export interface DatePickerLabels {
  monthTitle: (year: number, month: number) => string;
  dayLabel: (iso: string) => string;
}

export function datePickerLabels(locale: string): DatePickerLabels {
  const title = gregorianDateFormat(locale, { month: 'long', year: 'numeric' });
  const full = gregorianDateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return {
    monthTitle: (year, month) => title.format(new Date(Date.UTC(year, month - 1, 1))),
    dayLabel: iso => full.format(parseDate(iso)),
  };
}
