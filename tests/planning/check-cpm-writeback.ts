// F5 rekent buiten de Immer-producer: volledige uitkomstpariteit met de oude draft-route,
// inclusief afgeleide duur/status, referentiedeling en atomische publicatie. Geen tijdsbudget:
// de reproduceerbare meting staat in measure-cpm-writeback.mjs en docs/superpowers/evidence/.
import { deepStrictEqual, strictEqual } from 'node:assert';
import { produce } from 'immer';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { computeReliableResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { isLeafTask } from '@/utils/taskHierarchy';
import { markScheduleStale } from '@/state/transaction';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const hours of [false, true]) {
    const data = generateBenchmarkProject(100, { seed: 0x5eed });
    data.project.schedulingProfile = builtInProfile(profile);
    const leaves = data.tasks.filter(isLeafTask);
    // De voortgangsrollup schrijft behalve time ook de status van verzameltaken.
    leaves[0].status = 'STARTED';
    leaves[0].time.completion = 0.5;
    leaves[0].time.actualStart = leaves[0].time.scheduleStart;
    const manual = data.tasks.find(t => !isLeafTask(t))!;
    manual.manuallyScheduled = true;
    manual.time.scheduleStart = '2026-01-12';
    manual.time.scheduleFinish = '2026-01-23';
    manual.time.scheduleDuration = 10;
    leaves[1].manuallyScheduled = true;
    leaves[2].isHammock = true;
    if (hours) {
      for (const task of data.tasks) {
        task.time.durationUnit = 'hours';
        task.time.durationMinutes = task.time.scheduleDuration * 480;
      }
    }
    const { store } = createAppStoreContext();
    store.setState(s => {
      s.project = data.project; s.tasks = data.tasks; s.sequences = data.sequences;
      s.calendar = data.calendar; s.calendars = [data.calendar];
      s.resources = data.resources; s.assignments = data.assignments;
    });
    const before = store.getState();
    const savedTasks = structuredClone(before.tasks);
    // De oude route is het differentiële orakel: solve én resourcebelasting op de draft.
    const expected = produce(before, s => {
      s.cpmResult = solveProject(solveInputFor(s.project, s.tasks, s.sequences, s.calendar, s.calendars));
      s.resourceLoadResult = computeReliableResourceLoad(
        s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
        effectiveSchedulingOptions(s.project),
      );
    });
    strictEqual(expected.cpmResult?.error, undefined);
    strictEqual(expected.tasks.find(t => t.id === manual.id)!.time.earlyStart, '2026-01-12');
    strictEqual(expected.tasks.some(t => !isLeafTask(t) && t.status === 'STARTED'), true);
    let publications = 0;
    const unsubscribe = store.subscribe(s => {
      if (s.cpmResult === before.cpmResult) return;
      publications++;
      deepStrictEqual(s.tasks, expected.tasks, 'taken en berekening verschijnen samen');
      deepStrictEqual(s.resourceLoadResult, expected.resourceLoadResult, 'belasting verschijnt in dezelfde commit');
    });
    before.runCPM();
    unsubscribe();
    strictEqual(publications > 0, true);
    const after = store.getState();
    deepStrictEqual(after.tasks, expected.tasks, `${profile}/${hours}: alle taakvelden`);
    deepStrictEqual(after.cpmResult, expected.cpmResult, `${profile}/${hours}: hele CPM-uitkomst`);
    deepStrictEqual(after.resourceLoadResult, expected.resourceLoadResult);
    deepStrictEqual(before.tasks, savedTasks, 'invoer en gedeelde undo-referenties blijven intact');
    strictEqual(after.historyEvents, before.historyEvents, 'F5 voegt geen undo-stap toe');
    strictEqual(after.isDirty, before.isDirty, 'F5 wijzigt isDirty niet');
    const repeated = produce(after, s => {
      s.cpmResult = solveProject(solveInputFor(s.project, s.tasks, s.sequences, s.calendar, s.calendars));
    });
    after.runCPM();
    deepStrictEqual(store.getState().tasks, repeated.tasks, 'herhaalde F5 blijft gelijk aan de draft-route');
    for (let i = 0; i < after.tasks.length; i++) {
      if (repeated.tasks[i] === after.tasks[i]) {
        strictEqual(store.getState().tasks[i], after.tasks[i], 'ongewijzigde taak houdt dezelfde referentie');
      }
    }

    // Een cyclus publiceert de fout, zonder een deelberekening of belasting door te laten.
    store.setState(s => {
      s.sequences.push({ id: 'cyclus', predecessorId: leaves[1].id, successorId: leaves[0].id, type: 'FINISH_START', lagDays: 0 });
      markScheduleStale(s);
    });
    const preError = store.getState();
    preError.runCPM();
    strictEqual(typeof store.getState().cpmResult?.error, 'string');
    strictEqual(store.getState().tasks, preError.tasks);
    strictEqual(store.getState().resourceLoadResult, null);
    strictEqual(store.getState().scheduleStale, true);
  }
}

// Een datumwijziging blijft handmatig; F5 vernieuwt het after-snapshot van dezelfde undo-stap.
{
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const first = S();
  S().updateTask(a, { time: { ...S().tasks.find(t => t.id === a)!.time, scheduleDuration: 12 } });
  strictEqual(S().cpmResult, first.cpmResult, 'bewerken rekent niet automatisch');
  strictEqual(S().scheduleStale, true);
  const historyCount = S().historyEvents.length;
  S().runCPM();
  const calculated = S();
  strictEqual(S().historyEvents.length, historyCount);
  strictEqual(S().scheduleStale, false);
  strictEqual(S().tasks.find(t => t.id === b)!.time.earlyStart > first.tasks.find(t => t.id === b)!.time.earlyStart, true);
  S().undo();
  deepStrictEqual(S().tasks, first.tasks, 'undo herstelt de invoer en berekende velden');
  S().redo();
  deepStrictEqual(S().tasks, calculated.tasks, 'redo herstelt de na F5 bijgewerkte uitkomst');
}

console.log('OK  CPM-writeback: pariteit voor drie profielen in dagen/uren, atomische commit, foutpad, handmatig rekenen en undo/redo');
