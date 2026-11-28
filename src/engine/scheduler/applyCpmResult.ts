import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { CPMResult } from './CPMSolver';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import { taskDurationUnit, writeDerivedSpan, isZeroDurationMilestone } from './duration';
import { CalendarEngine } from './CalendarEngine';
import { descendantLeaves, summaryProgressOf, taskWorkDays, writeSummaryProgress } from './summaryProgress';
import { finishInstant, latestFinish } from '@/utils/taskDates';
import { minOf } from '@/utils/collections';

function minOfDefined(values: (number | undefined)[]): number | undefined {
  if (values.length === 0 || values.some(v => v === undefined)) return undefined;
  return minOf(values as number[]);
}

export interface ApplyCpmCalendars {
  projectCalendar: WorkCalendar;
  calendars: WorkCalendar[];
}

function applyDerivedSummaryDuration(task: Task, engine: CalendarEngine): void {
  if (isZeroDurationMilestone(task)) return;
  if (!task.time.earlyStart || !task.time.earlyFinish) return;
  const es = parseInstant(task.time.earlyStart);
  const ef = engine.isHourMode ? finishInstant(task.time.earlyFinish) : parseInstant(task.time.earlyFinish);
  if (Number.isNaN(es.getTime()) || Number.isNaN(ef.getTime())) return;
  writeDerivedSpan(task, es, ef, engine, true);
}

export function applyCpmResult(tasks: Task[], result: CPMResult, cals: ApplyCpmCalendars): void {
  for (const task of tasks) {
    const r = result.tasks.get(task.id);
    if (!r) continue;
    task.time.earlyStart = r.earlyStart;
    task.time.earlyFinish = r.earlyFinish;
    if (task.time.progressBeforeRecalculation) task.time.progressBeforeRecalculation = undefined;
    task.time.lateStart = r.lateStart;
    task.time.lateFinish = r.lateFinish;
    task.time.totalFloat = r.totalFloat;
    task.time.freeFloat = r.freeFloat;
    task.time.totalFloatMinutes = r.totalFloatMinutes;
    task.time.freeFloatMinutes = r.freeFloatMinutes;
    task.time.isCritical = r.isCritical;
    task.time.interferingFloat = r.interferingFloat;
    task.time.isNearCritical = r.isNearCritical !== undefined ? r.isNearCritical : undefined;
    task.time.floatPath = r.floatPath !== undefined ? r.floatPath : undefined;
    if (taskDurationUnit(task) === 'hours') {
      task.time.scheduleStart = formatInstant(parseInstant(task.time.scheduleStart), 'hour');
    }
  }

  rollupSummaryTasks(tasks, { projectCalendar: cals.projectCalendar, progressCalendars: cals.calendars });
}

export function rollupSummaryTasks(
  tasks: Task[],
  options?: {
    skip?: (task: Task) => boolean;
    projectCalendar?: WorkCalendar;
    progressCalendars?: WorkCalendar[];
  },
): void {
  const byId = new Map<string, Task>(tasks.map(t => [t.id, t]));
  const summaryEngine = options?.projectCalendar ? new CalendarEngine(options.projectCalendar) : null;
  const visited = new Set<string>();
  const progressCals = options?.projectCalendar && options.progressCalendars
    ? { projectCalendar: options.projectCalendar, calendars: options.progressCalendars }
    : null;
  const leafCache = new Map<string, Task[]>();
  const workDaysCache = new Map<string, number>();
  const workDaysOf = (leaf: Task): number => {
    let d = workDaysCache.get(leaf.id);
    if (d === undefined) {
      d = progressCals ? taskWorkDays(leaf, progressCals.projectCalendar, progressCals.calendars) : 0;
      workDaysCache.set(leaf.id, d);
    }
    return d;
  };
  const updateSummary = (task: Task): void => {
    if (options?.skip?.(task)) return;

    const children = task.childIds
      .map(cid => byId.get(cid))
      .filter(Boolean) as Task[];

    if (task.manuallyScheduled && children.length > 0) {
      const es = task.time.scheduleStart;
      const ef = task.time.scheduleFinish;
      const [start, finish] = ef < es ? [ef, es] : [es, ef];
      task.time.earlyStart = start;
      task.time.earlyFinish = finish;
      task.time.lateStart = start;
      task.time.lateFinish = finish;
      task.time.totalFloat = 0;
      task.time.freeFloat = 0;
      task.time.totalFloatMinutes = 0;
      task.time.freeFloatMinutes = 0;
      task.time.interferingFloat = 0;
      task.time.isCritical = children.some(c => c.time.isCritical);
      return;
    }

    if (children.length > 0) {
      const starts = children.map(c => c.time.earlyStart).sort();
      task.time.earlyStart = starts[0];
      task.time.earlyFinish = latestFinish(children.map(c => c.time.earlyFinish));
      task.time.isCritical = children.some(c => c.time.isCritical);

      const lateStarts = children.map(c => c.time.lateStart).sort();
      task.time.lateStart = lateStarts[0];
      task.time.lateFinish = latestFinish(children.map(c => c.time.lateFinish));
      task.time.totalFloat = minOf(children.map(c => c.time.totalFloat));
      task.time.freeFloat = minOf(children.map(c => c.time.freeFloat));
      task.time.totalFloatMinutes = minOfDefined(children.map(c => c.time.totalFloatMinutes));
      task.time.freeFloatMinutes = minOfDefined(children.map(c => c.time.freeFloatMinutes));
      task.time.interferingFloat = task.time.totalFloat - task.time.freeFloat;

      if (summaryEngine) applyDerivedSummaryDuration(task, summaryEngine);

      if (progressCals) {
        writeSummaryProgress(task, summaryProgressOf(descendantLeaves(task, byId, leafCache), workDaysOf));
      }
    }
  };

  for (const root of tasks) {
    if (root.parentId) continue;
    const stack = [{ task: byId.get(root.id)!, returning: false }];
    while (stack.length > 0) {
      const { task, returning } = stack.pop()!;
      if (returning) {
        updateSummary(task);
        continue;
      }
      if (isLeafTask(task) || visited.has(task.id)) continue;
      visited.add(task.id);
      stack.push({ task, returning: true });
      for (let i = task.childIds.length - 1; i >= 0; i--) {
        const child = byId.get(task.childIds[i]);
        if (child) stack.push({ task: child, returning: false });
      }
    }
  }
}
