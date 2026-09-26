// Voortgang van een verzameltaak via de MCP-LEESKANT. De schrijfkant weigert al voortgang op een
// verzameltaak met "voortgang wordt afgeleid uit de kinderen"; deze batterij bewijst dat de
// leestools dan ook de AFGELEIDE waarde tonen (duurgewogen over de bladen, dezelfde helper als het
// WBS-rapport) en niet de opgeslagen 0% of een bevroren importwaarde.
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

await run();
