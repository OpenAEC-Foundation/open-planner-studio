import { solveProject } from '@/engine/scheduler/solveProject';
import { explainCompletedXerLoeActualFinishEligibility } from '@/engine/scheduler/p6CompletedRouteTrace';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function read(source: Uint8Array): XerReadResult {
  const parsed = readXER(source);
  if (isMultiDocumentImport(parsed)) throw new Error('PROJECT-data-date-fixture gaf onverwacht meerdere documenten terug');
  return parsed;
}

function fixture(fields: readonly string[], values: Readonly<Record<string, string>>): Uint8Array {
  const projectFields = ['proj_id', 'proj_short_name', 'clndr_id', ...fields];
  const projectValues = projectFields.map(field => ({
    proj_id: 'P1',
    proj_short_name: 'PROJECT.data_date-dialect',
    clndr_id: 'C1',
    ...values,
  })[field] ?? '');
  return bytes([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_data',
    '%R\tC1\tStandaard\t',
    '%T\tPROJECT',
    `%F\t${projectFields.join('\t')}`,
    `%R\t${projectValues.join('\t')}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tA1\tBronactiviteit\t2026-01-02\t2026-01-03',
    '%E',
  ]);
}

const cases = [
  { name: 'last-only geldig', fields: ['last_recalc_date'], values: { last_recalc_date: '2026-01-10' }, statusDate: '2026-01-10' },
  { name: 'last-only ongeldig', fields: ['last_recalc_date'], values: { last_recalc_date: 'geen-datum' }, statusDate: undefined },
  { name: 'last-only leeg', fields: ['last_recalc_date'], values: { last_recalc_date: '' }, statusDate: undefined },
  { name: 'data-only geldig', fields: ['data_date'], values: { data_date: '2026-01-05' }, statusDate: '2026-01-05' },
  { name: 'data-only ongeldig', fields: ['data_date'], values: { data_date: 'geen-datum' }, statusDate: undefined },
  { name: 'data-only leeg', fields: ['data_date'], values: { data_date: '' }, statusDate: undefined },
  { name: 'beide geldig gelijk', fields: ['last_recalc_date', 'data_date'], values: { last_recalc_date: '2026-01-05', data_date: '2026-01-05' }, statusDate: '2026-01-05' },
  { name: 'beide geldig verschillend', fields: ['last_recalc_date', 'data_date'], values: { last_recalc_date: '2026-01-10', data_date: '2026-01-05' }, statusDate: '2026-01-10' },
  { name: 'beide last leeg data geldig', fields: ['last_recalc_date', 'data_date'], values: { last_recalc_date: '', data_date: '2026-01-05' }, statusDate: undefined },
  { name: 'beide last ongeldig data geldig', fields: ['last_recalc_date', 'data_date'], values: { last_recalc_date: 'geen-datum', data_date: '2026-01-05' }, statusDate: undefined },
  { name: 'beide kolommen afwezig', fields: [], values: {}, statusDate: undefined },
] as const;

for (const test of cases) {
  const result = read(fixture(test.fields, test.values));
  eq(`PROJECT-data-date ${test.name}: statusDate volgt uitsluitend de geselecteerde %F-kolom`, result.project.statusDate, test.statusDate);
}

// Dit is de bestaande last_recalc_date-dialectvorm. De bytekopie én alle betrokken
// productvelden zijn bewust gepind: de data_date-kandidaat mag deze route niet wijzigen.
const legacySource = fixture(['last_recalc_date'], { last_recalc_date: '2026-04-02' });
const legacyBefore = Array.from(legacySource);
const legacy = read(legacySource);
eq('PROJECT-data-date legacy last-dialect: bronbytes blijven identiek na lezen', Array.from(legacySource), legacyBefore);
eq('PROJECT-data-date legacy last-dialect: productvelden blijven byte/productveld-identiek', {
  id: legacy.project.id,
  name: legacy.project.name,
  startDate: legacy.project.startDate,
  endDate: legacy.project.endDate,
  modifiedAt: legacy.project.modifiedAt,
  statusDate: legacy.project.statusDate,
  calendarId: legacy.project.calendarId,
  task: legacy.tasks.map(task => ({
    id: task.id,
    scheduleStart: task.time.scheduleStart,
    scheduleFinish: task.time.scheduleFinish,
  })),
}, {
  id: 'P1',
  name: 'PROJECT.data_date-dialect',
  startDate: '2026-01-02',
  endDate: '2026-01-03',
  modifiedAt: '2026-04-02',
  statusDate: '2026-04-02',
  calendarId: 'C1',
  task: [{ id: 'T1', scheduleStart: '2026-01-02', scheduleFinish: '2026-01-03' }],
});

// data_date is uitsluitend een compatibiliteitsbron voor project.statusDate. De reeds bestaande
// TASK-terugval voor een ontbrekend targetvenster blijft exclusief op last_recalc_date gebaseerd.
const dataOnlyMissingTargetWindow = read(bytes([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_data',
  '%R\tC1\tStandaard\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdata_date',
  '%R\tP1\tPROJECT.data_date-dialect\tC1\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tA1\tOntbrekend targetvenster\t\t',
  '%E',
]));
eq('PROJECT-data-date data-only zonder targetvenster: statusDate gebruikt data_date',
  dataOnlyMissingTargetWindow.project.statusDate, '2026-01-05');
eq('PROJECT-data-date data-only zonder targetvenster: scheduleStart houdt oude last-only-terugval',
  dataOnlyMissingTargetWindow.tasks[0]?.time.scheduleStart, '1970-01-01');
eq('PROJECT-data-date data-only zonder targetvenster: scheduleFinish houdt oude last-only-terugval',
  dataOnlyMissingTargetWindow.tasks[0]?.time.scheduleFinish, '1970-01-01');

// End-to-end combinatie: PROJECT heeft uitsluitend data_date, terwijl de voltooide TT_LOE via
// precies de bestaande, smalle actualFinish-route moet blijven lopen. De LOE-batterij bewaakt de
// volledige fail-closed matrix; deze fixture verbindt haar bewezen vorm aan het nieuwe dialect.
const dataDateOnlyCompletedLoe = read(bytes([
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||2()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||3()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||4()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||5()(        (0||0(s|08:00|f|12:00)())        (0||1(s|13:00|f|17:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tdata_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
  '%R\tP1\tPROJECT.data_date completed LOE\tC1\t2026-06-30 17:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_use_project_end_date_for_float',
  '%R\tP1\tN',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date',
  '%R\tP\tP1\tC1\tPRED\tSS voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00\t\t\t\t',
  '%R\tL\tP1\tC1\tLOE\tLange voltooide LOE\tTT_LOE\tDT_FixedDrtn\tTK_Complete\tCP_Drtn\t352\t0\t2026-01-05 08:00\t2026-03-06 17:00\t2026-01-05 08:00\t2026-03-06 17:00\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
  '%E',
]));
const dataDateOnlyLoe = dataDateOnlyCompletedLoe.tasks.find(task => task.id === 'L');
if (!dataDateOnlyLoe) throw new Error('PROJECT.data_date completed-LOE-fixture mist taak L');
const dataDateOnlyIncoming = dataDateOnlyCompletedLoe.sequences.filter(sequence => sequence.successorId === dataDateOnlyLoe.id);
const dataDateOnlyOutgoing = dataDateOnlyCompletedLoe.sequences.filter(sequence => sequence.predecessorId === dataDateOnlyLoe.id);
eq('PROJECT-data-date completed LOE: uitsluitend data_date levert de statusdatum voor de bestaande route',
  dataDateOnlyCompletedLoe.project.statusDate, '2026-06-30T17:00');
eq('PROJECT-data-date completed LOE: TT_LOE blijft binnen de smalle actualFinish-route',
  explainCompletedXerLoeActualFinishEligibility(
    dataDateOnlyLoe,
    dataDateOnlyCompletedLoe.project.statusDate ? parseInstant(dataDateOnlyCompletedLoe.project.statusDate) : null,
    dataDateOnlyCompletedLoe.project.schedulingOptions,
    dataDateOnlyIncoming,
    dataDateOnlyOutgoing,
  ), { eligible: true, reason: 'eligible' });
const dataDateOnlyLoeSolve = solveProject({
  tasks: dataDateOnlyCompletedLoe.tasks,
  sequences: dataDateOnlyCompletedLoe.sequences,
  calendar: dataDateOnlyCompletedLoe.calendar,
  calendars: dataDateOnlyCompletedLoe.resourceCalendars ?? [],
  dataDate: dataDateOnlyCompletedLoe.project.statusDate,
  progressMode: dataDateOnlyCompletedLoe.project.progressMode,
  schedulingOptions: dataDateOnlyCompletedLoe.project.schedulingOptions,
  projectStartDate: dataDateOnlyCompletedLoe.project.startDate,
  projectEndDate: dataDateOnlyCompletedLoe.project.endDate,
});
if (dataDateOnlyLoeSolve.error) throw new Error(dataDateOnlyLoeSolve.error);
const dataDateOnlyLoeSolved = dataDateOnlyLoeSolve.tasks.get(dataDateOnlyLoe.id);
if (!dataDateOnlyLoeSolved) throw new Error('PROJECT.data_date completed-LOE-solver mist taak L');
eq('PROJECT-data-date completed LOE: bestaande actualFinish-uitkomst blijft exact behouden', {
  es: dataDateOnlyLoeSolved.earlyStart,
  ef: dataDateOnlyLoeSolved.earlyFinish,
  ls: dataDateOnlyLoeSolved.lateStart,
  lf: dataDateOnlyLoeSolved.lateFinish,
  tf: dataDateOnlyLoeSolved.totalFloat,
  ff: dataDateOnlyLoeSolved.freeFloat,
}, {
  es: '2026-01-05T08:00', ef: '2026-03-06T17:00',
  ls: '2026-01-05T08:00', lf: '2026-03-06T17:00',
  tf: 0, ff: 0,
});

if (diffs.length > 0) {
  console.error(`XX XER PROJECT.data_date (${checks} checks)`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}

console.log(`OK XER PROJECT.data_date (${checks} checks)`);
