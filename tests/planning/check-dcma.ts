// DCMA 14-puntsbeoordeling (`src/engine/reports/dcmaAssessment.ts`), het blok bovenaan het rapport
// Planningsgezondheid.
//
// BRON van de verwachte waarden: DCMA-EA PAM 200.1 (okt. 2012), hoofdstuk 4 en §3.1.2.3–3.1.2.4 —
// de formules en normen per punt, met de hand nagerekend op kleine netwerken (werkdagen ma–vr, geen
// feestdagen; datums uit de werkdagtabel in `BRIEF.md`; een automatische mijlpaal na een FS-relatie
// landt de werkdag ná het einde van zijn voorganger, zie `cases-milestone-kinds.json` mk-01a). Niet
// afgeleid uit de code: waar de module
// zelf een keuze maakt die het pamflet openlaat (populatie van relaties, de 100 werkdagen van de
// kritiek-padtest), staat dat bij de verwachting.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import {
  type ReportContext, type DcmaMetric, type DcmaMetricId, computeScheduleHealth, CRITICAL_PATH_TEST_SLIP_DAYS,
} from '@/engine/reports';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const task = (name: string, dur: number, extra: Partial<Task> = {}) => {
  const id = S().addTask({ name, parentId: null, ...extra });
  const cur = S().tasks.find(t => t.id === id)!;
  S().updateTask(id, { time: { ...cur.time, scheduleDuration: dur } });
  return id;
};
const milestone = (name: string, extra: Partial<Task> = {}) => task(name, 0, { isMilestone: true, ...extra });
const link = (p: string, q: string, type: 'FINISH_START' | 'START_START' | 'FINISH_FINISH' | 'START_FINISH' = 'FINISH_START', lagDays = 0) =>
  S().addSequence({ predecessorId: p, successorId: q, type, lagDays });

const ctxFromStore = (): ReportContext => {
  const s = S();
  return {
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult,
    baseline: s.baselines.find(b => b.id === s.activeBaselineId) ?? null,
    statusDate: s.project.statusDate, today: '2026-09-07',
    solveOptions: solveOptionsFor(s.project),
  };
};
const OPTS = { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 };
const dcmaOf = (ctx: ReportContext) => computeScheduleHealth(ctx, OPTS).dcma;
const metric = (d: { metrics: DcmaMetric[] }, id: DcmaMetricId) => d.metrics.find(m => m.id === id)!;
/** [uitslag, teller, noemer, waarde] — of [uitslag, n.v.t.-reden]. */
const summary = (m: DcmaMetric) => (m.result === 'na' ? [m.result, m.naReason] : [m.result, m.count ?? null, m.base ?? null, m.value ?? null]);

// ── Scenario 1: de structuurpunten, zonder statusdatum en baseline ───────────────────────────────
// Projectstart ma 2026-09-07.
//   A (5)  9/7–9/11, FNLT 2027-01-29 (ver ná het einde: geen invloed op de speling, wél een harde
//          constraint volgens PAM §4.5)
//   A →FS→ B (5)  9/14–9/18
//   B →SS+2→ C (5)  9/16–9/22
//   A →FS→ L (60)  9/14 – vr 12/4 (12 weken)   — de lange duur, kritiek
//   C →FS→ M, L →FS→ M (mijlpaal, ma 12/7)
//   X (3)  9/7–9/9, los
// Niet-voltooide taken (zonder mijlpalen): A, B, C, L, X ⇒ 5.
//   1 logica: A (geen voorganger), X (beide) ⇒ 2/5 = 40%            → markering (norm ≤ 5%)
//   Relaties naar zulke taken: A→B, B→C, A→L (C→M en L→M gaan naar een mijlpaal) ⇒ 3.
//   2 leads: 0/3 = 0%                                               → voldoet (norm: geen)
//   3 lags: B→C ⇒ 1/3 = 33,3%                                       → markering
//   4 relatietypes: 2 FS van 3 = 66,7%                              → markering (norm ≥ 90%)
//   5 harde constraints: A ⇒ 1/5 = 20%                              → markering
//   6 hoge speling > 44 wd: B, C (C eindigt 9/22, einde 12/4: 53 wd), X (62 wd) ⇒ 3/5 = 60% → markering
//   7 negatieve speling: 0/5                                        → voldoet
//   8 lange duur > 44 wd (geen baseline ⇒ huidige duur): L ⇒ 1/5 = 20% → markering
//   9/11/13/14: geen statusdatum ⇒ n.v.t.; 10: geen toewijzingen ⇒ n.v.t.
//  12 kritiek-padtest: eindtaak M (laatste einde); kritieke
//     kandidaten A (start 9/7) en L (9/14) ⇒ A. A +100 wd schuift L en M precies 100 wd ⇒ voldoet.
{
  S().newProject();
  S().setProject({ name: 'DCMA 1', startDate: '2026-09-07' });
  const A = task('A', 5, { constraint: { type: 'FNLT', date: '2027-01-29' } });
  const B = task('B', 5);
  const C = task('C', 5);
  const L = task('L', 60);
  const M = milestone('M');
  task('X', 3);
  link(A, B); link(B, C, 'START_START', 2); link(A, L); link(C, M); link(L, M);
  S().runCPM();
  const d = dcmaOf(ctxFromStore());
  eq('s1: noemers (taken, relaties)', [d.incompleteCount, d.relationCount], [5, 3]);
  eq('s1: 1 logica', summary(metric(d, 'logic')), ['flag', 2, 5, 40]);
  eq('s1: 2 leads', summary(metric(d, 'leads')), ['pass', 0, 3, 0]);
  eq('s1: 3 lags', summary(metric(d, 'lags')), ['flag', 1, 3, 33.3]);
  eq('s1: 4 relatietypes', summary(metric(d, 'relationshipTypes')), ['flag', 2, 3, 66.7]);
  eq('s1: 5 harde constraints', summary(metric(d, 'hardConstraints')), ['flag', 1, 5, 20]);
  eq('s1: 6 hoge speling', summary(metric(d, 'highFloat')), ['flag', 3, 5, 60]);
  eq('s1: 7 negatieve speling', summary(metric(d, 'negativeFloat')), ['pass', 0, 5, 0]);
  eq('s1: 8 lange duur', summary(metric(d, 'highDuration')), ['flag', 1, 5, 20]);
  eq('s1: 9 ongeldige datums', summary(metric(d, 'invalidDates')), ['na', 'noStatusDate']);
  eq('s1: 10 resources', summary(metric(d, 'resources')), ['na', 'notResourceLoaded']);
  eq('s1: 11 gemiste taken', summary(metric(d, 'missedTasks')), ['na', 'noStatusDate']);
  const cp = metric(d, 'criticalPathTest');
  eq('s1: 12 kritiek-padtest', [cp.result, cp.test?.name, cp.test?.endName, cp.test?.slipDays, cp.test?.endShiftDays],
    ['pass', 'A', 'M', CRITICAL_PATH_TEST_SLIP_DAYS, CRITICAL_PATH_TEST_SLIP_DAYS]);
  eq('s1: 13 CPLI', summary(metric(d, 'cpli')), ['na', 'noStatusDate']);
  eq('s1: 14 BEI', summary(metric(d, 'bei')), ['na', 'noStatusDate']);
  eq('s1: nummering 1–14 in volgorde', d.metrics.map(m => m.point), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  // Markering: 1, 3, 4, 5, 6, 8. Voldoet: 2, 7, 12. De rest n.v.t.
  eq('s1: tellers markering/voldoet', [d.flags, d.passes], [6, 3]);

  // Lead tegenover lag: dezelfde relatie B→C met SS−1 telt als lead (punt 2), niet als lag (punt 3).
  const withLead = dcmaOf({ ...ctxFromStore(), sequences: S().sequences.map(q => (q.type === 'START_START' ? { ...q, lagDays: -1 } : q)) });
  eq('s1: lead — 2 leads / 3 lags', [summary(metric(withLead, 'leads')), summary(metric(withLead, 'lags'))],
    [['flag', 1, 3, 33.3], ['pass', 0, 3, 0]]);

  // De relaties anders dan FS staan als bevinding in het rapport (de lijst achter punt 4).
  const h = computeScheduleHealth(ctxFromStore(), OPTS);
  const nonFs = h.checks.find(c => c.id === 'nonFsRelation')!.items;
  eq('s1: bevinding relatie anders dan FS', nonFs.map(i => [i.name, i.detail.relationType]), [['B → C', 'START_START']]);
  // Zonder solve-opties kan de kritiek-padtest niet doorrekenen.
  eq('s1: zonder solve-opties is punt 12 n.v.t.', summary(metric(dcmaOf({ ...ctxFromStore(), solveOptions: undefined }), 'criticalPathTest')), ['na', 'notCalculated']);
}

// ── Scenario 2: gebroken logica — de kritiek-padtest markeert ────────────────────────────────────
// Z (3) los, 9/7–9/9, met deadline 9/7 ⇒ negatieve speling ⇒ kritiek, maar hangt nergens aan.
// P (5) 9/7–9/11 →FS→ Q (5) 9/14–9/18 →FS→ N (mijlpaal ma 9/21).
// Eindtaak N. Kandidaten Z en P starten beide 9/7; Z staat eerst in de lijst ⇒ Z. Z +100 wd eindigt
// ver ná N, en N beweegt niet ⇒ markering (verschuiving 0 wd).
{
  S().newProject();
  S().setProject({ name: 'DCMA 2', startDate: '2026-09-07' });
  task('Z', 3, { deadline: '2026-09-07' });
  const P = task('P', 5);
  const Q = task('Q', 5);
  const N = milestone('N');
  link(P, Q); link(Q, N);
  S().runCPM();
  const cp = metric(dcmaOf(ctxFromStore()), 'criticalPathTest');
  eq('s2: 12 kritiek-padtest markeert gebroken logica', [cp.result, cp.test?.name, cp.test?.endName, cp.test?.endShiftDays], ['flag', 'Z', 'N', 0]);
}

// ── Scenario 3: verplicht vastgepinde eindmijlpaal — de test slaagt toch ─────────────────────────
// P (5) →FS→ Q (5) →FS→ N, N met een VERPLICHTE MFO op 9/21. PAM §4.12 rekent een eind dat
// vastzit maar negatieve speling toont als geslaagd; de module haalt de pin in de what-if weg en
// toetst of de vertraging doorloopt: P +100 ⇒ N schuift 100 wd ⇒ voldoet.
{
  S().newProject();
  S().setProject({ name: 'DCMA 3', startDate: '2026-09-07' });
  const P = task('P', 5);
  const Q = task('Q', 5);
  const N = milestone('N', { constraint: { type: 'MFO', date: '2026-09-21', hard: true } });
  link(P, Q); link(Q, N);
  S().runCPM();
  const cp = metric(dcmaOf(ctxFromStore()), 'criticalPathTest');
  eq('s3: 12 kritiek-padtest met verplichte eindpin', [cp.result, cp.test?.name, cp.test?.endShiftDays], ['pass', 'P', CRITICAL_PATH_TEST_SLIP_DAYS]);
  // Het document zelf is niet aangeraakt: N houdt zijn pin, P zijn duur.
  const n = S().tasks.find(t => t.id === N)!;
  const p = S().tasks.find(t => t.id === P)!;
  eq('s3: what-if laat het document ongemoeid', [n.constraint?.hard, p.time.scheduleDuration], [true, 5]);
}

// ── Scenario 4: voortgang, baseline en resources ─────────────────────────────────────────────────
// A (5) →FS→ B (5) →FS→ C (5) →FS→ M; resources op A en B. Baseline: A 9/7–9/11, B 9/14–9/18,
// C 9/21–9/25, M ma 9/28.
// Statusdatum ma 9/21. A voltooid 9/7–9/11; B gestart 9/14, 40% ⇒ rest 3 wd vanaf 9/21 ⇒ B 9/23;
// C 9/24–9/30; M do 10/1.
//   Niet-voltooide taken: B, C ⇒ 2.
//   9 ongeldige datums: geen ⇒ 0/2                                   → voldoet
//  10 resources: C zonder ⇒ 1/2 = 50%                                → markering (norm: geen)
//  11 gemiste taken: baseline-einde ≤ 9/21: A, B ⇒ B (9/23 > 9/18) ⇒ 1/2 = 50% → markering
//  13 CPLI: eindtaak M (10/1). CPL = 9/21..10/1 = 9 wd; TF t.o.v. baseline-einde 9/28 = −3 wd
//     ⇒ (9 − 3) / 9 = 0,667 ⇒ 0,67                                    → markering (norm ≥ 0,95)
//  14 BEI: voltooid t/m 9/21: A ⇒ 1; baseline-einde ≤ 9/21: A, B ⇒ 2 ⇒ 0,5 → markering
{
  S().newProject();
  S().setProject({ name: 'DCMA 4', startDate: '2026-09-07' });
  const A = task('A', 5);
  const B = task('B', 5);
  const C = task('C', 5);
  const M = milestone('M');
  link(A, B); link(B, C); link(C, M);
  const R = S().addResource({ name: 'Ploeg', type: 'CREW', description: '', maxUnits: 1 });
  S().assignResource(A, R, 1);
  S().assignResource(B, R, 1);
  S().runCPM();
  S().saveBaseline('B0');
  S().setActiveBaseline(S().baselines[0].id);
  S().setStatusDate('2026-09-21');
  S().setActualStart(A, '2026-09-07');
  S().setActualFinish(A, '2026-09-11');
  S().setActualStart(B, '2026-09-14');
  S().setTaskProgress(B, 0.4);
  S().runCPM();
  const ctx = ctxFromStore();
  const b = ctx.tasks.find(t => t.id === B)!;
  const m = ctx.tasks.find(t => t.id === M)!;
  eq('s4: scenario — B en M volgens de handberekening', [b.time.earlyFinish, m.time.earlyFinish], ['2026-09-23', '2026-10-01']);
  const d = dcmaOf(ctx);
  eq('s4: noemer taken', d.incompleteCount, 2);
  eq('s4: 9 ongeldige datums', summary(metric(d, 'invalidDates')), ['pass', 0, 2, 0]);
  eq('s4: 10 resources', summary(metric(d, 'resources')), ['flag', 1, 2, 50]);
  eq('s4: 11 gemiste taken', summary(metric(d, 'missedTasks')), ['flag', 1, 2, 50]);
  const cpli = metric(d, 'cpli');
  eq('s4: 13 CPLI', [cpli.result, cpli.value, cpli.cpli], ['flag', 0.67, { criticalPathLength: 9, totalFloat: -3, floatBasis: 'baseline' }]);
  eq('s4: 14 BEI', summary(metric(d, 'bei')), ['flag', 1, 2, 0.5]);

  const h = computeScheduleHealth(ctx, OPTS);
  const items = (id: string) => h.checks.find(c => c.id === id)!.items;
  eq('s4: bevinding gemiste taak (met baseline-einde)', items('missedTask').map(i => [i.name, i.detail.date]), [['B', '2026-09-18']]);
  eq('s4: bevinding zonder resource', items('missingResource').map(i => i.name), ['C']);
  eq('s4: geen voortgangsuitzonderingen', items('progressException').length, 0);

  // Ongeldige datums (PAM §4.9) op een kloon: een prognosestart vóór de statusdatum (een verouderde
  // berekening) en een werkelijke start ná de statusdatum.
  const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
  clone.find(t => t.id === C)!.time.earlyStart = '2026-09-18';
  clone.find(t => t.id === B)!.time.actualStart = '2026-09-22';
  const ctx2 = { ...ctx, tasks: clone };
  eq('s4: 9 ongeldige datums op de kloon', summary(metric(dcmaOf(ctx2), 'invalidDates')), ['flag', 2, 2, 100]);
  const reasons = computeScheduleHealth(ctx2, OPTS).checks.find(c => c.id === 'progressException')!.items.map(i => [i.name, i.detail.reason]);
  eq('s4: redenen in de bevindingen', reasons, [['B', 'actualStartAfterStatusDate'], ['C', 'forecastStartBeforeStatusDate']]);
  // Zonder berekening zijn de getoonde datums de geplande, geen prognose: alleen de werkelijke start telt.
  eq('s4: zonder berekening telt alleen de werkelijke datum', summary(metric(dcmaOf({ ...ctx2, cpmResult: null }), 'invalidDates')), ['flag', 1, 2, 50]);

  // Een taak zonder baseline-einde telt in de noemer van BEI (PAM §3.1.2.4: "Tasks missing baseline
  // finish dates are included in the denominator"), niet in die van punt 11 (§4.11: "does not
  // include the number of tasks missing baseline start or finish dates"). C uit de baseline ⇒
  // BEI 1 / (2 + 1) = 0,33; gemiste taken blijft 1/2.
  const partial = { ...ctx, baseline: { ...ctx.baseline!, tasks: ctx.baseline!.tasks.filter(x => x.taskId !== C) } };
  const dp = dcmaOf(partial);
  eq('s4: taak zonder baseline — 11 en 14', [summary(metric(dp, 'missedTasks')), summary(metric(dp, 'bei'))],
    [['flag', 1, 2, 50], ['flag', 1, 3, 0.33]]);

  // Zonder baseline: 11 en 14 n.v.t.; CPLI valt terug op de berekende speling (hier 0 ⇒ 1,00).
  const nb = dcmaOf({ ...ctx, baseline: null });
  eq('s4: zonder baseline — 11, 13, 14', [summary(metric(nb, 'missedTasks')), metric(nb, 'cpli').value, metric(nb, 'cpli').cpli?.floatBasis, summary(metric(nb, 'bei'))],
    [['na', 'noBaseline'], 1, 'schedule', ['na', 'noBaseline']]);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────────
if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`XX dcma: ${diffs.length} afwijking(en) in ${checks} checks`);
  process.exit(1);
}
console.log(`OK  dcma: ${checks} checks groen`);
