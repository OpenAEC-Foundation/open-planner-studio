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
  type ReportContext,
  computeLookAhead, computeCriticalReport, computeProgressReport, computeScheduleHealth,
  computeResourceLoading, computeResourceAssignments, computeWbsSummary, progressState, remainingDays, taskDepths,
} from '@/engine/reports';
import type { Task } from '@/types/task';

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
  const r = computeLookAhead(ctx, { weeks: 2, nearCriticalDays: 5 });
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
  const r2 = computeLookAhead({ ...ctx, statusDate: undefined, today: '2026-09-25' }, { weeks: 1, nearCriticalDays: 0 });
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
  const r3 = computeLookAhead({ ...ctx, tasks: clone }, { weeks: 2, nearCriticalDays: 5 });
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
  const r = computeProgressReport(ctx, { periodWeeks: 2, nearCriticalDays: 5 });
  const s = r.summary;
  eq('progress: statusdatum', s.statusDate, '2026-09-18');
  eq('progress: periode terug 14 dagen', s.periodFrom, '2026-09-05');
  eq('progress: periode vooruit 14 dagen', s.periodTo, '2026-10-02');
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
  const r2 = computeProgressReport({ ...ctx, baseline: null }, { periodWeeks: 1, nearCriticalDays: 5 });
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
    const r3 = computeProgressReport({ ...ctx, tasks: clone }, { periodWeeks: 2, nearCriticalDays: 5 });
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
    const withBase = computeProgressReport({ ...ctx, tasks: clone }, { periodWeeks: 2, nearCriticalDays: 5 });
    const noBase = computeProgressReport({ ...ctx, tasks: clone, baseline: null }, { periodWeeks: 2, nearCriticalDays: 5 });
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
  const r = computeResourceLoading(ctx, { onlyOverloaded: false });
  ok('resourceLoading: rijen voor Ploeg 1', r.rows.length > 0 && r.rows.every(x => x.resourceName === 'Ploeg 1'));
  ok('resourceLoading: weken chronologisch', r.rows.every((x, i) => i === 0 || x.weekStart > r.rows[i - 1].weekStart));
  ok('resourceLoading: variance = beschikbaar − gevraagd', r.rows.every(x => Math.abs(x.variance - (x.available - x.required)) < 0.001));
  ok('resourceLoading: alleen weken met vraag', r.rows.every(x => x.required > 0));
  eq('resourceLoading: A (7–11 sep), B (14–25 sep, rest ná de statusdatum) en D ⇒ 3 weken', r.rows.length, 3);
  ok('resourceLoading: B en D overlappen ⇒ overbelaste week', r.rows.some(x => x.overloaded));
  eq('resourceLoading: aantal resources', r.counts.resources, 1);
  eq('resourceLoading: weken = rijen zonder filter', r.counts.weeks, r.rows.length);
  const r2 = computeResourceLoading(ctx, { onlyOverloaded: true });
  ok('resourceLoading: filter houdt alleen overbelaste weken', r2.rows.every(x => x.overloaded));
  eq('resourceLoading: filter verandert de tellingen niet', r2.counts.weeks, r.counts.weeks);
  ok('resourceLoading: overbelaste rijen zijn een deelverzameling', r2.rows.length <= r.rows.length);
}

// ── Resourcetoewijzingen ─────────────────────────────────────────────────────────────────────────
{
  const r = computeResourceAssignments(ctx, { weeks: 0, includeCompleted: false });
  eq('assignments: voltooide A weggelaten ⇒ B en D', r.rows.map(x => x.taskId).sort(), [B, D].sort());
  eq('assignments: geen venster', r.from, undefined);
  ok('assignments: gesorteerd op start binnen de resource', r.rows.every((x, i) => i === 0 || r.rows[i - 1].start <= x.start));
  eq('assignments: taken zonder resource (C, F, G — E is mijlpaal)', r.counts.unassignedTasks, 3);
  const r2 = computeResourceAssignments(ctx, { weeks: 0, includeCompleted: true });
  eq('assignments: met voltooide ⇒ ook A', r2.rows.length, 3);
  eq('assignments: A voltooid', r2.rows.find(x => x.taskId === A)?.state, 'complete');
  const r3 = computeResourceAssignments(ctx, { weeks: 1, includeCompleted: false });
  eq('assignments: venster van 1 week vanaf de statusdatum', [r3.from, r3.to], ['2026-09-18', '2026-09-24']);
  ok('assignments: B (in uitvoering) valt in het venster', r3.rows.some(x => x.taskId === B));
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

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────────
if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`XX rapporten: ${diffs.length} afwijking(en) in ${checks} checks`);
  process.exit(1);
}
console.log(`OK  rapporten: ${checks} checks groen`);
