// `isDirty` na een MCP-schrijfactie (vondst uit de fixronde "progress-noop", bevestigd 2026-09-25).
//
// Een ECHTE voortgangswijziging via `planner_update_tasks` (50% → 60%) liet een net opgeslagen
// document op `isDirty: false` staan. Het voortgangspad schrijft via `progress.applyProgressUpdate`
// in een eigen `setState` in de toollaag — niet via een draft-primitief, en alléén de primitieven
// zetten `isDirty`. Gevolgen: geen "*" in de titel, sluiten vraagt niet om op te slaan
// (`closeWithGuard` sluit een schoon document direct ⇒ dataverlies), en de crashherstel-auto-save
// slaat de ronde over (`useAutoSave` schrijft alleen als er iets dirty is).
//
// De reparatie zit op de ene commit-plek van elke MCP-transactie (`createMcpTransactions` → `run`):
// verandert een DATA-veld van het documentcontract, dan is het document gewijzigd. Deze suite pint
// dat vast voor het gemelde pad, voor `planner_batch` (zelfde commit), én voor de keerzijde: een
// transactie die niets wijzigt (alle items geweigerd) maakt een schoon document niet dirty.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';

const store = useAppStore;
// `planner_batch` zoekt zijn stappen op in de registry.
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

/** Een doorgerekend project met één taak op 50%, daarna "opgeslagen" (isDirty=false). */
function savedProjectWithProgress(): string {
  store.getState().newProject();
  store.getState().setProject({ startDate: '2026-03-02', statusDate: '2026-03-04' });
  const id = store.getState().addTask({ name: 'Grondwerk' });
  const cur = store.getState().tasks.find((t) => t.id === id)!;
  store.getState().updateTask(id, { time: { ...cur.time, scheduleStart: '2026-03-02', scheduleDuration: 5 } });
  store.getState().runCPM();
  store.getState().setTaskProgress(id, 0.5);
  store.getState().runCPM();
  // Opslaan wist `isDirty` (fileSlice); de rest van de state blijft zoals hij is.
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
  // 150% valt buiten 0–100: zachte weigering pas BINNEN de transactie (applyProgressUpdate), dus de
  // transactie draait wél — met eind-runCPM — maar wijzigt geen documentdata.
  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 150 } }] });
  assertEq(okData(res).updated, [], 'niets bijgewerkt');
  assertEq(store.getState().tasks.find((t) => t.id === id)!.time.completion, 0.5, 'voortgang onveranderd');
  assertEq(store.getState().isDirty, false, 'niets gewijzigd ⇒ het document blijft schoon');
});

await run();
