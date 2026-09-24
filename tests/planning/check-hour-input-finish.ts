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
// Mutatiebewijs (gemeten 2026-09-24, 34 checks; eerdere kop noemde checknummers als tellingen):
// `reconcileHourInputFinish` altijd `false` ⇒ 15 rood (03 05 07 08 10 12 13 17 20 21 22 25–28);
// `seedNewHourTaskFinish` leeg ⇒ 3 rood (11, 32, 33); `fromExtTaskAddInput` gelijk aan `fromExtTaskInput`
// (de extensie-grensterugval vult het einde met de start) ⇒ 2 rood (33, 36); oude volgorde (reconcile vóór `clearLevelingGaps`)
// ⇒ 4 rood (25–28); elk van de uitzonderingen handmatig gepland / hammock / samenvatting /
// `p6ExplicitTargetWindow` / gestart weg ⇒ 1 rood (resp. 29, 30, 31, 15, 14).
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { planTaskCellEdit, planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime, hourTaskInputFinish } from '@/utils/taskDefaults';
import { createExtensionApi } from '@/extensions/extensionApi';
import type { ExtTaskTime } from '@/extensions/extTypes';
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

// 13. Nivelleergaten (`source: 'leveling'`) die dezelfde bewerking wist tellen NIET mee in het einde
// (fixronde 2 her-check B1): de reconcile draait ná `clearLevelingGaps`, op alle vier de paden.
{
  const c = freshContext();
  const Sx = c.store.getState;
  const H12x = { ...H12 };
  Sx().addCalendar(H12x);
  const h12 = Sx().calendars.find(k => k.name === 'H12')!.id;
  const withGap = (id: string) => c.store.setState((s) => {
    const t = s.tasks.find(k => k.id === id)!;
    t.splitGaps = [{ afterMinutes: 120, gapMinutes: 960, source: 'leveling' }];
  });
  const t1 = Sx().addTask({ name: 'L1' });
  withGap(t1);
  Sx().updateTask(t1, { time: part({ durationMinutes: 360, scheduleDuration: 0.75 }) });
  eq('25 updateTask duur 6 u met nivelleergat: gat gewist en niet meegeteld', [sf(c, t1), taskOf(c, t1).splitGaps ?? []],
    ['2026-09-07T15:00', []]);
  const t2 = Sx().addTask({ name: 'L2' });
  withGap(t2);
  Sx().setTaskCalendar(t2, h12);
  eq('26 setTaskCalendar met nivelleergat: 5 u op 07–19 vanaf de dagstart 07:00', sf(c, t2), '2026-09-07T12:00');
  const tx = createMcpTransactions(c);
  const t3 = Sx().addTask({ name: 'L3' });
  withGap(t3);
  tx.run(() => { tx.draft.updateTaskFields(t3, { time: { ...taskOf(c, t3).time, durationMinutes: 360, scheduleDuration: 0.75 } }); });
  eq('27 MCP updateTaskFields met nivelleergat', sf(c, t3), '2026-09-07T15:00');
  const t4 = Sx().addTask({ name: 'L4' });
  withGap(t4);
  tx.run(() => { tx.draft.patchTaskFields(t4, {}, { durationMinutes: 360, scheduleDuration: 0.75 }); });
  eq('28 MCP patchTaskFields met nivelleergat', sf(c, t4), '2026-09-07T15:00');
}

// 14. Overige uitzonderingen: handmatig gepland, hammock, samenvatting — het einde blijft staan.
{
  const c = freshContext();
  const Sy = c.store.getState;
  const flagged = (name: string, set: (t: Task) => void) => {
    const id = Sy().addTask({ name });
    c.store.setState((s) => { set(s.tasks.find(k => k.id === id)!); });
    const before = sf(c, id);
    Sy().updateTask(id, { time: part({ durationMinutes: 900, scheduleDuration: 1.875 }) });
    return [before, sf(c, id)];
  };
  const [m0, m1] = flagged('Handmatig', (t) => { t.manuallyScheduled = true; });
  eq('29 handmatig gepland: het einde blijft staan', m1, m0);
  const [h0, h1] = flagged('Hammock', (t) => { t.isHammock = true; });
  eq('30 hammock: het einde blijft staan', h1, h0);
  const [s0, s1] = flagged('Samenvatting', (t) => { t.isSummary = true; });
  eq('31 samenvatting: het einde blijft staan', s1, s0);
  // Seed in de store-`addTask` (niet alleen MCP): een meegegeven uurduur zonder einde.
  const seeded = Sy().addTask({ name: 'Seed', time: part({ durationUnit: 'hours', durationMinutes: 180, scheduleDuration: 0.375 }) });
  eq('32 store-addTask met 3 u zonder einde: einde = start + 3 werkuren', sf(c, seeded), '2026-09-07T11:00');
}

// 15. Extensie-API (Fable-critreview PR #169, bevinding 10): `api.data.addTask` met een urentaak
// ZONDER einde. De grensmapper vulde een ontbrekend einde vroeger met de start, waarna de store dat als
// "meegegeven einde" zag en niet afleidde ⇒ einde == start. Een meegegeven einde wint nog steeds, en een
// dagtaak blijft byte-identiek (einde = start, zoals vóór deze wijziging).
{
  const c = freshContext();
  const api = createExtensionApi('b1-ext', [], undefined, c, { app: c, showNotification: () => {} });
  const ext = (t: Partial<ExtTaskTime>) => t as ExtTaskTime;
  const noFinish = api.data.addTask({ name: 'Ext', time: ext({ scheduleStart: '2026-09-07T08:00', durationUnit: 'hours', durationMinutes: 180 }) });
  eq('33 extensie-addTask, 3 u zonder einde: einde = start + 3 werkuren', [sf(c, noFinish), ef(c, noFinish), taskOf(c, noFinish).time.lateFinish],
    ['2026-09-07T11:00', '2026-09-07T11:00', '2026-09-07T11:00']);
  const withFinish = api.data.addTask({ name: 'ExtF', time: ext({ scheduleStart: '2026-09-07T08:00', durationUnit: 'hours', durationMinutes: 180, scheduleFinish: '2026-09-07T16:00' }) });
  eq('34 extensie-addTask met eigen einde: dat einde wint', sf(c, withFinish), '2026-09-07T16:00');
  const day = api.data.addTask({ name: 'ExtD', time: ext({ scheduleStart: '2026-09-07', durationUnit: 'days', scheduleDuration: 3 }) });
  eq('35 extensie-addTask, dagtaak zonder einde: ongewijzigd (einde = start)', sf(c, day), '2026-09-07');
  // Critreview 2e ronde: een meegegeven earlyFinish zonder scheduleFinish maakt het einde niet incoherent.
  const early = api.data.addTask({ name: 'ExtE', time: ext({ scheduleStart: '2026-09-07T08:00', durationUnit: 'hours', durationMinutes: 180, earlyFinish: '2026-09-09T10:00' }) });
  eq('36 extensie-addTask met alleen earlyFinish: gepland en vroegst einde beide afgeleid', [sf(c, early), ef(c, early)],
    ['2026-09-07T11:00', '2026-09-07T11:00']);
  // Een gestarte urentaak beweegt niet mee: dan blijft de grensterugval (einde = start), niet de verse default.
  const started = api.data.addTask({ name: 'ExtS', status: 'STARTED', time: ext({ scheduleStart: '2026-09-07T08:00', durationUnit: 'hours', durationMinutes: 180, actualStart: '2026-09-07T08:00' }) });
  eq('37 extensie-addTask, gestarte urentaak zonder einde: einde = start (geen afleiding, geen default)', sf(c, started), '2026-09-07T08:00');
}

// 16. Integratie PR #101 (taaktypes) op #169 — de twee valkuilen uit het verkenningsdossier
// (2026-09-24 §3a). #101 haalt `calendarId` uit `rest` en zet een eigen K2-kalenderstap vóór de merge.
// (a) de nivelleergaten-poort kreeg `rest` ⇒ een kalenderwissel via updateTask/updateTaskFields liet
//     een nivelleergat staan; (b) de basis van het ingevoerde einde werd pas ná die kalenderstap
//     vastgelegd ⇒ de wissel zat al in de sleutel en het einde bleef op de oude kalender staan.
// Mutatiebewijs (gemeten bij de integratie): `taskUpdateInvalidatesLevelingGaps(rest, time)` terug in
// taskSlice/MCP ⇒ 41 en 42 rood; `hourInputFinishBasis` ná de kalenderstap (store + beide MCP-paden)
// ⇒ 38, 39, 40 en 41 rood (41 controleert ook het einde).
{
  const c = freshContext();
  const Sz = c.store.getState;
  Sz().addCalendar({ ...H12 });
  const h12 = Sz().calendars.find(k => k.name === 'H12')!.id;
  const tx = createMcpTransactions(c);
  const k1 = Sz().addTask({ name: 'K1' });
  Sz().updateTask(k1, { calendarId: h12 });
  eq('38 updateTask({calendarId}) op een urentaak: einde volgt de nieuwe kalender (5 u vanaf 07:00)', sf(c, k1), '2026-09-07T12:00');
  const k2 = Sz().addTask({ name: 'K2' });
  tx.run(() => { tx.draft.updateTaskFields(k2, { calendarId: h12 }); });
  eq('39 MCP updateTaskFields({calendarId}): einde volgt de nieuwe kalender', sf(c, k2), '2026-09-07T12:00');
  const k3 = Sz().addTask({ name: 'K3' });
  tx.run(() => { tx.draft.patchTaskFields(k3, { calendarId: h12 }); });
  eq('40 MCP patchTaskFields({calendarId}): einde volgt de nieuwe kalender', sf(c, k3), '2026-09-07T12:00');
  const gap = (id: string) => c.store.setState((s) => {
    s.tasks.find(k => k.id === id)!.splitGaps = [{ afterMinutes: 120, gapMinutes: 960, source: 'leveling' }];
  });
  const k4 = Sz().addTask({ name: 'K4' });
  gap(k4);
  Sz().updateTask(k4, { calendarId: h12 });
  eq('41 updateTask({calendarId}) wist het nivelleergat (valkuil a, store)', [taskOf(c, k4).splitGaps ?? [], sf(c, k4)],
    [[], '2026-09-07T12:00']);
  const k5 = Sz().addTask({ name: 'K5' });
  gap(k5);
  tx.run(() => { tx.draft.updateTaskFields(k5, { calendarId: h12 }); });
  eq('42 MCP updateTaskFields({calendarId}) wist het nivelleergat (valkuil a, MCP)', taskOf(c, k5).splitGaps ?? [], []);
  // Critreview PR #101 baan 1 (gridcheck): het raster heeft een EIGEN, gesplitste route voor een
  // kalenderwissel (`gridTransaction.ts`: kalenderstap `planTaskCellEdits` + `settleCalendarChange`
  // vóór de rest van de paste). Ook daar moet het nivelleergat weg en het ingevoerde einde herleid
  // op de nieuwe kalender. Mutatiebewijs: 'task-schedule' uit `LEVELING_GAP_ROUTES` ⇒ 43 rood (gat
  // blijft); `reconcileGridInputFinish` overgeslagen ⇒ 10 en 43 rood (einde blijft op H8: 14:00).
  const k6 = Sz().addTask({ name: 'K6' });
  gap(k6);
  const res = Sz().runGridMutation([cell(k6, 'task.calendarId', h12)]);
  eq('43 raster: kalenderwissel via runGridMutation wist het nivelleergat en herleidt het einde',
    [res.ok, taskOf(c, k6).calendarId === h12, taskOf(c, k6).splitGaps ?? [], sf(c, k6)],
    [true, true, [], '2026-09-07T12:00']);
}

// 12. De afleiding zelf: ELAPSEDTIME telt klokminuten, duur 0 geeft de start.
eq('23 ELAPSEDTIME: 30 u klok vanaf vr 16:00', hourTaskInputFinish(
  { scheduleStart: '2026-09-11T16:00', durationMinutes: 1800, durationType: 'ELAPSEDTIME' }, H8), '2026-09-12T22:00');
eq('24 duur 0: het einde is de start', hourTaskInputFinish(
  { scheduleStart: '2026-09-11T16:00', durationMinutes: 0, durationType: 'WORKTIME' }, H8), '2026-09-11T16:00');

if (diffs.length === 0) console.log(`OK  ingevoerd einde urentaak (B1-vervolg): ${checks} checks groen`);
else { console.log(`XX  ingevoerd einde urentaak (B1-vervolg): ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
