import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';

export type P6NonWorkPenaltyDatesState = 'ABSENT' | 'VALID_EMPTY' | 'VALID_VALUES' | 'REJECTED';

export interface WorkCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  hoursPerDay: number;
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
  holidays: Holiday[];
  generation?: CalendarGeneration;
  workTime?: WorkTimeBands;
  ifcTimePeriods?: {
    start: number; end: number; startText: string; endText: string;
    binding: string;
    layout?: string;
    scalarStart?: number; scalarEnd?: number;
  }[];
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
  libraryOrigin?: LibraryOrigin;
  workingExceptions?: WorkingException[];
  p6Source?: 'XER';
  p6NonWorkPenaltyDates?: string[];
  p6NonWorkPenaltyDatesState?: P6NonWorkPenaltyDatesState;
}

export interface WorkingException {
  name: string;
  startDate: string;
  endDate: string;
  bands?: { start: number; end: number }[];
}

export interface WorkTimeBands {
  byWeekday: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>;
}

export interface CalendarGeneration {
  ruleSetId: HolidayCountry;
  region?: string;
  breakChoice?: 'noord' | 'midden' | 'zuid';
  generatedFromYear: number;
  generatedToYear: number;
}

export interface Holiday {
  name: string;
  startDate: string;
  endDate: string;
}

export function isHourModeCalendar(calendar: Pick<WorkCalendar, 'workTime'> | undefined): boolean {
  return !!calendar?.workTime;
}

export function holidayEndDate(holiday: Pick<Holiday, 'startDate' | 'endDate'>): string {
  return holiday.endDate || holiday.startDate;
}
