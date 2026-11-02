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

await run();
