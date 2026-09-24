// check-value-based-triggers.ts — WANNEER een gevolgregel van een taakbewerking vuurt: alleen bij een
// ECHT gewijzigde waarde, niet omdat de sleutel is meegestuurd (`taskTriggerChanges` in
// taskDefaults.ts, structurele gelijkheid via `sameValue`).
//
// Aanleiding: "Taak bewerken" openen en zonder iets te wijzigen op OK drukken liet de uit MS Project
// geïmporteerde sturing los (laag 3: `timephasedFinishFloor`/`timephasedStartAnchor`; laag 4 met
// bevroren `workMinutes`), gaf de melding `mppTimephasedSteeringLost`, zette het document op
// gewijzigd en maakte een undo-stap. `TaskDialog.handleSave` stuurt namelijk ALTIJD het volledige
// `time`-object en alle top-level velden mee, en de app besliste op sleutel-aanwezigheid. Het
// taakraster wiste om dezelfde reden nivelleergaten bij een ongewijzigde celwaarde.
//
// Routes: de store (`updateTask`, met exact de payload van `TaskDialog.handleSave`) en het taakraster
// via de ECHTE gridtransactie (`runGridMutation`: duurcel in beide invoervormen, constraint- en
// voortgangscel). De MCP-route (`planner_update_tasks` via de echte dispatch) staat in
// tests/mcp/cases-waarde-triggers.ts; het echte venster in tests/browser/task-dialog-no-op.spec.ts.
//
// Bewust alleen publieke store-acties en bestaande helpers: deze check moet ook tegen de broncode
// van vóór de fix bundelen (en daar rood staan).
//
// MOET de eerste import blijven: zie domStub.ts.
import './domStub';
import { createAppStoreContext, type AppState } from '@/state/appStore';
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

// ── Fixtures ─────────────────────────────────────────────────────────────────
const BANDS = [{ start: 480, end: 960 }]; // 08:00–16:00 ⇒ 8 u/dag
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
const HOUR_CAL: WorkCalendar = {
  id: 'cal-uren', name: 'uren', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};
const IMPORT_SPLIT: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
const LEVELING_GAP: TaskSplitGap = { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' };
const STEERING_LOST = 'notifications.mppTimephasedSteeringLost';

type Kind = 'dag' | 'uur';
/** Laag 3 = het gelezen Z8-venster; laag 4 = per-toewijzingwandelingen met BEVROREN werk (alleen
 *  dan ontkoppelt een duurwijziging laag 4, N2). Mutueel exclusief, zoals de .mpp-lezer ze zet. */
type Layer = 'laag3' | 'laag4';

interface Fixture { S: () => AppState; id: string; ctx: ReturnType<typeof createAppStoreContext> }

/** Verse context met één taak die MSP-sturing (laag 3 of 4), een importsplit, een nivelleergat, een
 *  SNET-constraint en al vervulde voortgangsinvarianten draagt; schoon document (niet gewijzigd,
 *  niet verouderd, geen meldingen, verse meldingspoort). */
function setup(kind: Kind, layer: Layer): Fixture {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (kind === 'uur') {
    S().setCalendar(HOUR_CAL);
    ctx.store.setState((s) => { s.ui.enableHourPlanning = true; });
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
    t.constraint = { type: 'SNET', date: '2026-06-01' };
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

/** Exact wat `TaskDialog.handleSave` (src/components/dialogs/TaskDialog.tsx) voor een BESTAANDE taak
 *  naar `updateTask` stuurt. `draft` is de kopie die het venster bij openen maakt
 *  (`{ ...editingTask, time: { ...editingTask.time } }`); `edit` bootst gebruikersinvoer na. */
function dialogSave(f: Fixture, edit?: (draft: Task) => void): void {
  const editingTask = taskOf(f);
  const draft: Task = { ...editingTask, time: { ...editingTask.time } };
  edit?.(draft);
  const startDate = editingTask.time.earlyStart || editingTask.time.scheduleStart; // veld onaangeraakt
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

/** Wat een per saldo lege bewerking moet achterlaten: sturing, gaten en document ongemoeid. */
function expectUntouched(label: string, f: Fixture, historyBefore: number, steeringBefore: unknown): void {
  const task = taskOf(f);
  eq(`${label}: MSP-sturing blijft`, steeringOf(task), steeringBefore);
  eq(`${label}: importsplit én nivelleergat blijven`, task.splitGaps ?? null, [IMPORT_SPLIT, LEVELING_GAP]);
  eq(`${label}: geen melding`, f.S().ui.notifications.map(n => n.messageKey), []);
  eq(`${label}: geen undo-stap`, f.S().historyEvents.length, historyBefore);
  eq(`${label}: document niet gewijzigd`, f.S().isDirty, false);
  eq(`${label}: planning niet verouderd`, f.S().scheduleStale, false);
}

/** Wat een echte duurwijziging doet (ongewijzigd t.o.v. vóór de fix). */
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

// ═══════════════════════════════════════════════════════════════════════════
// (a) "Taak bewerken" → OK zonder wijziging: niets.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- value-based-triggers: (a) TaskDialog-payload ongewijzigd --');
for (const kind of KINDS) {
  for (const layer of LAYERS) {
    const f = setup(kind, layer);
    const history = f.S().historyEvents.length;
    const steering = steeringOf(taskOf(f));
    dialogSave(f);
    expectUntouched(`(a) ${kind}/${layer} dialoog-OK ongewijzigd`, f, history, steering);
    // Twee keer OK is net zo leeg als één keer.
    dialogSave(f);
    expectUntouched(`(a) ${kind}/${layer} dialoog-OK tweede keer`, f, history, steering);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) Dezelfde payload met een ECHTE duurwijziging: ontkoppeling + melding zoals vóór de fix.
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// (c) Alleen de naam wijzigen: wél een undo-stap en gewijzigd document, géén ontkoppeling.
// ═══════════════════════════════════════════════════════════════════════════
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

// ── Een echte kalenderwissel via hetzelfde venster ontkoppelt nog steeds (controle). ─────────
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

// ═══════════════════════════════════════════════════════════════════════════
// (f) Nivelleergaten blijven bij een ongewijzigde constraint/voortgang in de payload.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- value-based-triggers: (f) ongewijzigde constraint/voortgang --');
{
  const f = setup('dag', 'laag3');
  const history = f.S().historyEvents.length;
  const steering = steeringOf(taskOf(f));
  const t = taskOf(f);
  // Verse objectkopieën met dezelfde waarden (andere sleutelvolgorde, expliciete undefined).
  f.S().updateTask(f.id, {
    constraint: { date: '2026-06-01', type: 'SNET', hard: undefined },
    constraint2: undefined,
    time: { ...t.time, completion: t.time.completion, actualStart: undefined, actualFinish: undefined },
  });
  expectUntouched('(f) updateTask met ongewijzigde constraint en voortgang', f, history, steering);

  // Controle: een ECHT andere constraintdatum wist het nivelleergat (en alleen dat: een constraint is
  // geen Z8-trigger).
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

// ═══════════════════════════════════════════════════════════════════════════
// (e) Taakraster: een ongewijzigde celwaarde wist niets — ook geen nivelleergaten.
// ═══════════════════════════════════════════════════════════════════════════
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
// Controles: een ECHTE celwijziging doet wat hij altijd deed.
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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  value-based-triggers: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  value-based-triggers: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
