import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { detectDateOrder, finalizeProgressRows, parseSheetDate, parseSheetPercent } from '@/services/progressImport/sheetValues';
import { PROGRESS_IMPORT_LIMITS, type DateOrder, type DateOrderDetection, type RawDateCell } from '@/services/progressImport/types';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';
import { sheetFromText } from './progressSheetFixture';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

let taskSeq = 0;
function baseTask(id: string, start: string, durationDays: number): Task {
  taskSeq++;
  return {
    id,
    name: `Taak ${taskSeq}`,
    description: '',
    wbsCode: String(taskSeq),
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 0,
    parentId: null,
    childIds: [],
    time: createDefaultTaskTime(start, durationDays),
    resourceIds: [],
  };
}
function taskWithDates(id: string, earlyStart: string, earlyFinish: string): Task {
  const task = baseTask(id, earlyStart, 1);
  task.time.earlyStart = earlyStart;
  task.time.earlyFinish = earlyFinish;
  task.time.scheduleStart = earlyStart;
  task.time.scheduleFinish = earlyFinish;
  return task;
}

{
  const task = baseTask('task-abc-123', '2026-06-01', 5);
  const csvText = writeCSV({} as Project, {} as WorkCalendar, [task], [], [], []);
  const lines = csvText.split('\r\n');
  const header = lines[0];
  const firstRow = lines[1];

  ok('kop draagt de id-kolom', header.includes('OPS Task ID'));
  eq('…als eerste kolom', header.split(/[;,]/)[0].replace(/^﻿/, ''), 'OPS Task ID');
  eq('…en de rij draagt het echte id', firstRow.split(/[;,]/)[0], task.id);
  ok('de bestaande kolommen staan er nog', header.includes('OPS Custom Task Type ID') && header.includes('Actual Start'));
  ok('vervang-import mint een eigen id', readCSV(csvText).tasks[0].id !== task.id);
}

{
  function d(raw: string, order: DateOrder = 'dmy') {
    return parseSheetDate(raw, order);
  }
  function iso(value: ReturnType<typeof parseSheetDate>): string {
    if (!value || value.kind !== 'value') throw new Error(`verwachtte een geldige datum, kreeg ${JSON.stringify(value)}`);
    return value.iso;
  }
  function kindOf(value: ReturnType<typeof parseSheetDate>): string {
    if (!value) throw new Error('verwachtte een waarde, kreeg undefined');
    return value.kind;
  }
  function rawOf(value: ReturnType<typeof parseSheetDate>): string {
    if (!value || value.kind !== 'unreadable') throw new Error(`verwachtte 'unreadable', kreeg ${JSON.stringify(value)}`);
    return value.raw;
  }

  eq('leeg veld ⇒ afwezig, geen fout', d(''), undefined);
  eq('ISO', iso(d('2026-06-09')), '2026-06-09');
  eq('ISO met T-tijd blijft datetime', iso(d('2026-06-09T08:30')), '2026-06-09T08:30');
  eq('ISO met SPATIE-tijd ook', iso(d('2026-06-09 08:30')), '2026-06-09T08:30');
  eq('zonder voorloopnullen', iso(d('9-6-2026', 'dmy')), '2026-06-09');
  eq('punt als scheidingsteken', iso(d('9.6.2026', 'dmy')), '2026-06-09');
  eq('slash als scheidingsteken', iso(d('9/6/2026', 'dmy')), '2026-06-09');
  eq('spatie-datetime zonder nullen', iso(d('9-6-2026 8:30', 'dmy')), '2026-06-09T08:30');
  eq('…met seconden', iso(d('9-6-2026 8:30:15', 'dmy')), '2026-06-09T08:30:15');
  eq('mdy leest dezelfde cel anders', iso(d('9-6-2026', 'mdy')), '2026-09-06');
  eq('2026-02-30 bestaat niet', kindOf(d('2026-02-30')), 'unreadable');
  eq('31-2-2026 bestaat niet', kindOf(d('31-2-2026', 'dmy')), 'unreadable');
  eq('tekst is onleesbaar', kindOf(d('volgende week')), 'unreadable');
  eq('…en NIET vandaag', rawOf(d('volgende week')), 'volgende week');

  eq('MM-DD-YY (mdy): 03-01-27 ⇒ 1 mrt 2027 (maand-eerst)', iso(d('03-01-27', 'mdy')), '2027-03-01');
  eq('DD-MM-YY (dmy): dezelfde cel anders gelezen ⇒ 3 jan 2027', iso(d('03-01-27', 'dmy')), '2027-01-03');
  eq('D/M/YY met slash', iso(d('3/1/27', 'dmy')), '2027-01-03');
  eq('D.M.YY met punt', iso(d('1.3.27', 'mdy')), '2027-01-03');
  eq('YY met tijd erachter', iso(d('3-1-27 8:30', 'dmy')), '2027-01-03T08:30');
  eq('YY blijft geldigheid controleren: 31-2-27 bestaat niet', kindOf(d('31-2-27', 'dmy')), 'unreadable');
}

{
  function det(cells: readonly RawDateCell[], tasks: readonly Task[] = []): DateOrderDetection {
    return detectDateOrder(cells, tasks);
  }
  function sampleOf(detection: DateOrderDetection): string {
    if (detection.order !== 'ambiguous') throw new Error(`verwachtte 'ambiguous', kreeg ${JSON.stringify(detection)}`);
    return detection.sample;
  }
  function alternativesOf(detection: DateOrderDetection): [string, string] {
    if (detection.order !== 'ambiguous') throw new Error(`verwachtte 'ambiguous', kreeg ${JSON.stringify(detection)}`);
    return detection.sampleAlternatives;
  }
  function evidenceOf(detection: DateOrderDetection): string {
    if (detection.order === 'ambiguous') throw new Error(`verwachtte bewijs, kreeg ambiguous: ${JSON.stringify(detection)}`);
    return detection.evidence;
  }

  const isoOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '2026-06-01' },
    { rowNumber: 3, field: 'actualFinish', raw: '2026-06-05' },
  ];
  eq('alleen ISO ⇒ geen dubbelzinnigheid', evidenceOf(det(isoOnly)), 'noAmbiguity');

  const has25: RawDateCell[] = [{ rowNumber: 2, field: 'actualStart', raw: '25-6-2026' }];
  eq('een component > 12 beslist dmy', det(has25).order, 'dmy');

  const hasMonth25: RawDateCell[] = [{ rowNumber: 2, field: 'actualStart', raw: '6-25-2026' }];
  eq('…en andersom mdy', det(hasMonth25).order, 'mdy');

  const contradictoryNoGenuineCell: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '25-6-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '6-25-2026' },
  ];
  eq('tegenstrijdig bewijs zonder eerlijk voorbeeld ⇒ orde blijft dmy', det(contradictoryNoGenuineCell).order, 'dmy');
  eq(
    '…maar het bewijssoort verzwijgt de tegenstrijdigheid niet (N-D/N-E)',
    evidenceOf(det(contradictoryNoGenuineCell)),
    'contradictoryNoSample',
  );

  const contradictoryWithGenuineCell: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '25-6-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '6-25-2026' },
    { rowNumber: 4, field: 'actualStart', raw: '9-6-2026' },
  ];
  eq('tegenstrijdig bewijs MET een eerlijk voorbeeld ⇒ ambiguous', det(contradictoryWithGenuineCell).order, 'ambiguous');
  eq('…en de sample is de eerlijke cel, niet de kapotte', sampleOf(det(contradictoryWithGenuineCell)), '9-6-2026');
  eq(
    '…met de twee lezingen als ISO-datums (bevinding 5 — geen geformatteerde tekst meer)',
    alternativesOf(det(contradictoryWithGenuineCell)),
    ['2026-06-09', '2026-09-06'],
  );

  const equalDayMonthOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-12-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '5-5-2026' },
  ];
  eq('dag===maand is nooit dubbelzinnig', evidenceOf(det(equalDayMonthOnly)), 'noAmbiguity');

  const calibTask1 = taskWithDates('t-calib-1', '2026-06-09', '2026-06-09');
  const calibTask2 = taskWithDates('t-calib-2', '2026-05-08', '2026-05-08');
  const calibTask3 = taskWithDates('t-calib-3', '2026-04-07', '2026-04-07');

  const calib2: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-6-2026' },
    { rowNumber: 3, field: 'start', raw: '9-6-2026', taskId: 't-calib-1' },
    { rowNumber: 4, field: 'finish', raw: '8-5-2026', taskId: 't-calib-2' },
  ];
  const calib2Tasks = [calibTask1, calibTask2];

  const calib3: RawDateCell[] = [
    ...calib2,
    { rowNumber: 5, field: 'start', raw: '7-4-2026', taskId: 't-calib-3' },
  ];
  const calib3Tasks = [calibTask1, calibTask2, calibTask3];

  eq('ijkpunt met 3 treffers beslist', det(calib3, calib3Tasks).order, 'dmy');
  eq('…met bewijssoort calibration', evidenceOf(det(calib3, calib3Tasks)), 'calibration');

  const ddTask1 = taskWithDates('t-calib-dd-1', '2026-03-03', '2026-03-03');
  const ddTask2 = taskWithDates('t-calib-dd-2', '2026-06-06', '2026-06-06');
  const ddTask3 = taskWithDates('t-calib-dd-3', '2026-10-10', '2026-10-10');
  const calib3WithDayEqualsMonth: RawDateCell[] = [
    ...calib3,
    { rowNumber: 6, field: 'start', raw: '3-3-2026', taskId: 't-calib-dd-1' },
    { rowNumber: 7, field: 'start', raw: '6-6-2026', taskId: 't-calib-dd-2' },
    { rowNumber: 8, field: 'start', raw: '10-10-2026', taskId: 't-calib-dd-3' },
  ];
  const calib3WithDayEqualsMonthTasks = [...calib3Tasks, ddTask1, ddTask2, ddTask3];
  eq(
    'dag==maand-ijkpunten mogen de kalibratie niet vervuilen',
    det(calib3WithDayEqualsMonth, calib3WithDayEqualsMonthTasks).order,
    'dmy',
  );
  eq(
    '…en de 3 echte treffers blijven een echte kalibratie-beslissing (niet toevallig ambiguous)',
    evidenceOf(det(calib3WithDayEqualsMonth, calib3WithDayEqualsMonthTasks)),
    'calibration',
  );

  eq('2 treffers is te weinig', det(calib2, calib2Tasks).order, 'ambiguous');
  eq('ambiguous draagt een echt voorbeeld', sampleOf(det(calib2, calib2Tasks)), '12-6-2026');
  eq(
    '…als ISO-datumparen, niet als geformatteerde tekst (bevinding 5)',
    alternativesOf(det(calib2, calib2Tasks)),
    ['2026-06-12', '2026-12-06'],
  );

  const tieDmy1 = taskWithDates('t-tie-dmy-1', '2026-06-09', '2026-06-09');
  const tieDmy2 = taskWithDates('t-tie-dmy-2', '2026-05-08', '2026-05-08');
  const tieDmy3 = taskWithDates('t-tie-dmy-3', '2026-04-07', '2026-04-07');
  const tieMdy1 = taskWithDates('t-tie-mdy-1', '2026-03-11', '2026-03-11');
  const tieMdy2 = taskWithDates('t-tie-mdy-2', '2026-02-10', '2026-02-10');
  const tieMdy3 = taskWithDates('t-tie-mdy-3', '2026-01-09', '2026-01-09');
  const calibTie: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '9-6-2026', taskId: 't-tie-dmy-1' },
    { rowNumber: 3, field: 'start', raw: '8-5-2026', taskId: 't-tie-dmy-2' },
    { rowNumber: 4, field: 'start', raw: '7-4-2026', taskId: 't-tie-dmy-3' },
    { rowNumber: 5, field: 'start', raw: '3-11-2026', taskId: 't-tie-mdy-1' },
    { rowNumber: 6, field: 'start', raw: '2-10-2026', taskId: 't-tie-mdy-2' },
    { rowNumber: 7, field: 'start', raw: '1-9-2026', taskId: 't-tie-mdy-3' },
  ];
  const calibTieTasks = [tieDmy1, tieDmy2, tieDmy3, tieMdy1, tieMdy2, tieMdy3];
  eq('gelijkspel beslist niet', det(calibTie, calibTieTasks).order, 'ambiguous');

  const calibWbsOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '9-6-2026' },
    { rowNumber: 3, field: 'finish', raw: '8-5-2026' },
    { rowNumber: 4, field: 'start', raw: '7-4-2026' },
  ];
  eq('WBS-rijen tellen niet als ijkpunt', det(calibWbsOnly, calib3Tasks).order, 'ambiguous');

  const yyCalibTask1 = taskWithDates('t-yy-calib-1', '2027-01-03', '2027-01-03');
  const yyCalibTask2 = taskWithDates('t-yy-calib-2', '2027-02-04', '2027-02-04');
  const yyCalibTask3 = taskWithDates('t-yy-calib-3', '2027-03-05', '2027-03-05');
  const yyCalibCells: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '01-03-27', taskId: 't-yy-calib-1' },
    { rowNumber: 3, field: 'start', raw: '02-04-27', taskId: 't-yy-calib-2' },
    { rowNumber: 4, field: 'start', raw: '03-05-27', taskId: 't-yy-calib-3' },
  ];
  const yyCalibTasks = [yyCalibTask1, yyCalibTask2, yyCalibTask3];
  eq('YY-datums (MM-DD-YY) kalibreren net als YYYY', det(yyCalibCells, yyCalibTasks).order, 'mdy');
  eq('…met bewijssoort calibration', evidenceOf(det(yyCalibCells, yyCalibTasks)), 'calibration');

  const yyAmbiguousOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-6-27' },
  ];
  eq('alleen dubbelzinnige YY-datums ⇒ ambiguous', det(yyAmbiguousOnly).order, 'ambiguous');
  eq(
    '…met de twee lezingen als ISO-samples (20YY, geen 4-cijferig jaar in de brontekst)',
    alternativesOf(det(yyAmbiguousOnly)),
    ['2027-06-12', '2027-12-06'],
  );
}

{
  const sfSheet = sheetFromText('OPS Task ID;Start;Finish;Completion (%)\r\ntask-1;9-6-2026;20-6-2026;50');
  eq(
    'Start/Finish komen niet in de rijen',
    Object.keys(sfSheet.rawRows[0]).some(k => /start|finish/i.test(k) && !/actual/i.test(k)),
    false,
  );

  const startBaseline = sheetFromText('OPS Task ID;Start;Completion (%)\r\ntask-1;9-6-2026;50');
  const startChanged = sheetFromText('OPS Task ID;Start;Completion (%)\r\ntask-1;25-12-2099;50');
  eq(
    'een gewijzigde Start-kolom verandert niets aan de gefinaliseerde rij',
    JSON.stringify(finalizeProgressRows(startChanged, 'dmy')),
    JSON.stringify(finalizeProgressRows(startBaseline, 'dmy')),
  );
}

{
  function pct(raw: string): number {
    const value = parseSheetPercent(raw);
    if (!value || value.kind !== 'value') throw new Error(`verwachtte een geldig percentage, kreeg ${JSON.stringify(value)}`);
    return value.value;
  }
  function percentKind(raw: string): string {
    const value = parseSheetPercent(raw);
    if (!value) throw new Error('verwachtte een waarde, kreeg undefined');
    return value.kind;
  }

  eq('100 ⇒ 1.0', pct('100'), 1);
  eq('45 ⇒ 0.45', pct('45'), 0.45);
  eq('45,5 ⇒ 0.455', pct('45,5'), 0.455);
  eq('45.5 ⇒ 0.455', pct('45.5'), 0.455);
  eq('1 ⇒ 0.01', pct('1'), 0.01);
  eq('0,5 ⇒ 0.005', pct('0,5'), 0.005);
  eq('100% ⇒ 1.0', pct('100%'), 1);
  eq('150 ⇒ buiten bereik (niet onleesbaar)', percentKind('150'), 'outOfRange');
  eq('-1 ⇒ buiten bereik (niet onleesbaar)', percentKind('-1'), 'outOfRange');
  eq('838 ⇒ buiten bereik (de gebruikstest-casus)', percentKind('838'), 'outOfRange');
  eq('tekst ⇒ onleesbaar', percentKind('bijna klaar'), 'unreadable');
}

{
  eq('blad zonder sleutelkolom', sheetFromText('Name;Completion (%)\r\nFoo;50').fileIssue, 'noKeyColumn');
  eq('blad zonder voortgangskolommen', sheetFromText('OPS Task ID;Name\r\ntask-1;Foo').fileIssue, 'noProgressColumns');

  const tinyLimits = { ...PROGRESS_IMPORT_LIMITS, maxRows: 2 };
  const bigCsv = ['OPS Task ID;Completion (%)', ...Array.from({ length: 5 }, (_, i) => `task-${i};50`)].join('\r\n');
  eq('te veel rijen wordt geweigerd', sheetFromText(bigCsv, tinyLimits).fileIssue, 'tooManyRows');

  const longId = 'x'.repeat(300);
  const rows9 = sheetFromText(`OPS Task ID;Completion (%)\r\n${longId};50`).rawRows;
  eq('te lang id wordt geweigerd', rows9[0].taskId, undefined);

  const controlId = 'task\x01abc';
  const rows10 = sheetFromText(`OPS Task ID;Completion (%)\r\n${controlId};50`).rawRows;
  eq('id met stuurteken telt niet', rows10[0].taskId, undefined);

  const rows11 = sheetFromText('OPS Task ID;Name;Completion (%)\r\ntask-1;Fase 1;50').rawRows;
  eq('rowNumber telt de kopregel mee', rows11[0].rowNumber, 2);
}

{
  const nlHeader = 'OPS Task ID — niet wijzigen;WBS — niet wijzigen;Name — niet wijzigen;'
    + 'Start — gepland, niet wijzigen;Finish — gepland, niet wijzigen;'
    + 'Completion (%) — invullen: 0 t/m 100, hele getallen;'
    + 'Actual Start — invullen: werkelijke startdatum (dd-mm-jjjj);'
    + 'Actual Finish — invullen: werkelijke einddatum (dd-mm-jjjj)';
  const deHeader = 'OPS Task ID — nicht ändern;WBS — nicht ändern;Name — nicht ändern;'
    + 'Start — geplant, nicht ändern;Finish — geplant, nicht ändern;'
    + 'Completion (%) — ausfüllen: 0 bis 100, ganze Zahlen;'
    + 'Actual Start — ausfüllen: tatsächliches Startdatum (TT-MM-JJJJ);'
    + 'Actual Finish — ausfüllen: tatsächliches Enddatum (TT-MM-JJJJ)';
  const dataLine = 'task-d;1;Fundering;2026-01-05;2026-01-09;40;;';

  const nlSheet = sheetFromText(`${nlHeader}\r\n${dataLine}`);
  ok('NL-instructiekop: alle acht kolommen herkend (geen fileIssue)', nlSheet.fileIssue === undefined);
  eq('…taskId gevonden', nlSheet.rawRows[0]?.taskId, 'task-d');
  eq('…completion gevonden', nlSheet.rawRows[0]?.rawCompletion, '40');

  const deSheet = sheetFromText(`${deHeader}\r\n${dataLine}`);
  ok('DE-instructiekop: alle acht kolommen herkend (geen fileIssue)', deSheet.fileIssue === undefined);
  eq('…taskId gevonden', deSheet.rawRows[0]?.taskId, 'task-d');
  eq('…completion gevonden', deSheet.rawRows[0]?.rawCompletion, '40');

  const completionOnlySheet = sheetFromText(
    'OPS Task ID;Completion (%) — invullen: 0 t/m 100, hele getallen\r\ntask-d;40',
  );
  eq('…gevonden als completion-kolom', completionOnlySheet.rawRows[0]?.rawCompletion, '40');
}

{
  function stubPlanEdits2(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDeps2: ProgressPlanDeps = { planEdits: stubPlanEdits2 };

  const taskX = baseTask('task-x', '2026-01-05', 5);
  const taskY = baseTask('task-y', '2026-01-05', 5);
  const taskZ = baseTask('task-z', '2026-01-05', 5);

  const csv = [
    'OPS Task ID;Completion (%)',
    `${taskX.id};838`,
    `${taskY.id};-5`,
    `${taskZ.id};abc`,
  ].join('\r\n');
  const sheet = sheetFromText(csv);
  const rows = finalizeProgressRows(sheet, 'dmy');
  const plan = buildProgressImportPlan(rows, [taskX, taskY, taskZ], stubDeps2);
  const rowFor = (id: string) => plan.rows.find(r => r.taskId === id);

  eq('838 ⇒ reason percentOutOfRange', rowFor(taskX.id)?.reason, 'percentOutOfRange');
  eq('-5 ⇒ reason percentOutOfRange', rowFor(taskY.id)?.reason, 'percentOutOfRange');
  eq('abc blijft reason unreadableNumber', rowFor(taskZ.id)?.reason, 'unreadableNumber');
}

{
  function stubPlanEditsS(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
      else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
      else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDepsS: ProgressPlanDeps = { planEdits: stubPlanEditsS };

  const parent = baseTask('task-parent', '2026-01-05', 5);
  parent.wbsCode = '1';
  parent.name = 'Ruwbouw';
  parent.childIds = ['task-child'];
  parent.time.completion = 0.4;
  const child = baseTask('task-child', '2026-01-05', 5);
  child.wbsCode = '1.1';
  child.name = 'Fundering';
  child.parentId = parent.id;
  child.time.completion = 0.4;

  const SUMMARY_NOTE = '— verzameltaak: niet invullen';

  const sheetS = sheetFromText([
    'OPS Task ID;WBS;Completion (%);Actual Start;Actual Finish',
    `${parent.id};1;${SUMMARY_NOTE};${SUMMARY_NOTE};${SUMMARY_NOTE}`,
    `${child.id};1.1;40;;`,
  ].join('\r\n'));
  const rowsS = finalizeProgressRows(sheetS, 'dmy');
  const planS = buildProgressImportPlan(rowsS, [parent, child], stubDepsS);
  eq('round-trip met verzameltaak ⇒ niets toegepast', planS.appliedCount, 0);
  eq('…en NIETS geweigerd', planS.refusedCount, 0);
  eq('…de verzameltaakrij is gewoon ongewijzigd', planS.rows[0]?.outcome, 'noop');
  eq('…net als de bladtaakrij', planS.rows[1]?.outcome, 'noop');

  const markedSheet = sheetFromText(
    'OPS Task ID;Completion (%);Actual Start\r\n'
    + `task-child;${SUMMARY_NOTE};${SUMMARY_NOTE}`,
  );
  const markedRows = finalizeProgressRows(markedSheet, 'dmy');
  eq('em-dash-cel ⇒ completion afwezig', markedRows[0]?.completion, undefined);
  eq('em-dash-cel ⇒ actualStart afwezig', markedRows[0]?.actualStart, undefined);
}


if (diffs.length > 0) {
  console.error(`FAIL progress-sheet-values: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-sheet-values: ${checks}/${checks}`);
}
