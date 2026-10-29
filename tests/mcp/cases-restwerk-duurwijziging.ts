// Restwerk bij een duurwijziging via de AI-koppeling (eigenaarsbesluit 2026-10-19, optie 2): geen vraag;
// de taakregel beslist zoals in P6. Rekent een duurwijziging een BEWAARD restwerk opnieuw uit dat afweek
// van inzet × restduur (zoals E-1010 uit DCP-03: 320 h bij inzet 1 op 80 h), dan noemt de envelop het
// (`remainingWorkRecomputed`, uren vóór/ná) zodat de agent het kan rapporteren, en meldt de app het één
// keer per transactie. De regel zelf staat in tests/planning/check-restwerk-duurwijziging.ts.
//
// Alles via de echte JSON-RPC-dispatcher (schema's, stale-guard, transactie), ook binnen planner_batch.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

let rpcId = 0;
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const parsed = JSON.parse(raw!);
  assert(parsed.result?.structuredContent, `geen structuredContent voor ${name}: ${raw}`);
  return parsed.result.structuredContent;
}

const BAND = [{ start: 480, end: 960 }];
const H = 60;

/** Uurtaken van 80 h op 8 h per dag, niet gestart, met een expliciete restduur (zoals na een XER-import)
 *  en een toewijzing met inzet 1 en een bewaard restwerk van `workHours`. */
function setup(workHours: number[]): { taskIds: string[]; assignmentIds: string[]; resourceId: string } {
  S().newProject();
  S().setProject({ startDate: '2024-01-09' });
  S().setCalendar({
    ...S().calendar, hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
    workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } },
  } as WorkCalendar);
  const resourceId = S().addResource({ name: 'Design Engineer', type: 'LABOR', description: '', maxUnits: 1 });
  const taskIds: string[] = [];
  workHours.forEach((w, i) => {
    const t = S().addTask({
      name: `E-10${i + 1}0`,
      time: { ...createDefaultTaskTime('2024-01-09T08:00', 10, 'hours'), durationUnit: 'hours', durationMinutes: 80 * H },
    });
    S().assignResource(t, resourceId, 1);
    useAppStore.setState((s) => {
      s.tasks.find((x) => x.id === t)!.time.remainingMinutes = 80 * H;
      s.assignments.find((a) => a.taskId === t)!.remainingWorkMinutes = w * H;
    });
    taskIds.push(t);
  });
  S().runCPM();
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const assignmentIds = taskIds.map((t) => S().assignments.find((a) => a.taskId === t)!.id);
  return { taskIds, assignmentIds, resourceId };
}
const workNoticeKeys = () => S().ui.notifications.map((n) => n.messageKey).filter((k) => k.startsWith('notifications.remainingWorkRecomputed'));

test('update_tasks: 80 → 72 h ⇒ restwerk 320 → 72 h, de envelop noemt het, één melding', async () => {
  const { taskIds: [t], assignmentIds: [a], resourceId } = setup([320]);
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 72, durationUnit: 'hours' } }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq(S().assignments.find((x) => x.id === a)!.remainingWorkMinutes, 72 * H, 'restwerk = inzet × nieuwe restduur');
  assertEq(S().tasks.find((x) => x.id === t)!.time.remainingMinutes, 72 * H, 'restduur volgt');
  assertEq(res.envelope.remainingWorkRecomputed, [{
    taskId: t, taskName: 'E-1010', assignmentId: a, resourceId, beforeHours: 320, afterHours: 72,
  }], 'envelope.remainingWorkRecomputed');
  assertEq(workNoticeKeys(), ['notifications.remainingWorkRecomputed'], 'één melding in de app');
});

test('update_tasks: restwerk dat al klopte ⇒ geen veld, geen melding', async () => {
  const { taskIds: [t] } = setup([80]);
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 72, durationUnit: 'hours' } }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assert(!('remainingWorkRecomputed' in res.envelope), `veld afwezig (kreeg: ${JSON.stringify(res.envelope)})`);
  assertEq(workNoticeKeys(), [], 'geen melding');
});

test('planner_batch met twee taken: één transactie ⇒ één melding met het aantal, de envelop noemt beide', async () => {
  const { taskIds: [t1, t2] } = setup([320, 160]);
  const res = await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: t1, fields: { duration: 72, durationUnit: 'hours' } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: t2, fields: { duration: 40, durationUnit: 'hours' } }] } },
    ],
  });
  assert(res.ok === true, `batch gaf een fout: ${JSON.stringify(res)}`);
  assertEq((res.envelope.remainingWorkRecomputed ?? []).map((r: any) => [r.taskId, r.beforeHours, r.afterHours]),
    [[t1, 320, 72], [t2, 160, 40]], 'beide in de envelop');
  assertEq(workNoticeKeys(), ['notifications.remainingWorkRecomputedMany'], 'één melding met het aantal');
  assertEq(S().ui.notifications.find((n) => n.messageKey === 'notifications.remainingWorkRecomputedMany')?.params, { count: 2 }, 'count 2');
});

test('planner_undo zet het bewaarde restwerk terug', async () => {
  const { taskIds: [t], assignmentIds: [a] } = setup([320]);
  await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 72, durationUnit: 'hours' } }] });
  const res = await rpc('planner_undo', {});
  assert(res.ok === true, `undo gaf een fout: ${JSON.stringify(res)}`);
  assertEq(S().assignments.find((x) => x.id === a)!.remainingWorkMinutes, 320 * H, '320 h terug');
});

await run();
