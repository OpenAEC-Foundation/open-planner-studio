import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createSnapshot } from '@/state/snapshot';
import { shiftIso } from '@/engine/moveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeGenerateSpan, materializeHolidays } from '@/engine/calendar/generateCalendarHolidays';
import { parseDate, addCalendarDays, formatDate } from '@/utils/dateUtils';

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
function addTask(name: string, durationDays: number): string {
  const id = store.getState().addTask({ name });
  const t = store.getState().tasks.find((x) => x.id === id)!;
  store.getState().updateTask(id, { time: { ...t.time, scheduleDuration: durationDays } });
  return id;
}

function prepareCalendarSpan(endDate: string, withCpm: boolean): void {
  store.getState().setProject({ startDate: '2027-06-07', endDate });
  if (withCpm) {
    const id = addTask('Werk in 2033', 5);
    const task = store.getState().tasks.find((t) => t.id === id)!;
    store.getState().updateTask(id, { time: { ...task.time, scheduleStart: '2033-06-06' } });
    store.getState().runCPM();
    assertEq(store.getState().cpmResult?.error, undefined, 'testvoorwaarde: berekening geslaagd');
    assertEq(store.getState().cpmResult?.projectEnd.slice(0, 4), '2033', 'testvoorwaarde: berekend einde in 2033');
  } else {
    assertEq(store.getState().cpmResult, null, 'testvoorwaarde: nog geen rekenresultaat');
  }
}

test('update_calendar: bulk over 2 kalenders ⇒ één undo-stap, beide wijzigingen toegepast', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const projCalId = store.getState().project.calendarId;
  const ctx = makeCtx();
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
  store.getState().undo();
  assert(store.getState().calendars.find((c) => c.id === projCalId)!.name !== 'Hoofdkalender', 'undo draaide kalender 1 terug');
  assert(store.getState().calendars.find((c) => c.id === secondId)!.name !== 'Nachtploeg', 'undo draaide kalender 2 terug');
});

test('update_calendar: projectkalender-id op vers project ⇒ promotie naar bibliotheek + wijziging landt', async () => {
  reset();
  const projCalId = store.getState().project.calendarId;
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
  assertEq('generation' in cal, false, 'de generation-SLEUTEL is verwijderd, niet op undefined gezet');
  assertEq('generation' in store.getState().calendar, false, 'de projectkalender-cache loopt mee');
  assertEq(store.getState().calendar.holidays.length, cal.holidays.length, 'cache en entry zijn in sync');
  assert(cal.holidays.some((h) => h.name === 'Vorstverlet' && h.startDate === vorstStart), 'rauwe dag staat erin');
  assert(cal.holidays.length > 1, 'de generator-basis (bouwvak + feestdagen) staat er ook in');
});

for (const { label, endDate, withCpm, toYear } of [
  { label: 'ingevoerd einde vroeg, berekend einde later', endDate: '2027-12-31', withCpm: true, toYear: 2034 },
  { label: 'ingevoerd einde later, berekend einde vroeg', endDate: '2037-12-31', withCpm: true, toYear: 2038 },
  { label: 'geen ingevoerd einde, wel berekend einde', endDate: '', withCpm: true, toYear: 2034 },
  { label: 'wel ingevoerd einde, geen rekenresultaat', endDate: '2037-12-31', withCpm: false, toYear: 2038 },
  { label: 'geen ingevoerd einde en geen rekenresultaat', endDate: '', withCpm: false, toYear: 2030 },
]) {
  test(`update_calendar: generate — ${label}`, async () => {
    reset();
    prepareCalendarSpan(endDate, withCpm);
    const state = store.getState();
    const span = computeGenerateSpan(state.project.startDate, state.project.endDate, state.cpmResult?.projectEnd);
    assertEq(span, { from: 2026, to: toYear }, 'UI-defaultspanne dekt het latere beschikbare einde');
    const direct = materializeHolidays({ country: 'NL', bouwvak: 'geen' }, span.from, span.to);
    const ctx = makeCtx();
    const id = store.getState().project.calendarId;
    const args = { calendars: [{ id, generate: { country: 'NL', bouwvak: 'geen' } }] };
    const checkGeneration = async (): Promise<void> => {
      const res = await call('planner_update_calendar', args, ctx);
      okData(res);
      assertEq(rejections(res), [], 'generate geaccepteerd');
      const cal = store.getState().calendars.find((c) => c.id === id)!;
      assertEq(cal.holidays, direct.holidays, 'UI- en MCP-pad materialiseren dezelfde feestdagen');
      assertEq(cal.generation, direct.generation, 'UI- en MCP-pad bewaren dezelfde generatieherkomst');
      assertEq(cal.generation?.generatedFromYear, 2026, 'generatie begint in het jaar vóór de projectstart');
      assertEq(cal.generation?.generatedToYear, toYear, 'generatie dekt de verwachte eindspanne');
      assert(cal.holidays.some((h) => h.startDate === `${toYear}-12-25`), 'feestdagen in het laatste jaar zijn gematerialiseerd');
      assert(!cal.holidays.some((h) => h.startDate > `${toYear}-12-31`), 'geen feestdagen voorbij de gekozen spanne');
    };
    await checkGeneration();
    if (withCpm) {
      await checkGeneration();
    }
    assertEq(store.getState().project.endDate, endDate, 'de ingevoerde einddatum blijft behouden');
  });
}

test('update_calendar: onwerkbaar venster ⇒ cappedTaskIds als waarschuwing, geen fout, wijziging gecommit', async () => {
  reset();
  store.getState().ensureProjectCalendarInLibrary();
  const projCalId = store.getState().project.calendarId;
  const start = store.getState().project.startDate;
  addTask('gecapte taak', 5);
  const blokEnd = shiftIso(start, 3000);

  const ctx = makeCtx();
  const res = await call(
    'planner_update_calendar',
    { calendars: [{ id: projCalId, rawHolidays: [{ name: 'blok', startDate: start, endDate: blokEnd }] }] },
    ctx,
  );
  const data = okData(res);
  assert(Array.isArray(data.cappedTaskIds) && data.cappedTaskIds.length >= 1, 'cappedTaskIds prominent in de data');
  assert(Array.isArray(data.warnings) && data.warnings.some((w: string) => /onwerkbaar|venster|capped/i.test(w)),
    'een leesbare waarschuwing staat in data.warnings');
  const cal = store.getState().calendars.find((c) => c.id === projCalId)!;
  assert(cal.holidays.some((h) => h.name === 'blok'), 'de wijziging is ECHT gecommit (geen rollback)');
});

test('update_calendar: onbekend id zonder create ⇒ zachte weigering, GEEN snapshot en redo ONGEMOEID', async () => {
  reset();
  store.getState().addTask({ name: 'seed' });
  store.getState().undo();
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const redoLen = store.getState().historyEvents.filter(event => event.state === 'undone').length;
  assert(redoLen >= 1, 'de redo-stack is geseed');

  const ctx = makeCtx();
  const res = await call('planner_update_calendar', { calendars: [{ id: 'cal-bestaat-niet', name: 'x' }] }, ctx);
  assert(res.ok, 'all-unknown update_calendar slaagt als no-op met weigeringen');
  assertEq(rejections(res).length, 1, 'één zachte weigering');
  assert(/create|does not exist/i.test(rejections(res)[0].reason), 'de reden wijst naar `create`');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen, 'GEEN nieuwe undo-snapshot');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'undone').length, redoLen, 'redo-stack ONGEMOEID');
});

test('update_calendar: create:true ⇒ nieuwe kalender met generator-basis en generation-metadata', async () => {
  reset();
  prepareCalendarSpan('2037-12-31', true);
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
  assertEq(cal.generation?.generatedFromYear, 2026, 'aanmaak begint in startjaar−1');
  assertEq(cal.generation?.generatedToYear, 2030, 'aanmaak houdt startjaar+3 ondanks beide latere projecteinddatums');
  assert(cal.holidays.some((h) => h.startDate === '2030-12-25'), 'feestdagen tot en met startjaar+3 aangemaakt');
  assert(!cal.holidays.some((h) => h.startDate >= '2031-01-01'), 'aanmaak neemt de latere projecteinddatums niet over');
  assertEq(row.becameLiteral, false, 'geen rawHolidays ⇒ becameLiteral false');
});

test('manage_assignments: add/update/move/remove met assignmentId/unitsPerDay/curve', async () => {
  reset();
  const a = addTask('A', 5);
  const b = addTask('B', 5);
  const r = store.getState().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 });
  const ctx = makeCtx();

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

  okData(await call('planner_manage_assignments', {
    actions: [{ action: 'update', assignmentId: asgnId, unitsPerDay: 0.5, curve: 'UNIFORM' }],
  }, ctx));
  asgn = store.getState().assignments.find((x) => x.id === asgnId)!;
  assertEq(asgn.unitsPerDay, 0.5, 'unitsPerDay bijgewerkt');
  assertEq(asgn.curve, 'UNIFORM', 'curve bijgewerkt');

  okData(await call('planner_manage_assignments', {
    actions: [{ action: 'move', assignmentId: asgnId, taskId: b }],
  }, ctx));
  asgn = store.getState().assignments.find((x) => x.id === asgnId)!;
  assertEq(asgn.taskId, b, 'toewijzing verplaatst naar taak B');
  assertEq(store.getState().tasks.find((t) => t.id === a)!.resourceIds, [], 'resourceIds op A opgeruimd');
  assertEq(store.getState().tasks.find((t) => t.id === b)!.resourceIds, [r], 'resourceIds op B bijgewerkt');

  const rmRes = await call('planner_manage_assignments', {
    actions: [{ action: 'remove', assignmentId: asgnId }],
  }, ctx);
  assertEq(okData(rmRes).removed, [asgnId], 'verwijderde assignmentId gerapporteerd');
  assertEq(store.getState().assignments.filter((x) => x.id === asgnId).length, 0, 'toewijzing is weg');
});

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
  assert(/already assigned|double/i.test(rejections(res)[0].reason), 'de reden noemt de dubbeltelling');
  assertEq(store.getState().assignments.filter((x) => x.taskId === a && x.resourceId === r).length, 1,
    'de store bevat precies één toewijzing (geen dubbeltelling)');
});

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
      { action: 'add', taskId: a, resourceId: r, unitsPerDay: 1, curve: 'bell' },
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

test('level_resources: botsende pins melden conflictdagen zonder verplichte zoekreden (322)', async () => {
  const { a, b, r } = levelingFixture();
  store.getState().updateTask(a, { priority: 1000 });
  store.getState().updateTask(b, { priority: 1000 });
  const movable = addTask('Verplaatsbaar', 1);
  store.getState().assignResource(movable, r, 1);
  store.getState().runCPM();
  const before = JSON.stringify(createSnapshot(store.getState()));
  const data = okData(await call('planner_level_resources', { constrainToFloat: false, dryRun: true }, makeCtx()));
  for (const id of [a, b]) {
    assert(data.unresolved[id].length > 0, 'pinconflictdagen staan in unresolved');
    assertEq(data.unresolvedReasons[id], undefined, 'geen zoekreden verzonnen voor pin');
  }
  assert(data.warnings.some((w: string) => w.includes('Pinned tasks') && w.includes('no search reason')),
    'waarschuwing legt ontbrekende zoekreden bij pins uit');
  assert(data.warnings.some((w: string) => w.includes('`unresolved` for conflict dates')),
    'waarschuwing verwijst naar de aanwezige conflictdagen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), before, 'preview laat document ongewijzigd');
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
  assert(data.projectEndDelta && typeof data.projectEndDelta.calendarDays === 'number',
    'projectEndDelta prominent bij constrainToFloat:false');
  assertEq(data.projectEnd, store.getState().cpmResult!.projectEnd, 'projectEnd komt uit de verse store');
  store.getState().undo();
  assertEq(store.getState().tasks.filter((t) => t.levelingDelay !== undefined).length, 0,
    'één undo wist alle levelingDelays');
});

test('level_resources: stale planning ⇒ eerst herrekend (WP8-guardpatroon)', async () => {
  levelingFixture();
  store.getState().addTask({ name: 'maakt stale' });
  assertEq(store.getState().scheduleStale, true, 'testvoorwaarde: planning is stale');
  const ctx = makeCtx();
  const res = await call('planner_level_resources', { constrainToFloat: true, dryRun: true }, ctx);
  const data = okData(res);
  assertEq(data.recomputed, true, 'de respons meldt dat er eerst is herrekend');
  assertEq(store.getState().scheduleStale, false, 'de planning is nu vers');
  assertEq(data.projectEnd, data.projectEndBefore, 'dryRun laat het werkelijke projecteinde ongemoeid');
});

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

test('clear_leveling: ziet dezelfde nivelleeruitvoer als de store (sub-dag-delay, nivelleergaten)', async () => {
  reset();
  const subDay = addTask('alleen sub-dag-delay', 5);
  const gapOnly = addTask('alleen nivelleergat', 5);
  const importSplit = { afterMinutes: 480, gapMinutes: 480 };
  store.setState((s) => {
    const a = s.tasks.find((t) => t.id === subDay)!;
    a.levelingDelayMinutes = 90;
    const b = s.tasks.find((t) => t.id === gapOnly)!;
    b.splitGaps = [importSplit, { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' }];
  });
  assertEq(store.getState().tasks.filter((t) => t.levelingDelay !== undefined).length, 0,
    'voorwaarde: geen enkele hele-dag-levelingDelay');
  const undoLen = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const data = okData(await call('planner_clear_leveling', {}, makeCtx()));
  assertEq(data.cleared, 2, 'beide taken tellen mee (vóór de fix: 0, en er gebeurde niets)');
  const after = store.getState().tasks;
  assertEq(after.find((t) => t.id === subDay)!.levelingDelayMinutes, undefined, 'sub-dag-delay gewist');
  assertEq(after.find((t) => t.id === gapOnly)!.splitGaps, [importSplit], 'nivelleergat weg, importsplit blijft');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, undoLen + 1,
    'precies één undo-stap');
});

test('update_project: statusdatum landt; startDate is GEEN volledige Δ-verschuiving zoals move_project (T7-review H1: wél de gerichte klem-uitzondering op een wortel-taak zonder voorganger/constraint)', async () => {
  reset();
  const a = addTask('bestaand (wortel)', 5);
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
  const aStartAfter = store.getState().tasks.find((t) => t.id === a)!.time.scheduleStart;
  assert(aStartAfter !== aStartBefore, 'de wortel-taak zonder voorganger/constraint IS meegeklemd (anker gewijzigd)');
  const clampEngine = new CalendarEngine(store.getState().calendar);
  let expectedAnchor = parseDate(nieuweStart);
  while (!clampEngine.isWorkDay(expectedAnchor)) {
    expectedAnchor = addCalendarDays(expectedAnchor, 1);
  }
  assertEq(aStartAfter, `${formatDate(expectedAnchor)}T07:00`,
    'de wortel-taak klemt naar de EERSTE werkdag op/ná de nieuwe startDate (onafhankelijk dag-voor-dag berekend via CalendarEngine.isWorkDay, niet via snapWorkInstantOnOrAfter)');
  assertEq(data.anchorsClamped, 1, 'de respons meldt het geklemde aantal');
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
  const fresh = store.getState().tasks.find((t) => t.id === a)!.time.earlyStart;
  assertEq(store.getState().baselines[0].tasks.find((r) => r.taskId === a)!.start, fresh,
    'baseline-startdatum = de herrekende earlyStart');
});

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
  const generator = tools.find((t) => t.name === 'planner_update_calendar')
    .inputSchema.properties.calendars.items.properties.generate.properties;
  assert(generator.country.enum.includes('BO'), 'de dispatcher publiceert Bolivia in de landenlijst');
  assert(generator.region.description.includes('P = Potosí'), 'het schema geeft de regiocode voor Potosí');
  assert(generator.country.enum.includes('CA'), 'de dispatcher publiceert Canada in de landenlijst');
  assert(generator.region.description.includes('NU = Nunavut'), 'het schema geeft de regiocode voor Nunavut');
  assertEq(tools.find((t) => t.name === 'planner_clear_leveling').annotations.destructiveHint, false,
    'clear_leveling draagt GEEN destructiveHint (afgeleide, herberekenbare waarden)');
  assert(/resets earlier leveling itself/i.test(tool('planner_level_resources').description),
    'level_resources-beschrijving legt uit dat het zelf eerdere nivellering wist');
});

test('update_calendar: accepteert regiocodes voor Bolivia en Canada', async () => {
  reset();
  store.getState().setProject({ startDate: '2026-01-01' });
  const id = store.getState().project.calendarId;
  const generate = { country: 'BO', region: 'P' };
  const ctx = makeCtx();
  const result = await call('planner_update_calendar', { calendars: [{ id, generate }] }, ctx);
  assertEq(rejections(result).length, 0, 'P is een geldige regiocode');
  const before = store.getState().calendar;
  assert(before.holidays.some(h => h.startDate === '2026-11-10'), 'P voegt de vrije dag in Potosí toe');
  const wrongCode = await call('planner_update_calendar', {
    calendars: [{ id, generate: { ...generate, region: 'Potosí' } }],
  }, ctx);
  assert(rejections(wrongCode)[0]?.reason.includes('P = Potosí'), 'geef bij een weigering de geldige codes');
  assertEq(store.getState().calendar, before, 'ongeldige regio overschrijft de bestaande kalender niet');

  const nunavut = await call('planner_update_calendar', {
    calendars: [{ id, generate: { country: 'CA', region: 'NU' } }],
  }, ctx);
  assertEq(rejections(nunavut).length, 0, 'NU is een geldige regiocode');
  const regional = store.getState().calendar;
  assert(regional.holidays.some(h => h.name === 'Nunavut Day' && h.startDate === '2026-07-09'), 'Nunavut Day is vrij');
  const federal = await call('planner_update_calendar', {
    calendars: [{ id, generate: { country: 'CA' } }],
  }, ctx);
  assertEq(rejections(federal).length, 0, 'Canada zonder regio genereert federale dagen');
  assert(store.getState().calendar.holidays.some(h => h.name === 'Boxing Day' && h.startDate === '2026-12-28'), 'federale vervangende vrije dag');
  assert(!store.getState().calendar.holidays.some(h => h.name === 'Nunavut Day'), 'Nunavut Day ontbreekt in de federale kalender');
  const wrongCanadianCode = await call('planner_update_calendar', {
    calendars: [{ id, generate: { country: 'CA', region: 'Nunavut' } }],
  }, ctx);
  assert(rejections(wrongCanadianCode)[0]?.reason.includes('NU = Nunavut'), 'Canada weigert een ongeldige code');
  const roundTrip = await call('planner_update_calendar', {
    calendars: [{ id, holidays: regional.holidays, generation: regional.generation }],
  }, ctx);
  assertEq(rejections(roundTrip).length, 0, 'Canada accepteert eerder gegenereerde dagen en herkomst');
  assertEq(store.getState().calendar.generation, regional.generation, 'de herkomst blijft bewaard');
});

await run();
