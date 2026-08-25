import { createAppStore } from '@/state/appStore';
import { normalizeView } from '@/state/documentContract';
import type { ColumnConfig, Layout, ViewState } from '@/types/view';
import type { PersistedTaskGridPreferencesV1, TaskGridColumnPreference } from '@/types/taskGrid';
import {
  TASK_GRID_COLUMN_MAX_WIDTH,
  TASK_GRID_COLUMN_MIN_WIDTH,
  createDefaultTaskGridPreferences,
  legacyDocumentColumnsToTaskGridPreferences,
  legacyLayoutColumnsToTaskGridPreferences,
  normalizePersistedTaskGridPreferences,
  recordRecentTaskColumnId,
  resolveLayoutColumnsForProject,
  visibleTaskGridColumns,
} from '@/engine/taskGrid/preferences';
import {
  loadLayouts,
  loadTaskGridPreferences,
  saveLayouts,
} from '@/utils/settingsStore';
import { activityCodeColumnId, customFieldColumnId, taskColumnId } from '@/engine/taskGrid/fieldIds';

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

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

const defaults = createDefaultTaskGridPreferences({
  projectId: 'project:1',
  activityCodeTypeIds: ['fase:1'],
  customFieldDefIds: ['cf:1'],
});

eq('Gantt-default is exact WBS, Naam, Duur',
  defaults.surfaces['gantt-task-grid'].columns.map(column => column.id),
  ['task.wbsCode', 'task.name', 'task.time.scheduleDuration']);
eq('Tabel-default bevat de negen vaste brede velden',
  defaults.surfaces['full-task-grid'].columns.slice(0, 9).map(column => column.id),
  [
    'task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.scheduleStart',
    'task.time.scheduleFinish', 'task.taskType', 'task.time.isCritical',
    'task.time.totalFloat', 'task.time.completion',
  ]);
eq('Tabel-default voegt projectgebonden dynamische defaults toe',
  defaults.surfaces['full-task-grid'].columns.slice(9).map(column => column.id),
  [activityCodeColumnId('project:1', 'fase:1'), customFieldColumnId('project:1', 'cf:1')]);
eq('Beide oppervlakken starten zonder horizontale scroll', {
  gantt: defaults.surfaces['gantt-task-grid'].scrollX,
  table: defaults.surfaces['full-task-grid'].scrollX,
}, { gantt: 0, table: 0 });

const normalized = normalizePersistedTaskGridPreferences({
  version: 1,
  surfaces: {
    'gantt-task-grid': {
      columns: [
        { id: 'plugin.future', width: -10, pinned: true },
        { id: 'plugin.future', width: 333, pinned: false },
        { id: 'task.name', width: 99_999, pinned: false },
      ],
      scrollX: -50,
    },
    'full-task-grid': {
      columns: [{ id: 'task.name', width: 'fout', pinned: false }],
      scrollX: 12,
    },
  },
  recent: ['plugin.future', 'plugin.future', ...Array.from({ length: 12 }, (_, i) => `x-${i}`)],
}, defaults)!;
eq('Onbekende ids blijven staan en duplicaten normaliseren naar de eerste positie',
  normalized.surfaces['gantt-task-grid'].columns.map(column => column.id),
  ['plugin.future', 'task.name']);
eq('Eindige breedtes worden aan beide grenzen geklemd',
  normalized.surfaces['gantt-task-grid'].columns.map(column => column.width),
  [TASK_GRID_COLUMN_MIN_WIDTH, TASK_GRID_COLUMN_MAX_WIDTH]);
eq('Negatieve scroll wordt nul', normalized.surfaces['gantt-task-grid'].scrollX, 0);
eq('Een ongeldig oppervlak valt afzonderlijk terug op zijn default',
  normalized.surfaces['full-task-grid'], defaults.surfaces['full-task-grid']);
eq('MRU dedupliceert en kapt af op tien', normalized.recent,
  ['plugin.future', ...Array.from({ length: 9 }, (_, i) => `x-${i}`)]);
eq('Onbekende voorkeurversie wordt volledig geweigerd',
  normalizePersistedTaskGridPreferences({ ...defaults, version: 2 }, defaults), null);

let recent = defaults.recent;
for (let index = 0; index < 12; index++) recent = recordRecentTaskColumnId(recent, taskColumnId(`recent-${index}`));
recent = recordRecentTaskColumnId(recent, taskColumnId('recent-5'));
eq('Recent gebruikt zet opnieuw gekozen id vooraan en houdt maximaal tien vast', recent,
  ['recent-5', 'recent-11', 'recent-10', 'recent-9', 'recent-8', 'recent-7', 'recent-6', 'recent-4', 'recent-3', 'recent-2']);

const projectAColumn = activityCodeColumnId('project:A', 'fase');
const projectBColumn = activityCodeColumnId('project:B', 'fase');
const rememberedSurface = {
  columns: [
    { id: projectAColumn, width: 90, pinned: false },
    { id: projectBColumn, width: 120, pinned: true },
    { id: taskColumnId('plugin.unknown'), width: 80, pinned: false },
  ],
  scrollX: 45,
};
eq('Project A rendert alleen beschikbare ids',
  visibleTaskGridColumns(rememberedSurface, new Set([projectAColumn])).map(column => column.id),
  [projectAColumn]);
eq('Filteren voor project A vernietigt project B en onbekend niet', rememberedSurface.columns.map(column => column.id),
  [projectAColumn, projectBColumn, 'plugin.unknown']);

const legacyDocumentColumns: ColumnConfig[] = [
  { field: { src: 'builtin', key: 'name' }, visible: true, width: 222 },
  { field: { src: 'activityCode', typeId: 'fase:1' }, visible: true, width: 93 },
  { field: { src: 'customField', defId: 'cf:1' }, visible: false, width: 94 },
];
eq('Documentmigratie neemt alleen zichtbare velden en bindt dynamiek aan het bekende project',
  legacyDocumentColumnsToTaskGridPreferences(legacyDocumentColumns, 'project:1').map(column => column.id),
  ['task.name', activityCodeColumnId('project:1', 'fase:1')]);
const legacyGlobal = legacyLayoutColumnsToTaskGridPreferences(legacyDocumentColumns);
eq('Globale layoutmigratie raadt geen project voor dynamische refs', legacyGlobal.map(column => column.id),
  ['task.name', 'legacy-activity-code:fase%3A1']);
eq('Een passende legacy-layoutref wordt alleen voor toepassing projectgebonden opgelost',
  resolveLayoutColumnsForProject(legacyGlobal, {
    projectId: 'project:1', activityCodeTypeIds: ['fase:1'], customFieldDefIds: [],
  }).map(column => column.id),
  ['task.name', activityCodeColumnId('project:1', 'fase:1')]);
eq('De opgeslagen legacy-layout zelf blijft opaque', legacyGlobal.map(column => column.id),
  ['task.name', 'legacy-activity-code:fase%3A1']);

const unknownLegacy = legacyLayoutColumnsToTaskGridPreferences([
  { field: { src: 'builtin', key: 'futureBuiltin' }, visible: true, width: 88 },
  { field: { src: 'plugin-x', key: 'futureField' }, visible: true, width: 89 },
  { field: { src: 'activityCode', typeId: '' }, visible: true, width: 90 },
]);
eq('Onbekende syntactische legacyvelden blijven als afzonderlijke opaque ids behouden',
  unknownLegacy.map(column => column.id.startsWith('legacy-field:')),
  [true, true, true]);
eq('Opaque onbekende legacyvelden behouden hun volgorde en breedte',
  unknownLegacy.map(column => column.width), [88, 89, 90]);

const legacyView = { ...({} as ViewState), columns: legacyDocumentColumns } as ViewState;
const cleanView = normalizeView(legacyView);
ok('normalizeView verwijdert het oude documentveld columns', !('columns' in cleanView));
ok('normalizeView-migratie is idempotent', !('columns' in normalizeView(cleanView)));

storage.setItem('ops-taskGridPreferences', '{kapot');
const corruptRaw = storage.getItem('ops-taskGridPreferences');
const corruptLoad = await loadTaskGridPreferences(defaults);
eq('Corrupte JSON geeft een gerichte invalid-uitkomst', corruptLoad.status, 'invalid');
eq('Corrupte ruwe voorkeur wordt niet als default teruggeschreven',
  storage.getItem('ops-taskGridPreferences'), corruptRaw);
storage.setItem('ops-taskGridPreferences', JSON.stringify({ ...defaults, version: 2 }));
const futureRaw = storage.getItem('ops-taskGridPreferences');
eq('Onbekende voorkeurversie geeft invalid en blijft rauw staan',
  (await loadTaskGridPreferences(defaults)).status, 'invalid');
eq('Onbekende voorkeurversie wordt niet stil gedowngraded',
  storage.getItem('ops-taskGridPreferences'), futureRaw);

storage.clear();
const store = createAppStore();
store.getState().hydrateTaskGridPreferences(defaults);
const fullBefore = JSON.stringify(store.getState().taskGridSurfaces['full-task-grid']);
const dirtyBefore = store.getState().isDirty;
const ganttColumns: TaskGridColumnPreference[] = [{
  id: taskColumnId('task.name'), width: 321, pinned: true,
}];
store.getState().setTaskGridColumns('gantt-task-grid', ganttColumns);
eq('Gantt-wijziging raakt de Tabel-voorkeur niet',
  JSON.stringify(store.getState().taskGridSurfaces['full-task-grid']), fullBefore);
eq('Persoonlijke kolomwijziging zet het project niet dirty', store.getState().isDirty, dirtyBefore);
const persistedAfterColumns = JSON.parse(storage.getItem('ops-taskGridPreferences')!) as PersistedTaskGridPreferencesV1;
eq('State en gepersisteerde Gantt-kolommen zijn dezelfde gevalideerde payload',
  persistedAfterColumns.surfaces['gantt-task-grid'], store.getState().taskGridSurfaces['gantt-task-grid']);
store.getState().setTaskGridScrollX('full-task-grid', 987);
eq('Scroll is per surface onafhankelijk', {
  gantt: store.getState().taskGridSurfaces['gantt-task-grid'].scrollX,
  table: store.getState().taskGridSurfaces['full-task-grid'].scrollX,
}, { gantt: 0, table: 987 });
for (let index = 0; index < 12; index++) store.getState().recordRecentTaskColumn(taskColumnId(`store-${index}`));
eq('Store bewaart één gedeelde MRU van tien', store.getState().recentTaskColumns,
  Array.from({ length: 10 }, (_, i) => `store-${11 - i}`));
eq('Ook MRU-mutaties laten isDirty ongemoeid', store.getState().isDirty, dirtyBefore);

store.setState((state) => {
  state.project.id = 'project:1';
  state.activityCodeTypes = [{ id: 'fase:1', name: 'Fase', values: [] }];
});
store.getState().setUI({ activeRibbonTab: 'table' });
const ganttBeforeLayout = JSON.stringify(store.getState().taskGridSurfaces['gantt-task-grid']);
store.getState().applyTaskGridLayoutColumns(legacyGlobal);
eq('Layout toepassen op Tabel bindt passende opaque dynamiek aan het actieve project',
  store.getState().taskGridSurfaces['full-task-grid'].columns.map(column => column.id),
  ['task.name', activityCodeColumnId('project:1', 'fase:1')]);
eq('Layout toepassen op Tabel laat Gantt volledig ongemoeid',
  JSON.stringify(store.getState().taskGridSurfaces['gantt-task-grid']), ganttBeforeLayout);
const tableAfterLayout = JSON.stringify(store.getState().taskGridSurfaces['full-task-grid']);
store.getState().setUI({ activeRibbonTab: 'start' });
store.getState().applyTaskGridLayoutColumns(legacyGlobal);
eq('Dezelfde layout is ook op de Gantt-surface toepasbaar',
  store.getState().taskGridSurfaces['gantt-task-grid'].columns.map(column => column.id),
  ['task.name', activityCodeColumnId('project:1', 'fase:1')]);
eq('Layout toepassen op Gantt laat de Tabel-surface volledig ongemoeid',
  JSON.stringify(store.getState().taskGridSurfaces['full-task-grid']), tableAfterLayout);
eq('Layouttoepassing blijft gebruikersstate en zet het project niet dirty',
  store.getState().isDirty, dirtyBefore);

storage.clear();
const oldLayouts: unknown[] = [{
  id: 'legacy-layout', name: 'Oud', columns: legacyDocumentColumns,
  group: [], sort: [], filter: null, timeScale: 'week',
}];
storage.setItem('ops-layouts', JSON.stringify(oldLayouts));
const migratedLayouts = await loadLayouts();
eq('Oude globale layout wordt lazy met opaque dynamiek gelezen', migratedLayouts[0]?.columns.map(column => column.id),
  ['task.name', 'legacy-activity-code:fase%3A1']);
const oldLayoutRaw = storage.getItem('ops-layouts');
await saveLayouts(migratedLayouts as Layout[]);
ok('Nieuwe layouts worden onder een versieerbare eigen sleutel opgeslagen',
  storage.getItem('ops-taskGridLayouts')?.includes('"version":1') === true);
eq('Expliciet opslaan laat de oude ops-layouts onaangeroerd', storage.getItem('ops-layouts'), oldLayoutRaw);

if (diffs.length) {
  console.error(`XX task-grid-preferences: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK task-grid-preferences: ${checks}/${checks} checks groen`);
