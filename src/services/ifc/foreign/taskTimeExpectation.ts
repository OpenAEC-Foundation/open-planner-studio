import type { Task } from '@/types/task';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { DayClockCache, normalizeTaskDate, taskDateContext, type TaskDateField } from '@/state/migrations/minuteModel';
import { parseImportedInstant } from '@/services/importDates';
import { formatInstant, isStrictIsoDateTime } from '@/utils/dateUtils';
import type { TaskTimeReading } from '../ifcReader';
import type { WriteIFCInput } from '../ifcWriter';
import { IFC_TIME_ANCHOR } from '../ifcConstants';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT, type TaskTimeSlotKey, type WithheldTaskTimeField } from '../ifcTaskSlots';
import { dayMeasureMinutes, exactMinutesRecord, wholeFloatDays } from '../dayMeasureIo';
import { parseIfcDuration } from '../isoDuration';
import { sameNumber } from './lossCheck';

type DateKey = TaskTimeSlotKey & TaskDateField;
type Reading = TaskTimeReading['time'];
const DATE_FIELDS: ReadonlySet<TaskTimeSlotKey> = new Set<DateKey>([
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'actualStart', 'actualFinish',
]);
const STAMP = /^'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00'$/;
const QUOTED = /^'([^']*)'$/;
const STEP_REAL = /^[+-]?\d+\.\d*(?:E[+-]?\d+)?$/;
const DAY_CLOCK = IFC_TIME_ANCHOR.slice(0, 5);
const HOUR_DAY_CLOCK = '00:00';
const DAY_MEASURE_KEY = { scheduleDuration: 'ScheduleDuration', remainingTime: 'RemainingTime', actualDuration: 'ActualDuration' } as const;
const EXACT_MINUTES_KEY = { scheduleDuration: 'ScheduleDuration', remainingTime: 'RemainingTime' } as const;
const EXACT_FLOAT_KEY = { totalFloat: 'TotalFloat', freeFloat: 'FreeFloat' } as const;

function stamp(token: string): RegExpExecArray | null {
  const m = STAMP.exec(token);
  return m && isStrictIsoDateTime(`${m[1]}T${m[2]}:00`, { maxFractionDigits: 0 }) ? m : null;
}

function expectedWritten(key: TaskTimeSlotKey, task: Task, withheld: readonly string[], statusDate: string | undefined): boolean {
  const t = task.time;
  switch (key) {
    case 'durationType': case 'scheduleDuration': return true;
    case 'statusTime': return !!(t.actualStart || t.actualFinish) && !!statusDate;
    case 'actualDuration': return t.actualDuration != null;
    case 'remainingTime': return t.remainingTime != null || t.remainingMinutes != null;
    case 'completion': return Number.isFinite(t.completion) && t.completion > 0;
    default: {
      if (withheld.includes(key)) return false;
      const value: unknown = t[key as keyof typeof t];
      return typeof value === 'string' ? value !== '' : value !== undefined && value !== null;
    }
  }
}

function durationFacts(key: TaskTimeSlotKey, time: Reading, hours: boolean): readonly unknown[] {
  switch (key) {
    case 'scheduleDuration': return [time.scheduleDuration, hours, hours ? time.durationMinutes : undefined];
    case 'remainingTime': return [time.remainingTime, hours ? time.remainingMinutes : undefined];
    case 'freeFloat': return [time.freeFloat, time.freeFloatMinutes];
    case 'totalFloat': return [time.totalFloat, time.totalFloatMinutes];
    default: return [time.actualDuration];
  }
}

function slotMinutes(inner: string, minutesPerDay: number): number | null | undefined {
  let parsed: ReturnType<typeof parseIfcDuration>;
  try { parsed = parseIfcDuration(inner); } catch { return undefined; }
  const { days, timeMinutes } = parsed;
  return timeMinutes === null || days === 0 ? timeMinutes : timeMinutes + days * minutesPerDay;
}

function recordsCarried(key: TaskTimeSlotKey, inner: string, reading: TaskTimeReading): boolean {
  const minutes = slotMinutes(inner, reading.minutesPerDay);
  if (minutes === undefined) return false;
  const day = reading.records.dayMeasure?.[DAY_MEASURE_KEY[key as keyof typeof DAY_MEASURE_KEY]];
  if (day && (minutes !== day[1] || dayMeasureMinutes(day[0], reading.minutesPerDay) !== day[1])) return false;
  const exact = reading.records.exactMinutes?.[EXACT_MINUTES_KEY[key as keyof typeof EXACT_MINUTES_KEY]];
  if (exact && (minutes !== exact[1] || exactMinutesRecord(exact[0])?.[1] !== exact[1])) return false;
  const float = reading.records.exactFloat?.[EXACT_FLOAT_KEY[key as keyof typeof EXACT_FLOAT_KEY]];
  return !float || (minutes === null && parseIfcDuration(inner).days === wholeFloatDays(float[0]));
}

function statusTimeMatches(token: string, statusDate: string, task: Task): boolean {
  const m = stamp(token);
  if (!m) return false;
  if (!isDateOnly(statusDate)) return `${m[1]}T${m[2]}` === formatInstant(parseImportedInstant(statusDate), 'hour');
  return m[1] === statusDate && m[2] === (taskDurationUnit(task) === 'hours' ? HOUR_DAY_CLOCK : DAY_CLOCK);
}

export interface LiteralSourceSlots {
  readonly sourceTokens?: ReadonlyMap<string, string>;
  readonly emptySourceSlots?: Readonly<Record<string, readonly WithheldTaskTimeField[]>>;
}

export function taskTimeSlotProblem(snapshot: WriteIFCInput, readings: ReadonlyMap<string, TaskTimeReading>,
  milestonesAtDayEnd: ReadonlySet<string> | undefined, literal: LiteralSourceSlots): string | undefined {
  const clocks = new DayClockCache(snapshot.calendar, snapshot.resourceCalendars ?? []);
  const statusDate = snapshot.project.statusDate;
  for (const task of snapshot.tasks) {
    const reading = readings.get(task.id);
    if (!reading) return `taak ${task.id}: de uitvoer heeft geen taaktijd`;
    if (reading.args.length !== IFC_TASKTIME_SLOTS.length || reading.args.some(arg => !arg)) {
      return `taak ${task.id}: IFCTASKTIME #${reading.id} heeft ${reading.args.length} argumenten, niet elk expliciet, in plaats van ${IFC_TASKTIME_SLOTS.length}`;
    }
    const withheld: readonly string[] = [
      ...(snapshot.withheldTaskTimeFields?.[task.id] ?? []), ...(literal.emptySourceSlots?.[task.id] ?? []),
    ];
    const hours = taskDurationUnit(task) === 'hours';
    let context: ReturnType<typeof taskDateContext> | undefined;
    const instant = (value: unknown, field: DateKey) => {
      if (typeof value !== 'string') return value;
      context ??= taskDateContext(task, clocks, milestonesAtDayEnd);
      return normalizeTaskDate(value, field, context) ?? value;
    };
    const sameValue = (key: TaskTimeSlotKey, token: string): boolean => {
      const t = task.time;
      if (DATE_FIELDS.has(key)) {
        const m = stamp(token), read = reading.time[key as DateKey];
        if (!m || typeof read !== 'string' || (isDateOnly(read) && m[2] !== DAY_CLOCK)) return false;
        return instant(read, key as DateKey) === instant(t[key as DateKey], key as DateKey);
      }
      switch (key) {
        case 'durationType': return token === `.${t.durationType}.`;
        case 'isCritical': return token === (t.isCritical ? '.T.' : '.F.');
        case 'completion': return STEP_REAL.test(token) && sameNumber(token, String(t.completion));
        case 'statusTime': return statusTimeMatches(token, statusDate!, task);
        default: {
          const inner = QUOTED.exec(token)?.[1];
          if (inner === undefined || !recordsCarried(key, inner, reading)) return false;
          const want = durationFacts(key, t, hours), got = durationFacts(key, reading.time, reading.time.durationUnit === 'hours');
          return want.every((value, i) => Object.is(value, got[i]));
        }
      }
    };
    for (let k = TASKTIME_SLOT.durationType; k < IFC_TASKTIME_SLOTS.length; k++) {
      const key = IFC_TASKTIME_SLOTS[k].key, token = reading.args[k];
      const source = literal.sourceTokens?.get(`${reading.id}#${k}`);
      if (source !== undefined) {
        if (token === source) continue;
        return `taak ${task.id}.time, IFCTASKTIME argument ${k} (${key}): in de uitvoer ${token}, de bronwaarde ${source}`;
      }
      const expected = expectedWritten(key, task, withheld, statusDate);
      if ((token !== '$') === expected && (!expected || sameValue(key, token))) continue;
      const shown = key === 'statusTime' ? `de statusdatum ${statusDate}`
        : DATE_FIELDS.has(key) || key === 'durationType' || key === 'isCritical' || key === 'completion'
          ? `de planner zag ${JSON.stringify(task.time[key as keyof Task['time']])}`
          : `de planner zag ${JSON.stringify(durationFacts(key, task.time, hours))}`;
      return `taak ${task.id}.time, IFCTASKTIME argument ${k} (${key}): ${token === '$' ? 'leeg in de uitvoer' : `in de uitvoer ${token}`}, ${expected ? shown : 'de planner zag het slot leeg'}`;
    }
  }
  return undefined;
}
