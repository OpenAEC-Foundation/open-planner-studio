// De uitleg na F5 (#742): welke taken verschoven, waarom, en Ongedaan maken in één stap.
// De reden is alleen zeker als hij uit de solver of uit de vorige invoer komt; anders `unknown`.
import { deepStrictEqual, strictEqual } from 'node:assert';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { canUndoScheduleShift, previousSolveBasis, SCHEDULE_SHIFT_NOTICE_KEY } from '@/state/scheduleShift';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { ShiftReason } from '@/engine/scheduler/shiftExplanation';
import type { Task } from '@/types/task';

type Store = ReturnType<typeof createAppStoreContext>['store'];

function setup() {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  return { store, S };
}

function task(store: Store, id: string): Task {
  return store.getState().tasks.find(t => t.id === id)!;
}

function withDuration(store: Store, id: string, days: number) {
  store.getState().updateTask(id, { time: { ...task(store, id).time, scheduleDuration: days } });
}

function reasons(store: Store): Record<string, ShiftReason> {
  const out: Record<string, ShiftReason> = {};
  for (const row of store.getState().scheduleShift?.report.tasks ?? []) out[row.taskId] = row.reason;
  return out;
}

const toasts = (store: Store) =>
  store.getState().ui.notifications.filter(n => n.dedupeKey === SCHEDULE_SHIFT_NOTICE_KEY);

/** A → B → C, doorgerekend. */
function chain() {
  const ctx = setup();
  const { S } = ctx;
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  return { ...ctx, a, b, c };
}

// 1. Het spoor neemt niet deel aan de berekening, in elk profiel en in beide maten.
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const hours of [false, true]) {
    const data = generateBenchmarkProject(300, { seed: 0x742 });
    data.project.schedulingProfile = builtInProfile(profile);
    const leaves = data.tasks.filter(isLeafTask);
    leaves[0].status = 'STARTED';
    leaves[0].time.completion = 0.5;
    leaves[0].time.actualStart = leaves[0].time.scheduleStart;
    leaves[1].manuallyScheduled = true;
    leaves[2].isHammock = true;
    leaves[3].constraint = { type: 'ALAP' };
    if (hours) {
      for (const t of data.tasks) {
        t.time.durationUnit = 'hours';
        t.time.durationMinutes = t.time.scheduleDuration * 480;
      }
    }
    const solve = (traceDateDrivers: boolean) => {
      const tasks = cloneTasksForSolve(data.tasks);
      const input = solveInputFor(data.project, tasks, data.sequences, data.calendar, [data.calendar]);
      return { tasks, result: solveProject({ ...input, traceDateDrivers }) };
    };
    const plain = solve(false);
    const traced = solve(true);
    const drivers = traced.result.dateDriverByTaskId!;
    strictEqual(plain.result.dateDriverByTaskId, undefined, 'zonder optie geen spoor');
    delete traced.result.dateDriverByTaskId;
    deepStrictEqual(traced.result, plain.result, `${profile}/${hours}: zelfde resultaat`);
    deepStrictEqual(traced.tasks, plain.tasks, `${profile}/${hours}: zelfde taken`);
    for (const leaf of leaves) strictEqual(typeof drivers[leaf.id]?.kind, 'string', `driver voor ${leaf.id}`);
    strictEqual(drivers[leaves[1].id].kind, 'manual');
    strictEqual(drivers[leaves[2].id].kind, 'hammock');
  }
}

// 2. Een langere voorganger: elke opvolger noemt zijn eigen voorganger, plus de oplevering.
{
  const { store, S, a, b, c } = chain();
  const oldEnd = S().cpmResult!.projectEnd;
  const previousFinish = task(store, b).time.earlyFinish;
  withDuration(store, a, 10);
  const stale = S();
  strictEqual(stale.scheduleStale, true);
  S().recalculate();
  const r = reasons(store);
  deepStrictEqual(r[a], { kind: 'duration' });
  deepStrictEqual(r[b], { kind: 'predecessor', taskIds: [a] });
  deepStrictEqual(r[c], { kind: 'predecessor', taskIds: [b] });
  const report = S().scheduleShift!.report;
  strictEqual(report.tasks.find(t => t.taskId === b)!.previousFinish, previousFinish);
  strictEqual(report.tasks.find(t => t.taskId === b)!.finish, task(store, b).time.earlyFinish);
  strictEqual(report.projectEndWorkdays! > 0, true, 'oplevering later');
  strictEqual(S().cpmResult!.projectEnd > oldEnd, true);

  // De melding: twee knoppen, en de teller staat in `params`.
  const [notice] = toasts(store);
  strictEqual(notice.messageKey, 'scheduleShift.notice');
  strictEqual(notice.params?.count, report.tasks.length);
  strictEqual(notice.detailLines?.[0].messageKey, 'scheduleShift.deliveryLater');
  strictEqual(notice.action?.kind, 'showScheduleShift');
  strictEqual(notice.secondaryAction?.kind, 'undoScheduleShift');

  // F5 blijft geen eigen undo-stap en maakt het document niet vuil.
  strictEqual(S().historyEvents.length, stale.historyEvents.length, 'geen eigen undo-stap');
  strictEqual(S().isDirty, stale.isDirty);
  strictEqual(canUndoScheduleShift(S()), true);

  // Nogmaals F5 zonder verschil: uitleg, melding en Ongedaan maken blijven.
  const shift = S().scheduleShift;
  S().recalculate();
  strictEqual(S().scheduleShift, shift);
  strictEqual(toasts(store).length, 1);
  strictEqual(canUndoScheduleShift(S()), true);

  // Ongedaan maken: alleen de berekening terug. De bewerking blijft, de planning is weer verouderd.
  S().undoScheduleShift();
  strictEqual(task(store, b).time.earlyFinish, previousFinish);
  strictEqual(task(store, a).time.scheduleDuration, 10);
  strictEqual(S().scheduleStale, true);
  strictEqual(S().cpmResult, stale.cpmResult);
  strictEqual(S().resourceLoadResult, stale.resourceLoadResult);
  strictEqual(S().scheduleShift, null);
  strictEqual(toasts(store).length, 0);

  // Daarna klopt de geschiedenis nog: Ctrl+Z neemt de bewerking terug, redo zet hem terug.
  S().undo();
  strictEqual(task(store, a).time.scheduleDuration !== 10, true);
  S().redo();
  strictEqual(task(store, a).time.scheduleDuration, 10);
  strictEqual(S().scheduleStale, true, 'redo geeft de stand van na Ongedaan maken');
  strictEqual(task(store, b).time.earlyFinish, previousFinish);
}

// 3. Ctrl+Z na F5 werkt zoals altijd: de bewerking en de berekening samen.
{
  const { store, S, a, b } = chain();
  const before = task(store, b).time.earlyFinish;
  const duration = task(store, a).time.scheduleDuration;
  withDuration(store, a, 10);
  S().recalculate();
  S().undo();
  strictEqual(task(store, a).time.scheduleDuration, duration);
  strictEqual(task(store, b).time.earlyFinish, before);
  strictEqual(canUndoScheduleShift(S()), false, 'de knop verdwijnt na Ctrl+Z');
}

// 4. Na een volgende bewerking kan Ongedaan maken niet meer; de lijst blijft staan.
{
  const { store, S, a, b } = chain();
  withDuration(store, a, 10);
  S().recalculate();
  const report = S().scheduleShift!.report;
  S().updateTask(b, { name: 'B2' });
  strictEqual(canUndoScheduleShift(S()), false);
  S().undoScheduleShift();
  strictEqual(task(store, a).time.scheduleDuration, 10);
  strictEqual(task(store, b).name, 'B2');
  strictEqual(S().scheduleShift?.report, report);
}

// 5. Een gewijzigde duur met gelijke start: de eigen duur, als hij echt uit de vorige invoer blijkt.
{
  const { store, S, b } = chain();
  withDuration(store, b, 8);
  S().recalculate();
  deepStrictEqual(reasons(store)[b], { kind: 'duration' });
}

// 6. Een constraint schuift de taak: vaste datum.
{
  const { store, S, b, c } = chain();
  S().updateTask(b, { constraint: { type: 'SNET', date: '2026-07-06T07:00' } });
  S().recalculate();
  const r = reasons(store);
  deepStrictEqual(r[b], { kind: 'constraint' });
  deepStrictEqual(r[c], { kind: 'predecessor', taskIds: [b] });
}

// 7. De statusdatum duwt niet-gestart werk vooruit.
{
  const { store, S, a } = chain();
  S().setStatusDate('2026-08-03');
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'statusDate', date: '2026-08-03' });
}

// 8. Een nivelleringsvertraging: de resource, met naam alleen als het er één is.
{
  const { store, S, a, b } = chain();
  const resource = S().addResource({ name: 'Metselaar', description: '', type: 'LABOR', maxUnits: 1 });
  S().assignResource(b, resource, 1);
  S().runCPM();
  store.setState(s => { s.tasks.find(t => t.id === b)!.levelingDelay = 4; });
  S().updateTask(a, { name: 'A2' });
  S().recalculate();
  deepStrictEqual(reasons(store)[b], { kind: 'resource', resourceIds: [resource] });
}

// 9. Een feestdag in de looptijd: gelijke start, later einde, en de kalender veranderde.
// Valt de feestdag op de start, dan schuift ook de start, en is de kalender nog steeds de reden.
{
  const { store, S, a, b } = chain();
  const name = S().calendar.name;
  const span = S().cpmResult!.tasks.get(a)!;
  strictEqual(span.earlyStart.slice(0, 10), '2026-06-01');
  S().setCalendar({ ...S().calendar, holidays: [...S().calendar.holidays, { name: 'Vrij', startDate: '2026-06-02', endDate: '2026-06-02' }] });
  S().recalculate();
  const r = reasons(store);
  deepStrictEqual(r[a], { kind: 'calendar', calendarName: name });
  deepStrictEqual(r[b], { kind: 'predecessor', taskIds: [a] });
}
{
  const { store, S, a } = chain();
  const name = S().calendar.name;
  S().setCalendar({ ...S().calendar, holidays: [...S().calendar.holidays, { name: 'Vrij', startDate: '2026-06-01', endDate: '2026-06-01' }] });
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'calendar', calendarName: name });
}

// 10. Geen vorige invoer, of twee oorzaken tegelijk: de reden is niet vast te stellen.
{
  const { store, S, a } = chain();
  store.setState(s => {
    const t = s.tasks.find(x => x.id === a)!;
    t.time.scheduleDuration += 4;
    s.scheduleStale = true;
  });
  strictEqual(previousSolveBasis(S()), null);
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'unknown' });
}
{
  const { store, S, a } = chain();
  withDuration(store, a, 9);
  S().setCalendar({ ...S().calendar, holidays: [...S().calendar.holidays, { name: 'Vrij', startDate: '2026-06-03', endDate: '2026-06-03' }] });
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'unknown' });
}

// 11. De basis is de OUDSTE bewerking sinds de berekening; teruggedraaide stappen tellen niet mee.
{
  const { store, S, a, b } = chain();
  const original = task(store, a).time.scheduleDuration;
  withDuration(store, a, 7);
  withDuration(store, b, 7);
  strictEqual(previousSolveBasis(S())!.tasks.find(t => t.id === a)!.time.scheduleDuration, original);
  S().undo();
  S().undo();
  strictEqual(previousSolveBasis(S()), null);
}

// 12. Voortgang, handmatig en hammock krijgen hun eigen reden.
{
  // Voltooid: het getoonde einde is al het werkelijke einde, dus alleen de opvolger verschuift.
  const { store, S, a, b } = chain();
  S().updateTask(a, {
    time: { ...task(store, a).time, completion: 1, actualStart: '2026-06-01T07:00', actualFinish: '2026-06-19T16:00' },
  });
  S().recalculate();
  strictEqual(reasons(store)[a], undefined);
  deepStrictEqual(reasons(store)[b], { kind: 'predecessor', taskIds: [a] });
}
{
  // Lopend: de restduur na de statusdatum bepaalt het einde. Verandert alleen de voortgang, dan is
  // dat de reden en niet de statusdatum die al vaststond.
  const { store, S, a } = chain();
  S().setStatusDate('2026-06-03');
  S().updateTask(a, { time: { ...task(store, a).time, completion: 0.2, actualStart: '2026-06-01T07:00' } });
  S().runCPM();
  S().updateTask(a, { time: { ...task(store, a).time, completion: 0.6 } });
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'progress' });
}
{
  const { store, S, a } = chain();
  S().updateTask(a, { manuallyScheduled: true });
  S().runCPM();
  S().updateTask(a, {
    time: { ...task(store, a).time, scheduleStart: '2026-06-08T07:00', scheduleFinish: '2026-06-12T16:00' },
  });
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'manual' });
}

// 13. Twee voorgangers bepalen samen de start: beide staan erin.
{
  const { store, S } = setup();
  const p = S().addTask({ name: 'P' });
  const q = S().addTask({ name: 'Q' });
  const r = S().addTask({ name: 'R' });
  S().addSequence({ predecessorId: p, successorId: r, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: q, successorId: r, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  withDuration(store, p, 12);
  withDuration(store, q, 12);
  S().recalculate();
  const reason = reasons(store)[r];
  strictEqual(reason.kind, 'predecessor');
  if (reason.kind === 'predecessor') deepStrictEqual([...reason.taskIds].sort(), [p, q].sort());
}

// 14. Een verzameltaak telt niet mee; korter maken geeft een eerdere oplevering.
{
  const { store, S } = setup();
  const phase = S().addTask({ name: 'Fase' });
  const x = S().addTask({ name: 'X', parentId: phase });
  const y = S().addTask({ name: 'Y', parentId: phase });
  S().addSequence({ predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 });
  withDuration(store, x, 10);
  S().runCPM();
  withDuration(store, x, 2);
  S().recalculate();
  const ids = S().scheduleShift!.report.tasks.map(t => t.taskId);
  strictEqual(ids.includes(phase), false);
  strictEqual(ids.includes(y), true);
  strictEqual(S().scheduleShift!.report.projectEndWorkdays! < 0, true);
  strictEqual(toasts(store)[0].detailLines?.[0].messageKey, 'scheduleShift.deliveryEarlier');
}

// 15. Geen verschoven taak: geen melding, en een oude melding verdwijnt. De lijst zegt het.
{
  const { store, S, a, b } = chain();
  withDuration(store, a, 10);
  S().recalculate();
  strictEqual(toasts(store).length, 1);
  S().updateTask(b, { name: 'B2' });
  store.setState(s => { s.scheduleStale = true; });
  S().recalculate();
  strictEqual(toasts(store).length, 0);
  strictEqual(S().scheduleShift?.report.tasks.length, 0);
  strictEqual(canUndoScheduleShift(S()), false);
}

// 16. Een mislukte berekening wist de uitleg.
{
  const { store, S, a, c } = chain();
  withDuration(store, a, 10);
  S().recalculate();
  store.setState(s => {
    s.sequences.push({ id: 'kring', predecessorId: c, successorId: a, type: 'FINISH_START', lagDays: 0 });
    s.scheduleStale = true;
  });
  S().recalculate();
  strictEqual(typeof S().cpmResult?.error, 'string');
  strictEqual(S().scheduleShift, null);
  strictEqual(toasts(store).length, 0);
}

// 17. Automatisch berekenen rekent gewoon door, zonder melding.
{
  const { store, S, a } = chain();
  S().setUI({ autoCalcCPM: true });
  withDuration(store, a, 10);
  S().recalculate();
  strictEqual(S().scheduleStale, false);
  strictEqual(S().scheduleShift, null);
  strictEqual(toasts(store).length, 0);
}

// 18. Een documentwissel neemt de uitleg en de melding mee weg.
{
  const { store, S, a } = chain();
  withDuration(store, a, 10);
  S().recalculate();
  S().newDocument();
  strictEqual(S().scheduleShift, null);
  strictEqual(toasts(store).length, 0);
}

// 19. Waarom? opent het paneel en klapt de rail uit; Ongedaan maken sluit het weer.
{
  const { store, S, a } = chain();
  withDuration(store, a, 10);
  S().recalculate();
  S().setUI({ rightPanelCollapsed: true });
  S().setUI({ showScheduleShiftPanel: true });
  strictEqual(S().ui.rightPanelCollapsed, false);
  S().undoScheduleShift();
  strictEqual(S().ui.showScheduleShiftPanel, false);
}

// 20. "Datums zoals opgeslagen": F5 is daar wél een undo-stap, en Ongedaan maken loopt daarlangs.
{
  const { store, S, a, b } = chain();
  const recordedFinish = '2026-09-04T16:00';
  store.setState(s => {
    s.tasks.find(t => t.id === b)!.time.earlyFinish = recordedFinish;
    s.datesAsRecorded = true;
    s.recordedDates = { times: {}, total: 1 } as unknown as typeof s.recordedDates;
    s.scheduleStale = false;
  });
  const undoDepth = S().historyEvents.length;
  S().recalculate();
  strictEqual(S().historyEvents.length, undoDepth + 1, 'F5 in de modus is een undo-stap');
  strictEqual(S().datesAsRecorded, false);
  strictEqual(typeof S().scheduleShift?.historyEventId, 'string');
  // Zelfde start, ander einde, en geen bewerking om mee te vergelijken: niet vast te stellen.
  deepStrictEqual(reasons(store)[b], { kind: 'unknown' });
  S().undoScheduleShift();
  strictEqual(S().datesAsRecorded, true);
  strictEqual(task(store, b).time.earlyFinish, recordedFinish);
  strictEqual(task(store, a).name, 'A');
}

// De vier regressies uit de review. Elk geval rapporteert apart, zodat één fout de rest niet verbergt.
const failed: string[] = [];
function regression(name: string, body: () => void) {
  try { body(); } catch (error) { failed.push(`${name}: ${(error as Error).message}`); }
}

/** A → B → C met A op urenduur; `prepare` zet de stand vóór de eerste berekening. */
function hourTask(prepare: (ctx: ReturnType<typeof chain>) => void) {
  const ctx = chain();
  const { store, S, a } = ctx;
  S().updateTask(a, { time: { ...task(store, a).time, durationUnit: 'hours', durationMinutes: 2400, scheduleDuration: 5 } });
  prepare(ctx);
  S().runCPM();
  S().updateTask(a, { time: { ...task(store, a).time, durationMinutes: 3840, scheduleDuration: 8 } });
  S().recalculate();
  return ctx;
}

/** Zet de modus "datums zoals opgeslagen" aan, met een afwijkend einde op B. */
function recordedMode(ctx: ReturnType<typeof chain>, finish: string) {
  ctx.store.setState(s => {
    s.tasks.find(t => t.id === ctx.b)!.time.earlyFinish = finish;
    s.datesAsRecorded = true;
    s.recordedDates = { times: {}, total: 1 } as unknown as typeof s.recordedDates;
    s.scheduleStale = false;
  });
}

// 21. Ongedaan maken herstelt het event van de berekening, ook met een nieuwer event erboven.
regression('21 kolom na F5 in de modus', () => {
  const ctx = chain();
  const { store, S, b } = ctx;
  const recordedFinish = '2026-09-04T16:00';
  recordedMode(ctx, recordedFinish);
  S().recalculate();
  const eventId = S().scheduleShift!.historyEventId!;
  strictEqual(S().historyEvents.find(e => e.id === eventId)?.state, 'applied');
  const columns = S().taskGridSurfaces['gantt-task-grid'].columns;
  const narrower = columns.map((column, i) => (i === 0 ? { ...column, width: column.width + 40 } : column));
  S().commitTaskGridColumns('gantt-task-grid', 'Kolom', narrower);
  const changed = S().taskGridSurfaces['gantt-task-grid'].columns;
  strictEqual(changed[0].width, columns[0].width + 40);
  strictEqual(canUndoScheduleShift(S()), true);
  S().undoScheduleShift();
  strictEqual(task(store, b).time.earlyFinish, recordedFinish, 'de berekening is terug');
  strictEqual(S().datesAsRecorded, true);
  deepStrictEqual(S().taskGridSurfaces['gantt-task-grid'].columns, changed, 'de kolom blijft staan');
  strictEqual(S().historyEvents.find(e => e.id === eventId)?.state, 'undone');
  strictEqual(S().scheduleShift, null);
  // Ctrl+Z neemt daarna de kolom terug, en Ctrl+Y zet de berekening terug.
  S().undo();
  strictEqual(S().taskGridSurfaces['gantt-task-grid'].columns[0].width, columns[0].width);
  strictEqual(task(store, b).time.earlyFinish, recordedFinish);
  S().redo();
  strictEqual(S().datesAsRecorded, false);
});
regression('21b event al teruggedraaid', () => {
  const ctx = chain();
  const { S } = ctx;
  recordedMode(ctx, '2026-09-04T16:00');
  S().recalculate();
  S().undo();
  strictEqual(canUndoScheduleShift(S()), false, 'na Ctrl+Z is er niets meer om te herstellen');
  S().undoScheduleShift();
  strictEqual(S().datesAsRecorded, true);
});

// 22. Een startgrens die al vaststond is niet de reden als alleen de duur veranderde.
regression('22 SNET bleef gelijk', () => {
  const { store, S, a, b } = hourTask(({ store, S, a }) => {
    S().updateTask(a, { constraint: { type: 'SNET', date: '2026-07-06T07:00' } });
    strictEqual(task(store, a).constraint?.type, 'SNET');
  });
  strictEqual(S().cpmResult!.dateDriverByTaskId?.[a].kind, 'constraint');
  deepStrictEqual(reasons(store)[a], { kind: 'duration' });
  deepStrictEqual(reasons(store)[b], { kind: 'predecessor', taskIds: [a] });
});
regression('22b statusdatum bleef gelijk', () => {
  const { store, S, a } = hourTask(({ S }) => S().setStatusDate('2026-07-06'));
  strictEqual(S().cpmResult!.dateDriverByTaskId?.[a].kind, 'statusDate');
  deepStrictEqual(reasons(store)[a], { kind: 'duration' });
});

// 23. Een lopende taak: de werkelijke start staat vast, het spoor gaat over het resterende werk.
function runningSuccessor() {
  const ctx = chain();
  const { store, S, b } = ctx;
  S().updateTask(b, { time: { ...task(store, b).time, completion: 0.2, actualStart: '2026-06-02T07:00' } });
  S().runCPM();
  return ctx;
}
regression('23 voorganger van een lopende taak', () => {
  const { store, S, a, b } = runningSuccessor();
  const finish = task(store, b).time.earlyFinish;
  withDuration(store, a, 10);
  S().recalculate();
  strictEqual(task(store, b).time.earlyFinish !== finish, true, 'het einde verschuift');
  strictEqual(S().cpmResult!.dateDriverByTaskId?.[b].kind, 'relation');
  deepStrictEqual(reasons(store)[b], { kind: 'predecessor', taskIds: [a] });
});
regression('23b twee oorzaken op een lopende taak', () => {
  const { store, S, a, b } = runningSuccessor();
  withDuration(store, a, 10);
  withDuration(store, b, 9);
  S().recalculate();
  deepStrictEqual(reasons(store)[b], { kind: 'unknown' });
});
regression('23c eigen duur van een lopende taak', () => {
  // Zonder voorganger: de voortgang bepaalt de datum, maar de duur veranderde en het werk niet.
  const { store, S } = setup();
  const x = S().addTask({ name: 'X' });
  withDuration(store, x, 10);
  S().updateTask(x, { time: { ...task(store, x).time, completion: 0.5, actualStart: '2026-06-01T07:00' } });
  S().runCPM();
  withDuration(store, x, 16);
  S().recalculate();
  deepStrictEqual(reasons(store)[x], { kind: 'duration' });
});
regression('23d statusdatum van een lopende taak', () => {
  const { store, S, a } = chain();
  S().setStatusDate('2026-06-03');
  S().updateTask(a, { time: { ...task(store, a).time, completion: 0.2, actualStart: '2026-06-01T07:00' } });
  S().runCPM();
  S().setStatusDate('2026-06-24');
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'statusDate', date: '2026-06-24' });
});

// 24. Resource alleen als alleen de toewijzing precies deze duur oplevert.
function resources(S: () => ReturnType<Store['getState']>) {
  const add = (name: string) => S().addResource({ name, description: '', type: 'LABOR', maxUnits: 1 });
  return [add('Metselaar'), add('Opperman')];
}
regression('24 vaste duur, handmatig langer en een resource erbij', () => {
  const { store, S, a } = chain();
  const [first] = resources(S);
  withDuration(store, a, 10);
  S().assignResource(a, first, 1);
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'unknown' });
});
regression('24b vast werk, alleen een resource erbij', () => {
  const { store, S, a } = chain();
  const [first, second] = resources(S);
  S().setTaskWorkRule(a, 'FIXED_WORK');
  S().assignResource(a, first, 1);
  withDuration(store, a, 10);
  S().runCPM();
  S().assignResource(a, second, 1);
  strictEqual(task(store, a).time.scheduleDuration < 10, true, 'de werkregel maakt de taak korter');
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'resource', resourceIds: [first, second] });
});
regression('24c vast werk, handmatig langer en een resource erbij', () => {
  const { store, S, a } = chain();
  const [first, second] = resources(S);
  S().setTaskWorkRule(a, 'FIXED_WORK');
  S().assignResource(a, first, 1);
  withDuration(store, a, 10);
  S().runCPM();
  withDuration(store, a, 20);
  S().assignResource(a, second, 1);
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'unknown' });
});
regression('24e vast werk, handmatig langer zonder andere resource', () => {
  // De inzet volgt de duur. In de data is dat hetzelfde als een andere inzet: niet vast te stellen.
  const { store, S, a } = chain();
  const [first] = resources(S);
  S().setTaskWorkRule(a, 'FIXED_WORK');
  S().assignResource(a, first, 1);
  withDuration(store, a, 10);
  S().runCPM();
  withDuration(store, a, 20);
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'unknown' });
});
regression('24d vast werk, alleen een resource eraf', () => {
  const { store, S, a } = chain();
  const [first, second] = resources(S);
  S().setTaskWorkRule(a, 'FIXED_WORK');
  S().assignResource(a, first, 1);
  S().assignResource(a, second, 1);
  withDuration(store, a, 6);
  S().runCPM();
  S().unassignResource(S().assignments.find(x => x.resourceId === second)!.id);
  strictEqual(task(store, a).time.scheduleDuration, 12);
  S().recalculate();
  deepStrictEqual(reasons(store)[a], { kind: 'resource', resourceIds: [first] });
});

if (failed.length) {
  for (const line of failed) console.log(`XX  ${line}`);
  throw new Error(`${failed.length} regressie(s) rood`);
}

console.log('OK  check-shift-explanation');
