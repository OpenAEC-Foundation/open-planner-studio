import { useAppStore } from '@/state/appStore';
import {
  type ReportContext, type DcmaMetric, type DcmaMetricId, computeScheduleHealth, CRITICAL_PATH_TEST_SLIP_DAYS,
} from '@/engine/reports';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import type { Task } from '@/types/task';
import { readXER } from '@/services/xer/xerReader';
import type { ImportResult } from '@/services/importTypes';

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
    statusDate: s.project.statusDate, today: '2026-09-07', datesAsRecorded: s.datesAsRecorded,
    solveOptions: solveOptionsFor(s.project),
  };
};
const OPTS = { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 };
const dcmaOf = (ctx: ReportContext) => computeScheduleHealth(ctx, OPTS).dcma;
const metric = (d: { metrics: DcmaMetric[] }, id: DcmaMetricId) => d.metrics.find(m => m.id === id)!;
const summary = (m: DcmaMetric) => (m.result === 'na' ? [m.result, m.naReason] : [m.result, m.count ?? null, m.base ?? null, m.value ?? null]);

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
  eq('s1: tellers markering/voldoet', [d.flags, d.passes], [6, 3]);

  const withLead = dcmaOf({ ...ctxFromStore(), sequences: S().sequences.map(q => (q.type === 'START_START' ? { ...q, lagDays: -1 } : q)) });
  eq('s1: lead — 2 leads / 3 lags', [summary(metric(withLead, 'leads')), summary(metric(withLead, 'lags'))],
    [['flag', 1, 3, 33.3], ['pass', 0, 3, 0]]);

  const h = computeScheduleHealth(ctxFromStore(), OPTS);
  const nonFs = h.checks.find(c => c.id === 'nonFsRelation')!.items;
  eq('s1: bevinding relatie anders dan FS', nonFs.map(i => [i.name, i.detail.relationType]), [['B → C', 'START_START']]);
  eq('s1: zonder solve-opties is punt 12 n.v.t.', summary(metric(dcmaOf({ ...ctxFromStore(), solveOptions: undefined }), 'criticalPathTest')), ['na', 'notCalculated']);
}

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
  const n = S().tasks.find(t => t.id === N)!;
  const p = S().tasks.find(t => t.id === P)!;
  eq('s3: what-if laat het document ongemoeid', [n.constraint?.hard, p.time.scheduleDuration], [true, 5]);
}

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
  eq('s4: scenario — B en M volgens de handberekening', [b.time.earlyFinish, m.time.earlyFinish], ["2026-09-23T16:00", "2026-10-01T07:00"]);
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
  eq('s4: bevinding gemiste taak (met baseline-einde)', items('missedTask').map(i => [i.name, i.detail.date]), [['B', "2026-09-18T16:00"]]);
  eq('s4: bevinding zonder resource', items('missingResource').map(i => i.name), ['C']);
  eq('s4: geen voortgangsuitzonderingen', items('progressException').length, 0);

  const clone = ctx.tasks.map(t => ({ ...t, time: { ...t.time } }));
  clone.find(t => t.id === C)!.time.earlyStart = '2026-09-18';
  clone.find(t => t.id === B)!.time.actualStart = '2026-09-22';
  const ctx2 = { ...ctx, tasks: clone };
  eq('s4: 9 ongeldige datums op de kloon', summary(metric(dcmaOf(ctx2), 'invalidDates')), ['flag', 2, 2, 100]);
  const reasons = computeScheduleHealth(ctx2, OPTS).checks.find(c => c.id === 'progressException')!.items.map(i => [i.name, i.detail.reason]);
  eq('s4: redenen in de bevindingen', reasons, [['B', 'actualStartAfterStatusDate'], ['C', 'forecastStartBeforeStatusDate']]);
  eq('s4: zonder berekening telt alleen de werkelijke datum', summary(metric(dcmaOf({ ...ctx2, cpmResult: null }), 'invalidDates')), ['flag', 1, 2, 50]);

  const partial = { ...ctx, baseline: { ...ctx.baseline!, tasks: ctx.baseline!.tasks.filter(x => x.taskId !== C) } };
  const dp = dcmaOf(partial);
  eq('s4: taak zonder baseline — 11 en 14', [summary(metric(dp, 'missedTasks')), summary(metric(dp, 'bei'))],
    [['flag', 1, 2, 50], ['flag', 1, 3, 0.33]]);

  const nb = dcmaOf({ ...ctx, baseline: null });
  eq('s4: zonder baseline — 11, 13, 14', [summary(metric(nb, 'missedTasks')), metric(nb, 'cpli').value, metric(nb, 'cpli').cpli?.floatBasis, summary(metric(nb, 'bei'))],
    [['na', 'noBaseline'], 1, 'schedule', ['na', 'noBaseline']]);
}

{
  const TF = ['task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type', 'status_code',
    'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
    'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date', 'total_float_hr_cnt', 'free_float_hr_cnt'].join('\t');
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data', '%R\tC1\tS\tCA_Base\t8\t40\t',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date', '%R\tP1\tDCMA5\tC1\t2026-01-01\t2026-01-05',
    '%T\tTASK', `%F\t${TF}`,
    '%R\tR1\tP1\tC1\tA1\tFundering\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09\t2026-01-05\t2026-01-09\t2026-01-26\t2026-01-30\t120\t0',
    '%R\tR2\tP1\tC1\tA2\tRuwbouw\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-12\t2026-01-16\t2026-01-12\t2026-01-16\t2026-02-02\t2026-02-06\t120\t120',
    '%R\tR3\tP1\tC1\tA3\tVergunning\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09\t2026-02-02\t2026-02-06\t2026-02-02\t2026-02-06\t0\t0',
    '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tL1\tR2\tR1\tP1\tP1\tPR_FS\t0',
    '%E',
  ].join('\r\n'));
  S().newProject();
  S().applyOpenedImport(readXER(bytes) as ImportResult, { filePath: null, recompute: true, fit: false, linkedOpen: true });
  const fund = () => S().tasks.find(t => t.name === 'Fundering')!;
  eq('s5: laden opent de modus; Fundering toont P6-speling, niet kritiek', [S().datesAsRecorded, fund().time.totalFloat, fund().time.isCritical], [true, 15, false]);
  eq('s5: in de modus is punt 12 n.v.t. (niet berekend)', summary(metric(dcmaOf(ctxFromStore()), 'criticalPathTest')), ['na', 'notCalculated']);
  S().runCPM();
  const cp = metric(dcmaOf(ctxFromStore()), 'criticalPathTest');
  eq('s5: na Herberekenen draait punt 12 weer', [S().datesAsRecorded, cp.result, cp.test?.name], [false, 'pass', 'Fundering']);
}

for (const unit of ['days', 'hours'] as const) {
  for (const days of [43.975, 44, 44.025]) {
    S().newProject();
    S().setProject({ startDate: '2026-06-01' });
    const id = task('Grensduur', days);
    const time = S().tasks.find(t => t.id === id)!.time;
    S().updateTask(id, { time: { ...time, durationUnit: unit,
      ...(unit === 'hours' ? { durationMinutes: days * 480 } : {}) } });
    S().runCPM();
    const want = days > 44 ? ['flag', 1, 1, 100] : ['pass', 0, 1, 0];
    eq(`344 ${unit} ${days}: huidige duur exact`, summary(metric(dcmaOf(ctxFromStore()), 'highDuration')), want);
    S().saveBaseline('Grensduur');
    S().setActiveBaseline(S().baselines[0].id);
    eq(`344 ${unit} ${days}: baseline exact`, summary(metric(dcmaOf(ctxFromStore()), 'highDuration')), want);
  }
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`XX dcma: ${diffs.length} afwijking(en) in ${checks} checks`);
  process.exit(1);
}
console.log(`OK  dcma: ${checks} checks groen`);
