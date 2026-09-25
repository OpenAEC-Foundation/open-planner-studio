// X9 reviewronde 1 — false is een aanwezige P6-waarde; raw XER-cellen blijven daarnaast exact.
import { activeImportResult } from '@/services/importTypes';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';

declare const process: { exit(code: number): never };
const failures: string[] = [];
let checks = 0;
const equal = (label: string, actual: unknown, expected: unknown) => {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
};

const bytes = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP\tPresentie',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tsuspend_date\tresume_date\tunknown_new_field\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt',
  '%R\tT-FALSE\tP\tFALSE\tExpliciet false\tTT_Task\tDT_Mystery\tTK_NotStart\t\tnull\tfalse\tmystery\t2026-08-01\t2026-08-02\t8',
  '%R\tT-ABSENT\tP\tABSENT\tAfwezig\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t\t\t\tordinary\t2026-08-02\t2026-08-03\t8',
  '%E',
].join('\r\n'));
const opened = activeImportResult(readXER(bytes));
const archive = opened.xerSourceArchive;
if (!archive) throw new Error('XER-archief ontbreekt');
const rawRows = archive.readModel.taskSourceRowsByProject.P;
const rawFalse = rawRows?.find(row => row.cells.task_id === 'T-FALSE');
equal('1 raw provenance onderscheidt afwezig, leeg, null, false, onbekend en gewone waarde', {
  absent: rawFalse && Object.prototype.hasOwnProperty.call(rawFalse.cells, 'expect_end_date'),
  empty: rawFalse?.cells.complete_pct_type,
  null: rawFalse?.cells.suspend_date,
  false: rawFalse?.cells.resume_date,
  unknown: rawFalse?.cells.duration_type,
  ordinary: rawFalse?.cells.task_type,
}, {
  absent: false,
  empty: '',
  null: 'null',
  false: 'false',
  unknown: 'DT_Mystery',
  ordinary: 'TT_Task',
});

const falseTask = opened.tasks.find(task => task.id === 'T-FALSE');
if (!falseTask) throw new Error('T-FALSE ontbreekt');
falseTask.p6SuspendResume = false;
const absentTask = opened.tasks.find(task => task.id === 'T-ABSENT');
if (!absentTask) throw new Error('T-ABSENT ontbreekt');
delete absentTask.p6SuspendResume;
const ifc = writeIFC(opened);
equal('2 IFC schrijft expliciet false als .F. en niet als afwezig',
  (ifc.match(/'SuspendResume',\$,IFCBOOLEAN\(\.F\.\)/g) ?? []).length, 1);
const reloaded = readIFC(ifc);
const byCode = new Map(reloaded.tasks.map(task => [task.wbsCode, task]));
equal('3 IFC-read onderscheidt expliciet false van een afwezige P6-vlag',
  [byCode.get('FALSE')?.p6SuspendResume, byCode.get('ABSENT')?.p6SuspendResume],
  [false, undefined]);
equal('4 raw presentie blijft na XER→IFC→IFC byte- en celgetrouw beschikbaar',
  (readIFC(writeIFC(reloaded)).xerSourceArchive?.readModel.taskSourceRowsByProject.P ?? [])
    .find(row => row.cells.task_id === 'T-FALSE')?.cells,
  rawFalse?.cells);

if (failures.length === 0) {
  console.log(`OK  xer-p6-presence: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-p6-presence: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
