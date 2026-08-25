import { readFileSync } from 'node:fs';
import { createAppStore } from '@/state/appStore';
import { createSnapshot, type Snapshot } from '@/state/snapshot';
import {
  materializeHistoryTarget,
  type SessionHistoryDelta,
  type ViewLayoutHistoryState,
} from '@/state/sessionHistory';
import { computeResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { TaskColumnId, TaskGridSurfacePreferences } from '@/types/taskGrid';

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

type SnapshotContainsResourceLoad = 'resourceLoadResult' extends keyof Snapshot ? true : false;
const snapshotExcludesResourceLoad:
  SnapshotContainsResourceLoad extends false ? true : never = true;
void snapshotExcludesResourceLoad;

const store = createAppStore();
const S = () => store.getState();
S().newProject();
const taskId = S().addTask({ name: 'Doel voor history' });
S().runCPM();
const resourceId = S().addResource({
  name: 'Ploeg history', type: 'LABOR', description: '', maxUnits: 1,
});
S().assignResource(taskId, resourceId, 2);
S().updateTask(taskId, { name: 'Doel voor history — stale maar berekend' });

const targetSnapshot = createSnapshot(S());
const targetCpm = targetSnapshot.cpmResult;
const expectedLoad = computeResourceLoad(
  targetSnapshot.resources,
  targetSnapshot.assignments,
  targetSnapshot.tasks,
  targetSnapshot.calendar,
  targetSnapshot.calendars,
);
ok('Opzet draagt een berekende CPM-uitkomst', targetCpm !== null);
eq('Opzet draagt bewust de stale-vlag naast die oude berekening', targetSnapshot.scheduleStale, true);
ok('Opzet heeft aantoonbare resourcebelasting', Object.keys(expectedLoad.load[resourceId] ?? {}).length > 0);
ok('Nieuwe Snapshot-vorm heeft runtime geen resourceLoadResult-key',
  !('resourceLoadResult' in targetSnapshot));

const poison: ResourceLoadResult = {
  load: { fout: { '1900-01-01': 999 } },
  capacity: { fout: { '1900-01-01': 0 } },
  overallocatedDays: { fout: ['1900-01-01'] },
};
store.setState(state => {
  state.tasks = [];
  state.resources = [];
  state.assignments = [];
  state.cpmResult = null;
  state.scheduleStale = false;
  state.viewRows = [];
  state.resourceLoadResult = poison;
});
const liveBeforeMaterialize = {
  tasks: S().tasks,
  resources: S().resources,
  assignments: S().assignments,
  cpmResult: S().cpmResult,
  scheduleStale: S().scheduleStale,
  viewRows: S().viewRows,
  resourceLoadResult: S().resourceLoadResult,
};
const dataDelta: SessionHistoryDelta = {
  kind: 'document-data',
  documentId: S().activeDocumentId,
  before: targetSnapshot,
  after: targetSnapshot,
};
const materializedData = materializeHistoryTarget(S(), dataDelta, 'before');
ok('Documentdata materialiseert als documentdata', materializedData.kind === 'document-data');
if (materializedData.kind === 'document-data') {
  eq('CPM-uitkomst komt exact uit het historytarget', materializedData.snapshot.cpmResult, targetCpm);
  eq('scheduleStale komt exact uit het historytarget', materializedData.snapshot.scheduleStale, true);
  eq('Belasting wordt uit targetbronnen opnieuw afgeleid', materializedData.resourceLoadResult, expectedLoad);
  ok('Zichtbare rijen worden uit de targettaken opnieuw afgeleid',
    materializedData.viewRows.some(row => row.kind === 'task' && row.task.id === taskId));
  eq('Kalendercache volgt de herstelde projectkalenderbibliotheek',
    materializedData.snapshot.calendar,
    materializedData.snapshot.calendars.find(calendar =>
      calendar.id === materializedData.snapshot.project.calendarId));
  eq('Alleen documentdata markeert het publicatietarget dirty', materializedData.isDirty, true);
}
eq('Pure materialisatie laat de live bronstate byte-identiek', {
  tasks: S().tasks,
  resources: S().resources,
  assignments: S().assignments,
  cpmResult: S().cpmResult,
  scheduleStale: S().scheduleStale,
  viewRows: S().viewRows,
  resourceLoadResult: S().resourceLoadResult,
}, liveBeforeMaterialize);

const viewStore = createAppStore();
const V = () => viewStore.getState();
V().newProject();
const alphaId = V().addTask({ name: 'Alpha zichtbaar' });
V().addTask({ name: 'Beta verborgen' });
const baseViewTarget: ViewLayoutHistoryState = {
  filter: null,
  group: [],
  sort: [],
  zoom: 30,
  scrollX: 0,
  timeScale: 'week',
  collapsedGroupKeys: [],
};
const filteredViewTarget: ViewLayoutHistoryState = {
  ...baseViewTarget,
  filter: {
    kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'contains', value: 'Alpha',
  },
  zoom: 77,
  scrollX: 123,
};
const viewDelta: SessionHistoryDelta = {
  kind: 'document-view',
  documentId: V().activeDocumentId,
  before: baseViewTarget,
  after: filteredViewTarget,
};
const liveViewBefore = JSON.stringify(V().view);
const materializedView = materializeHistoryTarget(V(), viewDelta, 'after');
ok('Documentview materialiseert als documentview', materializedView.kind === 'document-view');
if (materializedView.kind === 'document-view') {
  eq('Viewtarget blijft exact de afgesproken subset', materializedView.view, filteredViewTarget);
  eq('Viewmaterialisatie leidt rijen af tegen het nieuwe filter',
    materializedView.viewRows.filter(row => row.kind === 'task').map(row =>
      row.kind === 'task' ? row.task.id : null), [alphaId]);
  eq('Documentview maakt het document niet dirty', materializedView.isDirty, false);
}
eq('Viewmaterialisatie muteert de huidige view niet', JSON.stringify(V().view), liveViewBefore);

const gridBefore: TaskGridSurfacePreferences = {
  columns: [{ id: 'task.name' as TaskColumnId, width: 180, pinned: false }], scrollX: 0,
};
const gridAfter: TaskGridSurfacePreferences = {
  columns: [{ id: 'task.wbsCode' as TaskColumnId, width: 90, pinned: true }], scrollX: 44,
};
const gridDelta: SessionHistoryDelta = {
  kind: 'grid-preference', surface: 'full-task-grid', before: gridBefore, after: gridAfter,
};
const materializedGridBefore = materializeHistoryTarget(V(), gridDelta, 'before');
const materializedGridAfter = materializeHistoryTarget(V(), gridDelta, 'after');
ok('Gridvoorkeur materialiseert als gridvoorkeur', materializedGridAfter.kind === 'grid-preference');
if (materializedGridBefore.kind === 'grid-preference' && materializedGridAfter.kind === 'grid-preference') {
  eq('Before-zijde kiest exact de oude gridvoorkeur', materializedGridBefore.preferences, gridBefore);
  eq('After-zijde kiest exact de nieuwe gridvoorkeur', materializedGridAfter.preferences, gridAfter);
  eq('Gridvoorkeur maakt het document niet dirty', materializedGridAfter.isDirty, false);
}

// Tijdelijke compatibiliteitsroute: de bestaande stack-undo moet vanaf Task 4B dezelfde pure
// materializer gebruiken. Een oude/hostile snapshot mag nog een stale derived key dragen; die moet
// worden genegeerd en uit de herstelde brondata opnieuw worden berekend.
const integrationStore = createAppStore();
const I = () => integrationStore.getState();
I().newProject();
const integrationTaskId = I().addTask({ name: 'Undo-doel' });
I().runCPM();
const integrationResourceId = I().addResource({
  name: 'Undo-ploeg', type: 'LABOR', description: '', maxUnits: 1,
});
I().assignResource(integrationTaskId, integrationResourceId, 2);
I().updateTask(integrationTaskId, { name: 'Undo-doel stale' });
const expectedUndoCpm = I().cpmResult;
const expectedUndoStale = I().scheduleStale;
I().removeResource(integrationResourceId);
integrationStore.setState(state => {
  const index = state.undoStack.length - 1;
  state.undoStack[index] = {
    ...state.undoStack[index], resourceLoadResult: poison,
  } as Snapshot & { resourceLoadResult: ResourceLoadResult };
  state.cpmResult = null;
  state.scheduleStale = false;
  state.viewRows = [];
  state.resourceLoadResult = null;
});
I().undo();
eq('Compat-undo herstelt exact de opgeslagen CPM-uitkomst', I().cpmResult, expectedUndoCpm);
eq('Compat-undo herstelt exact de opgeslagen stale-vlag', I().scheduleStale, expectedUndoStale);
ok('Compat-undo leidt viewRows vóór publicatie opnieuw af',
  I().viewRows.some(row => row.kind === 'task' && row.task.id === integrationTaskId));
ok('Compat-undo negeert poisoned snapshotload en leidt echte belasting af',
  Object.keys(I().resourceLoadResult?.load[integrationResourceId] ?? {}).length > 0
  && !('fout' in (I().resourceLoadResult?.load ?? {})));
I().redo();
ok('Compat-redo leidt ook de resource-loze eindtoestand af',
  !I().resources.some(resource => resource.id === integrationResourceId)
  && Object.keys(I().resourceLoadResult?.load ?? {}).length === 0);

const source = readFileSync('src/state/sessionHistory.ts', 'utf8');
for (const forbidden of ['useAppStore', 'createAppStore', 'runCPM', 'solveProject', '.setState(']) {
  ok(`Pure materializer bevat geen live-store-/solverroute: ${forbidden}`, !source.includes(forbidden));
}

if (diffs.length > 0) {
  console.error(`FAIL history-materialization: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  history-materialization: ${checks}/${checks}`);
}
