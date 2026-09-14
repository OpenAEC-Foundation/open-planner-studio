// Tabelrapporten (discussie #31, manuvarkey): look-ahead, kritiek/near-critical, voortgang,
// planningsgezondheid, resourcebelasting, resourcetoewijzingen en WBS-samenvatting.
//
// De engine in `src/engine/reports/` is puur; deze batterij voedt hem met een via de ECHTE store
// opgebouwd project (addTask/addSequence/assignResource/setTaskProgress/runCPM), zodat de rijen
// op dezelfde taakvelden rekenen als de UI. Voor randgevallen die een gesolvede planning niet kan
// opleveren (een werkelijke start ná de statusdatum, negatieve speling zonder constraint) wordt
// een kloon van de context aangepast — de engine mag daar niet op stukgaan.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import {
  type ReportContext, type ReportingPeriod,
  computeLookAhead, computeCriticalReport, computeProgressReport, computeScheduleHealth,
  computeResourceLoading, computeResourceAssignments, computeResourceGanttRows, computeWbsSummary, progressState,
  remainingDays, resourceBandLabels, taskDepths, taskFinish, taskStart,
  isValidReportingPeriod, periodDays, projectSpan, resolveReportingPeriod, weeksToPreset,
} from '@/engine/reports';
import { addCalendarMonths, formatDate, parseDate } from '@/utils/dateUtils';
import { makeMonthLabeler } from '@/utils/monthLabel';
import { DEFAULT_TABLE_REPORT_OPTIONS, parseReportingPeriod, parseTableReportOptions } from '@/utils/reportSettings';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean, info = '') => {
  checks++;
  if (!cond) diffs.push(`${label}${info ? ` (${info})` : ''}`);
};
const near = (label: string, got: number | undefined, want: number, tol = 0.05) => {
  checks++;
  if (got === undefined || Math.abs(got - want) > tol) diffs.push(`${label}: verwacht ≈${want}, kreeg ${got}`);
};

// ── Scenario ─────────────────────────────────────────────────────────────────────────────────────
// Projectstart ma 2026-09-07, statusdatum vr 2026-09-18 (= "vandaag" voor het rapport).
S().newProject();
S().setProject({ name: 'Rapporttest', startDate: '2026-09-07' });

const fase = S().addTask({ name: 'Fase 1' });
const task = (name: string, dur: number, parentId: string | null, extra: Partial<Task> = {}) => {
  const id = S().addTask({ name, parentId, ...extra });
  const cur = S().tasks.find(t => t.id === id)!;
  S().updateTask(id, { time: { ...cur.time, scheduleDuration: dur } });
  return id;
};
const A = task('A fundering', 5, fase);
const B = task('B casco', 10, fase);
const C = task('C gevel', 5, fase);
const E = task('E oplevering casco', 0, fase, { isMilestone: true });
const D = task('D los werk', 3, null, { constraint: { type: 'SNLT', date: '2026-09-30' } });
const F = task('F lange taak', 46, null);
const G = task('G kort los werk', 2, null);

S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: B, successorId: C, type: 'FINISH_START', lagDays: 15 });
S().addSequence({ predecessorId: C, successorId: E, type: 'FINISH_START', lagDays: -2 });

const R = S().addResource({ name: 'Ploeg 1', type: 'CREW', description: '', maxUnits: 1 });
S().assignResource(A, R, 1);
S().assignResource(B, R, 1);
S().assignResource(D, R, 1);

S().runCPM();
S().saveBaseline('B0');
S().setActiveBaseline(S().baselines[0].id);

// Voortgang: A klaar (7–11 sep), B 40% gestart op 14 sep; C wordt 3 dagen langer dan de baseline.
S().setStatusDate('2026-09-18');
S().setActualStart(A, '2026-09-07');
S().setActualFinish(A, '2026-09-11');
S().setActualStart(B, '2026-09-14');
S().setTaskProgress(B, 0.4);
{
  const c = S().tasks.find(t => t.id === C)!;
  S().updateTask(C, { time: { ...c.time, scheduleDuration: 8 } });
}
S().runCPM();

const ctxFromStore = (): ReportContext => {
  const s = S();
  return {
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult,
    baseline: s.baselines.find(b => b.id === s.activeBaselineId) ?? null,
    statusDate: s.project.statusDate, today: '2026-09-18',
  };
};
const ctx = ctxFromStore();
const byId = (id: string) => ctx.tasks.find(t => t.id === id)!;
ok('scenario: planning is berekend zonder fout', !!ctx.cpmResult && !ctx.cpmResult.error);
eq('scenario: A is voltooid', progressState(byId(A)), 'complete');
eq('scenario: B is in uitvoering', progressState(byId(B)), 'inProgress');
eq('scenario: B rest = 6 wd (10 × 60%)', remainingDays(ctx, byId(B)), 6);

// ── Look-ahead ───────────────────────────────────────────────────────────────────────────────────
{
  const r = computeLookAhead(ctx, { period: { preset: 'next2Weeks' }, nearCriticalDays: 5 });
  eq('lookAhead: venster start op de statusdatum', r.from, '2026-09-18');
  eq('lookAhead: venster van 2 weken (14 dagen, inclusief)', r.to, '2026-10-01');
  eq('lookAhead: geen statusdatum-melding', r.statusDateMissing, false);
  ok('lookAhead: voltooide A staat er niet in', !r.rows.some(x => x.taskId === A));
  const b = r.rows.find(x => x.taskId === B);
  eq('lookAhead: B in uitvoering', b?.status, 'inProgress');
  eq('lookAhead: B rest 6 wd', b?.remainingDays, 6);
  eq('lookAhead: B resources', b?.resources, ['Ploeg 1']);
  ok('lookAhead: D (start op de statusdatum) staat erin', r.rows.some(x => x.taskId === D));
  ok('lookAhead: rijen gesorteerd op start', r.rows.every((x, i) => i === 0 || r.rows[i - 1].start <= x.start));
  eq('lookAhead: tellingen sluiten', r.counts.overdue + r.counts.lateStart + r.counts.inProgress + r.counts.starting, r.counts.total);
  // Issue #110 punt 1: de near-critical-telling hoort in de samenvatting.
  eq('lookAhead: near-critical geteld', r.counts.nearCritical, r.rows.filter(x => x.isNearCritical).length);

  // Zonder statusdatum ⇒ vandaag als referentie + melding.
  const r2 = computeLookAhead({ ...ctx, statusDate: undefined, today: '2026-09-25' }, { period: { preset: 'nextWeek' }, nearCriticalDays: 0 });
  eq('lookAhead: zonder statusdatum meldt het rapport dat', r2.statusDateMissing, true);
  eq('lookAhead: en rekent met vandaag', r2.from, '2026-09-25');

  // Randgevallen op een kloon: achterstallig (finish vóór ref) en had-moeten-starten.
  const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
  const g = clone.find(t => t.id === G)!;
  g.time.earlyStart = '2026-09-08'; g.time.earlyFinish = '2026-09-09';
  const d = clone.find(t => t.id === D)!;
  d.time.earlyStart = '2026-09-10'; d.time.earlyFinish = '2026-09-30';
  const f = clone.find(t => t.id === F)!;
  f.time.isCritical = false; f.time.totalFloat = 4;
  const r3 = computeLookAhead({ ...ctx, tasks: clone }, { period: { preset: 'next2Weeks' }, nearCriticalDays: 5 });
  eq('lookAhead: TF 4 ≤ 5 ⇒ near-critical-telling 1', r3.counts.nearCritical, 1);
  eq('lookAhead: finish vóór de statusdatum ⇒ achterstallig', r3.rows.find(x => x.taskId === G)?.status, 'overdue');
  eq('lookAhead: start vóór de statusdatum, niet gestart ⇒ had moeten starten', r3.rows.find(x => x.taskId === D)?.status, 'lateStart');
}

// ── Kritiek / near-critical ──────────────────────────────────────────────────────────────────────
{
  const r = computeCriticalReport(ctx, { nearCriticalDays: 5 });
  eq('critical: berekend', r.calculated, true);
  ok('critical: alleen niet-voltooide taken', r.rows.every(x => progressState(byId(x.taskId)) !== 'complete'));
  const expected = ctx.tasks.filter(t => t.childIds.length === 0 && t.time.isCritical && progressState(t) !== 'complete').length;
  eq('critical: aantal kritieke rijen = kritieke open bladtaken', r.counts.critical, expected);
  ok('critical: gesorteerd op speling, dan start',
    r.rows.every((x, i) => i === 0 || r.rows[i - 1].totalFloat < x.totalFloat || (r.rows[i - 1].totalFloat === x.totalFloat && r.rows[i - 1].start <= x.start)));
  ok('critical: minstens één kritieke keten', r.pathCount >= 1);
  // Near-critical via de rapportdrempel: forceer G op TF 3 op een kloon.
  const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
  const g = clone.find(t => t.id === G)!;
  g.time.isCritical = false; g.time.totalFloat = 3;
  const r2 = computeCriticalReport({ ...ctx, tasks: clone }, { nearCriticalDays: 5 });
  eq('critical: TF 3 ≤ 5 ⇒ near-critical', r2.rows.find(x => x.taskId === G)?.status, 'nearCritical');
  const r3 = computeCriticalReport({ ...ctx, tasks: clone }, { nearCriticalDays: 2 });
  ok('critical: TF 3 > 2 ⇒ niet near-critical', !r3.rows.some(x => x.taskId === G));
}

// ── Voortgangsrapport ────────────────────────────────────────────────────────────────────────────
{
  const r = computeProgressReport(ctx, { period: { preset: 'last2Weeks' }, nearCriticalDays: 5 });
  const s = r.summary;
  eq('progress: statusdatum', s.statusDate, '2026-09-18');
  eq('progress: periode terug 14 dagen', s.periodFrom, '2026-09-05');
  eq('progress: periode t/m de statusdatum', s.periodTo, '2026-09-18');
  eq('progress: vooruitblik gespiegeld, 14 dagen (byte-identiek aan de oude 2-wekenoptie)', s.lookAheadTo, '2026-10-02');
  eq('progress: gepland t.o.v. de baseline', s.plannedBasis, 'baseline');
  eq('progress: 1 voltooid', s.counts.complete, 1);
  eq('progress: 1 in uitvoering', s.counts.inProgress, 1);
  eq('progress: totaal = alle bladtaken', s.counts.total, 7);
  ok('progress: A voltooid in de periode', r.completedInPeriod.some(x => x.taskId === A));
  ok('progress: B in uitvoering', r.inProgress.some(x => x.taskId === B));
  ok('progress: baseline-einde bekend', !!s.baselineFinish);
  ok('progress: prognose-einde bekend', !!s.forecastFinish);
  ok('progress: C 3 dagen langer ⇒ projecteinde later dan de baseline', (s.finishVarianceDays ?? 0) > 0, `Δ=${s.finishVarianceDays}`);
  // Werkelijke voortgang duurgewogen op de HUIDIGE duren (C = 8, niet de baseline-5):
  // A 5×1 + B 10×0.4 = 9 van (5+10+8+0+3+46+2)=74 ⇒ 12.2%.
  near('progress: werkelijke voortgang duurgewogen', s.actualPct, (9 / 74) * 100, 0.2);
  ok('progress: geplande voortgang tussen werkelijk en 100', s.plannedPct > s.actualPct && s.plannedPct <= 100, `gepland=${s.plannedPct}`);
  ok('progress: kritieke sectie bevat alleen open kritieke taken', r.critical.every(x => x.isCritical && x.status !== 'complete'));

  // Zonder baseline: gepland t.o.v. de huidige planning; het gewicht is ALTIJD de huidige duur
  // (C = 8), ook mét baseline (review-bevinding 5: baseline.duration is voor uur-taken niet canoniek).
  const r2 = computeProgressReport({ ...ctx, baseline: null }, { period: { preset: 'lastWeek' }, nearCriticalDays: 5 });
  eq('progress: zonder baseline ⇒ huidige planning als basis', r2.summary.plannedBasis, 'current');
  near('progress: zonder baseline weegt C 8', r2.summary.actualPct, (9 / 74) * 100, 0.2);
  near('progress: mét baseline hetzelfde gewicht (huidige duur)', s.actualPct, (9 / 74) * 100, 0.2);
  eq('progress: zonder baseline geen Δ einde', r2.summary.finishVarianceDays, undefined);

  // Bevinding 4: een lopende taak die te laat is blijft "in uitvoering" én is achterstallig; de drie
  // staat-tellingen sommeren tot het totaal.
  {
    const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
    const b = clone.find(t => t.id === B)!;
    b.time.earlyStart = '2026-09-07'; b.time.earlyFinish = '2026-09-11'; // einde vóór de statusdatum, 40% klaar
    const r3 = computeProgressReport({ ...ctx, tasks: clone }, { period: { preset: 'last2Weeks' }, nearCriticalDays: 5 });
    const c = r3.summary.counts;
    eq('progress: staat-tellingen sommeren tot het totaal', c.complete + c.inProgress + c.notStarted, c.total);
    ok('progress: te late lopende taak staat in "in uitvoering"', r3.inProgress.some(x => x.taskId === B));
    ok('progress: … én in "achterstallig"', r3.overdue.some(x => x.taskId === B && x.overdue === 'finish'));
    eq('progress: weergavestatus = had moeten eindigen', r3.inProgress.find(x => x.taskId === B)?.status, 'overdueFinish');
    eq('progress: in uitvoering geteld', c.inProgress, 1);
  }

  // Bevinding 5: een uur-taak weegt naar haar echte werkdag-duur, óók mét actieve baseline.
  {
    const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
    const g = clone.find(t => t.id === G)!;
    g.time.durationUnit = 'hours'; g.time.durationMinutes = 4 * 60; g.time.scheduleDuration = 5; // 4 u = 0,5 wd
    const withBase = computeProgressReport({ ...ctx, tasks: clone }, { period: { preset: 'last2Weeks' }, nearCriticalDays: 5 });
    const noBase = computeProgressReport({ ...ctx, tasks: clone, baseline: null }, { period: { preset: 'last2Weeks' }, nearCriticalDays: 5 });
    near('progress: uur-taak weegt 0,5 wd — baseline aan/uit maakt geen verschil', withBase.summary.actualPct, noBase.summary.actualPct, 0.01);
    near('progress: gewicht G = 0,5 (A 5 + B 10 + C 8 + G 0,5 + D 3 + F 46 = 72,5)', noBase.summary.actualPct, (9 / 72.5) * 100, 0.2);
  }
}

// ── Planningsgezondheid ──────────────────────────────────────────────────────────────────────────
{
  const r = computeScheduleHealth(ctx, { highFloatDays: 20, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 });
  const items = (id: string) => r.checks.find(c => c.id === id)!.items;
  const has = (id: string, taskId: string) => items(id).some(i => i.taskId === taskId);
  ok('health: A zonder voorganger', has('noPredecessor', A));
  ok('health: D zonder voorganger én opvolger', has('noPredecessor', D) && has('noSuccessor', D));
  ok('health: mijlpaal E telt niet als open einde', !has('noSuccessor', E));
  ok('health: C heeft een opvolger (E)', !has('noSuccessor', C));
  ok('health: F (46 wd) is een lange duur', has('longDuration', F));
  ok('health: B (10 wd) is geen lange duur', !has('longDuration', B));
  ok('health: G (2 wd, los) heeft hoge speling > 20', has('highFloat', G), `TF G=${byId(G).time.totalFloat}`);
  eq('health: B→C lag 15 > 10 ⇒ lange lag', items('longLag').length, 1);
  eq('health: C→E lag −2 ⇒ lead', items('lead').length, 1);
  ok('health: lead-rij noemt beide taken', items('lead')[0].name.includes('C gevel') && items('lead')[0].name.includes('E oplevering'));
  ok('health: D met SNLT is een harde constraint', has('hardConstraint', D));
  eq('health: geen voortgangsuitzonderingen in een consistent project', items('progressException').length, 0);
  eq('health: ernstniveaus', r.checks.find(c => c.id === 'negativeFloat')!.severity, 'error');
  eq('health: totalen sluiten', r.totals.errors + r.totals.warnings + r.totals.infos, r.checks.reduce((n, c) => n + c.items.length, 0));
  eq('health: relaties geteld', r.relationCount, 3);
  eq('health: bladtaken geteld', r.leafCount, 7);

  // Bevinding 2: relaties op VERZAMELTAKEN telt de solver wél (expandSummaryRelations) — dit rapport dus ook.
  {
    S().newProject();
    S().setProject({ name: 'Fasen', startDate: '2026-09-07' });
    const f1 = S().addTask({ name: 'Fase 1' });
    const f2 = S().addTask({ name: 'Fase 2' });
    const a1 = task('A1', 5, f1); const a2 = task('A2', 5, f1);
    const b1 = task('B1', 5, f2); const b2 = task('B2', 5, f2);
    S().addSequence({ predecessorId: a1, successorId: a2, type: 'FINISH_START', lagDays: 0 });
    S().addSequence({ predecessorId: b1, successorId: b2, type: 'FINISH_START', lagDays: 0 });
    S().addSequence({ predecessorId: f1, successorId: f2, type: 'FINISH_START', lagDays: 20 });
    S().runCPM();
    const c2 = ctxFromStore();
    const h = computeScheduleHealth(c2, { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 });
    const it = (id: string) => h.checks.find(c => c.id === id)!.items;
    ok('health: A2 heeft via de faserelatie een opvolger', !it('noSuccessor').some(i => i.taskId === a2));
    ok('health: B1 heeft via de faserelatie een voorganger', !it('noPredecessor').some(i => i.taskId === b1));
    // De faserelatie wordt voor de solver uitgevouwen tot 2×2 bladrelaties, maar de planner
    // modelleerde er ÉÉN: het rapport meldt hem één keer, op de fasenamen, en telt hem één keer.
    eq('health: de faserelatie (lag 20) telt als één lange lag', it('longLag').length, 1);
    ok('health: … op de fasenamen', it('longLag')[0].name.includes('Fase 1') && it('longLag')[0].name.includes('Fase 2'));
    eq('health: relatietelling = gemodelleerde relaties (2 + 1)', h.relationCount, 3);
  }

  // Bevinding 3: één lag-definitie met de solver — procent-lag, procent-lead en uurlag.
  {
    S().newProject();
    S().setProject({ name: 'Lag', startDate: '2026-09-07' });
    const p = task('P', 40, null); const q = task('Q', 5, null); const r = task('R', 5, null); const u = task('U', 5, null);
    S().addSequence({ predecessorId: p, successorId: q, type: 'FINISH_START', lagDays: 0, lagPercent: 50 });   // +20 wd
    S().addSequence({ predecessorId: p, successorId: r, type: 'FINISH_START', lagDays: 0, lagPercent: -25 });  // −10 wd
    S().addSequence({ predecessorId: q, successorId: u, type: 'FINISH_START', lagDays: 5, lagMinutes: 240 });  // dag-lag leidend: 5
    S().runCPM();
    const h = computeScheduleHealth(ctxFromStore(), { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 });
    const it = (id: string) => h.checks.find(c => c.id === id)!.items;
    eq('health: +50% van 40 wd = 20 wd ⇒ lange lag', it('longLag').map(i => i.detail.days), [20]);
    eq('health: −25% van 40 wd = −10 wd ⇒ lead', it('lead').map(i => i.detail.days), [-10]);
    ok('health: lagDays 5 + lagMinutes ⇒ 5 wd (dag-lag leidend), dus geen lange lag', !it('longLag').some(i => i.detail.days === 0.5));
  }

  // Bevinding 6: een corrupte parentId/childIds-kring mag niet crashen.
  {
    const kring = ctx.tasks.map(t => ({ ...t, childIds: [...t.childIds] }));
    const x = kring.find(t => t.id === D)!; const y = kring.find(t => t.id === G)!;
    x.parentId = y.id; y.parentId = x.id; x.childIds = [y.id]; y.childIds = [x.id];
    let crashed = false;
    try { computeWbsSummary({ ...ctx, tasks: kring }, { maxLevel: 0, includeActivities: true }); } catch { crashed = true; }
    eq('wbs: kringverwijzing crasht niet', crashed, false);
    ok('wbs: diepten eindig', [...taskDepths(kring).values()].every(d => Number.isFinite(d) && d >= 1));
  }

  // Inconsistente actuals + negatieve speling op een kloon.
  const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
  const b = clone.find(t => t.id === B)!;
  b.time.actualStart = '2026-09-22';           // ná de statusdatum
  const c = clone.find(t => t.id === C)!;
  c.time.completion = 1;                        // 100% zonder werkelijk einde
  const g = clone.find(t => t.id === G)!;
  g.time.totalFloat = -2;
  const r2 = computeScheduleHealth({ ...ctx, tasks: clone }, { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 });
  const pe = r2.checks.find(x => x.id === 'progressException')!.items;
  ok('health: werkelijke start ná statusdatum gemeld', pe.some(i => i.taskId === B && i.detail.reason === 'actualStartAfterStatusDate'));
  ok('health: 100% zonder werkelijk einde gemeld', pe.some(i => i.taskId === C && i.detail.reason === 'completeWithoutActualFinish'));
  ok('health: negatieve speling gemeld met de waarde', r2.checks.find(x => x.id === 'negativeFloat')!.items.some(i => i.taskId === G && i.detail.float === -2));
  ok('health: fouten geteld', r2.totals.errors >= 3);
}

// ── Resourcebelasting ────────────────────────────────────────────────────────────────────────────
{
  const weekly = { period: { preset: 'project' } as ReportingPeriod, bucket: 'week' as const };
  const r = computeResourceLoading(ctx, { ...weekly, onlyOverloaded: false });
  ok('resourceLoading: rijen voor Ploeg 1', r.rows.length > 0 && r.rows.every(x => x.resourceName === 'Ploeg 1'));
  ok('resourceLoading: weken chronologisch', r.rows.every((x, i) => i === 0 || x.bucketStart > r.rows[i - 1].bucketStart));
  ok('resourceLoading: variance = beschikbaar − gevraagd', r.rows.every(x => Math.abs(x.variance - (x.available - x.required)) < 0.001));
  ok('resourceLoading: alleen weken met vraag', r.rows.every(x => x.required > 0));
  eq('resourceLoading: A (7–11 sep), B (14–25 sep, rest ná de statusdatum) en D ⇒ 3 weken', r.rows.length, 3);
  ok('resourceLoading: B en D overlappen ⇒ overbelaste week', r.rows.some(x => x.overloaded));
  eq('resourceLoading: aantal resources = resources in de tabel (zelfde telling als toewijzingen)', r.counts.resources, 1);
  eq('resourceLoading: een resource zonder rijen telt niet mee', computeResourceLoading({ ...ctx, resources: [...ctx.resources, { ...ctx.resources[0], id: 'leeg', name: 'Leeg' }] }, { ...weekly, onlyOverloaded: false }).counts.resources, 1);
  eq('resourceLoading: weken = rijen zonder filter', r.counts.buckets, r.rows.length);
  const r2 = computeResourceLoading(ctx, { ...weekly, onlyOverloaded: true });
  ok('resourceLoading: filter houdt alleen overbelaste weken', r2.rows.every(x => x.overloaded));
  eq('resourceLoading: tellingen gaan over de tabel — met filter tellen alleen overbelaste buckets', r2.counts.buckets, r2.rows.length);
  eq('resourceLoading: … en overbelaste buckets blijven gelijk', r2.counts.overloadedBuckets, r.counts.overloadedBuckets);
  ok('resourceLoading: overbelaste rijen zijn een deelverzameling', r2.rows.length <= r.rows.length);
  eq('resourceLoading: project-periode = projectspanne', [r.from, r.to], [projectSpan(ctx.tasks)!.from, projectSpan(ctx.tasks)!.to]);
  eq('resourceLoading: project-periode meldt geen ontbrekende statusdatum', computeResourceLoading({ ...ctx, statusDate: undefined }, { ...weekly, onlyOverloaded: false }).statusDateMissing, false);

  // Issue #119: maandaggregatie — één bucket voor september die de drie weken samenneemt.
  const m = computeResourceLoading(ctx, { period: { preset: 'project' }, bucket: 'month', onlyOverloaded: false });
  eq('resourceLoading: maandbucket ⇒ één rij (alles in september)', m.rows.map(x => [x.bucketStart, x.bucketEnd]), [['2026-09-01', '2026-09-30']]);
  near('resourceLoading: maandsom = som van de weken', m.rows[0].required, r.rows.reduce((n, x) => n + x.required, 0), 0.11);
  ok('resourceLoading: maand-capaciteit ≥ som van de weekcapaciteiten binnen de maand', m.rows[0].available >= r.rows.reduce((n, x) => n + x.available, 0) - 0.01);
  eq('resourceLoading: overbelaste maand', m.counts.overloadedBuckets, 1);
  ok('resourceLoading: piekdag van de maand = hoogste weekpiek', Math.abs(m.rows[0].peakDayLoad - Math.max(...r.rows.map(x => x.peakDayLoad))) < 0.01);

  // Issue #120: een rapportageperiode beperkt de buckets tot de weken die de periode raken.
  const w = computeResourceLoading(ctx, { period: { preset: 'nextWeek' }, bucket: 'week', onlyOverloaded: false });
  eq('resourceLoading: "volgende week" vanaf vr 18 sep ⇒ [18 sep, 24 sep]', [w.from, w.to], ['2026-09-18', '2026-09-24']);
  eq('resourceLoading: … raakt de weken van 14 en 21 sep', w.rows.map(x => x.bucketStart), ['2026-09-14', '2026-09-21']);
  eq('resourceLoading: de weekrij is dezelfde hele kalenderweek als zonder periode', w.rows[0].required, r.rows.find(x => x.bucketStart === '2026-09-14')!.required);
  const c = computeResourceLoading(ctx, { period: { preset: 'custom', from: '2026-09-07', to: '2026-09-11' }, bucket: 'week', onlyOverloaded: false });
  eq('resourceLoading: aangepaste periode ⇒ alleen de week van 7 sep', c.rows.map(x => x.bucketStart), ['2026-09-07']);
  eq('resourceLoading: zonder statusdatum meldt een relatieve periode dat wél', computeResourceLoading({ ...ctx, statusDate: undefined }, { period: { preset: 'lastWeek' }, bucket: 'week', onlyOverloaded: false }).statusDateMissing, true);
}

// ── Resourcetoewijzingen ─────────────────────────────────────────────────────────────────────────
{
  const r = computeResourceAssignments(ctx, { period: { preset: 'project' }, includeCompleted: false });
  eq('assignments: voltooide A weggelaten ⇒ B en D', r.rows.map(x => x.taskId).sort(), [B, D].sort());
  eq('assignments: hele project ⇒ venster = projectspanne', [r.from, r.to], [projectSpan(ctx.tasks)!.from, projectSpan(ctx.tasks)!.to]);
  ok('assignments: gesorteerd op start binnen de resource', r.rows.every((x, i) => i === 0 || r.rows[i - 1].start <= x.start));
  eq('assignments: taken zonder resource (C, F, G — E is mijlpaal)', r.counts.unassignedTasks, 3);
  const r2 = computeResourceAssignments(ctx, { period: { preset: 'project' }, includeCompleted: true });
  eq('assignments: met voltooide ⇒ ook A', r2.rows.length, 3);
  eq('assignments: A voltooid', r2.rows.find(x => x.taskId === A)?.state, 'complete');
  const r3 = computeResourceAssignments(ctx, { period: { preset: 'nextWeek' }, includeCompleted: false });
  eq('assignments: venster van 1 week vanaf de statusdatum', [r3.from, r3.to], ['2026-09-18', '2026-09-24']);
  ok('assignments: B (in uitvoering) valt in het venster', r3.rows.some(x => x.taskId === B));
  const r4 = computeResourceAssignments(ctx, { period: { preset: 'custom', from: '2026-10-05', to: '2026-10-09' }, includeCompleted: false });
  ok('assignments: aangepast venster in oktober ⇒ D (30 sep – 2 okt) valt eruit', !r4.rows.some(x => x.taskId === D));
  // Ook bij een aangepast venster stuurt de referentiedag de insluiting van achterstallig werk.
  eq('assignments: aangepast venster zonder statusdatum meldt dat wél', computeResourceAssignments({ ...ctx, statusDate: undefined }, { period: { preset: 'custom', from: '2026-10-05', to: '2026-10-09' }, includeCompleted: false }).statusDateMissing, true);
  eq('assignments: hele project meldt geen ontbrekende statusdatum', computeResourceAssignments({ ...ctx, statusDate: undefined }, { period: { preset: 'project' }, includeCompleted: false }).statusDateMissing, false);
}

// ── Rapportageperiode (issue #120) ───────────────────────────────────────────────────────────────
{
  const ref = '2026-09-10'; // donderdag, het voorbeeld uit het issue
  const span = { from: '2026-09-01', to: '2026-12-31' };
  const res = (p: ReportingPeriod) => resolveReportingPeriod(p, ref, span);
  eq('period: volgende 4 weken = 10 sep t/m 7 okt (het voorbeeld uit het issue)', res({ preset: 'next4Weeks' }), { from: '2026-09-10', to: '2026-10-07' });
  eq('period: volgende week = 7 dagen inclusief', res({ preset: 'nextWeek' }), { from: '2026-09-10', to: '2026-09-16' });
  eq('period: afgelopen 2 weken eindigt op de referentiedag', res({ preset: 'last2Weeks' }), { from: '2026-08-28', to: '2026-09-10' });
  eq('period: volgende maand = t/m 9 okt', res({ preset: 'nextMonth' }), { from: '2026-09-10', to: '2026-10-09' });
  eq('period: afgelopen maand = vanaf 11 aug', res({ preset: 'lastMonth' }), { from: '2026-08-11', to: '2026-09-10' });
  eq('period: volgende maand vanaf 31 jan klemt op februari', resolveReportingPeriod({ preset: 'nextMonth' }, '2026-01-31', span), { from: '2026-01-31', to: '2026-02-27' });
  eq('period: addCalendarMonths klemt op de maandlengte', formatDate(addCalendarMonths(parseDate('2026-01-31'), 1)), '2026-02-28');
  eq('period: hele project = projectspanne', res({ preset: 'project' }), span);
  eq('period: hele project zonder taken = de referentiedag', resolveReportingPeriod({ preset: 'project' }, ref, undefined), { from: ref, to: ref });
  eq('period: aangepast = de eigen datums', res({ preset: 'custom', from: '2026-10-01', to: '2026-10-31' }), { from: '2026-10-01', to: '2026-10-31' });
  eq('period: aangepast zonder datums valt terug op de projectspanne', res({ preset: 'custom' }), span);
  eq('period: to < from is ongeldig', isValidReportingPeriod({ preset: 'custom', from: '2026-10-31', to: '2026-10-01' }), false);
  eq('period: 2026-02-31 is ongeldig', isValidReportingPeriod({ preset: 'custom', from: '2026-02-31', to: '2026-03-01' }), false);
  eq('period: lengte in dagen, inclusief', periodDays({ from: '2026-09-10', to: '2026-10-07' }), 28);
  ok('period: alle 12 weekpresets sluiten aan op de referentiedag', ([1, 2, 4, 6, 8, 12] as const).every(n => {
    const nx = res({ preset: weeksToPreset(n, 'next') }); const ls = res({ preset: weeksToPreset(n, 'last') });
    return nx.from === ref && periodDays(nx) === 7 * n && ls.to === ref && periodDays(ls) === 7 * n;
  }));

  // Migratie van de oude "N weken"-getallen (reportSettings) naar presets.
  eq('period: weeksToPreset 3 ⇒ 4 weken, 9 ⇒ 12, 1 ⇒ week', [weeksToPreset(3, 'next'), weeksToPreset(9, 'last'), weeksToPreset(1, 'next')], ['next4Weeks', 'last12Weeks', 'nextWeek']);
  const migrated = parseTableReportOptions({ lookAheadWeeks: 3, progressPeriodWeeks: 1, resourceAssignmentWeeks: 0 });
  eq('settings: oude look-ahead 3 weken ⇒ volgende 4 weken', migrated.lookAheadPeriod, { preset: 'next4Weeks' });
  eq('settings: oude voortgang 1 week ⇒ afgelopen week', migrated.progressPeriod, { preset: 'lastWeek' });
  eq('settings: oude toewijzingen 0 ⇒ hele project', migrated.resourceAssignmentPeriod, { preset: 'project' });
  eq('settings: belasting krijgt de defaults', [migrated.resourceLoadPeriod, migrated.resourceLoadBucket], [{ preset: 'project' }, 'week']);
  const kept = parseTableReportOptions({ lookAheadWeeks: 3, lookAheadPeriod: { preset: 'nextMonth' }, resourceLoadBucket: 'month' });
  eq('settings: het nieuwe periodeveld wint van het oude getal', kept.lookAheadPeriod, { preset: 'nextMonth' });
  eq('settings: maandaggregatie bewaard', kept.resourceLoadBucket, 'month');
  eq('settings: defaults volgen issue #120 (volgende maand / afgelopen maand)', [DEFAULT_TABLE_REPORT_OPTIONS.lookAheadPeriod, DEFAULT_TABLE_REPORT_OPTIONS.progressPeriod], [{ preset: 'nextMonth' }, { preset: 'lastMonth' }]);
  eq('settings: aangepaste periode met omgekeerde datums ⇒ default', parseReportingPeriod({ preset: 'custom', from: '2026-10-31', to: '2026-10-01' }, DEFAULT_TABLE_REPORT_OPTIONS.lookAheadPeriod), { preset: 'nextMonth' });
  eq('settings: aangepaste periode met geldige datums blijft', parseReportingPeriod({ preset: 'custom', from: '2026-10-01', to: '2026-10-31' }, DEFAULT_TABLE_REPORT_OPTIONS.lookAheadPeriod), { preset: 'custom', from: '2026-10-01', to: '2026-10-31' });
  eq('settings: onbekende preset ⇒ default', parseReportingPeriod({ preset: 'nextYear' }, { preset: 'project' }), { preset: 'project' });

  // Look-ahead en voortgang volgen dezelfde periode-keuze.
  const la = computeLookAhead(ctx, { period: { preset: 'nextMonth' }, nearCriticalDays: 5 });
  eq('lookAhead: volgende maand vanaf 18 sep = t/m 17 okt', [la.from, la.to], ['2026-09-18', '2026-10-17']);
  const laProject = computeLookAhead(ctx, { period: { preset: 'project' }, nearCriticalDays: 5 });
  ok('lookAhead: hele project ⇒ minstens zoveel open activiteiten als een maand', laProject.rows.length >= la.rows.length);
  const pr = computeProgressReport(ctx, { period: { preset: 'next4Weeks' }, nearCriticalDays: 5 });
  eq('progress: periode ná de statusdatum ⇒ vooruitblik tot het periode-einde (niet gespiegeld)', [pr.summary.periodFrom, pr.summary.periodTo, pr.summary.lookAheadTo], ['2026-09-18', '2026-10-15', '2026-10-15']);
  const pm = computeProgressReport(ctx, { period: { preset: 'lastMonth' }, nearCriticalDays: 5 });
  eq('progress: afgelopen maand ⇒ 19 aug t/m 18 sep, vooruitblik gespiegeld t/m 19 okt', [pm.summary.periodFrom, pm.summary.periodTo, pm.summary.lookAheadTo], ['2026-08-19', '2026-09-18', '2026-10-19']);
  ok('progress: A (voltooid 11 sep) valt in de afgelopen maand', pm.completedInPeriod.some(x => x.taskId === A));
  const pc = computeProgressReport(ctx, { period: { preset: 'custom', from: '2026-09-14', to: '2026-09-15' }, nearCriticalDays: 5 });
  ok('progress: aangepaste periode 14–15 sep ⇒ A (klaar 11 sep) valt erbuiten', !pc.completedInPeriod.some(x => x.taskId === A));
  // Reviewbevinding ronde 2: een aangepaste periode in het verleden wordt NIET gespiegeld — een
  // venster in 2020 zegt niets over de komende periode; de vooruitkijksectie blijft dan leeg.
  const p2020 = computeProgressReport(ctx, { period: { preset: 'custom', from: '2020-01-01', to: '2020-12-31' }, nearCriticalDays: 5 });
  eq('progress: aangepaste periode in 2020 ⇒ vooruitblik t/m het periode-einde, niet een jaar vooruit', p2020.summary.lookAheadTo, '2020-12-31');
  eq('progress: … en de sectie "start in de komende periode" is leeg', p2020.startingNext.length, 0);
  eq('progress: "afgelopen …"-preset spiegelt wél', computeProgressReport(ctx, { period: { preset: 'lastWeek' }, nearCriticalDays: 5 }).summary.lookAheadTo, '2026-09-25');

  // Reviewbevinding ronde 3: een venster dat helemaal in het verleden ligt is een terugblik en sleept
  // de actuele achterstand (overdue / had-moeten-starten) niet mee — look-ahead én toewijzingen.
  {
    const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
    const g = clone.find(t => t.id === G)!;
    g.time.earlyStart = '2026-09-08'; g.time.earlyFinish = '2026-09-09'; // achterstallig t.o.v. 18 sep
    const past = { preset: 'custom' as const, from: '2020-01-01', to: '2020-12-31' };
    eq('lookAhead: venster in 2020 ⇒ geen rijen, ook geen achterstand', computeLookAhead({ ...ctx, tasks: clone }, { period: past, nearCriticalDays: 5 }).rows.length, 0);
    ok('lookAhead: venster dat de statusdatum raakt ⇒ achterstand wél', computeLookAhead({ ...ctx, tasks: clone }, { period: { preset: 'custom', from: '2026-09-18', to: '2026-09-18' }, nearCriticalDays: 5 }).rows.some(x => x.taskId === G && x.status === 'overdue'));
    eq('assignments: venster in 2020 ⇒ geen rijen', computeResourceAssignments({ ...ctx, tasks: clone }, { period: past, includeCompleted: false }).rows.length, 0);
  }

  // Reviewbevinding ronde 3: het maandlabel is Gregoriaans met Latijnse cijfers in élke taal —
  // zonder de unicode-extensies gaf `fa` "شهریور ۱۴۰۵" naast een ondertitel met 2026.
  {
    const persianDigits = /[\u06F0-\u06F9\u0660-\u0669]/;
    for (const loc of ['nl', 'en', 'fa', 'ar', 'ja', 'zh', 'ko', 'de', 'tr', 'pl']) {
      const label = makeMonthLabeler(loc)('2026-09-01');
      ok(`monthLabel: ${loc} bevat het Gregoriaanse jaar 2026 ("${label}")`, label.includes('2026'));
      ok(`monthLabel: ${loc} gebruikt Latijnse cijfers`, !persianDigits.test(label));
    }
    ok('monthLabel: fa is niet de Solar-Hijri-kalender', !makeMonthLabeler('fa')('2026-09-01').includes('1405'));
    eq('monthLabel: onbekende locale valt terug op Engels', makeMonthLabeler('xx-YY')('2026-09-01'), 'Sep 2026');
  }
}

// ── WBS-samenvatting ─────────────────────────────────────────────────────────────────────────────
{
  const r = computeWbsSummary(ctx, { maxLevel: 1, includeActivities: false });
  eq('wbs: niveau 1 zonder activiteiten ⇒ alleen Fase 1', r.rows.map(x => x.name), ['Fase 1']);
  const f = r.rows[0];
  eq('wbs: 4 bladtaken onder de fase', f.counts.total, 4);
  eq('wbs: 1 voltooid, 1 bezig', [f.counts.complete, f.counts.inProgress], [1, 1]);
  // Duurgewogen: A 5×1 + B 10×0.4 = 9 van 5+10+8+0 = 23 ⇒ 39%.
  near('wbs: duurgewogen voortgang van de fase', f.completion, 9 / 23, 0.006);
  ok('wbs: baseline-datums opgerold', !!f.baselineStart && !!f.baselineFinish);
  ok('wbs: einde later dan de baseline (C werd 3 dagen langer)', (f.finishVarianceDays ?? 0) > 0, `Δ=${f.finishVarianceDays}`);
  eq('wbs: min TF = laagste kind-TF', f.minTotalFloat, Math.min(...[A, B, C, E].map(id => byId(id).time.totalFloat)));
  eq('wbs: start/einde = rollup van de verzameltaak', [f.start, f.finish], [byId(fase).time.earlyStart, byId(fase).time.earlyFinish]);
  const r2 = computeWbsSummary(ctx, { maxLevel: 0, includeActivities: true });
  eq('wbs: volledige boom met activiteiten ⇒ 8 rijen in documentvolgorde', r2.rows.map(x => x.name), ['Fase 1', 'A fundering', 'B casco', 'C gevel', 'E oplevering casco', 'D los werk', 'F lange taak', 'G kort los werk']);
  eq('wbs: niveaus', r2.rows.map(x => x.level), [1, 2, 2, 2, 2, 1, 1, 1]);
  eq('wbs: tellingen', [r2.counts.elements, r2.counts.activities], [1, 7]);
}

// ── Resourcediagram (issue #113) ─────────────────────────────────────────────────────────────────
// Per resource-IDENTITEIT een band (niet per naam — review op #132, bevinding 1), daaronder zijn
// bladtaken op start; een taak met twee resources staat onder beide banden; de "(geen)"-band alleen
// op verzoek. Op de ReportContext van het hoofdscenario (de store staat inmiddels op een ander
// project), met synthetische extra resources/toewijzingen.
{
  const res = (id: string, name: string): Resource => ({ id, name, type: 'EQUIPMENT', description: '', maxUnits: 1 });
  const asg = (id: string, taskId: string, resourceId: string): ResourceAssignment => ({ id, taskId, resourceId, unitsPerDay: 1 });
  const kraan = res('res-kraan', 'Kraan');
  const base = {
    tasks: ctx.tasks,
    resources: [...ctx.resources, kraan],
    assignments: [...ctx.assignments, asg('asg-kraan', B, kraan.id)],
  };
  const opts = { includeUnassigned: false, noneLabel: '(geen)', locale: 'nl' };
  const label = (row: { kind: string; label?: string }) => (row.kind === 'group' ? row.label : undefined);
  const bandTasks = (rows: ReturnType<typeof computeResourceGanttRows>['rows'], name: string) => {
    const start = rows.findIndex(x => label(x) === name);
    const out: string[] = [];
    if (start < 0) return out;
    for (const x of rows.slice(start + 1)) { if (x.kind !== 'task') break; out.push(x.task.id); }
    return out;
  };

  const r = computeResourceGanttRows(base, opts);
  eq('resourceGantt: één band per resource, op naam', r.rows.filter(x => x.kind === 'group').map(label), ['Kraan', 'Ploeg 1']);
  // Ploeg 1 → A, B, D; Kraan → B; zonder resource: C, E (mijlpaal is óók een bladtaak), F, G.
  eq('resourceGantt: tellingen', r.counts, { resources: 2, assignments: 4, unassignedTasks: 4, outsidePeriod: 0, inPeriod: 7 });
  eq('resourceGantt: Ploeg 1 heeft A, B en D', [...bandTasks(r.rows, 'Ploeg 1')].sort(), [A, B, D].sort());
  eq('resourceGantt: Kraan heeft alleen B', bandTasks(r.rows, 'Kraan'), [B]);
  ok('resourceGantt: B staat onder beide banden', r.rows.filter(x => x.kind === 'task' && x.task.id === B).length === 2);
  ok('resourceGantt: alle rijsleutels uniek', new Set(r.rows.map(x => x.rowKey)).size === r.rows.length);
  const starts = bandTasks(r.rows, 'Ploeg 1').map(id => byId(id).time.earlyStart || byId(id).time.scheduleStart);
  ok('resourceGantt: binnen een band op start gesorteerd', starts.every((d, i) => i === 0 || starts[i - 1] <= d), starts.join(','));
  ok('resourceGantt: zonder optie geen "(geen)"-band', !r.rows.some(x => label(x) === '(geen)'));
  ok('resourceGantt: geen verzameltaak tussen de rijen', !r.rows.some(x => x.kind === 'task' && x.task.id === fase));
  ok('resourceGantt: taakrijen hangen op diepte 1 onder hun band', r.rows.every(x => x.kind !== 'task' || x.depth === 1));

  const r2 = computeResourceGanttRows(base, { ...opts, includeUnassigned: true });
  eq('resourceGantt: met optie staat "(geen)" als laatste band', r2.rows.filter(x => x.kind === 'group').map(label), ['Kraan', 'Ploeg 1', '(geen)']);
  eq('resourceGantt: tellingen ongewijzigd door de optie', r2.counts, r.counts);
  eq('resourceGantt: de vier taken zonder resource staan onder "(geen)"', [...bandTasks(r2.rows, '(geen)')].sort(), [C, E, F, G].sort());

  // Review-bevinding 1: twee resources met dezelfde naam zijn twee banden, elk met een eigen sleutel;
  // een taak van beiden staat onder beide — en niet twee keer onder één.
  const jan1 = res('res-jan-1', 'Jan');
  const jan2 = res('res-jan-2', 'Jan');
  const twins = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [jan1, jan2],
    assignments: [asg('a1', A, jan1.id), asg('a2', A, jan2.id), asg('a3', B, jan2.id)],
  }, opts);
  eq('resourceGantt: gelijknamige resources ⇒ twee banden met volgnummer', twins.rows.filter(x => x.kind === 'group').map(label), ['Jan #1', 'Jan #2']);
  eq('resourceGantt: gelijknamig — tellingen op identiteit', twins.counts, { resources: 2, assignments: 3, unassignedTasks: 5, outsidePeriod: 0, inPeriod: 7 });
  eq('resourceGantt: gelijknamig — Jan #1 heeft A', bandTasks(twins.rows, 'Jan #1'), [A]);
  eq('resourceGantt: gelijknamig — Jan #2 heeft A en B', [...bandTasks(twins.rows, 'Jan #2')].sort(), [A, B].sort());
  ok('resourceGantt: gelijknamig — rijsleutels uniek', new Set(twins.rows.map(x => x.rowKey)).size === twins.rows.length);

  // Review-bevinding 4: een resource zonder naam verdwijnt niet stil in "(geen)" maar krijgt een surrogaat.
  const naamloos = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [kraan, res('res-leeg', '  ')],
    assignments: [asg('a1', A, 'res-leeg')],
  }, opts);
  eq('resourceGantt: naamloze resource ⇒ band "#2" (positie in de projectlijst)', naamloos.rows.filter(x => x.kind === 'group').map(label), ['#2']);
  eq('resourceGantt: naamloze resource — A telt als toegewezen', naamloos.counts, { resources: 1, assignments: 1, unassignedTasks: 6, outsidePeriod: 0, inPeriod: 7 });

  // manuvarkey op #113, punt 2: twee lagen — typeband (vaste volgorde: mensen, dan materieel, dan
  // materiaal), daarin de resourcebanden op diepte 1, de taken op diepte 2; "(geen)" blijft achteraan
  // op diepte 0 (taken zonder resource hebben geen type). Zonder de optie byte-identiek.
  const typeLabels = { LABOR: 'Arbeid', CREW: 'Ploeg', SUBCONTRACTOR: 'Onderaannemer', EQUIPMENT: 'Materieel', MATERIAL: 'Materiaal' };
  const typed = computeResourceGanttRows(base, { ...opts, groupByType: true, typeLabels });
  const typedGroups = typed.rows.filter(x => x.kind === 'group');
  eq('resourceGantt/type: typebanden vóór hun resources, mensen eerst', typedGroups.map(x => `${x.depth}:${label(x)}`), ['0:Ploeg', '1:Ploeg 1', '0:Materieel', '1:Kraan']);
  ok('resourceGantt/type: taakrijen op diepte 2', typed.rows.every(x => x.kind !== 'task' || x.depth === 2));
  ok('resourceGantt/type: rijsleutels uniek', new Set(typed.rows.map(x => x.rowKey)).size === typed.rows.length);
  eq('resourceGantt/type: typeband telt de taakrijen eronder', typedGroups.filter(x => x.depth === 0).map(x => x.count), [3, 1]);
  eq('resourceGantt/type: tellingen ongewijzigd', typed.counts, r.counts);
  eq('resourceGantt/type: dezelfde taken onder Ploeg 1', [...bandTasks(typed.rows, 'Ploeg 1')].sort(), [A, B, D].sort());
  const typedNone = computeResourceGanttRows(base, { ...opts, groupByType: true, typeLabels, includeUnassigned: true });
  const typedNoneGroups = typedNone.rows.filter(x => x.kind === 'group');
  const lastGroup = typedNoneGroups[typedNoneGroups.length - 1];
  ok('resourceGantt/type: "(geen)" blijft als laatste band op diepte 0', label(lastGroup) === '(geen)' && lastGroup.depth === 0);
  ok('resourceGantt/type: zonder de optie byte-identiek', JSON.stringify(computeResourceGanttRows(base, { ...opts, typeLabels }).rows) === JSON.stringify(r.rows));
  eq('resourceGantt/type: ontbrekend label ⇒ enum-naam', computeResourceGanttRows(base, { ...opts, groupByType: true }).rows.filter(x => x.kind === 'group' && x.depth === 0).map(label), ['CREW', 'EQUIPMENT']);
  // Gelijknamigen binnen één type houden hun volgnummer; de nummering loopt over de hele lijst.
  const typedTwins = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [jan1, { ...jan2, type: 'LABOR' }],
    assignments: [asg('a1', A, jan1.id), asg('a2', B, jan2.id)],
  }, { ...opts, groupByType: true, typeLabels });
  eq('resourceGantt/type: gelijknamigen over twee typen houden hun volgnummer', typedTwins.rows.filter(x => x.kind === 'group').map(x => `${x.depth}:${label(x)}`), ['0:Arbeid', '1:Jan #2', '0:Materieel', '1:Jan #1']);

  // manuvarkey op #113, punt 3: tijdvenster — alleen bladtaken die het venster raken (start ≤ tot én
  // einde ≥ van, op dagniveau); de tellingen volgen de gefilterde set en `outsidePeriod` telt wat er
  // is weggelaten. Zonder venster (Hele project) is outsidePeriod 0 en verandert er niets.
  const dayOfTask = (id: string) => ({ s: taskStart(byId(id)).slice(0, 10), f: taskFinish(byId(id)).slice(0, 10) });
  const dayB = dayOfTask(B).s;
  const overlapsB = (id: string) => { const { s, f } = dayOfTask(id); return s !== '' && f !== '' && s <= dayB && f >= dayB; };
  const leavesAll = ctx.tasks.filter(t => t.childIds.length === 0);
  const windowed = computeResourceGanttRows(base, { ...opts, includeUnassigned: true, window: { from: dayB, to: dayB } });
  ok('resourceGantt/venster: B (start op de vensterdag) staat onder Ploeg 1', bandTasks(windowed.rows, 'Ploeg 1').includes(B));
  ok('resourceGantt/venster: A (klaar vóór het venster) staat er niet', !windowed.rows.some(x => x.kind === 'task' && x.task.id === A));
  ok('resourceGantt/venster: elke getekende taak raakt het venster', windowed.rows.every(x => x.kind !== 'task' || overlapsB(x.task.id)));
  ok('resourceGantt/venster: elke bladtaak die het venster raakt staat er ook', leavesAll.filter(t => overlapsB(t.id)).every(t => windowed.rows.some(x => x.kind === 'task' && x.task.id === t.id)));
  eq('resourceGantt/venster: outsidePeriod telt de weggelaten bladtaken', windowed.counts.outsidePeriod, leavesAll.filter(t => !overlapsB(t.id)).length);
  eq('resourceGantt/venster: inPeriod + outsidePeriod = alle bladtaken', windowed.counts.inPeriod + windowed.counts.outsidePeriod, leavesAll.length);
  ok('resourceGantt/venster: tellingen volgen de gefilterde set', windowed.counts.assignments < r.counts.assignments && windowed.counts.unassignedTasks < r.counts.unassignedTasks);
  const buiten = computeResourceGanttRows(base, { ...opts, window: { from: '2030-01-01', to: '2030-01-31' } });
  eq('resourceGantt/venster: venster zonder taken ⇒ geen rijen, alles buiten de periode', [buiten.rows.length, buiten.counts.outsidePeriod, buiten.counts.resources], [0, leavesAll.length, 0]);
  const ruim = computeResourceGanttRows(base, { ...opts, window: { from: '2020-01-01', to: '2035-12-31' } });
  ok('resourceGantt/venster: een venster dat alles omvat ⇒ dezelfde rijen als zonder venster', JSON.stringify(ruim.rows) === JSON.stringify(r.rows) && ruim.counts.outsidePeriod === 0);

  // manuvarkey op #113, punt 1: per taakrij de toewijzing van de band op die taak — eenheden opgeteld
  // over records van dezelfde resource, curve alleen als alle records dezelfde hebben (afwezig =
  // UNIFORM), anders null; taakrijen onder "(geen)" hebben geen entry.
  const asgFull = (id: string, taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve, extra: Partial<ResourceAssignment> = {}): ResourceAssignment => ({ id, taskId, resourceId, unitsPerDay, curve, ...extra });
  const loaded = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [kraan, jan1],
    assignments: [
      asgFull('l1', A, kraan.id, 0.5, 'FRONT_LOADED'), asgFull('l2', A, kraan.id, 1, 'FRONT_LOADED'),
      asgFull('l3', B, kraan.id, 2), asgFull('l4', B, jan1.id, 1, 'BELL'), asgFull('l5', B, jan1.id, 1, 'BACK_LOADED'),
    ],
  }, { ...opts, includeUnassigned: true });
  const rowOf = (bandName: string, taskId: string) => {
    const start = loaded.rows.findIndex(x => label(x) === bandName);
    return loaded.rows.slice(start + 1).find(x => x.kind === 'task' && x.task.id === taskId)!;
  };
  eq('resourceGantt/toewijzing: Kraan op A — twee records opgeteld, zelfde curve', loaded.assignmentByRowKey.get(rowOf('Kraan', A).rowKey), { unitsPerDay: 1.5, curve: 'FRONT_LOADED' });
  eq('resourceGantt/toewijzing: Kraan op B — record zonder curve telt als UNIFORM', loaded.assignmentByRowKey.get(rowOf('Kraan', B).rowKey), { unitsPerDay: 2, curve: 'UNIFORM' });
  eq('resourceGantt/toewijzing: Jan op B — verschillende curves ⇒ null', loaded.assignmentByRowKey.get(rowOf('Jan', B).rowKey), { unitsPerDay: 2, curve: null });
  const noneStart = loaded.rows.findIndex(x => label(x) === '(geen)');
  ok('resourceGantt/toewijzing: elke taakrij onder een resourceband heeft een entry', loaded.rows.slice(0, noneStart).every(x => x.kind !== 'task' || loaded.assignmentByRowKey.has(x.rowKey)));
  ok('resourceGantt/toewijzing: "(geen)"-rijen hebben geen entry', noneStart > 0 && loaded.rows.slice(noneStart).every(x => x.kind !== 'task' || !loaded.assignmentByRowKey.has(x.rowKey)));
  eq('resourceGantt/toewijzing: aantal entries = aantal taakrijen onder resourcebanden', loaded.assignmentByRowKey.size, loaded.rows.slice(0, noneStart).filter(x => x.kind === 'task').length);
  // Review-bevinding 1: dezelfde drie lagen als de lastverdeling — een contour op de taak wint, dan
  // een geïmporteerde exacte curve zonder OPS-vorm, dan pas `curve`. Nooit "Uniform" bij een
  // P6-/MSP-import met een echte curve.
  const curveValues = [0, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dMetContour = { ...byId(D), timephasedContours: [{ resourceUid: null, resourceId: jan1.id, periods: [] }] };
  const layered = computeResourceGanttRows({
    tasks: ctx.tasks.map(t => (t.id === D ? dMetContour : t)), resources: [kraan, jan1],
    assignments: [
      asgFull('c1', A, kraan.id, 1, undefined, { curveValues }),          // geïmporteerd, geen OPS-vorm
      asgFull('c2', B, kraan.id, 1, 'FRONT_LOADED', { curveValues }),     // OPS-vorm aanwezig ⇒ die wint
      asgFull('c3', D, jan1.id, 1, 'BELL'),                                // contour op de taak ⇒ contoured
      asgFull('c4', D, kraan.id, 1, undefined, { curveValues }),          // geen contour voor Kraan ⇒ imported
    ],
  }, opts);
  const rowOf2 = (bandName: string, taskId: string) => {
    const start = layered.rows.findIndex(x => label(x) === bandName);
    return layered.rows.slice(start + 1).find(x => x.kind === 'task' && x.task.id === taskId)!;
  };
  eq('resourceGantt/curve: curveValues zonder curve ⇒ imported', layered.assignmentByRowKey.get(rowOf2('Kraan', A).rowKey)?.curve, 'imported');
  eq('resourceGantt/curve: curveValues mét OPS-vorm ⇒ de vorm', layered.assignmentByRowKey.get(rowOf2('Kraan', B).rowKey)?.curve, 'FRONT_LOADED');
  eq('resourceGantt/curve: contour op de taak voor deze resource ⇒ contoured', layered.assignmentByRowKey.get(rowOf2('Jan', D).rowKey)?.curve, 'contoured');
  eq('resourceGantt/curve: contour geldt alleen voor de gekoppelde resource', layered.assignmentByRowKey.get(rowOf2('Kraan', D).rowKey)?.curve, 'imported');
  // Ronde 2, bevinding 3: de contourkoppeling loopt op de VOLLEDIGE recordlijst van de taak, ook
  // met een record naar een onbekende resource erbij — dan slaat de legacy-terugval (één contour
  // zonder resourceId bij precies één record) níét toe, net als in het paneel en de lastverdeling.
  const dLegacy = { ...byId(D), timephasedContours: [{ resourceUid: null, periods: [] }] };
  const legacy = computeResourceGanttRows({
    tasks: ctx.tasks.map(t => (t.id === D ? dLegacy : t)), resources: [kraan],
    assignments: [asgFull('g1', D, kraan.id, 1), asgFull('g2', D, 'res-onbekend', 1)],
  }, opts);
  eq('resourceGantt/curve: legacy-contour telt niet bij twee records (ook als er één naar een onbekende resource wijst)', legacy.assignmentByRowKey.get(legacy.rows.find(x => x.kind === 'task' && x.task.id === D)!.rowKey)?.curve, 'UNIFORM');

  // Twee toewijzingen van dezelfde resource op één taak zijn één rij; een toewijzing aan een
  // onbekende resource telt niet (die taak is dan "zonder resource", zoals op het scherm).
  const dubbel = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [kraan],
    assignments: [asg('a1', A, kraan.id), asg('a2', A, kraan.id), asg('a3', B, 'res-bestaat-niet')],
  }, opts);
  eq('resourceGantt: dubbele toewijzing ⇒ één rij', bandTasks(dubbel.rows, 'Kraan'), [A]);
  // …maar de telling volgt de records, zoals het tabelrapport Resourcetoewijzingen (review N8).
  eq('resourceGantt: onbekende resource ⇒ taak zonder resource; toewijzingen tellen records', dubbel.counts, { resources: 1, assignments: 2, unassignedTasks: 6, outsidePeriod: 0, inPeriod: 7 });

  // Bandvolgorde: taal-/cijferbewust ("Ploeg 2" vóór "Ploeg 10"), hoofdletterongevoelig.
  const p10 = res('p10', 'Ploeg 10'); const p2 = res('p2', 'ploeg 2'); const aa = res('aa', 'Aannemer');
  const volgorde = computeResourceGanttRows({
    tasks: ctx.tasks, resources: [p10, p2, aa],
    assignments: [asg('a1', A, p10.id), asg('a2', A, p2.id), asg('a3', A, aa.id)],
  }, opts);
  eq('resourceGantt: bandvolgorde cijferbewust en hoofdletterongevoelig', volgorde.rows.filter(x => x.kind === 'group').map(label), ['Aannemer', 'ploeg 2', 'Ploeg 10']);

  // Review N1: de bandvolgorde volgt de meegegeven app-taal, niet de OS-taal van de afdrukker. Het
  // Zweeds sorteert Å/Ä/Ö ná Z, het Engels/Nederlands bij de A — hetzelfde project, twee volgordes,
  // dus de parameter moet dragend zijn (en het scherm van de afdrukker irrelevant).
  const alg = res('alg', 'Älg'); const ost = res('ost', 'Ostersund'); const zorg = res('zorg', 'Zorg');
  const noords = { tasks: ctx.tasks, resources: [zorg, alg, ost], assignments: [asg('a1', A, alg.id), asg('a2', A, ost.id), asg('a3', A, zorg.id)] };
  eq('resourceGantt: bandvolgorde in het Engels', computeResourceGanttRows(noords, { ...opts, locale: 'en' }).rows.filter(x => x.kind === 'group').map(label), ['Älg', 'Ostersund', 'Zorg']);
  eq('resourceGantt: bandvolgorde in het Zweeds (Ä ná Z)', computeResourceGanttRows(noords, { ...opts, locale: 'sv' }).rows.filter(x => x.kind === 'group').map(label), ['Ostersund', 'Zorg', 'Älg']);

  // Review N5: gelijknaamdetectie gebruikt dezelfde collator als de sortering — Jan/jan/" Jan " zijn
  // drie banden mét volgnummer, in projectvolgorde, en sorteren bij elkaar.
  const jan = [res('j1', 'Jan'), res('j2', 'jan'), res('j3', ' Jan ')];
  eq('resourceBandLabels: hoofdletter-/spatievarianten krijgen alle drie een volgnummer', [...resourceBandLabels(jan, 'nl').values()], ['Jan #1', 'jan #2', 'Jan #3']);
  const janRows = computeResourceGanttRows({ tasks: ctx.tasks, resources: jan, assignments: jan.map((r, i) => asg(`j${i}`, A, r.id)) }, opts);
  eq('resourceGantt: gelijkende namen sorteren bij elkaar in projectvolgorde', janRows.rows.filter(x => x.kind === 'group').map(label), ['Jan #1', 'jan #2', 'Jan #3']);
  // Review N4: een surrogaat "#2" naast een resource die letterlijk "#2" heet — beide genummerd.
  eq('resourceBandLabels: surrogaat botst niet stil met een letterlijke "#2"', [...resourceBandLabels([res('x1', '#2'), res('x2', '')], 'nl').values()], ['#2 #1', '#2 #2']);
  eq('resourceBandLabels: unieke namen blijven kaal, accentgelijk telt als gelijk', [...resourceBandLabels([res('e1', 'Renée'), res('e2', 'Renee'), res('e3', 'Piet')], 'nl').values()], ['Renée #1', 'Renee #2', 'Piet']);

  // Leeg: geen toewijzingen ⇒ geen rijen; geen taken ⇒ ook geen "(geen)"-band en nultellingen.
  ok('resourceGantt: geen toewijzingen ⇒ leeg', computeResourceGanttRows({ ...base, assignments: [] }, opts).rows.length === 0);
  const leeg = computeResourceGanttRows({ tasks: [], resources: base.resources, assignments: base.assignments }, { ...opts, includeUnassigned: true });
  eq('resourceGantt: leeg project ⇒ geen rijen, nultellingen', [leeg.rows.length, leeg.counts], [0, { resources: 0, assignments: 0, unassignedTasks: 0, outsidePeriod: 0, inPeriod: 0 }]);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────────
if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`XX rapporten: ${diffs.length} afwijking(en) in ${checks} checks`);
  process.exit(1);
}
console.log(`OK  rapporten: ${checks} checks groen`);
