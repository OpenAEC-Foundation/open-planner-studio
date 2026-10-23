// PR #563, reviewrondes 1 t/m 4: ingevoerde feiten, relatievensters en mijlpaalkanten behouden.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createTaskDialogSave, draftWithActualStart, draftWithActualFinish } from '@/state/taskDialogSave';
import { planProgressEntry } from '@/engine/progressEntry';
import { invalidDateReasons } from '@/engine/reports/dcmaAssessment';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { progress } from '@/state/mcpValidation';
import { makeBands } from '@/utils/effectiveWorkTime';
import { parseLagInput } from '@/utils/lagFormat';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';

let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
}
function fixture(start = 480, end = 960) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  const calendar = { ...S().calendar, id: 'f1-review', workDays: [1, 2, 3, 4, 5], holidays: [],
    hoursPerDay: (end - start) / 60, workStartHour: start / 60, workEndHour: end / 60,
    workTime: makeBands([1, 2, 3, 4, 5], [{ start, end }]),
  };
  S().setCalendar(calendar);
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-03' });
  const id = S().addTask({ name: 'F1 review', time: {
    scheduleStart: '2026-06-01T08:00', scheduleDuration: 1,
    durationUnit: 'hours', durationMinutes: 480, durationType: 'WORKTIME',
  } as Task['time'] });
  const task = () => S().tasks.find(t => t.id === id)!;
  const cell = (field: string, value: unknown): CellEditIntent => ({
    kind: 'cell-edit', taskId: id, columnId: field as CellEditIntent['columnId'], route: 'task-progress', value,
  });
  const draft = () => structuredClone({ tasks: S().tasks, sequences: [], assignments: [], resources: [],
    calendars: S().calendars, calendar: S().calendar, project: S().project });
  return { context, S, id, task, calendar, cell, draft };
}

// Punt 1: een aanwezige werkelijke start is een feit, ook ná het afgeleide blokeinde.
// D1/D6 beslissen alleen over datumloze invoer. Besluit orkestrator: het afgeleide einde wordt
// minstens die start. De statusdag en de taakkalender veranderen een vastgelegde start niet.
for (const [day, start, finish, ownCalendar] of [
  ['2026-06-03', '2026-06-03T10:00', '2026-06-03T16:00', false],
  ['2026-06-03', '2026-06-03T18:00', '2026-06-03T18:00', false],
  ['2026-06-06', '2026-06-06T18:00', '2026-06-06T18:00', false],
  ['2026-06-03', '2026-06-03T18:00', '2026-06-03T18:00', true],
] as const) for (const route of ['paneel', 'dialoog', 'rasterpercentage', 'statuskolom', 'plakken', 'import', 'MCP'] as const) {
  const f = fixture();
  let calendar = f.calendar;
  if (ownCalendar) {
    calendar = { ...calendar, id: 'eigen-09-17', hoursPerDay: 8, workStartHour: 9, workEndHour: 17,
      workTime: makeBands([1, 2, 3, 4, 5], [{ start: 540, end: 1020 }]) };
    f.context.store.setState(s => { s.calendars.push(calendar); });
    f.S().updateTask(f.id, { calendarId: calendar.id });
  }
  f.S().setProject({ statusDate: day });
  const label = `P1 ${route} ${start}${ownCalendar ? ' eigen 09–17' : ''}`;
  eq(label + ': start toegestaan', f.S().setActualStart(f.id, start), true);
  f.S().setTaskProgress(f.id, 0.5);
  eq(label + ': start vastgelegd', f.task().time.actualStart, start);
  let actual = f.task();
  if (route === 'paneel') eq(label + ': toegestaan', f.S().setTaskProgress(f.id, 1), true);
  else if (route === 'dialoog') {
    const plan = planProgressEntry(f.task(), { field: 'completion', value: 1 },
      { statusDate: day, today: day, calendar });
    eq(label + ': concept toegestaan', plan.ok && !!plan.change, true);
    if (plan.ok && plan.change) eq(label + ': opgeslagen', createTaskDialogSave(f.context)({
      editingTaskId: f.id, draft: plan.change.task, startDate: f.task().time.scheduleStart,
    }), true);
  } else if (route === 'MCP') {
    const draft = f.draft();
    eq(label + ': toegestaan', progress.applyProgressUpdate(draft, f.id, { completion: 100 }, day).applied, true);
    actual = draft.tasks[0];
  } else if (route === 'import') {
    eq(label + ': toegepast', f.S().applyProgressImport([
      { rowNumber: 2, taskId: f.id, completion: { kind: 'value', value: 1 } },
    ]).appliedCount, 1);
  } else {
    const edit = route === 'statuskolom' ? f.cell('task.status', 'COMPLETED') : f.cell('task.time.completion', 1);
    eq(label + ': toegestaan', f.S().runGridMutation(route === 'plakken'
      ? [{ kind: 'paste', writes: [edit] }] : [edit]).ok, true);
  }
  if (route !== 'MCP') actual = f.task();
  eq(label + ': vastgelegde start blijft staan', actual.time.actualStart, start);
  eq(label + ': einde D6, minstens de vastgelegde start', actual.time.actualFinish, finish);
  eq(label + ': voltooid', [actual.time.completion, actual.status], [1, 'COMPLETED']);
}

// De gedeelde volgorderegel krijgt bij lezers expliciet mee of de start nog ontbrak.
// Alleen zo'n automatisch afgeleide start mag terug naar het einde op de statusdatum.
for (const start of [undefined, '2026-06-03T18:00']) {
  const f = fixture();
  const task = structuredClone(f.task());
  task.time = { ...task.time, completion: 1, actualStart: start, scheduleStart: '2026-06-08T08:00', earlyStart: '2026-06-08T08:00' };
  normalizeImportedProgress([task], '2026-06-03');
  eq(`P1 lezer ${start ?? 'ontbrekend'}: actuals`, [task.time.actualStart, task.time.actualFinish],
    start ? [start, start] : ['2026-06-03', '2026-06-03']);
}

// Punt 2: de equivalentie van twee blokgrenzen geldt niet voor een willekeurig moment ertussen.
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const [lagMinutes, lagUnit, finish] of [
    [0, 'ELAPSEDTIME', '2026-07-06T16:00'],
    [0, 'WORKTIME', '2026-07-06T16:00'],
    [120, 'ELAPSEDTIME', '2026-07-07T08:00'],
    [960, 'ELAPSEDTIME', '2026-07-07T08:00'],
    [1440, 'ELAPSEDTIME', '2026-07-07T16:00'],
    [480, 'WORKTIME', '2026-07-07T16:00'],
    [4320, 'ELAPSEDTIME', '2026-07-09T16:00'],
  ] as const) {
    const f = fixture();
    f.S().setProject({ startDate: '2026-07-06', statusDate: undefined,
      schedulingProfile: { id: profile, baseId: profile, name: '', overrides: {} } });
    f.S().updateTask(f.id, { time: { ...f.task().time, scheduleStart: '2026-07-06T08:00' } });
    const milestone = f.S().addTask({ name: 'Eindmijlpaal', isMilestone: true, milestoneKind: 'FINISH' });
    f.S().addSequence({ predecessorId: f.id, successorId: milestone, type: 'FINISH_START',
      lagDays: 0, lagMinutes, lagUnit });
    f.S().runCPM();
    const m = f.S().tasks.find(t => t.id === milestone)!;
    const label = `P2 ${profile} ${lagMinutes} ${lagUnit}`;
    eq(label + ': voorganger eindigt ma 16:00', f.task().time.earlyFinish, '2026-07-06T16:00');
    eq(label + ': mijlpaal', [m.time.earlyStart, m.time.earlyFinish], [finish, finish]);
    eq(label + ': speling voorganger', f.task().time.totalFloat, 0);
  }
  // De opvolger is dinsdag vrij en werkt 09–17; ma 16:00 is geen equivalent van di 08:00.
  const f = fixture();
  const successorCalendar = { ...f.calendar, id: 'opvolger', holidays: [
    { name: 'Vrije dinsdag', startDate: '2026-07-07', endDate: '2026-07-07' },
  ],
    workTime: makeBands([1, 2, 3, 4, 5], [{ start: 540, end: 1020 }]) };
  f.context.store.setState(s => { s.calendars.push(successorCalendar); });
  f.S().setProject({ startDate: '2026-07-06', statusDate: undefined,
    schedulingProfile: { id: profile, baseId: profile, name: '', overrides: {} } });
  f.S().updateTask(f.id, { time: { ...f.task().time, scheduleStart: '2026-07-06T08:00',
    scheduleDuration: 3, durationMinutes: 1440 } });
  const milestone = f.S().addTask({ name: 'Eindmijlpaal eigen kalender', calendarId: 'opvolger',
    isMilestone: true, milestoneKind: 'FINISH' });
  f.S().addSequence({ predecessorId: f.id, successorId: milestone, type: 'FINISH_START',
    lagDays: 0, lagMinutes: -960, lagUnit: 'WORKTIME' });
  f.S().runCPM();
  eq(`P2 ${profile}: negatieve lag bewaart ondergrens di 08:00`,
    f.S().tasks.find(t => t.id === milestone)!.time.earlyStart, '2026-07-08T09:00');
}

// Reviewronde 3: het gewone voltooidvenster behoudt de vastgelegde 18:00 voor kalendertijdlag.
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const [lagMinutes, lagUnit, start] of [
    [960, 'ELAPSEDTIME', '2026-06-04T10:00'],
    [480, 'WORKTIME', '2026-06-05T08:00'],
  ] as const) {
    const f = fixture();
    f.S().setProject({ schedulingProfile: { id: profile, baseId: profile, name: '', overrides: {} } });
    const label = `R3 ${profile} FS ${lagMinutes} ${lagUnit}`;
    eq(label + ': werkelijke start toegestaan', f.S().enterTaskProgress(f.id,
      { field: 'actualStart', value: '2026-06-03T18:00' }, { today: '2026-06-03' }).ok, true);
    eq(label + ': 100% toegestaan', f.S().enterTaskProgress(f.id,
      { field: 'completion', value: 1 }, { today: '2026-06-03' }).ok, true);
    eq(label + ': ingevoerde actuals', [f.task().time.actualStart, f.task().time.actualFinish],
      ['2026-06-03T18:00', '2026-06-03T18:00']);
    const successor = f.S().addTask({ name: 'Na voltooide taak', time: { ...f.task().time,
      actualStart: undefined, actualFinish: undefined, completion: 0, remainingMinutes: undefined,
    } });
    f.S().addSequence({ predecessorId: f.id, successorId: successor, type: 'FINISH_START',
      lagDays: 0, lagMinutes, lagUnit });
    f.S().runCPM();
    eq(label + ': actuals behouden', [f.task().time.actualStart, f.task().time.actualFinish],
      ['2026-06-03T18:00', '2026-06-03T18:00']);
    eq(label + ': voltooid met oorspronkelijke duur',
      [f.task().status, f.task().time.completion, f.task().time.durationMinutes, f.task().time.remainingMinutes],
      ['COMPLETED', 1, 480, 0]);
    eq(label + ': opvolger', f.S().tasks.find(t => t.id === successor)!.time.earlyStart, start);
  }
}

// Reviewronde 4: de gewone laginvoer mag het C5-punt of de C1-klem niet omzeilen.
// De XER draagt fysieke voortgang en echte werkblokken; het standaard P6-profiel activeert C5.
function completedXer(c1 = false) {
  const days = [1, 2, 3, 4, 5, 6, 7].map(day =>
    `(0||${day}()(${day >= 2 && day <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`).join('');
  const calendarData = `(0||CalendarData()((0||DaysOfWeek()(${days}))(0||Exceptions()())))`;
  const input = readXER(new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tVoltooidvenster\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    `%R\tD\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDrtn\tTK_Complete\t${c1 ? 'CP_Drtn' : 'CP_Phys'}\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t${c1 ? '2026-01-14' : '2026-01-06'} 17:00`,
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tD\tP1\tP1\tPR_FS\t0',
    '%E',
  ].join('\n')));
  if (isMultiDocumentImport(input)) throw new Error('De voltooidvensterproef verwacht één XER-project');
  const context = createAppStoreContext();
  context.store.setState(s => {
    s.project = { ...input.project, schedulingProfile: { id: 'p6', baseId: 'p6', name: 'P6',
      overrides: c1 ? { p6CompletedPredecessorAtDataDate: true } : {} } };
    s.tasks = input.tasks;
    s.sequences = input.sequences;
    s.calendar = input.calendar;
    s.calendars = input.resourceCalendars ?? [];
  });
  return { S: () => context.store.getState(), suggestedProfile: input.suggestedProfileId };
}
for (const [c1, lag, start] of [
  [false, '16eu', '2026-01-14T16:00'],
  [false, '18eu', '2026-01-15T08:00'],
  [true, '0eu', '2026-01-14T08:00'],
] as const) {
  const f = completedXer(c1);
  const label = `R4 ${c1 ? 'C1 aan' : 'standaard P6/C5'} FS ${lag}`;
  eq(label + ': XER stelt P6 voor', f.suggestedProfile, 'p6');
  const patch = parseLagInput(lag);
  eq(label + ': lag geparseerd', patch, { lagDays: 0, lagUnit: 'ELAPSEDTIME', lagMinutes: Number.parseInt(lag) * 60 });
  if (!patch) throw new Error(label + ': ongeldige proefinvoer');
  eq(label + ': relatie bijgewerkt', f.S().updateSequence(f.S().sequences[0].id, patch), true);
  f.S().runCPM();
  eq(label + ': geen rekenfout', f.S().cpmResult?.error, undefined);
  const pred = f.S().tasks.find(t => t.id === 'D')!;
  eq(label + ': werkelijk einde behouden', pred.time.actualFinish, c1 ? '2026-01-14T17:00' : '2026-01-06T17:00');
  eq(label + ': voorgangervenster', [pred.time.earlyStart, pred.time.earlyFinish], c1
    ? ['2026-01-05T08:00', '2026-01-14T17:00'] : ['2026-01-14T00:00', '2026-01-14T00:00']);
  eq(label + ': opvolger respecteert relatievenster', f.S().tasks.find(t => t.id === 'S')!.time.earlyStart, start);
}

// SS/SF gebruiken de werkelijke start en FF het werkelijke einde: wo 18:00 +18 eu = do 12:00.
// De bestaande inversiecorrectie houdt beide kanten op 18:00 als het gewone einde daar blijft.
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['START_START', 'FINISH_FINISH', 'START_FINISH'] as const) {
    const f = fixture();
    f.S().setProject({ schedulingProfile: { id: profile, baseId: profile, name: '', overrides: {} } });
    const label = `R4 ${profile} ${type} +18eu`;
    eq(label + ': werkelijke start toegestaan', f.S().enterTaskProgress(f.id,
      { field: 'actualStart', value: '2026-06-03T18:00' }, { today: '2026-06-03' }).ok, true);
    eq(label + ': 100% toegestaan', f.S().enterTaskProgress(f.id,
      { field: 'completion', value: 1 }, { today: '2026-06-03' }).ok, true);
    const successor = f.S().addTask({ name: 'Na achttien klokuren', time: {
      scheduleStart: '2026-06-01T08:00', scheduleDuration: 0.25,
      durationUnit: 'hours', durationMinutes: 120, durationType: 'WORKTIME',
    } as Task['time'] });
    f.S().addSequence({ predecessorId: f.id, successorId: successor, type,
      lagDays: 0, lagMinutes: 1080, lagUnit: 'ELAPSEDTIME' });
    f.S().runCPM();
    eq(label + ': geen rekenfout', f.S().cpmResult?.error, undefined);
    eq(label + ': actuals behouden', [f.task().time.actualStart, f.task().time.actualFinish],
      ['2026-06-03T18:00', '2026-06-03T18:00']);
    eq(label + ': gewoon voltooidvenster', [f.task().time.earlyStart, f.task().time.earlyFinish],
      ['2026-06-03T18:00', '2026-06-03T18:00']);
    const after = f.S().tasks.find(t => t.id === successor)!;
    eq(label + ': relatiegrens', type === 'START_START' ? after.time.earlyStart : after.time.earlyFinish,
      '2026-06-04T12:00');
  }
}

// Vier bestaande minutenmodelgevallen: een snap over een daggrens blijft gelden.
for (const [name, start, finish, es, ef, holiday, milestone] of [
  ['bouwvak-einde', '2026-07-29T08:00', '2026-08-04T16:00', '2026-07-29T08:00', '2026-07-31T16:00', true, false],
  ['bouwvak-venster', '2026-08-05T08:00', '2026-08-10T16:00', '2026-07-31T16:00', '2026-07-31T16:00', true, false],
  ['weekend', '2026-08-01T08:00', '2026-08-02T16:00', '2026-07-31T16:00', '2026-07-31T16:00', false, false],
  ['mijlpaal-met-duur', '2026-07-06T08:00', '2026-07-11T16:00', '2026-07-06T08:00', '2026-07-10T16:00', false, true],
] as const) {
  const f = fixture();
  f.S().setCalendar({ ...f.calendar, holidays: holiday
    ? [{ name: 'Bouwvak', startDate: '2026-08-03', endDate: '2026-08-21' }] : [] });
  f.S().setProject({ startDate: '2026-07-06', statusDate: '2026-08-24' });
  f.context.store.setState(s => {
    const task = s.tasks.find(t => t.id === f.id)!;
    task.isMilestone = milestone;
    task.status = 'COMPLETED';
    task.time = { ...task.time, scheduleStart: start, actualStart: start, actualFinish: finish,
      completion: 1, scheduleDuration: 5, durationMinutes: 2400, remainingMinutes: 0 };
  });
  f.S().runCPM();
  const label = `R4 daggrens ${name}`;
  eq(label + ': geen rekenfout', f.S().cpmResult?.error, undefined);
  eq(label + ': actuals behouden', [f.task().time.actualStart, f.task().time.actualFinish], [start, finish]);
  eq(label + ': berekend venster blijft gesnapt', [f.task().time.earlyStart, f.task().time.earlyFinish], [es, ef]);
}

// Punt 3: status, percentage en duur volgen hetzelfde afleidingspunt, bij invoer én plakken.
for (const route of ['raster', 'plakken', 'plakken-met-naam']) for (const [field, value] of [
  ['task.status', 'COMPLETED'], ['task.time.completion', 1],
  ['task.time.actualDuration', 480], ['task.time.remainingTime', 0],
] as const) {
  const f = fixture();
  f.S().updateTask(f.id, { status: 'STARTED', time: {
    ...f.task().time, actualStart: '2026-06-02T10:00', completion: 0.5,
  } });
  const edit = f.cell(field, value);
  const label = `P3 ${route} ${field}`;
  const writes = route === 'plakken-met-naam'
    ? [edit, { ...f.cell('task.name', 'Voortgang geplakt'), route: 'task-field' as const }]
    : [edit];
  eq(label + ': toegestaan', f.S().runGridMutation(route === 'raster'
    ? [edit] : [{ kind: 'paste', writes }]).ok, true);
  eq(label + ': actuals', [f.task().time.actualStart, f.task().time.actualFinish],
    ['2026-06-02T10:00', '2026-06-03T16:00']);
  eq(label + ': voltooid', [f.task().status, f.task().time.completion], ['COMPLETED', 1]);
}

// Punt 4: beide velden van een FINISH-mijlpaal horen bij dezelfde werkdag, ook over middernacht.
for (const [start, end, moment] of [
  [1320, 1800, '2026-06-04T06:00'], [0, 1440, '2026-06-04T00:00'],
] as const) for (const route of ['MCP', 'plakken', 'paneel', 'dialoog', 'dialoogvelden'] as const) {
  const f = fixture(start, end);
  f.S().updateTask(f.id, { isMilestone: true, milestoneKind: 'FINISH', time: {
    ...f.task().time, scheduleDuration: 0, durationMinutes: 0,
  } });
  const label = `P4 ${route} ${start}–${end}`;
  let actual = f.task();
  if (route === 'MCP') {
    const draft = f.draft();
    eq(label + ': toegestaan', progress.applyProgressUpdate(draft, f.id,
      { actualStart: '2026-06-03', actualFinish: '2026-06-03' }, '2026-06-03').applied, true);
    actual = draft.tasks[0];
  } else if (route === 'plakken') {
    eq(label + ': toegestaan', f.S().runGridMutation([{ kind: 'paste', writes: [
      f.cell('task.time.actualStart', '2026-06-03'), f.cell('task.time.actualFinish', '2026-06-03'),
    ] }]).ok, true);
  } else if (route === 'paneel') {
    eq(label + ': start toegestaan', f.S().setActualStart(f.id, '2026-06-03'), true);
    eq(label + ': einde toegestaan', f.S().setActualFinish(f.id, '2026-06-03'), true);
  } else if (route === 'dialoogvelden') {
    const started = draftWithActualStart(f.task(), '2026-06-03', '2026-06-03', f.calendar);
    eq(label + ': start toegestaan', started !== null, true);
    const draft = started && draftWithActualFinish(started, '2026-06-03', '2026-06-03', f.calendar);
    eq(label + ': einde toegestaan', !!draft, true);
    eq(label + ': opgeslagen', !!draft && createTaskDialogSave(f.context)({ editingTaskId: f.id, draft,
      startDate: f.task().time.scheduleStart }), true);
  } else {
    let draft = f.task();
    for (const field of ['actualStart', 'actualFinish'] as const) {
      const plan = planProgressEntry(draft, { field, value: '2026-06-03' },
        { statusDate: '2026-06-03', today: '2026-06-03', calendar: f.calendar });
      eq(label + ': ' + field + ' toegestaan', plan.ok, true);
      if (plan.ok && plan.change) draft = plan.change.task;
    }
    eq(label + ': opgeslagen', createTaskDialogSave(f.context)({ editingTaskId: f.id, draft,
      startDate: f.task().time.scheduleStart }), true);
  }
  if (route !== 'MCP') actual = f.task();
  eq(label + ': één eindmoment', [actual.time.actualStart, actual.time.actualFinish], [moment, moment]);
  // Reviewronde 2, punt 3: het rapport gebruikt dezelfde mijlpaalkant als de invoer.
  eq(label + ': DCMA aanvaardt de statuswerkdag',
    invalidDateReasons(actual, '2026-06-03', '2026-06-03', false, f.calendar), []);
}

for (const failure of failures) console.log('XX ' + failure);
console.log(`F1 reviewrondes 1 t/m 4: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exit(1);
