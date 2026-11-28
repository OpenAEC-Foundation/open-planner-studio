import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { CUSTOM_TASK_TYPE_COLOR_ORDER } from '@/engine/renderer/resourcePalette';
import { taskTools } from '@/services/mcp/tools/taskTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createSnapshot } from '@/state/snapshot';

const store = useAppStore;

store.getState().addTask({ name: 'warmup' });
store.getState().undo();

function reset(): void {
  store.getState().newProject();
}

function makeCtx(overrides: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
    ...overrides,
  });
}

function tool(name: string) {
  const def = taskTools.find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return def;
}
async function call(name: string, args: unknown, ctx: McpContext): Promise<McpToolResult> {
  return await tool(name).handler(args, ctx);
}
function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}
function taskById(id: string) {
  return store.getState().tasks.find((t) => t.id === id);
}

test('add_tasks: volledige created-map + earlyStart/earlyFinish per taak + projectEnd', async () => {
  reset();
  const ctx = makeCtx();
  const res = await call(
    'planner_add_tasks',
    {
      tasks: [
        { tempId: 'A', name: 'Fase A' },
        { tempId: 'A1', name: 'Deeltaak A1', parentId: 'A' },
        { tempId: 'A2', name: 'Deeltaak A2', parentId: 'A' },
      ],
    },
    ctx,
  );
  const data = okData(res);
  assertEq(Object.keys(data.created).sort(), ['A', 'A1', 'A2'], 'created-map bevat alle tempId\'s');
  for (const tempId of ['A', 'A1', 'A2']) {
    const realId = data.created[tempId];
    assert(typeof realId === 'string' && taskById(realId), `realId voor ${tempId} bestaat in de store`);
  }
  assert(Array.isArray(data.tasks) && data.tasks.length === 3, 'data.tasks heeft 3 rijen');
  for (const row of data.tasks) {
    assert(typeof row.earlyStart === 'string' && row.earlyStart.length > 0, 'earlyStart gevuld');
    assert(typeof row.earlyFinish === 'string' && row.earlyFinish.length > 0, 'earlyFinish gevuld');
  }
  assert(typeof data.projectEnd === 'string' && data.projectEnd.length > 0, 'projectEnd gevuld');
  assertEq(res.ok && res.envelope.scheduleStale, false, 'schedule is vers na add_tasks');
});

test('update_tasks: 19 geldig + 1 rotte regel ⇒ 19 toegepast, 1 zachte weigering (geen rollback)', async () => {
  reset();
  const ids: string[] = [];
  for (let i = 0; i < 19; i++) ids.push(store.getState().addTask({ name: `orig-${i}` }));

  const updates = ids.map((id, i) => ({ id, fields: { name: `nieuw-${i}` } }));
  updates.push({ id: 'bestaat-niet', fields: { name: 'x' } });

  const ctx = makeCtx();
  const res = await call('planner_update_tasks', { updates }, ctx);
  const data = okData(res);
  assertEq(data.updated.length, 19, '19 geldige items toegepast');
  assert(Array.isArray(res.ok && res.itemRejections) && (res as McpToolOk).itemRejections!.length === 1,
    'precies één zachte weigering');
  const rej = (res as McpToolOk).itemRejections![0];
  assertEq(rej.id, 'bestaat-niet', 'de weigering noemt het rotte id');
  for (let i = 0; i < 19; i++) assertEq(taskById(ids[i])!.name, `nieuw-${i}`, `taak ${i} hernoemd`);
});

test('update_tasks progress 40% ⇒ completion 0.4 + STARTED + actualStart (via de tool)', async () => {
  reset();
  const id = store.getState().addTask({ name: 'pg' });
  store.getState().runCPM();
  store.getState().setProject({ statusDate: '2027-01-01' });
  const t0 = taskById(id)!;
  const expectStart = t0.time.earlyStart || t0.time.scheduleStart;

  const ctx = makeCtx();
  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 40 } }] }, ctx);
  okData(res);
  const t = taskById(id)!;
  assertEq(t.time.completion, 0.4, 'completion 40 (0–100) → 0.4');
  assertEq(t.status, 'STARTED', 'voortgang>0 zonder finish ⇒ STARTED');
  assertEq(t.time.actualStart, expectStart, 'actualStart afgeleid uit earlyStart||scheduleStart');
});

test('update_tasks progress: completion 150 ⇒ zachte weigering, taak ongemoeid', async () => {
  reset();
  const id = store.getState().addTask({ name: 'pg-oob' });
  store.getState().setProject({ statusDate: '2027-01-01' });
  const t0 = taskById(id)!;
  const authoredBefore = { completion: t0.time.completion, actualStart: t0.time.actualStart, actualFinish: t0.time.actualFinish, status: t0.status };
  const ctx = makeCtx();
  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 150 } }] }, ctx);
  assert(res.ok, 'de call slaagt (zachte per-item-weigering, geen stap-fout)');
  assertEq((res as McpToolOk).itemRejections!.length, 1, 'één zachte weigering');
  assert(/0.?100|bereik|range/i.test((res as McpToolOk).itemRejections![0].reason), 'reden noemt het bereik');
  const t1 = taskById(id)!;
  assertEq({ completion: t1.time.completion, actualStart: t1.time.actualStart, actualFinish: t1.time.actualFinish, status: t1.status },
    authoredBefore, 'geweigerd item laat completion/actuals/status ongemoeid');
});

test('delete_tasks: verwijdert bestaande, onbekend id ⇒ zachte weigering', async () => {
  reset();
  const a = store.getState().addTask({ name: 'del-a' });
  const b = store.getState().addTask({ name: 'del-b' });
  const ctx = makeCtx();
  const res = await call('planner_delete_tasks', { ids: [a, 'weg', b] }, ctx);
  const data = okData(res);
  assertEq(data.deleted.sort(), [a, b].sort(), 'a en b verwijderd');
  assertEq((res as McpToolOk).itemRejections!.length, 1, 'onbekend id ⇒ één zachte weigering');
  assert(!taskById(a) && !taskById(b), 'a en b zijn weg uit de store');
});

test('delete_tasks: de actieve taak wijst daarna niet naar een verwijderde taak', async () => {
  reset();
  const a = store.getState().addTask({ name: 'act-a' });
  const b = store.getState().addTask({ name: 'act-b' });
  store.getState().selectTasks([a, b], false);
  store.setState({ activeTaskId: a });
  okData(await call('planner_delete_tasks', { ids: [a] }, makeCtx()));
  assertEq(store.getState().activeTaskId, b, 'terug op de eerste resterende selectie (vóór de fix: het verwijderde id)');
});

test('move_task: verplaatst taak onder nieuwe ouder op positie', async () => {
  reset();
  const p = store.getState().addTask({ name: 'P' });
  store.getState().addTask({ name: 'A', parentId: p });
  const x = store.getState().addTask({ name: 'X' });
  const ctx = makeCtx();
  const res = await call('planner_move_task', { id: x, newParentId: p, position: 0 }, ctx);
  okData(res);
  assertEq(taskById(x)!.parentId, p, 'X hangt nu onder P');
  const parent = taskById(p)!;
  assertEq(parent.childIds.map((c) => taskById(c)!.name), ['X', 'A'], 'X vooraan in childIds');
});

test('move_task: taak onder zichzelf/afstammeling ⇒ harde VALIDATION-fout, store byte-identiek', async () => {
  reset();
  const p = store.getState().addTask({ name: 'mp' });
  const c = store.getState().addTask({ name: 'mc', parentId: p });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const ctx = makeCtx();
  const res = await call('planner_move_task', { id: p, newParentId: c }, ctx);
  assert(!res.ok, 'P onder zijn kind hoort te falen');
  assert(!res.ok && res.code === 'VALIDATION', 'code VALIDATION');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'store onaangeroerd');
});

test('move_task: een corrupte parentId-cyclus elders in de boom laat de guard niet hangen', async () => {
  reset();
  const a = store.getState().addTask({ name: 'mv-a' });
  const x = store.getState().addTask({ name: 'mv-x' });
  const y = store.getState().addTask({ name: 'mv-y' });
  store.setState((s) => {
    s.tasks.find((t) => t.id === x)!.parentId = y;
    s.tasks.find((t) => t.id === y)!.parentId = x;
  });
  const res = await call('planner_move_task', { id: a, newParentId: x }, makeCtx());
  assert(res.ok || res.code !== 'INTERNAL', 'de call eindigt met een gewoon resultaat');
  const res2 = await call('planner_move_task', { id: x, newParentId: y }, makeCtx());
  assert(!res2.ok && res2.code === 'VALIDATION', 'X onder Y (Y hangt al onder X) hoort VALIDATION te geven');
});

test('add_dependencies: kring ⇒ CYCLE-stap-fout + volledige rollback (byte-identiek)', async () => {
  reset();
  const a = store.getState().addTask({ name: 'cy-a' });
  const b = store.getState().addTask({ name: 'cy-b' });
  store.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const ctx = makeCtx();
  const res = await call(
    'planner_add_dependencies',
    { dependencies: [{ predecessorId: b, successorId: a, type: 'FINISH_START' }] },
    ctx,
  );
  assert(!res.ok, 'b→a bovenop a→b hoort een kring te vormen');
  assert(!res.ok && res.code === 'CYCLE', 'code CYCLE');
  assert(!res.ok && /a|b|→|kring|cycle/i.test(res.error), 'de fout benoemt de kring');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'na rollback byte-identiek');
});

test('add_dependencies: duplicaat in dezelfde call ⇒ één toegepast, één zachte weigering', async () => {
  reset();
  const a = store.getState().addTask({ name: 'dd-a' });
  const b = store.getState().addTask({ name: 'dd-b' });
  const ctx = makeCtx();
  const res = await call(
    'planner_add_dependencies',
    {
      dependencies: [
        { predecessorId: a, successorId: b, type: 'FINISH_START' },
        { predecessorId: a, successorId: b, type: 'FINISH_START' },
      ],
    },
    ctx,
  );
  const data = okData(res);
  assertEq(data.added.length, 1, 'precies één relatie toegevoegd');
  assertEq((res as McpToolOk).itemRejections!.length, 1, 'het duplicaat is zacht geweigerd');
  assert(/already existed|duplicate|already|exist/i.test((res as McpToolOk).itemRejections![0].reason),
    'de reden noemt dat de relatie al bestond');
  const seqs = store.getState().sequences.filter((s) => s.predecessorId === a && s.successorId === b);
  assertEq(seqs.length, 1, 'store bevat precies één a→b-relatie');
});

test('add_dependencies: zelfrelatie ⇒ zachte weigering per item, de rest van de call gaat door', async () => {
  reset();
  const a = store.getState().addTask({ name: 'self-a' });
  const b = store.getState().addTask({ name: 'self-b' });
  const res = await call('planner_add_dependencies', {
    dependencies: [
      { predecessorId: a, successorId: a, type: 'FINISH_START' },
      { predecessorId: a, successorId: b, type: 'FINISH_START' },
    ],
  }, makeCtx());
  const data = okData(res);
  assertEq(data.added.length, 1, 'de geldige relatie a→b is toegevoegd');
  const rej = (res as McpToolOk).itemRejections ?? [];
  assertEq(rej.length, 1, 'precies één weigering: de zelfrelatie');
  assert(/itself/.test(rej[0]?.reason ?? ''), 'de reden noemt de zelfrelatie (zelfde tekst als update_dependencies)');
});

test('remove_dependencies: verwijdert op id, onbekend id ⇒ zachte weigering', async () => {
  reset();
  const a = store.getState().addTask({ name: 'rm-a' });
  const b = store.getState().addTask({ name: 'rm-b' });
  store.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const seqId = store.getState().sequences.find((s) => s.predecessorId === a)!.id;
  const ctx = makeCtx();
  const res = await call('planner_remove_dependencies', { ids: [seqId, 'geen-seq'] }, ctx);
  const data = okData(res);
  assertEq(data.removed, [seqId], 'de bestaande relatie is verwijderd');
  assertEq((res as McpToolOk).itemRejections!.length, 1, 'onbekend id ⇒ één zachte weigering');
  assertEq(store.getState().sequences.filter((s) => s.id === seqId).length, 0, 'relatie is echt weg');
});

test('undo: één tool-mutatie = één undo-stap (add_tasks volledig ongedaan)', async () => {
  reset();
  const ctx = makeCtx();
  await call('planner_add_tasks', { tasks: [
    { tempId: 'A', name: 'a' },
    { tempId: 'B', name: 'b' },
    { tempId: 'C', name: 'c' },
  ] }, ctx);
  assertEq(store.getState().tasks.length, 3, 'drie taken aangemaakt');

  const res = await call('planner_undo', {}, ctx);
  assert(res.ok, 'undo hoort te slagen');
  assertEq(store.getState().tasks.length, 0, 'één undo-stap maakt de hele bulk ongedaan');

  const redo = await call('planner_redo', {}, ctx);
  assert(redo.ok, 'redo hoort te slagen');
  assertEq(store.getState().tasks.length, 3, 'redo herstelt de bulk in één stap');
});

test('geen planner_run_cpm: een wijzigende mutatie wist scheduleStale en levert projectEnd', async () => {
  reset();
  store.getState().addTask({ name: 'rc' });
  assertEq(store.getState().scheduleStale, true, 'planning is stale na een store-edit');
  assert(!taskTools.some((t) => t.name === 'planner_run_cpm'), 'planner_run_cpm hoort niet meer te bestaan');
  const ctx = makeCtx();
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'X', name: 'na stale' }] }, ctx);
  const data = okData(res);
  assertEq(store.getState().scheduleStale, false, 'de eindherberekening van de mutatie wist scheduleStale');
  assert(typeof data.projectEnd === 'string' && data.projectEnd.length > 0, 'projectEnd gevuld');
  assertEq(res.ok && res.envelope.scheduleStale, false, 'envelop meldt vers');
});

test('guard: paused ⇒ PAUSED, geen mutatie', async () => {
  reset();
  const ctx = makeCtx({ paused: true });
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'A', name: 'x' }] }, ctx);
  assert(!res.ok && res.code === 'PAUSED', 'PAUSED-fout');
  assertEq(store.getState().tasks.length, 0, 'geen taak aangemaakt tijdens pauze');
  assertEq(res.envelope?.paused, true, 'envelop meldt paused');
});

test('guard: readOnly ⇒ READ_ONLY, geen mutatie', async () => {
  reset();
  const ctx = makeCtx({ readOnly: true });
  const res = await call('planner_delete_tasks', { ids: ['x'] }, ctx);
  assert(!res.ok && res.code === 'READ_ONLY', 'READ_ONLY-fout');
});

test('guard: document-drift ⇒ DOC_DRIFT (fail-closed)', async () => {
  reset();
  const ctx = makeCtx();
  store.getState().newDocument();
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'A', name: 'x' }] }, ctx);
  assert(!res.ok && res.code === 'DOC_DRIFT', 'DOC_DRIFT-fout');
  assert(!res.ok && /gewijzigd|drift|switch/i.test(res.error), 'de fout legt de drift uit');
});

test('backup: ensureBackup-pad verschijnt in de envelop van de eerste mutatie', async () => {
  reset();
  let backupCalls = 0;
  const ctx = makeCtx({
    ensureBackup: async (docId, kind) => {
      backupCalls++;
      assertEq(kind, 'mutate', 'backup krijgt de tool-kind mee');
      return `/tmp/ai-backups/${docId}/snap.ifc`;
    },
  });
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'A', name: 'x' }] }, ctx);
  assert(res.ok, 'mutatie slaagt');
  assertEq(backupCalls, 1, 'ensureBackup precies één keer aangeroepen');
  assert(res.ok && typeof res.envelope.backupCreated === 'string' && res.envelope.backupCreated.includes('snap.ifc'),
    'het backup-pad staat in de envelop');
});

test('backup: mislukte backup weigert de mutatie vóór enige wijziging (fail-safe)', async () => {
  reset();
  const ctx = makeCtx({ ensureBackup: async () => { throw new Error('schijf vol'); } });
  const res = await call('planner_add_tasks', { tasks: [{ tempId: 'A', name: 'x' }] }, ctx);
  assert(!res.ok && res.code === 'BACKUP_FAILED', 'BACKUP_FAILED-fout');
  assertEq(store.getState().tasks.length, 0, 'geen mutatie na een mislukte backup');
});

test('registratie: registerToolModules([taskTools]) ⇒ tools/list draagt prefix+description+annotaties', async () => {
  registerToolModules([taskTools]);
  const raw = await handleMcpMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), makeCtx());
  const msg = JSON.parse(raw);
  const tools: any[] = msg.result.tools;
  assertEq(tools.length, taskTools.length, 'alle T19-tools verschijnen in tools/list');
  const listed = new Set(tools.map((t) => t.name));
  for (const name of [
    'planner_add_tasks', 'planner_update_tasks', 'planner_delete_tasks', 'planner_move_task',
    'planner_add_dependencies', 'planner_remove_dependencies', 'planner_undo', 'planner_redo',
    'planner_set_task_splits',
  ]) {
    assert(listed.has(name), `${name} ontbreekt in de T19-module`);
  }
  for (const t of tools) {
    assert(typeof t.name === 'string' && t.name.startsWith('planner_'), `prefix op ${t.name}`);
    assert(typeof t.description === 'string' && t.description.trim().length > 0, `description op ${t.name}`);
    assert(t.inputSchema && typeof t.inputSchema === 'object', `inputSchema op ${t.name}`);
    const a = t.annotations;
    assert(a && typeof a.readOnlyHint === 'boolean' && typeof a.destructiveHint === 'boolean'
      && typeof a.idempotentHint === 'boolean' && typeof a.openWorldHint === 'boolean',
      `vier annotaties op ${t.name}`);
  }
  const del = tools.find((t) => t.name === 'planner_delete_tasks');
  assertEq(del.annotations.destructiveHint, true, 'delete_tasks is destructief');
});

test('delete_tasks all-unknown ⇒ Ok + weigeringen, GEEN snapshot en redo-stack ONGEMOEID', async () => {
  reset();
  store.getState().addTask({ name: 'seed' });
  store.getState().undo();
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const redoLen = store.getState().historyEvents.filter(event => event.state === 'undone').length;
  assert(redoLen >= 1, 'de redo-stack is geseed (>=1 entry)');

  const ctx = makeCtx();
  const res = await call('planner_delete_tasks', { ids: ['weg-1', 'weg-2'] }, ctx);
  assert(res.ok, 'all-unknown delete slaagt als no-op met weigeringen');
  assertEq((res as McpToolOk).itemRejections!.length, 2, 'beide onbekende id\'s geweigerd');
  assertEq(((res as McpToolOk).data as any).deleted, [], 'niets verwijderd');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'GEEN nieuwe undo-snapshot gepusht');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'undone').length, redoLen, 'redo-stack ONGEMOEID (geen AI-no-op-wipe)');
});

test('add_dependencies: kring via TWEE nieuwe relaties in één call ⇒ CYCLE + volledige rollback', async () => {
  reset();
  const a = store.getState().addTask({ name: 'tc-a' });
  const b = store.getState().addTask({ name: 'tc-b' });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const ctx = makeCtx();
  const res = await call('planner_add_dependencies', { dependencies: [
    { predecessorId: a, successorId: b, type: 'FINISH_START' },
    { predecessorId: b, successorId: a, type: 'FINISH_START' },
  ] }, ctx);
  assert(!res.ok && res.code === 'CYCLE', 'twee nieuwe relaties die samen een kring vormen ⇒ CYCLE');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'volledige rollback, byte-identiek');
});

test('add_tasks: dubbele tempId ⇒ harde VALIDATION op toolniveau, store byte-identiek (geen transactie)', async () => {
  reset();
  store.getState().addTask({ name: 'bestaand' });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const ctx = makeCtx();
  const res = await call('planner_add_tasks', { tasks: [
    { tempId: 'DUP', name: 'x' },
    { tempId: 'DUP', name: 'y' },
  ] }, ctx);
  assert(!res.ok && res.code === 'VALIDATION', 'dubbele tempId ⇒ VALIDATION');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'store byte-identiek');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'geen undo-snapshot (pre-transactie afgevangen)');
});

test('custom task type: MCP materialiseert id+naam atomisch en behoudt builtin-enumcontract', async () => {
  reset();
  const ctx = makeCtx();
  const custom = { id: 'ops-type-gevel', name: 'Gevelinspectie' };
  const res = await call('planner_add_tasks', { tasks: [
    { tempId: 'CUSTOM', name: 'Inspectie', taskType: 'USERDEFINED', customTaskType: custom },
  ] }, ctx);
  const data = okData(res);
  const id = data.created.CUSTOM as string;
  assertEq(taskById(id)?.taskType, 'USERDEFINED', 'custom type gebruikt expliciet USERDEFINED, nooit CONSTRUCTION');
  assertEq(taskById(id)?.customTaskTypeId, custom.id, 'taak bewaart de stabiele custom-id');
  assertEq(store.getState().customTaskTypes, [{ ...custom, color: CUSTOM_TASK_TYPE_COLOR_ORDER[0] }], 'projectsnapshot bevat id plus naam, en een vrije kleur (#856)');

  const conflict = await call('planner_update_tasks', { updates: [{ id, fields: {
    customTaskType: { id: custom.id, name: 'Andere naam' },
  } }] }, ctx);
  assert(conflict.ok && conflict.itemRejections?.length === 1, 'zelfde id met andere snapshotnaam wordt zacht geweigerd');
  assertEq(taskById(id)?.customTaskTypeId, custom.id, 'conflict beschadigt bestaande taak niet');

  const nameConflict = await call('planner_add_tasks', { tasks: [{
    tempId: 'CUSTOM_NAME_CONFLICT', name: 'Andere inspectie',
    customTaskType: { id: 'ops-type-anders', name: 'gevelinspectie' },
  }] }, ctx);
  assert(!nameConflict.ok && nameConflict.code === 'VALIDATION', 'zelfde naam met andere id wordt case-insensitive geweigerd');
  assertEq(store.getState().tasks.some(task => task.name === 'Andere inspectie'), false, 'naamconflict maakt geen halve taak');

  const builtin = await call('planner_update_tasks', { updates: [{ id, fields: { taskType: 'CONSTRUCTION' } }] }, ctx);
  assert(builtin.ok, 'expliciete builtin-update blijft toegestaan');
  assertEq(taskById(id)?.taskType, 'CONSTRUCTION', 'builtin-enum blijft ongewijzigd bruikbaar');
  assertEq(taskById(id)?.customTaskTypeId, undefined, 'builtin-update wist de custom-toewijzing');

  const opvolger = { id: 'ops-type-keuring', name: 'Keuring' };
  const customUpdate = await call('planner_update_tasks', { updates: [{ id, fields: { customTaskType: opvolger } }] }, ctx);
  assert(customUpdate.ok, 'update kan een nieuw custom type materialiseren');
  assertEq(taskById(id)?.customTaskTypeId, opvolger.id, 'update bewaart de nieuwe stabiele id');
  assertEq(store.getState().customTaskTypes, [{ ...custom, color: CUSTOM_TASK_TYPE_COLOR_ORDER[0] }, { ...opvolger, color: CUSTOM_TASK_TYPE_COLOR_ORDER[1] }], 'update voegt de nieuwe projectsnapshot toe zonder de oude te herschrijven');
});

await run();
