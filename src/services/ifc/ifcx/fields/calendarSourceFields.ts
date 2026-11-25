import type { P6NonWorkPenaltyDatesState, WorkCalendar } from '@/types/calendar';
import type { LibraryOrigin } from '@/types/library';
import { arrayOf, CALENDAR_DATE, enumOf, objectOf, REAL, TEXT, type IfcxField, type IfcxMember, type IfcxValue } from '../fieldTable';
import { enumOfTable, optional, passthroughField, required } from './passthroughFields';
import type { CalendarReadTarget, CalendarWriteSource } from './calendarFields';

type CalendarField = IfcxField<CalendarWriteSource, CalendarReadTarget>;

const PENALTY_DATE_STATES = {
  ABSENT: true, VALID_EMPTY: true, VALID_VALUES: true, REJECTED: true,
} satisfies Record<P6NonWorkPenaltyDatesState, true>;

const LIBRARY_ORIGIN = objectOf({
  companyId: required(TEXT), libraryItemId: required(TEXT), poolVersion: required(REAL), syncedHash: optional(TEXT),
} satisfies Record<keyof LibraryOrigin, IfcxMember>);

function calendarField<K extends keyof WorkCalendar>(key: K, value: IfcxValue): CalendarField {
  return passthroughField<CalendarWriteSource, CalendarReadTarget, WorkCalendar[K]>(
    key, value, source => source.calendar[key], (target, stored) => { target.calendar[key] = stored; },
  );
}

export const CALENDAR_SOURCE_FIELDS: readonly CalendarField[] = [
  calendarField('p6Source', enumOf(['XER'])),
  calendarField('p6NonWorkPenaltyDates', arrayOf(CALENDAR_DATE)),
  calendarField('p6NonWorkPenaltyDatesState', enumOfTable(PENALTY_DATE_STATES)),
  calendarField('libraryOrigin', LIBRARY_ORIGIN),
];

export const CALENDAR_SOURCE_KEYS_CARRIED = CALENDAR_SOURCE_FIELDS.map(field => field.key as keyof WorkCalendar);
