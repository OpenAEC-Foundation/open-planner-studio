import { renderToStaticMarkup } from 'react-dom/server.browser';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataGridCore } from '@/components/task-grid/DataGridCore';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { computeVirtualWindow } from '@/engine/taskGrid/virtualization';
import type { DataGridColumnModel, DataGridRowModel } from '@/components/task-grid/taskGridContext';
import type { GridSelectionState } from '@/engine/taskGrid/selection';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function count(markup: string, token: string): number {
  return markup.split(token).length - 1;
}

const totalRows = 50_000;
const rowHeight = 36;
const viewportHeight = 900;
const scrollTop = 20_000 * rowHeight + 17;
const rows: DataGridRowModel[] = Array.from({ length: totalRows }, (_, index) => ({
  kind: 'data' as const,
  rowKey: `row-${index}`,
  depth: 0,
}));
const columns: DataGridColumnModel[] = Array.from({ length: 24 }, (_, index) => ({
  id: taskColumnId(`column-${index}`),
  label: `Kolom ${index}`,
  width: 100,
  pinned: index < 2,
}));
const selection: GridSelectionState = {
  active: { rowKey: 'row-20000', columnId: columns[0].id },
  anchor: { rowKey: 'row-20000', columnId: columns[0].id },
  range: {
    start: { rowKey: 'row-20000', columnId: columns[0].id },
    end: { rowKey: 'row-20000', columnId: columns[0].id },
  },
  selectedTaskIds: [], activeTaskId: null,
};
const virtual = computeVirtualWindow({ totalRows, rowHeight, viewportHeight, scrollTop });
const markup = renderToStaticMarkup(createElement(DataGridCore, {
    rows,
    columns,
    selection,
    rowHeight,
    headerHeight: 28,
    viewportHeight,
    viewportWidth: 1200,
    scrollTop,
    getCell: (row, column) => ({ text: `${row.rowKey}:${column.id}`, readOnly: false }),
    labels: {
      grid: 'Takenraster',
      collapseGroup: label => `${label} inklappen`,
      expandGroup: label => `${label} uitklappen`,
      resizeColumn: label => `${label} breder of smaller maken`,
      removeColumn: label => `${label} verwijderen`,
      pinColumn: 'Links vastzetten',
      unpinColumn: 'Links losmaken',
      autoFitColumn: 'Breedte automatisch',
    },
  }));

const mountedRows = virtual.endIndexExclusive - virtual.startIndex;
eq('Pure virtualisatie blijft binnen het vaste rijbudget', virtual.mountedRows.length <= Math.ceil(viewportHeight / rowHeight) + 16, true);
eq('Servermarkup bevat uitsluitend gemounte taakrijen', count(markup, 'data-grid-data-row='), mountedRows);
eq('Servermarkup bevat maximaal gemounte rijen maal 24 datacellen', count(markup, 'data-grid-data-cell='), mountedRows * 24);
eq('Niet-gemounte eerste rij ontbreekt werkelijk uit de DOM', markup.includes('row-0:column-0'), false);
eq('Actieve absolute rij staat wel in de DOM', markup.includes('row-20000:column-0'), true);
eq('ARIA-rowcount rapporteert toch alle 50.000 rijen plus header', markup.includes('aria-rowcount="50001"'), true);
eq('Topspacer is exact de pure virtualisatie-uitkomst', markup.includes(`data-grid-top-spacer="${virtual.topSpacerHeight}"`), true);
eq('Bottomspacer is exact de pure virtualisatie-uitkomst', markup.includes(`data-grid-bottom-spacer="${virtual.bottomSpacerHeight}"`), true);
eq('Twee pinned kolommen worden niet naar een tweede boom gedupliceerd',
  count(markup, 'data-grid-pinned="true"'), mountedRows * 2 + 2);
eq('Plus bestaat in deze kern niet en telt dus ook niet als ARIA-kolom',
  markup.includes('data-grid-column-plus'), false);
const coreSource = readFileSync(join(process.cwd(), 'src/components/task-grid/DataGridCore.tsx'), 'utf8');
eq('Generieke gridkern importeert de appstore niet', coreSource.includes('@/state/appStore'), false);
eq('Generieke gridkern importeert geen resourcescherm', /ResourcePanel(?:Compact)?/.test(coreSource), false);

if (diffs.length > 0) {
  console.error(`FAIL task-grid-dom-budget: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exit(1);
} else {
  console.log(`OK  task-grid-dom-budget: ${checks}/${checks}`);
  process.exit(0);
}
