import {
  TASK_GRID_AUTOFIT_MAX_WIDTH,
  addTaskGridColumn,
  computeTaskGridAutoFitWidth,
  moveTaskGridColumn,
  recentAvailableTaskColumnIds,
  removeTaskGridColumn,
  resizeTaskGridColumn,
  setTaskGridColumnPinned,
  taskGridAutoFitValueVersion,
} from '@/engine/taskGrid/preferences';
import { buildColumnChooserModel, type TaskGridColumnOption } from '@/components/task-grid/ColumnChooser';
import { resizeGuidelineLeft } from '@/components/task-grid/DataGridCore';
import { TaskGrid, type TaskGridLabels } from '@/components/task-grid/TaskGrid';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { nextTaskGridMenuIndex } from '@/engine/taskGrid/menuNavigation';
import { createEmptyGridSelection } from '@/engine/taskGrid/selection';
import type { TaskGridColumnPreference } from '@/types/taskGrid';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const id = (value: string) => taskColumnId(value);
const preference = (value: string, pinned = false, width = 100): TaskGridColumnPreference => ({
  id: id(value), pinned, width,
});

const initial = [
  preference('p-a', true),
  preference('p-b', true),
  preference('f-a'),
  preference('future.unavailable'),
  preference('f-b'),
];

eq('Toevoegen zet een nieuwe kolom uiterst rechts in het vrije blok',
  addTaskGridColumn(initial, preference('f-new', false, 130)).map(column => column.id),
  ['p-a', 'p-b', 'f-a', 'future.unavailable', 'f-b', 'f-new']);
eq('Een al aanwezige id kan via de pure voorkeurroute niet dupliceren',
  addTaskGridColumn(initial, preference('f-a', false, 999)), initial);
eq('Verwijderen kent geen verplichte kolom en mag naar nul gaan',
  ['p-a', 'p-b', 'f-a', 'future.unavailable', 'f-b'].reduce(
    (columns, columnId) => removeTaskGridColumn(columns, id(columnId)), initial,
  ), []);
eq('Onbekende dynamische voorkeur blijft bij een buurverwijdering behouden',
  removeTaskGridColumn(initial, id('f-a')).map(column => column.id),
  ['p-a', 'p-b', 'future.unavailable', 'f-b']);

eq('Pinnen verplaatst uitsluitend de gekozen kolom naar rechts in het pinned blok',
  setTaskGridColumnPinned(initial, id('f-a'), true).map(column => `${column.id}:${column.pinned}`),
  ['p-a:true', 'p-b:true', 'f-a:true', 'future.unavailable:false', 'f-b:false']);
eq('Losmaken zet de kolom links in het vrije blok en bewaart beide blokvolgordes',
  setTaskGridColumnPinned(initial, id('p-b'), false).map(column => `${column.id}:${column.pinned}`),
  ['p-a:true', 'p-b:false', 'f-a:false', 'future.unavailable:false', 'f-b:false']);
eq('Headerdrag ordent binnen het vrije blok',
  moveTaskGridColumn(initial, id('f-b'), id('f-a'), 'before').map(column => column.id),
  ['p-a', 'p-b', 'f-b', 'f-a', 'future.unavailable']);
eq('Headerdrag over de pin-grens verandert niets en pint nooit impliciet',
  moveTaskGridColumn(initial, id('f-a'), id('p-a'), 'before'), initial);
eq('Resize gebruikt de UX-grenzen 40..480', [
  resizeTaskGridColumn(initial, id('f-a'), -20).find(column => column.id === 'f-a')?.width,
  resizeTaskGridColumn(initial, id('f-a'), 9_000).find(column => column.id === 'f-a')?.width,
], [40, 480]);

eq('MRU toont alleen nu beschikbare ids, behoudt volgorde en kapt af op tien',
  recentAvailableTaskColumnIds(
    [id('missing'), ...Array.from({ length: 12 }, (_, index) => id(`recent-${index}`))],
    new Set(Array.from({ length: 12 }, (_, index) => id(`recent-${index}`))),
  ), Array.from({ length: 10 }, (_, index) => `recent-${index}`));

const options: TaskGridColumnOption[] = [
  { id: id('task.name'), label: 'Naam', category: 'task', defaultWidth: 220 },
  { id: id('planning.start'), label: 'Geplande start', category: 'planning', defaultWidth: 120 },
  { id: id('computed.float'), label: 'Totale speling', category: 'computed', defaultWidth: 90 },
];
const chooser = buildColumnChooserModel(
  options,
  [id('missing'), id('computed.float'), id('task.name')],
  new Set([id('task.name')]),
  'plan',
);
eq('Kiezermodel verbergt niet-beschikbare MRU-items en markeert zichtbare items disabled',
  chooser.recent.map(item => [item.id, item.selected, item.disabled]),
  [['computed.float', false, false], ['task.name', true, true]]);
eq('Zoeken is labelongevoelig en vindt over categorieën heen',
  chooser.search.map(item => item.id), ['planning.start']);
eq('Alle tien vaste categorieën bestaan in vaste volgorde, ook wanneer sommige leeg zijn',
  chooser.categories.map(category => category.category),
  ['task', 'planning', 'constraints', 'relations', 'resources', 'progress', 'computed', 'baseline', 'custom', 'technical']);

const autoFitRows = Array.from({ length: 20_001 }, (_, index) => ({
  rowKey: `row-${index}`,
  valueVersion: index,
  text: index === 20_000 ? 'de breedste waarde staat uitsluitend op rij twintigduizend' : `r${index}`,
}));
const measureCache = new Map<string, number>();
let measured = 0;
let yielded = 0;
const measureText = (text: string) => {
  measured++;
  return text.length * 20;
};
const fitted = await computeTaskGridAutoFitWidth({
  columnId: id('task.name'),
  headerText: 'Naam',
  rows: autoFitRows,
  cache: measureCache,
  measureText,
  chunkSize: 257,
  yieldToMain: async () => { yielded++; },
});
eq('Auto-fit scant ook de breedste waarde op rij 20.000 en klemt op 480', fitted, TASK_GRID_AUTOFIT_MAX_WIDTH);
eq('Auto-fit chunked de volledige scan en geeft tussendoor de hoofdthread vrij', yielded > 1, true);
eq('De eerste scan meet header plus alle 20.001 waarden', measured, 20_002);
measured = 0;
await computeTaskGridAutoFitWidth({
  columnId: id('task.name'), headerText: 'Naam', rows: autoFitRows,
  cache: measureCache, measureText, chunkSize: 500, yieldToMain: async () => undefined,
});
eq('De per-rij/per-kolom/valueversion-cache voorkomt hermeting van alle datacellen', measured, 1);
eq('Auto-fit-cache-identiteit verandert met zichtbare tekst, font en document', [
  taskGridAutoFitValueVersion('WORKTIME', 'Werktijd', '12px sans-serif', 'doc-a'),
  taskGridAutoFitValueVersion('WORKTIME', 'Work time', '12px sans-serif', 'doc-a'),
  taskGridAutoFitValueVersion('WORKTIME', 'Werktijd', '14px sans-serif', 'doc-a'),
  taskGridAutoFitValueVersion('WORKTIME', 'Werktijd', '12px sans-serif', 'doc-b'),
].every((value, index, all) => all.indexOf(value) === index), true);
eq('Contextmenu-pijlen lopen cyclisch door alle acties', [
  nextTaskGridMenuIndex('ArrowDown', 2, 3),
  nextTaskGridMenuIndex('ArrowUp', 0, 3),
  nextTaskGridMenuIndex('Home', 2, 3),
  nextTaskGridMenuIndex('End', 0, 3),
], [0, 2, 0, 2]);

const labels: TaskGridLabels = {
  grid: 'Takenraster',
  collapseGroup: label => `${label} inklappen`,
  expandGroup: label => `${label} uitklappen`,
  resizeColumn: label => `${label} breder of smaller maken`,
  removeColumn: label => `${label} verwijderen`,
  pinColumn: 'Links vastzetten',
  unpinColumn: 'Links losmaken',
  autoFitColumn: 'Breedte automatisch',
  noColumns: 'Voeg een kolom toe om taakgegevens te tonen.',
  chooser: {
    addColumn: 'Kolom toevoegen',
    title: 'Kolom toevoegen',
    recent: 'Laatst gebruikt',
    search: 'Zoek een veld',
    searchResults: 'Zoekresultaten',
    noSearchResults: 'Geen velden gevonden',
    category: category => category,
  },
  history: {
    addColumn: label => `Kolom ${label} toegevoegd`,
    removeColumn: label => `Kolom ${label} verwijderd`,
    pinColumn: label => `Kolom ${label} vastgezet`,
    unpinColumn: label => `Kolom ${label} losgemaakt`,
    moveColumn: label => `Kolom ${label} verplaatst`,
    resizeColumn: label => `Kolom ${label} verbreed`,
    autoFitColumn: label => `Kolom ${label} automatisch verbreed`,
  },
};
const commonGridProps = {
  surfaceId: 'full-task-grid' as const,
  recentColumnIds: [] as const,
  availableColumns: options,
  labels,
  rows: [{
    kind: 'group' as const,
    rowKey: 'group:empty',
    label: 'Lege groep',
    count: 0,
    depth: 0,
    collapsed: false,
  }],
  selection: createEmptyGridSelection(),
  rowHeight: 28,
  headerHeight: 28,
  viewportHeight: 120,
  viewportWidth: 500,
  scrollTop: 0,
  getCell: () => { throw new Error('Groepsrij heeft geen datacel'); },
  onCommitColumns: () => undefined,
  onRecordRecentColumn: () => undefined,
};
const emptyGridMarkup = renderToStaticMarkup(createElement(TaskGrid, {
  ...commonGridProps,
  surfacePreferences: { columns: [], scrollX: 0 },
}));
eq('Nul kolommen blijft een geldig grid zonder aria-colspan nul', [
  emptyGridMarkup.includes('aria-colcount="0"'),
  emptyGridMarkup.includes('aria-colspan="0"'),
  emptyGridMarkup.includes(labels.noColumns),
  emptyGridMarkup.includes('aria-label="Kolom toevoegen"'),
], [true, false, true, true]);
eq('De plus hoort bij de surface-schil en is geen gegevenskolom', [
  emptyGridMarkup.includes('data-task-grid-surface="full-task-grid"'),
  emptyGridMarkup.includes('role="columnheader"'),
], [true, false]);

const oneColumnMarkup = renderToStaticMarkup(createElement(TaskGrid, {
  ...commonGridProps,
  surfacePreferences: { columns: [preference('task.name', false, 220)], scrollX: 0 },
}));
eq('Een zichtbare header biedt verwijderen en resizen zonder sorteersignaal', [
  oneColumnMarkup.includes('aria-label="Naam verwijderen"'),
  oneColumnMarkup.includes('role="separator"'),
  oneColumnMarkup.toLocaleLowerCase().includes('sort'),
], [true, true, false]);

// ── resizeGuidelineLeft (browserreview, observatie 3b) ────────────────────────────────────────
// De volledige-hoogte hulplijn tijdens kolomresize moet exact op de RECHTERRAND van de kolom die
// actief geresized wordt landen, in content-space (vóór aftrek van scrollLeft — zie de render in
// DataGridCore.tsx voor waarom dat de juiste ruimte is voor een `position:sticky`-overlay).
{
  const cols = [
    { id: id('a'), label: 'A', width: 40, pinned: false },
    { id: id('b'), label: 'B', width: 100, pinned: false },
    { id: id('c'), label: 'C', width: 60, pinned: false },
  ];
  eq('Geen actieve resize ⇒ geen hulplijn', resizeGuidelineLeft(cols, null), null);
  eq('Eerste kolom: rechterrand op zijn eigen breedte', resizeGuidelineLeft(cols, id('a')), 40);
  eq('Middelste kolom: cumulatief tot en met die kolom', resizeGuidelineLeft(cols, id('b')), 140);
  eq('Laatste kolom: cumulatief tot de totale breedte', resizeGuidelineLeft(cols, id('c')), 200);
  eq('Kolom niet (meer) aanwezig ⇒ geen hulplijn', resizeGuidelineLeft(cols, id('verwijderd')), null);
  eq('Lege kolommenlijst ⇒ geen hulplijn', resizeGuidelineLeft([], id('a')), null);
}

if (diffs.length) {
  console.error(`FAIL task-grid-columns: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exit(1);
}
console.log(`OK  task-grid-columns: ${checks}/${checks}`);
process.exit(0);
