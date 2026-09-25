import { holidayEndDate, type Holiday, type WorkCalendar } from '@/types/calendar';

/** ISO-datum zonder tijd (JJJJ-MM-DD): de opslagvorm van `Holiday.startDate`/`endDate`. */
export const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type HolidayIssue = 'invalidStart' | 'invalidEnd' | 'endBeforeStart';

/**
 * Telt deze feestdagregel mee in de planning? Eén definitie voor de kalenderdialogen (`CalendarForm`
 * markeert de regel, `CalendarDialog`/`ResourceCalendarDialog` blokkeren Toepassen) en voor MCP
 * (`holidayListReason` in calendarResourceTools.ts). De engine (`CalendarEngine`) loopt van begin tot
 * eind; een regel zonder geldige begindatum of met een einde vóór het begin telt daar stil als nul
 * dagen, terwijl hij in de lijst gewoon zichtbaar blijft.
 *
 * Een LEGE einddatum is bewust geldig: de dialogen maken er bij opslaan een eendaagse feestdag van
 * (`holidayEndDate`, zie `withCanonicalHolidayEnds`). MCP eist in zijn leesvorm wel een expliciete
 * einddatum; die vormeis staat daar apart.
 */
export function holidayIssue(holiday: Pick<Holiday, 'startDate' | 'endDate'>): HolidayIssue | undefined {
  if (!ISO_DATE_ONLY.test(holiday.startDate)) return 'invalidStart';
  const end = holidayEndDate(holiday);
  if (!ISO_DATE_ONLY.test(end)) return 'invalidEnd';
  if (end < holiday.startDate) return 'endBeforeStart';
  return undefined;
}

/** Heeft deze (concept)kalender minstens één feestdagregel met een `holidayIssue`? */
export function calendarHasHolidayIssue(calendar: Pick<WorkCalendar, 'holidays'>): boolean {
  return calendar.holidays.some((holiday) => holidayIssue(holiday) !== undefined);
}

/**
 * De kalender zoals de dialogen hem opslaan: een lege einddatum wordt canoniek dezelfde dag als de
 * begindatum. Gedeeld door `CalendarDialog` en `ResourceCalendarDialog`, zodat beide dezelfde vorm
 * wegschrijven (MCP `update_calendar` weigert een lege `endDate`, dus anders is zo'n kalender niet
 * letterlijk terug te schrijven).
 */
export function withCanonicalHolidayEnds<T extends Pick<WorkCalendar, 'holidays'>>(calendar: T): T {
  return {
    ...calendar,
    holidays: calendar.holidays.map((holiday) => ({ ...holiday, endDate: holidayEndDate(holiday) })),
  };
}
