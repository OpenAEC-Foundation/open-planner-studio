// Taaktypes-etappe, bouwstap 7 — de werkregel en het resterende werk via de bridge
// (spec docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md §5/§10).
//
// Drie ingangen, allemaal door de ECHTE dispatch (schemapoort + guards):
//   1. planner_update_tasks `fields.workRule` (zetten, wissen, ongeldig, op een mijlpaal);
//   2. planner_manage_assignments `update.remainingWorkMinutes` (duur volgt onder FIXED_WORK,
//      inzet volgt onder FIXED_DURATION_RATE; ongeldig/afwezig zacht geweigerd);
//   3. planner_update_project `defaultWorkRule` (zetten/wissen; leesbaar via get_project_info).
// Plus: één undo-stap per call, en planner_batch met typewissel + inzetwijziging in één draaiboek.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { readTools } from '@/services/mcp/tools/readTools';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk, McpToolErr } from '@/services/mcp/contracts';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const store = useAppStore;
store.getState().addTask({ name: 'warmup' });
store.getState().undo();
registerToolModules([taskTools, calendarResourceTools, batchTools, readTools]);

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: store.getState().activeDocumentId, ...over });
}
let nextId = 1;
/** Via de ECHTE dispatch-weg (schemavalidatie inbegrepen). */
async function call(name: string, args: unknown, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  const id = nextId++;
  const raw = await handleMcpMessage(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }), ctx);
  const msg = JSON.parse(raw ?? '{}') as { result?: { isError?: boolean; structuredContent?: any }; error?: { message: string } };
  if (msg.error) return { ok: false, error: msg.error.message } as McpToolResult;
  const sc = msg.result?.structuredContent ?? {};
  if (msg.result?.isError || sc.ok === false) return { ok: false, error: String(sc.error ?? ''), code: sc.code } as McpToolResult;
  return { ok: true, data: sc.data, itemRejections: sc.itemRejections } as McpToolResult;
}
function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : (res as McpToolErr).error}`);
  return (res as McpToolOk).data as any;
}
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  assert(res.ok, `verwachtte ok (met zachte weigering), kreeg fout: ${res.ok ? '' : (res as McpToolErr).error}`);
  return ((res as McpToolOk).itemRejections ?? []) as { id: string; reason: string }[];
}
const task = (id: string) => store.getState().tasks.find((t) => t.id === id)!;
const asg = (taskId: string, resourceId: string) => store.getState().assignments.find((a) => a.taskId === taskId && a.resourceId === resourceId)!;
const slot = () => store.getState().calendar.hoursPerDay * 60;
function reset(): void { store.getState().newProject(); }
function seed(days = 4): { t: string; r: string } {
  reset();
  const t = store.getState().addTask({ name: 'werk', time: createDefaultTaskTime('2026-06-01', days) });
  const r = store.getState().addResource({ name: 'r1', type: 'LABOR', description: '', maxUnits: 1 });
  store.getState().assignResource(t, r, 1);
  store.getState().runCPM();
  return { t, r };
}

// 1) update_tasks.fields.workRule
test('update_tasks: workRule zetten legt het restwerk vast, wissen zet terug naar de projectstandaard', async () => {
  const { t, r } = seed();
  const events0 = store.getState().historyEvents.length;
  const res = await call('planner_update_tasks', { updates: [{ id: t, fields: { workRule: 'FIXED_WORK' } }] });
  assertEq(okData(res).updated, [t], 'taak bijgewerkt');
  assertEq(task(t).workRule, 'FIXED_WORK', 'workRule gezet');
  assertEq(asg(t, r).remainingWorkMinutes, 4 * slot(), 'restwerk vastgelegd (4 dagen × slot)');
  assertEq(task(t).time.scheduleDuration, 4, 'duur ongewijzigd (typewissel is getalvrij)');
  assertEq(store.getState().historyEvents.length - events0, 1, 'één undo-stap');
  const got = okData(await call('planner_get_task', { taskId: t }));
  assertEq(got.workRule, 'FIXED_WORK', 'get_task toont de regel');
  okData(await call('planner_update_tasks', { updates: [{ id: t, fields: { workRule: null } }] }));
  assertEq(task(t).workRule, undefined, 'null wist het veld');
  assertEq(asg(t, r).remainingWorkMinutes, 4 * slot(), 'het vastgelegde werk blijft staan (besluit 2)');
});

test('update_tasks: ongeldige workRule wordt per item geweigerd met de vier waarden in de reden', async () => {
  const { t } = seed();
  const res = await call('planner_update_tasks', { updates: [{ id: t, fields: { workRule: 'fixed_work' } }] });
  const rej = rejections(res);
  assert(rej.length === 1 && /FIXED_DURATION_RATE \| FIXED_DURATION_WORK \| FIXED_WORK \| FIXED_RATE/.test(rej[0].reason), `reden noemt de waarden: ${rej[0]?.reason}`);
  assertEq(task(t).workRule, undefined, 'niets gezet');
});

test('update_tasks: workRule + duration in één call — de duur wordt onder de OUDE regel verwerkt, de nieuwe regel legt daarna vast', async () => {
  const { t, r } = seed();
  okData(await call('planner_update_tasks', { updates: [{ id: t, fields: { duration: 8, workRule: 'FIXED_WORK' } }] }));
  assertEq(task(t).time.scheduleDuration, 8, 'duur 8');
  assertEq(asg(t, r).unitsPerDay, 1, 'inzet blijft 1 (duur onder FIXED_DURATION_RATE verwerkt)');
  assertEq(asg(t, r).remainingWorkMinutes, 8 * slot(), 'daarna vastgelegd: 8 dagen × slot');
});

test('add_tasks: workRule op een nieuwe taak is een kaal veld', async () => {
  reset();
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-a', name: 'A', duration: 3, workRule: 'FIXED_RATE' }] });
  const id = okData(res).created['tmp-a'] as string;
  assertEq(task(id).workRule, 'FIXED_RATE', 'workRule bij aanmaak gezet');
});

// 2) manage_assignments.update.remainingWorkMinutes
test('manage_assignments: remainingWorkMinutes onder FIXED_WORK verandert de duur; onder de standaardregel de inzet', async () => {
  const { t, r } = seed();
  store.getState().setTaskWorkRule(t, 'FIXED_WORK');
  const a = asg(t, r).id;
  const events0 = store.getState().historyEvents.length;
  const res = await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: a, remainingWorkMinutes: 8 * slot() }] });
  assertEq(okData(res).updated, [a], 'toewijzing bijgewerkt');
  assertEq(task(t).time.scheduleDuration, 8, 'FIXED_WORK: werk 8 dagen bij inzet 1 ⇒ duur 8');
  assertEq(asg(t, r).unitsPerDay, 1, 'inzet blijft');
  assertEq(store.getState().historyEvents.length - events0, 1, 'één undo-stap');
  assertEq(store.getState().scheduleStale, false, 'de transactie heeft herrekend');
  // Standaardregel: duur beschermd ⇒ inzet = W / R.
  store.getState().setTaskWorkRule(t, 'FIXED_DURATION_RATE');
  okData(await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: a, remainingWorkMinutes: 4 * slot() }] }));
  assertEq(task(t).time.scheduleDuration, 8, 'duur blijft 8');
  assertEq(asg(t, r).unitsPerDay, 0.5, 'inzet 0,5 = 4 slots / 8 dagen');
});

test('manage_assignments: unitsPerDay onder FIXED_WORK verkort de taak; remainingWorkMinutes ≤ 0 en mijlpaal zacht geweigerd', async () => {
  const { t, r } = seed();
  store.getState().setTaskWorkRule(t, 'FIXED_WORK');
  const a = asg(t, r).id;
  okData(await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: a, unitsPerDay: 2 }] }));
  assertEq(task(t).time.scheduleDuration, 2, 'inzet 1→2: duur 4→2');
  const bad = await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: a, remainingWorkMinutes: 0 }] });
  // Diepte-regel van de schemapoort (docs/recepten/mcp-tool.md): de BINNENKANT van een bulk-item is
  // aan de handler — dus een zachte weigering met reden, geen harde VALIDATION-fout.
  const rej0 = rejections(bad);
  assert(rej0.length === 1 && rej0[0].reason.includes('strikt positief'), `0 zacht geweigerd met reden: ${rej0[0]?.reason}`);
  const bad2 = await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: a }] });
  const rej = rejections(bad2);
  assert(rej.length === 1 && rej[0].reason.includes('remainingWorkMinutes'), `lege update noemt het nieuwe veld: ${rej[0]?.reason}`);
  assertEq(task(t).time.scheduleDuration, 2, 'niets veranderd');
});

test('manage_assignments: resource erbij onder FIXED_WORK verdeelt het werk en verkort de taak (8-B, zuiver P6)', async () => {
  const { t, r } = seed();
  store.getState().setTaskWorkRule(t, 'FIXED_WORK');
  const r2 = store.getState().addResource({ name: 'r2', type: 'LABOR', description: '', maxUnits: 1 });
  okData(await call('planner_manage_assignments', { actions: [{ action: 'add', taskId: t, resourceId: r2, unitsPerDay: 1 }] }));
  assertEq(task(t).time.scheduleDuration, 2, 'werk 4 slots over 2 × 1 ⇒ 2 dagen');
  assertEq([asg(t, r).remainingWorkMinutes, asg(t, r2).remainingWorkMinutes], [2 * slot(), 2 * slot()], 'werk 2 + 2');
  okData(await call('planner_manage_assignments', { actions: [{ action: 'remove', assignmentId: asg(t, r2).id }] }));
  assertEq(task(t).time.scheduleDuration, 4, 'eraf: terug naar 4');
});

// 3) update_project.defaultWorkRule
test('update_project: defaultWorkRule zetten/wissen, zichtbaar in get_project_info', async () => {
  const { t, r } = seed();
  const res = await call('planner_update_project', { defaultWorkRule: 'FIXED_DURATION_WORK' });
  const data = okData(res);
  assertEq(data.updated, ['defaultWorkRule'], 'gerapporteerd');
  assertEq(data.project.defaultWorkRule, 'FIXED_DURATION_WORK', 'respons toont de regel');
  assertEq(store.getState().project.defaultWorkRule, 'FIXED_DURATION_WORK', 'gezet');
  assertEq(okData(await call('planner_get_project_info', {})).project.defaultWorkRule, 'FIXED_DURATION_WORK', 'get_project_info toont hem');
  // De projectstandaard werkt op taken zonder eigen regel: inzet → 0,5 laat de duur staan en legt werk vast.
  okData(await call('planner_manage_assignments', { actions: [{ action: 'update', assignmentId: asg(t, r).id, unitsPerDay: 0.5 }] }));
  assertEq([task(t).time.scheduleDuration, asg(t, r).remainingWorkMinutes], [4, 2 * slot()], 'FIXED_DURATION_WORK via de projectstandaard');
  okData(await call('planner_update_project', { defaultWorkRule: null }));
  assertEq('defaultWorkRule' in store.getState().project, false, 'null verwijdert de sleutel echt');
  const bad = await call('planner_update_project', { defaultWorkRule: 'Fixed Work' });
  assert(!bad.ok, 'ongeldige waarde is een harde fout');
});

// 4) planner_batch: typewissel + inzet in één draaiboek = één undo-stap
test('batch: workRule + unitsPerDay in één draaiboek ⇒ één undo-stap, duur volgt de nieuwe regel', async () => {
  const { t, r } = seed();
  const events0 = store.getState().historyEvents.length;
  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: t, fields: { workRule: 'FIXED_WORK' } }] } },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'update', assignmentId: asg(t, r).id, unitsPerDay: 0.5 }] } },
    ],
  });
  assert(res.ok, `batch ok: ${res.ok ? '' : (res as McpToolErr).error}`);
  assertEq(task(t).time.scheduleDuration, 8, 'inzet 1→0,5 onder FIXED_WORK ⇒ duur 8');
  assertEq(store.getState().historyEvents.length - events0, 1, 'één undo-stap');
  store.getState().undo();
  assertEq([task(t).workRule, task(t).time.scheduleDuration, asg(t, r).unitsPerDay], [undefined, 4, 1], 'undo zet alles in één keer terug');
});

await run();
