import type { Task } from '@/types/task';
import { DayClockCache, normalizeTaskDate, taskDateContext, type TaskDateField } from '@/state/migrations/minuteModel';
import type { TaskTimeReading } from '../ifcReader';
import type { WriteIFCInput } from '../ifcWriter';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT, type TaskTimeSlotKey } from '../ifcTaskSlots';

const DATE_FIELDS: ReadonlySet<TaskTimeSlotKey> = new Set<TaskTimeSlotKey>([
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'actualStart', 'actualFinish',
]);
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

export function taskTimeSlotProblem(domain: WriteIFCInput, readings: ReadonlyMap<string, TaskTimeReading>,
  milestonesAtDayEnd: ReadonlySet<string> | undefined, sourceTokens: ReadonlyMap<string, string> | undefined): string | undefined {
  const clocks = new DayClockCache(domain.calendar, domain.resourceCalendars ?? []);
  const statusDate = domain.project.statusDate;
  for (const task of domain.tasks) {
    const reading = readings.get(task.id);
    if (!reading) return `taak ${task.id}: de uitvoer heeft geen taaktijd`;
    const withheld: readonly string[] = domain.withheldTaskTimeFields?.[task.id] ?? [];
    let context: ReturnType<typeof taskDateContext> | undefined;
    const instant = (value: unknown, field: TaskDateField) => {
      if (typeof value !== 'string') return value;
      context ??= taskDateContext(task, clocks, milestonesAtDayEnd);
      return normalizeTaskDate(value, field, context) ?? value;
    };
    for (let k = TASKTIME_SLOT.durationType; k < IFC_TASKTIME_SLOTS.length; k++) {
      const key = IFC_TASKTIME_SLOTS[k].key, token = reading.args[k];
      const where = `taak ${task.id}.time, IFCTASKTIME argument ${k} (${key})`;
      const source = sourceTokens?.get(`${reading.id}#${k}`);
      if (source !== undefined) {
        if (token !== source) return `${where}: in de uitvoer ${token ?? 'niets'}, de bronwaarde ${source}`;
        continue;
      }
      const expected = expectedWritten(key, task, withheld, statusDate);
      if (written(token) !== expected) {
        return `${where}: ${expected ? `leeg in de uitvoer, de planning heeft een waarde` : `in de uitvoer ${token}, de planning laat het slot leeg`}`;
      }
      if (!expected) continue;
      if (key === 'statusTime') {
        if (token!.replace(/^'/, '').slice(0, 10) !== statusDate!.slice(0, 10)) return `${where}: in de uitvoer ${token}, de statusdatum ${statusDate}`;
        continue;
      }
      if (!IFC_TASKTIME_SLOTS[k].read) continue;
      const field = key as keyof typeof task.time;
      const want = DATE_FIELDS.has(key) ? instant(task.time[field], key as TaskDateField) : task.time[field];
      const got = DATE_FIELDS.has(key) ? instant(reading.time[field], key as TaskDateField) : reading.time[field];
      if (!Object.is(want, got)) return `${where}: in de uitvoer ${token}, de lezer leest ${JSON.stringify(got)}, de planning heeft ${JSON.stringify(want)}`;
    }
  }
  return undefined;
}
