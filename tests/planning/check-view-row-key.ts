// Tabel-overhaul Task 1: iedere zichtbare rij heeft een stabiele occurrence-key. De hostile
// fixture gebruikt bewust een taak-id die gelijk is aan de rauwe sleutel van een geneste
// resourceband. Een groepskey (JSON-array) en taak-occurrencekey (JSON-object) mogen daardoor
// nooit botsen. Deze check draait de echte computeViewRows- en storeselectieroutes.
import './domStub';
import * as visibleRows from '@/engine/view/visibleRows';
import * as viewSlice from '@/state/slices/viewSlice';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { FilterNode, GroupLevel } from '@/types/view';
import type { ViewContext, ViewRow, ViewRowOpts } from '@/engine/view/visibleRows';

type TaskViewRow = Extract<ViewRow, { kind: 'task' }>;
type TaskRowCursor = { rowKey: string; rowIndex: number };
type OccurrenceApi = {
  taskRowsInRange: (
    rows: readonly ViewRow[],
    fromRowKey: string,
    toRowKey: string,
  ) => TaskViewRow[];
  uniqueTaskIds: (rows: readonly ViewRow[]) => string[];
  normalizeTaskRowCursor: (
    rows: readonly ViewRow[],
    cursor: TaskRowCursor | null,
  ) => TaskRowCursor | null;
};
type FocusOccurrenceApi = {
  resolveFirstVisibleFocusOccurrence: (
    rows: readonly ViewRow[],
    taskId: string,
  ) => { taskId: string; rowKey: string; rowIndex: number } | null;
};

const occurrenceApi = visibleRows as typeof visibleRows & Partial<OccurrenceApi>;
const focusOccurrenceApi = viewSlice as typeof viewSlice & Partial<FocusOccurrenceApi>;
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

function task(id: string, name = id): Task {
  return {
    id,
    name,
    wbsCode: id,
    parentId: null,
    childIds: [],
  } as unknown as Task;
}

function opts(group: GroupLevel[] = [], filter: FilterNode | null = null): ViewRowOpts {
  return {
    filter,
    group,
    sort: [],
    collapsedTaskIds: new Set(),
    collapsedGroupKeys: new Set(),
  };
}

const ctx: ViewContext = {
  activityCodeTypes: [],
  customFieldDefs: [],
  resources: [],
  assignments: [],
  noneLabel: '(geen)',
};

// Boommodus: de domein-id is al occurrence-veilig en blijft exact de rowKey.
{
  const rows = visibleRows.computeViewRows([task('boom-a'), task('boom-b')], opts(), ctx);
  eq('01 boomtaken gebruiken exact task.id als rowKey', rows.map(row => row.rowKey), ['boom-a', 'boom-b']);
}

// Geneste resourcegroepering: dezelfde taak komt in twee banden voor. De taak-id is bewust gelijk
// aan de raw key van de tweede band om een simpele stringconcatenatie/ongecodeerde key te breken.
const hostileTaskId = 'Ploeg B';
const groupedTask = task(hostileTaskId, 'Fundering');
const resources: Resource[] = [
  { id: 'r-a', name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 4 },
  { id: 'r-b', name: hostileTaskId, type: 'CREW', description: '', maxUnits: 4 },
];
const assignments = [
  { taskId: hostileTaskId, resourceId: 'r-a' } as ResourceAssignment,
  { taskId: hostileTaskId, resourceId: 'r-b' } as ResourceAssignment,
];
const groupedCtx: ViewContext = { ...ctx, resources, assignments };
const grouping: GroupLevel[] = [
  { field: { src: 'builtin', key: 'name' }, dir: 'asc' },
  { field: { src: 'resource' }, dir: 'asc' },
];
const groupedRows = visibleRows.computeViewRows([groupedTask], opts(grouping), groupedCtx);
const groupRows = groupedRows.filter((row): row is Extract<ViewRow, { kind: 'group' }> => row.kind === 'group');
const taskRows = groupedRows.filter((row): row is TaskViewRow => row.kind === 'task');
const expectedTaskKeys = [
  JSON.stringify({ kind: 'task', groupPath: ['Fundering', 'Ploeg A'], taskId: hostileTaskId }),
  JSON.stringify({ kind: 'task', groupPath: ['Fundering', hostileTaskId], taskId: hostileTaskId }),
];

eq('02 iedere groepsrij gebruikt exact zijn bestaande group.key als rowKey',
  groupRows.map(row => row.rowKey), groupRows.map(row => row.key));
eq('03 dubbele resource-occurrences krijgen exact de raw-groupPath-objectencoding',
  taskRows.map(row => row.rowKey), expectedTaskKeys);
ok('04 dezelfde taak in twee resourcebanden moet twee verschillende rowKeys hebben',
  new Set(taskRows.map(row => row.rowKey)).size === 2);
ok('05 hostile task-id/raw-groupkeycase houdt alle task- en group-rowKeys uniek',
  new Set(groupedRows.map(row => row.rowKey)).size === groupedRows.length);

if (typeof focusOccurrenceApi.resolveFirstVisibleFocusOccurrence !== 'function') {
  ok('06 viewSlice-focusresolver ontbreekt', false);
} else {
  eq('06 focusOnTask houdt taskId als domeindoel en benoemt lokaal de eerste zichtbare rowKey',
    focusOccurrenceApi.resolveFirstVisibleFocusOccurrence(groupedRows, hostileTaskId),
    { taskId: hostileTaskId, rowKey: expectedTaskKeys[0], rowIndex: 2 });
}

// Een occurrence-range omvat beide zichtbare taakrijen; de afgeleide domeinselectie dedupliceert id.
if (typeof occurrenceApi.taskRowsInRange !== 'function' || typeof occurrenceApi.uniqueTaskIds !== 'function') {
  ok('07 occurrence-range/deduplicatieprimitive ontbreekt', false);
} else {
  const rangeRows = occurrenceApi.taskRowsInRange(groupedRows, expectedTaskKeys[0], expectedTaskKeys[1]);
  eq('07 occurrence-range behoudt alle zichtbare taakvoorkomens',
    rangeRows.map(row => row.rowKey), expectedTaskKeys);
  eq('08 selectedTaskIds uit dat bereik bevat dezelfde taak-id één keer',
    occurrenceApi.uniqueTaskIds(rangeRows), [hostileTaskId]);
}

// De echte Ctrl/Cmd+A-route moet dezelfde domeindeduplicatie toepassen.
{
  const S = () => useAppStore.getState();
  S().newProject();
  const resourceA = S().addResource({ name: 'Band A', type: 'CREW', description: '', maxUnits: 4 });
  const resourceB = S().addResource({ name: 'Band B', type: 'CREW', description: '', maxUnits: 4 });
  const taskId = S().addTask({ name: 'Dubbel zichtbaar' });
  S().assignResource(taskId, resourceA, 1);
  S().assignResource(taskId, resourceB, 1);
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  S().selectAllTasks();
  eq('09 echte selectedTaskIds dedupliceert dubbele zichtbare occurrences', S().selectedTaskIds, [taskId]);
  S().selectTasks([taskId, taskId], false);
  eq('09b selectedTaskIds bewaakt deduplicatie ook op de box/range-setter', S().selectedTaskIds, [taskId]);
}

// Collapse verwijdert het actieve voorkomen. De cursor houdt zijn oude absolute rijindex als
// nabijheidsanker en kiest de dichtstbijzijnde overgebleven taakrij. Zonder taakrij wordt hij leeg.
if (typeof occurrenceApi.normalizeTaskRowCursor !== 'function') {
  ok('10 cursor-normalisatieprimitive ontbreekt', false);
} else {
  const oldIndex = groupedRows.findIndex(row => row.rowKey === expectedTaskKeys[0]);
  const collapsed = opts(grouping);
  collapsed.collapsedGroupKeys = new Set([JSON.stringify(['Fundering', 'Ploeg A'])]);
  const collapsedRows = visibleRows.computeViewRows([groupedTask], collapsed, groupedCtx);
  const normalized = occurrenceApi.normalizeTaskRowCursor(
    collapsedRows,
    { rowKey: expectedTaskKeys[0], rowIndex: oldIndex },
  );
  eq('10 collapse kiest de dichtstbijzijnde geldige taakoccurrence in absolute rijvolgorde',
    normalized?.rowKey, expectedTaskKeys[1]);

  const impossibleFilter: FilterNode = {
    kind: 'rule',
    field: { src: 'builtin', key: 'name' },
    operator: 'eq',
    value: 'bestaat niet',
  };
  const filteredRows = visibleRows.computeViewRows([groupedTask], opts(grouping, impossibleFilter), groupedCtx);
  eq('11 filter zonder overgebleven taakcel maakt de gridcursor leeg',
    occurrenceApi.normalizeTaskRowCursor(filteredRows, normalized), null);
}

if (diffs.length === 0) {
  console.log(`OK  view-row-key: alle checks groen (${checks})`);
  process.exit(0);
}

console.log(`XX  view-row-key: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
