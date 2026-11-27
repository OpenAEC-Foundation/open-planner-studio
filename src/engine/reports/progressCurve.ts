import type { Task } from '@/types/task';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import {
  type ReportContext, activityTasks, dayOf, durationDays, elapsedWorkFraction, makeEngineCache, progressState, referenceDay,
  round1, scheduleSlip, statusMoment, taskFinish, taskStart,
} from './reportCommon';

export interface CurvePoint {
  day: string;
  pct: number;
}

export interface ProgressCurveRiskRow {
  taskId: string;
  wbs: string;
  name: string;
  baselineFinish?: string;
  finish: string;
  finishVarianceDays?: number;
  totalFloat: number;
  isCritical: boolean;
  late: boolean;
}

export interface ProgressCurveNextMilestone {
  taskId: string;
  name: string;
  day: string;
  daysUntil: number;
}

export interface ProgressCurveResult {
  statusDate: string;
  statusDateMissing: boolean;
  hasBaseline: boolean;
  plannedBasis: 'baseline' | 'current';
  plannedPct: number;
  actualPct: number;
  hasProgress: boolean;
  hasLateDates: boolean;
  weightedTasks: number;
  axis?: { from: string; to: string };
  plannedCurve?: CurvePoint[];
  earlyCurve: CurvePoint[];
  lateCurve?: CurvePoint[];
  actualCurve: CurvePoint[];
  ticks: { day: string; kind: 'month' | 'week' }[];
  lateTasks: { count: number; critical: number; basis: 'baseline' | 'schedule' };
  negativeFloat: { count: number; minDays?: number };
  nextMilestone?: ProgressCurveNextMilestone;
  baselineFinish?: string;
  forecastFinish?: string;
  finishVarianceDays?: number;
  riskRows: ProgressCurveRiskRow[];
}

export const PROGRESS_CURVE_MAX_SAMPLES = 240;

const DAY_MS = 86_400_000;
export function isoDayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
function isoOfDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

interface Window { start: string; finish: string; startAt: string; finishAt: string }

interface Weighted { task: Task; weight: number; eng: CalendarEngine }

function curveOver(
  items: readonly Weighted[], windowOf: (w: Weighted) => Window | undefined, valueScale: (w: Weighted) => number,
  samples: readonly string[], totalWeight: number,
): number[] {
  const n = samples.length;
  const sums = new Array<number>(n).fill(0);
  const full = new Array<number>(n + 1).fill(0);
  const first = isoDayNumber(samples[0]);
  const step = n > 1 ? isoDayNumber(samples[1]) - first : 1;
  for (const it of items) {
    const win = windowOf(it);
    if (!win) continue;
    const amount = it.weight * valueScale(it);
    if (amount <= 0) continue;
    const i0 = Math.max(0, Math.ceil((isoDayNumber(win.start) - first) / step));
    const iFull = Math.max(0, Math.ceil((isoDayNumber(win.finish) - first) / step));
    for (let i = i0; i < Math.min(iFull, n); i++) sums[i] += amount * elapsedWorkFraction(it.eng, win.startAt, win.finishAt, samples[i]);
    if (iFull < n) full[iFull] += amount;
  }
  let acc = 0;
  return sums.map((v, i) => {
    acc += full[i];
    return totalWeight > 0 ? Math.min(100, ((v + acc) / totalWeight) * 100) : 0;
  });
}

function valueAt(items: readonly Weighted[], windowOf: (w: Weighted) => Window | undefined, day: string, moment: Date | undefined, totalWeight: number): number {
  let sum = 0;
  for (const it of items) {
    const win = windowOf(it);
    if (win) sum += it.weight * elapsedWorkFraction(it.eng, win.startAt, win.finishAt, day, moment);
  }
  return totalWeight > 0 ? (sum / totalWeight) * 100 : 0;
}

function win(start: string | undefined, finish: string | undefined): Window | undefined {
  if (!start || !finish) return undefined;
  const s = dayOf(start);
  const f = dayOf(finish);
  return f < s
    ? { start: s, finish: s, startAt: start, finishAt: start }
    : { start: s, finish: f, startAt: start, finishAt: finish };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function axisTicks(from: number, to: number): { day: string; kind: 'month' | 'week' }[] {
  const months: string[] = [];
  const f = isoOfDayNum(from);
  let y = Number(f.slice(0, 4));
  let m = Number(f.slice(5, 7));
  if (Number(f.slice(8, 10)) !== 1) { m++; if (m > 12) { m = 1; y++; } }
  for (;;) {
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    if (isoDayNumber(iso) > to) break;
    months.push(iso);
    m++; if (m > 12) { m = 1; y++; }
  }
  if (months.length >= 3) {
    const k = Math.ceil(months.length / 12);
    return months.filter((_, i) => i % k === 0).map(day => ({ day, kind: 'month' as const }));
  }
  const mondays: string[] = [];
  let d = from + ((4 - (from % 7) + 7) % 7);
  for (; d <= to; d += 7) mondays.push(isoOfDayNum(d));
  const k = Math.max(1, Math.ceil(mondays.length / 12));
  return mondays.filter((_, i) => i % k === 0).map(day => ({ day, kind: 'week' as const }));
}

export function computeProgressCurve(ctx: ReportContext): ProgressCurveResult {
  const { day: ref, statusDateMissing } = referenceDay(ctx);
  const moment = statusMoment(ctx);
  const engines = makeEngineCache(ctx);
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const hasBaseline = !!ctx.baseline;
  const cpm = ctx.cpmResult && !ctx.cpmResult.error ? ctx.cpmResult : null;
  const hasLateDates = !!cpm;

  const leaves = activityTasks(ctx.tasks);
  const items: Weighted[] = [];
  let totalWeight = 0;
  let actualSum = 0;
  let hasProgress = false;
  for (const t of leaves) {
    if (t.time.completion > 0 || progressState(t) !== 'notStarted') hasProgress = true;
    const weight = durationDays(ctx, t);
    if (!(weight > 0)) continue;
    items.push({ task: t, weight, eng: engines.forTask(t) });
    totalWeight += weight;
    actualSum += weight * Math.min(1, Math.max(0, progressState(t) === 'complete' ? 1 : t.time.completion));
  }

  const earlyWin = (w: Weighted) => win(taskStart(w.task), taskFinish(w.task));
  const plannedWin = (w: Weighted) => {
    const b = baseMap.get(w.task.id);
    return b ? win(b.start, b.finish) : earlyWin(w);
  };
  const lateWin = (w: Weighted): Window | undefined => {
    const t = w.task;
    const state = progressState(t);
    if (state === 'complete') return earlyWin(w);
    const start = state === 'inProgress' ? taskStart(t) : (t.time.lateStart || taskStart(t));
    return win(start, t.time.lateFinish || taskFinish(t));
  };
  const actualWin = (w: Weighted): Window | undefined => {
    const t = w.task;
    const state = progressState(t);
    if (state === 'notStarted' && !(t.time.completion > 0)) return undefined;
    const start = t.time.actualStart || taskStart(t);
    const finish = state === 'complete' ? (t.time.actualFinish || taskFinish(t)) : (moment ? ctx.statusDate : ref);
    return win(start, finish);
  };
  const actualScale = (w: Weighted) => (progressState(w.task) === 'complete' ? 1 : Math.min(1, Math.max(0, w.task.time.completion)));

  let lo = Infinity;
  let hi = -Infinity;
  const span = (w: Window | undefined) => {
    if (!w) return;
    lo = Math.min(lo, isoDayNumber(w.start) - 1);
    hi = Math.max(hi, isoDayNumber(w.finish));
  };
  for (const it of items) {
    span(earlyWin(it));
    if (hasBaseline) span(plannedWin(it));
    if (hasLateDates) span(lateWin(it));
    span(actualWin(it));
  }
  let axis: ProgressCurveResult['axis'];
  let samples: string[] = [];
  if (items.length > 0 && Number.isFinite(lo)) {
    const refNum = isoDayNumber(ref);
    lo = Math.min(lo, refNum);
    hi = Math.max(hi, refNum);
    const step = Math.max(1, Math.ceil((hi - lo) / (PROGRESS_CURVE_MAX_SAMPLES - 1)));
    for (let d = lo; d < hi; d += step) samples.push(isoOfDayNum(d));
    samples.push(isoOfDayNum(hi));
    axis = { from: samples[0], to: samples[samples.length - 1] };
  }

  const one = () => 1;
  const curve = (windowOf: (w: Weighted) => Window | undefined): CurvePoint[] => {
    const pts = curveOver(items, windowOf, one, samples, totalWeight).map((pct, i) => ({ day: samples[i], pct: round2(pct) }));
    const at = { day: ref, pct: round2(valueAt(items, windowOf, ref, moment, totalWeight)) };
    const i = pts.findIndex(p => p.day >= ref);
    if (i < 0) pts.push(at);
    else if (pts[i].day === ref && (!moment || pts[i].pct === at.pct)) pts[i] = at;
    else pts.splice(i, 0, at);
    return pts;
  };
  const earlyCurve = samples.length ? curve(earlyWin) : [];
  const plannedCurve = hasBaseline && samples.length ? curve(plannedWin) : undefined;
  const lateCurve = hasLateDates && samples.length ? curve(lateWin) : undefined;

  const actualPct = totalWeight > 0 ? (actualSum / totalWeight) * 100 : 0;
  let actualCurve: CurvePoint[] = [];
  if (samples.length) {
    const upto = samples.filter(d => d < ref);
    const vals = upto.length ? curveOver(items, actualWin, actualScale, upto, totalWeight) : [];
    actualCurve = vals.map((pct, i) => ({ day: upto[i], pct: round2(pct) }));
    actualCurve.push({ day: ref, pct: round2(actualPct) });
  }

  const plannedPct = valueAt(items, hasBaseline ? plannedWin : earlyWin, ref, moment, totalWeight);

  let lateCount = 0;
  let lateCritical = 0;
  let negCount = 0;
  let minFloat: number | undefined;
  const riskRows: ProgressCurveRiskRow[] = [];
  let next: ProgressCurveNextMilestone | undefined;
  let nextWbs = '';
  for (const t of leaves) {
    const state = progressState(t);
    if (state === 'complete') continue;
    const finish = taskFinish(t);
    const bt = baseMap.get(t.id);
    const slip = scheduleSlip(t, state, ref) !== undefined;
    const afterBaseline = !!bt && dayOf(finish) > dayOf(bt.finish);
    const late = slip || afterBaseline;
    const tf = t.time.totalFloat;
    const negative = Number.isFinite(tf) && tf < 0;
    if (late) {
      lateCount++;
      if (t.time.isCritical) lateCritical++;
    }
    if (negative) {
      negCount++;
      minFloat = minFloat === undefined ? tf : Math.min(minFloat, tf);
    }
    if (late || negative) {
      riskRows.push({
        taskId: t.id, wbs: t.wbsCode, name: t.name,
        baselineFinish: bt?.finish, finish,
        finishVarianceDays: bt ? signedWorkDaysBetween(engines.forTask(t), bt.finish, finish) : undefined,
        totalFloat: tf, isCritical: t.time.isCritical, late,
      });
    }
    if (t.isMilestone) {
      const day = dayOf(finish);
      if (day && (!next || day < next.day || (day === next.day && t.wbsCode.localeCompare(nextWbs) < 0))) {
        next = { taskId: t.id, name: t.name, day, daysUntil: isoDayNumber(day) - isoDayNumber(ref) };
        nextWbs = t.wbsCode;
      }
    }
  }
  riskRows.sort((a, b) => a.totalFloat - b.totalFloat || a.finish.localeCompare(b.finish) || a.wbs.localeCompare(b.wbs));

  const forecastFinish = cpm?.projectEnd
    ?? (leaves.length ? leaves.map(taskFinish).sort()[leaves.length - 1] : undefined);
  const baselineFinish = ctx.baseline?.projectEnd;
  const finishVarianceDays = baselineFinish && forecastFinish
    ? signedWorkDaysBetween(engines.project, baselineFinish, forecastFinish)
    : undefined;

  return {
    statusDate: ref,
    statusDateMissing,
    hasBaseline,
    plannedBasis: hasBaseline ? 'baseline' : 'current',
    plannedPct: round1(plannedPct),
    actualPct: round1(actualPct),
    hasProgress,
    hasLateDates,
    weightedTasks: items.length,
    axis,
    plannedCurve,
    earlyCurve,
    lateCurve,
    actualCurve,
    ticks: axis ? axisTicks(isoDayNumber(axis.from), isoDayNumber(axis.to)) : [],
    lateTasks: { count: lateCount, critical: lateCritical, basis: hasBaseline ? 'baseline' : 'schedule' },
    negativeFloat: { count: negCount, minDays: minFloat === undefined ? undefined : round1(minFloat) },
    nextMilestone: next,
    baselineFinish,
    forecastFinish,
    finishVarianceDays,
    riskRows,
  };
}
