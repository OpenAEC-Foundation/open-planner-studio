import type { Task, TaskStatus } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, effectiveCalendarOf, taskDurationMinutes } from '@/utils/taskDuration';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { isManuallyScheduled } from '@/utils/manualScheduling';
import { latestFinish } from '@/utils/taskDates';

export type ProgressState = 'notStarted' | 'inProgress' | 'complete';

export function progressState(t: Task): ProgressState {
  if (t.time.completion >= 1 || t.status === 'COMPLETED' || !!t.time.actualFinish) return 'complete';
  if (t.time.completion > 0 || t.status === 'STARTED' || !!t.time.actualStart) return 'inProgress';
  return 'notStarted';
}

export function taskWorkDays(t: Task, projectCalendar: WorkCalendar, calendars: readonly WorkCalendar[]): number {
  const cal = effectiveCalendarOf(t, projectCalendar, calendars as WorkCalendar[]);
  const minPerDay = effHoursPerDay(cal) * 60;
  if (minPerDay <= 0) return t.time.scheduleDuration;
  return Math.round((taskDurationMinutes(t, cal) / minPerDay) * 10) / 10;
}

export function descendantLeaves(
  root: Task,
  byId: ReadonlyMap<string, Task>,
  cache?: Map<string, Task[]>,
): Task[] {
  const cached = cache?.get(root.id);
  if (cached) return cached;
  let out: Task[];
  if (isLeafTask(root)) {
    out = root.isHammock ? [] : [root];
  } else {
    out = [];
    const seen = new Set<string>([root.id]);
    const stack: Task[] = [root];
    while (stack.length) {
      const t = stack.pop()!;
      for (let i = t.childIds.length - 1; i >= 0; i--) {
        const c = byId.get(t.childIds[i]);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        if (isLeafTask(c)) { if (!c.isHammock) out.push(c); } else stack.push(c);
      }
    }
  }
  cache?.set(root.id, out);
  return out;
}

export interface SummaryProgress {
  completion: number;
  status: TaskStatus;
  actualStart?: string;
  actualFinish?: string;
}

export function summaryProgressOf(leaves: readonly Task[], workDaysOf: (t: Task) => number): SummaryProgress {
  let weight = 0;
  let done = 0;
  let complete = 0;
  let started = 0;
  let actualStart: string | undefined;
  let actualFinish: string | undefined;
  for (const l of leaves) {
    const d = workDaysOf(l);
    weight += d;
    done += d * Math.min(1, Math.max(0, l.time.completion));
    const state = progressState(l);
    if (state === 'complete') complete++;
    else if (state === 'inProgress') started++;
    const as = l.time.actualStart;
    if (as && (actualStart === undefined || as < actualStart)) actualStart = as;
    const af = l.time.actualFinish;
    if (af) actualFinish = actualFinish === undefined ? af : latestFinish([actualFinish, af]);
  }
  const status: TaskStatus = leaves.length > 0 && complete === leaves.length
    ? 'COMPLETED'
    : complete + started > 0 ? 'STARTED' : 'NOT_STARTED';
  const raw = status === 'COMPLETED'
    ? 1
    : weight > 0 ? done / weight : leaves.length > 0 ? complete / leaves.length : 0;
  const out: SummaryProgress = { completion: Math.round(raw * 1000) / 1000, status };
  if (actualStart !== undefined) out.actualStart = actualStart;
  if (status === 'COMPLETED' && actualFinish !== undefined) out.actualFinish = actualFinish;
  return out;
}

export function writeSummaryProgress(task: Task, progress: SummaryProgress): void {
  const time = task.time;
  time.completion = progress.completion;
  task.status = progress.status;
  if (time.actualStart !== progress.actualStart) time.actualStart = progress.actualStart;
  if (time.actualFinish !== progress.actualFinish) time.actualFinish = progress.actualFinish;
}

export function isSummaryProgressDerived(task: Task): boolean {
  return isSummaryTask(task) && !isManuallyScheduled(task);
}
