import type { Task } from '@/types/task';
import { parseDate } from '@/utils/dateUtils';
import {
  type ReportContext, type ProgressState, dayOf, durationDays, isNearCritical, activityTasks, makeEngineCache, progressState,
  referenceDay, remainingDays, round1, signedWorkDays, taskFinish, taskStart, windowEnd, windowStart,
} from './reportCommon';

/**
 * Voortgangs-/statusrapport (discussie #31, rapport 4): het periodieke "waar staan we"-overzicht
 * op de statusdatum.
 *
 * SAMENVATTING — statusdatum, baseline- en prognose-einde met het verschil in werkdagen, geplande
 * versus werkelijke voortgang en de tellingen per staat.
 *
 * Geplande en werkelijke voortgang zijn DUURGEWOGEN over de bladtaken (het voorstel noemt dat
 * terecht de aanbevolen methode; een kaal gemiddelde laat een mijlpaal even zwaar wegen als een
 * maand werk). Gepland = per taak het aandeel van de duur dat op de referentiedag verstreken had
 * moeten zijn, gemeten op de BASELINE-datums als er een actieve baseline is (dat is de afspraak
 * waartegen je meet), anders op de huidige planning (`plannedBasis` vertelt welke). Werkelijk =
 * de ingevoerde completion, gewogen met dezelfde duur.
 *
 * SECTIES — voltooid in de afgelopen periode, in uitvoering, start in de komende periode,
 * achterstallig (had moeten starten/eindigen) en kritieke open activiteiten. Eén taak kan in
 * meerdere secties staan (in uitvoering én kritiek); dat is bewust — elke sectie beantwoordt
 * een eigen vraag.
 */
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
  totalFloat: number;
  isCritical: boolean;
  isNearCritical: boolean;
  /** Voortgangsstaat — de drie tellingen `complete`/`inProgress`/`notStarted` sommeren tot `total`. */
  state: ProgressState;
  /** Achterstallig, ORTHOGONAAL aan de staat: een lopende taak die te laat is blijft "in uitvoering"
   *  én is achterstallig (issue #110-review, bevinding 4). */
  overdue?: 'start' | 'finish';
  /** Weergavestatus: achterstallig wint van de staat. */
  status: ProgressRowStatus;
}

export interface ProgressReportOptions {
  /** Rapportageperiode in weken: terugkijken (voltooid) en vooruitkijken (start binnenkort). */
  periodWeeks: number;
  nearCriticalDays: number;
}

export interface ProgressSummary {
  statusDate: string;
  statusDateMissing: boolean;
  periodFrom: string;
  periodTo: string;
  baselineFinish?: string;
  forecastFinish?: string;
  /** Werkdagen, getekend (+ = later dan de baseline). */
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

function overdueOf(t: Task, state: ProgressState, refDay: string): ProgressRow['overdue'] {
  if (state === 'complete') return undefined;
  if (dayOf(taskFinish(t)) < refDay) return 'finish';
  if (state === 'notStarted' && dayOf(taskStart(t)) < refDay) return 'start';
  return undefined;
}

export function computeProgressReport(ctx: ReportContext, opts: ProgressReportOptions): ProgressReportResult {
  const { day: ref, statusDateMissing } = referenceDay(ctx);
  const periodDays = Math.max(1, Math.round(opts.periodWeeks)) * 7;
  const periodFrom = windowStart(ref, periodDays);
  const periodTo = windowEnd(ref, periodDays + 1).slice(0, 10); // ref + periodDays kalenderdagen
  const engineFor = makeEngineCache(ctx);
  const baseMap = new Map(ctx.baseline ? ctx.baseline.tasks.map(b => [b.taskId, b]) : []);
  const refDate = parseDate(ref);

  const leaves = activityTasks(ctx.tasks);
  const rows = new Map<string, ProgressRow>();
  let weightSum = 0;
  let plannedSum = 0;
  let actualSum = 0;

  const leafById = new Map(leaves.map(t => [t.id, t]));
  for (const t of leaves) {
    const bt = baseMap.get(t.id);
    const state = progressState(t);
    const overdue = overdueOf(t, state, ref);
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
      totalFloat: t.time.totalFloat,
      isCritical: t.time.isCritical,
      isNearCritical: isNearCritical(t, opts.nearCriticalDays),
      state,
      overdue,
      status,
    });

    // Duurgewogen voortgang. Gewicht = de HUIDIGE duur van de taak in werkdagen (óók mét baseline:
    // `BaselineTask.duration` is `scheduleDuration`, dat voor een uur-taak niet canoniek is en de
    // taak 10× te zwaar zou wegen — review-bevinding 5); mijlpalen wegen 0 en tellen dus niet mee.
    // De GEPLANDE fractie wordt wél op de baseline-DATUMS gemeten wanneer die er zijn.
    const weight = durationDays(ctx, t);
    if (weight <= 0) continue;
    const start = bt ? bt.start : taskStart(t);
    const finish = bt ? bt.finish : taskFinish(t);
    const eng = engineFor(t);
    let plannedFrac: number;
    if (refDate < parseDate(start)) plannedFrac = 0;
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
  const projectEngine = engineFor({ calendarId: undefined } as unknown as Task);
  const finishVarianceDays = baselineFinish && forecastFinish
    ? signedWorkDays(projectEngine, baselineFinish, forecastFinish)
    : undefined;

  const completedInPeriod = all.filter(r => {
    if (r.state !== 'complete') return false;
    const done = dayOf(r.actualFinish ?? r.finish);
    return done >= periodFrom && done <= ref;
  });
  const inProgress = all.filter(r => r.state === 'inProgress');
  const startingNext = all.filter(r => {
    if (r.state !== 'notStarted' || r.overdue) return false;
    const s = dayOf(taskStart(leafById.get(r.taskId)!));
    return s >= ref && s <= periodTo;
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
