// Restduur bij een duurwijziging van een LOPENDE taak via de AI-koppeling (besluit eigenaar, "zoals
// MS Project"): het gedane werk blijft gelijk, restduur = nieuwe duur − gedane werk, het percentage
// past zich aan — dezelfde regel als paneel, Gantt, raster en "Taak bewerken"
// (tests/planning/check-duration-change-routes.ts), want het is de betekenis van een duurwijziging.
// `planner_update_tasks` meldt de nieuwe restduur en het nieuwe percentage in `progressAdjusted`; een
// duur korter dan het gedane werk wordt per item zacht geweigerd (de taak blijft ongewijzigd).
//
// Alles via de echte JSON-RPC-dispatcher (schema's, stale-guard, transactie), ook binnen planner_batch.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';

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
const timeOf = (id: string): TaskTime => S().tasks.find((t) => t.id === id)!.time;

/** Eén taak van `days` werkdagen (of `hours` uur), statusdatum 3 juni, voortgang `completion`. */
function setup(kind: 'dag' | 'uur', size: number, completion: number): string {
  S().newProject();
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-03' });
  if (kind === 'uur') {
    S().setUI({ enableHourPlanning: true });
    S().setCalendar({
      ...S().calendar, hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
      workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } },
    } as WorkCalendar);
  }
  const t = S().addTask({
    name: 'Lopend',
    time: kind === 'uur'
      ? { ...createDefaultTaskTime('2026-06-01T08:00', size / 8, 'hours'), durationUnit: 'hours', durationMinutes: size * 60 }
      : createDefaultTaskTime('2026-06-01', size),
  });
  S().runCPM();
  S().setTaskProgress(t, completion);
  S().runCPM();
  return t;
}

test('dag: 10 d op 40% → 12 d ⇒ nog 8 d, 33,33% — en het resultaat meldt dat', async () => {
  const t = setup('dag', 10, 0.4);
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 12 } }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq(res.itemRejections ?? [], [], 'geen weigering');
  assertEq({ completion: timeOf(t).completion, remainingTime: timeOf(t).remainingTime }, { completion: 0.4 * 10 / 12, remainingTime: 8 },
    'percentage onafgerond, restduur exact');
  assertEq(res.data.progressAdjusted, [{ id: t, completion: 33.33, remaining: 8, durationUnit: 'days' }], 'progressAdjusted');
});

test('uur: 10 u op 40% → 12 u ⇒ nog 8 u, in minuten exact', async () => {
  const t = setup('uur', 10, 0.4);
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 12, durationUnit: 'hours' } }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq(res.itemRejections ?? [], [], 'geen weigering');
  assertEq({ remainingMinutes: timeOf(t).remainingMinutes, completion: timeOf(t).completion }, { remainingMinutes: 480, completion: 240 / 720 },
    'restduur in minuten');
  assertEq(res.data.progressAdjusted, [{ id: t, completion: 33.33, remaining: 8, durationUnit: 'hours' }], 'progressAdjusted');
});

test('korter dan het gedane werk: zachte weigering met uitleg, taak ongewijzigd', async () => {
  const t = setup('dag', 10, 0.4);
  const before = JSON.stringify(S().tasks.find((x) => x.id === t));
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 3 } }] });
  const rejections: { id: string; reason: string }[] = res.itemRejections ?? [];
  assertEq(rejections.length, 1, 'precies één weigering');
  assert(/gedane werk/.test(rejections[0]!.reason) && /minstens 4 werkdagen/.test(rejections[0]!.reason),
    `de reden noemt het gedane werk en de minimale duur: ${rejections[0]!.reason}`);
  assertEq(JSON.stringify(S().tasks.find((x) => x.id === t)), before, 'taak ongewijzigd');
  assert(res.data.progressAdjusted === undefined, 'geen progressAdjusted bij een weigering');
});

test('binnen planner_batch: dezelfde regel', async () => {
  const t = setup('dag', 10, 0.4);
  const res = await rpc('planner_batch', {
    steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id: t, fields: { duration: 12 } }] } }],
  });
  assert(res.ok === true, `batch gaf een fout: ${JSON.stringify(res)}`);
  assertEq(timeOf(t).remainingTime, 8, 'restduur 8 d (batch)');
});

test('duur én voortgang in één update: de opgegeven voortgang wint', async () => {
  const t = setup('dag', 10, 0.4);
  const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 12 }, progress: { completion: 50 } }] });
  assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
  assertEq({ completion: timeOf(t).completion, remainingTime: timeOf(t).remainingTime }, { completion: 0.5, remainingTime: 6 },
    '50% van 12 d ⇒ nog 6 d');
});

await run();
