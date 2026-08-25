import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { ViewState } from '@/types/view';
import type { AppState } from './appStore';
import { deriveViewRows } from './slices/viewSlice';
import { computeResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { ViewRow } from '@/engine/view/visibleRows';

export const MAX_SESSION_HISTORY_EVENTS_PER_SCOPE = 100;

export type HistoryScopeKey = `document:${string}` | `grid:${TaskGridSurfaceId}`;

export type ViewLayoutHistoryState = Pick<
  ViewState,
  'filter' | 'group' | 'sort' | 'zoom' | 'scrollX' | 'timeScale' | 'collapsedGroupKeys'
>;

export type SessionHistoryDelta =
  | { kind: 'document-data'; documentId: string; before: Snapshot; after: Snapshot }
  | {
      kind: 'document-view';
      documentId: string;
      before: ViewLayoutHistoryState;
      after: ViewLayoutHistoryState;
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
      resourceLoadResult: ResourceLoadResult;
      isDirty: true;
    }
  | {
      kind: 'document-view';
      documentId: string;
      view: ViewLayoutHistoryState;
      viewRows: ViewRow[];
      isDirty: false;
    }
  | {
      kind: 'grid-preference';
      surface: TaskGridSurfaceId;
      preferences: TaskGridSurfacePreferences;
      isDirty: false;
    };

/** Leg uitsluitend de undoable viewsubset vast; tijdelijke focus-/fit-/scrollY-state blijft erbuiten. */
export function captureViewLayoutHistoryState(view: Readonly<ViewState>): ViewLayoutHistoryState {
  return {
    filter: view.filter == null ? null : JSON.parse(JSON.stringify(view.filter)) as ViewState['filter'],
    group: view.group.map(level => ({ ...level, field: { ...level.field } })),
    sort: view.sort.map(level => ({ ...level, field: { ...level.field } })),
    zoom: view.zoom,
    scrollX: view.scrollX,
    timeScale: view.timeScale,
    collapsedGroupKeys: [...view.collapsedGroupKeys],
  };
}

/**
 * Bouw het volledige doel buiten de live store. Datahistory herstelt eerst alle snapshotbronnen en
 * de kalendercache op een ondiepe geïsoleerde state; pas daarna worden rijen en belasting afgeleid.
 * De handmatig berekende CPM-uitkomst en stale-vlag komen letterlijk uit het snapshot.
 */
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
      resourceLoadResult: computeResourceLoad(
        isolated.resources,
        isolated.assignments,
        isolated.tasks,
        isolated.calendar,
        isolated.calendars,
      ),
      isDirty: true,
    };
  }

  if (delta.kind === 'document-view') {
    const view = delta[side];
    const isolated = { ...state, view: { ...state.view, ...view } } as AppState;
    return {
      kind: 'document-view',
      documentId: delta.documentId,
      view,
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

/**
 * Een event is de kleinste undo-eenheid. Twee documenten in hetzelfde event zouden nooit atomair
 * toepasbaar zijn wanneer maar één document actief kan zijn, en zijn daarom ongeldige input.
 */
export function assertValidSessionHistoryEvent(event: SessionHistoryEvent): void {
  if (event.deltas.length === 0) {
    throw new Error(`History-event ${event.id || '<zonder id>'} bevat geen deltas`);
  }
  // `sequence` is een oplopende sessieteller, geen willekeurig ranggetal. Met NaN zouden zowel
  // hoogste-undo als laagste-redo stil afhankelijk worden van arrayvolgorde; onveilige integers
  // kunnen bij het ophogen bovendien gelijk gaan lijken door IEEE-754-afronding.
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

/** De enige afleiding van scopes. Events bewaren bewust geen tweede scopes-array. */
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

/** Grid-only events zijn globaal; ieder event met documentdata hoort bij het actieve document. */
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

/** Puur beschikbaarheidssignaal voor lint, titelbalk en sneltoetsen. */
export function canUndo(state: SessionHistoryProjectionState): boolean {
  return selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

/** Puur beschikbaarheidssignaal voor lint, titelbalk en sneltoetsen. */
export function canRedo(state: SessionHistoryProjectionState): boolean {
  return selectRedoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

/** Alleen werkelijk toepasbare events tellen mee; history van slapende documenten blijft buiten beeld. */
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

/** Laatste toegepaste documentdatasprong voor gerichte contract-/sharingtests. */
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

/**
 * Een nieuwe wijziging wist alleen undone events met een overlappende scope. Bij een botsing
 * verdwijnt het hele oude event, zodat een compound nooit half opnieuw toepasbaar wordt.
 */
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

/**
 * Behoud de nieuwste honderd events per scope. Een compound blijft staan zolang het nog tot de
 * nieuwste honderd van minimaal één eigen scope behoort; pas buiten al zijn scopes valt het weg.
 * De geretourneerde array behoudt de oorspronkelijke opslagvolgorde.
 */
export function pruneSessionHistory(
  events: readonly SessionHistoryEvent[],
): SessionHistoryEvent[] {
  const ranked = events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => right.event.sequence - left.event.sequence || right.index - left.index);
  const seenPerScope = new Map<HistoryScopeKey, number>();
  const keep = new Set<number>();

  for (const { event, index } of ranked) {
    const scopes = scopeKeysOf(event);
    if (scopes.some(scope => (seenPerScope.get(scope) ?? 0) < MAX_SESSION_HISTORY_EVENTS_PER_SCOPE)) {
      keep.add(index);
    }
    for (const scope of scopes) seenPerScope.set(scope, (seenPerScope.get(scope) ?? 0) + 1);
  }

  return events.filter((_event, index) => keep.has(index));
}

/** Gemeenschappelijke pure registratiegrens voor latere storetaken. */
export function appendSessionHistoryEvent(
  events: readonly SessionHistoryEvent[],
  newEvent: SessionHistoryEvent,
): SessionHistoryEvent[] {
  assertValidSessionHistoryEvent(newEvent);
  if (newEvent.state !== 'applied') {
    throw new Error(`Nieuw history-event ${newEvent.id || '<zonder id>'} moet toegepast zijn`);
  }
  if (events.some(event => event.id === newEvent.id)) {
    // Alleen de actuele ledger hoeft uniek te zijn: een gepruned event is niet meer selecteerbaar
    // en heeft nergens een blijvende verwijzing. Task 4C laat ids door de sessiegenerator maken en
    // bewaart daarnaast `nextHistorySequence`, dat juist onafhankelijk van pruning blijft oplopen.
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

/**
 * Storegerichte maar synchrone registratieprimitief. De teller blijft oplopen wanneer pruning oude
 * events verwijdert; ids zijn daardoor sessie-uniek zonder een tweede moduleglobale generator.
 */
export function recordSessionHistoryDeltas(
  state: AppState,
  label: string,
  deltas: readonly SessionHistoryDelta[],
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
  };
  state.historyEvents = appendSessionHistoryEvent(state.historyEvents, event);
  state.nextHistorySequence = sequence + 1;
  return event;
}

/** Verwijder undone events die één van de opgegeven scopes raken; compounds verdwijnen geheel. */
export function invalidateUndoneHistoryForScopes(
  events: readonly SessionHistoryEvent[],
  scopes: ReadonlySet<HistoryScopeKey>,
): SessionHistoryEvent[] {
  return events.filter(event =>
    event.state !== 'undone' || !scopeKeysOf(event).some(scope => scopes.has(scope)));
}

/** Verwijder ieder atomair event dat naar het document wijst; een compound verdwijnt als geheel. */
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

export function replaceSessionHistoryState(
  state: AppState,
  events: SessionHistoryEvent[],
  nextHistorySequence: number,
): void {
  state.historyEvents = events;
  state.nextHistorySequence = nextHistorySequence;
}

/**
 * Materialiseer alle deltas in eventvolgorde tegen één geïsoleerd voortschrijdend doel. Dit houdt
 * ook een toekomstig data+view-compound correct: de viewrijen worden dan tegen de herstelde data
 * afgeleid, niet tegen de oude live bron.
 */
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
