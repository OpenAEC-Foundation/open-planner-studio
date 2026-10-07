import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { BaselineTask } from '@/types/baseline';
import { originalSequenceId } from '@/engine/scheduler/expandSummaryRelations';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { isActualPastStatusDate } from '@/engine/taskMutationRules';
import { effHoursPerDay, effectiveCalendarOf } from '@/utils/taskDuration';
import { parseDate } from '@/utils/dateUtils';
import { signedWorkDaysBetween } from '@/engine/variance';
import {
  type ReportContext, activityTasks, dayOf, durationDays, makeEngineCache, progressState, taskFinish, taskStart,
} from './reportCommon';
import { type LogicIndex, isHardConstraint } from './logicIndex';

/**
 * De DCMA 14-puntsbeoordeling: de veertien planningscontroles van de Amerikaanse Defense Contract
 * Management Agency, met hun formules en normen zoals vastgelegd in hoofdstuk 4 (en §3.1.2.3–3.1.2.4
 * voor CPLI en BEI) van de *Earned Value Management System Program Analysis Pamphlet*,
 * DCMA-EA PAM 200.1, oktober 2012 — de laatst gepubliceerde versie.
 *
 * Een "markering" is geen afkeuring. Het pamflet zelf: een rode metriek "is not in and of itself
 * synonymous with failure but rather an indicator or a catalyst to dig deeper". Daarom heet de
 * uitslag hier `flag`, niet "gezakt".
 *
 * POPULATIE (PAM §4.0): de telling sluit voltooide taken, LOE-taken (hier: hammocks), verzameltaken
 * en mijlpalen uit. "Niet-voltooide taken" is dus overal: bladtaak, geen hammock, geen mijlpaal,
 * niet voltooid. Relaties (punt 2–4) tellen mee als hun OPVOLGER zo'n taak is (PAM: "predecessor
 * relationships for incomplete tasks"); een faserelatie telt één keer, zoals de planner hem ziet.
 *
 * EIGEN KEUZES, waar het pamflet niets vastlegt of OPS het begrip niet kent (staan ook in de gids):
 * - Hoge duur (punt 8): de baselineduur als de taak in de actieve baseline staat, anders de huidige
 *   duur. Het pamflet telt alleen taken met een baselinestart binnen de detailplanningsperiode
 *   (rolling wave); die periode kent OPS niet, dus elke niet-voltooide taak telt.
 * - Resources (punt 10): alleen als het project resources gebruikt (minstens één toewijzing); anders
 *   n.v.t., zoals het pamflet voorschrijft voor een planning die niet resource-geladen is. Kosten
 *   zonder resource kent OPS niet.
 * - Punten 9, 11, 13 en 14 meten tegen de statusdatum; zonder statusdatum zijn ze n.v.t. (niet
 *   "vandaag", zoals andere rapporten: het pamflet definieert ze op de statusdatum van de planning).
 * - Kritiek-padtest (punt 12): zie `criticalPathTest`.
 * - CPLI (punt 13): zie `computeCpli`.
 */
export type DcmaMetricId =
  | 'logic' | 'leads' | 'lags' | 'relationshipTypes' | 'hardConstraints' | 'highFloat' | 'negativeFloat'
  | 'highDuration' | 'invalidDates' | 'resources' | 'missedTasks' | 'criticalPathTest' | 'cpli' | 'bei';

export type DcmaResult = 'pass' | 'flag' | 'na';

export type DcmaNaReason =
  | 'notCalculated' | 'noTasks' | 'noRelations' | 'noStatusDate' | 'noBaseline' | 'nothingDue'
  | 'notResourceLoaded' | 'noCandidate' | 'finished';

/** Norm: percentage ≤ max, percentage ≥ min, index ≥ min, of een test die moet slagen. */
export type DcmaNorm =
  | { kind: 'maxPercent'; value: number }
  | { kind: 'minPercent'; value: number }
  | { kind: 'minIndex'; value: number }
  | { kind: 'test' };

export interface DcmaMetric {
  /** 1–14, de nummering van het pamflet. */
  point: number;
  id: DcmaMetricId;
  norm: DcmaNorm;
  result: DcmaResult;
  naReason?: DcmaNaReason;
  /** Teller en noemer van een percentage of index. */
  count?: number;
  base?: number;
  /** Percentage (0–100, één decimaal) of index (twee decimalen). */
  value?: number;
  /** Alleen de kritiek-padtest. */
  test?: CriticalPathTestDetail;
  /** Alleen CPLI: de twee termen van de formule, in werkdagen. */
  cpli?: { criticalPathLength: number; totalFloat: number; floatBasis: 'baseline' | 'schedule' };
}

export interface CriticalPathTestDetail {
  /** De vertraagde taak. */
  taskId: string;
  wbs: string;
  name: string;
  /** De eindtaak waarop de test meet. */
  endTaskId: string;
  endWbs: string;
  endName: string;
  /** Toegevoegde duur in werkdagen. */
  slipDays: number;
  /** Hoeveel werkdagen (projectkalender) de eindtaak daardoor opschoof. */
  endShiftDays: number;
}

export interface DcmaAssessment {
  metrics: DcmaMetric[];
  /** Noemer van de taakpercentages: niet-voltooide taken volgens de DCMA-populatie. */
  incompleteCount: number;
  /** Noemer van de relatiepercentages. */
  relationCount: number;
  flags: number;
  passes: number;
}

/** De normen uit PAM 200.1. 44 werkdagen = "2 maanden" (§4.6, §4.8). */
export const DCMA_DAYS = 44;
const MAX_PERCENT = 5;
const MIN_FS_PERCENT = 90;
const MIN_INDEX = 0.95;
/**
 * Vertraging die de kritiek-padtest toevoegt. Het pamflet zegt alleen dat de duur "grossly" verlengd
 * moet worden en noemt geen getal; 100 werkdagen is onze keuze — groot genoeg om boven elke
 * realistische speling uit te komen, klein genoeg om de kalender niet voorbij zijn bereik te duwen.
 */
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

/**
 * De eindtaak: de activiteit met het laatste vroege einde; bij gelijke stand een mijlpaal, daarna
 * de laatste in de lijst. Dat is de taak waarop het pamflet CPLI en de kritiek-padtest meet
 * ("the project completion date (or other milestone)").
 */
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

/** Verleng de (rest)duur van een taak met `days` werkdagen in haar eigen kalender. */
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

/**
 * Kritiek-padtest (PAM §4.12): verleng de duur van een kritieke taak flink en kijk of de eindtaak
 * evenredig opschuift. Doet ze dat niet, dan zit er ergens gebroken logica.
 *
 * Werkwijze, op KLONEN van de taken (het document blijft onaangeroerd, en een verouderde berekening
 * telt niet mee, want elke run rekent vers):
 * 1. Reken de planning door en bepaal de eindtaak (`completionTask`).
 * 2. Kies de testtaak: de kritieke, niet-voltooide activiteit (geen mijlpaal, niet de eindtaak, geen
 *    verplichte constraint die haar vastpint) met de vroegste start — die test de langste keten.
 * 3. Verleng haar duur met `CRITICAL_PATH_TEST_SLIP_DAYS` en reken opnieuw.
 * 4. Geslaagd als de eindtaak daarna niet vóór de testtaak eindigt: de vertraging liep door tot het
 *    einde. Eindigt de testtaak later dan de eindtaak, dan hangt ze er niet (via haar einde) aan vast.
 *
 * Een VERPLICHTE pin op de eindtaak (`hard`) gaat in de vergelijkingsruns uit. Zo'n pin houdt in OPS
 * de eindtaak op haar datum met speling 0 en drijft de negatieve speling stroomopwaarts; het pamflet
 * rekent dat als geslaagd ("show a negative total float number"). Zonder pin toetst de test precies
 * de vraag of de logica de vertraging doorgeeft, wat dezelfde uitkomst geeft.
 */
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
  const candidates = leaves0
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.time.isCritical && !t.isMilestone && t.id !== end.id && progressState(t) !== 'complete'
      && !t.constraint?.hard && !t.constraint2?.hard)
    .sort((a, b) => dayOf(taskStart(a.t)).localeCompare(dayOf(taskStart(b.t))) || a.i - b.i);
  const pick = candidates[0]?.t;
  if (!pick) return na(12, 'criticalPathTest', norm, 'noCandidate');

  const endPinned = !!end.constraint?.hard || !!end.constraint2?.hard;
  const unpin = (tasks: Task[]) => {
    const e = tasks.find(x => x.id === end.id);
    if (!e) return;
    if (e.constraint?.hard) e.constraint = { ...e.constraint, hard: false };
    if (e.constraint2?.hard) e.constraint2 = { ...e.constraint2, hard: false };
  };
  const before = endPinned ? run(unpin) : first;
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

/**
 * CPLI (PAM §3.1.2.3) = (CPL + TF) / CPL.
 * - CPL: de lengte in werkdagen (projectkalender, beide dagen meegeteld) van de statusdatum tot het
 *   einde van de eindtaak.
 * - TF: de speling van de eindtaak "relative to the baselined finish date" — dus het verschil in
 *   werkdagen tussen het huidige en het baseline-einde van die taak (positief = vóór de baseline).
 *   Staat de eindtaak niet in de baseline, dan haar berekende totale speling (die volgt uit een
 *   deadline of constraint, en is anders 0).
 */
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

  // Relaties naar een niet-voltooide taak, één keer per gemodelleerde relatie.
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
    count(t => (baseMap.get(t.id)?.duration ?? durationDays(ctx, t)) > DCMA_DAYS), n));

  const invalidNorm: DcmaNorm = { kind: 'maxPercent', value: 0 };
  if (!ctx.statusDate || !statusDay) {
    metrics.push(na(9, 'invalidDates', invalidNorm, 'noStatusDate'));
  } else {
    const sd = ctx.statusDate;
    metrics.push(percentMetric(9, 'invalidDates', invalidNorm, count(t => invalidDateReasons(t, sd, statusDay, !!cpm).length > 0), n));
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
  else if (!cpm) metrics.push(na(12, 'criticalPathTest', { kind: 'test' }, 'notCalculated'));
  else metrics.push(criticalPathTest(ctx, solve));

  if (!statusDay) metrics.push(na(13, 'cpli', { kind: 'minIndex', value: MIN_INDEX }, 'noStatusDate'));
  else if (!cpm) metrics.push(na(13, 'cpli', { kind: 'minIndex', value: MIN_INDEX }, 'notCalculated'));
  else metrics.push(computeCpli(ctx, leaves, statusDay, baseMap));

  if (!statusDay) {
    metrics.push(na(14, 'bei', beiNorm, 'noStatusDate'));
  } else if (!ctx.baseline) {
    metrics.push(na(14, 'bei', beiNorm, 'noBaseline'));
  } else {
    // PAM §3.1.2.4: voltooid (werkelijk einde op of vóór de statusdatum) gedeeld door de taken met een
    // baseline-einde op of vóór de statusdatum PLUS de taken zonder baseline-einde.
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

/**
 * Ongeldige datum (PAM §4.9): een werkelijke start of einde ná de statusdatum, of een prognose
 * vóór de statusdatum — de start van een niet-gestarte taak, het einde van een niet-voltooide taak.
 * "Ná" met dezelfde precisie als het raster (`isActualPastStatusDate`); "vóór" op dagniveau, want de
 * statusdatum is de eerste dag van het restwerk (data-date-vloer van de solver). De prognose telt
 * alleen ná een berekening (`withForecast`): daarvóór zijn de getoonde datums de geplande, geen
 * prognose.
 */
export type InvalidDateReason = 'actualStartAfterStatusDate' | 'actualFinishAfterStatusDate' | 'forecastStartBeforeStatusDate' | 'forecastFinishBeforeStatusDate';

export function invalidDateReasons(t: Task, statusDate: string, statusDay: string, withForecast: boolean): InvalidDateReason[] {
  const out: InvalidDateReason[] = [];
  const { actualStart, actualFinish } = t.time;
  if (actualStart && isActualPastStatusDate(actualStart, statusDate)) out.push('actualStartAfterStatusDate');
  if (actualFinish && isActualPastStatusDate(actualFinish, statusDate)) out.push('actualFinishAfterStatusDate');
  if (!withForecast) return out;
  const state = progressState(t);
  if (state === 'notStarted' && dayOf(taskStart(t)) < statusDay) out.push('forecastStartBeforeStatusDate');
  if (state !== 'complete' && dayOf(taskFinish(t)) < statusDay) out.push('forecastFinishBeforeStatusDate');
  return out;
}

/** Gemiste taak (PAM §4.11): het werkelijke of prognose-einde ligt ná het baseline-einde. */
export function isMissedTask(t: Task, bt: BaselineTask): boolean {
  return dayOf(t.time.actualFinish ?? taskFinish(t)) > dayOf(bt.finish);
}

/** Taken met minstens één resource; leeg = het project is niet resource-geladen. */
export function resourceLoadedTaskIds(ctx: ReportContext): Set<string> {
  const ids = new Set(ctx.assignments.map(a => a.taskId));
  for (const t of ctx.tasks) if (t.resourceIds?.length) ids.add(t.id);
  return ids;
}
