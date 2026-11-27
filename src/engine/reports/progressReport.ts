import type { MeasuredDuration } from '@/utils/taskDuration';
import { parseDate } from '@/utils/dateUtils';
import { signedWorkDaysBetween } from '@/engine/variance';
import {
  type ReportContext, type ProgressState, dayOf, durationDays, elapsedWorkFraction, isNearCritical, activityTasks, makeEngineCache, onHourCalendar, progressState, scheduleSlip,
  remainingDays, remainingMeasure, resolvePeriodFor, round1, statusMoment, taskFinish, taskStart,
} from './reportCommon';
import { type ReportingPeriod, periodDays, windowEnd } from './reportingPeriod';

export type ProgressRowStatus = 'complete' | 'inProgress' | 'notStarted' | 'overdueStart' | 'overdueFinish';

export interface ProgressRow {
  taskId: string;
  wbs: string;
  name: string;
  baselineFinish?: string;
  finish: string;
  actualFinish?: string;
  completion: number;
  remainingDays: number;
  remaining: MeasuredDuration;
  totalFloat: number;
  isCritical: boolean;
  isNearCritical: boolean;
  state: ProgressState;
  overdue?: 'start' | 'finish';
  status: ProgressRowStatus;
}

export interface ProgressReportOptions {
  period: ReportingPeriod;
  nearCriticalDays: number;
}

export interface ProgressSummary {
  statusDate: string;
  statusDateMissing: boolean;
  periodFrom: string;
  periodTo: string;
  lookAheadTo: string;
  baselineFinish?: string;
  forecastFinish?: string;
  finishVarianceDays?: number;
  plannedPct: number;
  actualPct: number;
  plannedBasis: 'baseline' | 'current';
  counts: {
    total: number; complete: number; inProgress: number; notStarted: number;
    critical: number; nearCritical: number; overdue: number;
  };
}

export interface ProgressReportResult {
  summary: ProgressSummary;
  completedInPeriod: ProgressRow[];
  inProgress: ProgressRow[];
  startingNext: ProgressRow[];
  overdue: ProgressRow[];
  critical: ProgressRow[];
}

export function computeProgressReport(ctx: ReportContext, opts: ProgressReportOptions): ProgressReportResult {
  const { from: periodFrom, to: periodTo, refDay: ref, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  const mirrored = opts.period.preset.startsWith('last');
  const lookAheadTo = periodTo > ref ? periodTo
    : mirrored ? windowEnd(ref, periodDays({ from: periodFrom, to: periodTo }) + 1)
    : periodTo;
  const engines = makeEngineCache(ctx);
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const refDate = parseDate(ref);
  const moment = statusMoment(ctx);

  const leaves = activityTasks(ctx.tasks);
  const rows = new Map<string, ProgressRow>();
  let weightSum = 0;
  let plannedSum = 0;
  let actualSum = 0;

  const leafById = new Map(leaves.map(t => [t.id, t]));
  for (const t of leaves) {
    const bt = baseMap.get(t.id);
    const state = progressState(t);
    const overdue = scheduleSlip(t, state, ref);
    const status: ProgressRowStatus = overdue === 'finish' ? 'overdueFinish' : overdue === 'start' ? 'overdueStart' : state;
    rows.set(t.id, {
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      baselineFinish: bt?.finish,
      finish: taskFinish(t),
      actualFinish: t.time.actualFinish,
      completion: t.time.completion,
      remainingDays: remainingDays(ctx, t),
      remaining: remainingMeasure(t),
      totalFloat: t.time.totalFloat,
      isCritical: state !== 'complete' && t.time.isCritical,
      isNearCritical: state !== 'complete' && isNearCritical(t, opts.nearCriticalDays),
      state,
      overdue,
      status,
    });

    const weight = durationDays(ctx, t);
    if (weight <= 0) continue;
    const start = bt ? bt.start : taskStart(t);
    const finish = bt ? bt.finish : taskFinish(t);
    const eng = engines.forTask(t);
    let plannedFrac: number;
    if (onHourCalendar(ctx, t) || (moment && eng.isHourMode)) plannedFrac = elapsedWorkFraction(eng, start, finish, ref, moment);
    else if (refDate < parseDate(start)) plannedFrac = 0;
    else if (refDate >= parseDate(finish)) plannedFrac = 1;
    else plannedFrac = Math.min(1, Math.max(0, eng.workDaysBetween(parseDate(start), refDate) / weight));
    weightSum += weight;
    plannedSum += weight * plannedFrac;
    actualSum += weight * Math.min(1, Math.max(0, t.time.completion));
  }

  const all = [...rows.values()];
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  const forecastFinish = cpm?.projectEnd
    ?? (all.length ? all.map(r => r.finish).sort()[all.length - 1] : undefined);
  const baselineFinish = ctx.baseline?.projectEnd;
  const projectEngine = engines.project;
  const finishVarianceDays = baselineFinish && forecastFinish
    ? signedWorkDaysBetween(projectEngine, baselineFinish, forecastFinish)
    : undefined;

  const completedInPeriod = all.filter(r => {
    if (r.state !== 'complete') return false;
    const done = dayOf(r.actualFinish ?? r.finish);
    return done >= periodFrom && done <= periodTo;
  });
  const inProgress = all.filter(r => r.state === 'inProgress');
  const startingNext = all.filter(r => {
    if (r.state !== 'notStarted' || r.overdue) return false;
    const s = dayOf(taskStart(leafById.get(r.taskId)!));
    return s >= ref && s <= lookAheadTo;
  });
  const overdue = all.filter(r => r.overdue !== undefined);
  const critical = all.filter(r => r.state !== 'complete' && r.isCritical);

  const byWbs = (a: ProgressRow, b: ProgressRow) => a.finish.localeCompare(b.finish) || a.wbs.localeCompare(b.wbs);
  for (const list of [completedInPeriod, inProgress, startingNext, overdue, critical]) list.sort(byWbs);

  return {
    summary: {
      statusDate: ref,
      statusDateMissing,
      periodFrom,
      periodTo,
      lookAheadTo,
      baselineFinish,
      forecastFinish,
      finishVarianceDays,
      plannedPct: weightSum > 0 ? round1((plannedSum / weightSum) * 100) : 0,
      actualPct: weightSum > 0 ? round1((actualSum / weightSum) * 100) : 0,
      plannedBasis: ctx.baseline ? 'baseline' : 'current',
      counts: {
        total: all.length,
        complete: all.filter(r => r.state === 'complete').length,
        inProgress: inProgress.length,
        notStarted: all.filter(r => r.state === 'notStarted').length,
        critical: critical.length,
        nearCritical: all.filter(r => r.state !== 'complete' && r.isNearCritical).length,
        overdue: overdue.length,
      },
    },
    completedInPeriod, inProgress, startingNext, overdue, critical,
  };
}
