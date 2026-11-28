// Bron: MPXJ, © Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { canonicalizeBands, deriveHoursPerDay, promoteHourCalendars, registerCalendarBands, workDayFromBlocks } from '@/services/subdayIo';
import type { CfbFile } from './cfb';
import type { Props } from './mppContainer';
import { FixedData, FixedMeta, Var2Data, VarMeta12, getDate, getInt, getShort, getUnicodeString } from './mppPrimitives';
import { MAX_VAR_TEXT_BYTES, MAX_EXCEPTION_BAND_PERIODS } from './limits';
import {
  expandRecurrence, buildContributions, resolveContributions, mergeInherited, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS, MAX_BASE_CHAIN_DEPTH,
} from '@/services/calendarRecurrence';
import type { RecurrenceSpec, RecordContribution, RawException, ParsedExceptions, HolidayBudget } from '@/services/calendarRecurrence';

export {
  expandRecurrence, resolveContributions, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS, MAX_BASE_CHAIN_DEPTH,
};
export type { RecurrenceSpec, RecordContribution, ParsedExceptions, HolidayBudget };

const PROPS_KEY_DEFAULT_CALENDAR_NAME = 37748750;
const PROPS_KEY_DEFAULT_CALENDAR_HOURS = 37753736;

const CAL_FIXED_META_ITEM_SIZE = 10;
const CAL_FIXED_DATA_MAX_SIZE = 12;

const CALENDAR_NAME_VAR_TYPE = 1;
const CALENDAR_DATA_VAR_TYPE = 8;

const MAX_CALENDAR_TEXT_BYTES = MAX_VAR_TEXT_BYTES;

const MAX_DAY_HOUR_PERIODS = 5;

export const MAX_CALENDARS = 1_024;


interface DayResolution {
  working: boolean;
  bands: { start: number; end: number }[];
}

const STANDARD_DAY_HOURS_FALLBACK: ReadonlyArray<DayResolution> = [
  { working: false, bands: [] },
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] },
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] },
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] },
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] },
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] },
  { working: false, bands: [] },
];

function mppTimeToMinutes(raw: number): number {
  let minutes = Math.floor(raw / 10);
  if (minutes > 1439) minutes %= 1440;
  return minutes;
}

function resolveOneDay(data: Uint8Array, dayIndex: number, fallback: DayResolution, ctx: string): DayResolution {
  const offset = dayIndex * 60;
  if (data.length < offset + 4) return fallback;
  const defaultFlag = getShort(data, offset, ctx);
  if (defaultFlag === 1) return fallback;

  const rawPeriodCount = getShort(data, offset + 2, ctx);
  const periodCount = Math.min(Math.max(rawPeriodCount, 0), MAX_DAY_HOUR_PERIODS);
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 8 + i * 2;
    const durationOffset = offset + 20 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return { working: bands.length > 0, bands };
}

function resolveDays(data: Uint8Array | null, fallback: ReadonlyArray<DayResolution>, ctx: string): DayResolution[] {
  const result: DayResolution[] = [];
  for (let index = 0; index < 7; index++) {
    result.push(data ? resolveOneDay(data, index, fallback[index], ctx) : fallback[index]);
  }
  return result;
}

function buildCalendarFromDays(name: string, days: ReadonlyArray<DayResolution>, hoursPerDayOverride: number | null): WorkCalendar {
  const cal = createDefaultCalendar();
  cal.id = generateId('mppcal');
  delete cal.generation;
  cal.holidays = [];
  cal.description = '';
  cal.name = name;

  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const workDays: number[] = [];
  let scalarDay: ReadonlyArray<{ start: number; end: number }> | null = null;
  for (let index = 0; index < 7; index++) {
    const isoDay = (index === 0 ? 7 : index) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const d = days[index];
    if (d && d.working && d.bands.length > 0) {
      workDays.push(isoDay);
      rawByWeekday[isoDay] = d.bands;
      if (!scalarDay) scalarDay = d.bands;
    }
  }
  if (workDays.length > 0) cal.workDays = workDays.sort((a, b) => a - b);
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const blocked = scalarDay && scalarDay.length > 1 ? workDayFromBlocks(scalarDay) : undefined;
  if (blocked) {
    cal.workStartHour = blocked.startHour;
    cal.workEndHour = blocked.endHour;
    cal.hoursPerDay = deriveHoursPerDay(bands, blocked.netHours);
  } else if (scalarDay) {
    cal.workStartHour = Math.floor(scalarDay[0].start / 60);
    cal.workEndHour = Math.floor(scalarDay[0].end / 60);
    cal.hoursPerDay = cal.workEndHour - cal.workStartHour;
    if (cal.hoursPerDay <= 0) cal.hoursPerDay = 8;
  }
  if (hoursPerDayOverride !== null) cal.hoursPerDay = hoursPerDayOverride;

  registerCalendarBands(cal, { canonical: bands, deviates });
  return cal;
}

function getByteAt(data: Uint8Array, offset: number, ctx: string): number {
  if (offset < 0 || offset + 1 > data.length) {
    throw new Error(`MPP: getByte buiten grenzen (offset=${offset}, bufferlengte=${data.length}) [${ctx}]`);
  }
  return data[offset];
}

function readRecurringData(data: Uint8Array, offset: number, fromDate: Date, toDate: Date | null, ctx: string): RecurrenceSpec | null {
  const recurrenceTypeValue = getShort(data, offset + 72, ctx);
  const type = recurrenceTypeValue >= 0 && recurrenceTypeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[recurrenceTypeValue] : null;
  if (type === null) return null;
  const relative = recurrenceTypeValue < RELATIVE_MAP.length ? RELATIVE_MAP[recurrenceTypeValue] : false;
  const occurrences = getShort(data, offset + 4, ctx);

  let frequency = 1;
  let weeklyDayMask = 0;
  let dayNumber = 0;
  let dayOfWeekValue = 0;
  let monthNumber = 0;

  switch (type) {
    case 'DAILY':
      frequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      break;
    case 'WEEKLY':
      weeklyDayMask = getByteAt(data, offset + 76, ctx);
      frequency = getShort(data, offset + 78, ctx);
      break;
    case 'MONTHLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 77, ctx) - 2;
        dayNumber = getByteAt(data, offset + 76, ctx) + 1;
        frequency = getShort(data, offset + 78, ctx);
      } else {
        dayNumber = getByteAt(data, offset + 76, ctx);
        frequency = getByteAt(data, offset + 78, ctx);
      }
      break;
    case 'YEARLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 78, ctx) - 2;
        dayNumber = getByteAt(data, offset + 77, ctx) + 1;
      } else {
        dayNumber = getByteAt(data, offset + 77, ctx);
      }
      monthNumber = getByteAt(data, offset + 76, ctx) + 1;
      break;
  }

  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

function readExceptionBands(data: Uint8Array, offset: number, periodCountRaw: number, ctx: string): { start: number; end: number }[] {
  const periodCount = Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS);
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 20 + i * 2;
    const durationOffset = offset + 32 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return bands;
}

function readRawExceptions(data: Uint8Array, ctx: string): RawException[] {
  const out: RawException[] = [];
  if (data.length < 422) return out;
  const rawExceptionCount = getShort(data, 420, ctx);
  if (rawExceptionCount === 0) return out;
  const exceptionCount = Math.min(Math.max(rawExceptionCount, 0), MAX_CALENDAR_EXCEPTIONS);

  let offset = 424;
  for (let index = 0; index < exceptionCount; index++) {
    if (offset + 92 > data.length) break;

    const fromDate = getDate(data, offset, ctx);
    const toDate = getDate(data, offset + 2, ctx);
    const periodCountRaw = getShort(data, offset + 14, ctx);
    const recurrenceTypeValue = getShort(data, offset + 72, ctx);

    let exceptionNameLength = getInt(data, offset + 88, ctx);
    if (exceptionNameLength % 4 !== 0) exceptionNameLength = (Math.floor(exceptionNameLength / 4) + 1) * 4;
    exceptionNameLength = Math.max(0, Math.min(exceptionNameLength, MAX_CALENDAR_TEXT_BYTES));

    if (fromDate) {
      const isDaily = recurrenceTypeValue === 1 || recurrenceTypeValue === 7;
      const rawFrequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      const isFlattenedNonRecurring = recurrenceTypeValue === 0 || (isDaily && rawFrequency === 1);

      let recurring: RecurrenceSpec | null = null;
      let contributesNothing = false;
      if (!isFlattenedNonRecurring) {
        recurring = readRecurringData(data, offset, fromDate, toDate, ctx);
        contributesNothing = recurring === null;
      }

      if (!contributesNothing) {
        const bands = readExceptionBands(data, offset, periodCountRaw, ctx);
        let name = '';
        if (exceptionNameLength > 0 && data.length >= offset + 92 + exceptionNameLength) {
          const decoded = getUnicodeString(data, offset + 92, exceptionNameLength, ctx);
          if (decoded) name = decoded;
        }
        out.push({
          fromDate,
          toDate,
          periodCount: Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS),
          bands,
          name,
          recurring,
        });
      }
    }
    offset += 92 + exceptionNameLength;
  }
  return out;
}

export function parseExceptions(data: Uint8Array, ctx: string, budget: HolidayBudget): ParsedExceptions {
  return resolveContributions(buildContributions(readRawExceptions(data, ctx), budget), budget);
}

interface RawCalendarEntry {
  calendarUniqueId: number;
  baseCalendarUniqueId: number;
  resourceUniqueId: number;
}

export interface CalendarReadResult {
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>;
  fileHoursPerDay?: { calendar: WorkCalendar; hoursPerDay: number };
  projectCalendar: WorkCalendar;
  resourceCalendars: WorkCalendar[];
  resourceCalendarUniqueIdByResourceUniqueId: ReadonlyMap<number, number>;
  ownHolidayCountByUniqueId: ReadonlyMap<number, number>;
}

function fallbackResult(): CalendarReadResult {
  return {
    calendarByUniqueId: new Map(),
    projectCalendar: createDefaultCalendar(),
    resourceCalendars: [],
    resourceCalendarUniqueIdByResourceUniqueId: new Map(),
    ownHolidayCountByUniqueId: new Map(),
  };
}

export function readCalendars(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null = null,
): CalendarReadResult {
  try {
    return readCalendarsUnsafe(cfb, projectProps, applicationVersion, hoursPerDayOverride);
  } catch {
    return fallbackResult();
  }
}

function readCalendarsUnsafe(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null,
): CalendarReadResult {
  const label = '"   114"/TBkndCal';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'VarMeta']);
  const var2DataBytes = cfb.getStream(['   114', 'TBkndCal', 'Var2Data']);

  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    return fallbackResult();
  }

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, CAL_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, CAL_FIXED_DATA_MAX_SIZE, 0, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  const useModernOffsets = (applicationVersion ?? 0) > 14;
  const calendarIdOffset = useModernOffsets ? 8 : 0;
  const baseIdOffset = useModernOffsets ? 0 : 4;
  const resourceIdOffset = useModernOffsets ? 4 : 8;

  const rawByUniqueId = new Map<number, RawCalendarEntry>();
  const itemCount = fixedData.getItemCount();
  for (let index = 0; index < itemCount && rawByUniqueId.size < MAX_CALENDARS; index++) {
    const item = fixedData.getByteArrayValue(index);
    if (!item || item.length < 12) continue;
    const calendarUniqueId = getInt(item, calendarIdOffset, `${label}/FixedData calendarId`);
    if (calendarUniqueId <= 0 || rawByUniqueId.has(calendarUniqueId)) continue;
    const baseCalendarUniqueId = getInt(item, baseIdOffset, `${label}/FixedData baseId`);
    const resourceUniqueId = getInt(item, resourceIdOffset, `${label}/FixedData resourceId`);
    rawByUniqueId.set(calendarUniqueId, { calendarUniqueId, baseCalendarUniqueId, resourceUniqueId });
  }
  if (rawByUniqueId.size === 0) return fallbackResult();

  const defaultCalendarHoursBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_HOURS);
  const projectDefaultDays = resolveDays(defaultCalendarHoursBytes, STANDARD_DAY_HOURS_FALLBACK, `${label}/defaultCalendarHours`);

  const calendarByUniqueId = new Map<number, WorkCalendar>();
  const daysByUniqueId = new Map<number, DayResolution[]>();
  const resourceCalendarUniqueIdByResourceUniqueId = new Map<number, number>();
  const ownHolidayCountByUniqueId = new Map<number, number>();
  const baseCalendarUniqueIds = new Set<number>();
  const holidayBudget = newHolidayBudget();

  const nameCache = new Map<number, string | null>();
  const nameOf = (uid: number): string | null => {
    if (nameCache.has(uid)) return nameCache.get(uid) ?? null;
    const name = varData.getUnicodeString(uid, CALENDAR_NAME_VAR_TYPE, MAX_CALENDAR_TEXT_BYTES, `${label}/name[uid=${uid}]`);
    nameCache.set(uid, name);
    return name;
  };
  const nameOfOrFallback = (uid: number): string => nameOf(uid) ?? `Kalender ${uid}`;

  const linkBaseResource = (rec: RawCalendarEntry): void => {
    if (rec.resourceUniqueId > 0 && !resourceCalendarUniqueIdByResourceUniqueId.has(rec.resourceUniqueId)) {
      resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
    }
  };
  const linkDerivedResource = (rec: RawCalendarEntry): void => {
    resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
  };

  const defaultNameBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_NAME);
  const defaultName = defaultNameBytes
    ? getUnicodeString(defaultNameBytes, 0, MAX_CALENDAR_TEXT_BYTES, `${label}/defaultCalendarName`)
    : null;
  let projectCalendarUid: number | null = null;
  if (defaultName) {
    for (const uid of rawByUniqueId.keys()) {
      if (nameOf(uid) === defaultName) {
        projectCalendarUid = uid;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    for (const rec of rawByUniqueId.values()) {
      if (rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId) {
        projectCalendarUid = rec.calendarUniqueId;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    projectCalendarUid = rawByUniqueId.keys().next().value ?? null;
  }
  const overrideFor = (uid: number): number | null => (uid === projectCalendarUid ? hoursPerDayOverride : null);

  for (const rec of rawByUniqueId.values()) {
    if (!(rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId)) continue;
    baseCalendarUniqueIds.add(rec.calendarUniqueId);

    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const effectiveData = ownData ?? defaultCalendarHoursBytes;
    const days = ownData ? resolveDays(ownData, projectDefaultDays, `${label}/hours[uid=${rec.calendarUniqueId}]`) : projectDefaultDays;
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    const parsed: ParsedExceptions = effectiveData
      ? parseExceptions(effectiveData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`, holidayBudget)
      : { holidays: [], workingExceptions: [] };
    cal.holidays = parsed.holidays;
    if (parsed.workingExceptions.length > 0) cal.workingExceptions = parsed.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, cal.holidays.length);
    linkBaseResource(rec);
  }

  const materializeDerived = (rec: RawCalendarEntry, fallbackDays: DayResolution[], baseCal: WorkCalendar | null): void => {
    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const days = resolveDays(ownData, fallbackDays, `${label}/hours[uid=${rec.calendarUniqueId}]`);
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    const ownRaw = ownData ? readRawExceptions(ownData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`) : [];
    const ownContributions = buildContributions(ownRaw, holidayBudget);
    const ownParsed = resolveContributions(ownContributions, newHolidayBudget());
    const baseParsed: ParsedExceptions = baseCal
      ? { holidays: baseCal.holidays, workingExceptions: baseCal.workingExceptions ?? [] }
      : { holidays: [], workingExceptions: [] };
    const merged = baseCal ? mergeInherited(baseParsed, ownContributions, holidayBudget) : resolveContributions(ownContributions, holidayBudget);
    cal.holidays = merged.holidays;
    if (merged.workingExceptions.length > 0) cal.workingExceptions = merged.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, ownParsed.holidays.length);
    linkDerivedResource(rec);
  };

  const pending = new Map<number, RawCalendarEntry>();
  for (const rec of rawByUniqueId.values()) {
    if (!baseCalendarUniqueIds.has(rec.calendarUniqueId)) pending.set(rec.calendarUniqueId, rec);
  }
  for (let pass = 0; pass < MAX_BASE_CHAIN_DEPTH && pending.size > 0; pass++) {
    let progressed = false;
    for (const [uid, rec] of Array.from(pending)) {
      const baseDays = daysByUniqueId.get(rec.baseCalendarUniqueId);
      if (!baseDays) continue;
      materializeDerived(rec, baseDays, calendarByUniqueId.get(rec.baseCalendarUniqueId) ?? null);
      pending.delete(uid);
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const rec of pending.values()) materializeDerived(rec, projectDefaultDays, null);

  const projectCalendar = (projectCalendarUid !== null ? calendarByUniqueId.get(projectCalendarUid) : undefined)
    ?? calendarByUniqueId.values().next().value;
  if (!projectCalendar) return fallbackResult();

  const resourceCalendars: WorkCalendar[] = [];
  for (const cal of calendarByUniqueId.values()) {
    if (cal !== projectCalendar) resourceCalendars.push(cal);
  }

  const overriddenCalendar = projectCalendarUid !== null ? calendarByUniqueId.get(projectCalendarUid) : undefined;
  return {
    calendarByUniqueId,
    ...(overriddenCalendar && hoursPerDayOverride !== null
      ? { fileHoursPerDay: { calendar: overriddenCalendar, hoursPerDay: hoursPerDayOverride } }
      : {}),
    projectCalendar,
    resourceCalendars,
    resourceCalendarUniqueIdByResourceUniqueId,
    ownHolidayCountByUniqueId,
  };
}

export function promoteCalendarsForHourMode(
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>,
  signaledCalendars: ReadonlySet<WorkCalendar>,
  fileHoursPerDay?: CalendarReadResult['fileHoursPerDay'],
): Set<WorkCalendar> {
  const promoted = promoteHourCalendars(
    [...calendarByUniqueId.values()].map(cal => [cal, cal] as const), cal => signaledCalendars.has(cal), false,
  );
  if (fileHoursPerDay) fileHoursPerDay.calendar.hoursPerDay = fileHoursPerDay.hoursPerDay;
  return promoted;
}
