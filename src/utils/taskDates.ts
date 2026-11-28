import type { Task } from '@/types/task';
import { isPinnedComplete } from '@/engine/scheduler/duration';
import { MS_PER_DAY, parseDate, parseInstant } from '@/utils/dateUtils';

export function computedStart(task: Task): string {
  return task.time.earlyStart || task.time.scheduleStart;
}

export function computedFinish(task: Task): string {
  return task.time.earlyFinish || task.time.scheduleFinish;
}

function actualStartOf(task: Task): string {
  return task.time.actualStart || (isPinnedComplete(task.time) ? task.time.actualFinish : '') || '';
}

export function shownStart(task: Task): string {
  const actual = actualStartOf(task);
  const computed = computedStart(task);
  if (!actual) return computed;
  if (task.childIds.length > 0 && computed && computed < actual) return computed;
  return actual;
}

export function shownFinish(task: Task): string {
  return isPinnedComplete(task.time) ? task.time.actualFinish : computedFinish(task);
}

export function startIsActual(task: Task): boolean {
  return task.childIds.length === 0 && actualStartOf(task) !== '';
}

export function finishIsActual(task: Task): boolean {
  return task.childIds.length === 0 && isPinnedComplete(task.time);
}

export function startAnchorAfterEdit(task: Task, value: string): string | undefined {
  return value !== shownStart(task) ? value : undefined;
}

export function shownSpanOverlapsDays(task: Task, fromDay: string, toDay: string): boolean {
  return shownStart(task).slice(0, 10) <= toDay.slice(0, 10)
    && shownFinish(task).slice(0, 10) >= fromDay.slice(0, 10);
}

export function finishInstant(iso: string): Date {
  return iso.includes('T') ? parseInstant(iso) : new Date(parseDate(iso).getTime() + MS_PER_DAY);
}

export function latestFinish(values: readonly string[]): string {
  let best = '';
  let bestMs = -Infinity;
  for (const value of values) {
    if (!value) continue;
    const ms = finishInstant(value).getTime();
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs || (ms === bestMs && value > best)) {
      best = value;
      bestMs = ms;
    }
  }
  return best || [...values].sort().pop() || '';
}

export function floatBandEnd(task: Task, dayGranular = false): Date | null {
  const { totalFloat, isCritical, lateFinish } = task.time;
  if (!(totalFloat > 0) || isCritical || !lateFinish) return null;
  const end = finishInstant(dayGranular ? lateFinish.slice(0, 10) : lateFinish);
  return Number.isNaN(end.getTime()) ? null : end;
}
