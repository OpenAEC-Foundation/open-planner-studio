// Audit-nasleep — STILLE FAALGEVALLEN in de kalender-/resource-/lees-tools (bevindingen K6, K7,
// H6-H11, L1/L4, M7). Elke case pint één geval vast waarin de bridge `ok` teruggaf ZONDER te doen
// wat er gevraagd werd, of waarin een foute invoerwaarde stil een ANDERE verzameling opleverde.
//
// De rode draad: een tool die liegt dat het gelukt is, is voor een AI-agent onherstelbaar — hij kan
// er niet omheen werken, want er is geen signaal. Elke fix hier maakt van een stille no-op een
// EXPLICIETE weigering (zacht per item waar dat kan, hard bij een enkelvoudige tool).
//
// Draait headless tegen de ECHTE store, net als cases-mutate-cal-res.ts / cases-read.ts: de
// muterende tools worden RECHTSTREEKS op hun module-array aangeroepen (buiten de dispatcher om, dus
// onafhankelijk van generieke schemavalidatie daar); de leestools via de registry.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { getTool } from '@/services/mcp/toolRegistry';
import { ensureFreshSchedule } from '@/services/mcp/staleGuard';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import type { WorkCalendar, Holiday } from '@/types/calendar';
import { createAppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';

const S = () => useAppStore.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry. Eén edit + undo zorgt dat die
// benigne promotie niet in een undoStack-assert opduikt.
S().addTask({ name: 'warmup' });
S().undo();

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...over,
  });
}

function mtool(name: string) {
  const def = calendarResourceTools.find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return def;
}
async function call(name: string, args: unknown): Promise<McpToolResult> {
  return await mtool(name).handler(args, makeCtx());
}
function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}
/** Leestool via de registry; retourneert het volledige resultaat (ok óf fout). */
function read(name: string, args: unknown = {}): McpToolResult {
  const t = getTool(name);
  assert(!!t, `leestool ${name} niet geregistreerd`);
  return t!.handler(args, makeCtx()) as McpToolResult;
}
function readOk(name: string, args: unknown = {}): any {
  const res = read(name, args);
  assert(res.ok, `leestool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}
/** Verwacht een FOUT met VALIDATION-code waarvan de boodschap `needle` bevat. */
function expectValidation(res: McpToolResult, needle: string, what: string): void {
  assert(!res.ok, `${what}: verwachtte een fout, kreeg ok`);
  const err = res as { ok: false; code?: string; error: string };
  assertEq(err.code, 'VALIDATION', `${what}: foutcode`);
  assert(err.error.includes(needle), `${what}: boodschap moet '${needle}' noemen, kreeg: ${err.error}`);
}

const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];
/** Schoon ma-vr-project vanaf 2026-06-01 (maandag). `holidays` naar keuze. */
function cleanProject(holidays: Holiday[] = []): void {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({ ...base, workDays: [...CLEAN_WORKDAYS], holidays: [...holidays] } as WorkCalendar);
  S().setProject({ startDate: '2026-06-01', name: 'Stille-noop-testproject' });
}

const VORST: Holiday = { name: 'Vorstverlet', startDate: '2026-06-10', endDate: '2026-06-10' };
const SLUITING: Holiday = { name: 'Bedrijfssluiting', startDate: '2026-07-20', endDate: '2026-07-24' };

// =================================================================================================
// K6 — `rawHolidays` was ALLEEN-TOEVOEGEN, en `rawHolidays: []` was een succesvol gemelde no-op.
// =================================================================================================

test('K6: `rawHolidays: []` in toevoeg-modus ⇒ zachte weigering, GEEN transactie, feestdagen onaangeroerd', async () => {
  cleanProject([VORST, SLUITING]);
  const calId = S().calendar.id;
  const undoBefore = S().undoStack.length;

  const res = await call('planner_update_calendar', { calendars: [{ id: calId, rawHolidays: [] }] });

  // Vóór de fix: ok met een rij `{created:false, promoted:true, becameLiteral:false}` — niet te
  // onderscheiden van een echte wijziging, terwijl er niets veranderde.
  const rej = rejections(res);
  assertEq(rej.length, 1, 'precies één zachte weigering');
  assert(/leeg|replace/i.test(rej[0].reason), `weigering moet de lege lijst benoemen: ${rej[0].reason}`);
  assertEq(okData(res).calendars.length, 0, 'geen enkele kalender-rij gemeld als gewijzigd');
  assertEq(S().undoStack.length, undoBefore, 'lege-batch-snelpad: geen undo-snapshot voor een no-op');
  assertEq(S().calendar.holidays.length, 2, 'feestdagen onaangeroerd');
});

test('K6: `holidaysMode: "replace"` VERVANGT de lijst — een feestdag kan echt worden verwijderd', async () => {
  cleanProject([VORST, SLUITING]);
  const calId = S().calendar.id;

  // De agent-opdracht "draai de vorstverletdag terug": stuur de OVERBLIJVENDE dagen in replace-modus.
  const res = await call('planner_update_calendar', {
    calendars: [{ id: calId, holidaysMode: 'replace', rawHolidays: [SLUITING] }],
  });
  okData(res);
  assertEq(rejections(res).length, 0, 'geen weigeringen');

  const cal = S().calendars.find((c) => c.id === calId)!;
  assertEq(cal.holidays.map((h) => h.name), ['Bedrijfssluiting'], 'vorstverlet is ECHT verwijderd');
  assertEq(S().calendar.holidays.map((h) => h.name), ['Bedrijfssluiting'], 'projectkalender-cache volgt');
});

test('K6: `holidaysMode: "replace"` met een LEGE lijst wist alle feestdagen', async () => {
  cleanProject([VORST, SLUITING]);
  const calId = S().calendar.id;
  const res = await call('planner_update_calendar', {
    calendars: [{ id: calId, holidaysMode: 'replace', rawHolidays: [] }],
  });
  okData(res);
  assertEq(rejections(res).length, 0, 'lege lijst is in replace-modus juist BETEKENISVOL');
  assertEq(S().calendars.find((c) => c.id === calId)!.holidays.length, 0, 'alle feestdagen weg');
});

test('K6: de standaard (toevoeg-)modus blijft mergen — regressie', async () => {
  cleanProject([VORST]);
  const calId = S().calendar.id;
  const res = await call('planner_update_calendar', { calendars: [{ id: calId, rawHolidays: [SLUITING] }] });
  okData(res);
  const namen = S().calendars.find((c) => c.id === calId)!.holidays.map((h) => h.name).sort();
  assertEq(namen, ['Bedrijfssluiting', 'Vorstverlet'], 'merge-semantiek ongewijzigd');
});

test('K6: de beschrijving BENOEMT de toevoeg-semantiek én de vervang-modus', () => {
  const d = mtool('planner_update_calendar').description;
  assert(/toevoeg|voegt.*toe/i.test(d), 'description moet de toevoeg-semantiek benoemen');
  assert(/replace/i.test(d), 'description moet `holidaysMode: replace` benoemen (verwijderen/vervangen)');
});

test('K6: onbruikbare rawHolidays-vorm ⇒ zachte weigering i.p.v. rommel in de store', async () => {
  cleanProject([]);
  const calId = S().calendar.id;
  const res = await call('planner_update_calendar', {
    calendars: [{ id: calId, rawHolidays: [{ name: 'Fout', startDate: '10-06-2026', endDate: '10-06-2026' }] }],
  });
  assertEq(rejections(res).length, 1, 'één weigering voor de niet-ISO datum');
  assertEq(S().calendar.holidays.length, 0, 'niets in de store beland');
});

// =================================================================================================
// H7 — `generate.country` zonder enum: een foute waarde gooide een kale JS-TypeError.
// =================================================================================================

test('H7: onbekend `country` ⇒ ZACHTE weigering die de geldige verzameling noemt (geen TypeError)', async () => {
  cleanProject([]);
  const calId = S().calendar.id;
  const holidaysBefore = S().calendar.holidays.length;

  let res: McpToolResult;
  try {
    res = await call('planner_update_calendar', { calendars: [{ id: calId, generate: { country: 'ES' } }] });
  } catch (e) {
    assert(false, `update_calendar gooide een kale exception: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  const rej = rejections(res);
  assertEq(rej.length, 1, 'één zachte weigering');
  assert(rej[0].reason.includes('NL') && rej[0].reason.includes('none'),
    `weigering moet de geldige landcodes noemen (incl. none): ${rej[0].reason}`);
  assertEq(S().calendar.holidays.length, holidaysBefore, 'store onaangeroerd');
});

test('H7: landcode is HOOFDLETTERGEVOELIG — `nl` wordt geweigerd, niet stil gecorrigeerd', async () => {
  cleanProject([]);
  const res = await call('planner_update_calendar', {
    calendars: [{ id: S().calendar.id, generate: { country: 'nl' } }],
  });
  assertEq(rejections(res).length, 1, 'kleine letters worden geweigerd');
});

test('H7: `country: "none"` is een GELDIGE waarde en wist de gegenereerde feestdagen', async () => {
  cleanProject([]);
  const calId = S().calendar.id;
  // Eerst NL genereren, dan met 'none' terug naar leeg.
  okData(await call('planner_update_calendar', { calendars: [{ id: calId, generate: { country: 'NL' } }] }));
  assert(S().calendars.find((c) => c.id === calId)!.holidays.length > 0, 'precondition: NL-feestdagen gegenereerd');

  const res = await call('planner_update_calendar', { calendars: [{ id: calId, generate: { country: 'none' } }] });
  okData(res);
  assertEq(rejections(res).length, 0, "'none' is geldig");
  assertEq(S().calendars.find((c) => c.id === calId)!.holidays.length, 0, "country 'none' wist de gegenereerde dagen");
});

test('H7: het schema draagt een enum op `country` en de beschrijving noemt `none`', () => {
  const sch = mtool('planner_update_calendar').inputSchema as any;
  const country = sch.properties.calendars.items.properties.generate.properties.country;
  assert(Array.isArray(country.enum), '`country` moet een enum dragen');
  assert(country.enum.includes('none') && country.enum.includes('CH'), `enum onvolledig: ${JSON.stringify(country.enum)}`);
  assert(/none/.test(country.description), '`none` moet gedocumenteerd zijn');
});

// =================================================================================================
// M7 — een "leeg" aangemaakte kalender erfde stil de app-default-feestdagen (NL).
// =================================================================================================

test('M7: create zonder generate/rawHolidays MELDT expliciet dat de app-default-feestdagen zijn overgenomen', async () => {
  cleanProject([]);
  const res = await call('planner_update_calendar', {
    calendars: [{ id: 'nieuw-1', create: true, name: 'Lege kalender', workDays: [1, 2, 3, 4, 5] }],
  });
  const data = okData(res);
  const row = data.calendars[0];
  assertEq(row.created, true, 'aangemaakt');
  const cal = S().calendars.find((c) => c.id === row.id)!;
  // De inhoud is niet het punt (dat is een app-default-keuze); het STIL zijn erover wél.
  assertEq(row.holidayCount, cal.holidays.length, 'de rij meldt het aantal feestdagen van de nieuwe kalender');
  if (cal.holidays.length > 0) {
    assertEq(row.holidaysFrom, 'app-default', 'herkomst expliciet benoemd');
    assert(Array.isArray(data.warnings) && data.warnings.some((w: string) => /overgenomen|app-default|standaard/i.test(w)),
      `er hoort een waarschuwing over de overgenomen feestdagen te staan: ${JSON.stringify(data.warnings)}`);
  }
});

// =================================================================================================
// K7 — `update_project` dropte onbekende sleutels stil zodra er één bekende bij zat.
// =================================================================================================

test('K7: `{name, endDate}` ⇒ endDate wordt ECHT geschreven (was: stil gedropt)', async () => {
  cleanProject([]);
  const res = await call('planner_update_project', { name: 'Nieuwe naam', endDate: '2027-01-01' });
  const data = okData(res);
  assert(data.updated.includes('endDate'), `updated moet endDate bevatten: ${JSON.stringify(data.updated)}`);
  assertEq(S().project.endDate, '2027-01-01', 'endDate staat in de store');
  assertEq(S().project.name, 'Nieuwe naam', 'name staat in de store');
});

test('K7: een ONBEKENDE sleutel wordt bij naam geweigerd, ook naast een geldige sleutel', async () => {
  cleanProject([]);
  const naamVoor = S().project.name;
  const res = await call('planner_update_project', { name: 'Poging', bestaatNiet: 42 });
  expectValidation(res, 'bestaatNiet', 'onbekende sleutel');
  assert((res as any).error.includes('endDate'), 'de fout moet de toegestane sleutels opsommen');
  assertEq(S().project.name, naamVoor, 'niets gemuteerd bij een structurele fout');
});

test('K7: `progressMode` is schrijfbaar (enum) en een foute waarde wordt geweigerd', async () => {
  cleanProject([]);
  okData(await call('planner_update_project', { progressMode: 'PROGRESS_OVERRIDE' }));
  assertEq(S().project.progressMode, 'PROGRESS_OVERRIDE', 'progressMode geschreven');
  // Leeswijzer-consistentie: get_project_info geeft hem terug.
  assertEq(readOk('planner_get_project_info').project.progressMode, 'PROGRESS_OVERRIDE', 'leeskant spiegelt');

  const bad = await call('planner_update_project', { progressMode: 'SNEL' });
  expectValidation(bad, 'progressMode', 'ongeldige progressMode');
  assertEq(S().project.progressMode, 'PROGRESS_OVERRIDE', 'onveranderd na de weigering');

  okData(await call('planner_update_project', { progressMode: null }));
  assert(S().project.progressMode === undefined, 'null wist de modus terug naar de default');
});

test('K7: `schedulingOptions`/`floatPaths` worden EXPLICIET geweigerd met uitleg (niet stil gedropt)', async () => {
  cleanProject([]);
  const res = await call('planner_update_project', {
    name: 'X', floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 5 },
  });
  expectValidation(res, 'floatPaths', 'floatPaths');
  assert(/niet.*bridge|app|Planning/i.test((res as any).error), 'de fout moet zeggen waar het wél kan');
});

test('K7: een ongeldige endDate-vorm wordt geweigerd; lege string wist hem', async () => {
  cleanProject([]);
  expectValidation(await call('planner_update_project', { endDate: '01-01-2027' }), 'endDate', 'niet-ISO endDate');
  okData(await call('planner_update_project', { endDate: '2027-03-01' }));
  okData(await call('planner_update_project', { endDate: '' }));
  assertEq(S().project.endDate, '', 'lege string wist de einddatum');
});

// =================================================================================================
// H8 — `dryRun` werd niet getypecheckt: `dryRun: "true"` voerde een ECHTE nivellering uit.
// =================================================================================================

/** Klein project met één overbelaste resource, zodat nivelleren daadwerkelijk iets doet. */
function overloadedProject(): void {
  cleanProject([]);
  const r = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  for (const id of [a, b]) {
    const t = S().tasks.find((x) => x.id === id)!;
    S().updateTask(id, { time: { ...t.time, scheduleDuration: 3, scheduleStart: '2026-06-01' } });
    S().assignResource(id, r, 1);
  }
  S().runCPM();
}

test('H8: `dryRun: "true"` (string) ⇒ VALIDATION-fout, NIET stil een echte nivellering', async () => {
  overloadedProject();
  const undoBefore = S().undoStack.length;
  const res = await call('planner_level_resources', { dryRun: 'true' });
  expectValidation(res, 'dryRun', 'dryRun als string');
  assertEq(S().undoStack.length, undoBefore, 'geen mutatie/undo-stap');
  assert(S().tasks.every((t) => t.levelingDelay === undefined), 'geen enkele levelingDelay gezet');
});

test('H8: `dryRun: 1` ⇒ VALIDATION-fout', async () => {
  overloadedProject();
  expectValidation(await call('planner_level_resources', { dryRun: 1 }), 'dryRun', 'dryRun als getal');
});

test('H8: echte `dryRun: true` blijft werken en muteert niets — regressie', async () => {
  overloadedProject();
  const undoBefore = S().undoStack.length;
  const data = okData(await call('planner_level_resources', { dryRun: true }));
  assertEq(data.dryRun, true, 'dryRun gemeld');
  assertEq(S().undoStack.length, undoBefore, 'preview muteert niet');
});

test('H8: `shiftBaselines: "ja"` ⇒ VALIDATION-fout (zelfde patroon, lagere inzet)', async () => {
  cleanProject([]);
  S().addTask({ name: 'A' });
  const res = await call('planner_move_project', { newStartDate: '2026-07-01', shiftBaselines: 'ja' });
  expectValidation(res, 'shiftBaselines', 'shiftBaselines als string');
  assertEq(S().project.startDate, '2026-06-01', 'niets verschoven');
});

// =================================================================================================
// H9 — `ensureFreshSchedule` miste het NOOIT-berekende document (cpmResult null, scheduleStale false).
// =================================================================================================

/** Herstel-achtige toestand: een geladen project ZONDER doorrekenen ⇒ cpmResult null + niet-stale. */
function neverCalculatedProject(): void {
  const gen = generateBenchmarkProject(30);
  S().applyLoadedProject(gen, { filePath: null, recompute: false });
}

test('H9: nooit-berekend document (cpmResult null, niet-stale) ⇒ ensureFreshSchedule REKENT', () => {
  neverCalculatedProject();
  assertEq(S().scheduleStale, false, 'precondition: niet stale (verse payload)');
  assert(S().cpmResult === null, 'precondition: nog nooit gerekend');
  const undoBefore = S().undoStack.length;

  const out = ensureFreshSchedule();

  assertEq(out.recomputed, true, 'recomputed moet true zijn — er wás geen resultaat');
  assert(S().cpmResult !== null, 'cpmResult is nu gezet');
  assertEq(S().undoStack.length, undoBefore, 'runCPM-invariant: geen undo-snapshot');
});

test('H9: `save_baseline` op een nooit-berekend document legt VERSE datums vast (description was onwaar)', async () => {
  neverCalculatedProject();
  const res = await call('planner_save_baseline', { name: 'Nulmeting' });
  const data = okData(res);
  assertEq(data.recomputed, true, 'de tool meldt dat er eerst is herrekend');
  assert(!!data.projectEnd, 'de baseline draagt een echt projecteinde');
  const bl = S().baselines.find((b) => b.id === data.baselineId)!;
  assertEq(bl.projectEnd, S().cpmResult!.projectEnd, 'baseline-einde == verse planning');
});

test('H9: `level_resources` op een nooit-berekend document rekent eerst (before/after zijn zinvol)', async () => {
  neverCalculatedProject();
  const data = okData(await call('planner_level_resources', { dryRun: true }));
  assertEq(data.recomputed, true, 'recomputed gemeld');
  assert(!!data.projectEndBefore, 'projectEndBefore gevuld');
});

test('H9: MCP-versheidspaden voor histogram, leveling en baseline blijven volledig in context B', async () => {
  cleanProject([]);
  S().setProject({ name: 'Versheids-MCP A' });
  S().addTask({ name: 'Alleen A' });
  S().runCPM();
  const aBefore = JSON.stringify(capturePayload(S()));
  const aCpm = S().cpmResult;

  const makeNeverCalculatedB = () => {
    const B = createAppStoreContext();
    B.store.getState().applyLoadedProject(generateBenchmarkProject(30), { filePath: null, recompute: false });
    B.store.getState().setProject({ name: 'Versheids-MCP B' });
    return { B, ctx: makeMcpContext(B) };
  };

  const histogramFixture = makeNeverCalculatedB();
  const histogramTool = getTool('planner_get_resource_histogram')!;
  const histogram = await histogramTool.handler({}, histogramFixture.ctx);
  assert(histogram.ok && (histogram.data as { recomputed: boolean }).recomputed,
    'histogram hoort de nooit-berekende B-context eerst te herrekenen');
  assert(histogramFixture.B.store.getState().cpmResult !== null, 'histogram hoort B van een cpmResult te voorzien');

  const levelingFixture = makeNeverCalculatedB();
  const leveling = await mtool('planner_level_resources').handler({ dryRun: true }, levelingFixture.ctx);
  assert(leveling.ok && (leveling.data as { recomputed: boolean }).recomputed,
    'leveling hoort de nooit-berekende B-context eerst te herrekenen');
  assert(levelingFixture.B.store.getState().cpmResult !== null, 'leveling hoort B van een cpmResult te voorzien');

  const baselineFixture = makeNeverCalculatedB();
  const baseline = await mtool('planner_save_baseline').handler({ name: 'B-nulmeting' }, baselineFixture.ctx);
  assert(baseline.ok && (baseline.data as { recomputed: boolean }).recomputed,
    'save_baseline hoort de nooit-berekende B-context eerst te herrekenen');
  assert(baselineFixture.B.store.getState().baselines.some((item) => item.name === 'B-nulmeting'),
    'de baseline hoort uitsluitend in B te zijn opgeslagen');

  assertEq(JSON.stringify(capturePayload(S())), aBefore,
    'de drie versheidspaden op B mogen A byte-inhoudelijk niet wijzigen');
  assert(S().cpmResult === aCpm, 'de drie B-versheidspaden mogen A niet herrekenen');
});

test('H9: al-berekend + niet-stale ⇒ nog steeds GEEN recompute (referentie identiek) — regressie', () => {
  cleanProject([]);
  S().addTask({ name: 'A' });
  S().runCPM();
  const before = S().cpmResult;
  const out = ensureFreshSchedule();
  assertEq(out.recomputed, false, 'niet herrekend');
  assert(S().cpmResult === before, 'cpmResult-referentie ongewijzigd');
});

// =================================================================================================
// H10 — `list_tasks`-filters waren ongevalideerd: een fout filter gaf STIL de verkeerde verzameling.
// =================================================================================================

test('H10: `kritiek: "true"` ⇒ VALIDATION-fout (was: de VOLLEDIGE lijst als "kritiek")', () => {
  neverCalculatedProject();
  S().runCPM();
  expectValidation(read('planner_list_tasks', { kritiek: 'true' }), 'kritiek', 'kritiek als string');
});

test('H10: `status: "started"` ⇒ VALIDATION-fout die de toegestane waarden noemt (was: leeg)', () => {
  const res = read('planner_list_tasks', { status: 'started' });
  expectValidation(res, 'status', 'kleine-letter status');
  assert((res as any).error.includes('NOT_STARTED'), 'de fout moet de enum opsommen');
});

test('H10: `van: "01-03-2026"` ⇒ VALIDATION-fout (was: rommel-lexicografie)', () => {
  expectValidation(read('planner_list_tasks', { van: '01-03-2026' }), 'van', 'niet-ISO van');
  expectValidation(read('planner_list_tasks', { tot: 'morgen' }), 'tot', 'niet-ISO tot');
});

test('H10: `zonder_relaties: "ja"` ⇒ VALIDATION-fout', () => {
  expectValidation(read('planner_list_tasks', { zonder_relaties: 'ja' }), 'zonder_relaties', 'niet-boolean');
});

test('L1: `limit: 0` / `limit: 5000` ⇒ VALIDATION-fout i.p.v. een stille klem', () => {
  expectValidation(read('planner_list_tasks', { limit: 0 }), 'limit', 'limit 0');
  expectValidation(read('planner_list_tasks', { limit: 5000 }), 'limit', 'limit boven de bovengrens');
  expectValidation(read('planner_list_tasks', { offset: -1 }), 'offset', 'negatieve offset');
  // Geldige waarden blijven werken.
  assert(readOk('planner_list_tasks', { limit: 1000, offset: 0 }).tasks.length > 0, 'geldige paginering werkt');
});

test('H10: geldige filters blijven exact werken — regressie', () => {
  neverCalculatedProject();
  S().runCPM();
  const crit = readOk('planner_list_tasks', { kritiek: true, limit: 1000 });
  assert(crit.tasks.every((t: any) => t.crit === true), 'kritiek-filter werkt');
  const st = readOk('planner_list_tasks', { status: 'NOT_STARTED', limit: 1000 });
  assert(st.total > 0, 'status-filter werkt');
});

test('H10: histogram `bucket: "day"` ⇒ VALIDATION-fout (was: stil "week")', () => {
  neverCalculatedProject();
  S().runCPM();
  const res = read('planner_get_resource_histogram', { bucket: 'day', resourceIds: [S().resources[0].id] });
  expectValidation(res, 'bucket', 'engelse bucket');
  assert((res as any).error.includes('dag'), 'de fout moet de geldige waarden noemen');
});

test('H10: histogram met een niet-string in `resourceIds` ⇒ VALIDATION-fout (was: stil aggregaat)', () => {
  neverCalculatedProject();
  S().runCPM();
  expectValidation(read('planner_get_resource_histogram', { resourceIds: [123] }), 'resourceIds', 'niet-string id');
});

test('H10: histogram met een ONBEKEND resource-id ⇒ VALIDATION-fout die het id noemt', () => {
  neverCalculatedProject();
  S().runCPM();
  const res = read('planner_get_resource_histogram', { resourceIds: ['bestaat-niet'] });
  expectValidation(res, 'bestaat-niet', 'onbekend resource-id');
});

test('H10: histogram — geldige scope blijft werken, en de validatie draait VÓÓR de recompute', () => {
  neverCalculatedProject();
  const undoBefore = S().undoStack.length;
  // Ongeldige args op een NIET-doorgerekend document: er mag niet eerst duur herrekend worden.
  expectValidation(read('planner_get_resource_histogram', { bucket: 'day' }), 'bucket', 'bucket vóór recompute');
  assert(S().cpmResult === null, 'validatie vóór de recompute: er is niets gerekend');
  assertEq(S().undoStack.length, undoBefore, 'geen undo-effect');

  const data = readOk('planner_get_resource_histogram', { resourceIds: [S().resources[0].id], bucket: 'dag' });
  assertEq(data.mode, 'detail', 'gescopte call blijft detail leveren');
});

// =================================================================================================
// H11 — onbekende `resourceIds` in `level_resources` gaven een stille nul-effect-run.
// =================================================================================================

test('H11: onbekend resource-id ⇒ VALIDATION-fout die het id noemt (was: "niets te nivelleren")', async () => {
  overloadedProject();
  const res = await call('planner_level_resources', { resourceIds: ['res-bestaat-niet'], dryRun: true });
  expectValidation(res, 'res-bestaat-niet', 'onbekend resource-id');
});

test('H11: LEGE `resourceIds` ⇒ VALIDATION-fout (selectie zonder inhoud is nooit bedoeld)', async () => {
  overloadedProject();
  expectValidation(await call('planner_level_resources', { resourceIds: [] }), 'resourceIds', 'lege selectie');
});

test('H11: een geldige resourceIds-selectie blijft werken — regressie', async () => {
  overloadedProject();
  const rid = S().resources[0].id;
  const data = okData(await call('planner_level_resources', { resourceIds: [rid], dryRun: true }));
  assertEq(data.dryRun, true, 'preview gedraaid');
});

// =================================================================================================
// H6 — `get_project_overview` gaf geen id's terug, terwijl het DE call voor structuurwerk heet.
// =================================================================================================

test('H6: elke overview-rij draagt `id` (== Task.id), zodat mutatietools er direct op kunnen sleutelen', () => {
  cleanProject([]);
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const seq = S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 2 });
  S().runCPM();

  const data = readOk('planner_get_project_overview');
  const ids = data.tasks.map((r: any) => r.id);
  assert(ids.includes(a) && ids.includes(b), `overview mist taak-id's: ${JSON.stringify(ids)}`);

  // De relatienotatie draagt het sequence-id, zodat remove_dependencies (die op sequence-id's werkt)
  // uit DEZE ene call gevoed kan worden.
  const aRow = data.tasks.find((r: any) => r.id === a);
  assertEq(aRow.rels.length, 1, 'één uitgaande relatie');
  assert(aRow.rels[0].includes(seq), `relatienotatie moet het seq-id dragen: ${aRow.rels[0]}`);
  assert(aRow.rels[0].includes('FS+2d'), 'de compacte notatie blijft leesbaar');
});

test('H6/L4: de beschrijvingen benoemen de naamdrift lezen↔schrijven', () => {
  const ov = getTool('planner_get_project_overview')!.description;
  assert(/\bid\b/.test(ov), 'overview-description moet de id-velden benoemen');
  const gt = getTool('planner_get_task')!.description;
  assert(/wbsCode/.test(gt) || /wbsCode/.test(ov), '`wbs` ↔ `wbsCode` moet ergens expliciet zijn');
});

// =================================================================================================
// BATCH-PAD — `planner_batch` dispatcht via `batchStep` en komt dus NIET langs de schemavalidatie
// in de dispatcher. Voor deze toolmodule is dat geen gat: elke `batchStep` loopt door exact dezelfde
// `parse*`-functies als de losse handler, dus alle validaties hierboven gelden ook binnen een batch.
// Deze twee cases pinnen dat vast, zodat het niet stil kan wegrotten.
// =================================================================================================

/** Draai `planner_batch` met de echte, geregistreerde tools. */
async function batch(steps: { tool: string; args: unknown }[]): Promise<McpToolResult> {
  const def = getTool('planner_batch');
  assert(!!def, 'planner_batch niet geregistreerd');
  return (await def!.handler({ steps }, makeCtx())) as McpToolResult;
}

test('BATCH: een onbekende `update_project`-sleutel rolt de HELE batch terug (validatie geldt ook via batchStep)', async () => {
  cleanProject([]);
  const naamVoor = S().project.name;
  const undoBefore = S().undoStack.length;

  const res = await batch([
    { tool: 'planner_update_project', args: { name: 'Mag niet blijven staan' } },
    { tool: 'planner_update_project', args: { name: 'Tweede', bestaatNiet: 1 } },
  ]);

  assert(!res.ok, 'een structurele stapfout hoort de batch om te gooien');
  assert((res as any).error.includes('bestaatNiet') || JSON.stringify((res as any).errorData ?? '').includes('bestaatNiet'),
    `de fout moet de onbekende sleutel noemen: ${(res as any).error}`);
  assertEq(S().project.name, naamVoor, 'volledige rollback: ook de eerste stap is terug');
  assertEq(S().undoStack.length, undoBefore, 'geen achtergebleven undo-stap');
});

test('BATCH: een lege `rawHolidays` blijft ook binnen een batch een ZACHTE weigering', async () => {
  cleanProject([VORST]);
  const calId = S().calendar.id;

  const res = await batch([
    { tool: 'planner_update_calendar', args: { calendars: [{ id: calId, rawHolidays: [] }] } },
  ]);

  const data = okData(res);
  const rej: { id: string; reason: string }[] = data.rejections ?? [];
  assert(rej.some((r) => /leeg|replace/i.test(r.reason)),
    `de zachte weigering moet in het batch-rapport staan: ${JSON.stringify(rej)}`);
  assertEq(S().calendar.holidays.length, 1, 'feestdagen onaangeroerd');
});

test('BATCH: een VERSCHREVEN leesfilter wordt ook als batch-stap geweigerd (leestools hebben geen batchStep)', async () => {
  neverCalculatedProject();
  S().runCPM();
  const totaal = S().tasks.length;
  assert(totaal > 1, 'precondition: meer dan één taak');

  // `kritisch` i.p.v. `kritiek`. LOS wordt dat door de schemapoort in de dispatcher geweigerd, maar
  // planner_batch roept leestools via `def.handler(...)` aan en slaat die poort dus over. Zonder een
  // EIGEN sleutelpoort in de leestool kreeg de aanroeper hier `status:"uitgevoerd"` met ALLE taken —
  // een plausibel-maar-onjuist antwoord waarop hij zijn volgende stap bouwt.
  const res = await batch([{ tool: 'planner_list_tasks', args: { kritisch: true, limit: 1000 } }]);

  assert(!res.ok, 'een verschreven filter hoort ook binnen een batch te worden geweigerd');
  assert((res as any).error.includes('kritisch'), `de fout moet de sleutel noemen: ${(res as any).error}`);
  assert((res as any).error.includes('kritiek'), 'de fout moet de toegestane sleutels opsommen');
});

test('leestools: een onbekende sleutel wordt LOS geweigerd, ook op de argumentloze tools', () => {
  neverCalculatedProject();
  S().runCPM();
  expectValidation(read('planner_list_tasks', { kritisch: true }), 'kritisch', 'verschreven filter');
  expectValidation(read('planner_get_task', { id: 'x' }), 'id', 'get_task met `id` i.p.v. `taskId`');
  expectValidation(read('planner_list_resources', { type: 'LABOR' }), 'type', 'niet-bestaand list_resources-filter');
  expectValidation(read('planner_get_resource_histogram', { van: '2026-06-01', granulariteit: 'dag' }),
    'granulariteit', 'verzonnen histogram-parameter');
  expectValidation(read('planner_get_project_overview', { limit: 10 }), 'limit', 'overview neemt geen argumenten');
  // Geen argumenten meegeven blijft gewoon werken (batch geeft vaak `{}` door).
  assert(readOk('planner_get_project_overview', {}).tasks.length > 0, 'lege args blijven geldig');
  assert(readOk('planner_get_project_info').statistics.totalTasks > 0, 'geen args blijft geldig');
});

await run();
