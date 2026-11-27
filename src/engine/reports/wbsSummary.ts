import type { MeasuredDuration } from '@/utils/taskDuration';
import type { Task } from '@/types/task';
import { flattenOrder } from '@/utils/wbs';
import { signedWorkDaysBetween } from '@/engine/variance';
import { descendantLeaves, isSummaryProgressDerived, summaryProgressOf } from '@/engine/scheduler/summaryProgress';
import {
  type ReportContext, durationDays, durationMeasure, taskHoursPerDay, makeEngineCache, progressState,
  taskDepths, taskFinish, taskStart,
} from './reportCommon';

export interface WbsSummaryRow {
  taskId: string;
  level: number;
  isSummary: boolean;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  baselineStart?: string;
  baselineFinish?: string;
  durationDays: number;
  duration?: MeasuredDuration;
  hoursPerDay: number;
  completion: number;
  finishVarianceDays?: number;
  minTotalFloat: number;
  isCritical: boolean;
  counts: { total: number; critical: number; inProgress: number; complete: number };
}

export interface WbsSummaryOptions {
  maxLevel: number;
  includeActivities: boolean;
}

export interface WbsSummaryResult {
  rows: WbsSummaryRow[];
  counts: { elements: number; activities: number };
}

export function computeWbsSummary(ctx: ReportContext, opts: WbsSummaryOptions): WbsSummaryResult {
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  const depths = taskDepths(ctx.tasks);
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const projectEngine = makeEngineCache(ctx).project;

  const leafCache = new Map<string, Task[]>();
  const workDays = (l: Task) => durationDays(ctx, l);

  const rows: WbsSummaryRow[] = [];
  let elements = 0;
  let activities = 0;
  for (const t of flattenOrder(ctx.tasks)) {
    const level = depths.get(t.id) ?? 1;
    const isSummary = t.childIds.length > 0;
    if (opts.maxLevel > 0 && level > opts.maxLevel) continue;
    if (!isSummary && !opts.includeActivities) continue;

    const leaves = descendantLeaves(t, byId, leafCache);
    let bStart: string | undefined;
    let bFinish: string | undefined;
    for (const l of leaves) {
      const b = baseMap.get(l.id);
      if (b) {
        if (!bStart || b.start < bStart) bStart = b.start;
        if (!bFinish || b.finish > bFinish) bFinish = b.finish;
      }
    }
    const start = taskStart(t);
    const finish = taskFinish(t);
    const completion = isSummary && (!isSummaryProgressDerived(t) || ctx.datesAsRecorded)
      ? Math.round(Math.min(1, Math.max(0, t.time.completion)) * 1000) / 1000
      : summaryProgressOf(leaves, workDays).completion;
    if (isSummary) elements++; else activities++;
    rows.push({
      taskId: t.id,
      level,
      isSummary,
      wbs: t.wbsCode,
      name: t.name,
      start,
      finish,
      baselineStart: bStart,
      baselineFinish: bFinish,
      durationDays: isSummary ? Math.max(0, t.time.scheduleDuration) : durationDays(ctx, t),
      ...(isSummary ? {} : { duration: durationMeasure(t) }),
      hoursPerDay: taskHoursPerDay(ctx, t),
      completion,
      finishVarianceDays: bFinish ? signedWorkDaysBetween(projectEngine, bFinish, finish) : undefined,
      minTotalFloat: leaves.length ? leaves.reduce((m, l) => Math.min(m, l.time.totalFloat), Infinity) : t.time.totalFloat,
      isCritical: leaves.some(l => l.time.isCritical),
      counts: {
        total: leaves.length,
        critical: leaves.filter(l => l.time.isCritical && progressState(l) !== 'complete').length,
        inProgress: leaves.filter(l => progressState(l) === 'inProgress').length,
        complete: leaves.filter(l => progressState(l) === 'complete').length,
      },
    });
  }
  return { rows, counts: { elements, activities } };
}
