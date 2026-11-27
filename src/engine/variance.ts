import type { Task } from '@/types/task';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import { shownStart, shownFinish } from '@/utils/taskDates';

export type VarianceStatus = 'onSchedule' | 'late' | 'early' | 'new' | 'dropped';

export interface VarianceRow {
  taskId: string;
  wbs: string;
  name: string;
  baselineStart?: string;
  baselineFinish?: string;
  currentStart?: string;
  currentFinish?: string;
  deltaStart?: number;
  deltaFinish?: number;
  status: VarianceStatus;
}

export interface VarianceResult {
  rows: VarianceRow[];
  projectEndDelta?: number;
}

export function signedWorkDaysBetween(cal: CalendarEngine, aIso: string, bIso: string): number {
  return cal.signedWorkDaysBetween(parseDate(aIso), parseDate(bIso));
}

function statusFromDelta(deltaFinish: number): VarianceStatus {
  if (deltaFinish > 0) return 'late';
  if (deltaFinish < 0) return 'early';
  return 'onSchedule';
}

export function computeVariance(
  tasks: Task[],
  baseline: Baseline | null,
  cal: CalendarEngine,
  currentEnd?: string,
): VarianceResult {
  if (!baseline) return { rows: [] };

  const leaves = tasks.filter(isLeafTask);
  const baseMap = new Map<string, BaselineTask>();
  for (const bt of baseline.tasks) baseMap.set(bt.taskId, bt);
  const currentIds = new Set(leaves.map((t) => t.id));

  const rows: VarianceRow[] = [];

  for (const t of leaves) {
    const currentStart = shownStart(t);
    const currentFinish = shownFinish(t);
    const bt = baseMap.get(t.id);
    if (!bt) {
      rows.push({
        taskId: t.id, wbs: t.wbsCode, name: t.name,
        currentStart, currentFinish, status: 'new',
      });
      continue;
    }
    const deltaStart = signedWorkDaysBetween(cal, bt.start, currentStart);
    const deltaFinish = signedWorkDaysBetween(cal, bt.finish, currentFinish);
    rows.push({
      taskId: t.id, wbs: t.wbsCode, name: t.name,
      baselineStart: bt.start, baselineFinish: bt.finish,
      currentStart, currentFinish,
      deltaStart, deltaFinish,
      status: statusFromDelta(deltaFinish),
    });
  }

  for (const bt of baseline.tasks) {
    if (currentIds.has(bt.taskId)) continue;
    rows.push({
      taskId: bt.taskId, wbs: '', name: '',
      baselineStart: bt.start, baselineFinish: bt.finish,
      status: 'dropped',
    });
  }

  const result: VarianceResult = { rows };
  if (baseline.projectEnd && currentEnd) {
    result.projectEndDelta = signedWorkDaysBetween(cal, baseline.projectEnd, currentEnd);
  }
  return result;
}
