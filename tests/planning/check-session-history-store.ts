import './domStub';
import { createAppStore } from '@/state/appStore';
import {
  canRedo,
  canUndo,
  captureViewLayoutHistoryState,
  historyDepthsForActiveScope,
  type SessionHistoryDelta,
} from '@/state/sessionHistory';
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

const cloneGrid = (value: TaskGridSurfacePreferences): TaskGridSurfacePreferences => ({
  columns: value.columns.map(column => ({ ...column })),
  scrollX: value.scrollX,
});

// A1, B1 en globale G1 blijven één chronologische sessie, maar documentevents zijn alleen
// toepasbaar wanneer hun eigen document actief is.
const chronology = createAppStore();
const C = () => chronology.getState();
C().newProject();
const documentA = C().activeDocumentId;
C().addTask({ name: 'A1' });
const documentB = C().newDocument();
C().addTask({ name: 'B1' });

const gridBefore = cloneGrid(C().taskGridSurfaces['full-task-grid']);
const gridAfter: TaskGridSurfacePreferences = {
  columns: [{ id: 'task.wbsCode' as TaskColumnId, width: 111, pinned: true }],
  scrollX: 42,
};
chronology.setState(state => {
  state.taskGridSurfaces['full-task-grid'] = cloneGrid(gridAfter);
});
C().recordSessionHistoryEvent('G1', [{
  kind: 'grid-preference', surface: 'full-task-grid', before: gridBefore, after: gridAfter,
}]);

eq('A1/B1/G1 leveren drie sessie-events', C().historyEvents.map(event => event.label),
  ['Wijziging', 'Wijziging', 'G1']);
eq('De globale teller loopt onafhankelijk van documentwissels op', C().nextHistorySequence, 4);
eq('Met B actief zijn B1 en G1 toepasbaar', historyDepthsForActiveScope(C()), { undoDepth: 2, redoDepth: 0 });
C().undo();
eq('Eerste undo met B actief draait globale G1 terug', C().taskGridSurfaces['full-task-grid'], gridBefore);
C().undo();
eq('Tweede undo met B actief draait B1 terug', C().tasks.length, 0);
eq('A1 bleef toegepast terwijl B actief was',
  C().historyEvents.find(event => event.sequence === 1)?.state, 'applied');
C().switchDocument(documentA);
eq('Na wisselen naar A is alleen A1 toepasbaar voor undo', historyDepthsForActiveScope(C()), { undoDepth: 1, redoDepth: 1 });
C().undo();
eq('Undo met A actief draait A1 terug', C().tasks.length, 0);
C().redo();
eq('Redo met A actief herstelt A1 vóór de globale G1', C().tasks.map(task => task.name), ['A1']);
C().switchDocument(documentB);
C().redo();
eq('Redo met B actief herstelt B1 vóór de later ongedane G1', C().tasks.map(task => task.name), ['B1']);
C().redo();
eq('Daarna herstelt redo de globale voorkeur', C().taskGridSurfaces['full-task-grid'], gridAfter);

// Document-view en persoonlijke gridvoorkeuren lopen via hetzelfde eventmodel, maar maken het
// project niet dirty. De view-publicatie moet ook de afgeleide rijen meteen laten kloppen.
const presentation = createAppStore();
const P = () => presentation.getState();
P().newProject();
const alphaId = P().addTask({ name: 'Alpha' });
P().addTask({ name: 'Beta' });
presentation.setState(state => { state.historyEvents = []; state.isDirty = false; });
const viewBefore = captureViewLayoutHistoryState(P().view);
const viewAfter = {
  ...viewBefore,
  filter: {
    kind: 'rule' as const,
    field: { src: 'builtin' as const, key: 'name' as const },
    operator: 'contains' as const,
    value: 'Alpha',
  },
  zoom: 77,
  scrollX: 123,
};
presentation.setState(state => { Object.assign(state.view, viewAfter); });
P().recomputeViewRows();
P().recordSessionHistoryEvent('B1', [{
  kind: 'document-view', documentId: P().activeDocumentId, before: viewBefore, after: viewAfter,
}]);
P().undo();
eq('View-undo publiceert exact de afgesproken viewsubset', captureViewLayoutHistoryState(P().view), viewBefore);
ok('View-undo leidt de zichtbare rijen in dezelfde stap opnieuw af',
  P().viewRows.filter(row => row.kind === 'task').length === 2);
eq('View-undo maakt een schoon document niet dirty', P().isDirty, false);
P().redo();
eq('View-redo herstelt de gefilterde occurrence',
  P().viewRows.filter(row => row.kind === 'task').map(row => row.kind === 'task' ? row.task.id : ''),
  [alphaId]);
eq('View-redo maakt een schoon document evenmin dirty', P().isDirty, false);

const preferenceBefore = cloneGrid(P().taskGridSurfaces['gantt-task-grid']);
const preferenceAfter: TaskGridSurfacePreferences = {
  columns: [{ id: 'task.name' as TaskColumnId, width: 333, pinned: false }],
  scrollX: 18,
};
presentation.setState(state => {
  state.taskGridSurfaces['gantt-task-grid'] = cloneGrid(preferenceAfter);
});
P().recordSessionHistoryEvent('grid', [{
  kind: 'grid-preference', surface: 'gantt-task-grid', before: preferenceBefore, after: preferenceAfter,
}]);
P().undo();
eq('Grid-undo herstelt de persoonlijke voorkeur', P().taskGridSurfaces['gantt-task-grid'], preferenceBefore);
eq('Grid-undo raakt dirty niet', P().isDirty, false);

// De bestaande mutatorgrens maakt één documentdata-event per gewone mutatie; keyed updates
// vervangen alleen de after-zijde van het compatibele laatste event.
const compatibility = createAppStore();
const K = () => compatibility.getState();
K().newProject();
const taskId = K().addTask({ name: 'begin' });
eq('Een gewone addTask maakt precies één event', K().historyEvents.length, 1);
const beforeGesture = K().historyEvents.length;
for (const name of ['sleep-1', 'sleep-2', 'sleep-3']) {
  K().updateTask(taskId, { name }, { coalesceKey: 'sleep:taak' });
}
eq('Drie keyed updates maken samen één nieuw event', K().historyEvents.length - beforeGesture, 1);
K().undo();
eq('Eén undo draait het volledige keyed gebaar terug', K().tasks.find(task => task.id === taskId)?.name, 'begin');
ok('Na undo is redo voor de actieve scope beschikbaar', canRedo(K()));
ok('Na een nieuwe mutatie is undo beschikbaar', canUndo(K()));

const labels = K().historyEvents.map(event => event.label);
ok('Elk event heeft een niet-leeg label', labels.every(Boolean));
ok('Session history staat app-globaal en niet in een documentpayload',
  !('historyEvents' in K().getOpenDocumentPayloads()[0].payload)
  && !('nextHistorySequence' in K().getOpenDocumentPayloads()[0].payload));
ok('Er bestaat geen legacy stack meer in een actieve documentpayload',
  !('undoStack' in K().getOpenDocumentPayloads()[0].payload)
  && !('redoStack' in K().getOpenDocumentPayloads()[0].payload));

const preparedDeltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]] = [{
  kind: 'grid-preference', surface: 'gantt-task-grid', before: preferenceBefore, after: preferenceAfter,
}];
void preparedDeltas;

if (diffs.length > 0) {
  console.error(`FAIL session-history-store: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  session-history-store: ${checks}/${checks}`);
}
