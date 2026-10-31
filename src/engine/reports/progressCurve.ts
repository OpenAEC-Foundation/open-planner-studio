import type { Task } from '@/types/task';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isDateOnly, isInstant } from '@/engine/calendar/workdayRules';
import { isHourModeCalendar } from '@/types/calendar';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { signedWorkDaysBetween } from '@/engine/variance';
import {
  type ReportContext, activityTasks, dayOf, durationDays, makeEngineCache, progressState, referenceDay, round1,
  scheduleSlip, taskFinish, taskStart,
} from './reportCommon';

/**
 * Voortgangscurve (issue #689): vier kerncijfers en een S-curve van de cumulatieve voortgang.
 * Spec: `docs/superpowers/specs/2026-10-27-voortgangscurve-rapport.md`.
 *
 * Alleen-lezen: het rapport leest wat de laatste berekening op de taken zette (getoonde data,
 * laatste data, speling, kritiek) en rekent niets door.
 *
 * Een CURVE telt per dag elke bladtaak mee met gewicht × het verstreken deel van haar venster:
 * werkdagen(start, dag) ÷ werkdagen(start, einde) op de kalender van de taak. Het gewicht is de duur
 * in werkdagen (`durationDays`), net als de gewogen voortgang van het voortgangsrapport; mijlpalen
 * wegen 0. De waarde op een dag is de stand aan het EINDE van die dag (de dag telt als gewerkt), dezelfde
 * telling als de geplande voortgang van `computeProgressReport`. Alleen een statusdatum mét tijd op een
 * uur-projectkalender is een moment: op dat punt telt het deel van de dag dat verstreken is, in de
 * dagenmaat van de kalender. Kerncijfer en curve lezen dan hetzelfde moment.
 *
 * De WERKELIJKE curve is een benadering: de app bewaart alleen de stand van nu. Per taak loopt de
 * voortgang lineair van de werkelijke start naar de huidige voltooiing — tot het werkelijke einde bij
 * een voltooide taak, tot de statusdatum bij een lopende taak.
 */

export interface CurvePoint {
  /** ISO-dag. */
  day: string;
  /** 0–100. */
  pct: number;
}

export interface ProgressCurveRiskRow {
  taskId: string;
  wbs: string;
  name: string;
  baselineFinish?: string;
  finish: string;
  /** Werkdagen, getekend (+ = later dan de baseline); alleen met een baseline-einde. */
  finishVarianceDays?: number;
  totalFloat: number;
  isCritical: boolean;
  /** Te laat (achterstallig of later dan de baseline). */
  late: boolean;
}

export interface ProgressCurveNextMilestone {
  taskId: string;
  name: string;
  day: string;
  /** Kalenderdagen vanaf de statusdatum; negatief = al voorbij. */
  daysUntil: number;
}

export interface ProgressCurveResult {
  statusDate: string;
  statusDateMissing: boolean;
  hasBaseline: boolean;
  /** Waar *Gepland* vandaan komt: de baseline, of zonder baseline de curve op vroegste data. */
  plannedBasis: 'baseline' | 'current';
  /** Gepland % op de statusdatum (één decimaal). */
  plannedPct: number;
  /** Werkelijk % op de statusdatum: de gewogen voltooiing (één decimaal). */
  actualPct: number;
  /** Is er bij enige taak voortgang ingevoerd? */
  hasProgress: boolean;
  /** Zijn de laatste data bruikbaar (planning berekend zonder fout)? */
  hasLateDates: boolean;
  /** Aantal taken met duur (die in de curve meetellen). */
  weightedTasks: number;
  /** As van de grafiek (ISO-dagen); afwezig zonder taken met duur. */
  axis?: { from: string; to: string };
  plannedCurve?: CurvePoint[];
  earlyCurve: CurvePoint[];
  lateCurve?: CurvePoint[];
  actualCurve: CurvePoint[];
  /** Asstrepen: eerste dag van een maand, of maandag bij een kort project. */
  ticks: { day: string; kind: 'month' | 'week' }[];
  lateTasks: { count: number; critical: number; basis: 'baseline' | 'schedule' };
  negativeFloat: { count: number; minDays?: number };
  nextMilestone?: ProgressCurveNextMilestone;
  baselineFinish?: string;
  forecastFinish?: string;
  finishVarianceDays?: number;
  riskRows: ProgressCurveRiskRow[];
}

/** Hoogstens zoveel meetpunten op de as; daarboven ligt er meer dan één dag tussen. */
export const PROGRESS_CURVE_MAX_SAMPLES = 240;

const DAY_MS = 86_400_000;
/** Dagnummer (dagen sinds 1970-01-01, UTC) van de dag-component van een ISO-datum. */
export function isoDayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
function isoOfDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Een venster op dagniveau (ISO-dagen), met de oorspronkelijke momenten voor een statusmoment met tijd. */
interface Window { start: string; finish: string; startAt: string; finishAt: string }

/** Waar het rapport de stand opneemt: het einde van `day`, of `moment` bij een statusdatum met tijd. */
interface StatusPoint { day: string; moment?: Date }

/**
 * Het verstreken deel (0–1) van een venster aan het EINDE van dag `atDay`, in werkdagen van de
 * taakkalender (beide grenzen inclusief, zoals `workDaysBetween`). Dezelfde telling als de geplande
 * voortgang van het voortgangsrapport: de statusdag telt als gewerkt.
 */
function elapsedFraction(eng: CalendarEngine, w: Window, atDay: string): number {
  if (atDay < w.start) return 0;
  if (atDay >= w.finish) return 1;
  const s = parseDate(w.start);
  const total = eng.workDaysBetween(s, parseDate(w.finish));
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, eng.workDaysBetween(s, parseDate(atDay)) / total));
}

/**
 * Het verstreken deel (0–1) van een venster op een statusmoment, in de dagenmaat van de taakkalender
 * (`measuredWorkdaysBetween`): elke werkdag telt 1, zoals in `elapsedFraction`. Een einde zonder tijd
 * bezet zijn hele dag. Een dagkalender kent geen tijd van de dag en telt de dag als geheel.
 */
function elapsedFractionAt(eng: CalendarEngine, w: Window, at: StatusPoint): number {
  if (!at.moment || !eng.isHourMode) return elapsedFraction(eng, w, at.day);
  const s = parseInstant(w.startAt);
  const f = isDateOnly(w.finishAt) ? new Date(parseDate(w.finishAt).getTime() + DAY_MS) : parseInstant(w.finishAt);
  if (at.moment <= s) return 0;
  if (at.moment >= f) return 1;
  const total = eng.measuredWorkdaysBetween(s, f);
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, eng.measuredWorkdaysBetween(s, at.moment) / total));
}

interface Weighted { task: Task; weight: number; eng: CalendarEngine }

/**
 * Cumulatieve curve over de meetpunten. Buiten het venster is het deel 0 of 1 (goedkoop, via een
 * verschilrij); alleen de meetpunten binnen het venster rekenen werkdagen. Zo blijft het O(punten +
 * Σ punten-in-venster), ook bij duizenden taken.
 */
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
    // Eerste punt op of na de startdag; vanaf het eerste punt op of na de einddag is de taak "vol".
    const i0 = Math.max(0, Math.ceil((isoDayNumber(win.start) - first) / step));
    const iFull = Math.max(0, Math.ceil((isoDayNumber(win.finish) - first) / step));
    for (let i = i0; i < Math.min(iFull, n); i++) sums[i] += amount * elapsedFraction(it.eng, win, samples[i]);
    if (iFull < n) full[iFull] += amount;
  }
  let acc = 0;
  return sums.map((v, i) => {
    acc += full[i];
    return totalWeight > 0 ? Math.min(100, ((v + acc) / totalWeight) * 100) : 0;
  });
}

function valueAt(items: readonly Weighted[], windowOf: (w: Weighted) => Window | undefined, at: StatusPoint, totalWeight: number): number {
  let sum = 0;
  for (const it of items) {
    const win = windowOf(it);
    if (win) sum += it.weight * elapsedFractionAt(it.eng, win, at);
  }
  return totalWeight > 0 ? (sum / totalWeight) * 100 : 0;
}

/** Een venster op dagniveau, met een einde nooit vóór de start. */
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

/** Asstrepen: maandstarts (uitgedund tot ±12), of maandagen bij minder dan drie maandstarts. */
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
  // 1970-01-01 (dag 0) was een donderdag ⇒ maandag = dag ≡ 4 (mod 7).
  let d = from + ((4 - (from % 7) + 7) % 7);
  for (; d <= to; d += 7) mondays.push(isoOfDayNum(d));
  const k = Math.max(1, Math.ceil(mondays.length / 12));
  return mondays.filter((_, i) => i % k === 0).map(day => ({ day, kind: 'week' as const }));
}

export function computeProgressCurve(ctx: ReportContext): ProgressCurveResult {
  const { day: ref, statusDateMissing } = referenceDay(ctx);
  // De tijd telt alleen op een uur-projectkalender, zoals in de motor (`isHourModeCalendar`).
  const statusPoint: StatusPoint = {
    day: ref,
    moment: ctx.statusDate && isInstant(ctx.statusDate) && isHourModeCalendar(ctx.calendar) ? parseInstant(ctx.statusDate) : undefined,
  };
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
    const finish = state === 'complete' ? (t.time.actualFinish || taskFinish(t)) : ref;
    return win(start, finish);
  };
  const actualScale = (w: Weighted) => (progressState(w.task) === 'complete' ? 1 : Math.min(1, Math.max(0, w.task.time.completion)));

  // ── As en meetpunten ──
  let lo = Infinity;
  let hi = -Infinity;
  const span = (w: Window | undefined) => {
    if (!w) return;
    // Eén dag vóór de eerste start, zodat elke curve op 0 % begint; tot de laatste einddag (100 %).
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

  // Elke curve krijgt naast het raster een exact punt OP de statusdatum: bij een lang project ligt de
  // statusdag tussen twee meetpunten, en dan moet *Gepland* toch gelijk zijn aan het punt in de grafiek.
  const one = () => 1;
  const curve = (windowOf: (w: Weighted) => Window | undefined): CurvePoint[] => {
    const pts = curveOver(items, windowOf, one, samples, totalWeight).map((pct, i) => ({ day: samples[i], pct: round2(pct) }));
    const at = { day: ref, pct: round2(valueAt(items, windowOf, statusPoint, totalWeight)) };
    const i = pts.findIndex(p => p.day >= ref);
    if (i < 0) pts.push(at);
    else if (pts[i].day === ref) pts[i] = at;
    else pts.splice(i, 0, at);
    return pts;
  };
  const earlyCurve = samples.length ? curve(earlyWin) : [];
  const plannedCurve = hasBaseline && samples.length ? curve(plannedWin) : undefined;
  const lateCurve = hasLateDates && samples.length ? curve(lateWin) : undefined;

  // Werkelijk: de meetpunten vóór de statusdatum, plus een exact punt OP de statusdatum.
  const actualPct = totalWeight > 0 ? (actualSum / totalWeight) * 100 : 0;
  let actualCurve: CurvePoint[] = [];
  if (samples.length) {
    const upto = samples.filter(d => d < ref);
    const vals = upto.length ? curveOver(items, actualWin, actualScale, upto, totalWeight) : [];
    actualCurve = vals.map((pct, i) => ({ day: upto[i], pct: round2(pct) }));
    actualCurve.push({ day: ref, pct: round2(actualPct) });
  }

  const plannedPct = valueAt(items, hasBaseline ? plannedWin : earlyWin, statusPoint, totalWeight);

  // ── Kerncijfers en risicotaken ──
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
