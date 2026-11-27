import type { CalendarGeneration, Holiday, WorkCalendar, WorkingException, WorkTimeBands } from '@/types/calendar';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import {
  arrayOf, CALENDAR_DATE, enumOf, integer, membersOf, NON_EMPTY_TEXT, objectOf, REAL, TEXT, type IfcxField, type IfcxValue, type SharedField,
} from '../fieldTable';
import { CALENDAR_SOURCE_FIELDS, CALENDAR_SOURCE_KEYS_CARRIED } from './calendarSourceFields';

export interface CalendarWriteSource {
  readonly calendar: WorkCalendar;
  readonly isProjectCalendar: boolean;
  readonly path: string;
}

export interface CalendarReadTarget {
  readonly calendar: WorkCalendar;
  readonly isProjectCalendar: boolean;
  readonly path: string;
}

type CalendarField = IfcxField<CalendarWriteSource, CalendarReadTarget>;

export function derivedCalendarId(path: string, isProjectCalendar: boolean): string {
  return isProjectCalendar ? DEFAULT_CALENDAR_ID : path;
}

const SHIFT_TO_IFC = { FIRST: 'FIRSTSHIFT', SECOND: 'SECONDSHIFT', THIRD: 'THIRDSHIFT', USERDEFINED: 'USERDEFINED' } as const;
type Shift = keyof typeof SHIFT_TO_IFC;

const BAND: IfcxValue = objectOf({ start: { value: REAL }, end: { value: REAL } });
const BANDS: IfcxValue = arrayOf(BAND);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const HOLIDAYS: IfcxValue = arrayOf(objectOf({ name: { value: TEXT }, start: { value: CALENDAR_DATE }, end: { value: CALENDAR_DATE, optional: true } }));
const GENERATION_RULE_SETS_1_0 = [
  'NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'US', 'BO', 'ES', 'IT', 'PL', 'PT', 'CZ', 'SE', 'DK', 'NO', 'FI',
] as const satisfies readonly CalendarGeneration['ruleSetId'][];

function generationValue(ruleSets: readonly CalendarGeneration['ruleSetId'][]): IfcxValue {
  return objectOf({
    ruleSetId: { value: enumOf(ruleSets) },
    region: { value: TEXT, optional: true },
    breakChoice: { value: enumOf(['noord', 'midden', 'zuid']), optional: true },
    generatedFromYear: { value: integer(1000, 9999) },
    generatedToYear: { value: integer(1000, 9999) },
  });
}

type Band = { start: number; end: number };
const bandsOut = (bands: readonly Band[]) => bands.map(band => ({ start: band.start, end: band.end }));

function holidaysOut(holidays: readonly Holiday[]) {
  return holidays.map(holiday => ({ name: holiday.name, start: holiday.startDate, ...(holiday.endDate ? { end: holiday.endDate } : {}) }));
}

function holidaysIn(value: readonly { name: string; start: string; end?: string }[]): Holiday[] {
  return value.map(item => ({ name: item.name, startDate: item.start, endDate: item.end ?? '' }));
}

function workTimeOut(workTime: WorkTimeBands) {
  return { byWeekday: Object.fromEntries(WEEKDAYS.map(day => [String(day), bandsOut(workTime.byWeekday[day] ?? [])])) };
}

function workTimeIn(value: { byWeekday: Record<string, Band[]> }): WorkTimeBands {
  const byWeekday = {} as WorkTimeBands['byWeekday'];
  for (const day of WEEKDAYS) byWeekday[day] = value.byWeekday[String(day)].map(band => ({ start: band.start, end: band.end }));
  return { byWeekday };
}

function workingExceptionsOut(exceptions: readonly WorkingException[]) {
  return exceptions.map(item => ({
    name: item.name, startDate: item.startDate, endDate: item.endDate, ...(item.bands ? { bands: bandsOut(item.bands) } : {}),
  }));
}

function workingExceptionsIn(value: readonly WorkingException[]): WorkingException[] {
  return value.map(item => ({
    name: item.name, startDate: item.startDate, endDate: item.endDate, ...(item.bands ? { bands: bandsOut(item.bands) } : {}),
  }));
}

function generationOut(generation: CalendarGeneration) {
  return {
    ruleSetId: generation.ruleSetId,
    ...(generation.region !== undefined ? { region: generation.region } : {}),
    ...(generation.breakChoice !== undefined ? { breakChoice: generation.breakChoice } : {}),
    generatedFromYear: generation.generatedFromYear,
    generatedToYear: generation.generatedToYear,
  };
}

function setOptional<K extends keyof WorkCalendar>(calendar: WorkCalendar, key: K, value: WorkCalendar[K] | undefined): void {
  if (value !== undefined) calendar[key] = value;
}

export const CALENDAR_SHARED_FIELDS: readonly SharedField<CalendarWriteSource>[] = [
  { key: 'name', value: TEXT, write: s => s.calendar.name },
  { key: 'description', value: TEXT, optional: true, write: s => s.calendar.description || undefined },
  {
    key: 'predefinedType', value: enumOf(Object.values(SHIFT_TO_IFC)), optional: true,
    write: s => (s.calendar.shift ? SHIFT_TO_IFC[s.calendar.shift] : undefined),
  },
  { key: 'exceptionTimes', optional: true, value: HOLIDAYS, write: s => (s.calendar.holidays.length ? holidaysOut(s.calendar.holidays) : undefined) },
];

export const CALENDAR_FIELDS: readonly CalendarField[] = [
  {
    key: 'id', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.calendar.id !== derivedCalendarId(s.path, s.isProjectCalendar) ? s.calendar.id : undefined),
    read: (v, t) => { t.calendar.id = (v as string | undefined) ?? derivedCalendarId(t.path, t.isProjectCalendar); },
  },
  {
    key: 'name', value: TEXT,
    write: s => s.calendar.name,
    read: (v, t) => { t.calendar.name = v as string; },
  },
  {
    key: 'description', value: TEXT, optional: true,
    write: s => s.calendar.description || undefined,
    read: (v, t) => { t.calendar.description = (v as string | undefined) ?? ''; },
  },
  {
    key: 'shift', value: enumOf(Object.keys(SHIFT_TO_IFC)), optional: true,
    write: s => s.calendar.shift,
    read: (v, t) => setOptional(t.calendar, 'shift', v as Shift | undefined),
  },
  {
    key: 'holidays', optional: true, value: HOLIDAYS,
    write: s => (s.calendar.holidays.length ? holidaysOut(s.calendar.holidays) : undefined),
    read: (v, t) => { t.calendar.holidays = v ? holidaysIn(v as { name: string; start: string; end?: string }[]) : []; },
  },
  {
    key: 'workDays', value: arrayOf(integer(1, 7)),
    write: s => [...s.calendar.workDays],
    read: (v, t) => { t.calendar.workDays = [...(v as number[])]; },
  },
  {
    key: 'workStartHour', value: REAL,
    write: s => s.calendar.workStartHour,
    read: (v, t) => { t.calendar.workStartHour = v as number; },
  },
  {
    key: 'workEndHour', value: REAL,
    write: s => s.calendar.workEndHour,
    read: (v, t) => { t.calendar.workEndHour = v as number; },
  },
  {
    key: 'hoursPerDay', value: REAL,
    write: s => s.calendar.hoursPerDay,
    read: (v, t) => { t.calendar.hoursPerDay = v as number; },
  },
  {
    key: 'simpleBreakStartMinute', value: REAL, optional: true,
    write: s => s.calendar.simpleBreakStartMinute,
    read: (v, t) => setOptional(t.calendar, 'simpleBreakStartMinute', v as number | undefined),
  },
  {
    key: 'simpleBreakDurationMinutes', value: REAL, optional: true,
    write: s => s.calendar.simpleBreakDurationMinutes,
    read: (v, t) => setOptional(t.calendar, 'simpleBreakDurationMinutes', v as number | undefined),
  },
  {
    key: 'workTime', optional: true,
    value: objectOf({ byWeekday: { value: objectOf(Object.fromEntries(WEEKDAYS.map(day => [String(day), { value: BANDS }]))) } }),
    write: s => (s.calendar.workTime ? workTimeOut(s.calendar.workTime) : undefined),
    read: (v, t) => setOptional(t.calendar, 'workTime', v ? workTimeIn(v as { byWeekday: Record<string, Band[]> }) : undefined),
  },
  {
    key: 'workingExceptions', optional: true,
    value: arrayOf(objectOf({
      name: { value: TEXT }, startDate: { value: CALENDAR_DATE }, endDate: { value: CALENDAR_DATE }, bands: { value: BANDS, optional: true },
    })),
    write: s => (s.calendar.workingExceptions ? workingExceptionsOut(s.calendar.workingExceptions) : undefined),
    read: (v, t) => setOptional(t.calendar, 'workingExceptions', v ? workingExceptionsIn(v as WorkingException[]) : undefined),
  },
  {
    key: 'generation', optional: true,
    value: generationValue([...GENERATION_RULE_SETS_1_0, 'CA']),
    write: s => (s.calendar.generation ? generationOut(s.calendar.generation) : undefined),
    read: (v, t) => setOptional(t.calendar, 'generation', v ? generationOut(v as CalendarGeneration) as CalendarGeneration : undefined),
  },
  ...CALENDAR_SOURCE_FIELDS,
];

export const CALENDAR_VALUE_1_0 = objectOf({
  ...membersOf(CALENDAR_FIELDS),
  generation: { value: generationValue(GENERATION_RULE_SETS_1_0), optional: true },
});

export const CALENDAR_KEYS_CARRIED: readonly (keyof WorkCalendar)[] = [
  'id', 'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'simpleBreakStartMinute', 'simpleBreakDurationMinutes', 'holidays', 'generation', 'workTime', 'workingExceptions', 'shift',
  ...CALENDAR_SOURCE_KEYS_CARRIED,
];

export function emptyCalendar(): WorkCalendar {
  return { id: '', name: '', description: '', workDays: [], workStartHour: 0, workEndHour: 0, hoursPerDay: 0, holidays: [] };
}
