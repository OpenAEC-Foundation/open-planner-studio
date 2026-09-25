// "Wordt fase" via de bridge (audit taakmutaties §6): `planner_move_task` en `planner_add_tasks` met
// `parentId` lieten een toewijzing op een taak achter die daardoor een fase werd — onzichtbaar, zonder
// belasting. Nu verhuist ze via de gedeelde regel (`src/state/structuralTransition.ts`) naar de eerste
// nieuwe subtaak die haar mag dragen; het tool-antwoord meldt dat in `phaseTransitions` (geen
// UI-melding). Kan het niet schoon, dan faalt de hele call met VALIDATION en verandert er niets.
// "Wordt mijlpaal" weigerde de bridge al; die regel is nu dezelfde functie als paneel/raster/store.
//
// Via de ECHTE dispatcher (inclusief schemavalidatie), zoals een agent de tools aanroept.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const store = useAppStore;
registerAllTools();

store.getState().addTask({ name: 'warmup' });
store.getState().undo();

const S = () => store.getState();
const task = (id: string) => S().tasks.find(t => t.id === id)!;
const assignmentsOf = (id: string) => S().assignments.filter(a => a.taskId === id);
const undoDepth = () => historyDepthsForActiveScope(S()).undoDepth;

async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 300)}`);
  return msg.result;
}

/** L (toewijzing Metselaar, 0,5/dag) en een losse opvolger N. */
function seed() {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const L = S().addTask({ name: 'Metselen' });
  const R = S().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(L, R, 0.5);
  const N = S().addTask({ name: 'Voegen' });
  S().runCPM();
  store.setState((s) => { s.ui.notifications = []; });
  return { L, R, N, assignmentId: assignmentsOf(L)[0].id };
}

test('move_task onder een taak met toewijzing: toewijzing verhuist, antwoord meldt het, geen UI-melding', async () => {
  const { L, R, N, assignmentId } = seed();
  const before = undoDepth();
  const res = await rpc('planner_move_task', { id: N, newParentId: L });
  assertEq(res.isError ?? false, false, 'de call slaagt');
  assertEq(assignmentsOf(N).map(a => [a.id, a.resourceId, a.unitsPerDay]), [[assignmentId, R, 0.5]], 'zelfde toewijzing, nu op N');
  assertEq(assignmentsOf(L).length, 0, 'de fase draagt niets meer');
  assertEq(res.structuredContent.data.phaseTransitions, [{
    phaseId: L, phaseName: 'Metselen', milestoneCleared: false,
    assignmentsMovedTo: { taskId: N, taskName: 'Voegen', resourceIds: [R], resourceNames: ['Metselaar'] },
  }], 'het antwoord meldt de verhuizing');
  assertEq(S().ui.notifications.map(n => n.messageKey), [], 'MCP: geen UI-melding');
  assertEq(undoDepth(), before + 1, 'één undo-stap');
  const load = Object.values((S().resourceLoadResult?.load?.[R] ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
  assertEq(load, 2.5, 'de belasting telt weer mee (5 werkdagen × 0,5)');
  S().undo();
  assertEq([task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId], [null, L], 'één undo zet alles terug');
});

test('add_tasks met parentId: de eerste nieuwe subtaak die toewijzingen mag dragen krijgt ze', async () => {
  const { L, R } = seed();
  const res = await rpc('planner_add_tasks', { tasks: [
    { tempId: 'tmp-keuring', name: 'Keuring', parentId: L, isMilestone: true },
    { tempId: 'tmp-lagen', name: 'Eerste lagen', parentId: L },
  ] });
  assertEq(res.isError ?? false, false, 'de call slaagt');
  const lagen = res.structuredContent.data.created['tmp-lagen'];
  assertEq(assignmentsOf(lagen).map(a => a.resourceId), [R], 'de mijlpaal wordt overgeslagen');
  assertEq(res.structuredContent.data.phaseTransitions?.[0]?.assignmentsMovedTo?.taskId, lagen, 'en het antwoord noemt dat');
});

test('add_tasks met alleen een mijlpaal onder een taak met toewijzing: VALIDATION, niets gewijzigd', async () => {
  const { L, assignmentId } = seed();
  const count = S().tasks.length;
  const res = await rpc('planner_add_tasks', { tasks: [{ tempId: 'tmp-keuring', name: 'Keuring', parentId: L, isMilestone: true }] });
  assertEq(res.isError, true, 'de call faalt');
  assertEq(res.structuredContent.code, 'VALIDATION', 'foutcode VALIDATION');
  assert(String(res.structuredContent.error).includes('geen van de nieuwe subtaken'), `reden noemt het probleem: ${res.structuredContent.error}`);
  assertEq([S().tasks.length, S().assignments.find(a => a.id === assignmentId)?.taskId], [count, L], 'volledige rollback');
});

test('move_task naar een taak waarvan de eerste nieuwe subtaak dezelfde resource al heeft: VALIDATION', async () => {
  const { L, R, N } = seed();
  S().assignResource(N, R, 1);
  const res = await rpc('planner_move_task', { id: N, newParentId: L });
  assertEq(res.isError, true, 'de call faalt');
  assert(String(res.structuredContent.error).includes('Metselaar'), `reden noemt de resource: ${res.structuredContent.error}`);
  assertEq([task(N).parentId, assignmentsOf(L).length, assignmentsOf(N).length], [null, 1, 1], 'niets gewijzigd');
});

test('een mijlpaal die via move_task een kind krijgt verliest zijn mijlpaalvlag', async () => {
  S().newProject();
  const M = S().addTask({ name: 'Oplevering', isMilestone: true });
  const N = S().addTask({ name: 'Nazorg' });
  const res = await rpc('planner_move_task', { id: N, newParentId: M });
  assertEq(res.isError ?? false, false, 'de call slaagt');
  assertEq(task(M).isMilestone, false, 'mijlpaalvlag eraf (anders tekent de Gantt een ruit)');
  assertEq(res.structuredContent.data.phaseTransitions?.[0]?.milestoneCleared, true, 'het antwoord meldt het');
});

test('update_tasks isMilestone: fase en taak-met-toewijzing blijven geweigerd (gedeelde regel)', async () => {
  const { L } = seed();
  const P = S().addTask({ name: 'Fase' });
  S().addTask({ name: 'Kind', parentId: P });
  const res = await rpc('planner_update_tasks', { updates: [
    { id: L, fields: { isMilestone: true } },
    { id: P, fields: { isMilestone: true } },
  ] });
  assertEq((res.structuredContent.itemRejections ?? []).map((r: { id: string }) => r.id), [L, P], 'beide geweigerd');
  assertEq([task(L).isMilestone, task(P).isMilestone], [false, false], 'niets omgezet');
});

await run();
