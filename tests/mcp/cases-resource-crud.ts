// RESOURCEBEHEER — `planner_manage_resources` (src/services/mcp/tools/resourceTools.ts).
//
// Het gat dat deze tool dicht: de bridge kon resources lezen, toewijzen en nivelleren, maar er was
// geen enkele manier om er één AAN TE MAKEN, te hernoemen, te verwijderen of zijn capaciteit/tarief/
// kalender/beschikbaarheid te wijzigen. "Zet er een tweede kraan bij" liep dood op
// `manage_assignments`' `resource '<id>' bestaat niet`.
//
// Draait headless tegen de ECHTE Zustand-store (via de harness), net als cases-mutate-cal-res.ts.
//
// Testlijst:
//   1. create ⇒ resource bestaat; list_resources spiegelt ELK geschreven veld terug (leeskant↔schrijfkant)
//   2. bulk (2× create + update) ⇒ precies ÉÉN undo-stap; één undo draait alles terug
//   3. hernoemen + capaciteit/tarief wijzigen
//   4. `null` WIST een optioneel veld; een lege availabilitySteps-lijst wist de stappen
//   5. update zónder velden ⇒ zachte weigering (nooit `ok` zonder effect)
//   6. onbekend id ⇒ zachte weigering + lege-batch-snelpad (geen undo-snapshot, redo intact)
//   7. onbekende SLEUTEL ⇒ weigering die de sleutel NOEMT
//   8. onbekend `type` / ongeldige `maxUnits` ⇒ weigering die de geldige waarden noemt
//   9. delete mét toewijzingen ZONDER cascade ⇒ zachte weigering met het exacte aantal; niets weg
//  10. delete mét `cascade: true` ⇒ resource + toewijzingen weg, task.resourceIds schoon, exact rapport
//  11. delete van een CREW ⇒ leden verliezen hun parentId, gerapporteerd
//  12. parentId-guards: onbekend, niet-CREW, zichzelf
//  13. unitOfMeasure alleen op MATERIAL
//  14. planner_batch: create met tempId → manage_assignments met diezelfde tempId ⇒ toewijzing landt
//  15. planner_batch: dezelfde per-item-weigeringen gelden ook via een draaiboek
//  16. schemapoort (dispatcher): onbekende TOP-LEVEL sleutel ⇒ VALIDATION vóór enige mutatie
//  17. IFC-round-trip: elk schrijfbaar veld overleeft opslaan + herladen
//  18. tooldefinitie-vorm: prefix, description, vier annotaties, batchable + batchStep
import { useAppStore, test, assert, assertEq, run } from './harness';
import { resourceTools } from '@/services/mcp/tools/resourceTools';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { readTools } from '@/services/mcp/tools/readTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const store = useAppStore;

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry (syncProjectCalendar §9.1).
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// --- helpers -------------------------------------------------------------------------------------
function reset(): void {
  store.getState().newProject();
}

function makeCtx(overrides: Partial<McpContext> = {}): McpContext {
  return {
    expectedDocId: store.getState().activeDocumentId,
    tempIdMap: new Map<string, string>(),
    paused: false,
    readOnly: false,
    ensureBackup: async () => null,
    ...overrides,
  };
}

const ALL_DEFS = [...resourceTools, ...calendarResourceTools, ...readTools, ...batchTools];
function tool(name: string) {
  const def = ALL_DEFS.find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return def;
}
async function call(name: string, args: unknown, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  return await tool(name).handler(args, ctx);
}
function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}
/** Eén weigeringsreden; faalt als er niet exact één is. */
function soleReason(res: McpToolResult): string {
  const r = rejections(res);
  assertEq(r.length, 1, `verwachtte precies één weigering, kreeg ${JSON.stringify(r)}`);
  return r[0].reason;
}
/** Maak één resource aan via de tool en geef het echte id terug. */
async function makeResource(fields: Record<string, unknown>): Promise<string> {
  const data = okData(await call('planner_manage_resources', { actions: [{ action: 'create', ...fields }] }));
  return data.resources[0].id as string;
}
/** Voeg een blad-taak met een duur toe (store-actie, buiten de tools om). */
function addTask(name: string, durationDays = 5): string {
  const id = store.getState().addTask({ name });
  const t = store.getState().tasks.find((x) => x.id === id)!;
  store.getState().updateTask(id, { time: { ...t.time, scheduleDuration: durationDays } });
  return id;
}

// =================================================================================================
// 1) create ⇒ de leeskant spiegelt ELK geschreven veld terug
// =================================================================================================
test('create: alle schrijfbare velden landen en komen 1-op-1 terug uit list_resources', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const calId = store.getState().project.calendarId;

  const crewId = await makeResource({ name: 'Ploeg A', type: 'CREW' });
  const createRes = await call('planner_manage_resources', {
    actions: [{
      action: 'create',
      tempId: 'tmp-kraan',
      name: 'Torenkraan 2',
      type: 'EQUIPMENT',
      description: 'Tweede kraan, oostzijde',
      maxUnits: 2,
      costPerHour: 87.5,
      calendarId: calId,
      parentId: crewId,
      availabilitySteps: [{ from: '2026-09-01', maxUnits: 1 }, { from: '2026-07-01', maxUnits: 2 }],
    }],
  });
  const data = okData(createRes);
  assertEq(rejections(createRes), [], 'geen weigeringen verwacht');
  assertEq(data.resources.length, 1, 'precies één resource aangemaakt');
  const id = data.resources[0].id as string;
  assertEq(data.created['tmp-kraan'], id, '`created` draagt de tempId→echt-id-map (batch-contract)');

  const res = store.getState().resources.find((r) => r.id === id)!;
  assertEq(res.name, 'Torenkraan 2', 'naam');
  assertEq(res.type, 'EQUIPMENT', 'type');
  assertEq(res.description, 'Tweede kraan, oostzijde', 'description');
  assertEq(res.maxUnits, 2, 'maxUnits');
  assertEq(res.costPerHour, 87.5, 'costPerHour');
  assertEq(res.calendarId, calId, 'calendarId');
  assertEq(res.parentId, crewId, 'parentId');
  assertEq(res.availabilitySteps, [{ from: '2026-07-01', maxUnits: 2 }, { from: '2026-09-01', maxUnits: 1 }],
    'availabilitySteps chronologisch gesorteerd opgeslagen');

  // LEESKANT ↔ SCHRIJFKANT: precies deze veldnamen komen terug uit de leestool.
  const list = okData(await call('planner_list_resources', {}));
  const row = list.resources.find((r: any) => r.id === id);
  assert(row, 'de nieuwe resource staat in list_resources');
  for (const key of ['name', 'type', 'maxUnits', 'costPerHour', 'calendarId', 'description', 'parentId', 'availabilitySteps']) {
    assert(key in row, `list_resources geeft \`${key}\` terug (schrijfkant spreekt de leeskant)`);
  }
  assertEq(row.availabilitySteps, res.availabilitySteps, 'availabilitySteps identiek gelezen');
  assertEq(row.parentId, crewId, 'parentId identiek gelezen');
});

// =================================================================================================
// 2) bulk ⇒ ÉÉN undo-stap
// =================================================================================================
test('bulk: 2× create + 1 update = precies één undo-stap; één undo draait alles terug', async () => {
  reset();
  const bestaand = await makeResource({ name: 'Betonploeg' });
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const data = okData(await call('planner_manage_resources', {
    actions: [
      { action: 'create', name: 'Kraan 1', type: 'EQUIPMENT' },
      { action: 'create', name: 'Kraan 2', type: 'EQUIPMENT', maxUnits: 3 },
      { action: 'update', id: bestaand, name: 'Betonploeg Noord' },
    ],
  }));
  assertEq(data.resources.length, 2, 'twee aangemaakt');
  assertEq(data.updated.length, 1, 'één gewijzigd');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'bulk over 3 acties = precies één undo-stap');
  assertEq(store.getState().resources.length, 3, 'drie resources');

  store.getState().undo();
  assertEq(store.getState().resources.length, 1, 'één undo verwijdert BEIDE nieuwe resources');
  assertEq(store.getState().resources[0].name, 'Betonploeg', 'en draait de hernoeming terug');
});

// =================================================================================================
// 3) hernoemen + capaciteit/tarief
// =================================================================================================
test('update: hernoemen en capaciteit/tarief wijzigen', async () => {
  reset();
  const id = await makeResource({ name: 'Kraan', type: 'EQUIPMENT', maxUnits: 1, costPerHour: 50 });
  const data = okData(await call('planner_manage_resources', {
    actions: [{ action: 'update', id, name: 'Torenkraan', maxUnits: 4, costPerHour: 120 }],
  }));
  assertEq(data.updated[0].changedFields.sort(), ['costPerHour', 'maxUnits', 'name'], 'de gewijzigde velden worden benoemd');
  const r = store.getState().resources.find((x) => x.id === id)!;
  assertEq([r.name, r.maxUnits, r.costPerHour], ['Torenkraan', 4, 120], 'alle drie de waarden staan in de store');
});

// =================================================================================================
// 4) `null` wist een optioneel veld
// =================================================================================================
test('update: `null` WIST een optioneel veld (en laat de sleutel niet als undefined achter)', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const calId = store.getState().project.calendarId;
  const crew = await makeResource({ name: 'Ploeg', type: 'CREW' });
  const id = await makeResource({
    name: 'Metselaar', costPerHour: 45, calendarId: calId, parentId: crew,
    availabilitySteps: [{ from: '2026-05-01', maxUnits: 2 }],
  });
  okData(await call('planner_manage_resources', {
    actions: [{ action: 'update', id, costPerHour: null, calendarId: null, parentId: null, availabilitySteps: [] }],
  }));
  const r = store.getState().resources.find((x) => x.id === id)! as unknown as Record<string, unknown>;
  for (const key of ['costPerHour', 'calendarId', 'parentId', 'availabilitySteps']) {
    assert(!(key in r), `\`${key}\` is ECHT weg (geen sleutel-met-undefined; dat houdt de IFC-round-trip schoon)`);
  }
});

// =================================================================================================
// 5) update zonder velden ⇒ zachte weigering
// =================================================================================================
test('update zonder velden ⇒ zachte weigering (nooit `ok` zonder effect)', async () => {
  reset();
  const id = await makeResource({ name: 'Timmerman' });
  const res = await call('planner_manage_resources', { actions: [{ action: 'update', id }] });
  const reason = soleReason(res);
  assert(reason.includes('geen wijzigingen'), `de reden benoemt het lege effect: ${reason}`);
  assert(reason.includes('maxUnits'), `de reden noemt de bruikbare velden: ${reason}`);
  assertEq(okData(res).updated, [], 'niets als gewijzigd gerapporteerd');
});

// =================================================================================================
// 6) onbekend id ⇒ weigering + lege-batch-snelpad
// =================================================================================================
test('onbekend id ⇒ zachte weigering; nul uitvoerbare items betreedt GEEN transactie', async () => {
  reset();
  addTask('A');
  store.getState().updateTask(store.getState().tasks[0].id, { name: 'A2' }); // vult de undo-stack
  store.getState().undo();
  const redoLen = store.getState().historyEvents.filter(event => event.state === 'undone').length;
  assert(redoLen > 0, 'er staat iets op de redo-stack (voorwaarde van deze test)');
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = await call('planner_manage_resources', { actions: [{ action: 'update', id: 'res-bestaat-niet', name: 'X' }] });
  const reason = soleReason(res);
  assert(reason.includes('res-bestaat-niet'), `de reden noemt het id: ${reason}`);
  assert(reason.includes('planner_list_resources'), `de reden noemt het alternatief: ${reason}`);
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'geen spurious undo-snapshot');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'undone').length, redoLen, 'de redo-stack van de gebruiker blijft intact');
});

// =================================================================================================
// 7) onbekende SLEUTEL ⇒ weigering die de sleutel noemt
// =================================================================================================
test('onbekende sleutel ⇒ weigering die de SLEUTEL noemt én het alternatief opsomt', async () => {
  reset();
  const id = await makeResource({ name: 'Kraan', type: 'EQUIPMENT' });
  const res = await call('planner_manage_resources', {
    actions: [{ action: 'update', id, capacity: 4 }],
  });
  const reason = soleReason(res);
  assert(reason.includes('`capacity`'), `de reden noemt de foute sleutel: ${reason}`);
  assert(reason.includes('maxUnits'), `de reden noemt het juiste veld: ${reason}`);
  assertEq(store.getState().resources.find((r) => r.id === id)!.maxUnits, 1, 'er is niets stil gewijzigd');

  // Ook bij `create`, en met de juiste opsomming voor die actie.
  const res2 = await call('planner_manage_resources', { actions: [{ action: 'create', name: 'X', units: 2 }] });
  assert(soleReason(res2).includes('`units`'), 'ook create weigert een onbekende sleutel bij naam');
  assertEq(store.getState().resources.length, 1, 'er is geen resource aangemaakt');
});

// =================================================================================================
// 8) ongeldige waarden ⇒ weigering die het domein noemt
// =================================================================================================
test('onbekend `type` en ongeldige `maxUnits` worden zacht geweigerd, met het geldige domein erbij', async () => {
  reset();
  const res = await call('planner_manage_resources', {
    actions: [
      { action: 'create', name: 'Fout type', type: 'equipment' },
      { action: 'create', name: 'Fout maxUnits', maxUnits: 0 },
      { action: 'create', name: 'Goed' },
    ],
  });
  const r = rejections(res);
  assertEq(r.length, 2, `twee weigeringen verwacht, kreeg ${JSON.stringify(r)}`);
  assert(r[0].reason.includes('EQUIPMENT'), `het type-domein staat erbij: ${r[0].reason}`);
  assert(r[0].reason.includes('hoofdlettergevoelig'), `en dat het hoofdlettergevoelig is: ${r[0].reason}`);
  assert(r[1].reason.includes('> 0'), `de maxUnits-regel staat erbij: ${r[1].reason}`);
  // ZACHTE weigering: het geldige item is gewoon aangemaakt.
  assertEq(store.getState().resources.map((x) => x.name), ['Goed'], 'één rot item rolt de bulk niet terug');
});

// =================================================================================================
// 9) delete mét toewijzingen ZONDER cascade ⇒ weigering met het exacte aantal
// =================================================================================================
test('delete van een resource mét toewijzingen wordt zonder `cascade` zacht geweigerd', async () => {
  reset();
  const t1 = addTask('Storten');
  const t2 = addTask('Vlinderen');
  const id = await makeResource({ name: 'Betonpomp', type: 'EQUIPMENT' });
  okData(await call('planner_manage_assignments', {
    actions: [
      { action: 'add', taskId: t1, resourceId: id, unitsPerDay: 1 },
      { action: 'add', taskId: t2, resourceId: id, unitsPerDay: 1 },
    ],
  }));
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = await call('planner_manage_resources', { actions: [{ action: 'delete', id }] });
  const reason = soleReason(res);
  assert(reason.includes('2 toewijzing'), `het exacte aantal toewijzingen staat erin: ${reason}`);
  assert(reason.includes('2 taak/taken'), `en het aantal taken: ${reason}`);
  assert(reason.includes('cascade: true'), `de weg vooruit staat erin: ${reason}`);
  assertEq(store.getState().resources.length, 1, 'de resource staat er nog');
  assertEq(store.getState().assignments.length, 2, 'de toewijzingen staan er nog');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'en er is geen undo-stap verbruikt');
});

// =================================================================================================
// 10) delete mét cascade ⇒ exact voor/na-rapport
// =================================================================================================
test('delete met `cascade: true` ⇒ toewijzingen weg, task.resourceIds schoon, VOLLEDIG rapport', async () => {
  reset();
  const t1 = addTask('Storten');
  const t2 = addTask('Vlinderen');
  const id = await makeResource({ name: 'Betonpomp', type: 'EQUIPMENT' });
  const asg = okData(await call('planner_manage_assignments', {
    actions: [
      { action: 'add', taskId: t1, resourceId: id, unitsPerDay: 1 },
      { action: 'add', taskId: t2, resourceId: id, unitsPerDay: 2 },
    ],
  }));
  const asgIds: string[] = asg.added.map((a: any) => a.assignmentId);

  const res = await call('planner_manage_resources', { actions: [{ action: 'delete', id, cascade: true }] });
  const data = okData(res);
  assertEq(rejections(res), [], 'geen weigeringen');
  const row = data.deleted[0];
  assertEq(row.id, id, 'het verwijderde id');
  assertEq(row.name, 'Betonpomp', 'de naam van de verdwenen resource staat erbij');
  assertEq(row.removedAssignmentIds.sort(), asgIds.sort(), 'ELKE meegewiste toewijzing wordt bij id gerapporteerd');
  assertEq(row.removedAssignmentCount, 2, 'het aantal klopt');
  assertEq(row.affectedTaskIds.sort(), [t1, t2].sort(), 'de geraakte taken worden benoemd');
  assertEq(data.removedAssignmentCount, 2, 'en het totaal over de hele call');

  assertEq(store.getState().resources.length, 0, 'de resource is weg');
  assertEq(store.getState().assignments.length, 0, 'de toewijzingen zijn weg');
  for (const t of store.getState().tasks) {
    assertEq(t.resourceIds, [], `task.resourceIds van '${t.name}' is opgeruimd (geen verweesde verwijzing)`);
  }
  assert((data.warnings as string[]).some((w) => w.includes('MEE verwijderd')),
    `de respons WAARSCHUWT over het meegewiste werk: ${JSON.stringify(data.warnings)}`);
});

// =================================================================================================
// 11) delete van een CREW ⇒ leden verliezen hun lidmaatschap, en dat wordt gemeld
// =================================================================================================
test('delete van een CREW ⇒ leden raken hun parentId kwijt en dat staat in het rapport', async () => {
  reset();
  const crew = await makeResource({ name: 'Ploeg A', type: 'CREW' });
  const lid1 = await makeResource({ name: 'Metselaar 1', parentId: crew });
  const lid2 = await makeResource({ name: 'Metselaar 2', parentId: crew });

  const res = await call('planner_manage_resources', { actions: [{ action: 'delete', id: crew }] });
  const data = okData(res);
  assertEq(data.deleted[0].orphanedCrewMemberIds.sort(), [lid1, lid2].sort(), 'beide leden worden gemeld');
  for (const id of [lid1, lid2]) {
    const r = store.getState().resources.find((x) => x.id === id)! as unknown as Record<string, unknown>;
    assert(!('parentId' in r), 'het lidmaatschap is ECHT verwijderd');
  }
  assert((data.warnings as string[]).some((w) => w.includes('ploeg-lidmaatschap')),
    `er staat een waarschuwing over de verweesde leden: ${JSON.stringify(data.warnings)}`);
});

// =================================================================================================
// 12) parentId-guards
// =================================================================================================
test('parentId: onbekend, niet-CREW en zichzelf worden alle drie zacht geweigerd', async () => {
  reset();
  const gewoon = await makeResource({ name: 'Metselaar' });
  const zelf = await makeResource({ name: 'Ploeg B', type: 'CREW' });

  const res = await call('planner_manage_resources', {
    actions: [
      { action: 'update', id: gewoon, parentId: 'res-bestaat-niet' },
      { action: 'update', id: gewoon, parentId: gewoon },
      { action: 'update', id: zelf, parentId: zelf },
    ],
  });
  const r = rejections(res);
  assertEq(r.length, 3, `drie weigeringen verwacht, kreeg ${JSON.stringify(r)}`);
  assert(r[0].reason.includes('bestaat niet'), `onbekende ploeg: ${r[0].reason}`);
  assert(r[1].reason.includes('CREW'), `niet-CREW-ploeg: ${r[1].reason}`);
  assert(r[2].reason.includes('eigen ploeg'), `zelf-ouderschap: ${r[2].reason}`);
});

// =================================================================================================
// 13) unitOfMeasure alleen op MATERIAL (spiegelt het resourcepaneel, waar het veld dan uit staat)
// =================================================================================================
test('unitOfMeasure geldt alleen voor MATERIAL — óók wanneer het type in dezelfde actie meeverandert', async () => {
  reset();
  const id = await makeResource({ name: 'Zand', type: 'LABOR' });
  const bad = await call('planner_manage_resources', { actions: [{ action: 'update', id, unitOfMeasure: 'm3' }] });
  assert(soleReason(bad).includes('MATERIAL'), 'de reden noemt de regel');

  // Type + eenheid in ÉÉN actie moet wél kunnen: de check kijkt naar het RESULTERENDE type.
  okData(await call('planner_manage_resources', {
    actions: [{ action: 'update', id, type: 'MATERIAL', unitOfMeasure: 'm3' }],
  }));
  assertEq(store.getState().resources.find((r) => r.id === id)!.unitOfMeasure, 'm3', 'de eenheid staat er');
});

// =================================================================================================
// 14) planner_batch — create met tempId, daarna toewijzen met diezelfde tempId
// =================================================================================================
test('planner_batch: nieuwe resource aanmaken en in de VOLGENDE stap toewijzen via de tempId', async () => {
  reset();
  registerAllTools();
  const taskId = addTask('Hijsen');
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_manage_resources', args: { actions: [{ action: 'create', tempId: 'tmp-kraan2', name: 'Kraan 2', type: 'EQUIPMENT', maxUnits: 1 }] } },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'add', taskId, resourceId: 'tmp-kraan2', unitsPerDay: 1 }] } },
    ],
  });
  okData(res);
  const created = store.getState().resources.find((r) => r.name === 'Kraan 2');
  assert(created, 'de resource is aangemaakt');
  assertEq(store.getState().assignments.length, 1, 'er is één toewijzing');
  assertEq(store.getState().assignments[0].resourceId, created!.id, 'de tempId is naar het ECHTE resource-id vertaald');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'de hele batch is één undo-stap');
});

// =================================================================================================
// 15) planner_batch — de validaties gelden óók via een draaiboek (geen omweg om de poort)
// =================================================================================================
test('planner_batch: onbekende sleutel en onbekend id worden ook binnen een batch geweigerd', async () => {
  reset();
  registerAllTools();
  const id = await makeResource({ name: 'Kraan', type: 'EQUIPMENT' });
  const res = await call('planner_batch', {
    steps: [
      { tool: 'planner_manage_resources', args: { actions: [{ action: 'update', id, capacity: 9 }] } },
      { tool: 'planner_manage_resources', args: { actions: [{ action: 'delete', id: 'res-nope' }] } },
    ],
  });
  const data = okData(res);
  const reasons = (data.rejections as { reason: string }[]).map((x) => x.reason).join(' | ');
  assert(reasons.includes('`capacity`'), `de onbekende sleutel wordt ook in de batch bij naam geweigerd: ${reasons}`);
  assert(reasons.includes('res-nope'), `en het onbekende id ook: ${reasons}`);
  assertEq(store.getState().resources.find((r) => r.id === id)!.maxUnits, 1, 'er is niets stil gewijzigd');
});

// =================================================================================================
// 16) schemapoort in de dispatcher
// =================================================================================================
test('schemapoort: een onbekende TOP-LEVEL sleutel wordt vóór enige mutatie afgekeurd', async () => {
  reset();
  registerAllTools();
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'planner_manage_resources', arguments: { actions: [{ action: 'create', name: 'X' }], dryRun: true } },
    }),
    makeCtx(),
  );
  const msg = JSON.parse(raw);
  assertEq(msg.result.isError, true, 'de call moet worden afgekeurd');
  assertEq(msg.result.structuredContent.code, 'VALIDATION', 'met code VALIDATION');
  assert(String(msg.result.structuredContent.error).includes('dryRun'), 'de fout noemt de onbekende sleutel');
  assertEq(store.getState().resources.length, 0, 'en er is niets aangemaakt');
});

// =================================================================================================
// 17) IFC-round-trip — het native formaat mag niets verliezen
// =================================================================================================
test('IFC-round-trip: elk schrijfbaar resourceveld overleeft opslaan + herladen', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  // Een EIGEN bibliotheek-kalender (niet de projectkalender): alleen dán bewijst de round-trip dat
  // `calendarId` echt meegaat i.p.v. terug te vallen op de default.
  const calRes = okData(await call('planner_update_calendar', {
    calendars: [{ id: 'nacht', create: true, name: 'Nachtploeg', hoursPerDay: 6 }],
  }));
  const calId = calRes.calendars[0].id as string;

  const crew = await makeResource({ name: 'Ploeg A', type: 'CREW' });
  await makeResource({
    name: 'Torenkraan', type: 'EQUIPMENT', description: 'Oostzijde',
    maxUnits: 2, costPerHour: 87.5, calendarId: calId, parentId: crew,
    availabilitySteps: [{ from: '2026-07-01', maxUnits: 2 }, { from: '2026-09-01', maxUnits: 1 }],
  });
  await makeResource({ name: 'Zand', type: 'MATERIAL', unitOfMeasure: 'm3', maxUnits: 100 });

  const ifc = writeIFC(buildWriteIFCInput(store.getState() as any));
  const back = readIFC(ifc);

  const kraan = back.resources!.find((r) => r.name === 'Torenkraan')!;
  assert(kraan, 'de kraan komt terug');
  assertEq(kraan.type, 'EQUIPMENT', 'type overleeft');
  assertEq(kraan.description, 'Oostzijde', 'description overleeft');
  assertEq(kraan.maxUnits, 2, 'maxUnits overleeft');
  assertEq(kraan.costPerHour, 87.5, 'costPerHour overleeft');
  assertEq(kraan.availabilitySteps, [{ from: '2026-07-01', maxUnits: 2 }, { from: '2026-09-01', maxUnits: 1 }],
    'availabilitySteps overleeft');
  const crewBack = back.resources!.find((r) => r.name === 'Ploeg A')!;
  assertEq(kraan.parentId, crewBack.id, 'het ploeg-lidmaatschap overleeft (IFCRELNESTS/ParentGuid)');
  const calBack = (back.resourceCalendars ?? []).find((c) => c.name === 'Nachtploeg');
  assert(calBack, 'de eigen kalender komt terug');
  assertEq(kraan.calendarId, calBack!.id, 'de resource-kalenderkoppeling overleeft');

  const zand = back.resources!.find((r) => r.name === 'Zand')!;
  assertEq(zand.unitOfMeasure, 'm3', 'unitOfMeasure overleeft');
  assertEq(zand.maxUnits, 100, 'maxUnits van het materiaal overleeft');
});

// =================================================================================================
// 18) tooldefinitie-vorm
// =================================================================================================
test('registratie: één tool met prefix, description, vier annotaties, batchable + synchrone kern', () => {
  assertEq(resourceTools.length, 1, 'de module levert één tool');
  const def = resourceTools[0] as any;
  assertEq(def.name, 'planner_manage_resources', 'de naam');
  assert(def.name.startsWith('planner_'), 'service-prefix');
  assert(typeof def.description === 'string' && def.description.length > 200, 'een echte beschrijving (de AI kiest hierop)');
  for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
    assert(k in def.annotations, `annotatie ${k} aanwezig`);
  }
  assertEq(def.annotations.destructiveHint, true, 'verwijderen wist toewijzingen ⇒ eerlijk destructief');
  assertEq(def.batchable, true, 'batchable');
  assert(typeof def.batchStep === 'function', 'draagt de synchrone batch-kern');

  registerAllTools();
  assert(def.description.includes('planner_manage_assignments'),
    'de beschrijving wijst naar de zustertool, zodat de AI de twee niet verwart');
});

await run();
