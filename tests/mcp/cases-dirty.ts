import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';

const store = useAppStore;
registerToolModules([taskTools, batchTools]);

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: store.getState().activeDocumentId });
}

async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = [...taskTools, ...batchTools].find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, makeCtx());
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}

function savedProjectWithProgress(): string {
  store.getState().newProject();
  store.getState().setProject({ startDate: '2026-03-02', statusDate: '2026-03-04' });
  const id = store.getState().addTask({ name: 'Grondwerk' });
  const cur = store.getState().tasks.find((t) => t.id === id)!;
  store.getState().updateTask(id, { time: { ...cur.time, scheduleStart: '2026-03-02', scheduleDuration: 5 } });
  store.getState().runCPM();
  store.getState().setTaskProgress(id, 0.5);
  store.getState().runCPM();
  store.setState((s) => { s.isDirty = false; });
  return id;
}

test('update_tasks progress 50% → 60% maakt een opgeslagen document dirty', async () => {
  const id = savedProjectWithProgress();
  assertEq(store.getState().isDirty, false, 'voorwaarde: het document is opgeslagen');
  const eventsBefore = store.getState().historyEvents.length;

  const data = okData(await call('planner_update_tasks', { updates: [{ id, progress: { completion: 60 } }] }));
  assertEq(data.updated, [id], 'de taak is bijgewerkt');
  assertEq(store.getState().tasks.find((t) => t.id === id)!.time.completion, 0.6, 'voortgang staat op 60%');
  assert(store.getState().historyEvents.length > eventsBefore, 'de wijziging is een undo-stap (voorwaarde)');
  assertEq(store.getState().isDirty, true, 'een echte voortgangswijziging hoort het document dirty te maken');
});

test('planner_batch met alleen een voortgangsstap maakt het document ook dirty', async () => {
  const id = savedProjectWithProgress();
  const res = await call('planner_batch', {
    steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id, progress: { completion: 60 } }] } }],
  });
  okData(res);
  assertEq(store.getState().tasks.find((t) => t.id === id)!.time.completion, 0.6, 'voortgang staat op 60%');
  assertEq(store.getState().isDirty, true, 'dezelfde commit-plek ⇒ ook via de batch dirty');
});

test('een transactie zonder datawijziging (item geweigerd) laat een opgeslagen document schoon', async () => {
  const id = savedProjectWithProgress();
  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 150 } }] });
  assertEq(okData(res).updated, [], 'niets bijgewerkt');
  assertEq(store.getState().tasks.find((t) => t.id === id)!.time.completion, 0.5, 'voortgang onveranderd');
  assertEq(store.getState().isDirty, false, 'niets gewijzigd ⇒ het document blijft schoon');
});

await run();
