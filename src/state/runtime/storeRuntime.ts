import { assertMinuteModelTaskDates } from '../migrations/minuteModel';
import { createSnapshot, type Snapshot } from '../snapshot';
import { currentAppState } from '../immerDraft';
import {
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
  recordDocumentDataHistoryDelta,
  recordSessionHistoryDeltas,
  type SessionHistoryEvent,
} from '../sessionHistory';
import type { AppState } from '../appStore';
import { markDateMutation } from '../scheduleStale';
import { markDocumentEdited } from '@/state/documentEdited';
import { emitExtensionEvent, type HostEventName } from '@/services/extensionEvents';
import type { RecomputedRemainingWork } from '@/engine/work/workRuleApply';
import { createPendingTextEdits, type PendingTextEdits } from '../pendingTextEdits';
import type { IfcOutputCompute } from '../prepareIfcOutput';
import type { IfcxClassify } from '@/services/fileAccess/foreignSourceTarget';

export const MAX_UNDO = MAX_SESSION_HISTORY_EVENTS_PER_SCOPE;

export interface McpTransactionLease {
  readonly token: symbol;
}

export interface StoreRuntimeOptions {
  emitHostEvents?: boolean;
  pendingTextEdits?: PendingTextEdits;
  ifcSaveCompute?: IfcOutputCompute;
  ifcxClassify?: IfcxClassify;
}

interface ActiveMcpLease extends McpTransactionLease {
  timephasedLossTaskIds: Set<string>;
  recomputedWork: RecomputedRemainingWork[];
}

interface PendingDocumentMutation {
  before: Snapshot;
  documentId: string;
  label: string;
  coalesceKey: string | null;
  depth: number;
  edited: boolean;
}

interface CoalesceMarker {
  key: string;
  eventId: string;
  documentId: string;
  sequence: number;
  recomputedWork?: RecomputedRemainingWork[];
}

export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string; label?: string }): void;
  finishUndoable(state: AppState, opts?: { nonEdit?: true }): SessionHistoryEvent | null;
  finishMutation(state: AppState, opts?: { stale?: boolean }): void;
  refreshLatestDocumentDataHistoryAfter(state: AppState): boolean;
  recordDocumentDataHistory(
    state: AppState,
    before: Snapshot,
    documentId: string,
    label?: string,
  ): SessionHistoryEvent | null;
  resetUndoCoalescing(): void;
  finishPendingTextEdits(): void;
  readonly ifcSaveCompute: IfcOutputCompute | undefined;
  readonly ifcxClassify: IfcxClassify | undefined;
  openHistorySession(): string;
  endHistorySession(key: string): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  deferViewRows(): boolean;
  takeDeferredViewRows(): boolean;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  recordMcpRecomputedWork(lease: McpTransactionLease, items: readonly RecomputedRemainingWork[]): void;
  mcpRecomputedWork(lease: McpTransactionLease): readonly RecomputedRemainingWork[];
  coalescedRecomputedWork(coalesceKey: string): readonly RecomputedRemainingWork[];
  setCoalescedRecomputedWork(coalesceKey: string, items: readonly RecomputedRemainingWork[]): void;
  exitMcpTransaction(lease: McpTransactionLease): void;
  mutationSeq(): number;
  emitHostEvent(event: HostEventName, data?: unknown): void;
}

function snapshotOfCurrentState(state: AppState): Snapshot {
  return createSnapshot(currentAppState(state));
}

export function snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
  for (const key of Object.keys(left) as (keyof Snapshot)[]) {
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
}

export function createStoreRuntime(opts?: StoreRuntimeOptions): StoreRuntime {
  const pendingTextEdits = opts?.pendingTextEdits ?? createPendingTextEdits();
  const pendingByDraft = new WeakMap<object, PendingDocumentMutation>();
  let coalesce: CoalesceMarker | null = null;
  let batchDepth = 0;
  let viewRowsDeferred = false;
  let activeMcpLease: ActiveMcpLease | null = null;
  let activeHistorySession: string | null = null;
  let historySessionCounter = 0;
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
        edited: false,
      });
    },

    finishUndoable(state, opts) {
      const draftKey = state as object;
      const pending = pendingByDraft.get(draftKey);
      if (!pending) return null;
      const nonEdit = opts?.nonEdit === true && !pending.edited;
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
        && state.nextHistorySequence === coalesce.sequence + 1
        && replaceCoalescedAfter(state, coalesce, after);
      if (compatible) {
        return state.historyEvents.find(event => event.id === coalesce?.eventId) ?? null;
      }

      const event = recordSessionHistoryDeltas(state, pending.label, [{
        kind: 'document-data',
        documentId: pending.documentId,
        before: pending.before,
        after,
        ...(nonEdit ? { nonEdit: true as const } : {}),
      }], activeHistorySession ?? undefined);
      coalesce = pending.coalesceKey && event
        ? { key: pending.coalesceKey, eventId: event.id, documentId: pending.documentId, sequence: event.sequence }
        : null;
      return event;
    },

    finishMutation(state, opts) {
      if (import.meta.env?.DEV) assertMinuteModelTaskDates(state.tasks);
      const pending = pendingByDraft.get(state as object);
      if (pending) pending.edited = true;
      markDocumentEdited(state);
      if (opts?.stale) markDateMutation(state);
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
      return recordDocumentDataHistoryDelta(state, label, documentId, before, after);
    },

    finishPendingTextEdits() {
      pendingTextEdits.finish();
    },
    ifcSaveCompute: opts?.ifcSaveCompute,
    ifcxClassify: opts?.ifcxClassify,
    resetUndoCoalescing() {
      coalesce = null;
    },

    openHistorySession() {
      historySessionCounter++;
      activeHistorySession = `history-session-${historySessionCounter}`;
      return activeHistorySession;
    },

    endHistorySession(key) {
      if (activeHistorySession === key) activeHistorySession = null;
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

    deferViewRows() {
      if (batchDepth === 0) return false;
      viewRowsDeferred = true;
      return true;
    },

    takeDeferredViewRows() {
      const deferred = viewRowsDeferred;
      viewRowsDeferred = false;
      return deferred;
    },

    enterMcpTransaction() {
      if (activeMcpLease) {
        throw new Error('MCP transaction is not re-entrant within the same store runtime');
      }
      const lease: ActiveMcpLease = {
        token: Symbol('mcp-transaction'),
        timephasedLossTaskIds: new Set<string>(),
        recomputedWork: [],
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

    recordMcpRecomputedWork(lease, items) {
      if (items.length > 0) requireActiveLease(lease).recomputedWork.push(...items);
    },

    mcpRecomputedWork(lease) {
      return requireActiveLease(lease).recomputedWork;
    },

    coalescedRecomputedWork(coalesceKey) {
      return coalesce?.key === coalesceKey ? coalesce.recomputedWork ?? [] : [];
    },

    setCoalescedRecomputedWork(coalesceKey, items) {
      if (coalesce?.key === coalesceKey) coalesce.recomputedWork = [...items];
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
