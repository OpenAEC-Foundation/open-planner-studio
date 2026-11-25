import type { Task, TaskTime } from '@/types/task';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { DayClockCache, normalizeTaskDate, taskDateContext, type TaskDateField } from '@/state/migrations/minuteModel';
import { parseImportedInstant } from '@/services/importDates';
import { formatInstant } from '@/utils/dateUtils';
import type { TaskTimeReading } from '../ifcReader';
import type { WriteIFCInput } from '../ifcWriter';
import { IFC_TIME_ANCHOR } from '../ifcConstants';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT, type TaskTimeSlotKey } from '../ifcTaskSlots';

type DateKey = TaskTimeSlotKey & TaskDateField;
const DATE_FIELDS: ReadonlySet<TaskTimeSlotKey> = new Set<DateKey>([
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'actualStart', 'actualFinish',
]);
const STAMP = /^'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00'$/;
const QUOTED = /^'[^']*'$/;
const STEP_REAL = /^[+-]?\d+\.\d*(?:E[+-]?\d+)?$/;
const DAY_CLOCK = IFC_TIME_ANCHOR.slice(0, 5);
const HOUR_DAY_CLOCK = '00:00';
const written = (token: string | undefined) => !!token && token !== '$';

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

function durationFacts(key: TaskTimeSlotKey, task: Task): readonly unknown[] {
  const t = task.time, hours = taskDurationUnit(task) === 'hours';
  switch (key) {
    case 'scheduleDuration': return [t.scheduleDuration, hours, hours ? t.durationMinutes : undefined];
    case 'remainingTime': return [t.remainingTime, hours ? t.remainingMinutes : undefined];
    case 'freeFloat': return [t.freeFloat, t.freeFloatMinutes];
    case 'totalFloat': return [t.totalFloat, t.totalFloatMinutes];
    default: return [t.actualDuration];
  }
}

function stampOnDayPath(token: string, read: unknown): string | undefined {
  const stamp = STAMP.exec(token);
  if (!stamp || typeof read !== 'string') return undefined;
  return !isDateOnly(read) || stamp[2] === DAY_CLOCK ? read : undefined;
}

function statusTimeMatches(token: string, statusDate: string, task: Task): boolean {
  const stamp = STAMP.exec(token);
  if (!stamp) return false;
  if (!isDateOnly(statusDate)) return `${stamp[1]}T${stamp[2]}` === formatInstant(parseImportedInstant(statusDate), 'hour');
  return stamp[1] === statusDate && stamp[2] === (taskDurationUnit(task) === 'hours' ? HOUR_DAY_CLOCK : DAY_CLOCK);
}

function expectedText(key: TaskTimeSlotKey, task: Task, statusDate: string | undefined): string {
  if (key === 'statusTime') return `de statusdatum ${statusDate}`;
  if (DATE_FIELDS.has(key) || key === 'durationType' || key === 'isCritical' || key === 'completion') {
    return `de planning heeft ${JSON.stringify(task.time[key as keyof TaskTime])}`;
  }
  return `de planning heeft ${JSON.stringify(durationFacts(key, task))}`;
}

export function taskTimeSlotProblem(domain: WriteIFCInput, readings: ReadonlyMap<string, TaskTimeReading>,
  milestonesAtDayEnd: ReadonlySet<string> | undefined, sourceTokens: ReadonlyMap<string, string> | undefined): string | undefined {
  const clocks = new DayClockCache(domain.calendar, domain.resourceCalendars ?? []);
  const statusDate = domain.project.statusDate;
  for (const task of domain.tasks) {
    const reading = readings.get(task.id);
    if (!reading) return `taak ${task.id}: de uitvoer heeft geen taaktijd`;
    const withheld: readonly string[] = domain.withheldTaskTimeFields?.[task.id] ?? [];
    let context: ReturnType<typeof taskDateContext> | undefined;
    const instant = (value: unknown, field: DateKey) => {
      if (typeof value !== 'string') return value;
      context ??= taskDateContext(task, clocks, milestonesAtDayEnd);
      return normalizeTaskDate(value, field, context) ?? value;
    };
    const sameValue = (key: TaskTimeSlotKey, token: string): boolean => {
      const t = task.time;
      if (DATE_FIELDS.has(key)) {
        const read = stampOnDayPath(token, reading.time[key as DateKey]);
        return read !== undefined && instant(read, key as DateKey) === instant(t[key as DateKey], key as DateKey);
      }
      switch (key) {
        case 'durationType': return token === `.${t.durationType}.`;
        case 'isCritical': return token === (t.isCritical ? '.T.' : '.F.');
        case 'completion': return STEP_REAL.test(token) && Object.is(reading.time.completion, t.completion);
        case 'statusTime': return statusTimeMatches(token, statusDate!, task);
        default: {
          if (!QUOTED.test(token)) return false;
          const want = durationFacts(key, task), got = durationFacts(key, { ...task, time: reading.time });
          return want.every((value, i) => Object.is(value, got[i]));
        }
      }
    };
    for (let k = TASKTIME_SLOT.durationType; k < IFC_TASKTIME_SLOTS.length; k++) {
      const key = IFC_TASKTIME_SLOTS[k].key, token = reading.args[k];
      const source = sourceTokens?.get(`${reading.id}#${k}`);
      if (source !== undefined) {
        if (token === source) continue;
        return `taak ${task.id}.time, IFCTASKTIME argument ${k} (${key}): in de uitvoer ${token ?? 'niets'}, de bronwaarde ${source}`;
      }
      const expected = expectedWritten(key, task, withheld, statusDate);
      if (written(token) === expected && (!expected || sameValue(key, token!))) continue;
      return `taak ${task.id}.time, IFCTASKTIME argument ${k} (${key}): ${!written(token) ? 'leeg in de uitvoer'
        : `in de uitvoer ${token}`}, ${expected ? expectedText(key, task, statusDate) : 'de planning laat het slot leeg'}`;
    }
  }
  return undefined;
}
