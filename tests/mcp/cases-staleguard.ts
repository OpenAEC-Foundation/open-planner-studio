import { useAppStore, test, assert, assertEq, run } from './harness';
import { ensureFreshSchedule } from '@/services/mcp/staleGuard';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import { createAppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

function cleanProject(): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01' });
}

test('niet-stale ⇒ {recomputed:false} en cpmResult-referentie blijft identiek (geen recompute)', () => {
  cleanProject();
  S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 5) });
  S().runCPM();
  assertEq(S().scheduleStale, false, 'precondition: scheduleStale false na runCPM');
  const before = S().cpmResult;

  const out = ensureFreshSchedule();

  assertEq(out.recomputed, false, 'recomputed');
  assert(out.error === undefined, `verwacht geen error, kreeg ${JSON.stringify(out.error)}`);
  assert(S().cpmResult === before, 'cpmResult-referentie is gewijzigd — er is onnodig herrekend');
});

test('stale (duur-wijziging) ⇒ {recomputed:true}, scheduleStale false, datums vers', () => {
  cleanProject();
  const t1 = S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 5) });
  S().runCPM();
  const finishBefore = S().tasks.find(t => t.id === t1)!.time.earlyFinish;
  assert(!!finishBefore, 'precondition: earlyFinish gezet na eerste runCPM');

  S().updateTask(t1, { time: createDefaultTaskTime('2026-06-01', 20) });
  assertEq(S().scheduleStale, true, 'precondition: scheduleStale true na duur-wijziging');

  const out = ensureFreshSchedule();

  assertEq(out.recomputed, true, 'recomputed');
  assert(out.error === undefined, `verwacht geen error, kreeg ${JSON.stringify(out.error)}`);
  assertEq(S().scheduleStale, false, 'scheduleStale na recompute');
  const finishAfter = S().tasks.find(t => t.id === t1)!.time.earlyFinish;
  assert(!!finishAfter, 'earlyFinish gezet na recompute');
  assert(finishAfter > finishBefore, `earlyFinish niet vernieuwd: voor=${finishBefore} na=${finishAfter}`);
});

test('undoStack-lengte identiek vóór/na — niet-stale én stale (geen snapshot)', () => {
  cleanProject();
  S().addTask({ name: 'T1', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 5) });
  S().runCPM();
  const lenNonStaleBefore = S().historyEvents.filter(event => event.state === 'applied').length;
  ensureFreshSchedule();
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, lenNonStaleBefore, 'undoStack-lengte gewijzigd in niet-stale geval');

  const t1 = S().tasks[0].id;
  S().updateTask(t1, { time: createDefaultTaskTime('2026-06-01', 12) });
  assertEq(S().scheduleStale, true, 'precondition: stale na duur-wijziging');
  const lenStaleBefore = S().historyEvents.filter(event => event.state === 'applied').length;
  const out = ensureFreshSchedule();
  assertEq(out.recomputed, true, 'recomputed (geval B)');
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, lenStaleBefore, 'undoStack-lengte gewijzigd in stale geval (recompute pushte een snapshot)');
});

test('stale met kringverwijzing ⇒ {recomputed:true} + error gezet, geen throw', () => {
  cleanProject();
  const a = S().addTask({ name: 'A', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  const b = S().addTask({ name: 'B', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 3) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  useAppStore.setState((s) => {
    s.sequences.push({ id: 'seq-kring', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  });
  assertEq(S().scheduleStale, true, 'precondition: stale na relatie-toevoeging');

  let out;
  try {
    out = ensureFreshSchedule();
  } catch (e) {
    assert(false, `ensureFreshSchedule gooide bij een kringverwijzing: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  assertEq(out!.recomputed, true, 'recomputed');
  assert(typeof out!.error === 'string' && out!.error.length > 0, `error moet gezet zijn bij een cyclus, kreeg ${JSON.stringify(out!.error)}`);
});

test('ensureFreshSchedule(B) herrekent uitsluitend B en laat de app-singleton byte-identiek', () => {
  cleanProject();
  S().setProject({ name: 'Versheidscontext A' });
  S().addTask({ name: 'Taak A', time: createDefaultTaskTime('2026-06-01', 2) });
  S().runCPM();
  const aBefore = JSON.stringify(capturePayload(S()));
  const aCpm = S().cpmResult;

  const B = createAppStoreContext();
  const b = B.store.getState();
  b.setCalendar({ ...b.calendar, workDays: [...CLEAN_WORKDAYS], holidays: [] } as WorkCalendar);
  b.setProject({ name: 'Versheidscontext B', startDate: '2026-06-01' });
  const taskId = b.addTask({ name: 'Taak B', time: createDefaultTaskTime('2026-06-01', 3) });
  b.runCPM();
  const finishBefore = B.store.getState().tasks.find((task) => task.id === taskId)!.time.earlyFinish;
  B.store.getState().updateTask(taskId, { time: createDefaultTaskTime('2026-06-01', 15) });

  const out = ensureFreshSchedule(B);

  assertEq(out.recomputed, true, 'de stale B-context hoort herrekend te zijn');
  assertEq(B.store.getState().scheduleStale, false, 'alleen B hoort weer vers te zijn');
  const finishAfter = B.store.getState().tasks.find((task) => task.id === taskId)!.time.earlyFinish;
  assert(finishAfter > finishBefore, 'B hoort datums voor de langere duur te krijgen');
  assertEq(JSON.stringify(capturePayload(S())), aBefore, 'B-versheid mag A byte-inhoudelijk niet wijzigen');
  assert(S().cpmResult === aCpm, 'B-versheid mag A zelfs niet onnodig herrekenen');
});

await run();
