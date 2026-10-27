// Verricht resourcewerk blijft een feit bij een regel- en inzetwijziging, ook bij de latere
// voortgangsboeking. Echte store-acties; de fixture zet alleen geïmporteerde actuals/contouren.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { TimephasedContourPeriod } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
function near(label: string, got: number | undefined, want: number): void {
  checks++;
  if (got === undefined || !(Math.abs(got - want) <= 1e-6)) diffs.push(`${label}: kreeg ${got}, verwachtte ${want}`);
}
function ok(label: string, value: boolean): void {
  checks++;
  if (!value) diffs.push(label);
}

for (const sample of [
  { id: 'h50', days: 4, completion: 0.5 },
  { id: 'h32', days: 5, completion: 0.32 },
  // De urenmaat levert nu al de exacte 32%-rest van B3; dageninvoer wordt in F3c aangesloten.
  { id: 'h32-exact', days: 5, completion: 0.32, hours: true },
  { id: 'expliciet-nul', days: 4, completion: 0.5, actual: 0 },
  { id: 'expliciet', days: 4, completion: 0.5, actual: 321.5 },
  { id: 'contour', days: 4, completion: 0.5, contour: true },
  { id: 'beide', days: 4, completion: 0.5, actual: 321.5, contour: true },
]) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
  const id = S().addTask({ name: sample.id, time: createDefaultTaskTime('2026-06-01', sample.hours ? sample.days * 8 : sample.days, sample.hours ? 'hours' : 'days', S().calendar) });
  const rid = S().addResource({ name: 'Ploeg', description: '', type: 'LABOR', maxUnits: 1 });
  S().assignResource(id, rid, 1);
  const task = () => S().tasks.find(t => t.id === id)!;
  const assignment = () => S().assignments.find(a => a.taskId === id)!;
  ok(`${sample.id}: geen verricht werk vóór de start`, assignment().actualWorkMinutes === undefined);
  S().runCPM();
  ok(`${sample.id}: voortgang geaccepteerd`, S().setTaskProgress(id, sample.completion));
  const periods: TimephasedContourPeriod[] = [
    { kind: 'actual', afterMinutes: 0, minutes: 480, workMinutes: 250.25 },
    { kind: 'remaining', afterMinutes: 480, minutes: 1440, workMinutes: 960 },
  ];
  store.setState(s => {
    if (sample.actual !== undefined) s.assignments.find(a => a.taskId === id)!.actualWorkMinutes = sample.actual;
    if (sample.contour) s.tasks.find(t => t.id === id)!.timephasedContours = [{ resourceUid: null, resourceId: rid, periods }];
  });
  const actualPeriods = () => JSON.stringify(task().timephasedContours?.flatMap(c => c.periods.filter(p => p.kind === 'actual')) ?? []);
  const originalActualPeriods = actualPeriods();
  const before = task().time;
  const done = sample.actual ?? (sample.contour ? 250.25 : (sample.days - before.remainingTime!) * 480);
  const work = before.remainingTime! * 480;
  if (sample.hours) near(`${sample.id}: 32 % is exact 768 minuten verricht`, done, 768);
  S().setTaskWorkRule(id, 'FIXED_WORK');
  const restWork = assignment().remainingWorkMinutes!;
  near(`${sample.id}: restwerk bij de regelwissel`, restWork, work);
  ok(`${sample.id}: urenmaat na vast werk`, task().time.durationUnit === 'hours');
  S().updateAssignment(assignment().id, { unitsPerDay: 7 });
  near(`${sample.id}: verricht met de oude inzet vastgelegd`, assignment().actualWorkMinutes, done);
  near(`${sample.id}: restwerk blijft staan`, assignment().remainingWorkMinutes, restWork);
  ok(`${sample.id}: actual-contourperiodes na inzetwijziging behouden`, actualPeriods() === originalActualPeriods);
  if (!sample.contour) near(`${sample.id}: belasting behoudt het totale werk`, assignmentDayUnits(task(), assignment(), 480).reduce((a, b) => a + b, 0) * 480, done + restWork);
  ok(`${sample.id}: voltooien geaccepteerd`, S().setTaskProgress(id, 1));
  near(`${sample.id}: later geboekt verricht werk`, assignment().actualWorkMinutes, done + restWork);
  if (sample.actual === undefined && !sample.contour) near(`${sample.id}: oorspronkelijke ${sample.days * 480} minuten voltooid`, assignment().actualWorkMinutes, sample.days * 480);
  near(`${sample.id}: geen restwerk na voltooien`, assignment().remainingWorkMinutes, 0);
  ok(`${sample.id}: actual-contourperiodes ook na voltooien behouden`, actualPeriods() === originalActualPeriods);
}

/** Vier dagen, één resource en 50% via echte store-acties. Opzoeken op naam overleeft IFC-ids. */
function started(name: string, units = [1]) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
  const id = S().addTask({ name, time: createDefaultTaskTime('2026-06-01', 4) });
  for (const [i, value] of units.entries()) {
    const rid = S().addResource({ name: `Ploeg ${i + 1}`, description: '', type: 'LABOR', maxUnits: value });
    S().assignResource(id, rid, value);
  }
  S().runCPM();
  ok(`${name}: 50% geaccepteerd`, S().setTaskProgress(id, 0.5));
  const task = () => S().tasks.find(t => t.name === name)!;
  const own = () => S().assignments.filter(a => a.taskId === task().id);
  const snapshot = () => JSON.stringify({ time: task().time, assignments: own() });
  const roundTrip = () => {
    const workBefore = own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes]);
    const ifc = writeIFC(buildWriteIFCInput(S()));
    S().applyLoadedProject(readIFC(ifc), { linkedOpen: true, recompute: true, filePath: null });
    ok(`${name}: beide werkvelden overleven IFC`,
      JSON.stringify(own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes])) === JSON.stringify(workBefore));
  };
  return { S, task, own, snapshot, roundTrip };
}

// Zonder vast werk moet voortgang de vastgelegde actuals blijven aanvullen. Een latere
// regelwissel of IFC-rondgang mag geen werk laten verdwijnen: 960 + 2 d × inzet 7 = 7680 min.
for (const fixedAt75 of [false, true]) {
  for (const viaIfc of [false, true]) {
    const name = `standaard/vast-bij-75=${fixedAt75}/IFC=${viaIfc}`;
    const f = started(name);
    const before = f.snapshot();
    f.S().updateAssignment(f.own()[0].id, { unitsPerDay: 7 });
    near(`${name}: oude actual blijft 960`, f.own()[0].actualWorkMinutes, 960);
    near(`${name}: rest bij nieuwe inzet is 6720`, f.own()[0].remainingWorkMinutes, 6720);
    const edited = f.snapshot();
    f.S().undo();
    ok(`${name}: undo herstelt de werkvelden`, f.snapshot() === before);
    f.S().redo();
    ok(`${name}: redo herstelt de werkvelden`, f.snapshot() === edited);
    if (viaIfc) f.roundTrip();
    ok(`${name}: 75% geaccepteerd`, f.S().setTaskProgress(f.task().id, 0.75));
    near(`${name}: 75% boekt 4320`, f.own()[0].actualWorkMinutes, 4320);
    near(`${name}: bij 75% resteert 3360`, f.own()[0].remainingWorkMinutes, 3360);
    if (fixedAt75) {
      f.S().setTaskWorkRule(f.task().id, 'FIXED_WORK');
      near(`${name}: wissel behoudt 4320 verricht`, f.own()[0].actualWorkMinutes, 4320);
      near(`${name}: wissel behoudt 3360 restwerk`, f.own()[0].remainingWorkMinutes, 3360);
    }
    if (viaIfc) f.roundTrip();
    ok(`${name}: 100% geaccepteerd`, f.S().setTaskProgress(f.task().id, 1));
    near(`${name}: 100% boekt 7680`, f.own()[0].actualWorkMinutes, 7680);
    near(`${name}: voltooid zonder restwerk`, f.own()[0].remainingWorkMinutes, 0);
    const complete = f.snapshot();
    ok(`${name}: terug naar 50% geaccepteerd`, f.S().setTaskProgress(f.task().id, 0.5));
    near(`${name}: heropenen behoudt totaal 7680`, f.own()[0].actualWorkMinutes! + f.own()[0].remainingWorkMinutes!, 7680);
    f.S().undo();
    ok(`${name}: undo heropenen herstelt voltooid`, f.snapshot() === complete);
    f.S().redo();
    ok(`${name}: opnieuw voltooien geaccepteerd`, f.S().setTaskProgress(f.task().id, 1));
    near(`${name}: opnieuw voltooid op 7680`, f.own()[0].actualWorkMinutes, 7680);
  }
}

// Een nieuwe resource deelt alleen in de toekomst. Vast werk verdeelt de 960 resterende minuten;
// de standaardregel voegt 2880 minuten toe. Geen van beide geeft de nieuwkomer verrichte uren.
for (const fixed of [false, true]) {
  const name = `resource-erbij/vast=${fixed}`;
  const f = started(name);
  if (fixed) f.S().setTaskWorkRule(f.task().id, 'FIXED_WORK');
  const rid = f.S().addResource({ name: 'Nieuwe ploeg', description: '', type: 'LABOR', maxUnits: 3 });
  const before = f.snapshot();
  f.S().assignResource(f.task().id, rid, 3);
  near(`${name}: bestaande actual blijft 960`, f.own()[0].actualWorkMinutes, 960);
  near(`${name}: nieuwe actual is expliciet nul`, f.own()[1].actualWorkMinutes, 0);
  near(`${name}: rest bestaande resource`, f.own()[0].remainingWorkMinutes, fixed ? 240 : 960);
  near(`${name}: rest nieuwe resource`, f.own()[1].remainingWorkMinutes, fixed ? 720 : 2880);
  const added = f.snapshot();
  f.S().undo();
  ok(`${name}: undo herstelt de toewijzingen`, f.snapshot() === before);
  f.S().redo();
  ok(`${name}: redo herstelt ook expliciete nul`, f.snapshot() === added);
  f.roundTrip();
  ok(`${name}: voltooien geaccepteerd`, f.S().setTaskProgress(f.task().id, 1));
  near(`${name}: nieuwkomer boekt alleen haar restwerk`, f.own()[1].actualWorkMinutes, fixed ? 720 : 2880);
  near(`${name}: totale boeking`, f.own().reduce((sum, a) => sum + a.actualWorkMinutes!, 0), fixed ? 1920 : 4800);
  near(`${name}: geen restwerk`, f.own().reduce((sum, a) => sum + a.remainingWorkMinutes!, 0), 0);
}

// Goedgekeurde randgevallen: verschillende inzetten en behoud van de blijvende actual bij eraf.
{
  const f = started('verschillende-inzetten', [0.5, 2]);
  f.S().setTaskWorkRule(f.task().id, 'FIXED_WORK');
  near('verschillende inzetten: eerste actual', f.own()[0].actualWorkMinutes, 480);
  near('verschillende inzetten: tweede actual', f.own()[1].actualWorkMinutes, 1920);
  f.S().updateAssignment(f.own()[0].id, { unitsPerDay: 3 });
  ok('verschillende inzetten: voltooid', f.S().setTaskProgress(f.task().id, 1));
  near('verschillende inzetten: eerste voltooid', f.own()[0].actualWorkMinutes, 960);
  near('verschillende inzetten: tweede voltooid', f.own()[1].actualWorkMinutes, 3840);
}
{
  const f = started('resource-eraf', [1, 2]);
  f.S().setTaskWorkRule(f.task().id, 'FIXED_WORK');
  const before = f.snapshot();
  f.S().unassignResource(f.own()[1].id);
  near('eraf: actual blijver blijft 960', f.own()[0].actualWorkMinutes, 960);
  near('eraf: restwerk verdeeld naar blijver', f.own()[0].remainingWorkMinutes, 2880);
  const removed = f.snapshot();
  f.S().undo();
  ok('eraf: undo herstelt werkvelden', f.snapshot() === before);
  f.S().redo();
  ok('eraf: redo herstelt werkvelden', f.snapshot() === removed);
  ok('eraf: voltooid', f.S().setTaskProgress(f.task().id, 1));
  near('eraf: blijver boekt 3840', f.own()[0].actualWorkMinutes, 3840);
}

console.log(`${checks} checks, ${diffs.length} afwijkingen`);
for (const d of diffs) console.log(`XX ${d}`);
process.exit(diffs.length ? 1 : 0);
