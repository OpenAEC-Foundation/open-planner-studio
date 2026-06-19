import { WorkCalendar } from '@/types/calendar';
import { parseDate, isoDayOfWeek, addCalendarDays, formatDate, diffCalendarDays } from '@/utils/dateUtils';

export class CalendarEngine {
  private calendar: WorkCalendar;
  private holidaySet: Set<string>;
  // Veiligheidsgrenzen tegen vastlopen bij een kapotte kalender (geen werkdagen)
  // of een ongeldige/sentinel-datum: MAX_SCAN = max dagen zoeken naar een werkdag;
  // MAX_DAYS = absolute iteratielimiet (~547 jaar) voor de tel-lussen.
  private static readonly MAX_SCAN = 366;
  private static readonly MAX_DAYS = 200_000;

  constructor(calendar: WorkCalendar) {
    this.calendar = calendar;
    this.holidaySet = new Set<string>();
    this.buildHolidaySet();
  }

  private buildHolidaySet(): void {
    for (const holiday of this.calendar.holidays) {
      const start = parseDate(holiday.startDate);
      const end = parseDate(holiday.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        const d = addCalendarDays(start, i);
        this.holidaySet.add(formatDate(d));
      }
    }
  }

  /** Check if a given date is a working day */
  isWorkDay(date: Date): boolean {
    const dayOfWeek = isoDayOfWeek(date);
    if (!this.calendar.workDays.includes(dayOfWeek)) return false;
    if (this.holidaySet.has(formatDate(date))) return false;
    return true;
  }

  /** Check if a given date string is a holiday */
  isHoliday(dateStr: string): boolean {
    return this.holidaySet.has(dateStr);
  }

  /**
   * Add working days to a start date.
   * Returns the end date (the last working day).
   * For duration=0 (milestone), returns the start date itself.
   */
  addWorkDays(startDate: Date, workDays: number): Date {
    if (workDays <= 0) return new Date(startDate.getTime());

    let current = new Date(startDate.getTime());
    // Ensure we start on a work day
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current; // geen werkdag — niet vastlopen
    }

    let remaining = workDays - 1; // first work day counts as day 1
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, 1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  /**
   * Calculate the number of working days between two dates (inclusive).
   */
  workDaysBetween(start: Date, end: Date): number {
    let count = 0;
    let current = new Date(start.getTime());
    let steps = 0;
    while (current <= end) {
      if (this.isWorkDay(current)) count++;
      current = addCalendarDays(current, 1);
      if (++steps > CalendarEngine.MAX_DAYS) break; // absurde spanne (sentinel/ongeldige datum)
    }
    return count;
  }

  /**
   * Get the next working day on or after the given date.
   */
  nextWorkDay(date: Date): Date {
    let current = new Date(date.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Get the next working day strictly after the given date.
   */
  nextWorkDayAfter(date: Date): Date {
    let current = addCalendarDays(date, 1);
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, 1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }
    return current;
  }

  /**
   * Subtract working days from an end date.
   * Returns the start date.
   */
  subtractWorkDays(endDate: Date, workDays: number): Date {
    if (workDays <= 0) return new Date(endDate.getTime());

    let current = new Date(endDate.getTime());
    let scan = 0;
    while (!this.isWorkDay(current)) {
      current = addCalendarDays(current, -1);
      if (++scan > CalendarEngine.MAX_SCAN) return current;
    }

    let remaining = workDays - 1;
    let steps = 0;
    while (remaining > 0) {
      current = addCalendarDays(current, -1);
      if (this.isWorkDay(current)) {
        remaining--;
      }
      if (++steps > CalendarEngine.MAX_DAYS) break;
    }
    return current;
  }

  get hoursPerDay(): number {
    return this.calendar.hoursPerDay;
  }
}
