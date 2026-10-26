/**
 * Geval 11c (spec §5.2, §6.1; besluit B1a in §3.2 en §8): vast werk maakt een dagenmaat-taak urenmaat,
 * en die maatwijziging is een planningsbewerking.
 *
 * Voorbeeldweek (§0): ma–do 07:00–12:00 + 13:00–16:00 (8 u), vr 07:00–12:00 + 13:00–14:00 (6 u),
 * werktijd per dag 8 u. Taak A: 3 d vanaf wo 07:00 in de dagenmaat, einde vr 14:00 (22 werkuren).
 * Een wissel naar vast werk maakt A 3 × 8 u = 24 u urenmaat. Het einde staat dan meteen op ma 09:00
 * (wo 8 + do 8 + vr 6 + ma 2), niet pas na Bereken. Ctrl+Z geeft in één stap de dagenmaat, de modus
 * "datums zoals opgeslagen" en vr 14:00 terug.
 *
 * Routes: UI (`setTaskWorkRule`, `updateTask`, de rastercel Werkregel), MCP (`planner_update_tasks`,
 * een batch met een leesstap, de drie draft-primitieven). In de UI rekent `useExitRecordedDates` door
 * na het verlaten van de modus; die hook is React en draait hier niet, dus `viaUi` voert zijn besluit
 * uit met dezelfde pure functies (`leftRecordedDatesMode`, `needsExitRecompute`). In MCP rekent de
 * transactie zelf.
 *
 * Plus de varianten van geval 11 (§6.1): duur en vast werk in één aanroep (rekent), en de controle
 * zonder maatwijziging (houdt de modus, nul berekeningen). De variant "ruwe contour vóór de
 * werkregel" en geval 11 zelf staan in `check-minute-model-transition.ts`.
 */
import { makeMcpContext } from '../mcp/harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolResult } from '@/services/mcp/contracts';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar } from '@/types/calendar';
import type { WorkRule } from '@/types/workRule';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { leftRecordedDatesMode, needsExitRecompute, type RecordedDatesObservation } from '@/state/recordedDatesExit';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

const WEEK: WorkCalendar = {
  id: 'cal-week', name: 'Voorbeeldweek', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      2: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      4: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      5: [{ start: 420, end: 720 }, { start: 780, end: 840 }],
      6: [], 7: [],
    },
  },
};
const WO = '2026-06-03T07:00';
const VR_EINDE = '2026-06-05T14:00';
const MA_0900 = '2026-06-08T09:00';
const B_OPGESLAGEN = '2026-06-15T07:00';

/**
 * Een vreemd IFC (`recordedTimesOrigin: 'ifc'`): V (2 d, ma–di) → A (3 d, wo–vr) → B (2 d). B staat in
 * het bestand op 15 jun door een SNET die de lader niet meekrijgt. B verschuift dus bij het rekenen,
 * en de verse import opent in de modus met de opgeslagen datums. A's opgeslagen datums zijn de
 * dagenmaat-datums: wo 07:00 tot vr 14:00.
 */
function source() {
  const app = createAppStoreContext().store;
  app.setState(s => { s.project.startDate = '2026-06-01'; s.calendar = WEEK; s.calendars = []; });
  const v = app.getState().addTask({ name: 'V', time: createDefaultTaskTime('2026-06-01T07:00', 2) });
  const a = app.getState().addTask({ name: 'A', time: createDefaultTaskTime(WO, 3) });
  const b = app.getState().addTask({ name: 'B', time: createDefaultTaskTime('2026-06-08T07:00', 2) });
  app.getState().addSequence({ predecessorId: v, successorId: a, type: 'FINISH_START', lagDays: 0 });
  app.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  app.getState().updateTask(b, { constraint: { type: 'SNET', date: B_OPGESLAGEN } });
  app.getState().runCPM();
  const parsed = readIFC(writeIFC(buildWriteIFCInput(app.getState())));
  parsed.recordedTimesOrigin = 'ifc';
  for (const t of parsed.tasks) if (t.name === 'B') delete t.constraint;
  return parsed;
}
const SOURCE = source();

interface Fixture { context: AppStoreContext; aId: string; bId: string }
function fixture(): Fixture {
  const context = createAppStoreContext();
  context.store.getState().applyLoadedProject(structuredClone(SOURCE), { recompute: true });
  // De rastercel Werkregel staat alleen in een ontsloten document.
  context.store.setState(s => { s.taskTypesVisible = true; });
  const id = (name: string) => context.store.getState().tasks.find(t => t.name === name)!.id;
  return { context, aId: id('A'), bId: id('B') };
}

const taskOf = (f: Fixture, id: string) => f.context.store.getState().tasks.find(t => t.id === id)!;
const applied = (f: Fixture) => f.context.store.getState().historyEvents.filter(e => e.state === 'applied').length;
/** De stand die 11c toetst: maat, minuten, datums van A, start van B en de modus. */
function stand(f: Fixture) {
  const s = f.context.store.getState();
  const a = taskOf(f, f.aId).time;
  return {
    unit: a.durationUnit, minutes: a.durationMinutes ?? null, days: a.scheduleDuration,
    aStart: a.earlyStart, aFinish: a.earlyFinish, bStart: taskOf(f, f.bId).time.earlyStart,
    inMode: s.datesAsRecorded, stale: s.scheduleStale,
  };
}
const OPGESLAGEN = { unit: 'days', minutes: null, days: 3, aStart: WO, aFinish: VR_EINDE, bStart: B_OPGESLAGEN, inMode: true, stale: false };

/** Een UI-bewerking plus wat `useExitRecordedDates` daarna doet (zie de kop). Geeft het aantal
 *  berekeningen dat de hook startte. */
function viaUi(f: Fixture, action: () => void): number {
  const observe = (): RecordedDatesObservation => {
    const s = f.context.store.getState();
    return { documentId: s.activeDocumentId, inMode: s.datesAsRecorded, scheduleStale: s.scheduleStale, history: s.historyEvents };
  };
  const prev = observe();
  action();
  const next = observe();
  if (!leftRecordedDatesMode(prev, next) || !needsExitRecompute(next.documentId, observe())) return 0;
  f.context.store.getState().runCPM({ withinEvent: true });
  return 1;
}

/** Verwachte stand na een wissel naar vast werk zonder duurwijziging: 24 u, einde ma 09:00. */
function expectSwitched(label: string, f: Fixture, extra: { bLater: boolean }) {
  const st = stand(f);
  eq(`${label}: vast werk maakt A urenmaat, 3 d × 8 u = 24 u`, [st.unit, st.minutes, st.days], ['hours', 24 * 60, 3]);
  eq(`${label}: het einde staat meteen op ma 09:00, de modus is uit en de planning vers`,
    [st.aStart, st.aFinish, st.inMode, st.stale, f.context.store.getState().recordedDates], [WO, MA_0900, false, false, null]);
  // B rekende mee: de opgeslagen 15 jun is weg en B volgt het nieuwe einde van A.
  eq(`${label}: B is doorgerekend`, [st.bStart !== B_OPGESLAGEN, st.bStart >= MA_0900], [extra.bLater, extra.bLater]);
}

function expectUndone(label: string, f: Fixture, appliedBefore: number) {
  f.context.store.getState().undo();
  eq(`${label}: Ctrl+Z geeft in één stap dagenmaat, modus en vr 14:00 terug`, stand(f), OPGESLAGEN);
  eq(`${label}: …en de vastlegging`, f.context.store.getState().recordedDates?.times[f.bId]?.start, B_OPGESLAGEN);
  eq(`${label}: …en één undo-stap`, applied(f), appliedBefore);
}

// ── Voorwaarde: de fixture opent in de modus met A in de dagenmaat ──────────────
{
  const f = fixture();
  eq('voorwaarde: A en B zoals opgeslagen, in de modus', stand(f), OPGESLAGEN);
  eq('voorwaarde: A heeft geen eigen werkregel en het project geen standaard', [taskOf(f, f.aId).workRule, f.context.store.getState().project.defaultWorkRule], [undefined, undefined]);
}

// ── UI ─────────────────────────────────────────────────────────────────────────
// (u1) Het menu Taaktype (`setTaskWorkRule`).
{
  const f = fixture();
  const before = applied(f);
  const runs = viaUi(f, () => f.context.store.getState().setTaskWorkRule(f.aId, 'FIXED_WORK'));
  eq('u1 setTaskWorkRule: de hook rekent één keer', runs, 1);
  expectSwitched('u1 setTaskWorkRule', f, { bLater: true });
  eq('u1 setTaskWorkRule: één undo-stap voor wissel en berekening', applied(f), before + 1);
  expectUndone('u1 setTaskWorkRule', f, before);
}
// (u2) De taakdialoog (`updateTask` met alleen de werkregel).
{
  const f = fixture();
  const before = applied(f);
  const runs = viaUi(f, () => f.context.store.getState().updateTask(f.aId, { workRule: 'FIXED_WORK' }));
  eq('u2 updateTask: de hook rekent één keer', runs, 1);
  expectSwitched('u2 updateTask', f, { bLater: true });
  eq('u2 updateTask: één undo-stap', applied(f), before + 1);
  expectUndone('u2 updateTask', f, before);
}
// (u3) De rastercel Werkregel.
{
  const f = fixture();
  const before = applied(f);
  const cell: CellEditIntent = { kind: 'cell-edit', taskId: f.aId, columnId: 'task.workRule' as CellEditIntent['columnId'], route: 'task-field', value: 'FIXED_WORK' };
  let ok = false;
  const runs = viaUi(f, () => { ok = f.context.store.getState().runGridMutation([cell]).ok; });
  eq('u3 rastercel: slaagt en de hook rekent één keer', [ok, runs], [true, 1]);
  expectSwitched('u3 rastercel', f, { bLater: true });
  eq('u3 rastercel: één undo-stap', applied(f), before + 1);
  expectUndone('u3 rastercel', f, before);
}

// ── MCP ────────────────────────────────────────────────────────────────────────
async function mcp() {
  // (m1) planner_update_tasks met alleen de werkregel.
  {
    const f = fixture();
    const before = applied(f);
    const res = await getTool('planner_update_tasks')!.handler({ updates: [{ id: f.aId, fields: { workRule: 'FIXED_WORK' } }] }, makeMcpContext(f.context)) as McpToolResult;
    eq('m1 planner_update_tasks: slaagt', res.ok, true);
    expectSwitched('m1 planner_update_tasks', f, { bLater: true });
    eq('m1 planner_update_tasks: één undo-stap', applied(f), before + 1);
    expectUndone('m1 planner_update_tasks', f, before);
  }
  // (m2) Een batch met een leesstap: de leesstap ziet al het nieuwe einde.
  {
    const f = fixture();
    const before = applied(f);
    const res = await getTool('planner_batch')!.handler({ steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: f.aId, fields: { workRule: 'FIXED_WORK' } }] } },
      { tool: 'planner_get_task', args: { taskId: f.aId } },
    ] }, makeMcpContext(f.context)) as McpToolResult;
    eq('m2 batch: slaagt', res.ok, true);
    const read = res.ok ? JSON.stringify((res.data as { steps: unknown[] }).steps[1]) : '';
    eq('m2 batch: de leesstap ziet 24 u en het einde ma 09:00',
      [/"durationUnit":"hours"/.test(read), read.match(/"earlyFinish":"([^"]+)"/)?.[1] ?? null], [true, MA_0900]);
    expectSwitched('m2 batch', f, { bLater: true });
    eq('m2 batch: één undo-stap', applied(f), before + 1);
    expectUndone('m2 batch', f, before);
  }
  // (m3–m5) De drie draft-primitieven die een werkregel schrijven.
  const primitives: [string, (f: Fixture, tx: ReturnType<typeof createMcpTransactions>) => void][] = [
    ['m3 draft.setTaskWorkRule', (f, tx) => tx.draft.setTaskWorkRule(f.aId, 'FIXED_WORK')],
    ['m4 draft.updateTaskFields', (f, tx) => { tx.draft.updateTaskFields(f.aId, { workRule: 'FIXED_WORK' }); }],
    ['m5 draft.patchTaskFields', (f, tx) => { tx.draft.patchTaskFields(f.aId, { workRule: 'FIXED_WORK' }); }],
  ];
  for (const [label, act] of primitives) {
    const f = fixture();
    const before = applied(f);
    const tx = createMcpTransactions(f.context);
    eq(`${label}: slaagt`, tx.run(() => act(f, tx)).ok, true);
    expectSwitched(label, f, { bLater: true });
    eq(`${label}: één undo-stap`, applied(f), before + 1);
    expectUndone(label, f, before);
  }

  // ── Varianten van geval 11 (§6.1) ──────────────────────────────────────────
  // (v1) Duur 2 d plus vast werk in één aanroep: 2 × 8 u = 960 min, einde do 16:00, rekent.
  {
    const f = fixture();
    const before = applied(f);
    const res = await getTool('planner_update_tasks')!.handler({ updates: [{ id: f.aId, fields: { duration: 2, durationUnit: 'days', workRule: 'FIXED_WORK' } }] }, makeMcpContext(f.context)) as McpToolResult;
    eq('v1 MCP duur plus vast werk: slaagt', res.ok, true);
    const st = stand(f);
    eq('v1 MCP duur plus vast werk: 960 min urenmaat, einde do 16:00, modus uit, vers',
      [st.unit, st.minutes, st.aFinish, st.inMode, st.stale], ['hours', 960, '2026-06-04T16:00', false, false]);
    expectUndone('v1 MCP duur plus vast werk', f, before);
  }
  {
    const f = fixture();
    const before = applied(f);
    const runs = viaUi(f, () => f.context.store.getState().updateTask(f.aId, { workRule: 'FIXED_WORK', time: { ...taskOf(f, f.aId).time, scheduleDuration: 2 } }));
    const st = stand(f);
    eq('v1 UI duur plus vast werk: 960 min urenmaat, einde do 16:00, modus uit, één berekening',
      [st.unit, st.minutes, st.aFinish, st.inMode, runs], ['hours', 960, '2026-06-04T16:00', false, 1]);
    expectUndone('v1 UI duur plus vast werk', f, before);
  }
  // (v2) Controle: een wissel die de maat niet verandert, blijft datumneutraal.
  for (const rule of ['FIXED_DURATION_WORK', 'FIXED_RATE'] as WorkRule[]) {
    const f = fixture();
    const before = applied(f);
    const runs = viaUi(f, () => f.context.store.getState().setTaskWorkRule(f.aId, rule));
    eq(`v2 UI ${rule}: houdt de dagenmaat, de modus en vr 14:00; geen berekening`, [stand(f), runs, applied(f)], [OPGESLAGEN, 0, before + 1]);
    f.context.store.getState().undo();
    const res = await getTool('planner_update_tasks')!.handler({ updates: [{ id: f.aId, fields: { workRule: rule } }] }, makeMcpContext(f.context)) as McpToolResult;
    eq(`v2 MCP ${rule}: houdt de dagenmaat, de modus en vr 14:00`, [res.ok, stand(f)], [true, OPGESLAGEN]);
  }

  // ── B1a: geen invoer maakt een taak onder vast werk dagenmaat (§3.2, §3.12) ───────────
  {
    const f = fixture();
    f.context.store.getState().setTaskWorkRule(f.aId, 'FIXED_WORK');
    f.context.store.getState().runCPM();
    // UI: een duur in werkdagen ("5d") gaat naar de urenbron: 5 × 8 u.
    f.context.store.getState().updateTask(f.aId, { time: { ...taskOf(f, f.aId).time, scheduleDuration: 5, durationUnit: 'days' } });
    eq('w1 UI: 5 d onder vast werk wordt 40 u urenmaat', [taskOf(f, f.aId).time.durationUnit, taskOf(f, f.aId).time.durationMinutes, taskOf(f, f.aId).time.scheduleDuration], ['hours', 2400, 5]);
    // Raster: de maatcel weigert de dagenmaat.
    const cell: CellEditIntent = { kind: 'cell-edit', taskId: f.aId, columnId: 'task.time.durationUnit' as CellEditIntent['columnId'], route: 'task-schedule', value: 'days' };
    const res = f.context.store.getState().runGridMutation([cell]);
    eq('w2 raster: de maatcel weigert dagen onder vast werk', [res.ok, res.ok ? null : JSON.stringify(res).includes('fixedWorkIsHours'), taskOf(f, f.aId).time.durationUnit], [false, true, 'hours']);
    // MCP: dagen blijven als invoer toegestaan (§3.13) en gaan naar de urenbron.
    const mcpRes = await getTool('planner_update_tasks')!.handler({ updates: [{ id: f.aId, fields: { duration: 2.5, durationUnit: 'days' } }] }, makeMcpContext(f.context)) as McpToolResult;
    eq('w3 MCP: 2,5 d onder vast werk wordt 20 u urenmaat', [mcpRes.ok, taskOf(f, f.aId).time.durationUnit, taskOf(f, f.aId).time.durationMinutes], [true, 'hours', 1200]);
  }

  if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
  console.log(`maatwissel vast werk (11c): ${checks - errors.length}/${checks} groen`);
}
void mcp().catch(error => { console.error(error); process.exitCode = 1; });
