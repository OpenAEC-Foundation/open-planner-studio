// Audit-bevindingen K3/K4/K5/M1/H1/H2/L3 — STILLE FAALGEVALLEN in de taak- en relatietools.
//
// Gemene deler: de tool antwoordde `ok` terwijl er niets (of iets anders) gebeurde. Dat is de ergste
// bug die deze bridge kan hebben — een AI-agent kan er niet omheen werken, want de tool liegt dat het
// gelukt is. Deze suite pint elk geval vast op de HANDLER-weg (dus óók geldig binnen `planner_batch`,
// waar de dispatcher-schemapoort uit `cases-schemavalidatie.ts` niet langskomt).
//
//   K3  update_tasks.progress was schemaloos: `{ percent: 50 }` ⇒ ok + `updated:['t1']`, taak op 0%.
//   K4  add_dependencies: een niet-numerieke `lag` werd STIL 0.
//   K5  undo/redo meldden `ok` op een LEGE stack — drie identieke ok's, nul effect.
//   M1  delete_tasks onderrapporteerde de cascade en weigerde een al-gecascadeerd id.
//   H1  de leeskant geeft `FS`/`SS`/`FF`/`SF`; de schrijfkant eiste FINISH_START.
//   H2  de leeskant geeft lag als string (`"+2d"`, `"+50%"`); de schrijfkant eiste een number.
//   L3  move_task gooide een niet-numerieke `position` stil weg.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';

const store = useAppStore;

function reset(): void {
  store.getState().newProject();
}

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
  });
}

async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = taskTools.find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, makeCtx());
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}
function taskById(id: string) {
  return store.getState().tasks.find((t) => t.id === id);
}

// =================================================================================================
// K3 — `progress` heeft nu een allowlist (was: onbekende sleutel ⇒ ok + niets gebeurd)
// =================================================================================================
test('K3: progress { percent: 50 } ⇒ ZACHTE weigering met hint, NIET in `updated`, taak blijft 0%', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-percent' });
  store.getState().setProject({ statusDate: '2027-01-01' });

  const res = await call('planner_update_tasks', { updates: [{ id, progress: { percent: 50 } }] });
  const data = okData(res);
  assertEq(data.updated, [], 'de taak mag NIET als bijgewerkt worden gerapporteerd');
  assertEq(rejections(res).length, 1, 'precies één zachte weigering');
  const reason = rejections(res)[0].reason;
  assert(reason.includes('percent'), `de weigering noemt de sleutel: ${reason}`);
  assert(reason.includes('completion'), `de weigering wijst de juiste sleutel aan: ${reason}`);
  assertEq(taskById(id)!.time.completion, 0, 'de voortgang staat nog steeds op 0');
});

test('K3: leeg progress-object ⇒ weigering (was: touchesProgress=false ⇒ applied=true)', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-leeg' });
  store.getState().setProject({ statusDate: '2027-01-01' });

  const res = await call('planner_update_tasks', { updates: [{ id, progress: {} }] });
  assertEq(okData(res).updated, [], 'niets bijgewerkt');
  assertEq(rejections(res).length, 1, 'één weigering');
  assert(/leeg|minstens/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('K3: leeg progress-object omzeilt de STATUSDATUM-guard niet meer', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-geen-statusdatum' });
  // GEEN statusdatum: elk voortgangspad hoort geweigerd te worden.
  const res = await call('planner_update_tasks', { updates: [{ id, progress: {} }] });
  assertEq(okData(res).updated, [], 'niets bijgewerkt');
  assertEq(rejections(res).length, 1, 'één weigering');
});

test('K3: geldige progress-sleutels blijven gewoon werken (geen regressie)', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-goed' });
  store.getState().runCPM();
  store.getState().setProject({ statusDate: '2027-01-01' });

  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 40 } }] });
  assertEq(okData(res).updated, [id], 'de taak is bijgewerkt');
  assertEq(rejections(res).length, 0, 'geen weigeringen');
  assertEq(taskById(id)!.time.completion, 0.4, 'completion 40% ⇒ 0.4');
});

test('K3: actualStart als null blijft de WIS-vorm (geen valse weigering)', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-wis' });
  store.getState().runCPM();
  store.getState().setProject({ statusDate: '2027-01-01' });
  await call('planner_update_tasks', { updates: [{ id, progress: { completion: 40 } }] });
  assert(taskById(id)!.time.actualStart, 'actualStart is afgeleid');

  const res = await call('planner_update_tasks', { updates: [{ id, progress: { completion: 0, actualStart: null } }] });
  assertEq(rejections(res), [], `null moet de wis-vorm blijven, kreeg: ${JSON.stringify(rejections(res))}`);
  assertEq(okData(res).updated, [id], 'wissen telt als update');
});

test('K3: onzin-datum in progress ⇒ weigering met reden (geen stille verdamping)', async () => {
  reset();
  const id = store.getState().addTask({ name: 'k3-datum' });
  store.getState().setProject({ statusDate: '2027-01-01' });
  const res = await call('planner_update_tasks', { updates: [{ id, progress: { actualStart: 'gisteren' } }] });
  assertEq(okData(res).updated, [], 'niets bijgewerkt');
  assert(/ISO-datum/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

// =================================================================================================
// K4 + H2 — lag: nooit meer stil 0
// =================================================================================================
async function twoTasks(): Promise<[string, string]> {
  reset();
  const a = store.getState().addTask({ name: 'A' });
  const b = store.getState().addTask({ name: 'B' });
  return [a, b];
}

test('K4: lag "5" (numerieke string) ⇒ lag 5, niet stil 0', async () => {
  const [a, b] = await twoTasks();
  const res = await call('planner_add_dependencies', {
    dependencies: [{ predecessorId: a, successorId: b, type: 'FINISH_START', lag: '5' }],
  });
  assertEq(okData(res).added.length, 1, 'relatie toegevoegd');
  assertEq(store.getState().sequences[0].lagDays, 5, 'de lag is ECHT 5 (was stil 0)');
});

test('H2: leeskant-lagvormen "+2d" / "-1d" / "2d" worden omgezet', async () => {
  for (const [input, expect] of [['+2d', 2], ['-1d', -1], ['2d', 2]] as [string, number][]) {
    const [a, b] = await twoTasks();
    const res = await call('planner_add_dependencies', {
      dependencies: [{ predecessorId: a, successorId: b, type: 'FS', lag: input }],
    });
    assertEq(okData(res).added.length, 1, `${input}: relatie toegevoegd`);
    assertEq(store.getState().sequences[0].lagDays, expect, `${input} ⇒ lagDays ${expect}`);
  }
});

// H2 (HERZIEN bij planner_update_dependencies): procent-lag was de énige leeskant-vorm die de
// schrijfkant niet sprak, en werd daarom expliciet geweigerd — een gedocumenteerd gat, geen
// eindstation. Nu de gedeelde relatie-veldlaag (`sequenceFields.ts`) hem kent, is de eerlijke uitkomst
// niet "nette weigering" maar "hij landt echt".
test('H2: procent-lag "+50%" wordt GEZET als lagPercent (leeskant-vorm is nu terugschrijfbaar)', async () => {
  const [a, b] = await twoTasks();
  const res = await call('planner_add_dependencies', {
    dependencies: [{ predecessorId: a, successorId: b, type: 'FS', lag: '+50%' }],
  });
  assertEq(okData(res).added.length, 1, 'relatie toegevoegd');
  assertEq(store.getState().sequences[0].lagPercent, 50, 'lagPercent is echt 50');
  assertEq(store.getState().sequences[0].lagDays, 0, 'dag-lag blijft 0 (procent sluit dagen uit)');
});

test('K4: onzin-lag ("morgen", true, {}) ⇒ zachte weigering per item', async () => {
  // Bewust de LANGE typenotatie: zo is de lag de ENIGE mogelijke weigeringsgrond en kan deze test
  // niet per ongeluk om de verkeerde reden slagen.
  for (const bad of ['morgen', true, {}] as unknown[]) {
    const [a, b] = await twoTasks();
    const res = await call('planner_add_dependencies', {
      dependencies: [{ predecessorId: a, successorId: b, type: 'FINISH_START', lag: bad }],
    });
    assertEq(okData(res).added, [], `${JSON.stringify(bad)}: niets toegevoegd`);
    assertEq(store.getState().sequences.length, 0, `${JSON.stringify(bad)}: store blijft leeg`);
    assertEq(rejections(res).length, 1, `${JSON.stringify(bad)}: één weigering`);
  }
});

test('K4: lag weglaten blijft 0 (default ongewijzigd)', async () => {
  const [a, b] = await twoTasks();
  const res = await call('planner_add_dependencies', { dependencies: [{ predecessorId: a, successorId: b, type: 'FS' }] });
  assertEq(okData(res).added.length, 1, 'relatie toegevoegd');
  assertEq(store.getState().sequences[0].lagDays, 0, 'default 0');
});

// =================================================================================================
// H1 — korte relatietypes van de leeskant
// =================================================================================================
test('H1: de KORTE typenotatie van de leeskant (FS/SS/FF/SF) wordt geaccepteerd en vertaald', async () => {
  const pairs: [string, string][] = [
    ['FS', 'FINISH_START'],
    ['SS', 'START_START'],
    ['FF', 'FINISH_FINISH'],
    ['SF', 'START_FINISH'],
  ];
  for (const [short, long] of pairs) {
    const [a, b] = await twoTasks();
    const res = await call('planner_add_dependencies', { dependencies: [{ predecessorId: a, successorId: b, type: short }] });
    assertEq(okData(res).added.length, 1, `${short}: relatie toegevoegd`);
    assertEq(store.getState().sequences[0].type, long, `${short} ⇒ ${long}`);
  }
});

test('H1: dedup werkt over de NOTATIEGRENS heen (FS na FINISH_START is een duplicaat)', async () => {
  const [a, b] = await twoTasks();
  await call('planner_add_dependencies', { dependencies: [{ predecessorId: a, successorId: b, type: 'FINISH_START' }] });
  const res = await call('planner_add_dependencies', { dependencies: [{ predecessorId: a, successorId: b, type: 'FS' }] });
  assertEq(okData(res).added, [], 'geen tweede relatie');
  assertEq(store.getState().sequences.length, 1, 'nog steeds één relatie');
  assert(/bestond al/.test(rejections(res)[0].reason), `reden: ${rejections(res)[0].reason}`);
});

test('H1: een écht onbekend type blijft geweigerd, mét de geldige verzameling in de reden', async () => {
  const [a, b] = await twoTasks();
  const res = await call('planner_add_dependencies', { dependencies: [{ predecessorId: a, successorId: b, type: 'XX' }] });
  assertEq(okData(res).added, [], 'niets toegevoegd');
  const reason = rejections(res)[0].reason;
  assert(reason.includes('FINISH_START') && reason.includes('FS'), `reden noemt beide notaties: ${reason}`);
});

// =================================================================================================
// K5 — undo/redo op een lege stack
// =================================================================================================
test('K5: undo op een LEGE stack ⇒ ok maar `undone: false` + reden', async () => {
  reset();
  // newProject zet een verse store neer; leeg de stacks expliciet zodat de precondities hard staan.
  store.setState((s) => { s.undoStack = []; s.redoStack = []; });
  const res = await call('planner_undo', {});
  const data = okData(res);
  assertEq(data.undone, false, 'niets teruggedraaid');
  assertEq(data.undoDepth, 0, 'undoDepth 0');
  assert(typeof data.reason === 'string' && data.reason.length > 0, 'er staat een reden bij');
});

test('K5: redo op een LEGE stack ⇒ ok maar `redone: false`', async () => {
  reset();
  store.setState((s) => { s.undoStack = []; s.redoStack = []; });
  const data = okData(await call('planner_redo', {}));
  assertEq(data.redone, false, 'niets opnieuw uitgevoerd');
  assertEq(data.redoDepth, 0, 'redoDepth 0');
});

test('K5: drie undo\'s op één mutatie ⇒ true, false, false (was: 3× identiek ok)', async () => {
  reset();
  store.setState((s) => { s.undoStack = []; s.redoStack = []; });
  await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-u', name: 'undo-doel' }] });
  assertEq(store.getState().tasks.length, 1, 'één taak aangemaakt');

  const first = okData(await call('planner_undo', {}));
  assertEq(first.undone, true, 'de eerste undo landde');
  assertEq(store.getState().tasks.length, 0, 'de taak is weg');
  assertEq(okData(await call('planner_undo', {})).undone, false, 'de tweede undo had niets te doen');
  assertEq(okData(await call('planner_undo', {})).undone, false, 'de derde undo ook niet');
});

test('K5: undo rapporteert de resterende stackdiepte van BEIDE stacks', async () => {
  reset();
  store.setState((s) => { s.undoStack = []; s.redoStack = []; });
  await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-d1', name: 'd1' }] });
  await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-d2', name: 'd2' }] });
  const data = okData(await call('planner_undo', {}));
  assertEq(data.undone, true, 'teruggedraaid');
  assertEq(data.undoDepth, 1, 'nog één stap terug beschikbaar');
  assertEq(data.redoDepth, 1, 'en één stap vooruit');
});

// =================================================================================================
// M1 — delete_tasks: cascade eerlijk rapporteren
// =================================================================================================
test('M1: een verzameltaak wissen rapporteert de VOLLEDIGE cascade, niet alleen het gevraagde id', async () => {
  reset();
  const parent = store.getState().addTask({ name: 'ouder' });
  const kid1 = store.getState().addTask({ name: 'kind1', parentId: parent });
  const kid2 = store.getState().addTask({ name: 'kind2', parentId: parent });
  const grand = store.getState().addTask({ name: 'kleinkind', parentId: kid1 });
  const outsider = store.getState().addTask({ name: 'buitenstaander' });
  // kid2 (niet kid1): kid1 heeft zelf een kind (`grand`) en is dus een verzameltaak. Een
  // verzameltaak-eindpunt is sinds 2026-08-15 op zich geen weigergrond meer (relationRules.ts,
  // `isAncestorRelation`), maar kid1→outsider zou hier ALSNOG geen bruikbare fixture zijn geweest:
  // de cascade-telling hieronder is onafhankelijk van welk kind de relatie draagt, dus kid2 (een
  // gewoon blad, geen bijzonderheden) houdt deze test simpel.
  store.getState().addSequence({ predecessorId: kid2, successorId: outsider, type: 'FINISH_START', lagDays: 0 });

  const data = okData(await call('planner_delete_tasks', { ids: [parent] }));
  assertEq(data.deleted, [parent], '`deleted` blijft de gevraagde id\'s');
  assertEq(data.deletedTaskCount, 4, 'er zijn ECHT vier taken weg (ouder + 2 kinderen + kleinkind)');
  assertEq([...data.deletedTaskIds].sort(), [parent, kid1, kid2, grand].sort(), 'alle verwijderde id\'s worden gemeld');
  assertEq([...data.cascadedTaskIds].sort(), [kid1, kid2, grand].sort(), 'de niet-gevraagde meegewiste taken staan apart');
  assertEq(data.removedDependencyCount, 1, 'de meegewiste relatie wordt geteld');
  assertEq(store.getState().tasks.length, 1, 'alleen de buitenstaander blijft over');
});

test('M1: ouder ÉN kind in dezelfde ids-array ⇒ beide succes, geen "bestaat niet"-weigering', async () => {
  reset();
  const parent = store.getState().addTask({ name: 'ouder' });
  const kid = store.getState().addTask({ name: 'kind', parentId: parent });

  const res = await call('planner_delete_tasks', { ids: [parent, kid] });
  const data = okData(res);
  assertEq(rejections(res), [], 'een volstrekt redelijk verzoek levert GEEN weigering meer op');
  assertEq([...data.deleted].sort(), [parent, kid].sort(), 'beide gevraagde id\'s tellen als verwijderd');
  assertEq(data.deletedTaskCount, 2, 'twee taken echt weg');
  assertEq(store.getState().tasks.length, 0, 'de boom is leeg');
});

test('M1: hetzelfde id tweemaal in `ids` ⇒ één keer in het rapport, geen weigering', async () => {
  reset();
  const a = store.getState().addTask({ name: 'dubbel' });
  const res = await call('planner_delete_tasks', { ids: [a, a] });
  assertEq(okData(res).deleted, [a], 'geen dubbele vermelding');
  assertEq(okData(res).deletedTaskCount, 1, 'één taak echt weg');
  assertEq(rejections(res), [], 'een dubbel id is geen weigering');
});

test('M1: een id dat NOOIT bestond blijft een zachte weigering', async () => {
  reset();
  const a = store.getState().addTask({ name: 'echt' });
  const res = await call('planner_delete_tasks', { ids: [a, 'bestaat-niet'] });
  assertEq(okData(res).deleted, [a], 'alleen het bestaande id');
  assertEq(rejections(res).length, 1, 'één weigering');
  assert(rejections(res)[0].id === 'bestaat-niet', 'de weigering noemt het onbekende id');
});

test('M1: toewijzingen van de subboom worden geteld', async () => {
  reset();
  const parent = store.getState().addTask({ name: 'ouder' });
  const kid = store.getState().addTask({ name: 'kind', parentId: parent });
  const rid = store.getState().addResource({ name: 'R', maxUnits: 1 } as any);
  store.getState().assignResource(kid, rid, 1);

  const data = okData(await call('planner_delete_tasks', { ids: [parent] }));
  assertEq(data.removedAssignmentCount, 1, 'de meegewiste toewijzing wordt geteld');
});

// =================================================================================================
// L3 — move_task position
// =================================================================================================
test('L3: move_task met een niet-numerieke `position` ⇒ VALIDATION, niet stil genegeerd', async () => {
  reset();
  const a = store.getState().addTask({ name: 'a' });
  const res = await call('planner_move_task', { id: a, newParentId: null, position: 'abc' });
  assertEq(res.ok, false, 'de call wordt geweigerd');
  assertEq((res as any).code, 'VALIDATION', 'code VALIDATION');
  assert(/position/.test((res as any).error), `de fout noemt het veld: ${(res as any).error}`);
});

test('L3: een geldige `position` blijft gewoon werken (en klemt stil)', async () => {
  reset();
  const p = store.getState().addTask({ name: 'ouder' });
  const k1 = store.getState().addTask({ name: 'k1', parentId: p });
  store.getState().addTask({ name: 'k2', parentId: p });
  const los = store.getState().addTask({ name: 'los' });

  okData(await call('planner_move_task', { id: los, newParentId: p, position: 0 }));
  assertEq(store.getState().tasks.find((t) => t.id === p)!.childIds[0], los, 'op index 0 ingevoegd');
  // Ver buiten bereik ⇒ stille klem naar het einde (gedocumenteerd gedrag, blijft ongewijzigd).
  okData(await call('planner_move_task', { id: k1, newParentId: p, position: 99 }));
  const kids = store.getState().tasks.find((t) => t.id === p)!.childIds;
  assertEq(kids[kids.length - 1], k1, 'geklemd naar de laatste positie');
});

await run();
