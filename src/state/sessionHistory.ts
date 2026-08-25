import type { Snapshot } from './snapshot';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { ViewState } from '@/types/view';

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

export interface SessionHistoryEvent {
  id: string;
  sequence: number;
  label: string;
  state: 'applied' | 'undone';
  deltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]];
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
