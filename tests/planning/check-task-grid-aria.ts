import { renderToStaticMarkup } from 'react-dom/server.browser';
import { createElement } from 'react';
import { DataGridCore } from '@/components/task-grid/DataGridCore';
import { GridEditorHost } from '@/components/task-grid/GridEditorHost';
import {
  computePinnedColumnLayout,
  keyboardResizeWidth,
} from '@/components/task-grid/DataGridHeader';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type {
  DataGridColumnModel,
  DataGridRowModel,
} from '@/components/task-grid/taskGridContext';
import type { GridSelectionState } from '@/engine/taskGrid/selection';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function count(markup: string, pattern: RegExp): number {
  return [...markup.matchAll(pattern)].length;
}

const columns: DataGridColumnModel[] = [
  { id: taskColumnId('task.wbsCode'), label: 'WBS', width: 80, pinned: true },
  { id: taskColumnId('task.name'), label: 'Taaknaam', width: 220, pinned: false },
  { id: taskColumnId('task.time.totalFloat'), label: 'Speling', width: 90, pinned: false },
];
const rows: DataGridRowModel[] = [
  { kind: 'data', rowKey: 'r-a', depth: 0 },
  { kind: 'group', rowKey: 'g-fase', label: 'Fase', count: 2, depth: 0, collapsed: false },
  { kind: 'data', rowKey: 'r-b', depth: 1 },
  { kind: 'data', rowKey: 'r-c', depth: 1 },
];
const selection: GridSelectionState = {
  active: { rowKey: 'r-c', columnId: columns[1].id },
  anchor: { rowKey: 'r-a', columnId: columns[0].id },
  range: {
    start: { rowKey: 'r-a', columnId: columns[0].id },
    end: { rowKey: 'r-c', columnId: columns[1].id },
  },
  selectedTaskIds: [], activeTaskId: null,
};

const markup = renderToStaticMarkup(createElement(DataGridCore, {
    rows,
    columns,
    selection,
    rowHeight: 28,
    headerHeight: 28,
    viewportHeight: 300,
    viewportWidth: 500,
    scrollTop: 0,
    getCell: (row, column) => ({
      text: `${row.rowKey}:${column.label}`,
      readOnly: column.id === columns[2].id,
      error: row.rowKey === 'r-c' && column.id === columns[1].id
        ? { id: 'grid-error-r-c-name', message: 'Naam is ongeldig' }
        : undefined,
    }),
    onToggleGroup: () => undefined,
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

eq('Buitenste node is één ARIA-grid', count(markup, /role="grid"/g), 1);
eq('Grid heeft een toegankelijke naam', markup.includes('aria-label="Takenraster"'), true);
eq('Grid meldt dat een celbereik meer dan één cel mag selecteren', markup.includes('aria-multiselectable="true"'), true);
eq('Grid telt header plus alle data- en groepsrijen absoluut', markup.includes('aria-rowcount="5"'), true);
eq('Plus is geen kolom; drie datakolommen worden gemeld', markup.includes('aria-colcount="3"'), true);
eq('Header is rij één', markup.includes('role="row" aria-rowindex="1"'), true);
eq('Drie kolomkoppen hebben absolute indices', count(markup, /role="columnheader"/g), 3);
eq('Laatste kolomkop heeft aria-colindex 3', markup.includes('aria-colindex="3"'), true);
for (const index of [2, 3, 4, 5]) {
  eq(`Virtuele rij houdt absolute aria-rowindex ${index}`, markup.includes(`aria-rowindex="${index}"`), true);
}
eq('Groepsrij heeft één cel over alle zichtbare kolommen',
  count(markup, /data-grid-group-cell/g), 1);
eq('Groepscel meldt aria-colspan 3', markup.includes('aria-colspan="3"'), true);
eq('Groepscel begint op absolute kolomindex 1',
  /data-grid-group-cell="true"[^>]*aria-colindex="1"/.test(markup)
    || /aria-colindex="1"[^>]*data-grid-group-cell="true"/.test(markup), true);
eq('Groepsknop is echt en meldt de open stand',
  markup.includes('aria-expanded="true"') && markup.includes('aria-label="Fase inklappen"'), true);
eq('Bereikselectie markeert zes taakcellen en geen groepscel', count(markup, /aria-selected="true"/g), 6);
eq('Read-onlykolom meldt dit op iedere taakcel', count(markup, /aria-readonly="true"/g), 3);
eq('Exact één roving tabstop bestaat', count(markup, /tabindex="0"/g), 1);
eq('Alle overige taakgridcellen hebben tabindex -1', count(markup, /role="gridcell"[^>]*tabindex="-1"/g), 8);
eq('Iedere resizegreep is benoemd en toetsenbordfocusbaar',
  count(markup, /role="separator"/g) === 3 && markup.includes('aria-label="Taaknaam breder of smaller maken"'), true);
eq('Actieve foutcel is gekoppeld aan zijn fouttekst',
  markup.includes('aria-invalid="true"') && markup.includes('aria-describedby="grid-error-r-c-name"'), true);
eq('Grid heeft exact één bescheiden live region met de actieve fout',
  count(markup, /aria-live="polite"/g) === 1 && markup.includes('Naam is ongeldig'), true);
eq('Pinned kolom staat één keer per taakrij plus één keer in de header', count(markup, /data-grid-pinned="true"/g), 4);

const rtlMarkup = renderToStaticMarkup(createElement(DataGridCore, {
  rows: rows.slice(0, 1),
  columns,
  selection: { ...selection, active: { rowKey: 'r-a', columnId: columns[0].id } },
  rowHeight: 28,
  headerHeight: 28,
  viewportHeight: 28,
  viewportWidth: 500,
  scrollTop: 0,
  textDirection: 'rtl',
  getCell: (row, column) => ({ text: `${row.rowKey}:${column.label}`, readOnly: false }),
  labels: {
    grid: 'شبكة المهام',
    collapseGroup: label => `${label} طي`,
    expandGroup: label => `${label} توسيع`,
    resizeColumn: label => `${label} تغيير الحجم`,
    removeColumn: label => `${label} إزالة`,
    pinColumn: 'تثبيت إلى اليسار',
    unpinColumn: 'إلغاء التثبيت',
    autoFitColumn: 'ملاءمة تلقائية',
  },
}));
eq('RTL-grid houdt de fysieke kolom- en scrollrichting links-naar-rechts',
  /role="grid"[^>]*dir="rtl"[^>]*style="[^"]*direction:ltr/.test(rtlMarkup), true);
eq('RTL-kolomkoppen en datacellen houden hun eigen tekstrichting',
  count(rtlMarkup, /role="columnheader"[^>]*dir="rtl"/g) === 3
    && count(rtlMarkup, /role="gridcell"[^>]*dir="rtl"/g) === 3, true);
eq('RTL-pinning blijft met een fysieke left-offset op nul werken',
  /role="columnheader"[^>]*data-grid-pinned="true"[^>]*left:0/.test(rtlMarkup)
    && /role="gridcell"[^>]*data-grid-pinned="true"[^>]*left:0/.test(rtlMarkup), true);

const offscreenMarkup = renderToStaticMarkup(createElement(DataGridCore, {
  rows,
  columns,
  selection,
  rowHeight: 28,
  headerHeight: 28,
  viewportHeight: 28,
  viewportWidth: 500,
  scrollTop: 0,
  overscan: 0,
  getCell: (row, column) => ({ text: `${row.rowKey}:${column.label}`, readOnly: false }),
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
eq('Ongemounte actieve cel geeft tijdelijk precies één tabstop aan de container',
  count(offscreenMarkup, /tabindex="0"/g), 1);
eq('Ongemounte actieve cel maakt geen tweede schijn-actieve cel',
  count(offscreenMarkup, /data-grid-active="true"/g), 0);

const pinnedFits = computePinnedColumnLayout(columns, 500);
eq('Pinned blok past en krijgt één cumulatieve left-offset', pinnedFits.stickyEnabled, true);
eq('Eerste pinned kolom start fysiek op nul', pinnedFits.leftByColumnId.get(columns[0].id), 0);
const pinnedOverflow = computePinnedColumnLayout([
  { ...columns[0], width: 180 },
  { ...columns[1], width: 180, pinned: true },
  columns[2],
], 300);
eq('Te breed pinned blok schakelt sticky voor het hele blok uit', pinnedOverflow.stickyEnabled, false);
eq('Overflowfallback publiceert geen sticky offsets', pinnedOverflow.leftByColumnId.size, 0);

eq('Keyboardresize gebruikt 8 px per gewone stap', keyboardResizeWidth(100, 'ArrowRight', false), 108);
eq('Keyboardresize gebruikt 32 px met Shift', keyboardResizeWidth(100, 'ArrowLeft', true), 68);
eq('Keyboardresize klemt op 40 px', keyboardResizeWidth(41, 'ArrowLeft', true), 40);
eq('Keyboardresize klemt op 480 px', keyboardResizeWidth(479, 'ArrowRight', true), 480);

const editorMarkup = renderToStaticMarkup(createElement(GridEditorHost, {
  cell: { rowKey: 'r-c', columnId: columns[1].id },
  error: { id: 'editor-error', message: 'Vul een taaknaam in' },
  onCancel: () => undefined,
  onCommit: () => ({ ok: false as const, error: { id: 'editor-error', message: 'Vul een taaknaam in' } }),
  onFocusCell: () => undefined,
  children: inputProps => createElement('input', { 'aria-label': 'Taaknaam', ...inputProps }),
}));
eq('Editor koppelt ongeldige invoer aan fouttekst',
  editorMarkup.includes('aria-invalid="true"') && editorMarkup.includes('aria-describedby="editor-error"'), true);
eq('Editorfout blijft in de DOM zolang commit ongeldig is', editorMarkup.includes('Vul een taaknaam in'), true);

if (diffs.length > 0) {
  console.error(`FAIL task-grid-aria: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exit(1);
} else {
  console.log(`OK  task-grid-aria: ${checks}/${checks}`);
  process.exit(0);
}
