import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMultiDocumentImport } from '@/services/importTypes';
import { indexXerProjectRows, readXER } from '@/services/xer/xerReader';
import { XerImportError, type XerRow, type XerTables } from '@/services/xer/xerTables';

const projects = Array.from({ length: 12 }, (_, index) => `P${index + 1}`);
const taskIds = Array.from({ length: 100 }, (_, index) => `T${index + 1}`);
const wbsIds = Array.from({ length: 20 }, (_, index) => `W${index + 1}`);

function row(line: number, cells: Record<string, string>): XerRow {
  return { line, cells };
}

const taskRows = projects.flatMap((projectId, projectIndex) => taskIds.map((taskId, taskIndex) => row(
  projectIndex * taskIds.length + taskIndex + 1,
  { proj_id: projectId, task_id: taskId },
)));
const wbsRows = projects.flatMap((projectId, projectIndex) => wbsIds.map((wbsId, wbsIndex) => row(
  projectIndex * wbsIds.length + wbsIndex + 1,
  { proj_id: projectId, wbs_id: wbsId },
)));
const relationRows = projects.flatMap((projectId, projectIndex) => Array.from({ length: 30 }, (_, relationIndex) => row(
  projectIndex * 30 + relationIndex + 1,
  { proj_id: projectId, pred_proj_id: projectId, task_id: `T${relationIndex + 2}`, pred_task_id: `T${relationIndex + 1}` },
)));
const tables: XerTables = {
  header: { version: 'test', defaultCurrencyCode: 'EUR' },
  tables: new Map([
    ['TASK', { name: 'TASK', fields: [], rows: taskRows }],
    ['PROJWBS', { name: 'PROJWBS', fields: [], rows: wbsRows }],
    ['TASKPRED', { name: 'TASKPRED', fields: [], rows: relationRows }],
  ]),
  report: {
    encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [], unknownFields: [],
  },
  numberFormat: { decimal: '.', group: null, source: 'default', currencyCode: 'EUR' },
};
const index = indexXerProjectRows(tables);
const expectedVisits = taskRows.length + wbsRows.length + relationRows.length;
if (index.visitCount !== expectedVisits) {
  throw new Error(`lineaire index verwacht ${expectedVisits} bezoeken, kreeg ${index.visitCount}`);
}
for (const projectId of projects) {
  const counts = [
    index.tasksByProject.get(projectId)?.length,
    index.wbsByProject.get(projectId)?.length,
    index.relationsByProject.get(projectId)?.length,
  ];
  if (JSON.stringify(counts) !== JSON.stringify([100, 20, 30])) {
    throw new Error(`${projectId} verwacht [100,20,30], kreeg ${JSON.stringify(counts)}`);
  }
}

const blankRelationIndex = indexXerProjectRows({
  ...tables,
  tables: new Map([
    ['TASK', { name: 'TASK', fields: [], rows: [
      row(1, { proj_id: 'P1', task_id: 'A1' }), row(2, { proj_id: 'P1', task_id: 'B1' }),
      row(3, { proj_id: 'P2', task_id: 'A2' }), row(4, { proj_id: 'P2', task_id: 'B2' }),
    ] }],
    ['PROJWBS', { name: 'PROJWBS', fields: [], rows: [] }],
    ['TASKPRED', { name: 'TASKPRED', fields: [], rows: [
      row(5, { proj_id: '', pred_proj_id: '', task_id: 'B1', pred_task_id: 'A1' }),
    ] }],
  ]),
});
if (blankRelationIndex.relationsByProject.get('P1')?.length !== 1
    || blankRelationIndex.relationsByProject.get('P2')?.length !== undefined) {
  throw new Error('lege TASKPRED.proj_id moet via de reeds geïndexeerde lokale eindpunten bij P1 landen');
}

const reusedEndpointIndex = indexXerProjectRows({
  ...tables,
  tables: new Map([
    ['TASK', { name: 'TASK', fields: [], rows: [
      row(1, { proj_id: 'P1', task_id: 'A' }), row(2, { proj_id: 'P1', task_id: 'B' }),
      row(3, { proj_id: 'P2', task_id: 'A' }),
    ] }],
    ['PROJWBS', { name: 'PROJWBS', fields: [], rows: [] }],
    ['TASKPRED', { name: 'TASKPRED', fields: [], rows: [
      row(4, { proj_id: '', pred_proj_id: '', task_id: 'B', pred_task_id: 'A' }),
    ] }],
  ]),
});
if (reusedEndpointIndex.relationsByProject.get('P1')?.length !== 1
    || reusedEndpointIndex.relationsByProject.get('P2') !== undefined) {
  throw new Error('ongescopeerde A→B met alleen B uniek-lokaal moet uitsluitend aan P1 worden toegewezen');
}

const uniqueIntersectionIndex = indexXerProjectRows({
  ...tables,
  tables: new Map([
    ['TASK', { name: 'TASK', fields: [], rows: [
      row(1, { proj_id: 'P1', task_id: 'A' }), row(2, { proj_id: 'P1', task_id: 'B' }),
      row(3, { proj_id: 'P2', task_id: 'A' }), row(4, { proj_id: 'P3', task_id: 'B' }),
    ] }],
    ['PROJWBS', { name: 'PROJWBS', fields: [], rows: [] }],
    ['TASKPRED', { name: 'TASKPRED', fields: [], rows: [
      row(5, { proj_id: '', pred_proj_id: '', task_id: 'B', pred_task_id: 'A' }),
    ] }],
  ]),
});
if (uniqueIntersectionIndex.relationsByProject.get('P1')?.length !== 1
    || uniqueIntersectionIndex.relationsByProject.get('P2') !== undefined
    || uniqueIntersectionIndex.relationsByProject.get('P3') !== undefined
    || uniqueIntersectionIndex.relationResolutionIssues.length !== 0) {
  throw new Error('ongescopeerde A→B moet naar de unieke lokale doorsnede P1, ook als beide ids elders worden hergebruikt');
}

const ambiguousRows = Array.from({ length: 30 }, (_, index) => row(
  25 + index,
  { proj_id: '', pred_proj_id: '', task_id: 'B', pred_task_id: 'A', task_pred_id: `R${index + 1}` },
));
const ambiguousIndex = indexXerProjectRows({
  ...tables,
  tables: new Map([
    ['TASK', { name: 'TASK', fields: [], rows: projects.flatMap((projectId, index) => [
      row(index * 2 + 1, { proj_id: projectId, task_id: 'A' }),
      row(index * 2 + 2, { proj_id: projectId, task_id: 'B' }),
    ]) }],
    ['PROJWBS', { name: 'PROJWBS', fields: [], rows: [] }],
    ['TASKPRED', { name: 'TASKPRED', fields: [], rows: ambiguousRows }],
  ]),
});
const ambiguousFanout = Array.from(ambiguousIndex.relationsByProject.values())
  .reduce((sum, rows) => sum + rows.length, 0);
if (ambiguousIndex.visitCount !== 54 || ambiguousFanout !== 0
    || ambiguousIndex.relationResolutionIssues.length !== 30
    || ambiguousIndex.relationResolutionIssues.some(issue => issue.reason !== 'ambiguous')) {
  throw new Error(`30 ambigue ongescopeerde relaties mogen niet 360× uitwaaieren: bezoeken=${ambiguousIndex.visitCount}, fanout=${ambiguousFanout}, issues=${JSON.stringify(ambiguousIndex.relationResolutionIssues)}`);
}

const ambiguousXer = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  ...projects.map(projectId => `%R\t${projectId}\tProject ${projectId}`),
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  ...projects.flatMap(projectId => ['A', 'B'].map(taskId => `%R\t${taskId}\t${projectId}\t${taskId}\t${projectId}-${taskId}\t8\t8\t2026-08-03\t2026-08-03`)),
  '%T\tTASKPRED',
  '%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type',
  ...Array.from({ length: 30 }, (_, index) => `%R\tR${index + 1}\t\tB\t\tA\tPR_FS`),
  '%E',
];
let ambiguousError: unknown;
try {
  readXER(new TextEncoder().encode(ambiguousXer.join('\n')));
} catch (error) {
  ambiguousError = error;
}
if (!(ambiguousError instanceof XerImportError)
    || ambiguousError.xerCode !== 'XER_AMBIGUOUS_LOCAL_RELATION'
    || ambiguousError.table !== 'TASKPRED'
    || ambiguousError.field !== 'proj_id'
    || !ambiguousError.message.includes('niet één uniek lokaal project')) {
  throw new Error(`ambigue ongescopeerde relatie moet gericht typed falen: ${String(ambiguousError)}`);
}

const danglingXer = ambiguousXer.map(line => line.startsWith('%R\tR1\t')
  ? '%R\tR1\t\tB\t\tONTBREEKT\tPR_FS'
  : line).filter(line => !/^%R\tR(?:[2-9]|[12]\d|30)\t/.test(line));
let danglingError: unknown;
try {
  readXER(new TextEncoder().encode(danglingXer.join('\n')));
} catch (error) {
  danglingError = error;
}
if (!(danglingError instanceof XerImportError)
    || danglingError.xerCode !== 'XER_DANGLING_LOCAL_RELATION'
    || danglingError.table !== 'TASKPRED'
    || danglingError.field !== 'pred_task_id') {
  throw new Error(`dangling ongescopeerde relatie moet gericht typed falen: ${String(danglingError)}`);
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readerSource = readFileSync(join(root, 'src/services/xer/xerReader.ts'), 'utf8');
for (const fullScan of [
  "(tables.tables.get('TASK')?.rows ?? []).filter(row => row.cells.proj_id === projectId)",
  "(tables.tables.get('PROJWBS')?.rows ?? []).filter(row => row.cells.proj_id === projectId)",
  "(tables.tables.get('TASKPRED')?.rows ?? []).filter(row =>",
]) {
  if (readerSource.includes(fullScan)) {
    throw new Error(`P×M-terugval: readXerProject voert opnieuw een per-project full scan uit: ${fullScan}`);
  }
}

const taskFields = 'task_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date';
const xer = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  ...projects.map(projectId => `%R\t${projectId}\tProject ${projectId}`),
  '%T\tPROJWBS',
  '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
  ...projects.flatMap(projectId => wbsIds.map((wbsId, index) => `%R\t${wbsId}\t${projectId}\t\t${index + 1}\t${wbsId}\tWBS ${wbsId}`)),
  '%T\tTASK',
  `%F\t${taskFields}`,
  ...projects.flatMap(projectId => taskIds.map((taskId, index) => `%R\t${taskId}\t${projectId}\tW${(index % wbsIds.length) + 1}\t${taskId}\t${projectId}-${taskId}\t8\t8\t2026-08-03 08:00\t2026-08-03 16:00`)),
  '%T\tTASKPRED',
  '%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type',
  ...projects.flatMap(projectId => Array.from({ length: 30 }, (_, index) => `%R\tR${index + 1}\t${projectId}\tT${index + 2}\t${projectId}\tT${index + 1}\tPR_FS`)),
  '%E',
].join('\n');
const imported = readXER(new TextEncoder().encode(xer));
if (!isMultiDocumentImport(imported)) throw new Error('12-projectfixture gaf geen meervoudige import terug');
if (imported.documents.length !== 12) throw new Error(`12 projectdocumenten verwacht, kreeg ${imported.documents.length}`);
for (const document of imported.documents) {
  const leaves = document.result.tasks.filter(task => !task.isSummary);
  if (leaves.length !== 100 || document.result.sequences.length !== 30) {
    throw new Error(`${document.result.project.id} lekte of verloor rows: ${leaves.length} taken, ${document.result.sequences.length} relaties`);
  }
  if (leaves[0]?.p6TaskId !== 'T1' || leaves[0]?.name !== `${document.result.project.id}-T1`) {
    throw new Error(`${document.result.project.id} task_id-only projectfilter lekt identiteiten`);
  }
}

console.log(`OK XER-projectindex: 12 projecten, 1.200 gelijke task_id's, 240 WBS, 360 relaties, exact ${index.visitCount} bezoeken`);
