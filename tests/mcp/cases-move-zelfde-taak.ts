// `planner_manage_assignments` — een `move` naar de taak waar de toewijzing AL op staat.
//
// De bug: `classifyAssignments` sloot bij de dubbelcheck van `move` de toewijzing zélf uit
// (`x.id !== cur.id`), dus een move naar de eigen taak kwam als geldig plan door de pre-validatie.
// Daarna gooide `draft.moveAssignment` ("resource … is al toegewezen aan taak …") en rolde de HELE
// call terug met `ok=false code=VALIDATION` en een interne `draft.`-tekst — geldige items in dezelfde
// call (bv. een `add`) gingen mee verloren, ook binnen `planner_batch`.
//
// Het gekozen gedrag: net als een dubbele `add` wordt zo'n move ZACHT geweigerd — alleen dat item in
// `itemRejections` ("staat al op taak …"), de rest van de call gaat gewoon door.
//
// Alles loopt via de ECHTE dispatch-weg (`handleMcpMessage` → `tools/call`), zodat de schemapoort en
// de batch-executor meegetest worden.
//
// Testlijst:
//   1. move naar dezelfde taak + geldige add in ÉÉN call ⇒ ok, add toegepast, move zacht geweigerd
//   2. hetzelfde binnen `planner_batch` ⇒ ok, add toegepast, weigering in `rejections`, niets teruggerold
//   3. een gewone move naar een ANDERE taak werkt ongewijzigd
//   4. (bestaand gedrag, vastgepind) move naar een andere taak waar dezelfde resource al staat ⇒ zacht
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';

const store = useAppStore;

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// --- helpers -------------------------------------------------------------------------------------
function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: store.getState().activeDocumentId });
}

/** Roep een tool aan via de ECHTE JSON-RPC-weg en geef het uitgepakte `McpToolResult` terug. */
async function rpc(name: string, args: unknown): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 300)}`);
  return msg.result.structuredContent;
}

function expectOk(res: any): any {
  assert(res && res.ok === true,
    `verwachtte ok=true, kreeg ok=${String(res?.ok)} code=${String(res?.code)} error=${JSON.stringify(res?.error)}`);
  return res.data;
}

function undoLen(): number {
  return store.getState().historyEvents.filter((event) => event.state === 'applied').length;
}

/** Leaf-taak met een expliciete duur (store-actie; buiten de tools om). */
function addTask(name: string): string {
  const id = store.getState().addTask({ name });
  const t = store.getState().tasks.find((x) => x.id === id)!;
  store.getState().updateTask(id, { time: { ...t.time, scheduleDuration: 5 } });
  return id;
}

/** Twee bladtaken, twee resources en één bestaande toewijzing van `r1` op `a`. */
async function fixture(): Promise<{ a: string; b: string; r1: string; r2: string; asg: string }> {
  store.getState().newProject();
  registerAllTools();
  const a = addTask('A');
  const b = addTask('B');
  const r1 = store.getState().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 });
  const r2 = store.getState().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  const data = expectOk(await rpc('planner_manage_assignments', {
    actions: [{ action: 'add', taskId: a, resourceId: r1, unitsPerDay: 1 }],
  }));
  const asg = data.added[0].assignmentId as string;
  assert(typeof asg === 'string' && asg.length > 0, 'testvoorwaarde: de toewijzing bestaat');
  return { a, b, r1, r2, asg };
}

// =================================================================================================
// 1) move naar dezelfde taak + geldige add in één call
// =================================================================================================
test('move naar de taak waar de toewijzing al staat ⇒ zacht geweigerd; add in dezelfde call WEL toegepast', async () => {
  const { a, r1, r2, asg } = await fixture();
  const before = undoLen();

  const res = await rpc('planner_manage_assignments', {
    actions: [
      { action: 'move', assignmentId: asg, taskId: a },
      { action: 'add', taskId: a, resourceId: r2, unitsPerDay: 1 },
    ],
  });
  const data = expectOk(res);

  assertEq(data.added.length, 1, 'de geldige add is toegepast');
  assertEq(data.moved, [], 'de move is niet uitgevoerd');
  const rej: { id: string; reason: string }[] = res.itemRejections ?? [];
  assertEq(rej.length, 1, 'precies één zachte weigering');
  assertEq(rej[0].id, asg, 'de weigering hangt aan het assignmentId');
  assert(/staat al op taak/.test(rej[0].reason), `de reden zegt dat hij al op de taak staat: ${rej[0].reason}`);
  assert(!/draft\./.test(rej[0].reason), 'geen interne draft.-tekst in de reden');

  const asgs = store.getState().assignments;
  assertEq(asgs.find((x) => x.id === asg)!.taskId, a, 'de bestaande toewijzing staat nog op A');
  assertEq(asgs.filter((x) => x.taskId === a && x.resourceId === r1).length, 1, 'geen dubbeltelling van r1 op A');
  assertEq(asgs.filter((x) => x.taskId === a && x.resourceId === r2).length, 1, 'r2 staat op A');
  assertEq(undoLen(), before + 1, 'één undo-stap voor de hele call');
});

// =================================================================================================
// 2) hetzelfde binnen planner_batch
// =================================================================================================
test('planner_batch: move naar dezelfde taak ⇒ zacht geweigerd; add en volgende stap blijven staan', async () => {
  const { a, b, r1, r2, asg } = await fixture();
  const before = undoLen();

  const res = await rpc('planner_batch', {
    steps: [
      {
        tool: 'planner_manage_assignments',
        args: {
          actions: [
            { action: 'move', assignmentId: asg, taskId: a },
            { action: 'add', taskId: a, resourceId: r2, unitsPerDay: 1 },
          ],
        },
      },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'add', taskId: b, resourceId: r2, unitsPerDay: 1 }] } },
    ],
  });
  const data = expectOk(res);

  const reasons = (data.rejections as { id: string; reason: string }[]);
  assertEq(reasons.length, 1, 'precies één deel-weigering in de batch');
  assertEq(reasons[0].id, asg, 'de weigering hangt aan het assignmentId');
  assert(/staat al op taak/.test(reasons[0].reason), `de reden zegt dat hij al op de taak staat: ${reasons[0].reason}`);
  assert(!/draft\./.test(reasons[0].reason), 'geen interne draft.-tekst in de reden');

  const asgs = store.getState().assignments;
  assertEq(asgs.find((x) => x.id === asg)!.taskId, a, 'de bestaande toewijzing staat nog op A');
  assertEq(asgs.filter((x) => x.taskId === a && x.resourceId === r1).length, 1, 'geen dubbeltelling van r1 op A');
  assertEq(asgs.filter((x) => x.taskId === a && x.resourceId === r2).length, 1, 'de add uit stap 1 is toegepast');
  assertEq(asgs.filter((x) => x.taskId === b && x.resourceId === r2).length, 1, 'stap 2 is toegepast');
  assertEq(undoLen(), before + 1, 'de hele batch is één undo-stap');
});

// =================================================================================================
// 3) gewone move naar een andere taak — ongewijzigd
// =================================================================================================
test('move naar een ANDERE taak werkt ongewijzigd', async () => {
  const { a, b, r1, asg } = await fixture();
  const res = await rpc('planner_manage_assignments', {
    actions: [{ action: 'move', assignmentId: asg, taskId: b }],
  });
  const data = expectOk(res);
  assertEq(data.moved, [{ assignmentId: asg, taskId: b }], 'de move is gerapporteerd');
  assertEq(res.itemRejections ?? [], [], 'geen weigering');
  assertEq(store.getState().assignments.find((x) => x.id === asg)!.taskId, b, 'de toewijzing staat op B');
  assertEq(store.getState().tasks.find((t) => t.id === a)!.resourceIds, [], 'resourceIds op A opgeruimd');
  assertEq(store.getState().tasks.find((t) => t.id === b)!.resourceIds, [r1], 'resourceIds op B bijgewerkt');
});

// =================================================================================================
// 4) bestaand gedrag, vastgepind: move naar een andere taak waar dezelfde resource al staat
// =================================================================================================
test('move naar een andere taak waar dezelfde resource al staat ⇒ zacht geweigerd (bestaand gedrag)', async () => {
  const { a, b, r1, r2, asg } = await fixture();
  expectOk(await rpc('planner_manage_assignments', {
    actions: [{ action: 'add', taskId: b, resourceId: r1, unitsPerDay: 1 }],
  }));

  const res = await rpc('planner_manage_assignments', {
    actions: [
      { action: 'move', assignmentId: asg, taskId: b },
      { action: 'add', taskId: a, resourceId: r2, unitsPerDay: 1 },
    ],
  });
  const data = expectOk(res);
  assertEq(data.moved, [], 'de move is niet uitgevoerd');
  assertEq(data.added.length, 1, 'de add in dezelfde call is toegepast');
  const rej: { id: string; reason: string }[] = res.itemRejections ?? [];
  assertEq(rej.length, 1, 'precies één zachte weigering');
  assert(/al toegewezen aan taak/.test(rej[0].reason), `de reden noemt de dubbeltelling: ${rej[0].reason}`);
  assertEq(store.getState().assignments.find((x) => x.id === asg)!.taskId, a, 'de toewijzing staat nog op A');
});

await run();
