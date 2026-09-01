import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER, type XerReadResult } from '@/services/xer/xerReader';

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

if (diffs.length > 0) {
  console.error(`XX XER PROJECT.data_date (${checks} checks)`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}

console.log(`OK XER PROJECT.data_date (${checks} checks)`);
