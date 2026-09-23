// Issue #146 etappe 5 — `planner_set_task_splits`: het derde oppervlak voor gebruikerssplits (naast
// Gantt en eigenschappenpaneel). Alles via de ECHTE dispatch-weg (`handleMcpMessage`), zodat de
// schemapoort, de guards en de transactie meegetest worden — zie `docs/recepten/mcp-tool.md`.
//
// Gepind: werk-as-invoer ⇒ exacte `splitGaps` met `source: 'user'`; volgorde van de invoer doet er
// niet toe; lege lijst heft op; weigeringen (mijlpaal, gemengde eenheden, niet-hele eenheid, twee op
// dezelfde plek) zijn alles-of-niets; uur-taak; `aiReadOnly`; `planner_batch` (werkt + schemapoort);
// en de leeskant (`planner_get_task.interruptions`) spreekt precies de schrijfvorm.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext } from '@/services/mcp/contracts';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const store = useAppStore;
const S = () => store.getState();

// Warm-up (zelfde reden als cases-mutate-tasks.ts): de projectkalender-cache promoveert bij de
// eerste restore tot bibliotheek-entry; één edit + undo zet dat vooraf recht.
S().addTask({ name: 'warmup' });
S().undo();
registerAllTools();

function makeCtx(overrides: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, { expectedDocId: S().activeDocumentId, ...overrides });
}

/** Roep een tool aan via de ECHTE JSON-RPC-weg; geeft `structuredContent` (het tool-resultaat). */
async function rpc(name: string, args: unknown, overrides: McpContextOverrides = {}): Promise<any> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    makeCtx(overrides),
  );
  const msg = JSON.parse(raw);
  assert(msg.result, `verwachtte een JSON-RPC-result, kreeg: ${raw.slice(0, 200)}`);
  return msg.result.structuredContent;
}

function okData(res: any): any {
  assert(res && res.ok === true, `verwachtte ok, kreeg: ${JSON.stringify(res).slice(0, 300)}`);
  return res.data;
}

function expectErr(res: any, code: string, fragment?: string): string {
  assert(res && res.ok === false, `verwachtte een fout, kreeg: ${JSON.stringify(res).slice(0, 300)}`);
  assertEq(res.code, code, 'foutcode');
  if (fragment) assert(String(res.error).includes(fragment), `de fout noemt '${fragment}': ${res.error}`);
  return res.error;
}

const gapsOf = (id: string) => S().tasks.find(t => t.id === id)?.splitGaps;

/** Nieuw project met één taak; geeft het echte id terug. */
async function freshTask(item: Record<string, unknown>, calendar?: WorkCalendar): Promise<string> {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (calendar) S().setCalendar(calendar);
  const data = okData(await rpc('planner_add_tasks', { tasks: [{ tempId: 'tmp-t', name: 'Metselwerk', ...item }] }));
  return data.created['tmp-t'];
}

const BANDS = [{ start: 480, end: 960 }]; // 08:00–16:00
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
const HOUR_CAL: WorkCalendar = {
  id: 'cal-uren', name: 'uren', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};

test('dag-taak 10d: na 5 werkdagen 3 dagen pauze ⇒ één gebruikersgat op de H1-as', async () => {
  const id = await freshTask({ duration: 10 });
  const data = okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 5, pauseDays: 3 }] }));
  assertEq(gapsOf(id), [{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }], 'splitGaps');
  assertEq(data.interruptions, [{ afterWorkDays: 5, pauseDays: 3 }], 'antwoord spreekt de invoervorm');
  assertEq(data.scheduleDuration, 10, 'de werkduur blijft gelijk');
  assertEq(data.durationUnit, 'days', 'eenheid in het antwoord');
  assert(Array.isArray(data.tasks) && data.tasks[0].id === id, 'verse datums in het antwoord');
  // 10 werkdagen + 3 pauzedagen vanaf ma 1 juni = 13 werkdagen ⇒ laatste werkdag wo 17 juni.
  assertEq(S().tasks.find(t => t.id === id)?.time.earlyFinish, '2026-06-17', 'EF groeit met de pauze mee');
});

test('twee onderbrekingen, ongesorteerd opgegeven ⇒ gesorteerd op de werk-as', async () => {
  const id = await freshTask({ duration: 10 });
  const data = okData(await rpc('planner_set_task_splits', {
    taskId: id,
    interruptions: [{ afterWorkDays: 7, pauseDays: 1 }, { afterWorkDays: 3, pauseDays: 2 }],
  }));
  assertEq(gapsOf(id), [
    { afterMinutes: 1440, gapMinutes: 960, source: 'user' },
    { afterMinutes: 4320, gapMinutes: 480, source: 'user' },
  ], 'splitGaps: tweede gat staat op 3+2+4 dagen van de H1-as');
  assertEq(data.interruptions, [{ afterWorkDays: 3, pauseDays: 2 }, { afterWorkDays: 7, pauseDays: 1 }], 'leesvorm');
});

test('de lijst VERVANGT: een tweede call zet een nieuwe lijst, een lege lijst heft op', async () => {
  const id = await freshTask({ duration: 10 });
  okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 2, pauseDays: 1 }, { afterWorkDays: 6, pauseDays: 1 }] }));
  okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 4, pauseDays: 2 }] }));
  assertEq(gapsOf(id), [{ afterMinutes: 1920, gapMinutes: 960, source: 'user' }], 'vervangen, niet toegevoegd');
  const data = okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [] }));
  assertEq(gapsOf(id), undefined, 'lege lijst ⇒ geen splitGaps meer');
  assertEq(data.interruptions, [], 'antwoord: geen onderbrekingen');
  assertEq(S().tasks.find(t => t.id === id)?.time.earlyFinish, '2026-06-12', 'EF terug op 10 werkdagen');
});

test('één undo-stap per call', async () => {
  const id = await freshTask({ duration: 10 });
  okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 5, pauseDays: 3 }] }));
  okData(await rpc('planner_undo', {}));
  assertEq(gapsOf(id), undefined, 'undo haalt de hele toolcall in één stap weg');
});

test('mijlpaal ⇒ VALIDATION met reden, niets geschreven', async () => {
  const id = await freshTask({ isMilestone: true });
  const before = JSON.stringify(S().tasks);
  expectErr(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 1, pauseDays: 1 }] }), 'VALIDATION', 'mijlpaal');
  assertEq(JSON.stringify(S().tasks), before, 'taken ongewijzigd');
});

test('onbekende taak ⇒ NOT_FOUND', async () => {
  await freshTask({ duration: 10 });
  expectErr(await rpc('planner_set_task_splits', { taskId: 'bestaat-niet', interruptions: [] }), 'NOT_FOUND');
});

test('gemengde eenheden, niet-hele eenheid, pauze 0 en dubbele positie ⇒ fout met item-index, niets geschreven', async () => {
  const id = await freshTask({ duration: 10 });
  const call = (interruptions: unknown[]) => rpc('planner_set_task_splits', { taskId: id, interruptions });
  expectErr(await call([{ afterWorkDays: 2, pauseDays: 1 }, { afterWorkHours: 40, pauseDays: 1 }]), 'VALIDATION', 'interruptions[1]');
  expectErr(await call([{ afterWorkDays: 2.5, pauseDays: 1 }]), 'VALIDATION', 'interruptions[0]');
  expectErr(await call([{ afterWorkDays: 2, pauseDays: 0 }]), 'VALIDATION', 'interruptions[0]');
  expectErr(await call([{ afterWorkDays: 4, pauseDays: 1 }, { afterWorkDays: 4, pauseDays: 2 }]), 'VALIDATION', 'interruptions[1]');
  expectErr(await call([{ afterWorkDays: 10, pauseDays: 1 }]), 'VALIDATION', 'interruptions[0]');
  expectErr(await call([{ pauseDays: 1 }]), 'VALIDATION', 'afterWorkDays');
  assertEq(gapsOf(id), undefined, 'geen enkele weigering schreef iets');
});

test('schemapoort: onbekende sleutel in een item en een negatieve pauze ⇒ VALIDATION vóór de handler', async () => {
  const id = await freshTask({ duration: 10 });
  expectErr(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 2, pauseDays: 1, na: 3 }] }), 'VALIDATION', 'planner_set_task_splits');
  expectErr(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 2, pauseDays: -1 }] }), 'VALIDATION', 'planner_set_task_splits');
  expectErr(await rpc('planner_set_task_splits', { taskId: id }), 'VALIDATION', 'interruptions');
  assertEq(gapsOf(id), undefined, 'niets geschreven');
});

test('uur-taak: afterWorkHours/pauseHours; dagsleutels worden geweigerd', async () => {
  const id = await freshTask({ duration: 16, durationUnit: 'hours' }, HOUR_CAL);
  expectErr(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 1, pauseDays: 1 }] }), 'VALIDATION', 'afterWorkHours');
  const data = okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkHours: 6, pauseHours: 3 }] }));
  assertEq(gapsOf(id), [{ afterMinutes: 360, gapMinutes: 180, source: 'user' }], 'splitGaps in minuten');
  assertEq(data.interruptions, [{ afterWorkHours: 6, pauseHours: 3 }], 'leesvorm in uren');
  assertEq(data.durationUnit, 'hours', 'eenheid');
});

test('aiReadOnly ⇒ READ_ONLY, niets geschreven', async () => {
  const id = await freshTask({ duration: 10 });
  expectErr(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 5, pauseDays: 3 }] }, { readOnly: true }), 'READ_ONLY');
  assertEq(gapsOf(id), undefined, 'niets geschreven');
});

test('planner_batch: taak aanmaken en onderbreken in één draaiboek (temp-id)', async () => {
  await freshTask({ duration: 10 });
  const res = await rpc('planner_batch', {
    steps: [
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-b', name: 'Tegelwerk', duration: 6 }] } },
      { tool: 'planner_set_task_splits', args: { taskId: 'tmp-b', interruptions: [{ afterWorkDays: 3, pauseDays: 2 }] } },
    ],
  });
  assert(res.ok === true, `batch hoort te slagen: ${JSON.stringify(res).slice(0, 400)}`);
  const task = S().tasks.find(t => t.name === 'Tegelwerk');
  assertEq(task?.splitGaps, [{ afterMinutes: 1440, gapMinutes: 960, source: 'user' }], 'splitGaps via batch');
});

test('planner_batch: de schemapoort geldt per stap (item-binnenkant) en rolt alles terug', async () => {
  const id = await freshTask({ duration: 10 });
  const res = await rpc('planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id, fields: { name: 'Hernoemd' } }] } },
      { tool: 'planner_set_task_splits', args: { taskId: id, interruptions: [{ afterWorkDays: 2, pauseDays: 1, extra: true }] } },
    ],
  });
  assert(res.ok === false, 'een schema-ongeldige stap laat de batch falen');
  assertEq(S().tasks.find(t => t.id === id)?.name, 'Metselwerk', 'eerdere stap teruggerold');
  assertEq(gapsOf(id), undefined, 'niets geschreven');
});

test('leeskant: planner_get_task geeft interruptions in de schrijfvorm; set(get) is idempotent', async () => {
  const id = await freshTask({ duration: 10 });
  okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: [{ afterWorkDays: 2, pauseDays: 1 }, { afterWorkDays: 6, pauseDays: 2 }] }));
  const detail = okData(await rpc('planner_get_task', { taskId: id }));
  assertEq(detail.interruptions, [{ afterWorkDays: 2, pauseDays: 1 }, { afterWorkDays: 6, pauseDays: 2 }], 'interruptions');
  assert(Array.isArray(detail.splitGaps) && detail.splitGaps.length === 2, 'rauwe splitGaps blijven er ook');
  const before = JSON.stringify(gapsOf(id));
  okData(await rpc('planner_set_task_splits', { taskId: id, interruptions: detail.interruptions }));
  assertEq(JSON.stringify(gapsOf(id)), before, 'terugschrijven van de leesvorm verandert niets');
});

test('fields.splitGaps via update_tasks wijst de weg naar de nieuwe tool', async () => {
  const id = await freshTask({ duration: 10 });
  const res = await rpc('planner_update_tasks', { updates: [{ id, fields: { splitGaps: [] } }] });
  const reason = JSON.stringify(res.itemRejections ?? res.error ?? '');
  assert(reason.includes('planner_set_task_splits'), `de weigering verwijst naar de tool: ${reason}`);
});

await run();
