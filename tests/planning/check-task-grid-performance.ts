import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { DataGridCore } from '@/components/task-grid/DataGridCore';
import type { DataGridColumnModel, DataGridRowModel } from '@/components/task-grid/taskGridContext';
import type { GridSelectionState } from '@/engine/taskGrid/selection';
import {
  TASK_GRID_PERFORMANCE_BUDGETS,
  TASK_GRID_PERFORMANCE_COUNTS,
  createTaskGridPerformanceFixture,
  runTaskGridPerformanceBenchmark,
} from './taskGridPerformanceHarness';

const failures: string[] = [];
let checks = 0;
const relaxed = process.env.OPS_RELAX_PERF === '1';

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) failures.push(label);
}

const fixture = createTaskGridPerformanceFixture();
eq('Generator maakt exact 50.000 zichtbare taakrijen', fixture.rows.length, 50_000);
eq('Generator maakt exact 24 zichtbare kolommen', fixture.columns.length, 24);
eq('Generator maakt exact 100.000 interne relaties', fixture.sequences.length, 100_000);
eq('Selectie-adapterfixture gebruikt exact 3.000 taken en 2.999 relaties', [
  fixture.counts.selectionAdapterTaskCount,
  fixture.counts.selectionAdapterRelationCount,
], [3_000, 2_999]);
eq('Generator publiceert de canonieke aantallen', fixture.counts, TASK_GRID_PERFORMANCE_COUNTS);
eq('Generator houdt een stabiele controlevingerafdruk', fixture.fingerprint,
  'task-0|task-49999|sequence-0:task-0>task-1|sequence-99999:task-49999>task-1');

const result = runTaskGridPerformanceBenchmark(fixture);
eq('Iedere tijdmeting gebruikt exact twee warmups', result.warmups, 2);
eq('Iedere tijdmeting gebruikt exact negen meetruns', result.runs, 9);
for (const [name, samples] of Object.entries(result.samplesMs) as Array<[string, number[]]>) {
  eq(`${name} bewaart negen ruwe meetwaarden`, samples.length, 9);
  ok(`${name} bevat uitsluitend eindige niet-negatieve tijden`,
    samples.every(sample => Number.isFinite(sample) && sample >= 0));
}

const mountedRowBudget = Math.ceil(
  TASK_GRID_PERFORMANCE_COUNTS.viewportHeight / TASK_GRID_PERFORMANCE_COUNTS.rowHeight,
) + 16;
ok(`Gemounte rijen blijven binnen ${mountedRowBudget}`, result.mountedRows <= mountedRowBudget);
ok('Gemounte datacellen blijven binnen gemounte rijen maal 24',
  result.mountedDataCells <= result.mountedRows * TASK_GRID_PERFORMANCE_COUNTS.columnCount);

// Tel na de tijdmetingen de echte servermarkup. Zo blijft de timing vrij van React-opstartkosten,
// maar zijn de DOM-budgetten geen afleiding die zichzelf per definitie gelijk geeft.
const gridRows: DataGridRowModel[] = fixture.rows.map(row => ({
  kind: 'data', rowKey: row.rowKey, depth: row.kind === 'task' ? row.depth : 0,
}));
const gridColumns: DataGridColumnModel[] = fixture.columns.map((id, index) => ({
  id, label: `Kolom ${index + 1}`, width: 100, pinned: index < 2,
}));
const gridSelection: GridSelectionState = {
  active: { rowKey: 'task-25000', columnId: fixture.columns[12] },
  anchor: { rowKey: 'task-25000', columnId: fixture.columns[12] },
  range: {
    start: { rowKey: 'task-25000', columnId: fixture.columns[12] },
    end: { rowKey: 'task-25000', columnId: fixture.columns[12] },
  },
  selectedTaskIds: ['task-25000'],
  activeTaskId: 'task-25000',
};
const markup = renderToStaticMarkup(createElement(DataGridCore, {
  rows: gridRows,
  columns: gridColumns,
  selection: gridSelection,
  rowHeight: TASK_GRID_PERFORMANCE_COUNTS.rowHeight,
  headerHeight: 28,
  viewportHeight: TASK_GRID_PERFORMANCE_COUNTS.viewportHeight,
  viewportWidth: 1_200,
  scrollTop: 25_000 * TASK_GRID_PERFORMANCE_COUNTS.rowHeight + 7,
  getCell: (row, column) => ({ text: `${row.rowKey}:${column.id}`, readOnly: false }),
  labels: {
    grid: 'Performance-taakgrid',
    collapseGroup: label => `${label} inklappen`,
    expandGroup: label => `${label} uitklappen`,
    resizeColumn: label => `${label} formaat`,
    removeColumn: label => `${label} verwijderen`,
    pinColumn: 'Links vastzetten',
    unpinColumn: 'Losmaken',
    autoFitColumn: 'Breedte automatisch',
  },
}));
const actualMountedRows = markup.split('data-grid-data-row=').length - 1;
const actualMountedDataCells = markup.split('data-grid-data-cell=').length - 1;
eq('Echte DataGridCore-markup monteert exact het berekende aantal rijen', actualMountedRows, result.mountedRows);
eq('Echte DataGridCore-markup monteert exact het berekende aantal datacellen',
  actualMountedDataCells, result.mountedDataCells);

if (!relaxed) {
  ok(`relationIndex-mediaan blijft <= ${TASK_GRID_PERFORMANCE_BUDGETS.relationIndexMs} ms`,
    result.mediansMs.relationIndex <= TASK_GRID_PERFORMANCE_BUDGETS.relationIndexMs);
  ok(`1.000 navigatiecommando's blijven <= ${TASK_GRID_PERFORMANCE_BUDGETS.commandBatchMs} ms`,
    result.mediansMs.navigationCommands <= TASK_GRID_PERFORMANCE_BUDGETS.commandBatchMs);
  ok(`1.000 selectiecommando's blijven <= ${TASK_GRID_PERFORMANCE_BUDGETS.commandBatchMs} ms`,
    result.mediansMs.selectionCommands <= TASK_GRID_PERFORMANCE_BUDGETS.commandBatchMs);
  ok(`selectie→adapterprojectie blijft <= ${TASK_GRID_PERFORMANCE_BUDGETS.selectionAdapterMs} ms`,
    result.mediansMs.selectionAdapter <= TASK_GRID_PERFORMANCE_BUDGETS.selectionAdapterMs);
  ok(`virtual-windowberekening blijft <= ${TASK_GRID_PERFORMANCE_BUDGETS.virtualWindowMs} ms`,
    result.mediansMs.virtualWindow <= TASK_GRID_PERFORMANCE_BUDGETS.virtualWindowMs);
} else {
  console.log(`MEASURE task-grid-performance ${JSON.stringify({
    counts: result.counts,
    mediansMs: result.mediansMs,
    mountedRows: result.mountedRows,
    mountedDataCells: result.mountedDataCells,
  })}`);
}

const measurementLine = `medianen ms: relationIndex=${result.mediansMs.relationIndex.toFixed(2)}, navigatie=${result.mediansMs.navigationCommands.toFixed(2)}, selectie=${result.mediansMs.selectionCommands.toFixed(2)}, selectieAdapter=${result.mediansMs.selectionAdapter.toFixed(2)}, virtualWindow=${result.mediansMs.virtualWindow.toFixed(3)}`;

if (failures.length > 0) {
  console.error(`FAIL task-grid-performance: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  console.error(`   ${measurementLine}`);
  process.exit(1);
}

console.log(`OK task-grid-performance: ${checks}/${checks} (${relaxed ? 'alleen meten' : 'poorten actief'})`);
console.log(`   ${measurementLine}`);
process.exit(0);
