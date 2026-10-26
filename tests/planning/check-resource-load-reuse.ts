// Vergelijk volledige uitvoer met een invoer waarin geen taak dagen kan delen tussen toewijzingen.
// De schaalpoort telt echt kalenderwerk; wandkloktijden staan alleen in de aparte CI-meting.
import assert from 'node:assert/strict';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import {
  computeResourceLoad, computeHistogramReport, contourLookup,
  type HistogramInput, type HistogramReport,
} from '@/engine/scheduler/ResourceLoad';
import { makeResourceLoadReuseFixture } from './resourceLoadReuseFixture';

let checks = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), label);
  checks++;
}
function load(input: HistogramInput) {
  return computeResourceLoad(input.resources, input.assignments, input.tasks, input.calendar, input.calendars);
}

function withoutSharedTasks(input: HistogramInput) {
  const taskById = new Map(input.tasks.map(t => [t.id, t]));
  const contourOf = contourLookup(input.assignments);
  const originalIds = new Map<string, string>();
  const tasks: HistogramInput['tasks'] = [];
  const assignments = input.assignments.map(a => {
    const task = taskById.get(a.taskId);
    if (!task) return a;
    const id = `kopie-${a.id}`;
    originalIds.set(id, task.id);
    const contour = contourOf(task, a);
    tasks.push({ ...task, id, timephasedContours: contour ? [contour] : undefined });
    return { ...a, taskId: id };
  });
  return { input: { ...input, tasks, assignments }, originalIds };
}

function originalCauseIds(report: HistogramReport, originalIds: Map<string, string>): HistogramReport {
  for (const r of report.resources) for (const b of r.buckets) {
    for (const cause of b.causes ?? []) cause.taskId = originalIds.get(cause.taskId) ?? cause.taskId;
  }
  return report;
}

function parity(input: HistogramInput, label: string): void {
  const before = JSON.stringify(input);
  const reference = withoutSharedTasks(input);
  eq(load(input), load(reference.input), `${label}: belasting, capaciteit, uren en redenen`);
  for (const bucket of ['dag', 'week', 'maand'] as const) {
    eq(
      computeHistogramReport({ ...input, bucket }),
      originalCauseIds(computeHistogramReport({ ...reference.input, bucket }), reference.originalIds),
      `${label}: ${bucket} inclusief veroorzakers en hun volgorde`,
    );
  }
  eq(JSON.stringify(input), before, `${label}: invoer blijft ongewijzigd`);
}

const mixed = makeResourceLoadReuseFixture(24, 8);
parity(mixed, 'kalenders, uitzonderingen, elapsed, voltooid, voortgang, urensplits en contourlengtes');
mixed.assignments.reverse();
parity(mixed, 'omgekeerde toewijzingen en contourkoppeling');
// Zelfde objecten en ids, nieuwe toestand: geen cache mag een volgende aanroep overleven.
const previousLoad = load(mixed);
mixed.calendar.holidays.push({ name: 'Nieuw vrij', startDate: '2026-10-20', endDate: '2026-10-21' });
mixed.calendars[0].hoursPerDay = 4;
mixed.calendars[0].workEndHour = 12;
mixed.tasks[0].time.earlyStart = '2026-11-09';
mixed.tasks[1].splitGaps = [{ afterMinutes: 960, gapMinutes: 1920 }];
mixed.tasks[3].time.actualFinish = undefined;
mixed.tasks[6].timephasedContours![1].periods[0].minutes = 2880;
assert.notDeepEqual(load(mixed), previousLoad, 'de gewijzigde invoer verandert echt de belasting');
parity(mixed, 'volgende aanroep na kalender-, datum-, split-, voltooiings- en contourwijziging');

const skipped = makeResourceLoadReuseFixture(8, 4);
skipped.tasks[1].isMilestone = true;
skipped.tasks[2].childIds = ['samenvattingskind'];
// Lege verdelingen vóór, tussen en na niet-lege verdelingen van dezelfde taak.
skipped.tasks[0].time.scheduleDuration = 0;
skipped.tasks[0].timephasedContours = ['r1', 'r2'].map(resourceId => ({
  resourceUid: null, resourceId, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 480, kind: 'remaining' }],
}));
for (const [index, resourceId] of [[0, 'r0'], [1, 'r1'], [2, 'r0'], [3, 'r2']] as const) {
  skipped.assignments.find(a => a.id === `a0-${index}`)!.resourceId = resourceId;
}
skipped.assignments.push({ id: 'laatste-leeg', taskId: 't0', resourceId: 'r0', unitsPerDay: 1 });
skipped.assignments.push({ id: 'spook', taskId: 'ontbreekt', resourceId: 'r0', unitsPerDay: 1 });
skipped.assignments.push({ id: 'wees', taskId: 't7', resourceId: 'ontbreekt', unitsPerDay: 1 });
parity(skipped, 'lege verdelingen, mijlpaal, samenvatting en ontbrekende taak/resource');

function calendarCalls<T>(run: () => T): { value: T; calls: number } {
  const original = CalendarEngine.prototype.isWorkDay;
  let calls = 0;
  CalendarEngine.prototype.isWorkDay = function(date) { calls++; return original.call(this, date); };
  try { return { value: run(), calls }; }
  finally { CalendarEngine.prototype.isWorkDay = original; }
}

function scaleInput(taskCount: number, count: number): HistogramInput {
  const input = makeResourceLoadReuseFixture(taskCount, count);
  for (const task of input.tasks) {
    task.time.durationType = 'WORKTIME';
    task.time.scheduleDuration = 32;
    task.time.completion = 0;
    task.time.actualFinish = undefined;
    task.timephasedContours = undefined;
  }
  for (const a of input.assignments) {
    a.resourceId = 'r0'; a.unitsPerDay = 8 / count; a.curve = 'UNIFORM';
    a.curveValues = undefined; a.remainingWorkMinutes = undefined; a.actualWorkMinutes = undefined;
  }
  for (const r of input.resources) { r.maxUnits = 1_000_000; r.availabilitySteps = []; }
  return input;
}

for (const [label, run] of [['belasting', load], ['histogram', computeHistogramReport]] as const) {
  const one = calendarCalls(() => run(scaleInput(100, 1)));
  const eight = calendarCalls(() => run(scaleInput(100, 8)));
  const doubled = calendarCalls(() => run(scaleInput(200, 8)));
  assert.ok(one.calls > 1000, `${label}: instrumentatie raakt het echte kalenderwerk`);
  eq(eight.value, one.value, `${label}: acht deeltoewijzingen houden dezelfde uitvoer`);
  eq(eight.calls, one.calls, `${label}: achtmaal meer toewijzingen geeft geen extra kalenderdoorloop`);
  assert.ok(doubled.calls > eight.calls && doubled.calls < eight.calls * 2.1, `${label}: lineaire schaal met taken`);
  console.log(`${label}: kalenderaanroepen 100×1=${one.calls}, 100×8=${eight.calls}, 200×8=${doubled.calls}`);
}
console.log(`OK resource-load-reuse: ${checks} exacte vergelijkingen en kalender-schaalpoorten`);
