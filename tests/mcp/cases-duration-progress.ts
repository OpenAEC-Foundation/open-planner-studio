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
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import type { WorkCalendar } from '@/types/calendar';
import type { DurationType, TaskTime } from '@/types/task';

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
  assert(/work done/.test(rejections[0]!.reason) && /at least 4 working days/.test(rejections[0]!.reason),
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

// F4b review r4: een LOPENDE kalendertijdtaak. De voortgangsoverdracht telt een dag dan als 24 klokuren
// (`durationEditProgress`), ook via de AI-koppeling. Met de hand gerekend: 2 d, 25 % ⇒ 12 u verricht
// (720 klokmin); "24 uur" ⇒ 50 %, rest 720 min = 12 u, einde di 2 juni 07:00 + 12 u = di 19:00;
// "8 uur" ⇒ korter dan 12 u ⇒ geweigerd. Controle met werktijd (240 werkmin verricht): "24 uur" ⇒
// 16,67 %, rest 1200 min = 20 u, einde di 480 + wo 480 + do 240 ⇒ do 4 juni 11:00.
const WEEK_BANDS = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
function setupRunningType(profile: 'ops' | 'p6' | 'msproject', type: DurationType): string {
  S().newProject();
  S().setCalendar({
    ...S().calendar, hoursPerDay: 8, workStartHour: 7, workEndHour: 16, workDays: [1, 2, 3, 4, 5],
    workTime: { byWeekday: { 1: WEEK_BANDS, 2: WEEK_BANDS, 3: WEEK_BANDS, 4: WEEK_BANDS, 5: WEEK_BANDS, 6: [], 7: [] } },
  } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-02T07:00', schedulingProfile: builtInProfile(profile) });
  const t = S().addTask({ name: 'Lopend', time: createDefaultTaskTime('2026-06-01T07:00', 2) });
  S().updateTask(t, { time: { ...timeOf(t), durationType: type, actualStart: '2026-06-01T07:00', completion: 0.25 } });
  S().runCPM();
  return t;
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  test(`${profile}: lopende kalendertijdtaak, 24 uur ⇒ 12 u verricht blijft, 50 %`, async () => {
    const t = setupRunningType(profile, 'ELAPSEDTIME');
    const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 24, durationUnit: 'hours' } }] });
    assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
    assertEq(res.itemRejections ?? [], [], 'geen weigering');
    S().runCPM();
    const time = timeOf(t);
    assertEq({ unit: time.durationUnit, minutes: time.durationMinutes, completion: time.completion, rest: time.remainingMinutes, finish: time.earlyFinish },
      { unit: 'hours', minutes: 1440, completion: 0.5, rest: 720, finish: '2026-06-02T19:00' }, 'verricht 12 u, rest 12 u');
    assertEq(res.data.progressAdjusted, [{ id: t, completion: 50, remaining: 12, durationUnit: 'hours' }], 'progressAdjusted');
  });

  test(`${profile}: lopende kalendertijdtaak, 8 uur (korter dan 12 u verricht) ⇒ geweigerd, taak ongewijzigd`, async () => {
    const t = setupRunningType(profile, 'ELAPSEDTIME');
    const before = JSON.stringify(S().tasks.find((x) => x.id === t));
    const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 8, durationUnit: 'hours' } }] });
    assertEq((res.itemRejections ?? []).length, 1, 'precies één weigering');
    assertEq(JSON.stringify(S().tasks.find((x) => x.id === t)), before, 'taak ongewijzigd');
  });

  test(`${profile}: lopende werktijdtaak, 24 uur ⇒ 4 u verricht blijft, 16,67 % (ongewijzigd gedrag)`, async () => {
    const t = setupRunningType(profile, 'WORKTIME');
    const res = await rpc('planner_update_tasks', { updates: [{ id: t, fields: { duration: 24, durationUnit: 'hours' } }] });
    assert(res.ok === true, `tool gaf een fout: ${JSON.stringify(res)}`);
    assertEq(res.itemRejections ?? [], [], 'geen weigering');
    S().runCPM();
    const time = timeOf(t);
    assertEq({ unit: time.durationUnit, minutes: time.durationMinutes, completion: Number(time.completion.toFixed(6)), rest: Number(time.remainingMinutes!.toFixed(6)), finish: time.earlyFinish },
      { unit: 'hours', minutes: 1440, completion: 0.166667, rest: 1200, finish: '2026-06-04T11:00' }, 'verricht 4 u, rest 20 u');
  });
}

await run();
