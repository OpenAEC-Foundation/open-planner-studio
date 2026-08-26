import { solveProject } from '@/engine/scheduler/solveProject';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import type { ImportResult } from '@/services/importTypes';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const header = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tX7 uurvelden\tC1\t2026-08-10',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date\texpect_end_date',
];

function read(rows: string[]): ImportResult {
  const opened = readXER(new TextEncoder().encode([...header, ...rows, '%E'].join('\n')));
  if (isMultiDocumentImport(opened)) throw new Error('X7-uurmodusfixture gaf meerdere documenten');
  return opened;
}

function solve(imported: ImportResult): Map<string, string | undefined> {
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: [imported.calendar, ...(imported.resourceCalendars ?? [])],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: { ...imported.project.schedulingOptions, useExpectedFinishDates: true },
    projectStartDate: imported.project.startDate,
  });
  return new Map(imported.tasks.map(task => [task.wbsCode, result.tasks.get(task.id)?.earlyFinish]));
}

// Contrast 1: als alle drie X7-velden een klok dragen, blijven reader, IFC en solver minuutexact.
const opened = read([
  // Alleen de drie X7-velden dragen een klok. Geen target/actual/constraint-kolom mag uurmodus lekken.
  '%R\tH\tP1\tC1\tH\tUurprecisie\tTT_Task\tTK_Active\tCP_Drtn\t25\t\t8\t6\t2026-08-03\t2026-08-03\t2026-08-03\t\t2026-08-04 15:30\t2026-08-06 09:45\t2026-08-12 13:15',
]);
const task = opened.tasks[0];
eq('reader bewaart uitsluitend X7-kloktijden minuut-exact', {
  stop: task?.time.stop,
  resume: task?.time.resume,
  expected: task?.p6ExpectedFinish,
  flag: task?.p6SuspendResume,
  hourMode: opened.calendar.workTime !== undefined,
}, {
  stop: '2026-08-04T15:30',
  resume: '2026-08-06T09:45',
  expected: '2026-08-12T13:15',
  flag: true,
  hourMode: true,
});

const reloaded = readIFC(writeIFC(opened));
const roundTripped = reloaded.tasks.find(candidate => candidate.wbsCode === 'H');
eq('IFC round-trip bewaart de drie X7-kloktijden minuut-exact', {
  stop: roundTripped?.time.stop,
  resume: roundTripped?.time.resume,
  expected: roundTripped?.p6ExpectedFinish,
  flag: roundTripped?.p6SuspendResume,
}, {
  stop: '2026-08-04T15:30',
  resume: '2026-08-06T09:45',
  expected: '2026-08-12T13:15',
  flag: true,
});
eq('all-timestamp-contrast houdt Expected Finish als exact solveranker',
  solve(reloaded).get('H'), '2026-08-12T13:15');

// Contrast 2: als alle drie X7-velden date-only zijn, blijft de hele keten in dagmodus.
const dayOnly = read([
  '%R\tD\tP1\tC1\tD\tDagprecisie\tTT_Task\tTK_Active\tCP_Drtn\t25\t\t8\t6\t2026-08-03\t2026-08-03\t2026-08-03\t\t2026-08-04\t2026-08-06\t2026-08-12',
]);
const dayTask = dayOnly.tasks[0];
eq('dezelfde drie date-only X7-velden promoveren een dagmodusbestand niet', {
  stop: dayTask?.time.stop,
  resume: dayTask?.time.resume,
  expected: dayTask?.p6ExpectedFinish,
  flag: dayTask?.p6SuspendResume,
  hourMode: dayOnly.calendar.workTime !== undefined,
}, {
  stop: '2026-08-04',
  resume: '2026-08-06',
  expected: '2026-08-12',
  flag: true,
  hourMode: false,
});
const dayReloaded = readIFC(writeIFC(dayOnly));
const dayReloadedTask = dayReloaded.tasks.find(candidate => candidate.wbsCode === 'D');
eq('all-date-only-contrast blijft door IFC exact date-only', {
  stop: dayReloadedTask?.time.stop,
  resume: dayReloadedTask?.time.resume,
  expected: dayReloadedTask?.p6ExpectedFinish,
  flag: dayReloadedTask?.p6SuspendResume,
}, {
  stop: '2026-08-04',
  resume: '2026-08-06',
  expected: '2026-08-12',
  flag: true,
});
eq('all-date-only-contrast houdt Expected Finish als daganker',
  solve(dayReloaded).get('D'), '2026-08-12');

// Reviewfinding A: elk X7-bronveld bezit zijn eigen precisie. Een klok in een buurveld mag de
// vorm van een date-only suspend/resume of Expected Finish niet kalenderbreed promoveren.
const mixed = read([
  '%R\tE\tP1\tC1\tE\tDate-only verwacht einde\tTT_Task\tTK_Active\tCP_Drtn\t25\t\t8\t6\t2026-08-03\t2026-08-03\t2026-08-03\t\t2026-08-04 15:30\t2026-08-06 09:45\t2026-08-12',
  '%R\tR\tP1\tC1\tR\tDate-only onderbreking\tTT_Task\tTK_Active\tCP_Drtn\t25\t\t8\t6\t2026-08-03\t2026-08-03\t2026-08-03\t\t2026-08-04\t2026-08-06\t2026-08-12 13:15',
]);
const mixedByCode = new Map(mixed.tasks.map(candidate => [candidate.wbsCode, candidate]));
eq('gemengde reader bewaart per X7-veld exact zijn eigen bronvorm', {
  expectedDateOnly: mixedByCode.get('E')?.p6ExpectedFinish,
  stopTimestamp: mixedByCode.get('E')?.time.stop,
  resumeTimestamp: mixedByCode.get('E')?.time.resume,
  stopDateOnly: mixedByCode.get('R')?.time.stop,
  resumeDateOnly: mixedByCode.get('R')?.time.resume,
  expectedTimestamp: mixedByCode.get('R')?.p6ExpectedFinish,
}, {
  expectedDateOnly: '2026-08-12',
  stopTimestamp: '2026-08-04T15:30',
  resumeTimestamp: '2026-08-06T09:45',
  stopDateOnly: '2026-08-04',
  resumeDateOnly: '2026-08-06',
  expectedTimestamp: '2026-08-12T13:15',
});

const mixedReloaded = readIFC(writeIFC(mixed));
const mixedReloadedByCode = new Map(mixedReloaded.tasks.map(candidate => [candidate.wbsCode, candidate]));
eq('gemengde IFC-round-trip bewaart per X7-veld exact zijn eigen bronvorm', {
  expectedDateOnly: mixedReloadedByCode.get('E')?.p6ExpectedFinish,
  stopTimestamp: mixedReloadedByCode.get('E')?.time.stop,
  resumeTimestamp: mixedReloadedByCode.get('E')?.time.resume,
  stopDateOnly: mixedReloadedByCode.get('R')?.time.stop,
  resumeDateOnly: mixedReloadedByCode.get('R')?.time.resume,
  expectedTimestamp: mixedReloadedByCode.get('R')?.p6ExpectedFinish,
}, {
  expectedDateOnly: '2026-08-12',
  stopTimestamp: '2026-08-04T15:30',
  resumeTimestamp: '2026-08-06T09:45',
  stopDateOnly: '2026-08-04',
  resumeDateOnly: '2026-08-06',
  expectedTimestamp: '2026-08-12T13:15',
});
eq('gemengde solver gebruikt date-only Expected Finish als einde van die werkdag, nooit T00:00',
  [...solve(mixedReloaded).entries()], [
    ['E', '2026-08-12T16:00'],
    ['R', '2026-08-12T13:15'],
  ]);

if (diffs.length > 0) {
  console.error(`XER-X7-uurmodus: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK XER-X7-uurmodus: ${checks} checks groen`);
