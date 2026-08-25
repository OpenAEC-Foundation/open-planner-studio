import type { Snapshot } from '@/state/snapshot';
import type { TaskColumnId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { ViewLayoutHistoryState } from '@/state/sessionHistory';
import {
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
  appendSessionHistoryEvent,
  assertValidSessionHistoryEvent,
  invalidateUndoneHistoryForEvent,
  isSessionHistoryEventApplicable,
  pruneSessionHistory,
  scopeKeysOf,
  selectRedoHistoryEvent,
  selectUndoHistoryEvent,
  type SessionHistoryDelta,
  type SessionHistoryEvent,
} from '@/state/sessionHistory';

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

const snapshot = {} as Snapshot;
const view = {} as ViewLayoutHistoryState;
const surfacePreferences: TaskGridSurfacePreferences = {
  columns: [{ id: 'task.name' as TaskColumnId, width: 240, pinned: false }],
  scrollX: 0,
};

const dataDelta = (documentId: string): SessionHistoryDelta => ({
  kind: 'document-data', documentId, before: snapshot, after: snapshot,
});
const viewDelta = (documentId: string): SessionHistoryDelta => ({
  kind: 'document-view', documentId, before: view, after: view,
});
const gridDelta = (surface: 'gantt-task-grid' | 'full-task-grid'): SessionHistoryDelta => ({
  kind: 'grid-preference', surface, before: surfacePreferences, after: surfacePreferences,
});
const event = (
  id: string,
  sequence: number,
  deltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]],
  state: 'applied' | 'undone' = 'applied',
): SessionHistoryEvent => ({ id, sequence, label: id, state, deltas });

const a1 = event('A1', 1, [dataDelta('A')]);
const b1 = event('B1', 2, [viewDelta('B')]);
const g1 = event('G1', 3, [gridDelta('full-task-grid')]);
const compoundA = event('A+G', 4, [viewDelta('A'), gridDelta('gantt-task-grid')]);

eq('Documentdata leidt één documentscope af', scopeKeysOf(a1), ['document:A']);
eq('Documentview leidt dezelfde soort documentscope af', scopeKeysOf(b1), ['document:B']);
eq('Globale voorkeur leidt de juiste gridscope af', scopeKeysOf(g1), ['grid:full-task-grid']);
eq('Compound leidt beide scopes in deltavolgorde af', scopeKeysOf(compoundA),
  ['document:A', 'grid:gantt-task-grid']);
eq('Dubbele deltas van dezelfde scope worden niet dubbel opgeslagen',
  scopeKeysOf(event('A-tweemaal', 5, [dataDelta('A'), viewDelta('A')])), ['document:A']);

let rejectedTwoDocuments = false;
try {
  assertValidSessionHistoryEvent(event('A+B', 6, [dataDelta('A'), viewDelta('B')]));
} catch {
  rejectedTwoDocuments = true;
}
ok('Eén compound event met twee document-id’s wordt geweigerd', rejectedTwoDocuments);

for (const hostileSequence of [NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  let rejectedHostileSequence = false;
  try {
    assertValidSessionHistoryEvent(event('hostile-sequence', hostileSequence, [dataDelta('A')]));
  } catch {
    rejectedHostileSequence = true;
  }
  ok(`Sequence ${String(hostileSequence)} wordt als ongeldige tellerwaarde geweigerd`,
    rejectedHostileSequence);
}
let hostileSelectionRejected = false;
try {
  selectUndoHistoryEvent([
    event('NaN', NaN, [dataDelta('A')]),
    event('gezond', 1, [dataDelta('A')]),
  ], 'A');
} catch {
  hostileSelectionRejected = true;
}
ok('Selectie ordent geen geschiedenis waarin een niet-eindige sequence zit', hostileSelectionRejected);

ok('A1 is toepasbaar met A actief', isSessionHistoryEventApplicable(a1, 'A'));
ok('A1 is niet toepasbaar met B actief', !isSessionHistoryEventApplicable(a1, 'B'));
ok('B1 is toepasbaar met B actief', isSessionHistoryEventApplicable(b1, 'B'));
ok('G1 is met ieder document toepasbaar', isSessionHistoryEventApplicable(g1, 'A'));
ok('G1 is ook zonder actief document toepasbaar', isSessionHistoryEventApplicable(g1, null));
ok('Compound A+grid is alleen bij A toepasbaar',
  isSessionHistoryEventApplicable(compoundA, 'A') && !isSessionHistoryEventApplicable(compoundA, 'B'));

// De array staat bewust niet op sequence gesorteerd: sequence, niet opslagpositie, bepaalt de keuze.
const chronology = [g1, a1, b1];
eq('Undo met A actief kiest eerst de nieuwste globale G1',
  selectUndoHistoryEvent(chronology, 'A')?.id, 'G1');
const afterUndoG1 = chronology.map(item => item.id === 'G1' ? { ...item, state: 'undone' as const } : item);
eq('Na G1 kiest undo met A actief A1 en slaat het nieuwere B1 over',
  selectUndoHistoryEvent(afterUndoG1, 'A')?.id, 'A1');
const afterUndoA1 = afterUndoG1.map(item => item.id === 'A1' ? { ...item, state: 'undone' as const } : item);
eq('Redo met A actief kiest de laagste werkelijk undone sequence A1',
  selectRedoHistoryEvent(afterUndoA1, 'A')?.id, 'A1');
const afterRedoA1 = afterUndoA1.map(item => item.id === 'A1' ? { ...item, state: 'applied' as const } : item);
eq('Daarna wordt de later ongedaan gemaakte globale G1 opnieuw toegepast',
  selectRedoHistoryEvent(afterRedoA1, 'A')?.id, 'G1');
eq('Na wisselen naar B blijft B1 de toepasbare undo',
  selectUndoHistoryEvent(afterUndoA1, 'B')?.id, 'B1');
const afterUndoB1 = afterUndoA1.map(item => item.id === 'B1' ? { ...item, state: 'undone' as const } : item);
eq('Redo met B actief keert de werkelijke undo-volgorde om en kiest B1 vóór globale G1',
  selectRedoHistoryEvent(afterUndoB1, 'B')?.id, 'B1');
eq('Zonder toepasbaar event is de selectie null', selectRedoHistoryEvent([a1, b1], 'A'), null);

const invalidationFixture = [
  event('A-undone', 10, [dataDelta('A')], 'undone'),
  event('A-applied', 11, [viewDelta('A')]),
  event('B-undone', 12, [dataDelta('B')], 'undone'),
  event('full-undone', 13, [gridDelta('full-task-grid')], 'undone'),
  event('gantt-undone', 14, [gridDelta('gantt-task-grid')], 'undone'),
  event('B-full-undone', 15, [viewDelta('B'), gridDelta('full-task-grid')], 'undone'),
];
eq('Nieuwe A-wijziging wist alleen undone events die document A raken',
  invalidateUndoneHistoryForEvent(invalidationFixture, event('A2', 20, [dataDelta('A')])).map(item => item.id),
  ['A-applied', 'B-undone', 'full-undone', 'gantt-undone', 'B-full-undone']);
eq('Nieuwe full-gridwijziging wist ook een heel botsend compound event',
  invalidateUndoneHistoryForEvent(invalidationFixture, event('G2', 20, [gridDelta('full-task-grid')])).map(item => item.id),
  ['A-undone', 'A-applied', 'B-undone', 'gantt-undone']);
eq('Nieuwe compoundwijziging raakt de unie van zijn document- en gridscope',
  invalidateUndoneHistoryForEvent(invalidationFixture,
    event('A+gantt-2', 20, [viewDelta('A'), gridDelta('gantt-task-grid')])).map(item => item.id),
  ['A-applied', 'B-undone', 'full-undone', 'B-full-undone']);

const hundredAndOneA = Array.from({ length: 101 }, (_, index) =>
  event(`A-${index + 1}`, index + 1, [dataDelta('A')]));
const prunedA = pruneSessionHistory(hundredAndOneA);
eq('Pruning houdt exact de nieuwste honderd events van één scope', prunedA.length,
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE);
ok('Het oudste A-event valt buiten de honderd en verdwijnt', !prunedA.some(item => item.id === 'A-1'));
ok('Het nieuwste A-event blijft staan', prunedA.some(item => item.id === 'A-101'));

const oldCompound = event('oud-compound', 1, [dataDelta('A'), gridDelta('gantt-task-grid')]);
const hundredNewerA = Array.from({ length: 100 }, (_, index) =>
  event(`nieuwer-A-${index}`, index + 2, [dataDelta('A')]));
const ninetyNineNewerGrid = Array.from({ length: 99 }, (_, index) =>
  event(`nieuwer-grid-${index}`, index + 102, [gridDelta('gantt-task-grid')]));
ok('Compound blijft als hij nog in de nieuwste honderd van ten minste één scope valt',
  pruneSessionHistory([oldCompound, ...hundredNewerA, ...ninetyNineNewerGrid])
    .some(item => item.id === oldCompound.id));
ok('Compound verdwijnt pas buiten de nieuwste honderd van al zijn scopes',
  !pruneSessionHistory([
    oldCompound,
    ...hundredNewerA,
    ...ninetyNineNewerGrid,
    event('honderdste-nieuwere-grid', 201, [gridDelta('gantt-task-grid')]),
  ]).some(item => item.id === oldCompound.id));

const appended = appendSessionHistoryEvent(invalidationFixture, event('A2', 20, [dataDelta('A')]));
eq('Append combineert scopegerichte redo-invalidatie met één nieuw toegepast event',
  appended.map(item => item.id),
  ['A-applied', 'B-undone', 'full-undone', 'gantt-undone', 'B-full-undone', 'A2']);
eq('De pure append muteert zijn invoer niet', invalidationFixture.map(item => item.id),
  ['A-undone', 'A-applied', 'B-undone', 'full-undone', 'gantt-undone', 'B-full-undone']);
let rejectedUndoneAppend = false;
try {
  appendSessionHistoryEvent([], event('geen-nieuwe-undo', 1, [dataDelta('A')], 'undone'));
} catch {
  rejectedUndoneAppend = true;
}
ok('Een nieuw event moet toegepast binnenkomen', rejectedUndoneAppend);
let rejectedDuplicateIdentity = false;
try {
  appendSessionHistoryEvent([a1], event('A1', 2, [dataDelta('A')]));
} catch {
  rejectedDuplicateIdentity = true;
}
ok('Append weigert een reeds gebruikt event-id', rejectedDuplicateIdentity);
let rejectedNonIncreasingSequence = false;
try {
  appendSessionHistoryEvent([a1, b1], event('A3', 1.5, [dataDelta('A')]));
} catch {
  rejectedNonIncreasingSequence = true;
}
ok('Append bewaakt de oplopende sessiesequence', rejectedNonIncreasingSequence);

if (diffs.length > 0) {
  console.error(`FAIL session-history-model: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  session-history-model: ${checks}/${checks}`);
}
