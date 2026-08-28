import { useAppStore } from '@/state/appStore';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import {
  createEmptyGridSelection,
  gridSelectionCells,
  reconcileGridSelection,
  updateGridSelection,
} from '@/engine/taskGrid/selection';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
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

const S = () => useAppStore.getState();
S().newProject();
const ids = Array.from({ length: 20 }, (_, index) => S().addTask({ name: `Taak ${index + 1}` }));
const tasks = new Map(S().tasks.map(task => [task.id, task]));
const taskRow = (taskId: string, rowKey = taskId): ViewRow => ({
  kind: 'task', rowKey, task: tasks.get(taskId)!, depth: 0, dimmed: false,
});
const groupRow = (rowKey: string): ViewRow => ({
  kind: 'group', rowKey, key: rowKey, label: 'Band', count: 2,
  depth: 0, levelIndex: 0, collapsed: false,
});
const columns = [taskColumnId('task.name'), taskColumnId('task.time.scheduleDuration'), taskColumnId('task.time.totalFloat')];
const cell = (rowKey: string, columnIndex: number) => ({ rowKey, columnId: columns[columnIndex] });
const indexed = (rows: readonly ViewRow[]) => createTaskGridRowIndex(rows);

// Gewone klik: één cel, één actieve taak, één geordende taakselectie.
{
  const rows = ids.slice(0, 3).map(id => taskRow(id));
  const selected = updateGridSelection(createEmptyGridSelection(), cell(ids[1], 1), indexed(rows), columns, 'replace');
  eq('Gewone klik zet actieve cel', selected.active, cell(ids[1], 1));
  eq('Gewone klik zet anker', selected.anchor, cell(ids[1], 1));
  eq('Gewone klik zet enkelvoudig bereik', selected.range, { start: cell(ids[1], 1), end: cell(ids[1], 1) });
  eq('Gewone klik selecteert taak', selected.selectedTaskIds, [ids[1]]);
  eq('Gewone klik zet actieve taak', selected.activeTaskId, ids[1]);
  eq('Herhaalde klik op dezelfde cel behoudt exact hetzelfde selectieobject',
    updateGridSelection(selected, cell(ids[1], 1), indexed(rows), columns, 'replace') === selected,
    true);
}

// De domeinsetter mag een byte-identieke selectie niet opnieuw publiceren. Anders renderen de
// volledige grid, statusbalk en eigenschappenrail opnieuw terwijl de gebruiker dezelfde cel klikt.
{
  S().selectTasks([ids[1]], false, ids[1]);
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const before = S();
  S().selectTasks([ids[1]], false, ids[1]);
  unsubscribe();
  eq('Identieke selectTasks-aanroep publiceert geen storewijziging', publications, 0);
  eq('Identieke selectTasks-aanroep behoudt dezelfde storestate', S() === before, true);
}

// Shift-rechthoek over een groepskop: kop draagt afstand maar levert geen taak/cellen.
{
  const rows = [taskRow(ids[0]), taskRow(ids[1]), groupRow('groep'), taskRow(ids[2])];
  const rowIndex = indexed(rows);
  const start = updateGridSelection(createEmptyGridSelection(), cell(ids[0], 0), rowIndex, columns, 'replace');
  const extended = updateGridSelection(start, cell(ids[2], 2), rowIndex, columns, 'extend');
  eq('Shift houdt eerste cel als anker', extended.anchor, cell(ids[0], 0));
  eq('Shift zet actieve eindcel', extended.active, cell(ids[2], 2));
  eq('Shift selecteert unieke taken rond groepskop', extended.selectedTaskIds, ids.slice(0, 3));
  eq('Groepskop levert geen klembordcellen', gridSelectionCells(extended, rowIndex, columns).length, 9);
  eq('Groepskop komt niet als rowKey in cellen', gridSelectionCells(extended, rowIndex, columns).some(item => item.rowKey === 'groep'), false);
}

// Dezelfde taak in twee groepen telt als twee occurrence-rijen maar één domeinselectie.
{
  const rows = [
    groupRow('g-a'), taskRow(ids[0], 'a/0'), taskRow(ids[1], 'a/1'),
    groupRow('g-b'), taskRow(ids[2], 'b/2'), taskRow(ids[1], 'b/1'),
  ];
  const rowIndex = indexed(rows);
  const start = updateGridSelection(createEmptyGridSelection(), cell('a/0', 0), rowIndex, columns, 'replace');
  const extended = updateGridSelection(start, cell('b/1', 1), rowIndex, columns, 'extend');
  eq('Duplicate occurrence selecteert taak-id eenmaal', extended.selectedTaskIds, [ids[0], ids[1], ids[2]]);
  eq('Duplicate occurrence blijft wel aparte cellen leveren', gridSelectionCells(extended, rowIndex, columns).length, 8);
}

// Ctrl/Cmd togglet alleen de taakset; de kopieerrechthoek wordt de aangeklikte enkelvoudige cel.
{
  const rows = ids.slice(0, 3).map(id => taskRow(id));
  const rowIndex = indexed(rows);
  let selected = updateGridSelection(createEmptyGridSelection(), cell(ids[0], 0), rowIndex, columns, 'replace');
  selected = updateGridSelection(selected, cell(ids[1], 2), rowIndex, columns, 'toggle-task');
  eq('Ctrl voegt taak achteraan toe', selected.selectedTaskIds, [ids[0], ids[1]]);
  eq('Ctrl maakt aangeklikte cel actief', selected.active, cell(ids[1], 2));
  eq('Ctrl houdt klembordbereik enkelvoudig', gridSelectionCells(selected, rowIndex, columns), [cell(ids[1], 2)]);
  selected = updateGridSelection(selected, cell(ids[0], 1), rowIndex, columns, 'toggle-task');
  eq('Ctrl haalt bestaande taak uit taakset', selected.selectedTaskIds, [ids[1]]);
  eq('Ctrl houdt aangeklikte taak actief voor eigenschappen', selected.activeTaskId, ids[0]);
}

// Twintig taken × alle kolommen: taakacties krijgen alle twintig ids, klembord zestig cellen.
{
  const rows = ids.map(id => taskRow(id));
  const rowIndex = indexed(rows);
  const start = updateGridSelection(createEmptyGridSelection(), cell(ids[0], 0), rowIndex, columns, 'replace');
  const selected = updateGridSelection(start, cell(ids[19], 2), rowIndex, columns, 'extend');
  eq('Bereik selecteert twintig taken', selected.selectedTaskIds, ids);
  eq('Bereik bevat alle zestig cellen', gridSelectionCells(selected, rowIndex, columns).length, 60);
}

// Reconciliatie mag de losse Ctrl/Cmd-taakset niet verwarren met de enkelvoudige kopieerrechthoek.
{
  const rows = ids.slice(0, 3).map(id => taskRow(id));
  const rowIndex = indexed(rows);
  let selected = updateGridSelection(
    createEmptyGridSelection(), cell(ids[0], 0), rowIndex, columns, 'replace',
  );
  selected = updateGridSelection(selected, cell(ids[1], 1), rowIndex, columns, 'toggle-task');
  eq('Reconcile behoudt Ctrl-additieve taakset bij identieke rijen',
    reconcileGridSelection(selected, rowIndex, rowIndex, columns, columns).selectedTaskIds,
    [ids[0], ids[1]]);

  const onlySecond = indexed([taskRow(ids[1])]);
  eq('Reconcile filtert alleen verdwenen taak uit Ctrl-additieve taakset',
    reconcileGridSelection(selected, rowIndex, onlySecond, columns, columns).selectedTaskIds,
    [ids[1]]);

  selected = updateGridSelection(selected, cell(ids[0], 2), rowIndex, columns, 'toggle-task');
  const reconciled = reconcileGridSelection(selected, rowIndex, rowIndex, columns, columns);
  eq('Reconcile respecteert dat actieve taak bewust uit Ctrl-taakset is getoggeld',
    reconciled.selectedTaskIds, [ids[1]]);
  eq('Reconcile houdt actieve taak voor eigenschappen ondanks toggle uit taakset',
    reconciled.activeTaskId, ids[0]);
}

// Reconciliatie: exact occurrence behouden, anders dichtstbijzijnde absolute taakrij/kolom.
{
  const previousRows = ids.slice(0, 4).map(id => taskRow(id));
  const previousIndex = indexed(previousRows);
  const original = updateGridSelection(createEmptyGridSelection(), cell(ids[1], 1), previousIndex, columns, 'replace');
  eq('Reconcile behoudt bestaande actieve cel',
    reconcileGridSelection(original, previousIndex, previousIndex, columns, columns).active,
    cell(ids[1], 1));

  const withoutActive = [taskRow(ids[0]), taskRow(ids[2]), taskRow(ids[3])];
  const rowFallback = reconcileGridSelection(original, previousIndex, indexed(withoutActive), columns, columns);
  eq('Verdwenen rij kiest dichtstbijzijnde absolute taakrij', rowFallback.active, cell(ids[2], 1));
  eq('Rijfallback zet passende actieve taak', rowFallback.activeTaskId, ids[2]);

  const fewerColumns = [columns[0], columns[2]];
  const columnFallback = reconcileGridSelection(original, previousIndex, previousIndex, columns, fewerColumns);
  eq('Verdwenen kolom kiest dichtstbijzijnde kolomindex', columnFallback.active, { rowKey: ids[1], columnId: columns[2] });

  eq('Nul datakolommen wist actieve cel',
    reconcileGridSelection(original, previousIndex, previousIndex, columns, []).active, null);
  eq('Nul taakrijen wist actieve cel',
    reconcileGridSelection(original, previousIndex, indexed([groupRow('alleen-groep')]), columns, columns).active, null);

  const duplicateRows = [taskRow(ids[0], 'band-a/taak'), taskRow(ids[0], 'band-b/taak')];
  const duplicate = updateGridSelection(
    createEmptyGridSelection(), cell('band-b/taak', 0), indexed(duplicateRows), columns, 'replace',
  );
  eq('Reconcile bewaart exacte duplicate occurrence via rowKey',
    reconcileGridSelection(duplicate, indexed(duplicateRows), indexed([...duplicateRows].reverse()), columns, columns).active,
    cell('band-b/taak', 0));
}

// De rij-index wordt buiten het commando gememoized: een gewone klik mag geen 50.000 rijen scannen.
{
  const rows: ViewRow[] = Array.from({ length: 50_000 }, (_, index) => ({
    kind: 'task', rowKey: `perf-${index}`, task: { id: `perf-task-${index}` } as Task,
    depth: 0, dimmed: false,
  }));
  const rowIndex = indexed(rows);
  let selected = createEmptyGridSelection();
  for (let index = 0; index < 20; index++) {
    selected = updateGridSelection(selected, cell('perf-25000', 0), rowIndex, columns, 'replace');
  }
  const startedAt = performance.now();
  for (let index = 0; index < 1_000; index++) {
    selected = updateGridSelection(selected, cell('perf-25000', 0), rowIndex, columns, 'replace');
  }
  const elapsed = performance.now() - startedAt;
  eq(`1.000 enkelvoudige selecties op 50.000 rijen blijven onder 100 ms (${elapsed.toFixed(1)} ms)`,
    elapsed < 100, true);
}

if (diffs.length > 0) {
  console.error(`FAIL task-grid-selection: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  task-grid-selection: ${checks}/${checks}`);
}
