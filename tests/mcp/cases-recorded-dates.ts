import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import { runInMcpTransaction, draft } from '@/state/mcpTransaction';
import { readIFC } from '@/services/ifc/ifcReader';
import { externIfc } from '../fixtures/recordedDatesIfc';
import { createAppStoreContext } from '@/state/appStore';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const store = useAppStore;
const S = () => store.getState();

function callOk(name: string, args: unknown = {}): any {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} niet geregistreerd`);
  const res = tool!.handler(args, makeMcpContext(appStoreContext)) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

S().addTask({ name: 'warmup' });
S().undo();

function enterMode(tag: string): { aId: string; bId: string } {
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc(tag)), { filePath: null, recompute: true });
  return {
    aId: S().tasks.find((t) => t.wbsCode === '1.1')!.id,
    bId: S().tasks.find((t) => t.wbsCode === '1.2')!.id,
  };
}

test('get_critical_path: opgeslagen datums geven onbekende driving, F5 herstelt de berekende keten', () => {
  S().newProject();
  const source = readIFC(externIfc('mcp-driving-unknown'));
  source.recordedFields ??= {};
  for (const task of source.tasks) {
    task.time.totalFloat = 0;
    task.time.isCritical = true;
    source.recordedFields[task.id] = [...(source.recordedFields[task.id] ?? []), 'totalFloat', 'isCritical'];
  }
  S().applyLoadedProject(source, { filePath: null, recompute: true });
  const before = S();
  const aId = before.tasks.find(t => t.wbsCode === '1.1')!.id;
  const bId = before.tasks.find(t => t.wbsCode === '1.2')!.id;
  assertEq(before.datesAsRecorded, true, 'opzet: opgeslagen datums actief');
  assertEq(before.cpmResult?.drivingUnknown, true, 'opzet: reconstructie kent driving niet');
  const result = getTool('planner_get_critical_path')!.handler({}, makeMcpContext(appStoreContext)) as McpToolResult;
  assert(result.ok, 'lezen hoort te slagen');
  const okResult = result as McpToolOk;
  const data = okResult.data as Record<string, unknown>;
  assertEq(before.cpmResult!.criticalPath.length, 2, 'opzet: beide taken zijn vastgelegd als kritiek');
  assertEq(data.hasResult, true, 'de opgeslagen planningsuitkomst blijft beschikbaar');
  assertEq(data.drivingRelations, null, 'geen driving-informatie is null, geen lege lijst');
  assert(typeof data.note === 'string' && /unknown/.test(data.note), 'respons legt onbekende driving uit');
  assertEq(data.projectEnd, before.cpmResult!.projectEnd, 'projecteinde uit het bestand blijft beschikbaar');
  assertEq((data.criticalTasks as Array<{ id: string }>).map(t => t.id), before.cpmResult!.criticalPath,
    'opgeslagen kritieke taken blijven beschikbaar');
  assertEq(okResult.envelope.datesAsRecorded, true, 'envelop meldt de modus');
  assertEq(okResult.envelope.scheduleRecalculated, undefined, 'lezen rekent niet stil door');
  assert(S().cpmResult === before.cpmResult, 'resultaat niet vervangen door lezen');
  assert(S().tasks === before.tasks, 'taken en opgeslagen datums niet vervangen door lezen');
  assert(S().recordedDates === before.recordedDates, 'vastlegging niet vervangen door lezen');
  assert(S().historyEvents === before.historyEvents, 'historie niet vervangen door lezen');
  assertEq([S().datesAsRecorded, S().scheduleStale, S().isDirty], [true, false, before.isDirty],
    'modus, versheid en dirty blijven gelijk');

  S().runCPM();
  const calculated = callOk('planner_get_critical_path');
  assertEq(S().datesAsRecorded, false, 'F5 verlaat de modus');
  assertEq(calculated.drivingRelations.map((rel: { predId: string; succId: string }) => [rel.predId, rel.succId]),
    [[aId, bId]], 'bestaande berekende driving-keten blijft intact');
  assertEq(calculated.note, undefined, 'geen onbekend-melding bij bekende driving');
});

test('MCP-transactie in de modus: één undo-stap, niet twee (K1)', () => {
  const { bId } = enterMode('m1');
  assertEq(S().datesAsRecorded, true, 'voorwaarde: de modus hoort aan te staan');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16T07:00',
    'voorwaarde: b hoort de OPGESLAGEN datum te tonen');
  const before = S().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'via AI' }); });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, before + 1, 'één transactie-snapshot (bulk = één undo-stap), óók in de modus');
  assertEq(S().datesAsRecorded, false, 'de eindherberekening hoort de modus te verlaten');
  assertEq(S().recordedDates, null, 'de vastlegging hoort gewist te zijn');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-09T07:00',
    'b hoort op zijn herberekende datum te staan');
});

test('MCP-transactie in de modus: één undo herstelt modus, datums én de nieuwe taak (claim a)', () => {
  const { bId } = enterMode('m2');
  const before = S().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'via AI 2' }); });
  assert(res.ok, 'transactie hoort te slagen');
  assert(S().tasks.some((t) => t.name === 'via AI 2'), 'voorwaarde: de taak hoort te bestaan');

  S().undo();

  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, before, 'de undo-stack hoort terug op zijn oude diepte te staan');
  assertEq(S().datesAsRecorded, true, 'undo hoort de modus te herstellen');
  assert(S().recordedDates !== null, 'undo hoort de vastlegging te herstellen');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, '2026-03-16T07:00',
    'undo hoort de opgeslagen datum te herstellen');
  assert(!S().tasks.some((t) => t.name === 'via AI 2'),
    'diezelfde ene undo hoort de AI-taak te verwijderen — geen half-uitgevoerde transactie');
});

test('MCP-transactie met kringverwijzing in de modus: rollback laat de stacks onaangeroerd (K2)', () => {
  const { aId, bId } = enterMode('m3');
  const before = S().historyEvents.filter(event => event.state === 'applied').length;
  const beforeStart = S().tasks.find((t) => t.id === bId)!.time.earlyStart;

  const res = runInMcpTransaction(() => {
    draft.addSequence({ predecessorId: bId, successorId: aId, type: 'FINISH_START', lagDays: 0 });
  });

  assert(!res.ok, 'een kringverwijzing hoort de transactie te laten falen');
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, before, 'undoStack onaangeroerd na rollback — geen fantoom-undo-stap');
  assertEq(S().datesAsRecorded, true, 'de rollback hoort de modus terug te zetten');
  assert(S().recordedDates !== null, 'de rollback hoort de vastlegging terug te zetten');
  assertEq(S().tasks.find((t) => t.id === bId)!.time.earlyStart, beforeStart,
    'de rollback hoort de opgeslagen datum terug te zetten');
});

test('MCP-transactie buiten de modus: onveranderd één undo-stap', () => {
  S().newProject();
  assertEq(S().datesAsRecorded, false, 'voorwaarde: de modus hoort uit te staan');
  const before = S().historyEvents.filter(event => event.state === 'applied').length;

  const res = runInMcpTransaction(() => { draft.addTask({ name: 'gewoon' }); });

  assert(res.ok, 'transactie hoort te slagen');
  assertEq(S().historyEvents.filter(event => event.state === 'applied').length, before + 1, 'onveranderd: één undo-stap');
});

test('contextfactory B verlaat recorded-dates met één B-undo en laat A buiten beeld', () => {
  const A = createAppStoreContext();
  const B = createAppStoreContext();
  B.store.getState().applyLoadedProject(readIFC(externIfc('factory-B')), { filePath: null, recompute: true });
  assertEq(B.store.getState().datesAsRecorded, true, 'opzet: B opent in de modus');
  const bId = B.store.getState().tasks.find((task) => task.wbsCode === '1.2')!.id;
  const aTakenVoor = A.store.getState().tasks.length;
  const aUndoVoor = historyDepthsForActiveScope(A.store.getState()).undoDepth;
  const bUndoVoor = historyDepthsForActiveScope(B.store.getState()).undoDepth;
  const txB = createMcpTransactions(B);

  const result = txB.run(() => txB.draft.addTask({ name: 'factory-B-in-recorded-mode' }));

  assert(result.ok, 'de contextgebonden transactie hoort in recorded-dates-modus te slagen');
  assertEq(historyDepthsForActiveScope(B.store.getState()).undoDepth, bUndoVoor + 1,
    'modus verlaten plus B-mutatie hoort samen precies één B-undo te zijn');
  assertEq(B.store.getState().datesAsRecorded, false, 'alleen B hoort zijn recorded-dates-modus te verlaten');
  assertEq(B.store.getState().tasks.find((task) => task.id === bId)!.time.earlyStart, '2026-03-09T07:00',
    'B hoort op zijn herberekende datum te staan');
  assertEq(A.store.getState().tasks.length, aTakenVoor, 'A-taken horen onaangeroerd te blijven');
  assertEq(historyDepthsForActiveScope(A.store.getState()).undoDepth, aUndoVoor,
    'A-undo hoort onaangeroerd te blijven');
});

test('leestools in de modus: niet-vastgelegde assen komen als null naar buiten (bevinding 6)', () => {
  const { bId } = enterMode('mcp-unrecorded');
  assertEq(S().datesAsRecorded, true, 'voorwaarde: de modus hoort aan te staan');
  const detail = callOk('planner_get_task', { taskId: bId });
  const schedule = detail.schedule as Record<string, unknown>;
  assertEq(schedule.earlyStart, '2026-03-16T07:00', 'de VASTGELEGDE vroege start hoort er gewoon te staan');
  assertEq(schedule.lateStart, null, 'niet-vastgelegde late start hoort null te zijn, geen rec.start-terugval');
  assertEq(schedule.lateFinish, null, 'niet-vastgelegde late finish hoort null te zijn');
  assertEq(schedule.totalFloat, null, 'niet-vastgelegde totale speling hoort null te zijn, geen verzonnen 0');
  assertEq(schedule.freeFloat, null, 'niet-vastgelegde vrije speling hoort null te zijn');
  assertEq(schedule.isCritical, null, 'niet-vastgelegde kritiek-vlag hoort null te zijn, geen verzonnen false');
  assertEq(schedule.datesAsRecordedUnrecordedFields,
    ['lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical'],
    'de respons benoemt expliciet WELKE assen het bestand niet vastlegde');
});

test('leestools buiten de modus: byte-identiek aan voorheen (geen null, geen extra veld)', () => {
  const { bId } = enterMode('mcp-unrecorded-off');
  S().runCPM();
  assertEq(S().datesAsRecorded, false, 'voorwaarde: de modus hoort uit te staan');
  const schedule = callOk('planner_get_task', { taskId: bId }).schedule as Record<string, unknown>;
  assert(typeof schedule.totalFloat === 'number', 'buiten de modus hoort de BEREKENDE speling er te staan');
  assert(typeof schedule.lateStart === 'string', 'buiten de modus hoort de BEREKENDE late start er te staan');
  assertEq(schedule.datesAsRecordedUnrecordedFields, undefined,
    'buiten de modus hoort de respons geen extra veld te dragen');
});

test('leestools in de modus: kritiek is onbekend, geen verzonnen false (bevinding 10)', () => {
  const { aId, bId } = enterMode('mcp-crit-unknown');
  assertEq(S().datesAsRecorded, true, 'voorwaarde: de modus hoort aan te staan');
  const info = callOk('planner_get_project_info');
  assertEq(info.statistics.criticalTasks, 0, 'geen enkele taak mag als kritiek geteld worden op een `?? false`');
  assertEq(info.statistics.criticalUnrecordedTasks, 2, 'beide taken hebben een onbekende kritiekas, apart geteld');
  const overview = callOk('planner_get_project_overview');
  const rows = (overview.tasks ?? overview.rows ?? []) as Array<Record<string, unknown>>;
  const byId = new Map(rows.map((row) => [row.id, row]));
  assertEq(byId.get(aId)?.crit, null, 'overzicht: onbekende kritiekas is null, niet weggelaten');
  assertEq(byId.get(bId)?.crit, null, 'overzicht: idem voor de tweede taak');
  const all = callOk('planner_list_tasks', {});
  const listed = (all.tasks ?? all.items ?? []) as Array<Record<string, unknown>>;
  assertEq(listed.length, 2, 'zonder filter: beide taken');
  assertEq(listed.every((row) => row.crit === null), true, 'lijst: onbekende kritiekas is null');
  const crit = callOk('planner_list_tasks', { kritiek: true });
  const notCrit = callOk('planner_list_tasks', { kritiek: false });
  assertEq(((crit.tasks ?? crit.items ?? []) as unknown[]).length, 0, 'filter kritiek=true: onbekend hoort bij geen van beide');
  assertEq(((notCrit.tasks ?? notCrit.items ?? []) as unknown[]).length, 0, 'filter kritiek=false: onbekend hoort bij geen van beide');

  S().runCPM();
  const infoOff = callOk('planner_get_project_info');
  assertEq(infoOff.statistics.criticalUnrecordedTasks, undefined, 'buiten de modus: geen extra veld');
  assert(typeof infoOff.statistics.criticalTasks === 'number' && infoOff.statistics.criticalTasks >= 1,
    'buiten de modus: de BEREKENDE kritieke taken tellen gewoon mee');
  const rowsOff = ((callOk('planner_get_project_overview').tasks ?? []) as Array<Record<string, unknown>>);
  assertEq(rowsOff.every((row) => row.crit === true || row.crit === undefined), true, 'buiten de modus: crit is true of afwezig, nooit null');
});

test('mislukte MCP-transactie herstelt "ongewijzigd sinds import" zoals het vóór de transactie was', () => {
  S().newProject();
  S().applyLoadedProject(readIFC(externIfc('m-pristine')), { filePath: null, recompute: true });
  assertEq([S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, false],
    'voorwaarde: verse import in de modus, vlag aan, niet vuil');

  const res = runInMcpTransaction(() => {
    draft.addTask({ name: 'wordt teruggedraaid' });
    throw new Error('opzettelijk mislukt');
  });

  assert(!res.ok, 'transactie hoort te falen');
  assertEq([S().datesAsRecorded, S().importPristine, S().isDirty], [true, true, false],
    'na de rollback: modus, vlag en dirty exact zoals vóór de transactie');
});


{
  const COST = 'cost-leges';
  function costMode(tag: string) {
    S().newProject();
    const parsed = readIFC(externIfc(tag));
    parsed.resources.push({ id: COST, name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
    parsed.resources.push({ id: 'work-x', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
    S().applyLoadedProject(parsed, { filePath: null, recompute: true });
    assert(S().datesAsRecorded, `${tag}: voorwaarde, datums zoals opgeslagen`);
    return {
      aId: S().tasks.find((t) => t.wbsCode === '1.1')!.id,
      bId: S().tasks.find((t) => t.wbsCode === '1.2')!.id,
    };
  }
  const stand = () => ({
    mode: S().datesAsRecorded,
    starts: S().tasks.map((t) => t.time.earlyStart),
    end: S().cpmResult?.projectEnd ?? null,
  });
  async function manage(actions: unknown[]) {
    const res = await getTool('planner_manage_assignments')!.handler({ actions }, makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId })) as McpToolResult;
    assert(res.ok && ((res as McpToolOk).itemRejections ?? []).length === 0, `manage_assignments: ${JSON.stringify(res)}`);
  }
  const costOn = (taskId: string) => S().assignments.find((a) => a.taskId === taskId && a.resourceId === COST);

  test('kostenresource via MCP in de modus: toevoegen, bedrag, verplaatsen, verwijderen en wissen houden de datums', async () => {
    const { aId, bId } = costMode('mcp-cost-routes');
    const before = stand();
    await manage([{ action: 'add', taskId: bId, resourceId: COST, costAmount: 1250 }]);
    assertEq(stand(), before, 'add');
    await manage([{ action: 'update', assignmentId: costOn(bId)!.id, costAmount: 99 }]);
    assertEq(stand(), before, 'update bedrag');
    await manage([{ action: 'move', assignmentId: costOn(bId)!.id, taskId: aId }]);
    assertEq(stand(), before, 'move');
    await manage([{ action: 'remove', assignmentId: costOn(aId)!.id }]);
    assertEq(stand(), before, 'remove');
    await manage([{ action: 'add', taskId: bId, resourceId: COST, costAmount: 5 }]);
    const del = await getTool('planner_manage_resources')!.handler(
      { actions: [{ action: 'delete', id: COST, cascade: true }] },
      makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId }),
    ) as McpToolResult;
    assert(del.ok, `delete cascade: ${JSON.stringify(del)}`);
    assertEq(stand(), before, 'delete cascade');
  });

  test('kostenresource via de store in de modus: toevoegen, bedrag, verplaatsen, verwijderen en wissen houden de datums', () => {
    const { aId, bId } = costMode('store-cost-routes');
    const before = stand();
    S().assignResource(bId, COST, 1, undefined, 1250);
    assertEq(stand(), before, 'add');
    S().setAssignmentCost(costOn(bId)!.id, 99);
    assertEq(stand(), before, 'bedrag');
    S().moveAssignment(costOn(bId)!.id, aId);
    assertEq(stand(), before, 'move');
    S().unassignResource(costOn(aId)!.id);
    assertEq(stand(), before, 'remove');
    S().assignResource(bId, COST, 1, undefined, 5);
    S().removeResource(COST);
    assertEq(stand(), before, 'purge');
  });

  test('contrast: een werkresource via MCP in de modus blijft datumrelevant', async () => {
    const { bId } = costMode('mcp-work-contrast');
    await manage([{ action: 'add', taskId: bId, resourceId: 'work-x', unitsPerDay: 1 }]);
    assertEq(S().datesAsRecorded, false, 'een werktoewijzing verlaat de modus (ongewijzigd gedrag)');
  });

  test('planner_batch: COST naar werk en toewijzen verlaat de modus, kosten wissen met cascade niet', async () => {
    const batch = async (steps: unknown[]) => {
      const res = await getTool('planner_batch')!.handler({ steps }, makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId })) as McpToolResult;
      assert(res.ok, `planner_batch: ${JSON.stringify(res)}`);
    };
    const { bId } = costMode('batch-cost-to-work');
    await batch([
      { tool: 'planner_manage_resources', args: { actions: [{ action: 'update', id: COST, type: 'LABOR' }] } },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'add', taskId: bId, resourceId: COST, unitsPerDay: 1 }] } },
    ]);
    assertEq(S().resources.find((r) => r.id === COST)?.type, 'LABOR', 'voorwaarde: de typewissel lukte');
    assertEq(S().datesAsRecorded, false, 'een werktoewijzing na de typewissel verlaat de modus');

    const { bId: b2 } = costMode('batch-cost-cascade');
    await manage([{ action: 'add', taskId: b2, resourceId: COST, costAmount: 5 }]);
    const before = stand();
    await batch([
      { tool: 'planner_manage_resources', args: { actions: [{ action: 'delete', id: COST, cascade: true }] } },
    ]);
    assertEq(stand(), before, 'kosten wissen met cascade in een batch houdt de datums');
  });
}

await run();
