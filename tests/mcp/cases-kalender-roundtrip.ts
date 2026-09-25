// Audit resources-kalenders, bevinding 3 (het duidelijke deel): `planner_get_calendars` geeft ook
// het pauzepatroon (`simpleBreakStartMinute`/`simpleBreakDurationMinutes`), de werkende
// uitzonderingen (`workingExceptions`) en de bibliotheekstempel (`libraryOrigin`) terug en belooft
// dat een lezing LETTERLIJK terug te schrijven is — maar `planner_update_calendar` weigerde die
// velden als "onbekend". Gevolg: een kalender met pauze of een werkende zaterdag was niet over te
// zetten, en zonder die velden herbouwd lag de pauze op een ander tijdstip.
//
// Dit bestand pint vast:
//   1. get → update (create, ander document) is veld voor veld identiek, voor ELK inhoudsveld van
//      WorkCalendar (de classificatie hieronder is uitputtend: een nieuw veld is een compileerfout);
//   2. hetzelfde per veld op het update-pad, met dezelfde afleiding als de kalenderdialoog
//      (netto uren uit werkdag + pauze, legacy-pauze eerst expliciet) en dezelfde validatie
//      (`calendarScalarBreakIssue`, `holidayIssue`, bandvorm) — ongeldig ⇒ zachte weigering;
//   3. `libraryOrigin` mag mee maar wordt genegeerd en gemeld (`ignoredFields`);
//   4. hetzelfde via `planner_batch` (schemapoort).
// Bewust NIET beslist (ontwerpvraag): wat een los meegegeven `hoursPerDay` op een kalender met
// pauze betekent — dat gedrag is ongemoeid gelaten en wordt hier niet vastgepind.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { readTools } from '@/services/mcp/tools/readTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine, effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import { parseDate } from '@/utils/dateUtils';
import { shiftPresetPatch } from '@/utils/shiftPresets';
import type { WorkCalendar } from '@/types/calendar';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

registerToolModules([readTools, calendarResourceTools, batchTools]);

function ctx(): McpContext {
  return makeMcpContext(appStoreContext, {});
}

async function call(name: string, args: unknown): Promise<McpToolResult> {
  const def = [...calendarResourceTools, ...readTools, ...batchTools].find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return await def.handler(args, ctx());
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}

function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}

async function readCalendar(id: string): Promise<any> {
  const cal = okData(await call('planner_get_calendars', {})).calendars.find((c: any) => c.id === id);
  assert(!!cal, `get_calendars kent '${id}' niet`);
  return cal;
}

const calById = (id: string): WorkCalendar => {
  const cal = S().calendars.find((c) => c.id === id);
  assert(!!cal, `kalender '${id}' ontbreekt`);
  return cal!;
};

const engineHoursPerDay = (cal: WorkCalendar): number => new CalendarEngine(calendarForEngine(cal)).hoursPerDay;

/**
 * Uitputtende indeling van de WorkCalendar-sleutels. `Record<keyof WorkCalendar, …>` maakt een
 * nieuw kalenderveld een compileerfout in deze test: dan moet iemand beslissen of de MCP-schrijfkant
 * hem letterlijk overneemt (`content`) of alleen accepteert en meldt (`ignored`).
 */
const FIELD_ROLE: Record<keyof WorkCalendar, 'id' | 'content' | 'ignored'> = {
  id: 'id',
  name: 'content',
  description: 'content',
  workDays: 'content',
  workStartHour: 'content',
  workEndHour: 'content',
  hoursPerDay: 'content',
  simpleBreakStartMinute: 'content',
  simpleBreakDurationMinutes: 'content',
  holidays: 'content',
  generation: 'content',
  workTime: 'content',
  shift: 'content',
  libraryOrigin: 'ignored',
  workingExceptions: 'content',
};
const CONTENT_FIELDS = (Object.keys(FIELD_ROLE) as (keyof WorkCalendar)[]).filter((k) => FIELD_ROLE[k] === 'content');

/** Een lezing via get → create in een ander document → get: elk inhoudsveld identiek. */
async function assertLiteralRoundTrip(srcId: string, label: string): Promise<void> {
  const src = await readCalendar(srcId);
  store.getState().newDocument();
  const res = await call('planner_update_calendar', { calendars: [{ ...src, create: true }] });
  assertEq(rejections(res), [], `${label}: geen enkele weigering op de letterlijke lezing`);
  const row = okData(res).calendars[0];
  assertEq(row.created, true, `${label}: aangemaakt in het tweede document`);
  const copy = await readCalendar(row.id);
  for (const field of CONTENT_FIELDS) {
    assertEq(copy[field], src[field], `${label}: veld \`${field}\` is letterlijk overgekomen`);
  }
  if (src.libraryOrigin !== undefined) {
    assert(row.ignoredFields?.includes('libraryOrigin'), `${label}: libraryOrigin wordt gemeld als ignoredFields`);
    assertEq(copy.libraryOrigin, undefined, `${label}: de bibliotheekstempel reist niet mee naar een ander document`);
  }
}

function reset(): void {
  S().newProject();
}

// =================================================================================================
// 1) LETTERLIJK — get → update(create) in een ander document, voor elk inhoudsveld
// =================================================================================================
test('dagkalender met pauze, werkende uitzondering en bibliotheekstempel: letterlijk overzetbaar', async () => {
  reset();
  const cid = S().addCompany('Bouwbedrijf');
  S().bindProjectToCompany(cid);
  const srcId = S().addCalendar({
    name: 'Kantoor', description: 'met halfuur lunch', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8.5,
    simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 30,
    holidays: [{ name: 'Bouwvak', startDate: '2026-07-20', endDate: '2026-08-07' }],
    generation: { ruleSetId: 'NL', breakChoice: 'noord', generatedFromYear: 2025, generatedToYear: 2028 },
    workingExceptions: [{ name: 'Inhaalzaterdag', startDate: '2026-06-06', endDate: '2026-06-06' }],
  });
  S().promoteCalendarToPool(cid, calById(srcId));
  const src = await readCalendar(srcId);
  assert(src.libraryOrigin !== undefined && src.simpleBreakStartMinute === 750 && Array.isArray(src.workingExceptions),
    'testvoorwaarde: de lezing draagt pauze, werkende uitzondering en stempel');
  await assertLiteralRoundTrip(srcId, 'dagkalender');
});

test('uurkalender met werkende uitzondering mét eigen banden: letterlijk overzetbaar', async () => {
  reset();
  const preset = shiftPresetPatch('two-shift');
  const srcId = S().addCalendar({
    name: 'Ploegen', description: '', workDays: preset.workDays,
    workStartHour: preset.workStartHour, workEndHour: preset.workEndHour, hoursPerDay: preset.hoursPerDay,
    holidays: [], workTime: preset.workTime, shift: preset.shift,
    workingExceptions: [{ name: 'Zaterdagdienst', startDate: '2026-06-13', endDate: '2026-06-13', bands: [{ start: 420, end: 720 }] }],
  });
  await assertLiteralRoundTrip(srcId, 'uurkalender');
});

// =================================================================================================
// 2) PER VELD op het update-pad, met de afleiding en validatie van de kalenderdialoog
// =================================================================================================
test('pauzeduur alleen: de legacy-pauze wordt expliciet (12:00) en de netto uren volgen, zoals de dialoog', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  // Uitgangspunt: legacy 07:00–16:00 / 8 u (impliciete pauze van 60 min rond 12:00).
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, simpleBreakDurationMinutes: 30 }] });
  assertEq(rejections(res), [], 'geaccepteerd');
  const cal = calById(projId);
  assertEq({ start: cal.simpleBreakStartMinute, duration: cal.simpleBreakDurationMinutes, hpd: cal.hoursPerDay },
    { start: 720, duration: 30, hpd: 8.5 }, 'pauze expliciet, netto uren afgeleid');
  assertEq(engineHoursPerDay(cal), 8.5, 'de engine rekent hetzelfde als het veld');
  assertEq(okData(res).calendars[0].hoursPerDayEffective, 8.5, 'de respons zegt hetzelfde');
});

test('pauzebegin alleen: de bestaande netto uren blijven (legacy-duur wordt expliciet)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, simpleBreakStartMinute: 750 }] });
  assertEq(rejections(res), [], 'geaccepteerd');
  const cal = calById(projId);
  assertEq({ start: cal.simpleBreakStartMinute, duration: cal.simpleBreakDurationMinutes, hpd: cal.hoursPerDay },
    { start: 750, duration: 60, hpd: 8 }, 'pauze 12:30–13:30, nog steeds 8 u netto');
  assertEq(effectiveWorkTimeBands(cal)!.byWeekday[1], [{ start: 420, end: 750 }, { start: 810, end: 960 }],
    'de werkblokken volgen de pauze');
});

test('werkdag verlengen op een kalender MET pauze: netto uren volgen (review r3c-e)', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, { simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60, hoursPerDay: 8 });
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workEndHour: 17 }] });
  assertEq(rejections(res), [], 'geaccepteerd');
  const cal = calById(projId);
  assertEq(cal.hoursPerDay, 9, 'hoursPerDay afgeleid uit 07–17 met 60 min pauze');
  assertEq(engineHoursPerDay(cal), 9, 'engine en veld zeggen hetzelfde');
  assertEq(okData(res).calendars[0].hoursPerDayEffective, 9, 'de respons zegt hetzelfde');
});

test('werkende uitzonderingen: schrijfbaar, maken de dag werkend, [] wist ze', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const saturday = { name: 'Inhaalzaterdag', startDate: '2026-06-06', endDate: '2026-06-06' };
  let res = await call('planner_update_calendar', { calendars: [{ id: projId, workingExceptions: [saturday] }] });
  assertEq(rejections(res), [], 'geaccepteerd');
  assertEq(calById(projId).workingExceptions, [saturday], 'opgeslagen');
  assertEq(new CalendarEngine(calendarForEngine(calById(projId))).isWorkDay(parseDate('2026-06-06')), true,
    'de zaterdag is voor de engine een werkdag');
  res = await call('planner_update_calendar', { calendars: [{ id: projId, workingExceptions: [] }] });
  assertEq(rejections(res), [], 'wissen geaccepteerd');
  assertEq('workingExceptions' in calById(projId), false, 'leeg = afwezig, zoals de lezers het opslaan');
});

test('libraryOrigin op het update-pad: gemeld, niet geschreven', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const fake = { companyId: 'x', libraryItemId: 'y', syncedVersion: 1, syncedHash: 'z' };
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, name: 'Hernoemd', libraryOrigin: fake }] });
  assertEq(rejections(res), [], 'geaccepteerd');
  assertEq(okData(res).calendars[0].ignoredFields, ['libraryOrigin'], 'gemeld');
  assertEq(calById(projId).libraryOrigin, undefined, 'geen vervalste bibliotheekstempel');
  assertEq(calById(projId).name, 'Hernoemd', 'de rest is wel toegepast');
});

// =================================================================================================
// 3) VALIDATIE — dezelfde regels als de dialoog; ongeldig ⇒ zachte weigering, kalender onaangeroerd
// =================================================================================================
test('ongeldige pauze of werkende uitzondering ⇒ zachte weigering met reden, kalender onaangeroerd', async () => {
  reset();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const before = JSON.stringify(calById(projId));
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ simpleBreakStartMinute: 900, simpleBreakDurationMinutes: 90 }, /binnen de werkdag/],
    [{ simpleBreakStartMinute: 420, simpleBreakDurationMinutes: 540 }, /hele werkdag/],
    [{ simpleBreakDurationMinutes: 12.5 }, /geheel aantal minuten/],
    [{ workStartHour: 13, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 }, /binnen de werkdag/],
    [{ workingExceptions: [{ name: 'Omgekeerd', startDate: '2026-06-13', endDate: '2026-06-06' }] }, /ligt vóór startDate/],
    [{ workingExceptions: [{ name: 'Band', startDate: '2026-06-13', endDate: '2026-06-13', bands: [{ start: 720, end: 420 }] }] }, /ligt niet ná/],
    [{ workingExceptions: [{ name: 'X', startDate: '2026-06-13', endDate: '2026-06-13', color: 'rood' }] }, /onbekend veld/],
  ];
  for (const [fields, reason] of cases) {
    const res = await call('planner_update_calendar', { calendars: [{ id: projId, ...fields }] });
    const rej = rejections(res);
    assertEq(rej.length, 1, `precies één weigering voor ${JSON.stringify(fields)}`);
    assert(reason.test(rej[0].reason), `reden voor ${JSON.stringify(fields)} noemt het probleem: ${rej[0].reason}`);
    assertEq(JSON.stringify(calById(projId)), before, `kalender onaangeroerd na ${JSON.stringify(fields)}`);
  }
});

// =================================================================================================
// 4) VIA planner_batch — de schemapoort laat de leesvorm door
// =================================================================================================
test('letterlijke lezing met pauze en werkende uitzondering via planner_batch', async () => {
  reset();
  const srcId = S().addCalendar({
    name: 'Kantoor', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17,
    hoursPerDay: 8.5, simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 30, holidays: [],
    workingExceptions: [{ name: 'Inhaalzaterdag', startDate: '2026-06-06', endDate: '2026-06-06' }],
  });
  const src = await readCalendar(srcId);
  store.getState().newDocument();
  const raw = await handleMcpMessage(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'planner_batch', arguments: { steps: [
      { tool: 'planner_update_calendar', args: { calendars: [{ ...src, create: true }] } },
    ] } },
  }), ctx());
  const msg = JSON.parse(raw);
  assert(msg.result !== undefined, `batch gaf een fout: ${raw.slice(0, 400)}`);
  const payload = JSON.parse(msg.result.content[0].text);
  assert(payload.ok !== false, `batch niet ok: ${JSON.stringify(payload).slice(0, 400)}`);
  assertEq(payload.itemRejections ?? [], [], 'geen weigeringen in de batch');
  const copy = calById(payload.data.steps[0].data.calendars[0].id);
  assertEq({ start: copy.simpleBreakStartMinute, duration: copy.simpleBreakDurationMinutes, hpd: copy.hoursPerDay, we: copy.workingExceptions },
    { start: 750, duration: 30, hpd: 8.5, we: src.workingExceptions }, 'pauze en werkende uitzondering overgekomen');
});

await run();
