import { createAppStore } from '@/state/appStore';
import { capturePayload, hydratePayload, normalizeView } from '@/state/documentContract';
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
  type TaskGridPreferencesLoadResult,
} from '@/utils/settingsStore';
import { activityCodeColumnId, customFieldColumnId, taskColumnId } from '@/engine/taskGrid/fieldIds';
import { bootstrapTaskGridPreferences } from '@/state/taskGridBootstrap';

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
  writes = 0;
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void {
    this.writes++;
    this.values.set(key, String(value));
  }
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

// Echte hydrateketen: de documentnormalisatie mag `view.columns` wissen, maar alleen nadat de
// store-lokale migratiebron veilig is vastgelegd voor de ontbrekende gebruikerssleutel.
const migrationStore = createAppStore();
const migrationPayload = capturePayload(migrationStore.getState());
migrationPayload.project = { ...migrationPayload.project, id: 'project:1' };
(migrationPayload.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
migrationStore.setState(state => hydratePayload(state, migrationPayload));
ok('Hydrate verwijdert oude columns uit het documentmodel',
  !('columns' in migrationStore.getState().view));
const stagedLegacy = migrationStore.getState().peekPendingLegacyTaskGridColumns();
eq('Hydrate bewaart de oude actieve kolommen buiten het documentcontract voor bootstrap',
  stagedLegacy, { projectId: 'project:1', columns: legacyDocumentColumns });
eq('Een tweede store erft de tijdelijke migratiebron niet',
  createAppStore().getState().peekPendingLegacyTaskGridColumns(), null);

storage.clear();
eq('De echte product-bootstrap rapporteert een geslaagde legacy-migratie',
  await bootstrapTaskGridPreferences(migrationStore), 'migrated');
eq('Na geslaagde persist+hydrate staat de oude indeling in de gebruikersvoorkeur',
  migrationStore.getState().taskGridSurfaces['full-task-grid'].columns.map(column => column.id),
  ['task.name', activityCodeColumnId('project:1', 'fase:1')]);
eq('Pas hydrate ruimt de tijdelijke legacybron op',
  migrationStore.getState().peekPendingLegacyTaskGridColumns(), null);

// Opslagfout: product-bootstrap mag de enige legacybron niet opruimen voordat persist slaagt.
const failingStore = createAppStore();
const failingPayload = capturePayload(failingStore.getState());
failingPayload.project = { ...failingPayload.project, id: 'project:failure' };
(failingPayload.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
failingStore.setState(state => hydratePayload(state, failingPayload));
let saveFailed = false;
try {
  await bootstrapTaskGridPreferences(failingStore, {
    load: async () => ({ status: 'missing' }),
    save: async () => { throw new Error('quota'); },
  });
} catch {
  saveFailed = true;
}
ok('Een opslagfout wordt aan de aanroeper gemeld', saveFailed);
eq('Een opslagfout ruimt de pending legacybron niet op',
  failingStore.getState().peekPendingLegacyTaskGridColumns()?.projectId, 'project:failure');

// Bestaande geldige nieuwe voorkeur wint altijd van oude documentkolommen.
const precedenceStore = createAppStore();
const precedencePayload = capturePayload(precedenceStore.getState());
precedencePayload.project = { ...precedencePayload.project, id: 'project:precedence' };
(precedencePayload.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
precedenceStore.setState(state => hydratePayload(state, precedencePayload));
const validNewPreferences = createDefaultTaskGridPreferences({
  projectId: '', activityCodeTypeIds: [], customFieldDefIds: [],
});
validNewPreferences.surfaces['full-task-grid'].columns = [{
  id: taskColumnId('task.time.freeFloat'), width: 177, pinned: true,
}];
eq('Geldige nieuwe voorkeur heeft voorrang op oude documentkolommen',
  await bootstrapTaskGridPreferences(precedenceStore, {
    load: async () => ({ status: 'valid', value: validNewPreferences }),
  }), 'valid');
eq('De geldige nieuwe kolomset wordt letterlijk gehydrateerd',
  precedenceStore.getState().taskGridSurfaces['full-task-grid'].columns,
  validNewPreferences.surfaces['full-task-grid'].columns);
eq('Geldige voorkeur ruimt de overbodige legacybron op',
  precedenceStore.getState().peekPendingLegacyTaskGridColumns(), null);

// Een corrupte bestaande key heeft eveneens voorrang: geen legacyconversie en geen overschrijving.
const invalidStore = createAppStore();
const invalidPayload = capturePayload(invalidStore.getState());
invalidPayload.project = { ...invalidPayload.project, id: 'project:invalid' };
(invalidPayload.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
invalidStore.setState(state => hydratePayload(state, invalidPayload));
let invalidSaveCalled = false;
eq('Corrupte nieuwe voorkeur valt in memory terug en migreert legacy niet',
  await bootstrapTaskGridPreferences(invalidStore, {
    load: async () => ({ status: 'invalid' }),
    save: async () => { invalidSaveCalled = true; },
  }), 'invalid-fallback');
ok('Invalid-fallback schrijft niets terug', !invalidSaveCalled);
const invalidDefaults = createDefaultTaskGridPreferences({
  projectId: 'project:invalid', activityCodeTypeIds: [], customFieldDefIds: [],
});
eq('Invalid-fallback gebruikt de negen vaste defaults, niet de legacyset',
  invalidStore.getState().taskGridSurfaces['full-task-grid'].columns.map(column => column.id),
  invalidDefaults.surfaces['full-task-grid'].columns.map(column => column.id));

// Na preference-hydrate mogen latere documentwissels geen nieuwe pending bron opbouwen.
const laterPayload = capturePayload(precedenceStore.getState());
laterPayload.project = { ...laterPayload.project, id: 'project:later' };
laterPayload.view = { ...laterPayload.view };
(laterPayload.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
precedenceStore.setState(state => hydratePayload(state, laterPayload));
eq('Documenthydrate na preference-bootstrap stage’t geen nieuwe legacybron',
  precedenceStore.getState().peekPendingLegacyTaskGridColumns(), null);

// Zelfs met een kunstmatig trage loader gebruikt missing-migratie het document dat op het moment
// van migreren actief is, niet een eerder snapshot met een verkeerd project-id.
const raceStore = createAppStore();
const raceA = capturePayload(raceStore.getState());
raceA.project = { ...raceA.project, id: 'project:race-a' };
(raceA.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
raceStore.setState(state => hydratePayload(state, raceA));
let releaseRaceLoad = (): void => undefined;
const delayedLoad = new Promise<TaskGridPreferencesLoadResult>(resolve => {
  releaseRaceLoad = () => resolve({ status: 'missing' });
});
const raceSaved: PersistedTaskGridPreferencesV1[] = [];
const raceBootstrap = bootstrapTaskGridPreferences(raceStore, {
  load: async () => delayedLoad,
  save: async preferences => { raceSaved.push(preferences); },
});
const raceB = capturePayload(raceStore.getState());
raceB.project = { ...raceB.project, id: 'project:race-b' };
raceB.view = { ...raceB.view };
(raceB.view as ViewState & { columns?: ColumnConfig[] }).columns = legacyDocumentColumns;
raceStore.setState(state => hydratePayload(state, raceB));
releaseRaceLoad();
eq('Trage missing-bootstrap migreert tegen het inmiddels actieve project',
  await raceBootstrap, 'migrated');
eq('Trage bootstrap bindt dynamische legacy-id aan project B, niet project A',
  raceSaved[0]?.surfaces['full-task-grid'].columns.map(column => column.id),
  ['task.name', activityCodeColumnId('project:race-b', 'fase:1')]);

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
const writesBeforeScrollBurst = storage.writes;
for (const scrollX of [120, 240, 480, 760, 987]) {
  store.getState().setTaskGridScrollX('full-task-grid', scrollX);
}
eq('Scroll is per surface onafhankelijk', {
  gantt: store.getState().taskGridSurfaces['gantt-task-grid'].scrollX,
  table: store.getState().taskGridSurfaces['full-task-grid'].scrollX,
}, { gantt: 0, table: 987 });
eq('Een scrollburst schrijft niet synchroon naar localStorage', storage.writes, writesBeforeScrollBurst);
await new Promise(resolve => setTimeout(resolve, 180));
eq('Een scrollburst wordt samengevoegd tot precies één persist-write',
  storage.writes, writesBeforeScrollBurst + 1);
const persistedAfterScroll = JSON.parse(
  storage.getItem('ops-taskGridPreferences')!,
) as PersistedTaskGridPreferencesV1;
eq('De samengevoegde persist-write bewaart de laatste scrollstand',
  persistedAfterScroll.surfaces['full-task-grid'].scrollX, 987);
for (let index = 0; index < 12; index++) store.getState().recordRecentTaskColumn(taskColumnId(`store-${index}`));
eq('Store bewaart één gedeelde MRU van tien', store.getState().recentTaskColumns,
  Array.from({ length: 10 }, (_, i) => `store-${11 - i}`));
eq('Ook MRU-mutaties laten isDirty ongemoeid', store.getState().isDirty, dirtyBefore);

const historyStore = createAppStore();
historyStore.getState().hydrateTaskGridPreferences(defaults);
const historyDirtyBefore = historyStore.getState().isDirty;
const historyTableBefore = JSON.stringify(historyStore.getState().taskGridSurfaces['full-task-grid']);
const historyGanttBefore = historyStore.getState().taskGridSurfaces['gantt-task-grid'];
const historyGanttAfter = [
  ...historyGanttBefore.columns,
  { id: taskColumnId('task.time.scheduleStart'), width: 120, pinned: false },
];
historyStore.getState().commitTaskGridColumns(
  'gantt-task-grid', 'Kolom Start toegevoegd', historyGanttAfter,
);
eq('Eén directe kolomactie schrijft precies één toegepast grid-history-event',
  historyStore.getState().historyEvents.map(event => ({
    label: event.label,
    state: event.state,
    kinds: event.deltas.map(delta => delta.kind),
  })), [{
    label: 'Kolom Start toegevoegd', state: 'applied', kinds: ['grid-preference'],
  }]);
const firstGridDelta = historyStore.getState().historyEvents[0]?.deltas[0];
eq('Grid-history bevat uitsluitend de bedoelde surface',
  firstGridDelta?.kind === 'grid-preference' ? firstGridDelta.surface : null,
  'gantt-task-grid');
eq('Een persoonlijke historywijziging raakt de andere surface niet',
  JSON.stringify(historyStore.getState().taskGridSurfaces['full-task-grid']), historyTableBefore);
eq('Een persoonlijke historywijziging zet het project niet dirty',
  historyStore.getState().isDirty, historyDirtyBefore);
historyStore.getState().undo();
eq('Undo herstelt de volledige eerdere kolomvoorkeur',
  historyStore.getState().taskGridSurfaces['gantt-task-grid'], historyGanttBefore);
eq('Undo markeert hetzelfde event als undone zonder extra event',
  historyStore.getState().historyEvents.map(event => event.state), ['undone']);
historyStore.getState().redo();
eq('Redo herstelt de volledige nieuwe kolomvoorkeur',
  historyStore.getState().taskGridSurfaces['gantt-task-grid'].columns, historyGanttAfter);
const eventCountBeforeNoOp = historyStore.getState().historyEvents.length;
historyStore.getState().commitTaskGridColumns(
  'gantt-task-grid', 'Dit is een no-op', historyStore.getState().taskGridSurfaces['gantt-task-grid'].columns,
);
eq('Een identieke kolomcommit schrijft geen history-event',
  historyStore.getState().historyEvents.length, eventCountBeforeNoOp);

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

const compoundStore = createAppStore();
compoundStore.getState().hydrateTaskGridPreferences(defaults);
compoundStore.getState().setUI({ activeRibbonTab: 'table' });
const compoundBeforeView = JSON.stringify(compoundStore.getState().view);
const compoundBeforeGrid = JSON.stringify(compoundStore.getState().taskGridSurfaces['full-task-grid']);
compoundStore.getState().applyLayout({
  id: 'compound-layout',
  name: 'Compound',
  columns: [{ id: taskColumnId('task.name'), width: 333, pinned: true }],
  group: [],
  sort: [],
  filter: null,
  timeScale: 'month',
});
const compoundEvents = compoundStore.getState().historyEvents;
const compoundEvent = compoundEvents[compoundEvents.length - 1];
eq('Layoutapply publiceert documentview en surfacevoorkeur als één compound event',
  compoundEvent?.deltas.map(delta => delta.kind), ['document-view', 'grid-preference']);
compoundStore.getState().undo();
eq('Eén undo herstelt de documentview van vóór de layout',
  JSON.stringify(compoundStore.getState().view), compoundBeforeView);
eq('Dezelfde undo herstelt ook de volledige surfacevoorkeur',
  JSON.stringify(compoundStore.getState().taskGridSurfaces['full-task-grid']), compoundBeforeGrid);

storage.clear();
const oldLayouts: unknown[] = [{
  id: 'legacy-layout', name: 'Oud', columns: legacyDocumentColumns,
  group: [], sort: [], filter: null, timeScale: 'week',
}, {
  id: 'kapot', name: 'Kapot', columns: 'geen-array',
  group: [], sort: [], filter: null, timeScale: 'week',
}];
storage.setItem('ops-layouts', JSON.stringify(oldLayouts));
const migratedLayouts = await loadLayouts();
eq('Eén kapotte oude layout verbergt zijn geldige buren niet',
  migratedLayouts.map(layout => layout.id), ['legacy-layout']);
eq('Oude globale layout wordt lazy met opaque dynamiek gelezen', migratedLayouts[0]?.columns.map(column => column.id),
  ['task.name', 'legacy-activity-code:fase%3A1']);
const oldLayoutRaw = storage.getItem('ops-layouts');
await saveLayouts(migratedLayouts as Layout[]);
ok('Nieuwe layouts worden onder een versieerbare eigen sleutel opgeslagen',
  storage.getItem('ops-taskGridLayouts')?.includes('"version":1') === true);
eq('Expliciet opslaan laat de oude ops-layouts onaangeroerd', storage.getItem('ops-layouts'), oldLayoutRaw);
eq('De geldige legacy-layout blijft na expliciete save opnieuw bereikbaar',
  (await loadLayouts()).map(layout => layout.id), ['legacy-layout']);

if (diffs.length) {
  console.error(`XX task-grid-preferences: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK task-grid-preferences: ${checks}/${checks} checks groen`);
