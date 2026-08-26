import { isMultiDocumentImport } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const xer = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tX7 uurvelden\tC1\t2026-08-10',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date\texpect_end_date',
  // Alleen de drie X7-velden dragen een klok. Geen target/actual/constraint-kolom mag uurmodus lekken.
  '%R\tH\tP1\tC1\tH\tUurprecisie\tTT_Task\tTK_Active\tCP_Drtn\t25\t\t8\t6\t2026-08-03\t2026-08-03\t2026-08-03\t\t2026-08-04 15:30\t2026-08-06 09:45\t2026-08-12 13:15',
  '%E',
];
const opened = readXER(new TextEncoder().encode(xer.join('\n')));
if (isMultiDocumentImport(opened)) throw new Error('uurmodusfixture gaf meerdere documenten');
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

const dayOnly = readXER(new TextEncoder().encode(xer.join('\n')
  .replace('2026-08-04 15:30', '2026-08-04')
  .replace('2026-08-06 09:45', '2026-08-06')
  .replace('2026-08-12 13:15', '2026-08-12')));
if (isMultiDocumentImport(dayOnly)) throw new Error('dagmodusfixture gaf meerdere documenten');
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

if (diffs.length > 0) {
  console.error(`XER-X7-uurmodus: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK XER-X7-uurmodus: ${checks} checks groen`);
