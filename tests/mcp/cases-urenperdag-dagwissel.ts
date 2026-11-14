// Uren per dag bij `planner_update_calendar` met alleen `workDays` of met `workTime` (review PR #352, punt 1;
// fixronde PR #354).
//
// XER "Late ploeg": blokken 14:00–24:00 (10 klokuren) met `day_hr_cnt` 8. `hoursPerDay` is de omrekening
// tussen dagen en uren en mag afwijken van de blokken. Eén MCP-call is één sessie, met dezelfde regel als het
// kalendervenster (`hoursPerDayForBlocks` in `src/services/subdayIo.ts`): een afwijkende waarde blijft staan,
// een waarde gelijk aan de modale dagsom van de blokken vóór de call volgt de nieuwe blokken. Alleen
// `workDays` gaat door `workDaysSetPatch` (de dagknoppen); `workTime` volgt het blok Werktijden (`applyBands`).
// Vóór de fix werd Late ploeg na `workDays` [1..6] of een extra Za-blok stil 10. Kern zonder MCP:
// `tests/planning/check-urenperdag-dagwissel.ts`.
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
import { hoursPerDayForBlocks, workDayTogglePatch, workDaysSetPatch } from '@/services/subdayIo';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const S = () => useAppStore.getState();

// Warm-up (zelfde reden als cases-mutate-cal-res.ts): een verse store heeft `calendars: []`.
S().addTask({ name: 'warmup' });
S().undo();

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
const rejections = (res: McpToolResult) => (res as McpToolOk).itemRejections ?? [];

const LATE = [{ start: 840, end: 1440 }]; // 14:00–24:00
function lateWeek(days: number[]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of days) byWeekday[d as 1] = LATE.map((b) => ({ ...b }));
  return { byWeekday };
}

/** Projectkalender Late ploeg ma–vr, met een eigen `hoursPerDay` of afgeleid uit de blokken (10). */
async function lateProjectCalendar(hoursPerDay?: number): Promise<string> {
  S().newProject();
  const id = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const res = await call('planner_update_calendar', {
    calendars: [{ id, workTime: lateWeek([1, 2, 3, 4, 5]), ...(hoursPerDay !== undefined ? { hoursPerDay } : {}) }],
  });
  assertEq(rejections(res), [], 'testvoorwaarde: Late ploeg is aangenomen');
  S().addTask({ name: 'Werk' }); // de IFC-rondgang moet de kalender dragen
  return id;
}
const calById = (id: string): WorkCalendar => S().calendars.find((c) => c.id === id)!;
const fields = (c: Partial<WorkCalendar>) => ({ workDays: c.workDays, workTime: c.workTime, hoursPerDay: c.hoursPerDay });

test('Late ploeg 8 u/dag, alleen workDays [1..6] ⇒ 8, gelijk aan de dagknop Za, ook na IFC', async () => {
  const id = await lateProjectCalendar(8);
  assertEq(calById(id).hoursPerDay, 8, 'testvoorwaarde: 8 u/dag');
  const venster = workDayTogglePatch(calById(id), 6, calById(id));

  const res = await call('planner_update_calendar', { calendars: [{ id, workDays: [1, 2, 3, 4, 5, 6] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(id);
  assertEq(cal.hoursPerDay, 8, 'de uren per dag blijven 8');
  assertEq(cal.workTime!.byWeekday[6], LATE, 'zaterdag 14–24, zoals maandag');
  assertEq(fields(cal), fields(venster), 'MCP geeft precies wat de dagknop Za in het venster geeft');

  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  assertEq([terug.workDays, terug.hoursPerDay], [[1, 2, 3, 4, 5, 6], 8], 'na opslaan en heropenen: ma–za, 8 u/dag');
});

test('Late ploeg 10 u/dag (= de blokken), alleen workDays [1..6] en terug ⇒ 10', async () => {
  const id = await lateProjectCalendar();
  assertEq(calById(id).hoursPerDay, 10, 'testvoorwaarde: afgeleid uit de blokken');
  await call('planner_update_calendar', { calendars: [{ id, workDays: [1, 2, 3, 4, 5, 6] }] });
  assertEq(calById(id).hoursPerDay, 10, 'na workDays [1..6]: 10');
  await call('planner_update_calendar', { calendars: [{ id, workDays: [1, 2, 3, 4, 5] }] });
  assertEq(calById(id).hoursPerDay, 10, 'na workDays [1..5]: 10');
});

test('volgt: ma–wo 8 u en do/vr 10 u (8 = modaal 8), alleen workDays [2..5] ⇒ modaal 10, zoals het venster', async () => {
  S().newProject();
  const id = S().project.calendarId;
  S().ensureProjectCalendarInLibrary();
  const H8 = [{ start: 420, end: 900 }];
  const H10 = [{ start: 420, end: 1020 }];
  const byWeekday = { 1: H8, 2: H8, 3: H8, 4: H10, 5: H10, 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  const opzet = await call('planner_update_calendar', { calendars: [{ id, workTime: { byWeekday } }] });
  assertEq(rejections(opzet), [], 'testvoorwaarde: de kalender is aangenomen');
  S().addTask({ name: 'Werk' });
  assertEq(calById(id).hoursPerDay, 8, 'testvoorwaarde: 8 u/dag, gelijk aan de modale dagsom');
  const venster = workDaysSetPatch(calById(id), [2, 3, 4, 5], calById(id));

  const res = await call('planner_update_calendar', { calendars: [{ id, workDays: [2, 3, 4, 5] }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(id);
  assertEq(cal.hoursPerDay, 10, 'di/wo 8 u en do/vr 10 u: gelijkspel, de hoogste (10) wint');
  assertEq(fields(cal), fields(venster), 'MCP geeft precies wat dezelfde zet in het venster geeft (workDaysSetPatch)');
  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  assertEq([terug.workDays, terug.hoursPerDay], [[2, 3, 4, 5], 10], 'na opslaan en heropenen: di–vr, 10 u/dag');
});

test('Late ploeg 8 u/dag, workTime met een extra Za-blok ⇒ 8, zoals Werktijden in het venster, ook na IFC', async () => {
  const id = await lateProjectCalendar(8);
  assertEq(calById(id).hoursPerDay, 8, 'testvoorwaarde: 8 u/dag');
  const bands = lateWeek([1, 2, 3, 4, 5, 6]);
  const venster = hoursPerDayForBlocks(calById(id), calById(id), bands);

  const res = await call('planner_update_calendar', { calendars: [{ id, workTime: bands }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(id);
  assertEq(cal.hoursPerDay, 8, 'de uren per dag blijven 8 (een bewuste afwijking blijft staan)');
  assertEq(cal.workDays, [1, 2, 3, 4, 5, 6], 'de werkdagen volgen de blokken: ma–za');
  assertEq(cal.workTime!.byWeekday[6], LATE, 'zaterdag 14–24');
  assertEq(cal.hoursPerDay, venster, 'MCP geeft wat het blok Werktijden in het venster geeft (hoursPerDayForBlocks)');

  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  assertEq([terug.workDays, terug.hoursPerDay], [[1, 2, 3, 4, 5, 6], 8], 'na opslaan en heropenen: ma–za, 8 u/dag');
});

test('volgt: Late ploeg 10 u/dag (= de blokken), workTime ma–za 14–22 ⇒ 8, zoals Werktijden in het venster', async () => {
  const id = await lateProjectCalendar();
  assertEq(calById(id).hoursPerDay, 10, 'testvoorwaarde: 10 u/dag, gelijk aan de modale dagsom');
  const H1422 = [{ start: 840, end: 1320 }];
  const byWeekday = { 1: H1422, 2: H1422, 3: H1422, 4: H1422, 5: H1422, 6: H1422, 7: [] } as WorkTimeBands['byWeekday'];
  const venster = hoursPerDayForBlocks(calById(id), calById(id), { byWeekday });

  const res = await call('planner_update_calendar', { calendars: [{ id, workTime: { byWeekday } }] });
  assertEq(rejections(res), [], 'geen weigering');
  const cal = calById(id);
  assertEq(cal.hoursPerDay, 8, 'de uren per dag volgen de nieuwe blokken: 8');
  assertEq(cal.hoursPerDay, venster, 'MCP geeft wat het blok Werktijden in het venster geeft (hoursPerDayForBlocks)');
  const terug = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  assertEq([terug.workDays, terug.hoursPerDay], [[1, 2, 3, 4, 5, 6], 8], 'na opslaan en heropenen: ma–za, 8 u/dag');
});

await run();
