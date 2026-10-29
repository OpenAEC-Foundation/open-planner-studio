/**
 * Geërfd vast werk valt onder B1a (spec "alleen uren" §3.2; review #581 r1, knownbug 251). Een taak
 * zonder eigen regel erft `Project.defaultWorkRule` (`effectiveWorkRule`). Een wissel van die
 * standaard is voor haar dus een typewissel: dezelfde werkregelbrug als een wissel op de taak, en een
 * maatwijziging is planning (geval 11c, §5.2): de modus "datums zoals opgeslagen" gaat uit, de planning
 * wordt verouderd en er wordt doorgerekend, in één undo-stap.
 *
 * Voorbeeldweek (zoals `check-work-rule-measure-switch.ts`): ma–do 8 u, vr 6 u, werktijd per dag 8 u.
 * V (2 d, ma–di) → A (3 d, wo–vr 14:00) → B (2 d), alle drie zonder eigen regel, uit een vreemd IFC in
 * de modus. De standaard *Vast werk* maakt V 16 u, A 24 u (einde ma 09:00) en B 16 u.
 * De terugweg (van vast werk naar een andere standaard) laat de urenmaat staan, net als bij 11c.
 * Routes: de store (`setProject`) en MCP (`planner_update_project`, een batch, `draft.setProject`).
 */
import { makeMcpContext } from '../mcp/harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { effectiveWorkRule } from '@/engine/work/workRuleApply';
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

interface Fixture { context: AppStoreContext; vId: string; aId: string; bId: string }
function fixture(): Fixture {
  const context = createAppStoreContext();
  context.store.getState().applyLoadedProject(structuredClone(SOURCE), { recompute: true });
  const id = (name: string) => context.store.getState().tasks.find(t => t.name === name)!.id;
  return { context, vId: id('V'), aId: id('A'), bId: id('B') };
}
const taskOf = (f: Fixture, id: string) => f.context.store.getState().tasks.find(t => t.id === id)!;
const applied = (f: Fixture) => f.context.store.getState().historyEvents.filter(e => e.state === 'applied').length;
const measure = (t: Task) => [t.time.durationUnit, t.time.durationMinutes ?? null, t.time.scheduleDuration];
function stand(f: Fixture) {
  const s = f.context.store.getState();
  const a = taskOf(f, f.aId).time;
  return {
    v: measure(taskOf(f, f.vId)), a: measure(taskOf(f, f.aId)), b: measure(taskOf(f, f.bId)),
    aStart: a.earlyStart, aFinish: a.earlyFinish, bStart: taskOf(f, f.bId).time.earlyStart,
    inMode: s.datesAsRecorded, stale: s.scheduleStale, defaultWorkRule: s.project.defaultWorkRule ?? null,
  };
}
const OPGESLAGEN = {
  v: ['days', null, 2], a: ['days', null, 3], b: ['days', null, 2],
  aStart: WO, aFinish: VR_EINDE, bStart: B_OPGESLAGEN, inMode: true, stale: false, defaultWorkRule: null,
};

/** Een UI-bewerking plus wat `useExitRecordedDates` daarna doet (React; hier met dezelfde pure
 *  functies, zie `check-work-rule-measure-switch.ts`). Geeft het aantal berekeningen. */
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

function expectSwitched(label: string, f: Fixture) {
  const st = stand(f);
  eq(`${label}: de geërfde regel is vast werk`, effectiveWorkRule(taskOf(f, f.aId), f.context.store.getState().project.defaultWorkRule), 'FIXED_WORK');
  eq(`${label}: V, A en B worden urenmaat (16, 24 en 16 u)`, [st.v, st.a, st.b], [['hours', 960, 2], ['hours', 1440, 3], ['hours', 960, 2]]);
  eq(`${label}: A eindigt meteen op ma 09:00, de modus is uit en de planning vers`,
    [st.aStart, st.aFinish, st.inMode, st.stale, f.context.store.getState().recordedDates], [WO, MA_0900, false, false, null]);
  eq(`${label}: B is doorgerekend`, [st.bStart !== B_OPGESLAGEN, st.bStart >= MA_0900], [true, true]);
}
function expectUndone(label: string, f: Fixture, appliedBefore: number) {
  f.context.store.getState().undo();
  eq(`${label}: Ctrl+Z geeft in één stap de standaard, de dagenmaat, de modus en vr 14:00 terug`, stand(f), OPGESLAGEN);
  eq(`${label}: …en één undo-stap`, applied(f), appliedBefore);
}

// ── Voorwaarde ───────────────────────────────────────────────────────────────────
{
  const f = fixture();
  eq('d0 voorwaarde: V, A en B zoals opgeslagen, in de modus, zonder eigen regel',
    [stand(f), [f.vId, f.aId, f.bId].map(id => taskOf(f, id).workRule ?? null)], [OPGESLAGEN, [null, null, null]]);
}

// ── Store ────────────────────────────────────────────────────────────────────────
{
  const f = fixture();
  const before = applied(f);
  const runs = viaUi(f, () => f.context.store.getState().setProject({ defaultWorkRule: 'FIXED_WORK' }));
  eq('d1 setProject: de hook rekent één keer', runs, 1);
  expectSwitched('d1 setProject', f);
  eq('d1 setProject: één undo-stap voor wissel en berekening', applied(f), before + 1);
  expectUndone('d1 setProject', f, before);
}
// De terugweg: van vast werk naar een andere standaard. De urenmaat blijft (zoals 11c), datumneutraal.
{
  const f = fixture();
  viaUi(f, () => f.context.store.getState().setProject({ defaultWorkRule: 'FIXED_WORK' }));
  const before = applied(f);
  const runs = viaUi(f, () => f.context.store.getState().setProject({ defaultWorkRule: 'FIXED_DURATION_RATE' }));
  const st = stand(f);
  eq('d2 terugweg: A blijft 24 u urenmaat, het einde blijft ma 09:00, geen berekening, niet verouderd',
    [st.a, st.aFinish, runs, st.stale, st.defaultWorkRule], [['hours', 1440, 3], MA_0900, 0, false, 'FIXED_DURATION_RATE']);
  eq('d2 terugweg: één undo-stap', applied(f), before + 1);
}
// Een taak met een eigen regel volgt de standaard niet.
{
  const f = fixture();
  f.context.store.getState().setTaskWorkRule(f.bId, 'FIXED_DURATION_RATE');
  viaUi(f, () => f.context.store.getState().setProject({ defaultWorkRule: 'FIXED_WORK' }));
  eq('d3 eigen regel: B houdt de dagenmaat, A wordt urenmaat', [measure(taskOf(f, f.bId)), measure(taskOf(f, f.aId))],
    [['days', null, 2], ['hours', 1440, 3]]);
}
// Zonder de modus (de probe van de reviewer): 3 d vanaf wo op een korte vrijdag (vr 07:00–13:00).
{
  const long = [{ start: 420, end: 900 }];
  const cal: WorkCalendar = { id: 'cal', name: 'cal', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7,
    workEndHour: 15, hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: long, 2: long, 3: long, 4: long, 5: [{ start: 420, end: 780 }], 6: [], 7: [] } } };
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  context.store.setState(s => { s.project.startDate = '2026-06-03'; s.calendar = cal; s.calendars = []; });
  const id = S().addTask({ name: 'geërfd', time: createDefaultTaskTime(WO, 3) });
  // Een resource met inzet 1: de brug legt het werk vast (24 u).
  const r = S().addResource({ name: 'R', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(id, r, 1);
  S().runCPM();
  eq('d4 voorwaarde: 3 d in de dagenmaat eindigt vr 13:00', S().tasks[0].time.earlyFinish, '2026-06-05T13:00');
  S().setProject({ defaultWorkRule: 'FIXED_WORK' });
  eq('d4 setProject: urenmaat 24 u en de planning is verouderd', [measure(S().tasks[0]), S().scheduleStale], [['hours', 1440, 3], true]);
  eq('d4 setProject: de brug legt het werk van de resource vast (24 u × inzet 1)',
    [S().assignments[0].unitsPerDay, S().assignments[0].remainingWorkMinutes], [1, 1440]);
  S().runCPM();
  eq('d4 opnieuw rekenen: het einde is ma 09:00', S().tasks[0].time.earlyFinish, MA_0900);
  // Een mijlpaal en een ELAPSEDTIME-taak vallen buiten de regel en blijven ongemoeid.
  S().setProject({ defaultWorkRule: 'FIXED_DURATION_RATE' });
  const m = S().addTask({ name: 'M', isMilestone: true, time: createDefaultTaskTime(WO, 0) });
  const e = S().addTask({ name: 'E', time: { ...createDefaultTaskTime(WO, 2), durationType: 'ELAPSEDTIME' } });
  S().setProject({ defaultWorkRule: 'FIXED_WORK' });
  const byId = (x: string) => S().tasks.find(t => t.id === x)!;
  eq('d5 mijlpaal en ELAPSEDTIME: blijven in de dagenmaat', [byId(m).time.durationUnit, byId(e).time.durationUnit], ['days', 'days']);
  // Dezelfde standaard opnieuw zetten is geen bewerking.
  const events = S().historyEvents.length;
  S().setProject({ defaultWorkRule: 'FIXED_WORK' });
  eq('d6 dezelfde standaard: geen undo-stap', S().historyEvents.length, events);
}

// ── MCP ──────────────────────────────────────────────────────────────────────────
async function mcp() {
  {
    const f = fixture();
    const before = applied(f);
    const res = await getTool('planner_update_project')!.handler({ defaultWorkRule: 'FIXED_WORK' }, makeMcpContext(f.context)) as McpToolResult;
    eq('m1 planner_update_project: slaagt', res.ok, true);
    const data = (res as McpToolOk).data as { hourMeasureTaskIds?: string[] };
    eq('m1 planner_update_project: noemt de omgezette taken', data.hourMeasureTaskIds, [f.vId, f.aId, f.bId]);
    expectSwitched('m1 planner_update_project', f);
    eq('m1 planner_update_project: één undo-stap', applied(f), before + 1);
    expectUndone('m1 planner_update_project', f, before);
  }
  {
    const f = fixture();
    const before = applied(f);
    const res = await getTool('planner_batch')!.handler({ steps: [
      { tool: 'planner_update_project', args: { defaultWorkRule: 'FIXED_WORK' } },
      { tool: 'planner_get_task', args: { taskId: f.aId } },
    ] }, makeMcpContext(f.context)) as McpToolResult;
    eq('m2 batch: slaagt', res.ok, true);
    const read = res.ok ? JSON.stringify((res.data as { steps: unknown[] }).steps[1]) : '';
    eq('m2 batch: de leesstap ziet de urenmaat en het einde ma 09:00',
      [/"durationUnit":"hours"/.test(read), read.match(/"earlyFinish":"([^"]+)"/)?.[1] ?? null], [true, MA_0900]);
    expectSwitched('m2 batch', f);
    eq('m2 batch: één undo-stap', applied(f), before + 1);
    expectUndone('m2 batch', f, before);
  }
  {
    const f = fixture();
    const before = applied(f);
    const tx = createMcpTransactions(f.context);
    eq('m3 draft.setProject: slaagt', tx.run(() => { tx.draft.setProject({ defaultWorkRule: 'FIXED_WORK' }); }).ok, true);
    expectSwitched('m3 draft.setProject', f);
    expectUndone('m3 draft.setProject', f, before);
  }
  // De terugweg via MCP: `null` wist de standaard; de urenmaat blijft.
  {
    const f = fixture();
    await getTool('planner_update_project')!.handler({ defaultWorkRule: 'FIXED_WORK' }, makeMcpContext(f.context));
    const res = await getTool('planner_update_project')!.handler({ defaultWorkRule: null }, makeMcpContext(f.context)) as McpToolResult;
    const st = stand(f);
    eq('m4 terugweg MCP: de sleutel is weg en A blijft 24 u urenmaat met einde ma 09:00',
      [res.ok, 'defaultWorkRule' in f.context.store.getState().project, st.a, st.aFinish], [true, false, ['hours', 1440, 3], MA_0900]);
    eq('m4 terugweg MCP: geen taken omgezet', ((res as McpToolOk).data as { hourMeasureTaskIds?: string[] }).hourMeasureTaskIds, undefined);
  }

  if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
  console.log(`projectstandaard vast werk (knownbug 251): ${checks - errors.length}/${checks} groen`);
}
void mcp().catch(error => { console.error(error); process.exitCode = 1; });
