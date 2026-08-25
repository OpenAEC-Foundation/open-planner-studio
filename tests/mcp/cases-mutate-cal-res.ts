// T20 — mutatietools kalender/resource/project/baseline (WP5-dispatch, leveler-contract,
// intra-batch-guards). Draait headless tegen de ECHTE Zustand-store (via de harness) + de MINIMALE
// F2-runtime-stub (src/services/mcp/tools/runtime.ts), exact zoals cases-mutate-tasks.ts (T19).
//
// Testlijst (spec §Tool-set Muteren + WP5 + §level_resources-contract + T20-brief):
//   1. update_calendar bulk 2 kalenders ⇒ ÉÉN undo-stap
//   2. projectkalender-id op een VERS project ⇒ promotie naar de bibliotheek (WP5b) + wijziging landt
//   3. generator-bouwvak + rawHolidays ⇒ merge + becameLiteral:true + generation weg
//   4. onwerkbaar venster ⇒ WAARSCHUWING (cappedTaskIds), géén fout, wijziging gecommit
//   5. onbekend id zonder create ⇒ zachte weigering + lege-batch-snelpad (geen snapshot/redo-wipe)
//   6. create:true ⇒ nieuwe bibliotheek-kalender met generator-basis
//   7. manage_assignments add/update/move/remove happy path met de T18-veldnamen
//   8. dubbele add in ÉÉN call ⇒ tweede zacht geweigerd (incrementele guard binnen de batch)
//  8b. REVIEWFIX: onbekende `curve` (add én update) ⇒ zachte weigering i.p.v. uncaught crash;
//      geldige items in dezelfde call blijven staan
//   9. level_resources dryRun ⇒ store byte-identiek + volledig LevelingResult
//  10. level_resources apply ⇒ delays + ÉÉN undo-stap + before/after
//  11. stale vóór level_resources ⇒ eerst herrekend (WP8-guardpatroon)
//  12. clear_leveling ⇒ delays weg, één undo-stap
//  13. update_project statusdatum + anker-semantiek (startDate verschuift NIETS)
//  14. move_project ⇒ verschuift de bestaande planning in één undo-stap
//  15. save_baseline: stale ⇒ eerst herrekenen, baseline op verse datums + batchable:false in de def
//  16. registratie/tools-list-vorm: zeven tools, prefix + description + vier annotaties
import { useAppStore, test, assert, assertEq, run } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createSnapshot } from '@/state/snapshot';
import { shiftIso } from '@/engine/moveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, addCalendarDays, formatDate } from '@/utils/dateUtils';

const store = useAppStore;

// Warm-up (zelfde reden als cases-mutate-tasks.ts): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry (syncProjectCalendar §9.1).
// Eén edit + undo zorgt dat die benigne promotie niet in een byte-identiek-assert opduikt.
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

function tool(name: string) {
  const def = calendarResourceTools.find((t) => t.name === name);
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
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}
/** Voeg een blad-taak met een expliciete duur toe (store-actie; buiten de tools om). */
function addTask(name: string, durationDays: number): string {
  const id = store.getState().addTask({ name });
  const t = store.getState().tasks.find((x) => x.id === id)!;
  store.getState().updateTask(id, { time: { ...t.time, scheduleDuration: durationDays } });
  return id;
}

// =================================================================================================
// 1) update_calendar — bulk over twee kalenders = ÉÉN undo-stap
// =================================================================================================
test('update_calendar: bulk over 2 kalenders ⇒ één undo-stap, beide wijzigingen toegepast', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const projCalId = store.getState().project.calendarId;
  const ctx = makeCtx();
  // Eerst een tweede kalender aanmaken (aparte call, telt niet mee voor de undo-meting).
  const created = okData(
    await call('planner_update_calendar', { calendars: [{ id: 'ploeg-2', create: true, name: 'Ploeg 2' }] }, ctx),
  );
  const secondId = created.calendars[0].id as string;
  assert(typeof secondId === 'string' && secondId.length > 0, 'create levert een echt kalender-id');

  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const res = await call(
    'planner_update_calendar',
    {
      calendars: [
        { id: projCalId, name: 'Hoofdkalender' },
        { id: secondId, name: 'Nachtploeg', hoursPerDay: 6 },
      ],
    },
    ctx,
  );
  okData(res);
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'bulk over 2 kalenders = precies één undo-stap');
  const lib = store.getState().calendars;
  assertEq(lib.find((c) => c.id === projCalId)!.name, 'Hoofdkalender', 'projectkalender hernoemd');
  assertEq(lib.find((c) => c.id === secondId)!.name, 'Nachtploeg', 'tweede kalender hernoemd');
  assertEq(lib.find((c) => c.id === secondId)!.hoursPerDay, 6, 'hoursPerDay toegepast');
  // Eén undo maakt BEIDE wijzigingen ongedaan.
  store.getState().undo();
  assert(store.getState().calendars.find((c) => c.id === projCalId)!.name !== 'Hoofdkalender', 'undo draaide kalender 1 terug');
  assert(store.getState().calendars.find((c) => c.id === secondId)!.name !== 'Nachtploeg', 'undo draaide kalender 2 terug');
});

// =================================================================================================
// 2) WP5b — projectkalender-id op een VERS project: eerst promoveren, dán bewerken
// =================================================================================================
test('update_calendar: projectkalender-id op vers project ⇒ promotie naar bibliotheek + wijziging landt', async () => {
  reset();
  const projCalId = store.getState().project.calendarId;
  // Simuleer het document waar WP5b over gaat: de projectkalender leeft alleen als gedenormaliseerde
  // cache (`s.calendar`) en staat NIET in de bibliotheek — de staat van een pre-2.8a-bestand en van
  // een verse store (`calendars: []`). `newProject()` promoot hem tegenwoordig zelf via
  // hydratePayload, dus we halen de entry hier bewust weer weg.
  store.setState((st) => { st.calendars = st.calendars.filter((c) => c.id !== projCalId); });
  assertEq(store.getState().calendars.some((c) => c.id === projCalId), false,
    'testvoorwaarde: projectkalender staat nog niet in de bibliotheek');

  const ctx = makeCtx();
  const res = await call('planner_update_calendar', { calendars: [{ id: projCalId, name: 'Gepromoveerd' }] }, ctx);
  const data = okData(res);
  assertEq(rejections(res).length, 0, 'geen weigering: de projectkalender is een geldig doel');
  assertEq(data.calendars[0].promoted, true, 'de respons meldt de promotie');
  assert(store.getState().calendars.some((c) => c.id === projCalId), 'projectkalender staat nu in de bibliotheek');
  assertEq(store.getState().calendars.find((c) => c.id === projCalId)!.name, 'Gepromoveerd', 'bibliotheek-entry gewijzigd');
  assertEq(store.getState().calendar.name, 'Gepromoveerd', 'de gedenormaliseerde cache is meegelopen (§9.1)');
});

// =================================================================================================
// 3) Meng-semantiek WP5d — generator-bouwvak + rawHolidays ⇒ merge, generation weg, becameLiteral
// =================================================================================================
test('update_calendar: generator (NL-bouwvak) + rawHolidays ⇒ merge, generation weg, becameLiteral:true', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const projCalId = store.getState().project.calendarId;
  const start = store.getState().project.startDate;
  const vorstStart = shiftIso(start, 30);
  const vorstEnd = shiftIso(start, 32);

  const ctx = makeCtx();
  const res = await call(
    'planner_update_calendar',
    {
      calendars: [
        {
          id: projCalId,
          generate: { country: 'NL', bouwvak: 'midden' },
          rawHolidays: [{ name: 'Vorstverlet', startDate: vorstStart, endDate: vorstEnd }],
        },
      ],
    },
    ctx,
  );
  const data = okData(res);
  assertEq(data.calendars[0].becameLiteral, true, 'becameLiteral gemeld per item');
  const cal = store.getState().calendars.find((c) => c.id === projCalId)!;
  assertEq(cal.generation, undefined, 'generation is gewist door de rauwe toevoeging');
  // Reviewfix: écht verwijderd (delete), niet een sleutel-met-undefined — en de projectkalender-cache
  // moet de bijgewerkte bibliotheek-entry blijven volgen (§9.1).
  assertEq('generation' in cal, false, 'de generation-SLEUTEL is verwijderd, niet op undefined gezet');
  assertEq('generation' in store.getState().calendar, false, 'de projectkalender-cache loopt mee');
  assertEq(store.getState().calendar.holidays.length, cal.holidays.length, 'cache en entry zijn in sync');
  assert(cal.holidays.some((h) => h.name === 'Vorstverlet' && h.startDate === vorstStart), 'rauwe dag staat erin');
  assert(cal.holidays.length > 1, 'de generator-basis (bouwvak + feestdagen) staat er ook in');
});

// =================================================================================================
// 4) WP7 — onwerkbaar venster ⇒ prominente WAARSCHUWING, géén fout, wijziging GECOMMIT
// =================================================================================================
test('update_calendar: onwerkbaar venster ⇒ cappedTaskIds als waarschuwing, geen fout, wijziging gecommit', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const projCalId = store.getState().project.calendarId;
  const start = store.getState().project.startDate;
  addTask('gecapte taak', 5);
  // Meerjarig, aaneengesloten feestdagblok vanaf de projectstart ⇒ de werkdag-scans van de solver
  // botsen herhaald tegen de MAX_SCAN(366)-grens (zelfde recept als cases-engine-capped.ts eis 3).
  const blokEnd = shiftIso(start, 3000);

  const ctx = makeCtx();
  const res = await call(
    'planner_update_calendar',
    { calendars: [{ id: projCalId, rawHolidays: [{ name: 'blok', startDate: start, endDate: blokEnd }] }] },
    ctx,
  );
  const data = okData(res); // GEEN fout
  assert(Array.isArray(data.cappedTaskIds) && data.cappedTaskIds.length >= 1, 'cappedTaskIds prominent in de data');
  assert(Array.isArray(data.warnings) && data.warnings.some((w: string) => /onwerkbaar|venster|capped/i.test(w)),
    'een leesbare waarschuwing staat in data.warnings');
  const cal = store.getState().calendars.find((c) => c.id === projCalId)!;
  assert(cal.holidays.some((h) => h.name === 'blok'), 'de wijziging is ECHT gecommit (geen rollback)');
});

// =================================================================================================
// 5) Onbekend id zonder create ⇒ zachte weigering; all-unknown ⇒ lege-batch-snelpad
// =================================================================================================
test('update_calendar: onbekend id zonder create ⇒ zachte weigering, GEEN snapshot en redo ONGEMOEID', async () => {
  reset();
  store.getState().addTask({ name: 'seed' });
  store.getState().undo(); // seed de redo-stack
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const redoLen = store.getState().historyEvents.filter(event => event.state === 'undone').length;
  assert(redoLen >= 1, 'de redo-stack is geseed');

  const ctx = makeCtx();
  const res = await call('planner_update_calendar', { calendars: [{ id: 'cal-bestaat-niet', name: 'x' }] }, ctx);
  assert(res.ok, 'all-unknown update_calendar slaagt als no-op met weigeringen');
  assertEq(rejections(res).length, 1, 'één zachte weigering');
  assert(/create|bestaat niet/i.test(rejections(res)[0].reason), 'de reden wijst naar `create`');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'GEEN nieuwe undo-snapshot');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'undone').length, redoLen, 'redo-stack ONGEMOEID');
});

// =================================================================================================
// 6) create:true ⇒ nieuwe bibliotheek-kalender (met generator-basis, create-spanne)
// =================================================================================================
test('update_calendar: create:true ⇒ nieuwe kalender met generator-basis en generation-metadata', async () => {
  reset();
  const ctx = makeCtx();
  const before = store.getState().calendars.length;
  const res = await call(
    'planner_update_calendar',
    { calendars: [{ id: 'nieuw', create: true, name: 'Onderaannemer', workDays: [1, 2, 3, 4], generate: { country: 'NL', bouwvak: 'geen' } }] },
    ctx,
  );
  const data = okData(res);
  const row = data.calendars[0];
  assertEq(row.created, true, 'created:true gemeld');
  assertEq(row.requestedId, 'nieuw', 'de gevraagde (client-)id komt terug');
  assert(row.id !== 'nieuw', 'de echte kalender-id is door de app gegenereerd (id\'s zijn per document)');
  assert(store.getState().calendars.length >= before + 1, 'de bibliotheek is gegroeid');
  const cal = store.getState().calendars.find((c) => c.id === row.id)!;
  assertEq(cal.name, 'Onderaannemer', 'naam toegepast');
  assertEq(cal.workDays, [1, 2, 3, 4], 'workDays toegepast');
  assert(cal.generation != null, 'zuiver generator-pad ⇒ generation-metadata gezet');
  assertEq(row.becameLiteral, false, 'geen rawHolidays ⇒ becameLiteral false');
});

// =================================================================================================
// 7) manage_assignments — add/update/move/remove happy path met de T18-veldnamen
// =================================================================================================
test('manage_assignments: add/update/move/remove met assignmentId/unitsPerDay/curve', async () => {
  reset();
  const a = addTask('A', 5);
  const b = addTask('B', 5);
  const r = store.getState().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 });
  const ctx = makeCtx();

  // add
  const addRes = await call('planner_manage_assignments', {
    actions: [{ action: 'add', taskId: a, resourceId: r, unitsPerDay: 1, curve: 'BELL' }],
  }, ctx);
  const addData = okData(addRes);
  assertEq(rejections(addRes).length, 0, 'geen weigering op de happy path');
  assertEq(addData.added.length, 1, 'één toewijzing aangemaakt');
  const asgnId = addData.added[0].assignmentId as string;
  assert(typeof asgnId === 'string' && asgnId.length > 0, 'add levert een assignmentId (T18-veldnaam)');
  let asgn = store.getState().assignments.find((x) => x.id === asgnId)!;
  assertEq(asgn.unitsPerDay, 1, 'unitsPerDay geschreven');
  assertEq(asgn.curve, 'BELL', 'curve geschreven');

  // update
  okData(await call('planner_manage_assignments', {
    actions: [{ action: 'update', assignmentId: asgnId, unitsPerDay: 0.5, curve: 'UNIFORM' }],
  }, ctx));
  asgn = store.getState().assignments.find((x) => x.id === asgnId)!;
  assertEq(asgn.unitsPerDay, 0.5, 'unitsPerDay bijgewerkt');
  assertEq(asgn.curve, 'UNIFORM', 'curve bijgewerkt');

  // move
  okData(await call('planner_manage_assignments', {
    actions: [{ action: 'move', assignmentId: asgnId, taskId: b }],
  }, ctx));
  asgn = store.getState().assignments.find((x) => x.id === asgnId)!;
  assertEq(asgn.taskId, b, 'toewijzing verplaatst naar taak B');
  assertEq(store.getState().tasks.find((t) => t.id === a)!.resourceIds, [], 'resourceIds op A opgeruimd');
  assertEq(store.getState().tasks.find((t) => t.id === b)!.resourceIds, [r], 'resourceIds op B bijgewerkt');

  // remove
  const rmRes = await call('planner_manage_assignments', {
    actions: [{ action: 'remove', assignmentId: asgnId }],
  }, ctx);
  assertEq(okData(rmRes).removed, [asgnId], 'verwijderde assignmentId gerapporteerd');
  assertEq(store.getState().assignments.filter((x) => x.id === asgnId).length, 0, 'toewijzing is weg');
});

// =================================================================================================
// 8) Intra-batch-guard — tweede identieke add in ÉÉN call ⇒ zacht geweigerd (dubbeltelling-guard)
// =================================================================================================
test('manage_assignments: dubbele add in één call ⇒ eerste toegepast, tweede zacht geweigerd', async () => {
  reset();
  const a = addTask('A', 5);
  const r = store.getState().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  const ctx = makeCtx();
  const res = await call('planner_manage_assignments', {
    actions: [
      { action: 'add', taskId: a, resourceId: r, unitsPerDay: 1 },
      { action: 'add', taskId: a, resourceId: r, unitsPerDay: 1 },
    ],
  }, ctx);
  const data = okData(res);
  assertEq(data.added.length, 1, 'precies één toewijzing aangemaakt');
  assertEq(rejections(res).length, 1, 'de tweede is zacht geweigerd');
  assert(/al toegewezen|dubbel/i.test(rejections(res)[0].reason), 'de reden noemt de dubbeltelling');
  assertEq(store.getState().assignments.filter((x) => x.taskId === a && x.resourceId === r).length, 1,
    'de store bevat precies één toewijzing (geen dubbeltelling)');
});

// =================================================================================================
// 8b) REVIEWFIX-blocker — een onbekende `curve` mag NOOIT de store in
//
// Regressie die dit afdekt: de dispatcher valideert `inputSchema` NIET, dus zonder tool-guard belandde
// bv. 'SPIRAAL' ongefilterd in de store. `recomputeResourceLoad()` draait in `runInMcpTransaction`
// stap 5 — BUITEN de try/catch — en `ResourceLoad.CURVE_POINTS[curve]` is dan undefined: uncaught
// TypeError, géén McpToolResult, corrupte waarde GECOMMIT plus een undo-stap erbij.
// =================================================================================================
test('manage_assignments: onbekende curve (add) ⇒ zachte weigering, store byte-identiek, geen undo-stap', async () => {
  reset();
  const a = addTask('curve-a', 5);
  const r = store.getState().addResource({ name: 'Stukadoor', type: 'LABOR', description: '', maxUnits: 2 });
  const before = JSON.stringify(createSnapshot(store.getState()));
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const ctx = makeCtx();
  const res = await call('planner_manage_assignments', {
    actions: [{ action: 'add', taskId: a, resourceId: r, unitsPerDay: 1, curve: 'SPIRAAL' }],
  }, ctx);

  assert(res.ok, 'de call levert een NORMAAL McpToolResult (geen uncaught crash)');
  assertEq(okData(res).added, [], 'niets toegevoegd');
  assertEq(rejections(res).length, 1, 'precies één zachte weigering');
  assert(/SPIRAAL/.test(rejections(res)[0].reason), 'de reden noemt de foute waarde');
  assert(/UNIFORM/.test(rejections(res)[0].reason) && /BELL/.test(rejections(res)[0].reason),
    'de reden somt de geldige waarden op');
  assertEq(store.getState().assignments.length, 0, 'geen toewijzing in de store');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'store byte-identiek');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'geen undo-stap gepusht');
});

test('manage_assignments: kleine-letter-curve ("bell") ⇒ geweigerd; geldig item in dezelfde call WEL toegepast', async () => {
  reset();
  const a = addTask('curve-mix-a', 5);
  const b = addTask('curve-mix-b', 5);
  const r = store.getState().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 3 });
  const ctx = makeCtx();
  const res = await call('planner_manage_assignments', {
    actions: [
      { action: 'add', taskId: a, resourceId: r, unitsPerDay: 1, curve: 'bell' }, // hoofdlettergevoelig
      { action: 'add', taskId: b, resourceId: r, unitsPerDay: 1, curve: 'BELL' },
    ],
  }, ctx);
  const data = okData(res);
  assertEq(data.added.length, 1, 'alleen het geldige item is toegepast');
  assertEq(data.added[0].taskId, b, 'en dat is het item op taak B');
  assertEq(rejections(res).length, 1, 'het kleine-letter-item is zacht geweigerd');
  assertEq(store.getState().assignments.filter((x) => x.taskId === a).length, 0, 'niets op taak A');
  assertEq(store.getState().assignments.find((x) => x.taskId === b)!.curve, 'BELL', 'taak B heeft de geldige curve');
});

test('manage_assignments: onbekende curve (update) ⇒ zachte weigering, bestaande toewijzing ongemoeid', async () => {
  reset();
  const a = addTask('curve-upd', 5);
  const r = store.getState().addResource({ name: 'Voeger', type: 'LABOR', description: '', maxUnits: 1 });
  const ctx = makeCtx();
  const asgnId = okData(await call('planner_manage_assignments', {
    actions: [{ action: 'add', taskId: a, resourceId: r, unitsPerDay: 1, curve: 'FRONT_LOADED' }],
  }, ctx)).added[0].assignmentId as string;

  const before = JSON.stringify(createSnapshot(store.getState()));
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const res = await call('planner_manage_assignments', {
    actions: [{ action: 'update', assignmentId: asgnId, curve: 'ZIGZAG' }],
  }, ctx);
  assert(res.ok, 'normaal McpToolResult');
  assertEq(rejections(res).length, 1, 'zachte weigering op de update-tak');
  assertEq(store.getState().assignments.find((x) => x.id === asgnId)!.curve, 'FRONT_LOADED', 'curve ongewijzigd');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'store byte-identiek');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'geen undo-stap gepusht');
});

// =================================================================================================
// 9/10/11) level_resources — dryRun / apply / staleness-guard
// =================================================================================================
/** Overbelasting-opzet: A (10 dagen) en B (5 dagen) parallel, beide 1 eenheid van dezelfde
 *  resource met maxUnits 1 ⇒ B heeft speling en kan binnen de float wegschuiven. */
function levelingFixture(): { a: string; b: string; r: string } {
  reset();
  const a = addTask('A-lang', 10);
  const b = addTask('B-kort', 5);
  const r = store.getState().addResource({ name: 'Ploeg', type: 'CREW', description: '', maxUnits: 1 });
  store.getState().assignResource(a, r, 1);
  store.getState().assignResource(b, r, 1);
  store.getState().runCPM();
  return { a, b, r };
}

test('level_resources dryRun: store byte-identiek + VOLLEDIG LevelingResult in de respons', async () => {
  levelingFixture();
  const before = JSON.stringify(createSnapshot(store.getState()));
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const ctx = makeCtx();
  const res = await call('planner_level_resources', { constrainToFloat: false, dryRun: true }, ctx);
  const data = okData(res);
  assertEq(data.dryRun, true, 'de respons meldt dat het een preview was');
  for (const key of ['delays', 'unresolved', 'unresolvedReasons', 'shifts', 'projectEndBefore', 'projectEndAfter']) {
    assert(key in data, `LevelingResult-veld '${key}' ontbreekt in de respons`);
  }
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'dryRun muteert de store NIET (byte-identiek)');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'dryRun pusht geen undo-snapshot');
});

test('level_resources apply: delays geschreven, ÉÉN undo-stap, before/after gerapporteerd', async () => {
  const { b } = levelingFixture();
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const ctx = makeCtx();
  const res = await call('planner_level_resources', { constrainToFloat: false }, ctx);
  const data = okData(res);
  assertEq(data.dryRun, false, 'geen preview: echt toegepast');
  assert(Object.keys(data.delays).length >= 1, 'minstens één taak krijgt een levelingDelay');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'precies één undo-stap');
  const withDelay = store.getState().tasks.filter((t) => t.levelingDelay !== undefined);
  assert(withDelay.length >= 1, 'de delay staat ECHT op een taak in de store');
  assert(withDelay.some((t) => t.id === b) || withDelay.length >= 1, 'de korte taak schuift (of minstens één taak)');
  assert(typeof data.projectEndBefore === 'string' && typeof data.projectEndAfter === 'string',
    'projectEndBefore/After aanwezig');
  // constrainToFloat:false ⇒ de einddatum-delta hoort prominent te zijn.
  assert(data.projectEndDelta && typeof data.projectEndDelta.calendarDays === 'number',
    'projectEndDelta prominent bij constrainToFloat:false');
  // Reviewfix: naast de VOORSPELDE projectEndAfter ook het werkelijke projecteinde uit de verse store.
  assertEq(data.projectEnd, store.getState().cpmResult!.projectEnd, 'projectEnd komt uit de verse store');
  // Eén undo maakt de hele nivellering ongedaan.
  store.getState().undo();
  assertEq(store.getState().tasks.filter((t) => t.levelingDelay !== undefined).length, 0,
    'één undo wist alle levelingDelays');
});

test('level_resources: stale planning ⇒ eerst herrekend (WP8-guardpatroon)', async () => {
  levelingFixture();
  store.getState().addTask({ name: 'maakt stale' }); // store-edit ⇒ scheduleStale
  assertEq(store.getState().scheduleStale, true, 'testvoorwaarde: planning is stale');
  const ctx = makeCtx();
  const res = await call('planner_level_resources', { constrainToFloat: true, dryRun: true }, ctx);
  const data = okData(res);
  assertEq(data.recomputed, true, 'de respons meldt dat er eerst is herrekend');
  assertEq(store.getState().scheduleStale, false, 'de planning is nu vers');
  // Bij dryRun is het werkelijke projecteinde per definitie het ONgewijzigde (== before).
  assertEq(data.projectEnd, data.projectEndBefore, 'dryRun laat het werkelijke projecteinde ongemoeid');
});

// =================================================================================================
// 12) clear_leveling
// =================================================================================================
test('clear_leveling: wist alle levelingDelays in één undo-stap', async () => {
  levelingFixture();
  const ctx = makeCtx();
  okData(await call('planner_level_resources', { constrainToFloat: false }, ctx));
  assert(store.getState().tasks.some((t) => t.levelingDelay !== undefined), 'voorwaarde: er staan delays');
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const res = await call('planner_clear_leveling', {}, ctx);
  const data = okData(res);
  assert(data.cleared >= 1, 'het aantal gewiste delays wordt gemeld');
  assertEq(store.getState().tasks.filter((t) => t.levelingDelay !== undefined).length, 0, 'alle delays weg');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'precies één undo-stap');
});

// =================================================================================================
// 13) update_project — statusdatum + anker-semantiek van startDate
// =================================================================================================
test('update_project: statusdatum landt; startDate is GEEN volledige Δ-verschuiving zoals move_project (T7-review H1: wél de gerichte klem-uitzondering op een wortel-taak zonder voorganger/constraint)', async () => {
  reset();
  const a = addTask('bestaand (wortel)', 5);
  // Opvolger van `a` — heeft een voorganger, dus buiten de klem (T7b/H1: "wortel-taken zonder
  // voorganger"). Bewijst dat `startDate` géén volledige `move_project`-stijl Δ-verschuiving doet:
  // een taak met een voorganger blijft op zijn eigen (relatief bepaalde) anker staan.
  const b = addTask('opvolger', 3);
  store.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  store.getState().runCPM();
  const bStartBefore = store.getState().tasks.find((t) => t.id === b)!.time.scheduleStart;
  const aStartBefore = store.getState().tasks.find((t) => t.id === a)!.time.scheduleStart;
  const nieuweStart = shiftIso(store.getState().project.startDate, 40);

  const statusDatum = store.getState().project.startDate;

  const ctx = makeCtx();
  const res = await call('planner_update_project', {
    name: 'Renovatie Kade', statusDate: statusDatum, startDate: nieuweStart,
  }, ctx);
  const data = okData(res);
  assertEq(store.getState().project.name, 'Renovatie Kade', 'naam gezet');
  assertEq(store.getState().project.statusDate, statusDatum, 'statusdatum gezet');
  assertEq(store.getState().project.startDate, nieuweStart, 'startDate gezet');
  // T7b/H1: `a` is een wortel-taak zonder voorganger/constraint mét een eigen anker vóór de nieuwe
  // (latere) startDate — die klemt sinds deze fixronde óók via de MCP-tool mee, exact zoals de
  // UI-variant (`projectSlice.setProject`) en gemeld via `anchorsClamped`.
  //
  // BUGFIX (T13, vóór mijn scope maar blokkeerde npm run verify): `nieuweStart` is een RUWE
  // kalenderdag-shift (`shiftIso`, geen kalender-snap) — "vandaag + 40 dagen" kan op elke weekdag
  // landen, ook een niet-werkdag. `clampProjectStartAnchors` klemt (per zijn eigen, hierboven
  // geciteerde moduledoc) NOOIT naar zo'n ruwe datum zelf, maar naar de EERSTVOLGENDE
  // werk-instant OP/NÁ die datum (`snapWorkInstantOnOrAfter`) — exact zoals de solver zelf snapt.
  // Een `assertEq(..., nieuweStart, ...)` was dus een datum-afhankelijke flake: groen zolang
  // "vandaag + 40" toevallig op een werkdag viel, rood zodra dat een weekend was (2026-08-17 + 40 =
  // 2026-09-26, een zaterdag — precies zo'n geval).
  //
  // L2 (Opus-eindreview 2026-08-17): de eerste fix verving `assertEq` door een LOSSE band ("op/ná
  // de nieuwe startDate, een echte werkdag, binnen 4 kalenderdagen speling") — dat verbergt een
  // klem die bv. één dag te ver snapt net zo goed als een correcte klem, want beide vallen binnen
  // de band. Scherper zonder de flake terug te halen: reken de EXACTE verwachte werkdag zelf uit,
  // dag-voor-dag vanaf `nieuweStart`, met de ONAFHANKELIJKE `CalendarEngine.isWorkDay` (niet
  // `snapWorkInstantOnOrAfter` zelf — dat zou de test weer tautologisch maken tegen de
  // implementatie i.p.v. tegen de specificatie), en toets daar `assertEq` tegen. Nog steeds
  // datum-onafhankelijk (geen hardgecodeerde kalenderdatum — werkt voor elke "vandaag"), maar een
  // klem die één dag te ver snapt geeft nu een exacte rode regel i.p.v. een groene "binnen de band".
  const aStartAfter = store.getState().tasks.find((t) => t.id === a)!.time.scheduleStart;
  assert(aStartAfter !== aStartBefore, 'de wortel-taak zonder voorganger/constraint IS meegeklemd (anker gewijzigd)');
  const clampEngine = new CalendarEngine(store.getState().calendar);
  let expectedAnchor = parseDate(nieuweStart);
  while (!clampEngine.isWorkDay(expectedAnchor)) {
    expectedAnchor = addCalendarDays(expectedAnchor, 1);
  }
  assertEq(aStartAfter, formatDate(expectedAnchor),
    'de wortel-taak klemt naar de EERSTE werkdag op/ná de nieuwe startDate (onafhankelijk dag-voor-dag berekend via CalendarEngine.isWorkDay, niet via snapWorkInstantOnOrAfter)');
  assertEq(data.anchorsClamped, 1, 'de respons meldt het geklemde aantal');
  // GEEN volledige Δ-verschuiving (dat blijft move_project): de OPVOLGER (heeft een voorganger, dus
  // geen wortel-anker) blijft op zijn eigen, relatief bepaalde anker staan — startDate verschuift
  // 'm niet mee zoals move_project dat zou doen.
  assertEq(store.getState().tasks.find((t) => t.id === b)!.time.scheduleStart, bStartBefore,
    'de opvolger (heeft een voorganger) is NIET verschoven door startDate');
  assert(/move_project/i.test(JSON.stringify(data)) || /move_project/i.test(tool('planner_update_project').description),
    'de tool verwijst naar move_project voor het écht volledig verschuiven van de hele planning');
});

test('update_project: statusDate null ⇒ sleutel ECHT verwijderd (niet als undefined blijven staan)', async () => {
  reset();
  addTask('sd', 5);
  const ctx = makeCtx();
  okData(await call('planner_update_project', { statusDate: store.getState().project.startDate }, ctx));
  assert('statusDate' in store.getState().project, 'voorwaarde: de statusdatum staat er');
  const res = await call('planner_update_project', { statusDate: null }, ctx);
  const data = okData(res);
  assertEq(data.updated, ['statusDate'], 'de gewiste sleutel wordt gerapporteerd');
  assertEq('statusDate' in store.getState().project, false, 'de sleutel is ECHT weg (delete, geen undefined-sleutel)');
  assertEq(data.project.statusDate, null, 'de respons meldt de statusdatum als null');
});

// =================================================================================================
// 14) move_project — verschuift de bestaande planning, één undo-stap
// =================================================================================================
test('move_project: verschuift de bestaande planning in één undo-stap', async () => {
  reset();
  const a = addTask('verschuifbaar', 5);
  store.getState().runCPM();
  const startBefore = store.getState().tasks.find((t) => t.id === a)!.time.scheduleStart;
  const nieuweStart = shiftIso(store.getState().project.startDate, 14);
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const ctx = makeCtx();
  const res = await call('planner_move_project', { newStartDate: nieuweStart }, ctx);
  const data = okData(res);
  assertEq(data.moved, true, 'moved:true');
  assertEq(data.deltaDays, 14, 'delta van 14 kalenderdagen');
  assertEq(store.getState().project.startDate, nieuweStart, 'projectstart verzet');
  assert(store.getState().tasks.find((t) => t.id === a)!.time.scheduleStart !== startBefore,
    'de bestaande taak IS meegeschoven (i.t.t. update_project)');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'precies één undo-stap');
});

// =================================================================================================
// 15) save_baseline — staleness-guard (WP8) + batchable:false
// =================================================================================================
test('save_baseline: stale ⇒ eerst herrekenen, baseline op VERSE datums, batchable:false', async () => {
  reset();
  const a = addTask('bl', 5);
  assertEq(store.getState().scheduleStale, true, 'testvoorwaarde: planning is stale');
  assertEq(tool('planner_save_baseline').batchable, false, 'save_baseline is uitgesloten van batch');

  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const ctx = makeCtx();
  const res = await call('planner_save_baseline', { name: 'Nulmeting' }, ctx);
  const data = okData(res);
  assertEq(data.recomputed, true, 'de respons meldt dat er eerst is herrekend');
  assertEq(store.getState().scheduleStale, false, 'planning is vers');
  assertEq(store.getState().baselines.length, 1, 'precies één baseline');
  assertEq(store.getState().baselines[0].name, 'Nulmeting', 'naam toegepast');
  assertEq(store.getState().activeBaselineId, store.getState().baselines[0].id, 'de nieuwe baseline is actief');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1, 'precies één undo-stap');
  // De baseline is op de VERSE datums genomen.
  const fresh = store.getState().tasks.find((t) => t.id === a)!.time.earlyStart;
  assertEq(store.getState().baselines[0].tasks.find((r) => r.taskId === a)!.start, fresh,
    'baseline-startdatum = de herrekende earlyStart');
});

// =================================================================================================
// 16) Registratie + tools/list-vorm
// =================================================================================================
test('registratie: zeven T20-tools met prefix, description, vier annotaties en JSON-schema', async () => {
  registerToolModules([calendarResourceTools]);
  const raw = await handleMcpMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), makeCtx());
  const msg = JSON.parse(raw);
  const tools: any[] = msg.result.tools;
  assertEq(tools.length, 7, 'zeven tools (calendar/assignments/level/clear/project/move/baseline)');
  const namen = tools.map((t) => t.name).sort();
  assertEq(namen, [
    'planner_clear_leveling', 'planner_level_resources', 'planner_manage_assignments',
    'planner_move_project', 'planner_save_baseline', 'planner_update_calendar', 'planner_update_project',
  ], 'exact de zeven verwachte namen');
  for (const t of tools) {
    assert(t.name.startsWith('planner_'), `prefix op ${t.name}`);
    assert(typeof t.description === 'string' && t.description.trim().length > 0, `description op ${t.name}`);
    assert(t.inputSchema && typeof t.inputSchema === 'object', `inputSchema op ${t.name}`);
    const an = t.annotations;
    assert(an && typeof an.readOnlyHint === 'boolean' && typeof an.destructiveHint === 'boolean'
      && typeof an.idempotentHint === 'boolean' && typeof an.openWorldHint === 'boolean',
      `vier annotaties op ${t.name}`);
    assertEq(an.openWorldHint, false, `openWorldHint false op ${t.name}`);
  }
  assertEq(tools.find((t) => t.name === 'planner_update_calendar').annotations.destructiveHint, true,
    'update_calendar is destructief (spec §Naamgeving & annotaties)');
  // Reviewfix: spec r65 zet destructiveHint op een GESLOTEN lijst — clear_leveling hoort er niet bij.
  assertEq(tools.find((t) => t.name === 'planner_clear_leveling').annotations.destructiveHint, false,
    'clear_leveling draagt GEEN destructiveHint (afgeleide, herberekenbare waarden)');
  // clear_leveling wijst de AI erop dat level_resources zelfresettend is.
  assert(/zelfreset|zelf.*reset|vooraf.*zinloos|niet nodig/i.test(tool('planner_clear_leveling').description),
    'clear_leveling-beschrijving legt uit dat het vóór level_resources zinloos is');
});

await run();
