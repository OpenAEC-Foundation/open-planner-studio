// BASELINEBEHEER — `src/services/mcp/tools/baselineTools.ts` (list/activate/rename/delete).
//
// Achtergrond: `planner_save_baseline` kon er één maken, en `compare_baseline`/`analyze_delay`
// weigerden zonder actieve baseline met "activeer er een" — terwijl er geen tool bestond om dat te
// doen. Deze suite pint zowel de nieuwe tools vast als de gerepareerde foutmeldingen.
//
// Testlijst:
//   1. list op een leeg document ⇒ count 0 + hint die naar planner_save_baseline wijst
//   2. save → list ⇒ id/naam/taskCount/isActive kloppen met de store
//   3. activate ⇒ verschuift de meetlat; compare_baseline meet daarna tegen de GEKOZEN baseline
//   4. activate van de al-actieve ⇒ changed:false ZONDER undo-stap of gewiste redo-stack
//   5. activate null ⇒ geen actieve; compare_baseline weigert nu NETJES en noemt de nieuwe tools
//   6. activate/rename/delete met onbekend id ⇒ weigering die planner_list_baselines noemt
//   7. rename happy path + lege naam + zelfde naam (no-op) + dubbele naam (warning)
//   8. delete van een NIET-actieve ⇒ actieve blijft staan
//   9. delete van de ACTIEVE met andere over ⇒ terugval, rapport == echte store-staat
//  10. delete van de laatste ⇒ geen actieve; compare_baseline/analyze_delay netjes VALIDATION
//  11. delete onbekend id ⇒ geen undo-stap, niets gewijzigd
//  12. onbekende argumentsleutel ⇒ weigering die de SLEUTEL noemt (tool zelf én schemapoort)
//  13. batch: activate+rename+delete = ÉÉN undo-stap; undo herstelt alles
//  14. batch met onbekend veld / onbekend id ⇒ hele batch teruggedraaid, niets gewijzigd
//  15. IFC-round-trip: meerdere baselines, namen mét apostrof, en de actief-markering
//  16. registratie/tools-list-vorm: vier tools, prefix, description, annotaties, batch-kern
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { baselineTools } from '@/services/mcp/tools/baselineTools';
import { getTool, registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk, McpToolErr } from '@/services/mcp/contracts';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const store = useAppStore;
const S = () => store.getState();

registerAllTools();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry. Eén edit + undo haalt die
// benigne promotie weg uit latere byte-vergelijkingen.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: S().activeDocumentId,
    ...over,
  });
}

async function call(name: string, args: unknown = {}, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  const def = getTool(name);
  assert(!!def, `tool ${name} niet geregistreerd`);
  return await def!.handler(args, ctx);
}

async function callOk(name: string, args: unknown = {}, ctx: McpContext = makeCtx()): Promise<any> {
  const res = await call(name, args, ctx);
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}

async function callErr(name: string, args: unknown = {}, ctx: McpContext = makeCtx()): Promise<McpToolErr> {
  const res = await call(name, args, ctx);
  assert(!res.ok, `tool ${name} had geweigerd moeten worden maar slaagde: ${JSON.stringify((res as McpToolOk).data)}`);
  return res as McpToolErr;
}

/** Vers document met `n` taken van 5 dagen, doorgerekend. */
function reset(n = 3): string[] {
  S().newProject();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = S().addTask({ name: `Taak ${i + 1}` });
    const t = S().tasks.find((x) => x.id === id)!;
    S().updateTask(id, { time: { ...t.time, scheduleDuration: 5 } });
    ids.push(id);
  }
  S().runCPM();
  return ids;
}

/** Sla een baseline op via de bestaande tool en geef zijn id terug. */
async function save(name: string): Promise<string> {
  const data = await callOk('planner_save_baseline', { name });
  return data.baselineId as string;
}

// =================================================================================================
// 1) list op een leeg document — de hint moet naar een BESTAANDE tool wijzen
// =================================================================================================
test('1. list_baselines op een document zonder baselines ⇒ count 0 + bruikbare hint', async () => {
  reset(0);
  const d = await callOk('planner_list_baselines');
  assertEq(d.count, 0, 'geen baselines');
  assertEq(d.baselines, [], 'lege lijst');
  assertEq(d.activeBaselineId, null, 'geen actieve');
  assert(typeof d.hint === 'string' && d.hint.includes('planner_save_baseline'),
    `hint moet planner_save_baseline noemen, kreeg: ${String(d.hint)}`);
});

// =================================================================================================
// 2) save → list: de lijst spiegelt de store
// =================================================================================================
test('2. save_baseline → list_baselines toont id, naam, taskCount en actief-markering', async () => {
  reset(3);
  const id = await save('Nulmeting');
  const d = await callOk('planner_list_baselines');
  assertEq(d.count, 1, 'één baseline');
  assertEq(d.activeBaselineId, id, 'save_baseline activeert direct (bestaand gedrag)');
  const row = d.baselines[0];
  assertEq(row.id, id, 'id klopt');
  assertEq(row.name, 'Nulmeting', 'naam klopt');
  assertEq(row.isActive, true, 'gemarkeerd als actief');
  assertEq(row.taskCount, S().baselines[0].tasks.length, 'taskCount == store');
  assertEq(row.taskCount, 3, 'drie bladtaken vastgelegd');
  assert(typeof row.createdAt === 'string' && row.createdAt.length > 0, 'createdAt gevuld');
  assert(d.hint === undefined, `geen hint nodig, kreeg: ${String(d.hint)}`);
});

// =================================================================================================
// 3) activate verschuift de meetlat van compare_baseline
// =================================================================================================
test('3. activate_baseline maakt de gekozen baseline actief én compare_baseline meet daartegen', async () => {
  reset(2);
  const first = await save('Eerste');
  const second = await save('Tweede');
  assertEq(S().activeBaselineId, second, 'de laatst opgeslagen is actief');

  const d = await callOk('planner_activate_baseline', { baselineId: first });
  assertEq(d.changed, true, 'er is echt iets veranderd');
  assertEq(d.activeBaselineId, first, 'nieuwe actieve gemeld');
  assertEq(d.previousActiveBaselineId, second, 'vorige actieve gemeld');
  assertEq(d.previousActiveBaselineName, 'Tweede', 'vorige naam gemeld');
  assertEq(S().activeBaselineId, first, 'de STORE is echt gewijzigd');

  const cmp = await callOk('planner_compare_baseline');
  assertEq(cmp.baselineId, first, 'compare_baseline meet tegen de geactiveerde baseline');
  assertEq(cmp.baselineName, 'Eerste', 'en noemt zijn naam');
});

// =================================================================================================
// 4) al actief ⇒ changed:false, en GEEN spurious undo-stap / gewiste redo-stack
// =================================================================================================
test('4. activate van de al-actieve baseline ⇒ changed:false zonder undo-stap of redo-wipe', async () => {
  reset(1);
  const id = await save('Enige');
  // Iets ongedaan maken zodat er een redo-stack ligt die een no-op niet mag wissen.
  S().addTask({ name: 'weg' });
  S().undo();
  const undoBefore = S().undoStack.length;
  const redoBefore = S().redoStack.length;
  assert(redoBefore > 0, 'testopzet: er moet een redo-stack liggen');

  const d = await callOk('planner_activate_baseline', { baselineId: id });
  assertEq(d.changed, false, 'niets veranderd');
  assert(typeof d.reason === 'string' && d.reason.length > 0, 'de reden staat erbij');
  assertEq(S().undoStack.length, undoBefore, 'geen extra undo-stap voor een no-op');
  assertEq(S().redoStack.length, redoBefore, 'de redo-stack van de gebruiker blijft intact');
  assertEq(S().activeBaselineId, id, 'de actieve is ongewijzigd');
});

// =================================================================================================
// 5) activate null ⇒ geen actieve; compare_baseline weigert NETJES en wijst naar de nieuwe tools
// =================================================================================================
test('5. activate null ⇒ geen actieve baseline; compare_baseline noemt de tools die wél bestaan', async () => {
  reset(2);
  await save('Nulmeting');
  const d = await callOk('planner_activate_baseline', { baselineId: null });
  assertEq(d.changed, true, 'de actieve is losgelaten');
  assertEq(d.activeBaselineId, null, 'geen actieve meer');
  assertEq(S().activeBaselineId, null, 'store klopt');
  assert(typeof d.note === 'string' && d.note.includes('planner_compare_baseline'), 'de note waarschuwt voor het gevolg');

  const err = await callErr('planner_compare_baseline');
  assertEq(err.code, 'VALIDATION', 'nette VALIDATION, geen crash');
  assert(err.error.includes('planner_activate_baseline'), `fout moet planner_activate_baseline noemen: ${err.error}`);
  assert(err.error.includes('planner_list_baselines'), `fout moet planner_list_baselines noemen: ${err.error}`);

  // En de lijst zelf vertelt wat er nu moet gebeuren.
  const l = await callOk('planner_list_baselines');
  assert(typeof l.hint === 'string' && l.hint.includes('planner_activate_baseline'),
    `hint moet naar activate wijzen: ${String(l.hint)}`);
});

// =================================================================================================
// 6) onbekend id ⇒ weigering die naar planner_list_baselines wijst (alle drie de mutatietools)
// =================================================================================================
test('6. onbekend baselineId ⇒ VALIDATION met verwijzing naar planner_list_baselines', async () => {
  reset(1);
  const id = await save('Echt');
  for (const [tool, args] of [
    ['planner_activate_baseline', { baselineId: 'baseline-bestaat-niet' }],
    ['planner_rename_baseline', { baselineId: 'baseline-bestaat-niet', name: 'X' }],
    ['planner_delete_baseline', { baselineId: 'baseline-bestaat-niet' }],
  ] as const) {
    const err = await callErr(tool, args);
    assertEq(err.code, 'VALIDATION', `${tool}: VALIDATION`);
    assert(err.error.includes('planner_list_baselines'), `${tool} moet naar de lijst-tool wijzen: ${err.error}`);
    assert(err.error.includes('baseline-bestaat-niet'), `${tool} moet het afgewezen id noemen: ${err.error}`);
  }
  assertEq(S().baselines.length, 1, 'er is niets verdwenen');
  assertEq(S().activeBaselineId, id, 'de actieve is ongemoeid');
});

// =================================================================================================
// 7) rename: happy path, lege naam, zelfde naam (no-op), dubbele naam (warning)
// =================================================================================================
test('7. rename_baseline: hernoemt echt, weigert leeg, no-opt op dezelfde naam, waarschuwt bij dubbel', async () => {
  reset(1);
  const a = await save('Oud');
  const d = await callOk('planner_rename_baseline', { baselineId: a, name: 'Nieuw' });
  assertEq(d.changed, true, 'hernoemd');
  assertEq(d.previousName, 'Oud', 'oude naam gemeld');
  assertEq(S().baselines.find((b) => b.id === a)!.name, 'Nieuw', 'de STORE draagt de nieuwe naam');

  const leeg = await callErr('planner_rename_baseline', { baselineId: a, name: '   ' });
  assertEq(leeg.code, 'VALIDATION', 'lege naam geweigerd');
  assert(leeg.error.includes('`name`'), `de weigering noemt het veld: ${leeg.error}`);
  assertEq(S().baselines.find((b) => b.id === a)!.name, 'Nieuw', 'naam ongewijzigd na de weigering');

  const undoBefore = S().undoStack.length;
  const same = await callOk('planner_rename_baseline', { baselineId: a, name: 'Nieuw' });
  assertEq(same.changed, false, 'zelfde naam ⇒ geen wijziging');
  assertEq(S().undoStack.length, undoBefore, 'en dus geen undo-stap');

  const b = await save('Nieuw');
  const dup = await callOk('planner_rename_baseline', { baselineId: b, name: 'Nieuw' });
  // b heette al 'Nieuw' (net opgeslagen onder die naam) ⇒ geen wijziging, maar wél de botsing melden.
  assert(typeof dup.warning === 'string' && dup.warning.includes('Nieuw'), `botsing moet gemeld worden: ${JSON.stringify(dup)}`);
});

// =================================================================================================
// 8) delete van een NIET-actieve baseline laat de actieve staan
// =================================================================================================
test('8. delete_baseline van een niet-actieve ⇒ actieve blijft, telling klopt', async () => {
  reset(2);
  const oud = await save('Oud');
  const nieuw = await save('Nieuw');
  assertEq(S().activeBaselineId, nieuw, 'testopzet: de nieuwe is actief');

  const d = await callOk('planner_delete_baseline', { baselineId: oud });
  assertEq(d.deletedBaselineId, oud, 'gemeld wat er weg is');
  assertEq(d.deletedName, 'Oud', 'met naam');
  assertEq(d.wasActive, false, 'was niet de actieve');
  assertEq(d.activeBaselineId, nieuw, 'actieve ongewijzigd');
  assertEq(d.remainingCount, 1, 'één over');
  assertEq(S().baselines.length, 1, 'store: één over');
  assertEq(S().activeBaselineId, nieuw, 'store: actieve ongewijzigd');
});

// =================================================================================================
// 9) delete van de ACTIEVE met andere over ⇒ terugval, en het rapport klopt met de store
// =================================================================================================
test('9. delete van de ACTIEVE ⇒ terugval op de laatst overgebleven, eerlijk gerapporteerd', async () => {
  reset(2);
  const a = await save('A');
  const b = await save('B');
  await callOk('planner_activate_baseline', { baselineId: a });
  assertEq(S().activeBaselineId, a, 'testopzet: A is actief');

  const d = await callOk('planner_delete_baseline', { baselineId: a });
  assertEq(d.wasActive, true, 'de verwijderde was de actieve');
  assertEq(d.previousActiveBaselineId, a, 'vorige actieve gemeld');
  assertEq(d.activeBaselineId, b, 'terugval op de overgebleven baseline');
  assertEq(d.activeBaselineName, 'B', 'met naam');
  assertEq(d.remainingCount, 1, 'één over');
  assert(typeof d.note === 'string' && d.note.includes('planner_activate_baseline'),
    `de note moet de meetlat-verschuiving uitleggen: ${String(d.note)}`);
  // Het rapport MOET de echte store beschrijven — dat is de les van de delete_tasks-onderrapportage.
  assertEq(S().activeBaselineId, d.activeBaselineId, 'rapport == store (actieve)');
  assertEq(S().baselines.length, d.remainingCount, 'rapport == store (telling)');

  const cmp = await callOk('planner_compare_baseline');
  assertEq(cmp.baselineId, b, 'compare_baseline meet nu tegen de teruggevallen baseline');
});

// =================================================================================================
// 10) delete van de LAATSTE ⇒ geen actieve; de leestools weigeren netjes i.p.v. te crashen
// =================================================================================================
test('10. delete van de laatste baseline ⇒ geen actieve; compare/analyze geven nette VALIDATION', async () => {
  reset(2);
  const enige = await save('Enige');
  const d = await callOk('planner_delete_baseline', { baselineId: enige });
  assertEq(d.wasActive, true, 'was actief');
  assertEq(d.activeBaselineId, null, 'er is er geen meer');
  assertEq(d.remainingCount, 0, 'niets over');
  assert(typeof d.note === 'string' && d.note.includes('planner_save_baseline'),
    `de note moet de weg vooruit noemen: ${String(d.note)}`);
  assertEq(S().baselines.length, 0, 'store leeg');
  assertEq(S().activeBaselineId, null, 'store: geen actieve');

  for (const tool of ['planner_compare_baseline', 'planner_analyze_delay']) {
    const err = await callErr(tool);
    assertEq(err.code, 'VALIDATION', `${tool}: nette VALIDATION, geen INTERNAL/crash`);
    assert(err.error.includes('planner_'), `${tool} moet een bestaande tool noemen: ${err.error}`);
  }
  const err = await callErr('planner_analyze_delay');
  assert(err.error.includes('planner_activate_baseline'), `analyze_delay moet activate noemen: ${err.error}`);

  // Undo brengt de verwijderde baseline terug — één stap.
  S().undo();
  assertEq(S().baselines.length, 1, 'undo herstelt de baseline');
  assertEq(S().activeBaselineId, enige, 'inclusief de actief-markering');
});

// =================================================================================================
// 11) delete met onbekend id ⇒ geen undo-stap, niets gewijzigd
// =================================================================================================
test('11. delete met onbekend id laat geen undo-stap of wijziging achter', async () => {
  reset(1);
  const id = await save('Blijft');
  const undoBefore = S().undoStack.length;
  const err = await callErr('planner_delete_baseline', { baselineId: 'nope' });
  assertEq(err.code, 'VALIDATION', 'VALIDATION');
  assertEq(S().baselines.length, 1, 'niets verwijderd');
  assertEq(S().activeBaselineId, id, 'actieve ongewijzigd');
  assertEq(S().undoStack.length, undoBefore, 'geen achtergebleven undo-stap');
});

// =================================================================================================
// 12) onbekende argumentsleutel ⇒ weigering die de SLEUTEL noemt — door de tool ZELF én de schemapoort
// =================================================================================================
test('12. onbekend argument ⇒ weigering die de sleutel noemt (tool zelf)', async () => {
  reset(1);
  const id = await save('X');
  const cases: [string, Record<string, unknown>, string][] = [
    ['planner_list_baselines', { verbose: true }, 'verbose'],
    ['planner_activate_baseline', { baselineId: id, force: true }, 'force'],
    ['planner_rename_baseline', { baselineId: id, name: 'Y', trim: true }, 'trim'],
    ['planner_delete_baseline', { baselineId: id, cascade: true }, 'cascade'],
  ];
  for (const [tool, args, key] of cases) {
    const err = await callErr(tool, args);
    assertEq(err.code, 'VALIDATION', `${tool}: VALIDATION`);
    assert(err.error.includes(key), `${tool} moet de sleutel '${key}' noemen: ${err.error}`);
  }
  assertEq(S().baselines.find((b) => b.id === id)!.name, 'X', 'geen enkele weigering muteerde iets');
});

test('12b. de schemapoort in de dispatcher weigert dezelfde sleutels (additionalProperties: false)', async () => {
  reset(1);
  const id = await save('X');
  const ctx = makeCtx();
  const raw = await handleMcpMessage(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'planner_delete_baseline', arguments: { baselineId: id, cascade: true } },
  }), ctx);
  const resp = JSON.parse(raw);
  assertEq(resp.result.isError, true, 'de dispatcher weigert');
  const sc = resp.result.structuredContent;
  assertEq(sc.code, 'VALIDATION', 'VALIDATION');
  assert(String(sc.error).includes('cascade'), `de sleutel staat in de fout: ${sc.error}`);
  assertEq(S().baselines.length, 1, 'niets verwijderd');

  // …maar `baselineId: null` MOET door diezelfde poort komen (type: ['string','null']) — anders zou
  // "geen baseline actief" via de echte JSON-RPC-weg onbereikbaar zijn.
  const raw2 = await handleMcpMessage(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'planner_activate_baseline', arguments: { baselineId: null } },
  }), ctx);
  const resp2 = JSON.parse(raw2);
  assertEq(resp2.result.isError, false, `null moet de schemapoort passeren: ${JSON.stringify(resp2.result.structuredContent)}`);
  assertEq(S().activeBaselineId, null, 'en echt landen in de store');
});

test('12c. ontbrekend verplicht veld ⇒ weigering die het veld noemt', async () => {
  reset(1);
  await save('X');
  const a = await callErr('planner_activate_baseline', {});
  assert(a.error.includes('baselineId'), `activate moet baselineId eisen: ${a.error}`);
  const r = await callErr('planner_rename_baseline', { baselineId: S().baselines[0].id });
  assert(r.error.includes('name'), `rename moet name eisen: ${r.error}`);
  const d = await callErr('planner_delete_baseline', {});
  assert(d.error.includes('baselineId'), `delete moet baselineId eisen: ${d.error}`);
});

// =================================================================================================
// 13) planner_batch — dezelfde tools als stap: ÉÉN undo-stap voor het geheel
// =================================================================================================
test('13. batch met activate + rename + delete ⇒ één undo-stap, alles uitgevoerd', async () => {
  reset(2);
  const a = await save('A');
  const b = await save('B');
  const undoBefore = S().undoStack.length;

  const data = await callOk('planner_batch', {
    steps: [
      { tool: 'planner_activate_baseline', args: { baselineId: a } },
      { tool: 'planner_rename_baseline', args: { baselineId: a, name: 'A-hernoemd' } },
      { tool: 'planner_delete_baseline', args: { baselineId: b } },
      { tool: 'planner_list_baselines' },
    ],
  });
  assertEq(data.stepCount, 4, 'vier stappen');
  assertEq(data.steps.every((s: any) => s.status === 'uitgevoerd'), true, `alle stappen uitgevoerd: ${JSON.stringify(data.steps)}`);
  assertEq(S().baselines.length, 1, 'B is weg');
  assertEq(S().baselines[0].name, 'A-hernoemd', 'A is hernoemd');
  assertEq(S().activeBaselineId, a, 'A is actief');
  assertEq(S().undoStack.length, undoBefore + 1, 'precies ÉÉN undo-stap voor de hele batch');

  // De slot-leesstap ziet de eindtoestand.
  const last = data.substeps[data.substeps.length - 1];
  assert(String(last.resultJson).includes('A-hernoemd'), `de leesstap ziet de nieuwe naam: ${last.resultJson}`);

  S().undo();
  assertEq(S().baselines.length, 2, 'undo brengt B terug');
  assertEq(S().baselines.find((x) => x.id === a)!.name, 'A', 'en de oude naam');
  assertEq(S().activeBaselineId, b, 'en de oude actieve');
});

test('14. batch met een onbekende sleutel of een onbekend id rolt ALLES terug', async () => {
  reset(2);
  const a = await save('A');
  await save('B');
  await callOk('planner_activate_baseline', { baselineId: a });
  const before = JSON.stringify({ b: S().baselines, act: S().activeBaselineId });
  const undoBefore = S().undoStack.length;

  const bad = await callErr('planner_batch', {
    steps: [
      { tool: 'planner_rename_baseline', args: { baselineId: a, name: 'Zou-niet-mogen' } },
      { tool: 'planner_delete_baseline', args: { baselineId: a, cascade: true } },
    ],
  });
  assertEq(bad.code, 'VALIDATION', 'schemafout in stap 2');
  assert(bad.error.includes('cascade'), `de sleutel wordt genoemd: ${bad.error}`);
  assertEq(JSON.stringify({ b: S().baselines, act: S().activeBaselineId }), before, 'stap 1 is teruggedraaid');
  assertEq(S().undoStack.length, undoBefore, 'geen undo-stap na een teruggedraaide batch');

  const bad2 = await callErr('planner_batch', {
    steps: [
      { tool: 'planner_rename_baseline', args: { baselineId: a, name: 'Zou-niet-mogen' } },
      { tool: 'planner_activate_baseline', args: { baselineId: 'bestaat-niet' } },
    ],
  });
  assertEq(bad2.code, 'VALIDATION', 'onbekend id in stap 2');
  assert(bad2.error.includes('planner_list_baselines'), `ook binnen een batch wijst de fout de weg: ${bad2.error}`);
  assertEq(JSON.stringify({ b: S().baselines, act: S().activeBaselineId }), before, 'niets gewijzigd');
});

test('14b. save_baseline blijft uitgesloten van planner_batch (ongewijzigd spec-gedrag)', async () => {
  reset(1);
  const err = await callErr('planner_batch', { steps: [{ tool: 'planner_save_baseline', args: { name: 'X' } }] });
  assertEq(err.code, 'VALIDATION', 'uitgesloten');
  assert(err.error.includes('save_baseline'), `de melding noemt de tool: ${err.error}`);
});

// =================================================================================================
// 15) IFC-ROUND-TRIP — IFC is het native formaat: wat de tools beheren moet het bestand overleven
// =================================================================================================
test('15. baselines (meerdere, namen met apostrof) + actief-markering overleven writeIFC→readIFC', async () => {
  reset(3);
  const a = await save("Nulmeting 'A', v2");
  const b = await save('Tweede meting');
  await callOk('planner_activate_baseline', { baselineId: a });

  const ifc = writeIFC(buildWriteIFCInput(S()));
  const back = readIFC(ifc);
  assertEq(back.baselines?.length, 2, 'beide baselines komen terug');
  assertEq(back.baselines?.map((x) => x.name), ["Nulmeting 'A', v2", 'Tweede meting'], 'namen (incl. apostrof/komma) intact');
  assertEq(back.baselines?.map((x) => x.id), [a, b], "id's intact");
  assertEq(back.activeBaselineId, a, 'de actief-markering overleeft de round-trip');
  assertEq(back.baselines?.[0].tasks.length, 3, 'de vastgelegde taken komen mee');
  assertEq(back.baselines?.[0].projectEnd, S().baselines[0].projectEnd, 'projecteinde intact');
  assertEq(back.baselines?.[0].projectDuration, S().baselines[0].projectDuration, 'projectduur intact');
});

test('15b. "geen actieve baseline" round-trippt óók (activate null blijft null na herladen)', async () => {
  reset(2);
  await save('Eén');
  await callOk('planner_activate_baseline', { baselineId: null });
  const back = readIFC(writeIFC(buildWriteIFCInput(S())));
  assertEq(back.baselines?.length, 1, 'de baseline blijft bestaan');
  assertEq(back.activeBaselineId, null, 'en er is nog steeds geen actieve');
});

// =================================================================================================
// 16) Registratie + tools/list-vorm
// =================================================================================================
test('16. vier baselinetools: prefix, description, vier annotaties, batch-kern waar nodig', async () => {
  registerAllTools();
  assertEq(baselineTools.length, 4, 'vier tools in de module');
  const names = baselineTools.map((t) => t.name);
  assertEq(names, [
    'planner_list_baselines',
    'planner_activate_baseline',
    'planner_rename_baseline',
    'planner_delete_baseline',
  ], 'namen + volgorde');

  for (const t of baselineTools) {
    assert(t.name.startsWith('planner_'), `${t.name}: prefix`);
    assert(t.description.trim().length > 40, `${t.name}: een description waarop de AI kan kiezen`);
    // Sleutel-lijst `as const` ⇒ indexeert `McpToolAnnotations` rechtstreeks; de oude cast naar
    // `Record<string, unknown>` was onmogelijk (geen index-signatuur) en verloor bovendien de
    // koppeling met het type: een hernoemde hint zou hier stil als `undefined` doorlopen.
    for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
      assertEq(typeof t.annotations[k], 'boolean', `${t.name}: annotatie ${k}`);
    }
    assertEq(t.batchable, true, `${t.name}: batchable`);
    assert(!!getTool(t.name), `${t.name} is geregistreerd`);
    const schema = t.inputSchema as any;
    assertEq(schema.additionalProperties, false, `${t.name}: schema sluit onbekende sleutels uit`);
    if (t.kind === 'mutate') {
      assert(typeof (t as any).batchStep === 'function', `${t.name}: synchrone batch-kern aanwezig`);
    }
  }
  assertEq(getTool('planner_list_baselines')!.annotations.readOnlyHint, true, 'list is een leestool');
  assertEq(getTool('planner_delete_baseline')!.annotations.destructiveHint, true, 'delete is eerlijk destructief');
  assertEq(getTool('planner_activate_baseline')!.annotations.readOnlyHint, false, 'activate muteert');
});

// =================================================================================================
// 17) Veiligheidsvlaggen — ook het no-op-snelpad staat achter de guards
//
// Het `okDirect`-pad omzeilt `runMutateTool` (en daarmee zijn guards); zonder de expliciete
// `guardNonTransactional` ervoor zou een gepauzeerde of alleen-lezen bridge een "geslaagde" mutatie-
// call beantwoorden. Dat is precies het soort gat dat je pas merkt als het te laat is.
// =================================================================================================
test('17. pauze / alleen-lezen weigeren zowel de echte mutatie als het no-op-snelpad', async () => {
  reset(1);
  const a = await save('A');
  const b = await save('B'); // B is actief ⇒ activate(B) is het no-op-pad, activate(A) het mutatie-pad

  for (const flag of ['paused', 'readOnly'] as const) {
    const ctx = makeCtx({ [flag]: true } as McpContextOverrides);
    const noop = await callErr('planner_activate_baseline', { baselineId: b }, ctx);
    assertEq(noop.code, flag === 'paused' ? 'PAUSED' : 'READ_ONLY', `${flag}: no-op-pad geweigerd`);
    const mut = await callErr('planner_activate_baseline', { baselineId: a }, ctx);
    assertEq(mut.code, flag === 'paused' ? 'PAUSED' : 'READ_ONLY', `${flag}: mutatie-pad geweigerd`);
    const del = await callErr('planner_delete_baseline', { baselineId: a }, ctx);
    assertEq(del.code, flag === 'paused' ? 'PAUSED' : 'READ_ONLY', `${flag}: delete geweigerd`);
    const ren = await callErr('planner_rename_baseline', { baselineId: b, name: 'B' }, ctx);
    assertEq(ren.code, flag === 'paused' ? 'PAUSED' : 'READ_ONLY', `${flag}: rename-no-op geweigerd`);
  }
  assertEq(S().baselines.length, 2, 'niets verwijderd');
  assertEq(S().activeBaselineId, b, 'niets geactiveerd');

  // Lezen mag wél tijdens pauze/alleen-lezen (spec: die vlaggen raken alleen mutaties).
  const l = await callOk('planner_list_baselines', {}, makeCtx({ paused: true, readOnly: true }));
  assertEq(l.count, 2, 'list_baselines blijft beschikbaar');
});

await run();
