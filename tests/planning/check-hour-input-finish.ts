// Het ingevoerde einde ("Gepland einde", `scheduleFinish`) van een urentaak blijft coherent met
// start + duur — aan de INVOERKANT (B1-vervolg, critreview 24-09). Exit 0 = groen.
//
// Achtergrond: sinds B1 (88f7aa86) schrijft de solve `scheduleFinish` niet meer terug; de P6-conventies
// lezen hem als gepland bronvenster. Tot B1 hield juist die terugschrijving het einde van een urentaak
// actueel (d67b26a7, juli). Zonder vervanging kwam de juli-bug terug: een nieuwe urentaak van 5 u
// kreeg als ingevoerd einde 5 WERKDAGEN later (datum zonder tijd), een duurwijziging liet het einde
// verouderd staan, en IfcTaskTime.ScheduleFinish en het IFC-werkplan-einde droegen die verouderde
// waarde; bij heropenen werd `2026-09-11` ⇒ `2026-09-11T00:00`. Gemeten vóór deze fix (scratch op
// 88f7aa86): nieuwe taak sf `2026-09-11` / ef `2026-09-07T14:00`; na 12 u en Bereken sf `2026-09-11`
// / ef `2026-09-08T12:00`; werkplan-einde `2026-09-11T…`.
//
// Kalender: ma–vr 08–12 + 13–17 (8 u). Start maandag 2026-09-07.
//
// Mutatiebewijs (gemeten 2026-09-23): `reconcileHourInputFinish` laten returnen vóór de schrijfactie
// ⇒ 11 rood (03, 05, 07, 08, 10, 12, 13, 17, 20, 21, 22); `seedNewHourTaskFinish` leeg ⇒ 11 rood (de
// store-`addTask` geeft de kalender óók al aan `createDefaultTaskTime`, dus 01 blijft dan groen); de
// `p6ExplicitTargetWindow`-uitzondering weg ⇒ 15 rood; de gestart-uitzondering weg ⇒ 14 rood.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { planTaskCellEdit, planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime, hourTaskInputFinish } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';

/** Partiële tijd-update (mergeTaskTime vult de rest aan, zoals bij de extensie-API). */
const part = (t: Partial<Task['time']>) => t as Task['time'];

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const bands = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];
const H8: WorkCalendar = {
  id: 'h8', name: 'H8', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
// Een tweede kalender: 07–19 doorlopend (12 u), voor de kalenderwissel.
const long = [{ start: 420, end: 1140 }];
const H12: WorkCalendar = {
  id: 'h12', name: 'H12', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 19,
  hoursPerDay: 12, holidays: [], workTime: { byWeekday: { 1: long, 2: long, 3: long, 4: long, 5: long, 6: [], 7: [] } },
};

function freshContext() {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setUI({ enableHourPlanning: true });
  S().setCalendar(H8);
  S().setProject({ defaultTaskDurationUnit: 'hours', startDate: '2026-09-07' });
  return ctx;
}
type Ctx = ReturnType<typeof freshContext>;
const taskOf = (ctx: Ctx, id: string): Task => ctx.store.getState().tasks.find(t => t.id === id)!;
const sf = (ctx: Ctx, id: string) => taskOf(ctx, id).time.scheduleFinish;
const ef = (ctx: Ctx, id: string) => taskOf(ctx, id).time.earlyFinish;

// 1. Nieuwe urentaak van 5 u (standaard) — het einde is start + 5 werkuren, met tijd.
const ctx = freshContext();
const S = ctx.store.getState;
const a = S().addTask({ name: 'A' });
eq('01 nieuwe urentaak: ingevoerd einde = start + 5 werkuren (08–12, 13–14)', sf(ctx, a), '2026-09-07T14:00');
S().runCPM();
eq('02 na Bereken: gepland einde gelijk aan het berekende einde (geen voorganger)', [sf(ctx, a), ef(ctx, a)],
  ['2026-09-07T14:00', '2026-09-07T14:00']);

// 2. Duurwijziging via updateTask (eigenschappenpaneel, TaskDialog, extensie-API).
S().updateTask(a, { time: { ...taskOf(ctx, a).time, durationMinutes: 720, scheduleDuration: 1.5 } });
eq('03 duur 12 u: het ingevoerde einde beweegt mee', sf(ctx, a), '2026-09-08T12:00');
S().runCPM();
eq('04 …en Bereken komt op hetzelfde einde', ef(ctx, a), '2026-09-08T12:00');

// 3. Startwijziging.
S().updateTask(a, { time: part({ scheduleStart: '2026-09-09T13:00' }) });
eq('05 start woensdag 13:00: einde = start + 12 werkuren', sf(ctx, a), '2026-09-10T17:00');

// 4. Een expliciet meegegeven einde wint (uursleep, extensie die het einde zelf zet).
S().updateTask(a, { time: part({ durationMinutes: 480, scheduleDuration: 1, scheduleFinish: '2026-09-11T10:00' }) });
eq('06 expliciet einde in dezelfde bewerking blijft staan', sf(ctx, a), '2026-09-11T10:00');

// 5. Kalenderwissel (setTaskCalendar én updateTask({calendarId})).
S().addCalendar({ ...H12 });
const h12Id = S().calendars.find(c => c.name === 'H12')!.id;
S().updateTask(a, { time: part({ scheduleStart: '2026-09-07T08:00', durationMinutes: 600, scheduleDuration: 1.25 }) });
eq('07 10 u op H8 vanaf ma 08:00', sf(ctx, a), '2026-09-08T10:00');
S().setTaskCalendar(a, h12Id);
eq('08 kalenderwissel naar 07–19: 10 u past op maandag', sf(ctx, a), '2026-09-07T18:00');

// 6. Met een voorganger: gepland einde ≤ berekend einde.
const b = S().addTask({ name: 'B' });
S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
eq('09 opvolger: gepland einde ≤ berekend einde', sf(ctx, b) <= ef(ctx, b), true);

// 7. Gridbewerking (tabel/Gantt-raster): duur, start, en een geplakte rij met "Gepland einde".
const cell = (taskId: string, columnId: string, value: unknown): CellEditIntent =>
  ({ kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route: 'task-schedule', value });
{
  const c = freshContext();
  const id = c.store.getState().addTask({ name: 'G' });
  const env = () => buildTaskEditPlanEnvironment(c.store.getState(), taskOf(c, id));
  const planned = planTaskCellEdit(taskOf(c, id), cell(id, 'task.time.scheduleDuration', 900), env());
  eq('10 grid: duur 15 u ⇒ einde ma 08:00 + 15 werkuren', planned.ok ? planned.value.task.time.scheduleFinish : null,
    '2026-09-08T16:00');
  const withFinish = planTaskCellEdits(taskOf(c, id), [
    cell(id, 'task.time.scheduleFinish', '2026-09-18T09:00'),
    cell(id, 'task.time.scheduleDuration', 900),
  ], env());
  eq('16 grid-plak: een meegeplakt "Gepland einde" wint, ongeacht de kolomvolgorde',
    withFinish.ok ? withFinish.value.task.time.scheduleFinish : null, '2026-09-18T09:00');
  const both = planTaskCellEdits(taskOf(c, id), [
    cell(id, 'task.time.scheduleStart', '2026-09-08T09:00'),
    cell(id, 'task.time.scheduleDuration', 120),
  ], env());
  eq('17 grid-plak start + duur: einde = nieuwe start + nieuwe duur',
    both.ok ? both.value.task.time.scheduleFinish : null, '2026-09-08T11:00');
}

// 8. MCP-pad: planner_add_tasks-vorm (createDefaultTaskTime met kalender) en draft.patchTaskFields.
{
  const c = freshContext();
  const tx = createMcpTransactions(c);
  let id = '';
  // draft.addTask met een uur-`time` zonder einde (vorm van een extensie/MCP-aanroeper).
  const res = tx.run(() => {
    id = tx.draft.addTask({ name: 'M', time: part({ durationUnit: 'hours', durationMinutes: 300, scheduleDuration: 0.625 }) });
  });
  eq('11 MCP draft.addTask: nieuwe urentaak krijgt start + 5 werkuren', [res.ok, sf(c, id)], [true, '2026-09-07T14:00']);
  // planner_add_tasks bouwt zijn `time` via createDefaultTaskTime MET de taakkalender (taskTools.ts).
  eq('11a planner_add_tasks-vorm: createDefaultTaskTime(start, 5, hours, kalender)',
    createDefaultTaskTime('2026-09-07', 5, 'hours', H8).scheduleFinish, '2026-09-07T14:00');
  eq('11b zonder kalender (lezerpad, einde wordt direct overschreven): ongewijzigd',
    createDefaultTaskTime('2026-09-07', 5, 'hours').scheduleFinish, '2026-09-11');
  tx.run(() => { tx.draft.patchTaskFields(id, {}, { durationMinutes: 180, scheduleDuration: 0.375 }); });
  eq('12 MCP patchTaskFields duur 3 u: einde beweegt mee', sf(c, id), '2026-09-07T11:00');
  tx.run(() => { tx.draft.updateTaskFields(id, { time: { ...taskOf(c, id).time, durationMinutes: 540, scheduleDuration: 1.125 } }); });
  eq('13 MCP updateTaskFields duur 9 u: einde beweegt mee', sf(c, id), '2026-09-08T09:00');
}

// 9. Wat NIET meebeweegt: een gestarte taak en een XER-taak met expliciet targetvenster.
{
  const c = freshContext();
  const S2 = c.store.getState;
  const started = S2().addTask({ name: 'Gestart' });
  S2().updateTask(started, { status: 'STARTED', time: part({ actualStart: '2026-09-07T08:00', completion: 0.2 }) });
  const before = sf(c, started);
  S2().updateTask(started, { time: part({ durationMinutes: 900, scheduleDuration: 1.875 }) });
  eq('14 gestarte taak: het geplande einde blijft staan bij een duurwijziging', sf(c, started), before);
  const xer = S2().addTask({ name: 'XER', time: part({ scheduleFinish: '2026-09-25T17:00' }) });
  S2().updateTask(xer, { p6ExplicitTargetWindow: true } as Partial<Task>);
  S2().updateTask(xer, { time: part({ durationMinutes: 60, scheduleDuration: 0.125 }) });
  eq('15 expliciet P6-targetvenster: het bronvenster blijft staan', sf(c, xer), '2026-09-25T17:00');
}

// 10. Een dagtaak blijft precies zoals vóór deze wijziging: het einde volgt een duurwijziging niet.
{
  const c = createAppStoreContext();
  const S3 = c.store.getState;
  S3().setProject({ startDate: '2026-09-07' });
  const d = S3().addTask({ name: 'Dag' });
  eq('18 dagtaak: einde uit createDefaultTaskTime (5 werkdagen, zonder tijd)', sf(c, d), '2026-09-11');
  S3().updateTask(d, { time: part({ scheduleDuration: 2 }) });
  eq('19 dagtaak: een duurwijziging raakt het ingevoerde einde niet (ongewijzigd gedrag)', sf(c, d), '2026-09-11');
}

// 11. IFC: IfcTaskTime.ScheduleFinish en het werkplan-einde dragen het coherente einde, en heropenen
// geeft precies dat terug (geen `T00:00` meer).
{
  const c = freshContext();
  const id = c.store.getState().addTask({ name: 'IFC' });
  c.store.getState().updateTask(id, { time: part({ durationMinutes: 720, scheduleDuration: 1.5 }) });
  c.store.getState().runCPM();
  const ifc = writeIFC(buildWriteIFCInput(c.store.getState()));
  const taskTime = ifc.match(/IFCTASKTIME\('IFC Time'[^\n]*/)?.[0] ?? '';
  eq('20 IfcTaskTime.ScheduleFinish is het coherente einde', taskTime.split(',')[6], "'2026-09-08T12:00:00'");
  const workplan = ifc.match(/IFCWORKPLAN\([^\n]*/)?.[0] ?? '';
  eq('21 IFC-werkplan-einde is het coherente einde', workplan.includes("'2026-09-08T12:00'"), true);
  const reopened = readIFC(ifc).tasks.find(t => t.name === 'IFC')!;
  eq('22 heropend: ingevoerd einde onveranderd', reopened.time.scheduleFinish, '2026-09-08T12:00');
}

// 12. De afleiding zelf: ELAPSEDTIME telt klokminuten, duur 0 geeft de start.
eq('23 ELAPSEDTIME: 30 u klok vanaf vr 16:00', hourTaskInputFinish(
  { scheduleStart: '2026-09-11T16:00', durationMinutes: 1800, durationType: 'ELAPSEDTIME' }, H8), '2026-09-12T22:00');
eq('24 duur 0: het einde is de start', hourTaskInputFinish(
  { scheduleStart: '2026-09-11T16:00', durationMinutes: 0, durationType: 'WORKTIME' }, H8), '2026-09-11T16:00');

if (diffs.length === 0) console.log(`OK  ingevoerd einde urentaak (B1-vervolg): ${checks} checks groen`);
else { console.log(`XX  ingevoerd einde urentaak (B1-vervolg): ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
