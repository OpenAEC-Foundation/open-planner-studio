// Review PR #351 [BEVESTIGD]: `planner_update_calendar` met ALLEEN `workDays` op een UURkalender liet de
// werkblokken staan zoals ze waren. Een uurkalender met blokken op ma–wo kreeg zo `workDays` [1..5] met
// lege blokken op do/vr. Na opslaan als IFC kregen do/vr de blokken van maandag: de werktijd en de uren
// per dag veranderden stil.
//
// Besluit orkestrator: MCP volgt dezelfde regel als het kalendervenster (`workDaysSetPatch` in
// `src/services/subdayIo.ts`). Een nieuwe werkdag krijgt blokken volgens die regel (eerst een kopie van
// de eerste werkdag met blokken, anders de standaardwerkdag); een vervallen werkdag verliest zijn blokken.
// `hoursPerDay` volgt uit de blokken. Dit bestand pint dat vast, ook na een IFC-rondgang.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { readTools } from '@/services/mcp/tools/readTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { workDaysFromBands, workDaysSetPatch } from '@/services/subdayIo';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

registerToolModules([readTools, calendarResourceTools, batchTools]);

/** Via de ECHTE dispatch-weg (`handleMcpMessage`, recept mcp-tool stap 5): schemapoort inbegrepen. */
let rpcId = 0;
async function call(name: string, args: unknown): Promise<McpToolResult> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    makeMcpContext(appStoreContext, {}),
  );
  const msg = JSON.parse(raw);
  assert(msg.result !== undefined, `dispatch gaf een fout: ${raw.slice(0, 400)}`);
  return JSON.parse(msg.result.content[0].text) as McpToolResult;
}

function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data as any;
}

function rejections(res: McpToolResult): { id: string; reason: string }[] {
  return (res as McpToolOk).itemRejections ?? [];
}

const calById = (id: string): WorkCalendar => {
  const cal = S().calendars.find((c) => c.id === id);
  assert(!!cal, `kalender '${id}' ontbreekt`);
  return cal!;
};

type Block = { start: number; end: number };
function bandsOn(days: number[], blocks: Block[]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of days) byWeekday[d as 1] = blocks.map((b) => ({ ...b }));
  return { byWeekday };
}

const STANDAARD: Block[] = [{ start: 420, end: 720 }, { start: 780, end: 960 }]; // 07–12 + 13–16 = 8 h

/** Projectkalender als uurkalender, met één taak eraan (de IFC-rondgang moet hem dragen). */
async function hourProjectCalendar(workTime: WorkTimeBands, hoursPerDay?: number): Promise<string> {
  S().newProject();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, workTime, ...(hoursPerDay !== undefined ? { hoursPerDay } : {}) }],
  });
  assertEq(rejections(res), [], 'testvoorwaarde: de uurkalender is aangenomen');
  S().addTask({ name: 'Werk' });
  return projId;
}

/** Geen werkdag zonder blokken, en geen blokken op een niet-werkdag. */
function assertConsistent(cal: WorkCalendar, label: string): void {
  assert(!!cal.workTime, `${label}: het blijft een uurkalender`);
  assertEq(workDaysFromBands(cal.workTime!), [...cal.workDays].sort((a, b) => a - b),
    `${label}: werkdagen en blokken spreken elkaar niet tegen`);
}

/** IFC-rondgang: werktijd, werkdagen en uren per dag komen gelijk terug. */
function assertIfcStable(cal: WorkCalendar, label: string): void {
  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  assert(!!terug.workTime, `${label}: de uurkalender overleeft IFC`);
  for (let d = 1; d <= 7; d++) {
    assertEq(terug.workTime!.byWeekday[d as 1] ?? [], cal.workTime!.byWeekday[d as 1] ?? [],
      `${label}: de blokken van dag ${d} komen gelijk terug uit IFC`);
  }
  assertEq(terug.workDays, cal.workDays, `${label}: de werkdagen komen gelijk terug uit IFC`);
  assertEq(terug.hoursPerDay, cal.hoursPerDay, `${label}: de uren per dag komen gelijk terug uit IFC`);
}

// =================================================================================================
// 1) Het reviewscenario: blokken ma–wo, daarna alleen `workDays` [1..5]
// =================================================================================================
test('alleen workDays [1..5] op een uurkalender ma–wo ⇒ do/vr krijgen blokken zoals in het venster', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  const voor = calById(projId);
  const venster = workDaysSetPatch(voor, [1, 2, 3, 4, 5]);

  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workDays, [1, 2, 3, 4, 5], 'de werkdagen zijn ma–vr');
  assertEq(cal.workTime!.byWeekday[4], STANDAARD, 'donderdag krijgt de blokken van de eerste werkdag');
  assertEq(cal.workTime!.byWeekday[5], STANDAARD, 'vrijdag krijgt de blokken van de eerste werkdag');
  assertEq(cal.hoursPerDay, 8, 'de uren per dag blijven 8');
  assertEq({ workDays: cal.workDays, workTime: cal.workTime, hoursPerDay: cal.hoursPerDay }, venster,
    'MCP geeft precies wat het kalendervenster geeft (workDaysSetPatch)');
  assertEq(okData(res).calendars[0].hoursPerDayEffective, 8, 'de respons meldt 8 effectieve uren');
  assertConsistent(cal, 'ma–wo → ma–vr');
  assertIfcStable(cal, 'ma–wo → ma–vr');
});

test('reviewvariant: blok 07–17 met opgegeven hpd 8 ⇒ zelfde uitkomst als het venster, IFC gelijk', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], [{ start: 420, end: 1020 }]), 8);
  const venster = workDaysSetPatch(calById(projId), [1, 2, 3, 4, 5]);
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq({ workDays: cal.workDays, workTime: cal.workTime, hoursPerDay: cal.hoursPerDay }, venster,
    'werkdagen, blokken en uren volgen de regel van het venster');
  assertEq(cal.workTime!.byWeekday[5], [{ start: 420, end: 1020 }], 'vrijdag 07–17, zoals maandag');
  assertConsistent(cal, '07–17');
  assertIfcStable(cal, '07–17');
});

test('een eigen hoursPerDay in hetzelfde item blijft leidend', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5], hoursPerDay: 7.5 }],
  });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.hoursPerDay, 7.5, 'de opgegeven uren per dag staan');
  assertEq(cal.workTime!.byWeekday[5], STANDAARD, 'de blokken volgen wel de regel van het venster');
});

// =================================================================================================
// 2) Een werkdag vervalt
// =================================================================================================
test('alleen workDays [1..4] op een uurkalender ma–vr ⇒ vrijdag verliest zijn blokken', async () => {
  const kortVr: Block[] = [{ start: 420, end: 720 }];
  const wt = bandsOn([1, 2, 3, 4], STANDAARD);
  wt.byWeekday[5] = kortVr.map((b) => ({ ...b }));
  const projId = await hourProjectCalendar(wt);
  const venster = workDaysSetPatch(calById(projId), [1, 2, 3, 4]);

  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workDays, [1, 2, 3, 4], 'de werkdagen zijn ma–do');
  assertEq(cal.workTime!.byWeekday[5], [], 'vrijdag heeft geen blokken meer');
  assertEq(cal.workTime!.byWeekday[1], STANDAARD, 'maandag houdt zijn blokken');
  assertEq({ workDays: cal.workDays, workTime: cal.workTime, hoursPerDay: cal.hoursPerDay }, venster,
    'MCP geeft precies wat het kalendervenster geeft');
  assertConsistent(cal, 'vrijdag vervalt');
  assertIfcStable(cal, 'vrijdag vervalt');
});

test('dag eraf én dag erbij in één item: zaterdag kopieert de eerste werkdag, vrijdag vervalt', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3, 4, 5], STANDAARD));
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 6] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workTime!.byWeekday[5], [], 'vrijdag zonder blokken');
  assertEq(cal.workTime!.byWeekday[6], STANDAARD, 'zaterdag met de blokken van maandag');
  assertConsistent(cal, 'vr eraf, za erbij');
});

test('een al tegenstrijdige kalender (werkdag zonder blokken) wordt hersteld door alleen workDays', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  S().updateCalendar(projId, { workDays: [1, 2, 3, 4, 5] }); // de oude, foute toestand van vóór de fix
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workTime!.byWeekday[4], STANDAARD, 'donderdag krijgt alsnog blokken');
  assertConsistent(cal, 'herstel');
  assertIfcStable(cal, 'herstel');
});

test('ongesorteerde workDays met een dubbele dag ⇒ de store bewaart de genormaliseerde lijst', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [5, 3, 1, 1] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workDays, [1, 3, 5], 'letterlijk [1,3,5]: gesorteerd en zonder dubbele dag');
  assertConsistent(cal, 'genormaliseerd');
});

test('uurkalender zonder enig blok ⇒ de werkdagen krijgen de eigen enkelvoudige werkdag (06–12 + 13–15)', async () => {
  S().newProject();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  S().updateCalendar(projId, {
    workTime: bandsOn([], []), workDays: [], workStartHour: 6, workEndHour: 15, hoursPerDay: 8,
    simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined,
  });
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  const verwacht: Block[] = [{ start: 360, end: 720 }, { start: 780, end: 900 }];
  for (let d = 1; d <= 5; d++) assertEq(cal.workTime!.byWeekday[d as 1], verwacht, `dag ${d} krijgt 06–12 + 13–15`);
  assertEq(cal.hoursPerDay, 8, 'de uren per dag zijn 8');
  assertConsistent(cal, 'zonder blokken');
});

// =================================================================================================
// 3) Wat ongewijzigd blijft
// =================================================================================================
test('dagkalender: alleen workDays verandert alleen de werkdagen', async () => {
  S().newProject();
  const projId = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const voor = calById(projId);
  assert(voor.workTime === undefined, 'testvoorwaarde: dagkalender');
  const res = await call('planner_update_calendar', { calendars: [{ id: projId, workDays: [1, 2, 3, 4] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  assertEq(cal.workDays, [1, 2, 3, 4], 'de werkdagen zijn ma–do');
  assertEq(cal.workTime, undefined, 'er komen geen blokken bij');
  assertEq(cal.hoursPerDay, voor.hoursPerDay, 'de uren per dag blijven gelijk');
});

test('workTime én gelijke workDays in één item (letterlijke lezing): de NIEUWE blokken gelden', async () => {
  // Pint de voorwaarde `item.workTime === undefined` vast: met `workTime` in het item mag de werkdagregel
  // de meegestuurde blokken niet vervangen door de oude (mutant `!== null` liet maandag 07–12 + 13–16).
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3, 4, 5], STANDAARD));
  const nieuw: Block[] = [{ start: 360, end: 840 }]; // 06–14
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, workTime: bandsOn([1, 2, 3, 4, 5], nieuw), workDays: [1, 2, 3, 4, 5] }],
  });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(projId);
  for (let d = 1; d <= 5; d++) assertEq(cal.workTime!.byWeekday[d as 1], nieuw, `dag ${d} krijgt 06–14`);
  assertEq(cal.hoursPerDay, 8, 'de uren per dag volgen de nieuwe blokken');
  assertConsistent(cal, 'letterlijke lezing');
});

test('workTime én tegenstrijdige workDays in één item: de bestaande weigering blijft', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  const voor = JSON.stringify(calById(projId));
  const res = await call('planner_update_calendar', {
    calendars: [{ id: projId, workTime: bandsOn([1, 2, 3], STANDAARD), workDays: [1, 2, 3, 4, 5] }],
  });
  const rej = rejections(res);
  assertEq(rej.length, 1, 'één zachte weigering');
  assert(/contradicts `workTime`/.test(rej[0].reason), `de reden noemt de tegenspraak: ${rej[0].reason}`);
  assertEq(JSON.stringify(calById(projId)), voor, 'de kalender blijft ongewijzigd');
});

test('alleen workDays via planner_batch volgt dezelfde regel', async () => {
  const projId = await hourProjectCalendar(bandsOn([1, 2, 3], STANDAARD));
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: { steps: [{ tool: 'planner_update_calendar', args: { calendars: [{ id: projId, workDays: [1, 2, 3, 4, 5] }] } }] },
      },
    }),
    makeMcpContext(appStoreContext, {}),
  );
  const msg = JSON.parse(raw);
  assert(msg.result !== undefined, `batch gaf een fout: ${raw.slice(0, 400)}`);
  const payload = JSON.parse(msg.result.content[0].text);
  assert(payload.ok !== false, `batch niet ok: ${JSON.stringify(payload).slice(0, 400)}`);
  const cal = calById(projId);
  assertEq(cal.workTime!.byWeekday[4], STANDAARD, 'donderdag krijgt blokken (via de batch)');
  assertConsistent(cal, 'batch');
});

await run();
