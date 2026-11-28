import type { Sequence, SequenceType } from '@/types/sequence';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import {
  ELAPSED_MINUTES_PER_DAY, dayMeasureMinutes, dayMeasureRecord, exactMinutesRecord, isWholeDays, parseDayMeasureRecord, roundDays,
} from '@/services/ifc/dayMeasureIo';

export const OPS_DAY_MEASURE_DURATIONS_NAME = 'OPS_DayMeasureDurations';
export const OPS_EXACT_MINUTES_NAME = 'OPS_ExactMinutes';
export const OPS_DAY_MEASURE_LAGS_NAME = 'OPS_DayMeasureLags';
export const OPS_LAG_CALENDAR_NAME = 'OPS_LagCalendar';

export type LagCalendarOption = NonNullable<NonNullable<Project['schedulingOptions']>['lagCalendar']>;
const LAG_CALENDAR_OPTIONS: readonly LagCalendarOption[] = ['predecessor', 'successor', 'projectDefault', '24hour'];

export function parseLagCalendarOption(raw: string | undefined): LagCalendarOption | undefined {
  const value = raw?.trim();
  return LAG_CALENDAR_OPTIONS.find(option => option === value);
}

export interface DurationFieldNames { duration: string; remaining: string }

export type ElapsedUnit = 'ed' | 'eu';

export type FieldRecord = readonly [value: number, minutes: number] | readonly [value: number, minutes: number, unit: ElapsedUnit];

export type FieldRecords = Record<string, FieldRecord>;

export interface WrittenAmount { minutes: number; record?: FieldRecord }

export function writeDays(days: number, minutesPerDay: number): WrittenAmount {
  const record = dayMeasureRecord(days, minutesPerDay);
  return isWholeDays(days) ? { minutes: record[1] } : { minutes: record[1], record };
}

export function writeMinutes(minutes: number): WrittenAmount {
  const record = exactMinutesRecord(minutes);
  return record ? { minutes: record[1], record } : { minutes: Math.round(minutes) };
}

export function withElapsedUnit(written: WrittenAmount, value: number, unit: ElapsedUnit): WrittenAmount {
  const days = written.record?.[0] ?? roundDays(value);
  return { minutes: written.minutes, record: [unit === 'ed' ? days : value, written.minutes, unit] };
}

export function dayMeasureMinutesPerDay(calendar: WorkCalendar, elapsed: boolean): number {
  return elapsed ? ELAPSED_MINUTES_PER_DAY : effHoursPerDay(calendar) * 60;
}

export function lagWorkMinutesPerDay(
  seq: Pick<Sequence, 'predecessorId' | 'successorId'>,
  lagCalendar: NonNullable<Project['schedulingOptions']>['lagCalendar'],
  projectCalendar: WorkCalendar,
  effCalByTask: ReadonlyMap<string, WorkCalendar>,
): number {
  if (lagCalendar === '24hour') return ELAPSED_MINUTES_PER_DAY;
  const cal = lagCalendar === 'projectDefault' ? projectCalendar
    : lagCalendar === 'successor' ? effCalByTask.get(seq.successorId) ?? projectCalendar
    : effCalByTask.get(seq.predecessorId) ?? projectCalendar;
  return effHoursPerDay(cal) * 60;
}

export type LagRecord = FieldRecord;

const LINK_TYPE_TOKEN: Record<SequenceType, string> = {
  FINISH_START: 'FS', START_START: 'SS', FINISH_FINISH: 'FF', START_FINISH: 'SF',
};

export function lagRecordKey(predecessor: string | number, type: SequenceType): string {
  return `${predecessor}:${LINK_TYPE_TOKEN[type]}`;
}

export class LagRecordCollector {
  private readonly bySuccessor = new Map<string, Map<string, LagRecord | null>>();

  add(successorId: string, key: string, record: LagRecord | undefined): void {
    let map = this.bySuccessor.get(successorId);
    if (!map) {
      map = new Map();
      this.bySuccessor.set(successorId, map);
    }
    map.set(key, map.has(key) ? null : record ?? null);
  }

  json(successorId: string): string | undefined {
    const entries = [...(this.bySuccessor.get(successorId) ?? [])].filter((e): e is [string, LagRecord] => e[1] !== null);
    return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : undefined;
  }
}

export function fieldRecordsJson(records: Partial<FieldRecords>): string | undefined {
  const entries = Object.entries(records).filter((e): e is [string, FieldRecord] => e[1] !== undefined);
  return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : undefined;
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function parseFieldRecord(value: unknown): FieldRecord | undefined {
  if (!Array.isArray(value)) return undefined;
  const base = parseDayMeasureRecord(value.slice(0, 2));
  if (!base || value.length < 2) return undefined;
  if (value.length === 2) return base;
  return value.length === 3 && (value[2] === 'ed' || value[2] === 'eu') ? [base[0], base[1], value[2]] : undefined;
}

export function parseFieldRecords(raw: string | undefined, names: DurationFieldNames): { duration?: FieldRecord; remaining?: FieldRecord } {
  const obj = parseJsonObject(raw);
  if (!obj) return {};
  const duration = parseFieldRecord(obj[names.duration]);
  const remaining = parseFieldRecord(obj[names.remaining]);
  return { ...(duration ? { duration } : {}), ...(remaining ? { remaining } : {}) };
}

export function parseLagRecords(raw: string | undefined): Map<string, LagRecord> {
  const out = new Map<string, LagRecord>();
  const obj = parseJsonObject(raw);
  if (!obj) return out;
  for (const [key, value] of Object.entries(obj)) {
    const record = key ? parseFieldRecord(value) : undefined;
    if (record) out.set(key, record);
  }
  return out;
}

export function recordHolds<R extends readonly [number, number, ...unknown[]]>(record: R | undefined, standardMinutes: number | null | undefined): record is R {
  return record !== undefined && standardMinutes != null && Number.isFinite(standardMinutes)
    && Math.round(standardMinutes) === record[1];
}

const isElapsedUnit = (record: FieldRecord | undefined, unit: ElapsedUnit): boolean =>
  record !== undefined && record.length === 3 && record[2] === unit;

export function dayRecordFits(record: FieldRecord, minutesPerDay: number): boolean {
  if (isElapsedUnit(record, 'eu')) return minuteRecordFits(record);
  return minutesPerDay > 0 && dayMeasureMinutes(record[0], minutesPerDay) === record[1];
}

export function minuteRecordFits(record: FieldRecord): boolean {
  return Math.round(record[0]) === record[1];
}

export function lagRecordHolds(record: LagRecord | undefined, standardMinutes: number, lagMinutesPerDay: number): record is LagRecord {
  return recordHolds(record, standardMinutes) && dayRecordFits(record, lagMinutesPerDay);
}

export interface ReadMeasure {
  durationUnit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
  remainingTime?: number;
  remainingMinutes?: number;
  durationType?: 'ELAPSEDTIME';
}

export function readMeasure(input: {
  unit: 'days' | 'hours';
  durationMinutes: number;
  durationDays?: number;
  remainingMinutes: number | undefined;
  remainingDays?: number;
  minutesPerDay: number;
  calendar: WorkCalendar;
  dayRecords: { duration?: FieldRecord; remaining?: FieldRecord };
  exactRecords: { duration?: FieldRecord; remaining?: FieldRecord };
  keepSourceMinutes?: boolean;
}): ReadMeasure {
  const { durationMinutes, remainingMinutes, minutesPerDay, calendar } = input;
  const sourceMinutes = (minutes: number) => (input.keepSourceMinutes ? minutes : Math.round(minutes));
  const perDay = (minutes: number) => (minutesPerDay > 0 ? minutes / minutesPerDay : 0);
  const hours = (exact: { duration?: FieldRecord; remaining?: FieldRecord }): ReadMeasure => {
    const durationRecord = exact.duration;
    const durationHolds = recordHolds(durationRecord, durationMinutes) && minuteRecordFits(durationRecord);
    const minutes = durationHolds ? durationRecord[0] : sourceMinutes(durationMinutes);
    const restRecord = exact.remaining;
    const rest = remainingMinutes === undefined ? undefined
      : recordHolds(restRecord, remainingMinutes) && minuteRecordFits(restRecord) ? restRecord[0] : sourceMinutes(remainingMinutes);
    return {
      durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hourTaskScheduleDuration(minutes, calendar),
      ...(rest !== undefined ? { remainingMinutes: rest } : {}),
      ...(durationHolds && isElapsedUnit(durationRecord, 'eu') ? { durationType: 'ELAPSEDTIME' as const } : {}),
    };
  };
  if (input.unit === 'hours') return hours(input.exactRecords);
  const durationRecord = input.dayRecords.duration;
  const restRecord = input.dayRecords.remaining;
  const contextLost = [durationRecord, restRecord].some(record => record !== undefined && !dayRecordFits(record, minutesPerDay));
  if (contextLost || (durationRecord && !recordHolds(durationRecord, durationMinutes))) {
    return hours({});
  }
  const days = durationRecord ? durationRecord[0] : input.durationDays ?? perDay(durationMinutes);
  const remainingTime = remainingMinutes === undefined ? undefined
    : recordHolds(restRecord, remainingMinutes) ? restRecord[0] : input.remainingDays ?? perDay(remainingMinutes);
  return {
    durationUnit: 'days', scheduleDuration: days, ...(remainingTime !== undefined ? { remainingTime } : {}),
    ...(isElapsedUnit(durationRecord, 'ed') ? { durationType: 'ELAPSEDTIME' as const } : {}),
  };
}

export function lagFromRecord(record: LagRecord): Pick<Sequence, 'lagDays' | 'lagMinutes' | 'lagUnit'> {
  if (record.length === 3 && record[2] === 'eu') return { lagDays: 0, lagMinutes: record[0], lagUnit: 'ELAPSEDTIME' };
  if (record.length === 3 && record[2] === 'ed') return { lagDays: record[0], lagUnit: 'ELAPSEDTIME' };
  return { lagDays: record[0] };
}
