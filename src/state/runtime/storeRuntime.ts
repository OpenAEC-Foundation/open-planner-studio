import { createSnapshot, type Snapshot } from '../snapshot';
import { currentAppState } from '../immerDraft';
import {
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
  recordSessionHistoryDeltas,
  type SessionHistoryEvent,
} from '../sessionHistory';
import type { AppState } from '../appStore';
import { markScheduleStale } from '../scheduleStale';
import { emitExtensionEvent, type HostEventName } from '@/services/extensionEvents';

/** Bestaande publieke naam; de grens wordt per session-historyscope afgedwongen. */
export const MAX_UNDO = MAX_SESSION_HISTORY_EVENTS_PER_SCOPE;

export interface McpTransactionLease {
  readonly token: symbol;
}

export interface StoreRuntimeOptions {
  /** `false` ⇒ deze context zendt GEEN host-events uit (spec §5, rand (a)). Gebruikt door de
   *  scratch-instantie (`scratchDocument.ts`): extensies zijn app-globaal geregistreerd en zouden
   *  anders cijfers krijgen van een document waar de gebruiker niet naar kijkt. Default `true`. */
  emitHostEvents?: boolean;
}

interface ActiveMcpLease extends McpTransactionLease {
  timephasedLossTaskIds: Set<string>;
}

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

export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string; label?: string }): void;
  finishUndoable(state: AppState): SessionHistoryEvent | null;
  finishMutation(state: AppState, opts?: { stale?: boolean }): void;
  refreshLatestDocumentDataHistoryAfter(state: AppState): boolean;
  recordDocumentDataHistory(
    state: AppState,
    before: Snapshot,
    documentId: string,
    label?: string,
  ): SessionHistoryEvent | null;
  resetUndoCoalescing(): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  exitMcpTransaction(lease: McpTransactionLease): void;
  /**
   * Monotone teller die bij ELKE undoable mutatie in deze context omhoog gaat — óók bij een
   * gecoalesceerde mutatie, die bewust géén nieuw history-event oplevert (spec §6a). Bewust NIET
   * hetzelfde als `nextHistorySequence` of de eventtelling: een gecoalesceerde sleepreeks schrijft
   * alleen de `after` van een BESTAAND event bij (`replaceCoalescedAfter`), dus die tellers staan
   * dan stil; en `historyDepthsForActiveScope().undoDepth` is bovendien onbruikbaar omdat
   * `pruneSessionHistory` van onderaf trimt op `MAX_SESSION_HISTORY_EVENTS_PER_SCOPE`.
   *
   * Afnemer: de voorstel-invalidatie van de B1c-verdeeldialoog. Die combineert deze teller met de
   * REFERENTIES van de documentvelden waarop het voorstel gerekend heeft — de teller is de goedkope,
   * grofmazige backstop; de referenties maken de bewaking sluitend (`runCPM` muteert datums zonder
   * ooit langs `beginUndoable` te komen).
   */
  mutationSeq(): number;
  /**
   * Zend een host-lifecycle-event uit namens DEZE context (B1c-plan3 taak 5, spec §5 rand (a)).
   * Slices roepen dit aan in plaats van `emitExtensionEvent` rechtstreeks — de bus zelf blijft
   * app-globaal (dat hoort zo: extensies zijn app-niveau), maar of een context er iets op zet is nu
   * een eigenschap van die context. De scratch-instantie bouwt haar context met
   * `emitHostEvents: false`, zodat een efemere run op een slapend document geen extensie-luisteraar
   * bereikt.
   */
  emitHostEvent(event: HostEventName, data?: unknown): void;
}

/**
 * De NA-staat van een mutatie: binnen een producer moet dat de draft INCLUSIEF zijn mutaties zijn,
 * dus `current()` en niet de basis die `createSnapshot` zelf zou lezen. `currentAppState` levert
 * plain state op, waarna `createSnapshot` de velden gewoon per referentie deelt.
 */
function snapshotOfCurrentState(state: AppState): Snapshot {
  return createSnapshot(currentAppState(state));
}

export function snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
  for (const key of Object.keys(left) as (keyof Snapshot)[]) {
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
}

/**
 * Uitvoeringsmetadata van precies één storecontext. De globale sessiehistorie zit in AppState;
 * pending producers, coalescing, batchdiepte en MCP-leases blijven in deze contextclosure.
 */
export function createStoreRuntime(opts?: StoreRuntimeOptions): StoreRuntime {
  const pendingByDraft = new WeakMap<object, PendingDocumentMutation>();
  let coalesce: CoalesceMarker | null = null;
  let batchDepth = 0;
  let activeMcpLease: ActiveMcpLease | null = null;
  // B1c-plan3 taak 4 (spec §6a): monotone, per-context mutatieteller — zie het docblok bij
  // `StoreRuntime.mutationSeq`.
  let mutationSeq = 0;

  const requireActiveLease = (lease: McpTransactionLease): ActiveMcpLease => {
    if (activeMcpLease !== lease) {
      throw new Error('MCP-transactielease is niet actief voor deze store-runtime');
    }
    return activeMcpLease;
  };

  const replaceCoalescedAfter = (
    state: AppState,
    marker: CoalesceMarker,
    after: Snapshot,
  ): boolean => {
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
  };

  const runtime: StoreRuntime = {
    beginUndoable(state, opts) {
      // B1c-plan3 taak 4: de bump staat als EERSTE regel — vóór de batch-/lease-guard én vóór de
      // pending-tak. Een mutatie binnen een batch of MCP-transactie is nog steeds een mutatie, ook
      // al neemt de omvattende transactie het history-event; en een geneste of gecoalesceerde
      // mutatie (die géén nieuw event oplevert) is precies het geval waarvoor deze teller bestaat
      // — zie het docblok bij `StoreRuntime.mutationSeq`.
      mutationSeq++;

      if (batchDepth > 0 || activeMcpLease) return;
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
    },

    finishUndoable(state) {
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
        kind: 'document-data',
        documentId: pending.documentId,
        before: pending.before,
        after,
      }]);
      coalesce = pending.coalesceKey && event
        ? { key: pending.coalesceKey, eventId: event.id, documentId: pending.documentId }
        : null;
      return event;
    },

    finishMutation(state, opts) {
      state.isDirty = true;
      if (opts?.stale && state.datesAsRecorded) {
        state.datesAsRecorded = false;
        state.recordedDates = null;
      }
      if (opts?.stale) markScheduleStale(state);
      runtime.finishUndoable(state);
    },

    refreshLatestDocumentDataHistoryAfter(state) {
      if (activeMcpLease || batchDepth > 0) return false;
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
    },

    recordDocumentDataHistory(state, before, documentId, label = 'Wijziging') {
      const after = snapshotOfCurrentState(state);
      if (snapshotsEqual(before, after)) return null;
      return recordSessionHistoryDeltas(state, label, [{
        kind: 'document-data', documentId, before, after,
      }]);
    },

    resetUndoCoalescing() {
      coalesce = null;
    },

    isBatchActive() {
      return batchDepth > 0;
    },

    enterBatch() {
      batchDepth++;
    },

    exitBatch() {
      if (batchDepth > 0) batchDepth--;
    },

    enterMcpTransaction() {
      if (activeMcpLease) {
        throw new Error('MCP-transactie is niet herintreedbaar binnen dezelfde store-runtime');
      }
      const lease: ActiveMcpLease = {
        token: Symbol('mcp-transaction'),
        timephasedLossTaskIds: new Set<string>(),
      };
      activeMcpLease = lease;
      return lease;
    },

    recordMcpTimephasedLoss(lease, taskId) {
      requireActiveLease(lease).timephasedLossTaskIds.add(taskId);
    },

    countMcpTimephasedLoss(lease) {
      return requireActiveLease(lease).timephasedLossTaskIds.size;
    },

    exitMcpTransaction(lease) {
      requireActiveLease(lease);
      activeMcpLease = null;
    },

    mutationSeq() {
      return mutationSeq;
    },

    emitHostEvent: opts?.emitHostEvents === false ? () => {} : emitExtensionEvent,
  };

  return runtime;
}
