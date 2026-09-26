// Voortgang van een verzameltaak via de MCP-LEESKANT. De schrijfkant weigert al voortgang op een
// verzameltaak ("voortgang, status en werkelijke datums worden afgeleid uit de bladtaken"); deze
// batterij bewijst dat de leestools dan ook de AFGELEIDE waarde tonen (duurgewogen over de bladen,
// dezelfde helper als het WBS-rapport) en niet de opgeslagen 0% of een bevroren importwaarde — ook
// voor de werkelijke start en het werkelijke einde van de fase.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolOk, McpToolResult } from '@/services/mcp/contracts';

const S = () => useAppStore.getState();

function callOk(name: string, args: unknown = {}): any {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  const res = tool!.handler(args, makeMcpContext(appStoreContext)) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

function setup() {
  S().newProject();
  S().setProject({ startDate: '2026-03-02', statusDate: '2026-03-31' });
  const P = S().addTask({ name: 'Fase' });
  const leaf = (name: string, dur: number) => {
    const id = S().addTask({ name, parentId: P });
    const t = S().tasks.find(x => x.id === id)!;
    S().updateTask(id, { time: { ...t.time, scheduleDuration: dur } });
    return id;
  };
  const A = leaf('A', 5);
  const B = leaf('B', 15);
  // Een "bevroren" opgeslagen fasewaarde, zoals na een MSP-import: niets mag die nog tonen.
  const p = S().tasks.find(x => x.id === P)!;
  S().updateTask(P, { status: 'STARTED', time: { ...p.time, completion: 0.62 } });
  S().runCPM();
  return { P, A, B };
}

test('get_task op een fase toont de afgeleide, duurgewogen voortgang', () => {
  const { P, A, B } = setup();
  S().setTaskProgress(A, 1);
  S().setTaskProgress(B, 0.2);
  S().runCPM();
  const data = callOk('planner_get_task', { taskId: P });
  // (5×1 + 15×0.2) / 20 = 0.4 ⇒ 40%
  assertEq(data.progress.completion, 40, 'fase-voortgang = 40% (afgeleid)');
  assertEq(data.status, 'STARTED', 'fase-status = STARTED');
});

test('list_tasks(status: COMPLETED) vindt een fase waarvan alle bladen klaar zijn', () => {
  const { P, A, B } = setup();
  S().setTaskProgress(A, 1);
  S().setTaskProgress(B, 1);
  S().runCPM();
  const detail = callOk('planner_get_task', { taskId: P });
  assertEq(detail.progress.completion, 100, 'fase-voortgang = 100%');
  assertEq(detail.status, 'COMPLETED', 'fase-status = COMPLETED');
  const listed = callOk('planner_list_tasks', { status: 'COMPLETED' });
  const ids = (listed.tasks as { id: string }[]).map(t => t.id);
  assert(ids.includes(P), `fase ontbreekt in list_tasks(COMPLETED): ${JSON.stringify(ids)}`);
});

test('get_task op een fase toont de afgeleide werkelijke datums (vroegste start; einde pas als alles klaar is)', () => {
  const { P, A, B } = setup();
  assert(S().setActualStart(A, '2026-03-03'), 'fixture: start A');
  assert(S().setActualFinish(A, '2026-03-06'), 'fixture: einde A');
  assert(S().setActualStart(B, '2026-03-05'), 'fixture: start B');
  S().runCPM();
  let data = callOk('planner_get_task', { taskId: P });
  assertEq(data.progress.actualStart, '2026-03-03', 'fase-actualStart = de vroegste van de bladen');
  assertEq(data.progress.actualFinish, undefined, 'geen fase-actualFinish zolang B nog loopt');
  assert(S().setActualFinish(B, '2026-03-20'), 'fixture: einde B');
  S().runCPM();
  data = callOk('planner_get_task', { taskId: P });
  assertEq(data.progress.actualFinish, '2026-03-20', 'alle bladen klaar ⇒ fase-actualFinish = het laatste einde');
  assertEq(data.status, 'COMPLETED', 'en de fase is COMPLETED');
});

test('update_tasks: werkelijke datums op een fase ⇒ zachte weigering met uitleg, fase ongemoeid', async () => {
  const { P, A } = setup();
  assert(S().setActualStart(A, '2026-03-04'), 'fixture: start A');
  S().runCPM();
  const tool = getTool('planner_update_tasks');
  assert(!!tool, 'planner_update_tasks niet geregistreerd');
  const ctx = makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId });
  const res = await tool!.handler({ updates: [{ id: P, progress: { actualStart: '2026-03-02' } }] }, ctx) as McpToolResult;
  assert(res.ok, `de call slaagt (zachte per-item-weigering): ${res.ok ? '' : res.error}`);
  const rejections = (res as McpToolOk).itemRejections ?? [];
  assertEq(rejections.length, 1, 'één zachte weigering');
  assert(/werkelijke datums/.test(rejections[0]?.reason ?? '') && /bladtaken/.test(rejections[0]?.reason ?? ''),
    `de reden noemt dat werkelijke datums uit de bladtaken komen: ${rejections[0]?.reason}`);
  const phase = S().tasks.find(t => t.id === P)!;
  assertEq(phase.time.actualStart, '2026-03-04', 'de fase houdt haar afgeleide start');
});

await run();
