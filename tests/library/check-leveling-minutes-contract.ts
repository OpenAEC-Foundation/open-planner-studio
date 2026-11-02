// Knownbug 257: een aanroeper kan een voorstel met minuten via beide publieke schrijfgrenzen geven.
// De objectliteralen bewaken het TypeScript-contract; de solve en historie bewaken het gedrag.
import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';

for (const viaMcp of [false, true]) {
  const context = createAppStoreContext();
  const state = () => context.store.getState();
  state().setProject({ startDate: '2026-06-01' });
  state().setCalendar({
    ...state().calendar, workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays: [], workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
  });
  const id = state().addTask({ name: 'Vier uur', time: createDefaultTaskTime('2026-06-01T08:00', 4, 'hours') });
  state().runCPM();
  assert.equal(state().tasks[0].time.earlyStart, '2026-06-01T08:00');
  if (viaMcp) {
    const transactions = createMcpTransactions(context);
    const result = transactions.run(() => transactions.draft.applyLeveling({
      delays: { [id]: 1 }, gaps: {}, delayMinutes: { [id]: 120 },
    }));
    assert(result.ok);
  } else {
    state().applyLeveling({ delays: { [id]: 1 }, gaps: {}, delayMinutes: { [id]: 120 } });
  }
  assert.equal(state().tasks[0].levelingDelayMinutes, 120);
  assert.equal(state().tasks[0].time.earlyStart, '2026-06-01T10:00', 'minuten gaan voor de hele-dagen-terugval');
  state().undo();
  assert.equal(state().tasks[0].time.earlyStart, '2026-06-01T08:00');
  state().redo();
  assert.equal(state().tasks[0].time.earlyStart, '2026-06-01T10:00');
}
console.log('OK 257: store en MCP accepteren minutenprecisie, inclusief undo/redo');
