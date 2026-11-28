import { appStoreContext, makeMcpContext, useAppStore, test, assertEq, run } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { readTools } from '@/services/mcp/tools/readTools';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk, McpToolErr } from '@/services/mcp/contracts';
import type { WorkTimeBands } from '@/types/calendar';

const store = useAppStore;

store.getState().addTask({ name: 'warmup' });
store.getState().undo();

registerToolModules([taskTools, batchTools, readTools, calendarResourceTools]);

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: store.getState().activeDocumentId });
}
async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = [...taskTools, ...batchTools, ...readTools, ...calendarResourceTools].find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, makeCtx());
}
function okData(res: McpToolResult): any {
  if (!res.ok) throw new Error(`verwachtte ok, kreeg fout: ${(res as McpToolErr).error}`);
  const rej = (res as McpToolOk).itemRejections ?? [];
  if (rej.length > 0) throw new Error(`verwachtte geen weigering, kreeg ${JSON.stringify(rej)}`);
  return (res as McpToolOk).data as any;
}
const taskById = (id: string) => store.getState().tasks.find((t) => t.id === id)!;

const block = (start: number, end: number) => [{ start, end }];
const week = (start: number, end: number): WorkTimeBands => ({
  byWeekday: { 1: block(start, end), 2: block(start, end), 3: block(start, end), 4: block(start, end), 5: block(start, end), 6: [], 7: [] },
});

function reset(): void {
  store.getState().newProject();
  store.setState((s) => {
    s.calendar.hoursPerDay = 8;
    s.calendar.workStartHour = 7;
    s.calendar.workEndHour = 17;
    s.calendar.workTime = week(420, 1020);
    for (const c of s.calendars) {
      if (c.id === s.calendar.id) { c.hoursPerDay = 8; c.workStartHour = 7; c.workEndHour = 17; c.workTime = week(420, 1020); }
    }
  });
}

test('add_tasks: urentaak van 1870 u op 8 u/dag met blokken van 10 u ⇒ dagengetal 187 (niet 233,75)', async () => {
  reset();
  const created = okData(await call('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-lang', name: 'Lange urentaak', duration: 1870, durationUnit: 'hours' }],
  }));
  const task = taskById(created.created['tmp-lang']);
  assertEq(task.time.durationUnit, 'hours', 'eenheid uren');
  assertEq(task.time.durationMinutes, 112200, 'werkminuten exact');
  assertEq(task.time.scheduleDuration, 187, 'dagengetal = 112200 ÷ (10 × 60)');
  assertEq(store.getState().calendar.hoursPerDay, 8, 'de opgeslagen uren per dag blijven 8');
});

test('add_tasks via planner_batch: zelfde dagengetal 187', async () => {
  reset();
  const data = okData(await call('planner_batch', {
    steps: [{ tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-b', name: 'Batch-urentaak', duration: 1870, durationUnit: 'hours' }] } }],
  }));
  assertEq(data.steps.map((s: any) => s.status), ['uitgevoerd'], 'de stap liep');
  const task = store.getState().tasks.find((t) => t.name === 'Batch-urentaak')!;
  assertEq(task.time.scheduleDuration, 187, 'dagengetal via batch');
});

test('update_tasks: een dagtaak wordt urentaak van 40 u ⇒ dagengetal 4', async () => {
  reset();
  const created = okData(await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-d', name: 'Dagtaak', duration: 3 }] }));
  const id = created.created['tmp-d'];
  okData(await call('planner_update_tasks', { updates: [{ id, fields: { duration: 40, durationUnit: 'hours' } }] }));
  assertEq([taskById(id).time.durationMinutes, taskById(id).time.scheduleDuration], [2400, 4], 'minuten en dagengetal');
});

test('update_calendar: blokken van 10 u naar 8 u ⇒ dagengetal 187 wordt 233,75; minuten en 8 u/dag blijven', async () => {
  reset();
  const created = okData(await call('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-k', name: 'Kalenderwissel', duration: 1870, durationUnit: 'hours' }],
  }));
  const id = created.created['tmp-k'];
  assertEq(taskById(id).time.scheduleDuration, 187, 'vooraf: 187');
  okData(await call('planner_update_calendar', { calendars: [{ id: store.getState().calendar.id, workTime: week(420, 900) }] }));
  const t = taskById(id);
  assertEq([t.time.durationMinutes, t.time.scheduleDuration], [112200, 233.75], 'minuten blijven, dagengetal volgt de blokken');
  assertEq(store.getState().calendar.hoursPerDay, 8, 'de opgeslagen uren per dag blijven 8');
});

run();
