import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMultiDocumentImport } from '@/services/importTypes';
import { indexXerProjectRows, readXER } from '@/services/xer/xerReader';
import type { XerRow, XerTables } from '@/services/xer/xerTables';

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
  report: { encoding: 'utf-8', endMarkerSeen: true, issues: [], unknownTables: [] },
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
