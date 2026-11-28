import './domStub';
import { createAppStoreContext, useAppStore, type AppState } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskSplitGap } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const BANDS = [{ start: 480, end: 960 }];
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
const HOUR_CAL: WorkCalendar = {
  id: 'cal-uren', name: 'uren', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};
const IMPORT_SPLIT: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
const LEVELING_GAP: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
const STEERING_LOST = 'notifications.mppTimephasedSteeringLost';

type Kind = 'dag' | 'uur';
type Layer = 'laag3' | 'laag4';

interface Fixture { S: () => AppState; id: string; ctx: ReturnType<typeof createAppStoreContext> }

function setup(kind: Kind, layer: Layer): Fixture {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (kind === 'uur') {
    S().setCalendar(HOUR_CAL);
  }
  const id = kind === 'dag'
    ? S().addTask({ name: 'Metselwerk', time: createDefaultTaskTime('2026-06-01', 5) })
    : S().addTask({
      name: 'Metselwerk',
      time: { ...createDefaultTaskTime('2026-06-01T08:00', 2, 'hours'), durationUnit: 'hours', durationMinutes: 16 * 60 },
    });
  S().runCPM();
  ctx.store.setState((s) => {
    const t = s.tasks.find(x => x.id === id)!;
    if (layer === 'laag3') {
      t.timephasedFinishFloor = kind === 'dag' ? '2026-06-05T17:00' : '2026-06-02T16:00';
      t.timephasedStartAnchor = '2026-06-01T08:00';
    } else {
      t.timephasedDurationWalks = [{ anchor: '2026-06-01T08:00', resourceCalendarId: s.calendar.id, workMinutes: 900 }];
    }
    t.constraint = { type: 'SNET', date: kind === 'dag' ? '2026-06-01T07:00' : '2026-06-01T08:00' };
    t.time.remainingTime = Math.round(t.time.scheduleDuration * (1 - t.time.completion));
    t.splitGaps = [IMPORT_SPLIT, LEVELING_GAP];
    s.isDirty = false;
    s.scheduleStale = false;
    s.ui.notifications = [];
  });
  __resetTimephasedLossNoticeForTests();
  return { S, id, ctx };
}

const taskOf = (f: Fixture): Task => f.S().tasks.find(t => t.id === f.id)!;

function steeringOf(task: Task): unknown {
  return {
    floor: task.timephasedFinishFloor ?? null,
    anchor: task.timephasedStartAnchor ?? null,
    walks: task.timephasedDurationWalks?.length ?? 0,
  };
}

function dialogSave(f: Fixture, edit?: (draft: Task) => void): void {
  const editingTask = taskOf(f);
  const draft: Task = { ...editingTask, time: { ...editingTask.time } };
  edit?.(draft);
  const startDate = editingTask.time.earlyStart || editingTask.time.scheduleStart;
  const time = {
    ...editingTask.time,
    durationUnit: draft.time.durationUnit,
    scheduleDuration: draft.time.scheduleDuration,
    durationMinutes: draft.time.durationUnit === 'hours' ? draft.time.durationMinutes : undefined,
    completion: draft.time.completion,
    actualStart: draft.time.actualStart,
    actualFinish: draft.time.actualFinish,
  };
  const shownStart = editingTask.time.earlyStart || editingTask.time.scheduleStart;
  if (startDate !== shownStart) time.scheduleStart = startDate;
  const milestoneTransition = taskMilestoneTransition(editingTask, draft.isMilestone);
  if (milestoneTransition.time) Object.assign(time, milestoneTransition.time);
  f.S().updateTask(editingTask.id, {
    name: draft.name,
    description: draft.description,
    wbsCode: draft.wbsCode,
    taskType: draft.taskType,
    customTaskTypeId: draft.customTaskTypeId,
    calendarId: draft.calendarId,
    isMilestone: draft.isMilestone,
    milestoneKind: draft.milestoneKind,
    mandatory: draft.mandatory,
    isHammock: draft.isHammock,
    constraint: draft.constraint,
    constraint2: draft.constraint2,
    deadline: draft.deadline,
    notes: draft.notes,
    time,
  });
}

function cell(taskId: string, columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route, value };
}

function grid(f: Fixture, columnId: string, route: CellEditIntent['route'], value: unknown, label: string): void {
  const res = f.S().runGridMutation([cell(f.id, columnId, route, value)]);
  if (!res.ok) diffs.push(`${label}: gridtransactie geweigerd ${JSON.stringify(res)}`);
}

function expectUntouched(label: string, f: Fixture, historyBefore: number, steeringBefore: unknown): void {
  const task = taskOf(f);
  eq(`${label}: MSP-sturing blijft`, steeringOf(task), steeringBefore);
  eq(`${label}: importsplit én nivelleergat blijven`, task.splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
  eq(`${label}: geen melding`, f.S().ui.notifications.map(n => n.messageKey), []);
  eq(`${label}: geen undo-stap`, f.S().historyEvents.length, historyBefore);
  eq(`${label}: document niet gewijzigd`, f.S().isDirty, false);
  eq(`${label}: planning niet verouderd`, f.S().scheduleStale, false);
}

function expectDurationChangeRules(label: string, f: Fixture, historyBefore: number): void {
  const task = taskOf(f);
  eq(`${label}: MSP-sturing losgelaten`, steeringOf(task), { floor: null, anchor: null, walks: 0 });
  eq(`${label}: nivelleergat gewist, importsplit blijft`, task.splitGaps ?? null, [IMPORT_SPLIT]);
  eq(`${label}: melding`, f.S().ui.notifications.map(n => n.messageKey), [STEERING_LOST]);
  eq(`${label}: één undo-stap`, f.S().historyEvents.length, historyBefore + 1);
  eq(`${label}: document gewijzigd`, f.S().isDirty, true);
}

const KINDS: readonly Kind[] = ['dag', 'uur'];
const LAYERS: readonly Layer[] = ['laag3', 'laag4'];

console.log('-- value-based-triggers: (a) TaskDialog-payload ongewijzigd --');
for (const kind of KINDS) {
  for (const layer of LAYERS) {
    const f = setup(kind, layer);
    const history = f.S().historyEvents.length;
    const steering = steeringOf(taskOf(f));
    dialogSave(f);
    expectUntouched(`(a) ${kind}/${layer} dialoog-OK ongewijzigd`, f, history, steering);
    dialogSave(f);
    expectUntouched(`(a) ${kind}/${layer} dialoog-OK tweede keer`, f, history, steering);
  }
}

console.log('-- value-based-triggers: (b) TaskDialog-payload met echte duurwijziging --');
for (const kind of KINDS) {
  for (const layer of LAYERS) {
    const f = setup(kind, layer);
    const history = f.S().historyEvents.length;
    dialogSave(f, (draft) => {
      if (kind === 'dag') draft.time.scheduleDuration = 7;
      else { draft.time.durationMinutes = 20 * 60; draft.time.scheduleDuration = 2.5; }
    });
    expectDurationChangeRules(`(b) ${kind}/${layer} dialoog-OK met nieuwe duur`, f, history);
  }
}

console.log('-- value-based-triggers: (c) alleen de naam --');
for (const layer of LAYERS) {
  const f = setup('dag', layer);
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  dialogSave(f, (draft) => { draft.name = 'Metselwerk begane grond'; });
  const task = taskOf(f);
  const label = `(c) dag/${layer} alleen naam`;
  eq(`${label}: naam gezet`, task.name, 'Metselwerk begane grond');
  eq(`${label}: MSP-sturing blijft`, steeringOf(task), steering);
  eq(`${label}: nivelleergat blijft`, task.splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
  eq(`${label}: geen melding`, f.S().ui.notifications.map(n => n.messageKey), []);
  eq(`${label}: één undo-stap`, f.S().historyEvents.length, history + 1);
  eq(`${label}: document gewijzigd`, f.S().isDirty, true);
}

{
  const f = setup('dag', 'laag3');
  f.S().addCalendar({ ...f.S().calendar, name: 'andere kalender' });
  const otherCal = f.S().calendars.find(c => c.name === 'andere kalender')!.id;
  const history = f.S().historyEvents.length;
  dialogSave(f, (draft) => { draft.calendarId = otherCal; });
  const task = taskOf(f);
  eq('(c) kalenderwissel via het venster: laag 3 losgelaten', steeringOf(task), { floor: null, anchor: null, walks: 0 });
  eq('(c) kalenderwissel: nivelleergat gewist', task.splitGaps ?? null, [IMPORT_SPLIT]);
  eq('(c) kalenderwissel: melding', f.S().ui.notifications.map(n => n.messageKey), [STEERING_LOST]);
  eq('(c) kalenderwissel: één undo-stap', f.S().historyEvents.length, history + 1);
}

console.log('-- value-based-triggers: (f) ongewijzigde constraint/voortgang --');
{
  const f = setup('dag', 'laag3');
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  const t = taskOf(f);
  f.S().updateTask(f.id, {
    constraint: { date: '2026-06-01', type: 'SNET', hard: undefined },
    constraint2: undefined,
    time: { ...t.time, completion: t.time.completion, actualStart: undefined, actualFinish: undefined },
  });
  expectUntouched('(f) updateTask met ongewijzigde constraint en voortgang', f, history, steering);

  f.S().updateTask(f.id, { constraint: { type: 'SNET', date: '2026-06-03' } });
  eq('(f) echte constraintwijziging: nivelleergat gewist', taskOf(f).splitGaps ?? null, [IMPORT_SPLIT]);
  eq('(f) echte constraintwijziging: MSP-sturing blijft', steeringOf(taskOf(f)), steering);
}
{
  const f = setup('dag', 'laag3');
  const t = taskOf(f);
  f.S().updateTask(f.id, { time: { ...t.time, completion: 0.4, actualStart: '2026-06-01' } });
  eq('(f) echte voortgang via updateTask: nivelleergat gewist', taskOf(f).splitGaps ?? null, [IMPORT_SPLIT]);
}

console.log('-- value-based-triggers: (e) taakraster, ongewijzigde celwaarde --');
for (const kind of KINDS) {
  for (const layer of LAYERS) {
    const f = setup(kind, layer);
    const history = f.S().historyEvents.length;
    const steering = steeringOf(taskOf(f));
    const same = kind === 'dag' ? parseTaskDurationInput('5d', 'days') : parseTaskDurationInput('16h', 'hours');
    grid(f, 'task.time.scheduleDuration', 'task-schedule', same, `(e) ${kind}/${layer} eenheidsobject`);
    expectUntouched(`(e) ${kind}/${layer} duurcel (eenheidsobject) ongewijzigd`, f, history, steering);
  }
}
{
  const f = setup('dag', 'laag3');
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  grid(f, 'task.time.scheduleDuration', 'task-schedule', 5 * 480, '(e) minutenvorm');
  expectUntouched('(e) dag duurcel (minutenvorm) ongewijzigd', f, history, steering);
  grid(f, 'task.constraint.type', 'task-constraint', 'SNET', '(e) constraint');
  expectUntouched('(e) constraintcel ongewijzigd', f, history, steering);
  grid(f, 'task.time.completion', 'task-progress', 0, '(e) voortgang');
  expectUntouched('(e) voortgangscel ongewijzigd', f, history, steering);
}
for (const layer of LAYERS) {
  const f = setup('dag', layer);
  const history = f.S().historyEvents.length;
  grid(f, 'task.time.scheduleDuration', 'task-schedule', parseTaskDurationInput('7d', 'days'), `(e) ${layer} echte duur`);
  expectDurationChangeRules(`(e) dag/${layer} duurcel (eenheidsobject) 5 → 7`, f, history);
}
{
  const f = setup('dag', 'laag3');
  grid(f, 'task.constraint.date', 'task-constraint', '2026-06-03', '(e) echte constraintdatum');
  eq('(e) echte constraintdatum in het raster: nivelleergat gewist', taskOf(f).splitGaps ?? null, [IMPORT_SPLIT]);
}

console.log('-- value-based-triggers: (g) voortgangssetters op dezelfde waarde --');

function setupProgress(done = false): Fixture {
  const f = setup('dag', 'laag3');
  f.S().setTaskProgress(f.id, 0.5);
  if (done) f.S().setActualFinish(f.id, '2026-06-05');
  f.S().runCPM();
  f.ctx.store.setState((s) => {
    s.tasks.find(x => x.id === f.id)!.splitGaps = [IMPORT_SPLIT, LEVELING_GAP];
    s.isDirty = false;
    s.scheduleStale = false;
    s.ui.notifications = [];
  });
  return f;
}

function expectProgressRules(label: string, f: Fixture, historyBefore: number, steeringBefore: unknown): void {
  const task = taskOf(f);
  eq(`${label}: nivelleergat gewist, importsplit blijft`, task.splitGaps ?? null, [IMPORT_SPLIT]);
  eq(`${label}: MSP-sturing blijft`, steeringOf(task), steeringBefore);
  eq(`${label}: één undo-stap`, f.S().historyEvents.length, historyBefore + 1);
  eq(`${label}: document gewijzigd`, f.S().isDirty, true);
  eq(`${label}: planning verouderd`, f.S().scheduleStale, true);
}

{
  const f = setupProgress();
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  const actualStart = taskOf(f).time.actualStart;
  eq('(g) opzet: 50% met afgeleide actualStart', [taskOf(f).time.completion, !!actualStart], [0.5, true]);
  f.S().setTaskProgress(f.id, 0.5);
  expectUntouched('(g) setTaskProgress(50%) op een 50%-taak', f, history, steering);
  eq('(g) setActualStart(huidige datum) wordt geaccepteerd', f.S().setActualStart(f.id, actualStart), true);
  expectUntouched('(g) setActualStart(huidige datum)', f, history, steering);
  eq('(g) setActualFinish(undefined) zonder actualFinish wordt geaccepteerd', f.S().setActualFinish(f.id, undefined), true);
  expectUntouched('(g) setActualFinish(undefined) op een taak zonder werkelijk einde', f, history, steering);
  eq('(g) de taak zelf is onveranderd', [taskOf(f).time.completion, taskOf(f).time.actualStart, taskOf(f).status],
    [0.5, actualStart, 'STARTED']);
}
{
  const f = setupProgress(true);
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  eq('(g) opzet: voltooid', [taskOf(f).time.completion, taskOf(f).time.actualFinish, taskOf(f).status],
    [1, "2026-06-05T16:00", 'COMPLETED']);
  eq('(g) setActualFinish(huidige datum) wordt geaccepteerd', f.S().setActualFinish(f.id, '2026-06-05'), true);
  expectUntouched('(g) setActualFinish(huidige datum) op een voltooide taak', f, history, steering);
  f.S().setTaskProgress(f.id, 1);
  expectUntouched('(g) setTaskProgress(100%) op een voltooide taak', f, history, steering);
}

{
  const f = setupProgress();
  f.ctx.store.setState((s) => { s.project.statusDate = '2026-06-03'; });
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  const before = JSON.stringify(taskOf(f));
  eq('(g) setActualStart ná de statusdatum wordt geweigerd', f.S().setActualStart(f.id, '2026-06-10'), false);
  eq('(g) setActualFinish ná de statusdatum wordt geweigerd', f.S().setActualFinish(f.id, '2026-06-10'), false);
  eq('(g) geweigerd: taak onveranderd', JSON.stringify(taskOf(f)), before);
  expectUntouched('(g) geweigerde actuals', f, history, steering);
}

{
  const f = setupProgress();
  const history = f.S().historyEvents.length;
  const key = { coalesceKey: `progress:${f.id}:sleep` };
  f.S().setTaskProgress(f.id, 0.6, key);
  f.S().setTaskProgress(f.id, 0.6, key);
  f.S().setTaskProgress(f.id, 0.7, key);
  eq('(g) slider-sleep 50→60→60→70: één undo-stap', f.S().historyEvents.length, history + 1);
  eq('(g) slider-sleep: eindwaarde 70%', taskOf(f).time.completion, 0.7);
  f.S().undo();
  eq('(g) slider-sleep: één Ctrl+Z terug naar 50%', taskOf(f).time.completion, 0.5);
  eq('(g) slider-sleep: undo herstelt het nivelleergat', taskOf(f).splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
}

console.log('-- value-based-triggers: (h) voortgangssetters met een echte wijziging --');
{
  const f = setupProgress();
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  f.S().setTaskProgress(f.id, 0.6);
  expectProgressRules('(h) setTaskProgress 50% → 60%', f, history, steering);
}
{
  const f = setupProgress();
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  eq('(h) setActualStart op een andere datum wordt geaccepteerd', f.S().setActualStart(f.id, '2026-06-02'), true);
  expectProgressRules('(h) setActualStart → andere datum', f, history, steering);
}
{
  const f = setupProgress();
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  eq('(h) setActualFinish op een 50%-taak wordt geaccepteerd', f.S().setActualFinish(f.id, '2026-06-05'), true);
  expectProgressRules('(h) setActualFinish op een 50%-taak', f, history, steering);
  eq('(h) setActualFinish: voltooid', [taskOf(f).time.completion, taskOf(f).status], [1, 'COMPLETED']);
}
{
  const f = setupProgress(true);
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  f.S().setActualFinish(f.id, undefined);
  expectProgressRules('(h) setActualFinish(undefined) wist een werkelijk einde', f, history, steering);
  eq('(h) werkelijk einde gewist ⇒ terug naar in uitvoering', [taskOf(f).time.completion, taskOf(f).status], [0, 'STARTED']);
}
{
  const f = setupProgress();
  f.ctx.store.setState((s) => {
    const t = s.tasks.find(x => x.id === f.id)!;
    delete t.time.actualStart;
    t.status = 'NOT_STARTED';
  });
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  const expectedStart = taskOf(f).time.earlyStart || taskOf(f).time.scheduleStart;
  f.S().setTaskProgress(f.id, 0.5);
  eq('(h) 50% zonder actualStart → 50%: actualStart ingevuld', taskOf(f).time.actualStart, expectedStart);
  eq('(h) 50% zonder actualStart → 50%: status STARTED', taskOf(f).status, 'STARTED');
  expectProgressRules('(h) 50% zonder actualStart → 50%', f, history, steering);
}

console.log('-- value-based-triggers: (i) contextmenu-bulk over een fase --');
{
  const S = () => useAppStore.getState();
  const byId = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;

  function phase(): { p: string; a: string; b: string; c: string } {
    S().newProject();
    S().setProject({ startDate: '2026-06-01' });
    const p = S().addTask({ name: 'Ruwbouw' });
    const [a, b, c] = ['A', 'B', 'C'].map(n =>
      S().addTask({ name: `Kind ${n}`, parentId: p, time: createDefaultTaskTime('2026-06-01', 5) }));
    S().setTaskProgress(a, 0.5);
    S().setTaskProgress(c, 0.5);
    S().runCPM();
    useAppStore.setState((s) => {
      for (const t of s.tasks) if (t.id !== p) t.splitGaps = [IMPORT_SPLIT, LEVELING_GAP];
      s.isDirty = false;
      s.scheduleStale = false;
      s.ui.notifications = [];
    });
    return { p, a, b, c };
  }

  {
    const { p, a, b, c } = phase();
    S().selectTasks([p, a, b, c], false);
    const history = applied();
    contextMenuBulk.setProgress(a, 0.5);
    eq('(i) fase-bulk: alle kinderen op 50%', [a, b, c].map(id => byId(id).time.completion), [0.5, 0.5, 0.5]);
    eq('(i) fase-bulk: A (al 50%) houdt zijn nivelleergat', byId(a).splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
    eq('(i) fase-bulk: C (al 50%) houdt zijn nivelleergat', byId(c).splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
    eq('(i) fase-bulk: B (0% → 50%) verliest zijn nivelleergat', byId(b).splitGaps ?? null, [IMPORT_SPLIT]);
    eq('(i) fase-bulk: één undo-stap', applied(), history + 1);
    eq('(i) fase-bulk: document gewijzigd', S().isDirty, true);
    eq('(i) fase-bulk: planning verouderd', S().scheduleStale, true);
    S().undo();
    eq('(i) fase-bulk: één Ctrl+Z zet B terug op 0% mét nivelleergat',
      [byId(b).time.completion, byId(b).splitGaps ?? null], [0, [IMPORT_SPLIT, LEVELING_GAP]]);
  }
  {
    const { a, c } = phase();
    S().selectTasks([a, c], false);
    const history = applied();
    contextMenuBulk.setProgress(c, 0.5);
    eq('(i) no-op-bulk: nivelleergaten blijven',
      [a, c].map(id => byId(id).splitGaps ?? null), [[IMPORT_SPLIT, LEVELING_GAP], [IMPORT_SPLIT, LEVELING_GAP]]);
    eq('(i) no-op-bulk: geen undo-stap', applied(), history);
    eq('(i) no-op-bulk: document niet gewijzigd', S().isDirty, false);
    eq('(i) no-op-bulk: planning niet verouderd', S().scheduleStale, false);
  }
}

if (diffs.length === 0) { console.log(`OK  value-based-triggers: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  value-based-triggers: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
