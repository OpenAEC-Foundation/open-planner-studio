// Taak T6 — `computeHistogramReport`: bucketing (dag/week), venster-capaciteit (eigen enumeratie
// over ÁLLE werkdagen van het bucketvenster, ook onbelaste) en veroorzaker-attributie (`causes`
// alléén voor buckets met minstens één overbelaste dag). Draait headless tegen de ECHTE store:
// state opbouwen via store-acties (newProject/addTask/addResource/assignResource/runCPM) en dan de
// pure engine-functie aanroepen met dezelfde bronnen als `computeResourceLoad`.
//
// Bindende eisen (spec-rij `get_resource_histogram`, T6-brief, uitgebreid in reviewronde taak 3):
//  1. Twee assignments veroorzaken samen één overbelaste dag ⇒ `causes` van die bucket noemt precies
//     die twee met de juiste `contribution`, en niets anders.
//  2. Bucket zonder overbelasting ⇒ géén `causes`-veld.
//  3. Week-bucket: `load` = som over de week, `peakDayLoad` = hoogste dag (een eendaagse piek
//     verdwijnt niet in de weeksom).
//  4. Week-capaciteit: capaciteit 2/dag, 5 werkdagen, maar 2 belaste dagen ⇒ `capacity` = 10
//     (niet 4 — de onderschattingsbug uit de review).
//  5. (reviewronde taak 3, B1c-W0.1) Gesplitste taak (`splitGaps`) ⇒ de dagbuckets op de pauzedagen
//     tonen géén last — `computeHistogramReport` deelt dezelfde `enumerateTaskWorkDays`-mapping als
//     `computeResourceLoad`, maar had tot deze case geen eigen dekking (terugdraaien van de W0.1-fix
//     in de histogram-helft bleef groen zonder deze test).
//  6. (reviewronde taak 3, slot) ELAPSEDTIME-taak ⇒ geen last voorbij `earlyFinish`. Met het
//     STANDAARD venster (dat zelf al op de taakdatums klemt) is deze regressie ONZICHTBAAR — een
//     eventuele phantom-last voorbij `earlyFinish` heeft dan simpelweg geen bucket om in te landen.
//     Deze case geeft daarom expliciet een `to` ruim voorbij `earlyFinish` mee.
//  7. (reviewronde taak 3, slot) Taak met eigen (6-daagse) `calendarId` ⇒ de zaterdag-dagbucket
//     toont de last (de projectkalender is ma-vr; dit toetst dat de mapping de TAAKkalender volgt).
import { useAppStore, test, assert, assertEq, run } from './harness';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

/** Zet een schoon project op met ma-vr-kalender vanaf 2026-06-01 (maandag). */
function cleanProject(): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01' });
}

/** Bronnen zoals `computeResourceLoad`/`computeHistogramReport` ze verwachten, vers uit de store. */
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
  };
}

// ── Eis 1: twee assignments → één overbelaste dag → causes noemt precies die twee ─────────────────
test('dag-bucket: twee assignments overbelasten één dag ⇒ causes bevat precies die twee, juiste contribution', () => {
  cleanProject();
  const rId = S().addResource({
    name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2,
  });
  // Twee losse 1-daagse taken, beide op ma 2026-06-01; elk krijgt dezelfde resource op 2 units/dag.
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const t2 = S().addTask({ name: 'T2', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().assignResource(t1, rId, 2);
  S().assignResource(t2, rId, 2);
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  assert(!!res, 'resource ontbreekt in rapport');
  // De enige bucket met belasting = ma 2026-06-01 (load 4 > capaciteit 2).
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'bucket 2026-06-01 ontbreekt');
  assertEq(bucket.load, 4, 'bucket.load');
  assertEq(bucket.peakDayLoad, 4, 'bucket.peakDayLoad (dag == load)');
  assertEq(bucket.capacity, 2, 'bucket.capacity (één werkdag × maxUnits 2)');
  assertEq(bucket.overallocatedDays, ['2026-06-01'], 'overallocatedDays');

  assert(!!bucket.causes, 'causes ontbreekt op overbelaste bucket');
  const causes = bucket.causes!;
  assertEq(causes.length, 2, 'aantal causes');
  // Precies de twee assignments, elk 2 units bijdrage; niets anders.
  const a1 = S().assignments.find(a => a.taskId === t1)!;
  const a2 = S().assignments.find(a => a.taskId === t2)!;
  const byId = new Map(causes.map(c => [c.assignmentId, c]));
  assert(byId.has(a1.id) && byId.has(a2.id), 'causes noemen niet precies de twee assignments');
  assertEq(byId.get(a1.id)!.contribution, 2, 'contribution assignment 1');
  assertEq(byId.get(a1.id)!.taskId, t1, 'taskId assignment 1');
  assertEq(byId.get(a2.id)!.contribution, 2, 'contribution assignment 2');
  assertEq(byId.get(a2.id)!.taskId, t2, 'taskId assignment 2');
});

// ── Eis 2: bucket zonder overbelasting ⇒ géén causes-veld ─────────────────────────────────────────
test('dag-bucket zonder overbelasting ⇒ geen causes-veld', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Solo', type: 'LABOR', description: '', maxUnits: 2 });
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  S().assignResource(t1, rId, 1); // load 1 ≤ capaciteit 2 → geen overbelasting
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assertEq(bucket.load, 1, 'bucket.load');
  assertEq(bucket.overallocatedDays, [], 'overallocatedDays leeg');
  assert(bucket.causes === undefined, `verwacht geen causes-veld, kreeg ${JSON.stringify(bucket.causes)}`);
});

// ── Eis 3: week-bucket ⇒ load = som over de week, peakDayLoad = hoogste dag ───────────────────────
test('week-bucket: load = weeksom, peakDayLoad = hoogste dag (eendaagse piek verdwijnt niet)', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 5 });
  // 3-daagse taak ma-wo, FRONT_LOADED @ 2 units/dag ⇒ dagverdeling [3,2,1] (totaal 6).
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().assignResource(t1, rId, 2, 'FRONT_LOADED');
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'week' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  // Eén week-bucket (ma 2026-06-01 .. zo 2026-06-07).
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'week-bucket 2026-06-01 ontbreekt');
  assertEq(bucket.end, '2026-06-07', 'week-bucket eindigt op zondag');
  assertEq(bucket.load, 6, 'week-load = som [3,2,1]');
  assertEq(bucket.peakDayLoad, 3, 'week-peakDayLoad = hoogste dag');
});

// ── Eis 4: week-capaciteit = som over ÁLLE werkdagen van het venster, ook onbelaste ──────────────
test('week-capaciteit: 2/dag × 5 werkdagen = 10, ook al zijn maar 2 dagen belast', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  // 2-daagse taak ma-di in dezelfde week; maar 2 belaste dagen, week heeft 5 werkdagen (ma-vr).
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 2) });
  S().assignResource(t1, rId, 1);
  S().runCPM();

  const report = computeHistogramReport({ ...sources(), bucket: 'week' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const bucket = res.buckets.find(b => b.start === '2026-06-01')!;
  assert(!!bucket, 'week-bucket 2026-06-01 ontbreekt');
  // 2 belaste dagen (load 1+1=2), maar capaciteit telt alle 5 werkdagen van ma-vr: 5 × 2 = 10.
  assertEq(bucket.load, 2, 'week-load = 2 belaste dagen');
  assertEq(bucket.capacity, 10, 'week-capaciteit = 5 werkdagen × maxUnits 2 (niet 4)');
});

// ── Eis 5 (reviewronde taak 3): gesplitste taak ⇒ dagbuckets op de pauzedagen zijn leeg ──────────
test('gesplitste taak: histogram-dagbuckets tonen geen last op de pauzedagen', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  // Zelfde referentiegaten als check-split-walk.ts/check-resource-load-splits.ts: taak 06-01..06-05
  // (CPM rekent earlyFinish uit inclusief de twee gat-dagen), werkt op 06-01/06-03/06-05.
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
  assertEq(S().tasks.find(t => t.id === t1)!.time.earlyFinish, '2026-06-05', 'setup: CPM rekent de gaten mee in earlyFinish');

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const onDay = (iso: string) => res.buckets.find(b => b.start === iso);

  assertEq(onDay('2026-06-01')?.load, 1, 'werkdag 06-01 draagt last');
  assertEq(onDay('2026-06-02')?.load, 0, 'pauzedag 06-02 draagt geen last');
  assertEq(onDay('2026-06-03')?.load, 1, 'werkdag 06-03 (ná het eerste gat) draagt last');
  assertEq(onDay('2026-06-04')?.load, 0, 'pauzedag 06-04 draagt geen last');
  assertEq(onDay('2026-06-05')?.load, 1, 'werkdag 06-05 (ná het tweede gat) draagt last');
});

// ── Eis 6 (reviewronde taak 3, slot): ELAPSEDTIME ⇒ geen last voorbij earlyFinish ────────────────
test('ELAPSEDTIME-taak: histogram-dagbuckets tonen geen last voorbij earlyFinish', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  // Zelfde vorm als groep (c) van tests/planning/check-resource-load-splits.ts: 10 KALENDERdagen
  // (ELAPSEDTIME) vanaf ma 2026-06-01 — het probe-geval uit de review die de CRITICAL
  // ELAPSEDTIME-bug vond. `earlyFinish` zelf lezen we uit de ECHTE CPM-uitkomst (geen aanname op
  // papier hardcoden): de exacte 24/7-klokoptelling is een CPM-detail, niet iets deze case hoeft te
  // her-berekenen — het gaat hier om of de mapping bij díé earlyFinish stopt, niet om welke datum
  // dat precies is.
  const t1 = S().addTask({
    name: 'T1', isMilestone: false, parentId: null,
    time: { ...createDefaultTaskTime('2026-06-01', 10), durationType: 'ELAPSEDTIME' },
  });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  const earlyFinish = S().tasks.find(t => t.id === t1)!.time.earlyFinish;

  // Venster ruim voorbij earlyFinish: het STANDAARD venster klemt zelf al op de taakdatums, dus
  // zonder een expliciete `to` voorbij earlyFinish zou een eventuele phantom-last simpelweg geen
  // bucket vinden om in te landen — de regressie zou hier onzichtbaar zijn (zie de moduleheader).
  const report = computeHistogramReport({ ...sources(), bucket: 'dag', from: '2026-06-01', to: '2026-06-20' });
  const res = report.resources.find(r => r.resourceId === rId)!;

  const onFinish = res.buckets.find(b => b.start === earlyFinish);
  assert(!!onFinish && onFinish.load === 1, `earlyFinish (${earlyFinish}) zelf draagt last 1 (sanity — kreeg ${JSON.stringify(onFinish)})`);

  const afterFinish = res.buckets.filter(b => b.start > earlyFinish);
  assert(afterFinish.length > 0, 'sanity: er bestaan buckets ná earlyFinish binnen het venster');
  const phantom = afterFinish.filter(b => b.load > 0);
  assert(phantom.length === 0, `geen enkele bucket ná earlyFinish (${earlyFinish}) mag last dragen (kreeg ${JSON.stringify(phantom)})`);
});

// ── Eis 7 (reviewronde taak 3, slot): taak met eigen (6-daagse) kalender ⇒ zaterdag-bucket last ──
test('taak met eigen (6-daagse) kalender: histogram-dagbucket op zaterdag toont de last', () => {
  cleanProject();
  const rId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 2 });
  const sixDayCalId = S().addCalendar({
    name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  });
  // 3 werkdagen vanaf vrijdag 2026-06-05 op de 6-daagse kalender ⇒ vr 06-05, za 06-06, ma 06-08
  // (de projectkalender is ma-vr — dit toetst specifiek dat de mapping de TAAKkalender volgt, niet
  // onvoorwaardelijk de projectkalender; zelfde referentiegeval als groep (b) van
  // check-resource-load-splits.ts, nu via de echte CPM/store).
  const t1 = S().addTask({
    name: 'T1', isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-05', 3),
    calendarId: sixDayCalId,
  });
  S().assignResource(t1, rId, 1);
  S().runCPM();
  assertEq(S().tasks.find(t => t.id === t1)!.time.earlyFinish, '2026-06-08', 'setup: CPM rekent 3 werkdagen op de 6-daagse kalender (vr/za/ma)');

  const report = computeHistogramReport({ ...sources(), bucket: 'dag' });
  const res = report.resources.find(r => r.resourceId === rId)!;
  const onDay = (iso: string) => res.buckets.find(b => b.start === iso);

  assertEq(onDay('2026-06-05')?.load, 1, 'vr 06-05 draagt last');
  assertEq(onDay('2026-06-06')?.load, 1, 'za 06-06 (werkdag op de taakkalender) draagt last');
  assertEq(onDay('2026-06-07')?.load, 0, 'zo 06-07 draagt geen last (vrij, ook op de taakkalender)');
  assertEq(onDay('2026-06-08')?.load, 1, 'ma 06-08 draagt last');
});

await run();
