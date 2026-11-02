// Regressies via de echte dispatcher: dezelfde kalender- en voortgangsroutes als een MCP-client.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';

const S = () => useAppStore.getState();
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

let requestId = 0;
async function call(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(JSON.stringify({
    jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name, arguments: args },
  }), makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }));
  const reply = JSON.parse(raw!);
  assert(reply.result?.structuredContent, `geen toolantwoord: ${raw}`);
  return reply.result.structuredContent;
}

test('355: effectieve scalaire werkblokken blijven geldig voor een urentaak, ook binnen een batch', async () => {
  for (const batch of [false, true]) {
    S().newProject();
    S().setProject({ startDate: '2026-06-01' });
    const calendarId = S().calendar.id;
    S().ensureProjectCalendarInLibrary();
    S().updateCalendar(calendarId, {
      workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
      simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60,
      workTime: makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 720 }, { start: 780, end: 960 }]),
    });
    const taskId = S().addTask({ name: 'Vier uur', time: createDefaultTaskTime('2026-06-01T07:00', 4, 'hours') });
    S().runCPM();
    const before = S().tasks.find(t => t.id === taskId)!.time;
    assertEq(before.earlyFinish, '2026-06-01T11:00', 'voorwaarde: vier uur op expliciete kalender');
    const args = { calendars: [{ id: calendarId, workTime: null }] };
    const result = await call(batch ? 'planner_batch' : 'planner_update_calendar',
      batch ? { steps: [{ tool: 'planner_update_calendar', args }] } : args);
    assert(result.ok, `gelijkwaardige scalaire kalender hoort toegestaan: ${JSON.stringify(result)}`);
    assertEq(S().calendar.workTime, undefined, 'de expliciete blokken zijn verwijderd');
    const after = S().tasks.find(t => t.id === taskId)!.time;
    assertEq(after.earlyStart, before.earlyStart, 'start blijft gelijk');
    assertEq(after.earlyFinish, before.earlyFinish, 'einde blijft gelijk');
    assertEq(after.durationMinutes, before.durationMinutes, 'taakminuten blijven gelijk');
    S().undo();
    assert(S().calendar.workTime, 'één undo herstelt de expliciete blokken');
    S().redo();
    assertEq(S().calendar.workTime, undefined, 'redo herstelt de scalaire kalender');
  }
});

test('355: verwijderen blijft geweigerd als de scalaire kalender geen effectieve werkblokken oplevert', async () => {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  S().setCalendar({
    id: S().calendar.id, name: 'Afwijkende scalaire velden', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 9, hoursPerDay: 8, holidays: [],
    workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
  });
  const taskId = S().addTask({ name: 'Vier uur', time: createDefaultTaskTime('2026-06-01T08:00', 4, 'hours') });
  S().runCPM();
  const before = S().tasks.find(t => t.id === taskId)!.time.earlyFinish;
  assertEq(before, '2026-06-01T12:00', 'voorwaarde: de expliciete blokken zijn geldig');
  const result = await call('planner_update_calendar', { calendars: [{ id: S().calendar.id, workTime: null }] });
  assert(!result.ok && result.code === 'VALIDATION', 'acht netto uren passen niet in de scalaire spanne van één uur');
  assert(S().calendar.workTime, 'de geweigerde wijziging houdt de expliciete blokken');
  assertEq(S().tasks.find(t => t.id === taskId)!.time.earlyFinish, before, 'de taak blijft onaangeroerd');
});

test('85: statusdatum en afgeleide voortgang zijn gelijk in een batch en in losse calls', async () => {
  const outcomes: unknown[] = [];
  for (const batch of [false, true]) {
    S().newProject();
    S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-01' });
    const a = S().addTask({ name: 'Grondwerk', time: createDefaultTaskTime('2026-06-01', 3) });
    const b = S().addTask({ name: 'Fundering', time: createDefaultTaskTime('2026-06-01', 4) });
    S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    S().runCPM();
    const before = S().tasks.find(t => t.id === b)!.time.earlyStart;
    const steps = [
      { tool: 'planner_update_project', args: { statusDate: '2026-06-10' } },
      { tool: 'planner_update_tasks', args: { updates: [
        { id: a, progress: { completion: 100 } }, { id: b, progress: { completion: 50 } },
      ] } },
    ];
    const results = batch ? [await call('planner_batch', { steps })]
      : [await call(steps[0].tool, steps[0].args), await call(steps[1].tool, steps[1].args)];
    assert(results.every(r => r.ok), `calls slagen: ${JSON.stringify(results)}`);
    outcomes.push(S().tasks.map(t => ({ name: t.name, status: t.status, time: t.time })));
    assertEq(S().project.statusDate, '2026-06-10', 'statusdatum gezet');
    assert(before.startsWith('2026-06-04'), 'voorwaarde: fundering begint aanvankelijk op 4 juni');
    if (batch) {
      S().undo();
      assertEq(S().project.statusDate, '2026-06-01', 'één undo herstelt ook de statusdatum');
      assert(S().tasks.every(t => t.time.completion === 0 && !t.time.actualStart), 'één undo herstelt alle voortgang');
      S().redo();
      assertEq(S().tasks.map(t => ({ name: t.name, status: t.status, time: t.time })), outcomes[1], 'redo herstelt de batch');
    }
  }
  assertEq(outcomes[1], outcomes[0], 'dezelfde invoer geeft dezelfde voortgang en planning');
});

await run();
