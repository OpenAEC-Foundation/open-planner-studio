import { useAppStore, test, assert, assertEq, run } from './harness';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { ELAPSED_CLOCK, workdayOfInstant } from '@/engine/calendar/workdayRules';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

function cleanProject(): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01' });
}

function sources() {
  const s = S();
  return {
    tasks: s.tasks,
    sequences: s.sequences,
    assignments: s.assignments,
    resources: s.resources,
    calendar: s.calendar,
    calendars: s.calendars,
    cpmResult: s.cpmResult,
    schedulingOptions: effectiveSchedulingOptions(s.project),
  };
}

test('dag-bucket: twee assignments overbelasten één dag ⇒ causes bevat precies die twee, juiste contribution', () => {
  cleanProject();
  const rId = S().addResource({
    name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2,
  });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const t2 = S().addTask({ name: 'T2', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().assignResource(t1, rId, 2);
  S().assignResource(t2, rId, 2);
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  assert(!!res, 'resource ontbreekt in rapport');
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'bucket 2026-06-01 ontbreekt');
  assertEq(bucket.load, 4, 'bucket.load');
  assertEq(bucket.peakDayLoad, 4, 'bucket.peakDayLoad (dag == load)');
  assertEq(bucket.capacity, 2, 'bucket.capacity (één werkdag × maxUnits 2)');
  assertEq(bucket.overallocatedDays, ['2026-06-01'], 'overallocatedDays');

  assert(!!bucket.causes, 'causes ontbreekt op overbelaste bucket');
  const causes = bucket.causes!;
  assertEq(causes.length, 2, 'aantal causes');
  const a1 = S().assignments.find(a => a.taskId === t1)!;
  const a2 = S().assignments.find(a => a.taskId === t2)!;
  const byId = new Map(causes.map(c => [c.assignmentId, c]));
  assert(byId.has(a1.id) && byId.has(a2.id), 'causes noemen niet precies de twee assignments');
  assertEq(byId.get(a1.id)!.contribution, 2, 'contribution assignment 1');
  assertEq(byId.get(a1.id)!.taskId, t1, 'taskId assignment 1');
  assertEq(byId.get(a2.id)!.contribution, 2, 'contribution assignment 2');
  assertEq(byId.get(a2.id)!.taskId, t2, 'taskId assignment 2');
});

test('dag-bucket zonder overbelasting ⇒ geen causes-veld', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Solo', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().assignResource(t1, rId, 1);
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assertEq(bucket.load, 1, 'bucket.load');
  assertEq(bucket.overallocatedDays, [], 'overallocatedDays leeg');
  assert(bucket.causes === undefined, `verwacht geen causes-veld, kreeg ${JSON.stringify(bucket.causes)}`);
});

test('week-bucket: load = weeksom, peakDayLoad = hoogste dag (eendaagse piek verdwijnt niet)', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 5 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().assignResource(t1, rId, 2, 'FRONT_LOADED');
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'week' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'week-bucket 2026-06-01 ontbreekt');
  assertEq(bucket.end, '2026-06-07', 'week-bucket eindigt op zondag');
  assertEq(bucket.load, 6, 'week-load = som [3,2,1]');
  assertEq(bucket.peakDayLoad, 3, 'week-peakDayLoad = hoogste dag');
});

test('week-capaciteit: 2/dag × 5 werkdagen = 10, ook al zijn maar 2 dagen belast', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().assignResource(t1, rId, 1);
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'week' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'week-bucket 2026-06-01 ontbreekt');
  assertEq(bucket.load, 2, 'week-load = 2 belaste dagen');
  assertEq(bucket.capacity, 10, 'week-capaciteit = 5 werkdagen × maxUnits 2 (niet 4)');
});

test('gesplitste taak: histogram-dagbuckets tonen geen last op de pauzedagen', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({
    name: 'T1', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 3),
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  assertEq(S().tasks.find(t => t.id === t1)!.time.earlyFinish, '2026-06-05T16:00', 'setup: CPM rekent de gaten mee in earlyFinish');

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const onDay = (iso: string) => res.buckets.find(b => b.start === iso);

  assertEq(onDay('2026-06-01')?.load, 1, 'werkdag 06-01 draagt last');
  assertEq(onDay('2026-06-02')?.load, 0, 'pauzedag 06-02 draagt geen last');
  assertEq(onDay('2026-06-03')?.load, 1, 'werkdag 06-03 (ná het eerste gat) draagt last');
  assertEq(onDay('2026-06-04')?.load, 0, 'pauzedag 06-04 draagt geen last');
  assertEq(onDay('2026-06-05')?.load, 1, 'werkdag 06-05 (ná het tweede gat) draagt last');
});

test('ELAPSEDTIME-taak: histogram-dagbuckets tonen geen last voorbij earlyFinish', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({
    name: 'T1', isMilestone: false, parentId: null,
    time: { ...createDefaultTaskTime('2026-06-01', 10), durationType: 'ELAPSEDTIME' },
  });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  const earlyFinish = S().tasks.find(t => t.id === t1)!.time.earlyFinish;

  const report = computeHistogramReport({ ...sources(), bucket: 'dag', from: '2026-06-01', to: '2026-06-20' });
  const res = report.resources.find(r => r.resourceId === rId)!;

  const lastDay = workdayOfInstant(ELAPSED_CLOCK, earlyFinish, 'end');
  const onFinish = res.buckets.find(b => b.start === lastDay);
  assert(!!onFinish && onFinish.load === 1, `de werkdag van earlyFinish (${earlyFinish} ⇒ ${lastDay}) draagt last 1 (sanity — kreeg ${JSON.stringify(onFinish)})`);

  const afterFinish = res.buckets.filter(b => b.start > lastDay);
  assert(afterFinish.length > 0, 'sanity: er bestaan buckets ná earlyFinish binnen het venster');
  const phantom = afterFinish.filter(b => b.load > 0);
  assert(phantom.length === 0, `geen enkele bucket ná earlyFinish (${earlyFinish}) mag last dragen (kreeg ${JSON.stringify(phantom)})`);
});

test('taak met eigen (6-daagse) kalender: histogram-dagbucket op zaterdag toont de last', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const sixDayCalId = S().addCalendar({
    name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  });
  const t1 = S().addTask({
    name: 'T1', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-05', 3),
    calendarId: sixDayCalId,
  });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  assertEq(S().tasks.find(t => t.id === t1)!.time.earlyFinish, '2026-06-08T16:00', 'setup: CPM rekent 3 werkdagen op de 6-daagse kalender (vr/za/ma)');

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const onDay = (iso: string) => res.buckets.find(b => b.start === iso);

  assertEq(onDay('2026-06-05')?.load, 1, 'vr 06-05 draagt last');
  assertEq(onDay('2026-06-06')?.load, 1, 'za 06-06 (werkdag op de taakkalender) draagt last');
  assertEq(onDay('2026-06-07')?.load, 0, 'zo 06-07 draagt geen last (vrij, ook op de taakkalender)');
  assertEq(onDay('2026-06-08')?.load, 1, 'ma 06-08 draagt last');
});

await run();
