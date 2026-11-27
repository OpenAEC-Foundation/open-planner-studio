import type { Task, TaskTimeComputed, TaskTimeInput } from '@/types/task';
import { rollupSummaryTasks } from './applyCpmResult';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import type { WorkCalendar } from '@/types/calendar';
import { engineForTaskCalendar, type CPMResult, type CPMTaskResult } from './CPMSolver';
import { deadlineBound } from './deadlineBound';
import { resolveCalendar } from './resolveCalendar';
import { writeSummaryProgress, type SummaryProgress } from './summaryProgress';
import { CalendarEngine } from './CalendarEngine';
import { parseInstant } from '@/utils/dateUtils';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { projectDurationOf } from './projectDuration';

export interface RecordedTime {
  start: string;
  finish: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  isCritical?: boolean;
  summaryProgress?: SummaryProgress;
  hammockDuration?: Pick<TaskTimeInput, 'scheduleDuration' | 'durationUnit' | 'durationMinutes'>;
}

export function captureHammockDuration(task: Task): RecordedTime['hammockDuration'] {
  if (!task.isHammock) return undefined;
  return { scheduleDuration: task.time.scheduleDuration, durationUnit: task.time.durationUnit,
    durationMinutes: task.time.durationMinutes };
}

type _Expect<T extends true> = T;
type _IsNever<T> = [T] extends [never] ? true : false;
type _RecordedTimeOngedekt = Exclude<keyof TaskTimeComputed, keyof RecordedTime | 'earlyStart' | 'earlyFinish'>;
const _assertRecordedTimeCompleet: _Expect<_IsNever<_RecordedTimeOngedekt>> = true;
void _assertRecordedTimeCompleet;

export function buildRecordedTime(input: {
  start: string | undefined;
  finish: string | undefined;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  isCritical?: boolean;
}): RecordedTime | undefined {
  if (!input.start || !input.finish) return undefined;
  return {
    start: input.start,
    finish: input.finish,
    ...(input.lateStart ? { lateStart: input.lateStart } : {}),
    ...(input.lateFinish ? { lateFinish: input.lateFinish } : {}),
    ...(input.totalFloat !== undefined ? { totalFloat: input.totalFloat } : {}),
    ...(input.freeFloat !== undefined ? { freeFloat: input.freeFloat } : {}),
    ...(input.isCritical !== undefined ? { isCritical: input.isCritical } : {}),
  };
}

export function leafRecordedTimes(
  tasks: readonly Pick<Task, 'id' | 'childIds'>[],
  times: Record<string, RecordedTime>,
): Record<string, RecordedTime> {
  const summaries = new Set(tasks.filter((t) => t.childIds.length > 0).map((t) => t.id));
  const out: Record<string, RecordedTime> = {};
  for (const [id, rec] of Object.entries(times)) if (!summaries.has(id)) out[id] = rec;
  return out;
}

export function recordedFloatDays(minutes: number | null | undefined, minutesPerDay: number): number | undefined {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || !(minutesPerDay > 0)) return undefined;
  return Math.round(minutes) / minutesPerDay;
}

export interface RecordedDates {
  times: Record<string, RecordedTime>;
  total: number;
}

export interface RecordedDatesState extends RecordedDates {
  shifted?: number;
  shiftedTaskIds?: string[];
  origin?: 'xer' | 'xer-archive' | 'p6xml' | 'mspdi' | 'mpp' | 'csv' | 'ifc' | 'ifc-own';
  sourceFormat?: 'xer' | 'p6xml' | 'mspdi' | 'mpp' | 'ifc';
}

export function captureRecordedDates(
  tasks: Task[],
  recordedFields: Record<string, readonly (keyof TaskTimeComputed | keyof TaskTimeInput)[]> | undefined,
  recordedTimes?: Record<string, RecordedTime>,
  opts: { scheduleLayer?: boolean } = {},
): RecordedDates {
  if (recordedTimes) {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const times: Record<string, RecordedTime> = {};
    for (const [id, rec] of Object.entries(recordedTimes)) {
      const task = byId.get(id);
      if (!task) continue;
      times[id] = task.isHammock ? { ...rec, hammockDuration: captureHammockDuration(task) } : rec;
    }
    return { times, total: Object.keys(times).length };
  }

  const times: Record<string, RecordedTime> = {};
  if (!recordedFields) return { times, total: 0 };

  for (const task of tasks) {
    const present = recordedFields[task.id];
    if (!present) continue;
    const has = new Set(present);
    const t = task.time;

    let start: string;
    let finish: string;
    if (has.has('earlyStart') && has.has('earlyFinish')) {
      start = t.earlyStart;
      finish = t.earlyFinish;
    } else if (opts.scheduleLayer !== false && has.has('scheduleStart') && has.has('scheduleFinish')) {
      start = t.scheduleStart;
      finish = t.scheduleFinish;
    } else {
      continue;
    }

    times[task.id] = recordedTaskTime(task, has, start, finish);
  }
  return { times, total: Object.keys(times).length };
}

export function recordedTaskTime(task: Task, fields: ReadonlySet<keyof Task['time']>, start: string, finish: string): RecordedTime {
  const t = task.time;
  return {
    start,
    finish,
    lateStart: fields.has('lateStart') ? t.lateStart : undefined,
    lateFinish: fields.has('lateFinish') ? t.lateFinish : undefined,
    totalFloat: fields.has('totalFloat') ? t.totalFloat : undefined,
    freeFloat: fields.has('freeFloat') ? t.freeFloat : undefined,
    ...(fields.has('totalFloat') && t.totalFloatMinutes !== undefined ? { totalFloatMinutes: t.totalFloatMinutes } : {}),
    ...(fields.has('freeFloat') && t.freeFloatMinutes !== undefined ? { freeFloatMinutes: t.freeFloatMinutes } : {}),
    isCritical: fields.has('isCritical') ? t.isCritical : undefined,
    ...(task.isHammock ? { hammockDuration: captureHammockDuration(task) } : {}),
    ...(isSummaryTask(task)
      ? {
          summaryProgress: {
            completion: t.completion,
            status: task.status,
            ...(t.actualStart ? { actualStart: t.actualStart } : {}),
            ...(t.actualFinish ? { actualFinish: t.actualFinish } : {}),
          },
        }
      : {}),
  };
}

export function recordedDatesDeviate(task: Task, rec: RecordedTime): boolean {
  const progress = rec.summaryProgress;
  const asRecorded: Task = {
    ...task,
    time: {
      ...task.time,
      earlyStart: rec.start,
      earlyFinish: rec.finish,
      ...(progress
        ? { completion: progress.completion, actualStart: progress.actualStart, actualFinish: progress.actualFinish }
        : {}),
    },
  };
  return shownStart(task) !== shownStart(asRecorded) || shownFinish(task) !== shownFinish(asRecorded);
}

export function countShiftedTasks(tasks: Task[], times: Record<string, RecordedTime>): number {
  return shiftedTaskIds(tasks, times).length;
}

export function shiftedTaskIds(tasks: Task[], times: Record<string, RecordedTime>): string[] {
  const ids: string[] = [];
  for (const task of tasks) {
    const rec = times[task.id];
    if (rec && recordedDatesDeviate(task, rec)) ids.push(task.id);
  }
  return ids;
}

export function cpmResultFromRecorded(
  times: Record<string, RecordedTime>,
  tasks: Task[],
  calendar: WorkCalendar,
  calendars: WorkCalendar[],
): CPMResult {
  const out = new Map<string, CPMTaskResult>();
  const criticalPath: string[] = [];
  const missedDeadlineTaskIds: string[] = [];
  const engines = new Map<string, CalendarEngine>();
  let projectEnd = '';
  let projectStart = '';

  const recorded = tasks.filter((t) => times[t.id]);

  for (const task of recorded) {
    const rec = times[task.id];
    out.set(task.id, {
      earlyStart: rec.start,
      earlyFinish: rec.finish,
      lateStart: rec.lateStart ?? rec.start,
      lateFinish: rec.lateFinish ?? rec.finish,
      totalFloat: rec.totalFloat ?? 0,
      freeFloat: rec.freeFloat ?? 0,
      ...(rec.totalFloatMinutes !== undefined ? { totalFloatMinutes: rec.totalFloatMinutes } : {}),
      ...(rec.freeFloatMinutes !== undefined ? { freeFloatMinutes: rec.freeFloatMinutes } : {}),
      isCritical: rec.isCritical ?? false,
    });
    if (rec.isCritical) criticalPath.push(task.id);
    if (task.deadline) {
      const eng = engineForTaskCalendar(engines, resolveCalendar(task.calendarId, calendars, calendar));
      const bound = deadlineBound(task.deadline, eng);
      const finish = parseInstant(rec.finish);
      if (bound && !isNaN(finish.getTime()) && finish > bound) missedDeadlineTaskIds.push(task.id);
    }
    if (!projectStart || rec.start < projectStart) projectStart = rec.start;
    if (rec.finish > projectEnd) projectEnd = rec.finish;
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ancestorsOfRecorded = new Set<string>();
  for (const task of recorded) {
    let parentId = task.parentId;
    while (parentId && !ancestorsOfRecorded.has(parentId)) {
      ancestorsOfRecorded.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  for (const id of ancestorsOfRecorded) {
    const summary = byId.get(id);
    if (!summary || times[id] || out.has(id)) continue;
    out.set(id, {
      earlyStart: summary.time.earlyStart,
      earlyFinish: summary.time.earlyFinish,
      lateStart: summary.time.lateStart,
      lateFinish: summary.time.lateFinish,
      totalFloat: summary.time.totalFloat,
      freeFloat: summary.time.freeFloat,
      ...(summary.time.totalFloatMinutes !== undefined ? { totalFloatMinutes: summary.time.totalFloatMinutes } : {}),
      ...(summary.time.freeFloatMinutes !== undefined ? { freeFloatMinutes: summary.time.freeFloatMinutes } : {}),
      isCritical: summary.time.isCritical,
    });
  }

  let projectDuration = 0;
  if (projectStart && projectEnd) {
    const engine = new CalendarEngine(calendar);
    projectDuration = projectDurationOf(engine, projectStart, projectEnd, recorded);
  }

  return {
    tasks: out,
    criticalPath,
    criticalPaths: [criticalPath],
    drivingSequenceIds: [],
    drivingUnknown: true,
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds,
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd,
    projectDuration,
  };
}

export function applyRecordedTimesToTasks(
  tasks: Task[],
  times: Record<string, RecordedTime>,
  calendar: WorkCalendar,
  calendars: WorkCalendar[],
): CPMResult {
  for (const task of tasks) {
    const rec = times[task.id];
    if (!rec) continue;
    task.time.earlyStart = rec.start;
    task.time.earlyFinish = rec.finish;
    task.time.lateStart = rec.lateStart ?? rec.start;
    task.time.lateFinish = rec.lateFinish ?? rec.finish;
    task.time.totalFloat = rec.totalFloat ?? 0;
    task.time.freeFloat = rec.freeFloat ?? 0;
    task.time.totalFloatMinutes = rec.totalFloatMinutes;
    task.time.freeFloatMinutes = rec.freeFloatMinutes;
    task.time.isCritical = rec.isCritical ?? false;
    if (rec.summaryProgress) writeSummaryProgress(task, rec.summaryProgress);
    if (task.isHammock && rec.hammockDuration) {
      task.time.scheduleDuration = rec.hammockDuration.scheduleDuration;
      task.time.durationUnit = rec.hammockDuration.durationUnit;
      task.time.durationMinutes = rec.hammockDuration.durationMinutes;
    }
    task.time.interferingFloat = undefined;
    task.time.isNearCritical = undefined;
    task.time.floatPath = undefined;
  }
  rollupSummaryTasks(tasks, { skip: task => times[task.id] !== undefined, projectCalendar: calendar });
  for (const task of tasks) {
    if (isLeafTask(task) || times[task.id]) continue;
    task.time.interferingFloat = undefined;
    task.time.isNearCritical = undefined;
    task.time.floatPath = undefined;
  }
  return cpmResultFromRecorded(times, tasks, calendar, calendars);
}
