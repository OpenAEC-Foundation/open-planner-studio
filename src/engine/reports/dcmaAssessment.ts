import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { BaselineTask } from '@/types/baseline';
import { originalSequenceId } from '@/engine/scheduler/expandSummaryRelations';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { isTaskActualPastStatusDate } from '@/engine/taskMutationRules';
import { effHoursPerDay, effectiveCalendarOf, taskDurationMinutes } from '@/utils/taskDuration';
import { parseDate } from '@/utils/dateUtils';
import { signedWorkDaysBetween } from '@/engine/variance';
import {
  type ReportContext, activityTasks, dayOf, durationDays, makeEngineCache, progressState, taskFinish, taskStart,
} from './reportCommon';
import { type LogicIndex, isHardConstraint } from './logicIndex';

export type DcmaMetricId =
  | 'logic' | 'leads' | 'lags' | 'relationshipTypes' | 'hardConstraints' | 'highFloat' | 'negativeFloat'
  | 'highDuration' | 'invalidDates' | 'resources' | 'missedTasks' | 'criticalPathTest' | 'cpli' | 'bei';

export type DcmaResult = 'pass' | 'flag' | 'na';

export type DcmaNaReason =
  | 'notCalculated' | 'noTasks' | 'noRelations' | 'noStatusDate' | 'noBaseline' | 'nothingDue'
  | 'notResourceLoaded' | 'noCandidate' | 'finished';

export type DcmaNorm =
  | { kind: 'maxPercent'; value: number }
  | { kind: 'minPercent'; value: number }
  | { kind: 'minIndex'; value: number }
  | { kind: 'test' };

export interface DcmaMetric {
  point: number;
  id: DcmaMetricId;
  norm: DcmaNorm;
  result: DcmaResult;
  naReason?: DcmaNaReason;
  count?: number;
  base?: number;
  value?: number;
  test?: CriticalPathTestDetail;
  cpli?: { criticalPathLength: number; totalFloat: number; floatBasis: 'baseline' | 'schedule' };
}

export interface CriticalPathTestDetail {
  taskId: string;
  wbs: string;
  name: string;
  endTaskId: string;
  endWbs: string;
  endName: string;
  slipDays: number;
  endShiftDays: number;
}

export interface DcmaAssessment {
  metrics: DcmaMetric[];
  incompleteCount: number;
  relationCount: number;
  flags: number;
  passes: number;
}

export const DCMA_DAYS = 44;
const MAX_PERCENT = 5;
const MIN_FS_PERCENT = 90;
const MIN_INDEX = 0.95;
export const CRITICAL_PATH_TEST_SLIP_DAYS = 100;


const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function percentMetric(point: number, id: DcmaMetricId, norm: DcmaNorm, count: number, base: number): DcmaMetric {
  if (base <= 0) return { point, id, norm, result: 'na', naReason: id === 'leads' || id === 'lags' || id === 'relationshipTypes' ? 'noRelations' : 'noTasks' };
  const value = round1((count / base) * 100);
  let ok: boolean;
  if (norm.kind === 'maxPercent') ok = norm.value === 0 ? count === 0 : value <= norm.value;
  else if (norm.kind === 'minPercent') ok = value >= norm.value;
  else ok = true;
  return { point, id, norm, result: ok ? 'pass' : 'flag', count, base, value };
}

function na(point: number, id: DcmaMetricId, norm: DcmaNorm, naReason: DcmaNaReason): DcmaMetric {
  return { point, id, norm, result: 'na', naReason };
}

function completionTask(leaves: readonly Task[]): Task | undefined {
  let best: Task | undefined;
  for (const t of leaves) {
    if (!best) { best = t; continue; }
    const a = dayOf(taskFinish(t));
    const b = dayOf(taskFinish(best));
    if (a > b || (a === b && (t.isMilestone || !best.isMilestone))) best = t;
  }
  return best;
}

function extendTask(t: Task, days: number, hoursPerDay: number): void {
  if (taskDurationUnit(t) === 'hours') {
    const add = days * hoursPerDay * 60;
    t.time.durationMinutes = (t.time.durationMinutes ?? 0) + add;
    if (t.time.remainingMinutes !== undefined) t.time.remainingMinutes += add;
  } else {
    t.time.scheduleDuration += days;
    if (t.time.remainingTime !== undefined) t.time.remainingTime += days;
  }
}

function criticalPathTest(ctx: ReportContext, solve: ProjectSolveOptions): DcmaMetric {
  const norm: DcmaNorm = { kind: 'test' };
  const run = (mutate?: (tasks: Task[]) => void): Task[] | null => {
    const tasks = cloneTasksForSolve(ctx.tasks as Task[]);
    mutate?.(tasks);
    const r = solveProject({
      ...solve, tasks, sequences: [...ctx.sequences], calendar: ctx.calendar, calendars: [...ctx.calendars],
    });
    return r.error ? null : tasks;
  };
  const first = run();
  if (!first) return na(12, 'criticalPathTest', norm, 'notCalculated');
  const leaves0 = activityTasks(first);
  const end = completionTask(leaves0);
  if (!end) return na(12, 'criticalPathTest', norm, 'noTasks');
  const endPinned = !!end.constraint?.hard || !!end.constraint2?.hard;
  const unpin = (tasks: Task[]) => {
    const e = tasks.find(x => x.id === end.id);
    if (!e) return;
    if (e.constraint?.hard) delete e.constraint;
    if (e.constraint2?.hard) delete e.constraint2;
  };
  const before = endPinned ? run(unpin) : first;
  if (!before) return na(12, 'criticalPathTest', norm, 'notCalculated');
  const candidates = activityTasks(before)
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.time.isCritical && !t.isMilestone && t.id !== end.id && progressState(t) !== 'complete'
      && !t.constraint?.hard && !t.constraint2?.hard)
    .sort((a, b) => dayOf(taskStart(a.t)).localeCompare(dayOf(taskStart(b.t))) || a.i - b.i);
  const pick = candidates[0]?.t;
  if (!pick) return na(12, 'criticalPathTest', norm, 'noCandidate');

  const hpd = effHoursPerDay(effectiveCalendarOf(pick, ctx.calendar, ctx.calendars as WorkCalendar[]));
  const after = run(tasks => {
    if (endPinned) unpin(tasks);
    const t = tasks.find(x => x.id === pick.id);
    if (t) extendTask(t, CRITICAL_PATH_TEST_SLIP_DAYS, hpd);
  });
  if (!before || !after) return na(12, 'criticalPathTest', norm, 'notCalculated');
  const end0 = before.find(x => x.id === end.id)!;
  const end1 = after.find(x => x.id === end.id)!;
  const t1 = after.find(x => x.id === pick.id)!;
  const propagated = dayOf(taskFinish(end1)) >= dayOf(taskFinish(t1));
  const endShiftDays = signedWorkDaysBetween(makeEngineCache(ctx).project, dayOf(taskFinish(end0)), dayOf(taskFinish(end1)));
  return {
    point: 12, id: 'criticalPathTest', norm, result: propagated ? 'pass' : 'flag',
    test: {
      taskId: pick.id, wbs: pick.wbsCode, name: pick.name,
      endTaskId: end.id, endWbs: end.wbsCode, endName: end.name,
      slipDays: CRITICAL_PATH_TEST_SLIP_DAYS, endShiftDays,
    },
  };
}

function computeCpli(ctx: ReportContext, leaves: readonly Task[], statusDay: string, baseMap: Map<string, BaselineTask>): DcmaMetric {
  const norm: DcmaNorm = { kind: 'minIndex', value: MIN_INDEX };
  const end = completionTask(leaves);
  if (!end) return na(13, 'cpli', norm, 'noTasks');
  const endDay = dayOf(taskFinish(end));
  if (endDay < statusDay) return na(13, 'cpli', norm, 'finished');
  const engine = makeEngineCache(ctx).project;
  const cpl = engine.workDaysBetween(parseDate(statusDay), parseDate(endDay));
  if (cpl <= 0) return na(13, 'cpli', norm, 'finished');
  const bt = baseMap.get(end.id);
  const floatBasis = bt ? 'baseline' : 'schedule';
  const tf = bt ? signedWorkDaysBetween(engine, endDay, dayOf(bt.finish)) : end.time.totalFloat;
  const value = round2((cpl + tf) / cpl);
  return {
    point: 13, id: 'cpli', norm, result: value >= MIN_INDEX ? 'pass' : 'flag', value,
    cpli: { criticalPathLength: cpl, totalFloat: round1(tf), floatBasis },
  };
}

export function computeDcmaAssessment(ctx: ReportContext, logic: LogicIndex): DcmaAssessment {
  const solve = ctx.solveOptions;
  const { leaves, relations, byId, hasPred, hasSucc } = logic;
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  const statusDay = ctx.statusDate ? dayOf(ctx.statusDate) : undefined;
  const baseMap = new Map<string, BaselineTask>(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);

  const work = leaves.filter(t => !t.isMilestone);
  const incomplete = work.filter(t => progressState(t) !== 'complete');
  const incompleteIds = new Set(incomplete.map(t => t.id));
  const n = incomplete.length;
  const count = (pred: (t: Task) => boolean) => incomplete.filter(pred).length;

  const links = new Map<string, { type: string; lag: number }>();
  for (const s of relations) {
    if (!incompleteIds.has(s.successorId)) continue;
    const orig = originalSequenceId(s.id);
    if (links.has(orig)) continue;
    const pred = byId.get(s.predecessorId);
    if (!pred) continue;
    const hpd = effHoursPerDay(effectiveCalendarOf(pred, ctx.calendar, ctx.calendars as WorkCalendar[]));
    const shown = logic.originalSeqById.get(orig) ?? s;
    links.set(orig, { type: shown.type, lag: resolveEffectiveLagDays(s, pred, hpd) });
  }
  const linkList = [...links.values()];
  const l = linkList.length;

  const metrics: DcmaMetric[] = [];
  metrics.push(percentMetric(1, 'logic', { kind: 'maxPercent', value: MAX_PERCENT }, count(t => !hasPred.has(t.id) || !hasSucc.has(t.id)), n));
  metrics.push(percentMetric(2, 'leads', { kind: 'maxPercent', value: 0 }, linkList.filter(x => x.lag < 0).length, l));
  metrics.push(percentMetric(3, 'lags', { kind: 'maxPercent', value: MAX_PERCENT }, linkList.filter(x => x.lag > 0).length, l));
  metrics.push(percentMetric(4, 'relationshipTypes', { kind: 'minPercent', value: MIN_FS_PERCENT }, linkList.filter(x => x.type === 'FINISH_START').length, l));
  metrics.push(percentMetric(5, 'hardConstraints', { kind: 'maxPercent', value: MAX_PERCENT },
    count(t => isHardConstraint(t.constraint) || isHardConstraint(t.constraint2)), n));

  const floatNorm6: DcmaNorm = { kind: 'maxPercent', value: MAX_PERCENT };
  const floatNorm7: DcmaNorm = { kind: 'maxPercent', value: 0 };
  if (cpm) {
    metrics.push(percentMetric(6, 'highFloat', floatNorm6, count(t => t.time.totalFloat > DCMA_DAYS), n));
    metrics.push(percentMetric(7, 'negativeFloat', floatNorm7, count(t => t.time.totalFloat < 0), n));
  } else {
    metrics.push(na(6, 'highFloat', floatNorm6, 'notCalculated'));
    metrics.push(na(7, 'negativeFloat', floatNorm7, 'notCalculated'));
  }
  metrics.push(percentMetric(8, 'highDuration', { kind: 'maxPercent', value: MAX_PERCENT },
    count(t => {
      const baselineDuration = baseMap.get(t.id)?.duration;
      if (baselineDuration !== undefined) return baselineDuration > DCMA_DAYS;
      const calendar = effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]);
      return taskDurationMinutes(t, calendar) > DCMA_DAYS * effHoursPerDay(calendar) * 60;
    }), n));

  const invalidNorm: DcmaNorm = { kind: 'maxPercent', value: 0 };
  if (!ctx.statusDate || !statusDay) {
    metrics.push(na(9, 'invalidDates', invalidNorm, 'noStatusDate'));
  } else {
    const sd = ctx.statusDate;
    metrics.push(percentMetric(9, 'invalidDates', invalidNorm, count(t => invalidDateReasons(t, sd, statusDay, !!cpm,
      effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[])).length > 0), n));
  }

  const resourceNorm: DcmaNorm = { kind: 'maxPercent', value: 0 };
  const assigned = resourceLoadedTaskIds(ctx);
  if (assigned.size === 0) metrics.push(na(10, 'resources', resourceNorm, 'notResourceLoaded'));
  else metrics.push(percentMetric(10, 'resources', resourceNorm, count(t => durationDays(ctx, t) > 0 && !assigned.has(t.id)), n));

  const missedNorm: DcmaNorm = { kind: 'maxPercent', value: MAX_PERCENT };
  const beiNorm: DcmaNorm = { kind: 'minIndex', value: MIN_INDEX };
  if (!statusDay) {
    metrics.push(na(11, 'missedTasks', missedNorm, 'noStatusDate'));
  } else if (!ctx.baseline) {
    metrics.push(na(11, 'missedTasks', missedNorm, 'noBaseline'));
  } else {
    const due = work.filter(t => { const bt = baseMap.get(t.id); return !!bt && dayOf(bt.finish) <= statusDay; });
    if (due.length === 0) metrics.push(na(11, 'missedTasks', missedNorm, 'nothingDue'));
    else metrics.push(percentMetric(11, 'missedTasks', missedNorm, due.filter(t => isMissedTask(t, baseMap.get(t.id)!)).length, due.length));
  }

  if (!solve) metrics.push(na(12, 'criticalPathTest', { kind: 'test' }, 'notCalculated'));
  else if (!cpm || ctx.datesAsRecorded) metrics.push(na(12, 'criticalPathTest', { kind: 'test' }, 'notCalculated'));
  else metrics.push(criticalPathTest(ctx, solve));

  if (!statusDay) metrics.push(na(13, 'cpli', { kind: 'minIndex', value: MIN_INDEX }, 'noStatusDate'));
  else if (!cpm) metrics.push(na(13, 'cpli', { kind: 'minIndex', value: MIN_INDEX }, 'notCalculated'));
  else metrics.push(computeCpli(ctx, leaves, statusDay, baseMap));

  if (!statusDay) {
    metrics.push(na(14, 'bei', beiNorm, 'noStatusDate'));
  } else if (!ctx.baseline) {
    metrics.push(na(14, 'bei', beiNorm, 'noBaseline'));
  } else {
    const done = work.filter(t => progressState(t) === 'complete' && dayOf(t.time.actualFinish ?? taskFinish(t)) <= statusDay).length;
    const base = work.filter(t => { const bt = baseMap.get(t.id); return !bt || dayOf(bt.finish) <= statusDay; }).length;
    if (base === 0) metrics.push(na(14, 'bei', beiNorm, 'nothingDue'));
    else {
      const value = round2(done / base);
      metrics.push({ point: 14, id: 'bei', norm: beiNorm, result: value >= MIN_INDEX ? 'pass' : 'flag', count: done, base, value });
    }
  }

  return {
    metrics,
    incompleteCount: n,
    relationCount: l,
    flags: metrics.filter(m => m.result === 'flag').length,
    passes: metrics.filter(m => m.result === 'pass').length,
  };
}

export type InvalidDateReason = 'actualStartAfterStatusDate' | 'actualFinishAfterStatusDate' | 'forecastStartBeforeStatusDate' | 'forecastFinishBeforeStatusDate';

export function invalidDateReasons(t: Task, statusDate: string, statusDay: string, withForecast: boolean, calendar?: WorkCalendar): InvalidDateReason[] {
  const out: InvalidDateReason[] = [];
  const { actualStart, actualFinish } = t.time;
  if (actualStart && isTaskActualPastStatusDate(t, 'actualStart', actualStart, statusDate, calendar)) out.push('actualStartAfterStatusDate');
  if (actualFinish && isTaskActualPastStatusDate(t, 'actualFinish', actualFinish, statusDate, calendar)) out.push('actualFinishAfterStatusDate');
  if (!withForecast) return out;
  const state = progressState(t);
  if (state === 'notStarted' && dayOf(taskStart(t)) < statusDay) out.push('forecastStartBeforeStatusDate');
  if (state !== 'complete' && dayOf(taskFinish(t)) < statusDay) out.push('forecastFinishBeforeStatusDate');
  return out;
}

export function isMissedTask(t: Task, bt: BaselineTask): boolean {
  return dayOf(t.time.actualFinish ?? taskFinish(t)) > dayOf(bt.finish);
}

export function resourceLoadedTaskIds(ctx: ReportContext): Set<string> {
  const ids = new Set(ctx.assignments.map(a => a.taskId));
  for (const t of ctx.tasks) if (t.resourceIds?.length) ids.add(t.id);
  return ids;
}
