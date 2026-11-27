import type { MeasuredDuration } from '@/utils/taskDuration';
import type { Task } from '@/types/task';
import {
  type ReportContext, assignedResourceNamesIndex, isNearCritical, activityTasks, overlapsWindow,
  progressState, remainingDays, remainingMeasure, resolvePeriodFor, scheduleSlip, taskFinish, taskStart,
} from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

export type LookAheadStatus = 'overdue' | 'lateStart' | 'inProgress' | 'starting';

export interface LookAheadRow {
  taskId: string;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  remainingDays: number;
  remaining: MeasuredDuration;
  completion: number;
  totalFloat: number;
  isCritical: boolean;
  isNearCritical: boolean;
  isMilestone: boolean;
  constraintDate?: string;
  resources: string[];
  status: LookAheadStatus;
}

export interface LookAheadOptions {
  period: ReportingPeriod;
  nearCriticalDays: number;
}

export interface LookAheadResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: LookAheadRow[];
  counts: { total: number; overdue: number; lateStart: number; inProgress: number; starting: number; critical: number; nearCritical: number };
}

function statusOf(t: Task, refDay: string): LookAheadStatus | null {
  const state = progressState(t);
  if (state === 'complete') return null;
  const slip = scheduleSlip(t, state, refDay);
  if (slip === 'finish') return 'overdue';
  if (state === 'inProgress') return 'inProgress';
  return slip === 'start' ? 'lateStart' : 'starting';
}

export function computeLookAhead(ctx: ReportContext, opts: LookAheadOptions): LookAheadResult {
  const { from, to, refDay, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  const includeBacklog = to >= refDay;
  const rows: LookAheadRow[] = [];
  const resourceNames = assignedResourceNamesIndex(ctx);
  for (const t of activityTasks(ctx.tasks)) {
    const status = statusOf(t, refDay);
    if (!status) continue;
    const backlog = status === 'overdue' || status === 'lateStart';
    if (!overlapsWindow(t, from, to) && !(backlog && includeBacklog)) continue;
    rows.push({
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      start: taskStart(t),
      finish: taskFinish(t),
      remainingDays: remainingDays(ctx, t),
      remaining: remainingMeasure(t),
      completion: t.time.completion,
      totalFloat: t.time.totalFloat,
      isCritical: t.time.isCritical,
      isNearCritical: isNearCritical(t, opts.nearCriticalDays),
      isMilestone: t.isMilestone,
      constraintDate: t.constraint?.date,
      resources: resourceNames.get(t.id) ?? [],
      status,
    });
  }
  rows.sort((a, b) => a.start.localeCompare(b.start) || a.finish.localeCompare(b.finish) || a.wbs.localeCompare(b.wbs));
  const count = (s: LookAheadStatus) => rows.filter(r => r.status === s).length;
  return {
    from, to, statusDateMissing, rows,
    counts: {
      total: rows.length,
      overdue: count('overdue'),
      lateStart: count('lateStart'),
      inProgress: count('inProgress'),
      starting: count('starting'),
      critical: rows.filter(r => r.isCritical).length,
      nearCritical: rows.filter(r => r.isNearCritical).length,
    },
  };
}
