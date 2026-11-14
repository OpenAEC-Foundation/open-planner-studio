import { addCalendarDays, addCalendarMonths, formatDate, getWeekNumberFor, getWeekStartFor, isoDayOfWeek, parseDate } from './dateUtils';
import { gregorianDateFormat } from './monthLabel';

/**
 * Rekenkern van de eigen datumkiezer bij het gedeelde datumveld (#904): het maandraster, de toetsen in
 * dat raster en de teksten in de taal van de app. Puur en zonder React, zodat
 * `tests/planning/check-date-picker-month.ts` het headless vastlegt. Alle datums zijn `YYYY-MM-DD` op de
 * UTC-dag-as, net als de rest van `dateUtils`.
 */

export type WeekStartDay = 'monday' | 'sunday';

export interface DatePickerDay {
  iso: string;
  /** Dag van de maand (1–31). */
  day: number;
  /** Valt de dag in de getoonde maand (anders: aanloop of uitloop van de buurmaand). */
  inMonth: boolean;
  /** ISO-weekdag, 1 = maandag … 7 = zondag. */
  isoWeekday: number;
}

export interface DatePickerWeek {
  /** Weeknummer zoals de Gantt het toont (`getWeekNumberFor` met de ingestelde eerste weekdag). */
  weekNumber: number;
  days: DatePickerDay[];
}

/** Zes weken, altijd: dan verspringt het paneel niet in hoogte als je door de maanden bladert. */
const WEEKS = 6;

/** `{ year, month }` (maand 1–12) van een ISO-datum. */
export function monthOf(iso: string): { year: number; month: number } {
  const d = parseDate(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Maanden optellen; een dag die in de doelmaand niet bestaat wordt de laatste dag (31 jan + 1 = 28 feb). */
export function addMonthsClamped(iso: string, months: number): string {
  return formatDate(addCalendarMonths(parseDate(iso), months));
}

/** Het raster van een maand (maand 1–12), beginnend op de ingestelde eerste weekdag. */
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

/**
 * Waar een toets in het raster de actieve dag heen zet, of `null` als de toets geen verplaatsing is.
 * Pijlen: een dag of een week; in een taal van rechts naar links wijst pijl links naar de volgende dag
 * (het raster staat gespiegeld). Home/End: begin en einde van de week. PageUp/PageDown: een maand, met
 * Shift een jaar (de dag klemt op de maandlengte).
 */
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
  /** Kop van het paneel, bv. "november 2026". */
  monthTitle: (year: number, month: number) => string;
  /** Toegankelijke naam van een dag, bv. "woensdag 18 november 2026". */
  dayLabel: (iso: string) => string;
  /** Het dagnummer in de cel, altijd in Latijnse cijfers. */
  dayNumber: (iso: string) => string;
}

/**
 * Teksten van de kiezer in de taal van de app. Via `gregorianDateFormat`: vertaalde maand- en dagnamen,
 * maar altijd de Gregoriaanse kalender en Latijnse cijfers (in het Perzisch kiest Intl anders de
 * Solar-Hijri-kalender), en een onbekende taal valt terug op Engels.
 */
export function datePickerLabels(locale: string): DatePickerLabels {
  const title = gregorianDateFormat(locale, { month: 'long', year: 'numeric' });
  const full = gregorianDateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const num = gregorianDateFormat(locale, { day: 'numeric' });
  return {
    monthTitle: (year, month) => title.format(new Date(Date.UTC(year, month - 1, 1))),
    dayLabel: iso => full.format(parseDate(iso)),
    dayNumber: iso => num.format(parseDate(iso)),
  };
}
