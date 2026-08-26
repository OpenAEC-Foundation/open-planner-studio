import { readFileSync, readdirSync } from 'node:fs';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

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

const task = {
  id: 't-1', name: 'Fundering', description: 'Beton', wbsCode: '1.1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: [], activityCodes: {}, customFields: {},
  time: {
    durationType: 'WORKTIME', scheduleDuration: 5, scheduleStart: '2026-01-01',
    scheduleFinish: '2026-01-07', earlyStart: '2026-01-01', earlyFinish: '2026-01-07',
    lateStart: '2026-01-01', lateFinish: '2026-01-07', freeFloat: 0, totalFloat: 0,
    isCritical: true, completion: 0,
  },
} as Task;
const rows: ViewRow[] = [
  { kind: 'group', rowKey: 'groep-a', key: 'groep-a', label: 'Ploeg A', count: 1, depth: 0, levelIndex: 0, collapsed: false },
  { kind: 'task', rowKey: 'occurrence-a', task, depth: 1, dimmed: false },
  { kind: 'group', rowKey: 'groep-b', key: 'groep-b', label: 'Ploeg B', count: 1, depth: 0, levelIndex: 0, collapsed: false },
  { kind: 'task', rowKey: 'occurrence-b', task, depth: 1, dimmed: true },
];

const baseInput = {
  projectId: 'project-1', rows, tasks: [task], sequences: [], assignments: [], resources: [],
  baselines: [], activityCodeTypes: [], customFieldDefs: [], scheduleStale: true,
  wbsAutoNumber: false, selectedTaskIds: ['t-1'],
  labelForColumn: (key: string) => key,
  trace: {
    focusId: 't-1', predecessors: [], drivingPredecessors: [], successors: [], drivenSuccessors: [],
  },
};
const gantt = createTaskGridAdapter({ ...baseInput, surfaceId: 'gantt-task-grid' });
const table = createTaskGridAdapter({ ...baseInput, surfaceId: 'full-task-grid' });
const personalDates = createTaskGridAdapter({
  ...baseInput, surfaceId: 'full-task-grid', dateNotation: 'dmy',
});
const englishBooleans = createTaskGridAdapter({
  ...baseInput,
  surfaceId: 'full-task-grid',
  labelForBoolean: value => value ? 'Yes' : 'No',
});

eq('Beide surfaces krijgen exact dezelfde rijprojectie', gantt.rows, table.rows);
eq('Beide surfaces krijgen exact dezelfde beschikbare kolommen', gantt.availableColumns, table.availableColumns);
for (const columnId of ['task.name', 'task.time.scheduleDuration', 'task.time.totalFloat']) {
  eq(`${columnId}: beide surfaces lezen dezelfde cel`,
    gantt.getCell('occurrence-a', taskColumnId(columnId)),
    table.getCell('occurrence-a', taskColumnId(columnId)));
}
eq('Groepsrijmeta blijft expliciet', gantt.rowMetaByKey.get('groep-a'), {
  rowKey: 'groep-a', kind: 'group', depth: 0, selected: false, traceClass: null,
});
eq('Taakrijmeta draagt occurrence, taak, dimming, selectie, trace en gedeelde tooltiptaak',
  gantt.rowMetaByKey.get('occurrence-b'), {
    rowKey: 'occurrence-b', taskId: 't-1', kind: 'task', depth: 1, dimmed: true,
    selected: true, traceClass: 'task-grid-trace-focus', tooltipData: { task },
  });
eq('Twee occurrences lezen rechtstreeks dezelfde taakwaarde', [
  gantt.getCell('occurrence-a', taskColumnId('task.name'))?.text,
  gantt.getCell('occurrence-b', taskColumnId('task.name'))?.text,
], ['Fundering', 'Fundering']);
const committedTask = { ...task, name: 'Nieuwe naam' };
const refreshed = createTaskGridAdapter({
  ...baseInput,
  surfaceId: 'full-task-grid',
  tasks: [committedTask],
  rows: rows.map(row => row.kind === 'task' ? { ...row, task: committedTask } : row),
});
eq('Eén immutable storecommit ververst alle occurrences uit hetzelfde taakobject', [
  refreshed.getCell('occurrence-a', taskColumnId('task.name'))?.text,
  refreshed.getCell('occurrence-b', taskColumnId('task.name'))?.text,
], ['Nieuwe naam', 'Nieuwe naam']);
eq('Berekende cel meldt stale zowel visueel als toegankelijk', (() => {
  const cell = gantt.getCell('occurrence-a', taskColumnId('task.time.totalFloat'));
  return { stale: cell?.stale, statusText: cell?.statusText };
})(), { stale: true, statusText: 'taskGrid.status.stale' });
eq('Boolean-editor krijgt een taalneutrale canonieke startwaarde',
  personalDates.getCell('occurrence-a', taskColumnId('task.isMilestone'))?.editText,
  'false');
eq('Booleans krijgen voor schermweergave het locale label van de surface',
  englishBooleans.getCell('occurrence-a', taskColumnId('task.isMilestone'))?.text,
  'No');
eq('Datumeditor start in de persoonlijke notatie',
  personalDates.getCell('occurrence-a', taskColumnId('task.time.scheduleStart'))?.editText,
  '01-01-2026');
const personalDatePlan = personalDates.planEdit(
  'occurrence-a', taskColumnId('task.time.scheduleStart'), '07-01-2026',
);
eq('Persoonlijke datuminvoer wordt vóór het intent teruggebracht naar ISO',
  personalDatePlan.ok ? personalDatePlan.value[0] : personalDatePlan,
  {
    kind: 'cell-edit', taskId: 't-1', columnId: 'task.time.scheduleStart',
    route: 'task-schedule', value: '2026-01-07',
  });

const namePlan = gantt.planEdit('occurrence-a', taskColumnId('task.name'), 'Nieuwe naam');
eq('Descriptorparser en writer leveren het domeinintent zonder store-actienaam', namePlan.ok ? namePlan.value : namePlan, [{
  kind: 'cell-edit', taskId: 't-1', columnId: 'task.name', route: 'task-field', value: 'Nieuwe naam',
}]);
const readonlyPlan = gantt.planEdit('occurrence-a', taskColumnId('task.time.totalFloat'), '4');
eq('Read-only descriptor weigert editplanning vóór een storemutatie',
  readonlyPlan.ok ? null : readonlyPlan.errors[0]?.code, 'readOnly');
eq('Onbekende occurrence wordt gericht geweigerd',
  gantt.planEdit('verdwenen', taskColumnId('task.name'), 'x').ok, false);

const engineSources = readdirSync('src/engine/taskGrid').filter(name => name.endsWith('.ts'));
for (const source of engineSources) {
  ok(`${source}: engine importeert appStore niet`,
    !readFileSync(`src/engine/taskGrid/${source}`, 'utf8').includes("from '@/state/appStore'"));
}
const componentSources = readdirSync('src/components/task-grid').filter(name => /\.tsx?$/.test(name));
for (const source of componentSources) {
  const text = readFileSync(`src/components/task-grid/${source}`, 'utf8');
  ok(`${source}: taakgrid importeert geen resourcepanelen`,
    !text.includes('ResourcePanel') && !text.includes('ResourcePanelCompact'));
}

if (diffs.length) {
  console.error(`FAIL task-grid-adapter: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  task-grid-adapter: ${checks}/${checks}`);
