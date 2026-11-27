import type { MeasuredDuration } from '@/utils/taskDuration';
import type { Resource } from '@/types/resource';
import {
  type ReportContext, type ProgressState, activityTasks, overlapsWindow, progressState,
  remainingDays, remainingMeasure, resolvePeriodFor, scheduleSlip, taskFinish, taskStart,
} from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

export interface ResourceAssignmentRow {
  assignmentId: string;
  resourceId: string;
  resourceName: string;
  resourceType: Resource['type'];
  taskId: string;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  remainingDays: number;
  remaining: MeasuredDuration;
  unitsPerDay: number;
  costAmount?: number;
  completion: number;
  isCritical: boolean;
  state: ProgressState;
}

export interface ResourceAssignmentOptions {
  period: ReportingPeriod;
  includeCompleted: boolean;
}

export interface ResourceAssignmentResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: ResourceAssignmentRow[];
  counts: { resources: number; assignments: number; unassignedTasks: number };
}

export function computeResourceAssignments(ctx: ReportContext, opts: ResourceAssignmentOptions): ResourceAssignmentResult {
  const { from, to, refDay, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  const windowed = opts.period.preset !== 'project';
  const taskById = new Map(ctx.tasks.map(t => [t.id, t]));
  const resById = new Map(ctx.resources.map(r => [r.id, r]));
  const rows: ResourceAssignmentRow[] = [];
  const assignedTaskIds = new Set<string>();

  for (const a of ctx.assignments) {
    const t = taskById.get(a.taskId);
    const r = resById.get(a.resourceId);
    if (!t || !r || t.childIds.length > 0) continue;
    assignedTaskIds.add(t.id);
    const state = progressState(t);
    if (!opts.includeCompleted && state === 'complete') continue;
    const backlog = to >= refDay && scheduleSlip(t, state, refDay) === 'finish';
    if (windowed && !overlapsWindow(t, from, to) && !backlog) continue;
    rows.push({
      assignmentId: a.id,
      resourceId: r.id,
      resourceName: r.name,
      resourceType: r.type,
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      start: taskStart(t),
      finish: taskFinish(t),
      remainingDays: remainingDays(ctx, t),
      remaining: remainingMeasure(t),
      unitsPerDay: a.unitsPerDay,
      ...(r.type === 'COST' && a.costAmount !== undefined ? { costAmount: a.costAmount } : {}),
      completion: t.time.completion,
      isCritical: t.time.isCritical,
      state,
    });
  }
  const resourceOrder = new Map(ctx.resources.map((r, i) => [r.id, i]));
  rows.sort((a, b) =>
    (resourceOrder.get(a.resourceId) ?? 0) - (resourceOrder.get(b.resourceId) ?? 0)
    || a.start.localeCompare(b.start)
    || a.wbs.localeCompare(b.wbs));
  const unassignedTasks = activityTasks(ctx.tasks).filter(t => !t.isMilestone && !assignedTaskIds.has(t.id)).length;
  return {
    from, to, statusDateMissing: windowed && statusDateMissing, rows,
    counts: {
      resources: new Set(rows.map(r => r.resourceId)).size,
      assignments: rows.length,
      unassignedTasks,
    },
  };
}
