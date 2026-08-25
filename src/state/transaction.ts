import { current, isDraft } from 'immer';
import { createSnapshot, type Snapshot } from './snapshot';
import {
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
  recordSessionHistoryDeltas,
  type SessionHistoryEvent,
} from './sessionHistory';
import type { AppState } from './appStore';

/** Bestaande publieke naam; de grens wordt nu per session-historyscope afgedwongen. */
export const MAX_UNDO = MAX_SESSION_HISTORY_EVENTS_PER_SCOPE;

interface PendingDocumentMutation {
  before: Snapshot;
  documentId: string;
  label: string;
  coalesceKey: string | null;
  depth: number;
}

interface CoalesceMarker {
  key: string;
  eventId: string;
  documentId: string;
}

/** Dezelfde Immer-draft komt bij begin en finish terug; WeakMap voorkomt lek tussen store-instanties. */
const pendingByDraft = new WeakMap<object, PendingDocumentMutation>();
let coalesce: CoalesceMarker | null = null;
let mcpTransactionActive = false;
let batchDepth = 0;

function snapshotOfCurrentState(state: AppState): Snapshot {
  if (!isDraft(state)) return createSnapshot(state);
  return createSnapshot(current(state) as AppState);
}

export function snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
  for (const key of Object.keys(left) as (keyof Snapshot)[]) {
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
}

/** Wis de lopende keyed reeks; undo/redo en documentwissels roepen dit expliciet aan. */
export function resetUndoCoalescing(): void {
  coalesce = null;
}

export function setMcpTransactionActive(active: boolean): void {
  mcpTransactionActive = active;
}

export function isBatchActive(): boolean {
  return batchDepth > 0;
}

export function enterBatch(): void {
  batchDepth++;
}

export function exitBatch(): void {
  if (batchDepth > 0) batchDepth--;
}

/**
 * Registreer een documentdata-event tegen een eerder vastgelegde begintoestand. Bulk- en
 * MCP-grenzen gebruiken dit na hun laatste producer, zodat ook een gedeeltelijk uitgevoerde bulk
 * exact zijn werkelijk bereikte eindstand krijgt.
 */
export function recordDocumentDataHistory(
  state: AppState,
  before: Snapshot,
  documentId: string,
  label = 'Wijziging',
): SessionHistoryEvent | null {
  const after = snapshotOfCurrentState(state);
  if (snapshotsEqual(before, after)) return null;
  return recordSessionHistoryDeltas(state, label, [{
    kind: 'document-data', documentId, before, after,
  }]);
}

/**
 * Compatibiliteitsgrens voor de bestaande mutators. De buitenste begin legt alleen de oude
 * documentdata vast; finish registreert pas na een werkelijk verschil één sessie-event.
 */
export function beginUndoable(
  state: AppState,
  opts?: { coalesceKey?: string; label?: string },
): void {
  if (mcpTransactionActive || batchDepth > 0) return;
  const draftKey = state as object;
  const pending = pendingByDraft.get(draftKey);
  if (pending) {
    pending.depth++;
    return;
  }
  pendingByDraft.set(draftKey, {
    before: createSnapshot(state),
    documentId: state.activeDocumentId,
    label: opts?.label?.trim() || opts?.coalesceKey || 'Wijziging',
    coalesceKey: opts?.coalesceKey ?? null,
    depth: 1,
  });
}

function replaceCoalescedAfter(
  state: AppState,
  marker: CoalesceMarker,
  after: Snapshot,
): boolean {
  const index = state.historyEvents.findIndex(event => event.id === marker.eventId);
  if (index < 0) return false;
  const event = state.historyEvents[index];
  if (event.state !== 'applied') return false;
  const deltaIndex = event.deltas.findIndex(delta =>
    delta.kind === 'document-data' && delta.documentId === marker.documentId);
  if (deltaIndex < 0) return false;
  const deltas = event.deltas.map((delta, currentIndex) => {
    if (currentIndex !== deltaIndex || delta.kind !== 'document-data') return delta;
    return { ...delta, after };
  }) as [SessionHistoryEvent['deltas'][number], ...SessionHistoryEvent['deltas'][number][]];
  state.historyEvents[index] = { ...event, deltas };
  return true;
}

/** Sluit een pending historyregistratie zonder zelf dirty- of stale-state te veranderen. */
export function finishUndoable(state: AppState): SessionHistoryEvent | null {
  const draftKey = state as object;
  const pending = pendingByDraft.get(draftKey);
  if (!pending) return null;
  if (pending.depth > 1) {
    pending.depth--;
    return null;
  }
  pendingByDraft.delete(draftKey);

  const after = snapshotOfCurrentState(state);
  if (snapshotsEqual(pending.before, after)) return null;

  const compatible = pending.coalesceKey !== null
    && coalesce?.key === pending.coalesceKey
    && coalesce.documentId === pending.documentId
    && replaceCoalescedAfter(state, coalesce, after);
  if (compatible) {
    return state.historyEvents.find(event => event.id === coalesce?.eventId) ?? null;
  }

  const event = recordSessionHistoryDeltas(state, pending.label, [{
    kind: 'document-data', documentId: pending.documentId, before: pending.before, after,
  }]);
  coalesce = pending.coalesceKey && event
    ? { key: pending.coalesceKey, eventId: event.id, documentId: pending.documentId }
    : null;
  return event;
}

/**
 * Werk de after-zijde van de nieuwste toegepaste datahandeling bij na een uitgestelde berekening.
 * De berekening is geen losse gebruikershandeling, maar hoort wel bij de toestand die redo later
 * exact moet herstellen. Binnen batch/MCP doet de omvattende grens dit zelf.
 */
export function refreshLatestDocumentDataHistoryAfter(state: AppState): boolean {
  if (mcpTransactionActive || batchDepth > 0) return false;
  let selectedIndex = -1;
  let selectedSequence = -1;
  for (let index = 0; index < state.historyEvents.length; index++) {
    const event = state.historyEvents[index];
    if (event.state !== 'applied' || event.sequence <= selectedSequence) continue;
    if (!event.deltas.some(delta =>
      delta.kind === 'document-data' && delta.documentId === state.activeDocumentId)) continue;
    selectedIndex = index;
    selectedSequence = event.sequence;
  }
  if (selectedIndex < 0) return false;

  const after = snapshotOfCurrentState(state);
  const event = state.historyEvents[selectedIndex];
  const deltas = event.deltas.map(delta =>
    delta.kind === 'document-data' && delta.documentId === state.activeDocumentId
      ? { ...delta, after }
      : delta) as [SessionHistoryEvent['deltas'][number], ...SessionHistoryEvent['deltas'][number][]];
  state.historyEvents[selectedIndex] = { ...event, deltas };
  return true;
}

/** Markeer dirty/stale en sluit de bijbehorende pending historyregistratie. */
export function finishMutation(state: AppState, opts?: { stale?: boolean }): void {
  state.isDirty = true;
  if (opts?.stale) state.scheduleStale = true;
  if (opts?.stale && state.datesAsRecorded) {
    state.datesAsRecorded = false;
    state.recordedDates = null;
  }
  finishUndoable(state);
}

/**
 * Niet-undoable bibliotheekverversingen veranderen toekomstige berekeninput. In de modus "datums
 * zoals opgeslagen" blijft de bestaande berekenstand leidend; daar mag de stale-vlag niet aan.
 */
export function markScheduleStale(state: { scheduleStale: boolean; datesAsRecorded: boolean }): void {
  if (state.datesAsRecorded) return;
  state.scheduleStale = true;
}
