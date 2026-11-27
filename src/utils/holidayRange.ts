import { holidayEndDate, type Holiday, type WorkCalendar } from '@/types/calendar';

export const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type HolidayIssue = 'invalidStart' | 'invalidEnd' | 'endBeforeStart';

export function holidayIssue(holiday: Pick<Holiday, 'startDate' | 'endDate'>): HolidayIssue | undefined {
  if (!ISO_DATE_ONLY.test(holiday.startDate)) return 'invalidStart';
  const end = holidayEndDate(holiday);
  if (!ISO_DATE_ONLY.test(end)) return 'invalidEnd';
  if (end < holiday.startDate) return 'endBeforeStart';
  return undefined;
}

export function calendarHasHolidayIssue(calendar: Pick<WorkCalendar, 'holidays'>): boolean {
  return calendar.holidays.some((holiday) => holidayIssue(holiday) !== undefined);
}

export function withCanonicalHolidayEnds<T extends Pick<WorkCalendar, 'holidays'>>(calendar: T): T {
  return {
    ...calendar,
    holidays: calendar.holidays.map((holiday) => ({ ...holiday, endDate: holidayEndDate(holiday) })),
  };
}
