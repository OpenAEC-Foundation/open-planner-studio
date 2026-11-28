import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { computeViewRows, type ViewContext, type ViewRowOpts } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function read(lines: readonly string[]): XerReadResult {
  const parsed = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(parsed)) throw new Error('Enkelprojectfixture gaf een meervoudige import terug');
  return parsed;
}

const w = (id: string) => `xer-wbs:P1:${id}`;

const merWbsRows = {
  w1: '%R\t1\tP1\t0\t1\tMER.W01\tWBS 01',
  w2: '%R\t2\tP1\t1\t2\tMER.W02\tWBS 02',
  w10: '%R\t10\tP1\t1\t2\tMER.W10\tWBS 10',
} as const;

function merFixture(wbsOrder: readonly (keyof typeof merWbsRows)[]): string[] {
  return [
    'ERMHDR\t8.4\t2026-07-18\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_data',
    '%R\tC1\tStandaard\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP1\tBoom\tC1\t2026-01-05 08:00',
    '%T\tPROJWBS',
    '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    ...wbsOrder.map(key => merWbsRows[key]),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA1\tP1\t1\tA-1\tTaak 1\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tA2\tP1\t2\tA-2\tTaak 2\t16\t2026-01-06 08:00\t2026-01-07 16:00',
    '%R\tA3\tP1\t10\tA-3\tTaak 3\t8\t2026-01-08 08:00\t2026-01-08 16:00',
    '%R\tA4\tP1\t1\tA-4\tTaak 4\t8\t2026-01-09 08:00\t2026-01-09 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tA2\tA1\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tA3\tA2\tP1\tP1\tPR_FS\t0',
    '%R\tR3\tA4\tA3\tP1\tP1\tPR_FS\t0',
    '%E',
  ];
}

const mer = read(merFixture(['w1', 'w2', 'w10']));
const merIds = new Set(mer.tasks.map(task => task.id));
const merById = new Map(mer.tasks.map(task => [task.id, task]));

eq('1 geen parentId wijst naar een niet-bestaande taak',
  mer.tasks.filter(task => task.parentId && !merIds.has(task.parentId)).map(task => `${task.id}->${task.parentId}`),
  []);
eq('2 de bovenste WBS is een wortel: ouder 0 is de projectknoop, geen taak',
  merById.get(w('1'))?.parentId, null);
eq('3 boomvolgorde: elke activiteit direct onder haar WBS, WBS 2 vóór WBS 10 (numeriek bij gelijke seq_num)',
  mer.tasks.map(task => task.id),
  [w('1'), w('2'), 'A2', w('10'), 'A3', 'A1', 'A4']);
eq('4 childIds volgen dezelfde siblingvolgorde als de array (eerst WBS, dan activiteiten)',
  [merById.get(w('1'))?.childIds, merById.get(w('2'))?.childIds, merById.get(w('10'))?.childIds],
  [[w('2'), w('10'), 'A1', 'A4'], ['A2'], ['A3']]);
eq('5 de volgorde hangt niet af van de PROJWBS-rijvolgorde in het bestand',
  read(merFixture(['w10', 'w2', 'w1'])).tasks.map(task => task.id),
  mer.tasks.map(task => task.id));

const solved = mer.tasks.map(task => ({ ...task, time: { ...task.time } }));
solveProject(solveInputFor(mer.project, solved, mer.sequences, mer.calendar, mer.resourceCalendars ?? []));
const solvedById = new Map(solved.map(task => [task.id, task]));
const span = (id: string) => {
  const time = solvedById.get(id)?.time;
  return [time?.earlyStart, time?.earlyFinish];
};
eq('6 rollup: WBS 01 loopt van de start van A1 tot het einde van A4',
  span(w('1')), [span('A1')[0], span('A4')[1]]);
eq('7 rollup: WBS 02 en WBS 10 dragen de span van hun eigen activiteit',
  [span(w('2')), span(w('10'))], [span('A2'), span('A3')]);
eq('8 rollup: geen samenvatting houdt duur 0',
  [w('1'), w('2'), w('10')].map(id => (solvedById.get(id)?.time.scheduleDuration ?? 0) > 0),
  [true, true, true]);

const ctx: ViewContext = { activityCodeTypes: [], customFieldDefs: [], resources: [], assignments: [], noneLabel: '(geen)' };
const treeOpts = (collapsed: readonly string[]): ViewRowOpts => ({
  filter: null, group: [], sort: [], collapsedTaskIds: new Set(collapsed), collapsedGroupKeys: new Set(),
});
const gridRows = (tasks: Task[], collapsed: readonly string[]) => computeViewRows(tasks, treeOpts(collapsed), ctx)
  .flatMap(row => row.kind === 'task' ? [`${row.task.id}@${row.depth}`] : []);
eq('9 raster: WBS 02/10 springen in onder WBS 01, activiteiten onder hun WBS',
  gridRows(mer.tasks, []),
  [`${w('1')}@0`, `${w('2')}@1`, 'A2@2', `${w('10')}@1`, 'A3@2', 'A1@1', 'A4@1']);
eq('10 raster: WBS 02 inklappen verbergt alleen zijn activiteit',
  gridRows(mer.tasks, [w('2')]),
  [`${w('1')}@0`, `${w('2')}@1`, `${w('10')}@1`, 'A3@2', 'A1@1', 'A4@1']);
eq('11 raster: WBS 01 inklappen verbergt de hele boom eronder',
  gridRows(mer.tasks, [w('1')]), [`${w('1')}@0`]);

const p6 = read([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tP6-export',
  '%T\tPROJWBS',
  '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\tproj_node_flag\twbs_short_name\twbs_name',
  '%R\t9002\tP1\t9001\t10\tN\tUIT\tUitvoering',
  '%R\t9001\tP1\t9000\t0\tY\tP6X\tP6-export',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
  '%R\tB1\tP1\t9002\tB-1\tFundering\t2026-01-05\t2026-01-06',
  '%R\tB2\tP1\t9001\tB-2\tOplevering\t2026-01-07\t2026-01-08',
  '%R\tB3\tP1\t9999\tB-3\tLosse taak\t2026-01-07\t2026-01-08',
  '%E',
]);
const p6Ids = new Set(p6.tasks.map(task => task.id));
eq('12 P6-projectknoop met EPS-ouder buiten het bestand is een wortel',
  p6.tasks.filter(task => !task.parentId).map(task => task.id), [w('9001'), 'B3']);
eq('13 activiteit onder een onbekende WBS krijgt geen loze parentId',
  p6.tasks.filter(task => task.parentId && !p6Ids.has(task.parentId)).map(task => task.id), []);
eq('14 P6-export in boomvolgorde',
  p6.tasks.map(task => `${task.id}<${task.parentId ?? '-'}`),
  [`${w('9001')}<-`, `${w('9002')}<${w('9001')}`, `B1<${w('9002')}`, `B2<${w('9001')}`, 'B3<-']);

if (diffs.length > 0) {
  console.error(`XER-WBS-boom: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-WBS-boom: ${checks} checks (wortel, numerieke siblingvolgorde, boomvolgorde, rollup, raster)`);
