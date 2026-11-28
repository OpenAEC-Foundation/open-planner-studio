import { isDraft, original } from 'immer';
import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { LayoutOverlays, ViewState } from '@/types/view';
import type { AppState } from './appStore';
import { deriveViewRows } from './viewRows';
import { sameTaskGridColumns } from '@/engine/taskGrid/preferences';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { ViewRow } from '@/engine/view/visibleRows';

export const MAX_SESSION_HISTORY_EVENTS_PER_SCOPE = 100;

export const MAX_SESSION_HISTORY_BYTES = 200 * 1024 * 1024;
export const MIN_SESSION_HISTORY_EVENTS_PER_SCOPE = 10;

const BYTES_PER_CHANGED_ITEM = 300;
const BYTES_PER_CPM_TASK = 1250;
const BYTES_PER_BASELINE_TASK = 176;
const BYTES_PER_ARRAY_SLOT = 8;
const BYTES_PER_OTHER_CHANGE = 1024;

function snapshotChangeBytes(before: Snapshot, after: Snapshot): number {
  let bytes = 0;
  for (const key of Object.keys(after) as (keyof Snapshot)[]) {
    const a = after[key];
    const b = before[key];
    if (a === b) continue;
    if (Array.isArray(a)) {
      const old = new Set<unknown>(Array.isArray(b) ? b : []);
      let changed = 0;
      let baselineTasks = 0;
      for (const item of a) {
        if (old.has(item)) continue;
        changed++;
        if (key === 'baselines') baselineTasks += (item as { tasks?: unknown[] }).tasks?.length ?? 0;
      }
      bytes += a.length * BYTES_PER_ARRAY_SLOT + changed * BYTES_PER_CHANGED_ITEM + baselineTasks * BYTES_PER_BASELINE_TASK;
    } else if (key === 'cpmResult' && a) {
      bytes += ((a as NonNullable<Snapshot['cpmResult']>).tasks?.size ?? 0) * BYTES_PER_CPM_TASK;
    } else {
      bytes += BYTES_PER_OTHER_CHANGE;
    }
  }
  return bytes;
}

const eventBytesCache = new WeakMap<SessionHistoryEvent, number>();
export function estimateSessionHistoryEventBytes(draftOrEvent: SessionHistoryEvent): number {
  const event = isDraft(draftOrEvent) ? (original(draftOrEvent) as SessionHistoryEvent) : draftOrEvent;
  const cached = eventBytesCache.get(event);
  if (cached !== undefined) return cached;
  let bytes = 0;
  for (const delta of event.deltas) {
    bytes += delta.kind === 'document-data' ? snapshotChangeBytes(delta.before, delta.after) : BYTES_PER_OTHER_CHANGE;
  }
  eventBytesCache.set(event, bytes);
  return bytes;
}

export type HistoryScopeKey = `document:${string}` | `grid:${TaskGridSurfaceId}`;

export type ViewLayoutHistoryState = Pick<
  ViewState,
  'filter' | 'group' | 'sort' | 'zoom' | 'scrollX' | 'timeScale' | 'collapsedGroupKeys'
  | 'showRelations' | 'layoutSession'
>;

export type SessionHistoryDelta =
  | {
      kind: 'document-data';
      documentId: string;
      before: Snapshot;
      after: Snapshot;
      nonEdit?: true;
    }
  | {
      kind: 'document-view';
      documentId: string;
      before: ViewLayoutHistoryState;
      after: ViewLayoutHistoryState;
      overlays?: { before: LayoutOverlays; after: LayoutOverlays };
    }
  | {
      kind: 'grid-preference';
      surface: TaskGridSurfaceId;
      before: TaskGridSurfacePreferences;
      after: TaskGridSurfacePreferences;
    };

export type DocumentDataHistoryDelta = Extract<SessionHistoryDelta, { kind: 'document-data' }>;

export interface SessionHistoryEvent {
  id: string;
  sequence: number;
  label: string;
  state: 'applied' | 'undone';
  deltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]];
  sessionKey?: string;
}

export type HistoryTargetSide = 'before' | 'after';

export interface SessionHistoryDepths {
  undoDepth: number;
  redoDepth: number;
}

export type MaterializedHistoryTarget =
  | {
      kind: 'document-data';
      documentId: string;
      snapshot: Snapshot;
      viewRows: ViewRow[];
      resourceLoadResult: ResourceLoadResult | null;
      isDirty: true;
      clearImportPristine: boolean;
    }
  | {
      kind: 'document-view';
      documentId: string;
      view: ViewLayoutHistoryState;
      overlays?: LayoutOverlays;
      viewRows: ViewRow[];
      isDirty: false;
    }
  | {
      kind: 'grid-preference';
      surface: TaskGridSurfaceId;
      preferences: TaskGridSurfacePreferences;
      isDirty: false;
    };

export function captureViewLayoutHistoryState(view: Readonly<ViewState>): ViewLayoutHistoryState {
  return {
    filter: view.filter == null ? null : JSON.parse(JSON.stringify(view.filter)) as ViewState['filter'],
    group: view.group.map(level => ({ ...level, field: { ...level.field } })),
    sort: view.sort.map(level => ({ ...level, field: { ...level.field } })),
    zoom: view.zoom,
    scrollX: view.scrollX,
    timeScale: view.timeScale,
    collapsedGroupKeys: [...view.collapsedGroupKeys],
    showRelations: view.showRelations,
    layoutSession: view.layoutSession,
  };
}

export function materializeHistoryTarget(
  state: Readonly<AppState>,
  delta: SessionHistoryDelta,
  side: HistoryTargetSide,
): MaterializedHistoryTarget {
  if (delta.kind === 'document-data') {
    const isolated = { ...state } as AppState;
    restoreSnapshot(isolated, delta[side]);
    const snapshot = createSnapshot(isolated);
    return {
      kind: 'document-data',
      documentId: delta.documentId,
      snapshot,
      viewRows: deriveViewRows(isolated),
      resourceLoadResult: computeReliableResourceLoad(
        isolated.cpmResult,
        isolated.resources,
        isolated.assignments,
        isolated.tasks,
        isolated.calendar,
        isolated.calendars,
        effectiveSchedulingOptions(isolated.project),
      ),
      isDirty: true,
      clearImportPristine: delta.nonEdit !== true,
    };
  }

  if (delta.kind === 'document-view') {
    const view = delta[side];
    const isolated = { ...state, view: { ...state.view, ...view } } as AppState;
    return {
      kind: 'document-view',
      documentId: delta.documentId,
      view,
      ...(delta.overlays ? { overlays: delta.overlays[side] } : {}),
      viewRows: deriveViewRows(isolated),
      isDirty: false,
    };
  }

  return {
    kind: 'grid-preference',
    surface: delta.surface,
    preferences: delta[side],
    isDirty: false,
  };
}

export function assertValidSessionHistoryEvent(event: SessionHistoryEvent): void {
  if (event.deltas.length === 0) {
    throw new Error(`History-event ${event.id || '<zonder id>'} bevat geen deltas`);
  }
  if (!Number.isSafeInteger(event.sequence) || event.sequence <= 0) {
    throw new Error(
      `History-event ${event.id || '<zonder id>'} heeft een ongeldige sequence: ${String(event.sequence)}`,
    );
  }

  const documentIds = new Set<string>();
  for (const delta of event.deltas) {
    if (delta.kind !== 'grid-preference') documentIds.add(delta.documentId);
  }
  if (documentIds.size > 1) {
    throw new Error(
      `History-event ${event.id || '<zonder id>'} raakt meerdere documenten: ${[...documentIds].join(', ')}`,
    );
  }
}

export function scopeKeysOf(event: SessionHistoryEvent): HistoryScopeKey[] {
  assertValidSessionHistoryEvent(event);
  const seen = new Set<HistoryScopeKey>();
  const scopes: HistoryScopeKey[] = [];

  for (const delta of event.deltas) {
    const scope: HistoryScopeKey = delta.kind === 'grid-preference'
      ? `grid:${delta.surface}`
      : `document:${delta.documentId}`;
    if (seen.has(scope)) continue;
    seen.add(scope);
    scopes.push(scope);
  }
  return scopes;
}

export function isSessionHistoryEventApplicable(
  event: SessionHistoryEvent,
  activeDocumentId: string | null,
): boolean {
  assertValidSessionHistoryEvent(event);
  for (const delta of event.deltas) {
    if (delta.kind !== 'grid-preference' && delta.documentId !== activeDocumentId) return false;
  }
  return true;
}

export function selectUndoHistoryEvent(
  events: readonly SessionHistoryEvent[],
  activeDocumentId: string | null,
): SessionHistoryEvent | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'applied' || !isSessionHistoryEventApplicable(event, activeDocumentId)) continue;
    if (selected === null || event.sequence > selected.sequence) selected = event;
  }
  return selected;
}

export function selectRedoHistoryEvent(
  events: readonly SessionHistoryEvent[],
  activeDocumentId: string | null,
): SessionHistoryEvent | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'undone' || !isSessionHistoryEventApplicable(event, activeDocumentId)) continue;
    if (selected === null || event.sequence < selected.sequence) selected = event;
  }
  return selected;
}

type SessionHistoryProjectionState = Pick<AppState, 'historyEvents' | 'activeDocumentId'>;

export function canUndo(state: SessionHistoryProjectionState): boolean {
  return selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

export function canRedo(state: SessionHistoryProjectionState): boolean {
  return selectRedoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

export function historyDepthsForActiveScope(
  state: SessionHistoryProjectionState,
): SessionHistoryDepths {
  let undoDepth = 0;
  let redoDepth = 0;
  for (const event of state.historyEvents) {
    if (!isSessionHistoryEventApplicable(event, state.activeDocumentId)) continue;
    if (event.state === 'applied') undoDepth++;
    else redoDepth++;
  }
  return { undoDepth, redoDepth };
}

export function latestAppliedDocumentDataDelta(
  state: SessionHistoryProjectionState,
): DocumentDataHistoryDelta | null {
  let selected: { sequence: number; delta: DocumentDataHistoryDelta } | null = null;
  for (const event of state.historyEvents) {
    if (event.state !== 'applied' || !isSessionHistoryEventApplicable(event, state.activeDocumentId)) continue;
    const delta = event.deltas.find((candidate): candidate is DocumentDataHistoryDelta =>
      candidate.kind === 'document-data' && candidate.documentId === state.activeDocumentId);
    if (delta && (selected === null || event.sequence > selected.sequence)) {
      selected = { sequence: event.sequence, delta };
    }
  }
  return selected?.delta ?? null;
}

export function invalidateUndoneHistoryForEvent(
  events: readonly SessionHistoryEvent[],
  newEvent: SessionHistoryEvent,
): SessionHistoryEvent[] {
  const newScopes = new Set(scopeKeysOf(newEvent));
  return events.filter(event => {
    if (event.state !== 'undone') {
      assertValidSessionHistoryEvent(event);
      return true;
    }
    return !scopeKeysOf(event).some(scope => newScopes.has(scope));
  });
}

export function pruneSessionHistory(
  events: readonly SessionHistoryEvent[],
  maxBytes: number = MAX_SESSION_HISTORY_BYTES,
): SessionHistoryEvent[] {
  const ranked = events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => right.event.sequence - left.event.sequence || right.index - left.index);
  const seenPerScope = new Map<HistoryScopeKey, number>();
  const keep = new Set<number>();
  let bytes = 0;
  let overBudget = false;
  let sessionFloor = Infinity;
  for (const event of events) {
    if (event.sessionKey !== undefined && event.sequence < sessionFloor) sessionFloor = event.sequence;
  }

  for (const { event, index } of ranked) {
    const scopes = scopeKeysOf(event);
    const within = (limit: number) => scopes.some(scope => (seenPerScope.get(scope) ?? 0) < limit);
    if (within(MAX_SESSION_HISTORY_EVENTS_PER_SCOPE)) {
      const eventBytes = estimateSessionHistoryEventBytes(event);
      if (!overBudget && bytes + eventBytes > maxBytes) overBudget = true;
      if (!overBudget || within(MIN_SESSION_HISTORY_EVENTS_PER_SCOPE) || event.sequence >= sessionFloor) {
        keep.add(index);
        bytes += eventBytes;
      }
    }
    for (const scope of scopes) seenPerScope.set(scope, (seenPerScope.get(scope) ?? 0) + 1);
  }

  return events.filter((_event, index) => keep.has(index));
}

export function appendSessionHistoryEvent(
  events: readonly SessionHistoryEvent[],
  newEvent: SessionHistoryEvent,
): SessionHistoryEvent[] {
  assertValidSessionHistoryEvent(newEvent);
  if (newEvent.state !== 'applied') {
    throw new Error(`Nieuw history-event ${newEvent.id || '<zonder id>'} moet toegepast zijn`);
  }
  if (events.some(event => event.id === newEvent.id)) {
    throw new Error(`History-event-id bestaat al: ${newEvent.id}`);
  }
  if (events.some(event => event.sequence === newEvent.sequence)) {
    throw new Error(`History-sequence bestaat al: ${newEvent.sequence}`);
  }
  const highestSequence = events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
  if (newEvent.sequence <= highestSequence) {
    throw new Error(
      `Nieuw history-event ${newEvent.id || '<zonder id>'} heeft geen oplopende sequence`,
    );
  }

  return pruneSessionHistory([
    ...invalidateUndoneHistoryForEvent(events, newEvent),
    newEvent,
  ]);
}

export function recordSessionHistoryDeltas(
  state: AppState,
  label: string,
  deltas: readonly SessionHistoryDelta[],
  sessionKey?: string,
): SessionHistoryEvent | null {
  if (deltas.length === 0) return null;
  const sequence = state.nextHistorySequence;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error(`Ongeldige volgende history-sequence: ${String(sequence)}`);
  }
  const event: SessionHistoryEvent = {
    id: `history-${sequence}`,
    sequence,
    label: label.trim() || 'Wijziging',
    state: 'applied',
    deltas: deltas as [SessionHistoryDelta, ...SessionHistoryDelta[]],
    ...(sessionKey ? { sessionKey } : {}),
  };
  state.historyEvents = appendSessionHistoryEvent(state.historyEvents, event);
  state.nextHistorySequence = sequence + 1;
  return event;
}

function cloneGridSurfacePreferences(
  preferences: Readonly<TaskGridSurfacePreferences>,
): TaskGridSurfacePreferences {
  return {
    columns: preferences.columns.map(column => ({ ...column })),
    scrollX: preferences.scrollX,
  };
}

function sameGridSurfacePreferences(
  left: Readonly<TaskGridSurfacePreferences>,
  right: Readonly<TaskGridSurfacePreferences>,
): boolean {
  return left.scrollX === right.scrollX && sameTaskGridColumns(left.columns, right.columns);
}

export function recordGridPreferenceHistoryDelta(
  state: AppState,
  label: string,
  surface: TaskGridSurfaceId,
  before: Readonly<TaskGridSurfacePreferences>,
  after: Readonly<TaskGridSurfacePreferences>,
): SessionHistoryEvent | null {
  if (sameGridSurfacePreferences(before, after)) return null;
  return recordSessionHistoryDeltas(state, label, [{
    kind: 'grid-preference',
    surface,
    before: cloneGridSurfacePreferences(before),
    after: cloneGridSurfacePreferences(after),
  }]);
}

export function recordDocumentDataHistoryDelta(
  state: AppState,
  label: string,
  documentId: string,
  before: Snapshot,
  after: Snapshot,
): SessionHistoryEvent {
  return recordSessionHistoryDeltas(state, label, [{
    kind: 'document-data', documentId, before, after,
  }])!;
}

export function invalidateDocumentRedo(
  state: { historyEvents: SessionHistoryEvent[] },
  documentId: string,
): void {
  const scope: HistoryScopeKey = `document:${documentId}`;
  state.historyEvents = invalidateUndoneHistoryForScopes(state.historyEvents, new Set([scope]));
}

export function invalidateUndoneHistoryForScopes(
  events: readonly SessionHistoryEvent[],
  scopes: ReadonlySet<HistoryScopeKey>,
): SessionHistoryEvent[] {
  return events.filter(event =>
    event.state !== 'undone' || !scopeKeysOf(event).some(scope => scopes.has(scope)));
}

export function removeSessionHistoryForDocument(
  events: readonly SessionHistoryEvent[],
  documentId: string,
): SessionHistoryEvent[] {
  return events.filter(event => !event.deltas.some(delta =>
    delta.kind !== 'grid-preference' && delta.documentId === documentId));
}

export function removeSessionHistoryForDocumentFromState(
  state: AppState,
  documentId: string,
): void {
  state.historyEvents = removeSessionHistoryForDocument(state.historyEvents, documentId);
}

export function rewriteDocumentHistorySnapshots(
  events: readonly SessionHistoryEvent[],
  documentId: string,
  rewrite: (snapshot: Snapshot) => Snapshot,
): SessionHistoryEvent[] {
  const rewritten = new Map<Snapshot, Snapshot>();
  const once = (snapshot: Snapshot): Snapshot => {
    let next = rewritten.get(snapshot);
    if (!next) {
      next = rewrite(snapshot);
      rewritten.set(snapshot, next);
    }
    return next;
  };
  return events.map((event) => {
    let changed = false;
    const deltas = event.deltas.map((delta) => {
      if (delta.kind !== 'document-data' || delta.documentId !== documentId) return delta;
      const before = once(delta.before);
      const after = once(delta.after);
      if (before === delta.before && after === delta.after) return delta;
      changed = true;
      return { ...delta, before, after };
    }) as unknown as SessionHistoryEvent['deltas'];
    return changed ? { ...event, deltas } : event;
  });
}

export function replaceSessionHistoryState(
  state: AppState,
  events: SessionHistoryEvent[],
  nextHistorySequence: number,
): void {
  state.historyEvents = events;
  state.nextHistorySequence = nextHistorySequence;
}

export function materializeHistoryEventTargets(
  state: Readonly<AppState>,
  event: SessionHistoryEvent,
  side: HistoryTargetSide,
): MaterializedHistoryTarget[] {
  let isolated = { ...state } as AppState;
  const targets: MaterializedHistoryTarget[] = [];
  for (const delta of event.deltas) {
    const target = materializeHistoryTarget(isolated, delta, side);
    targets.push(target);
    if (target.kind === 'document-data') {
      restoreSnapshot(isolated, target.snapshot);
      isolated.viewRows = target.viewRows;
      isolated.resourceLoadResult = target.resourceLoadResult;
    } else if (target.kind === 'document-view') {
      isolated.view = { ...isolated.view, ...target.view };
      isolated.viewRows = target.viewRows;
    } else {
      isolated.taskGridSurfaces = {
        ...isolated.taskGridSurfaces,
        [target.surface]: {
          columns: target.preferences.columns.map(column => ({ ...column })),
          scrollX: target.preferences.scrollX,
        },
      };
    }
  }
  return targets;
}
