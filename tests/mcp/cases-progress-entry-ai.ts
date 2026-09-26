// De AI-koppeling en de invoerregels voor voortgang (besluit eigenaar, regel 4): de UI zet zonder
// statusdatum die op vandaag (Z1) en vraagt de werkelijke start van een taak die pas ná de statusdatum
// zou beginnen (Z1b). De AI-koppeling doet van beide NIETS automatisch:
//   - voortgang zonder statusdatum blijft geweigerd, en de reden zegt wat de AI moet doen
//     (`planner_update_project` → `statusDate`, daarna de update herhalen);
//   - voortgang op zo'n later geplande taak zonder meegegeven `actualStart` wordt geweigerd met de
//     uitleg dat de AI de werkelijke start moet meegeven — hetzelfde criterium als de vraag in de UI
//     (`actualStartQuestionFor`). Mét `actualStart` werkt het gewoon.
// Via de echte JSON-RPC-dispatcher (schema's, stale-guard, transactie).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();
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

const timeOf = (id: string): TaskTime => S().tasks.find((t) => t.id === id)!.time;
const reasons = (res: any): string[] => (res.itemRejections ?? []).map((r: { reason: string }) => r.reason);

/** Taak V (5 wd) vanaf 1 juni en taak L (5 wd) vanaf 1 juli; een mijlpaal M op 1 juli. */
function setup(statusDate: string | undefined): { V: string; L: string; M: string } {
  S().newProject();
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}) });
  const V = S().addTask({ name: 'Vroeg', time: createDefaultTaskTime('2026-06-01', 5) });
  const L = S().addTask({ name: 'Laat', time: createDefaultTaskTime('2026-07-01', 5) });
  const M = S().addTask({ name: 'Mijlpaal', isMilestone: true, time: createDefaultTaskTime('2026-07-01', 0) });
  S().updateTask(L, { constraint: { type: 'SNET', date: '2026-07-01' } });
  S().updateTask(M, { constraint: { type: 'SNET', date: '2026-07-01' } });
  S().runCPM();
  return { V, L, M };
}

test('zonder statusdatum: geweigerd, de reden zegt wat de AI moet doen, er verandert niets', async () => {
  const { V } = setup(undefined);
  const before = JSON.stringify(timeOf(V));
  const res = await rpc('planner_update_tasks', { updates: [{ id: V, progress: { completion: 40 } }] });
  const [reason] = reasons(res);
  assert(!!reason && /planner_update_project/.test(reason) && /statusDate/.test(reason) && /herhaal/.test(reason),
    `de reden noemt de route (planner_update_project → statusDate) en dat de update herhaald moet worden: ${reason}`);
  assertEq(JSON.stringify(timeOf(V)), before, 'taak ongewijzigd');
  assertEq(S().project.statusDate ?? null, null, 'geen statusdatum gezet — niets automatisch');
});

test('later geplande taak zonder actualStart: geweigerd met de vraag om de werkelijke start', async () => {
  const { L } = setup('2026-06-10');
  assert(timeOf(L).earlyStart! > '2026-06-10', `voorwaarde: geplande start ${timeOf(L).earlyStart} ligt na de statusdatum`);
  const before = JSON.stringify(timeOf(L));
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { completion: 40 } }] });
  const [reason] = reasons(res);
  assert(!!reason && /progress\.actualStart/.test(reason) && /uiterlijk 2026-06-10/.test(reason),
    `de reden vraagt om progress.actualStart, uiterlijk de statusdatum: ${reason}`);
  assertEq(JSON.stringify(timeOf(L)), before, 'taak ongewijzigd');
});

test('later geplande taak mét actualStart: toegepast, zoals opgegeven', async () => {
  const { L } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { completion: 40, actualStart: '2026-06-08' } }] });
  assertEq(reasons(res), [], 'geen weigering');
  assertEq({ as: timeOf(L).actualStart, c: timeOf(L).completion }, { as: '2026-06-08', c: 0.4 }, 'start en voortgang');
});

test('later geplande taak: alleen actualFinish zonder actualStart is ook geweigerd', async () => {
  const { L } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: L, progress: { actualFinish: '2026-06-09' } }] });
  const [reason] = reasons(res);
  assert(!!reason && /progress\.actualStart/.test(reason) && /uiterlijk 2026-06-09/.test(reason),
    `de reden vraagt om een start, uiterlijk het opgegeven einde: ${reason}`);
});

test('later geplande mijlpaal met een werkelijke datum: gewoon toegepast (start = einde)', async () => {
  const { M } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: M, progress: { actualFinish: '2026-06-09' } }] });
  assertEq(reasons(res), [], 'geen weigering');
  assertEq({ as: timeOf(M).actualStart, af: timeOf(M).actualFinish }, { as: '2026-06-09', af: '2026-06-09' }, 'mijlpaal afgemeld');
});

test('taak die volgens plan al begonnen is: voortgang zonder actualStart werkt zoals altijd', async () => {
  const { V } = setup('2026-06-10');
  const res = await rpc('planner_update_tasks', { updates: [{ id: V, progress: { completion: 40 } }] });
  assertEq(reasons(res), [], 'geen weigering');
  assertEq(timeOf(V).actualStart, timeOf(V).earlyStart, 'afgeleide start = geplande start');
});

test('binnen planner_batch: dezelfde weigering, de taak blijft ongewijzigd', async () => {
  const { L } = setup('2026-06-10');
  const before = JSON.stringify(timeOf(L));
  const res = await rpc('planner_batch', {
    steps: [{ tool: 'planner_update_tasks', args: { updates: [{ id: L, progress: { completion: 40 } }] } }],
  });
  assert(res.ok === true, `batch gaf een fout: ${JSON.stringify(res)}`);
  assertEq(JSON.stringify(timeOf(L)), before, 'taak ongewijzigd (batch)');
});

await run();
