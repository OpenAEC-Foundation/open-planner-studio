import { createSnapshot } from '../snapshot';
import type { AppState } from '../appStore';

/** Bovengrens op de undo-historie; blijft gedeeld beleid, niet gedeelde uitvoeringsstate. */
export const MAX_UNDO = 100;

export interface McpTransactionLease {
  readonly token: symbol;
}

export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string }): void;
  pushUndoSnapshot(state: AppState, base?: AppState): void;
  resetUndoCoalescing(): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  exitMcpTransaction(lease: McpTransactionLease): void;
}

interface ActiveMcpLease extends McpTransactionLease {
  timephasedLossTaskIds: Set<string>;
}

/**
 * Uitvoeringsmetadata die bij precies één storecontext hoort.
 *
 * Coalescing, batchdiepte en MCP-suppressie zijn geen documentdata en horen dus niet in snapshots
 * of `DOCUMENT_FIELDS`. Ze mogen evenmin module-global zijn: dan kan een open batch in store B de
 * undo van store A onderdrukken. De closure houdt dezelfde semantiek lokaal per context.
 */
export function createStoreRuntime(): StoreRuntime {
  let coalesce: { key: string; seq: number; docId: string } | null = null;
  let undoSeq = 0;
  let batchDepth = 0;
  let activeMcpLease: ActiveMcpLease | null = null;

  const requireActiveLease = (lease: McpTransactionLease): ActiveMcpLease => {
    if (activeMcpLease !== lease) {
      throw new Error('MCP-transactielease is niet actief voor deze store-runtime');
    }
    return activeMcpLease;
  };

  const runtime: StoreRuntime = {
    pushUndoSnapshot(state, base = state) {
      state.undoStack.push(createSnapshot(base));
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
      undoSeq++;
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

    beginUndoable(state, opts) {
      // De omvattende batch of MCP-transactie heeft de ene snapshot al genomen.
      if (batchDepth > 0 || activeMcpLease) return;

      const key = opts?.coalesceKey;
      if (
        key
        && coalesce
        && coalesce.key === key
        && coalesce.seq === undoSeq
        && coalesce.docId === state.activeDocumentId
      ) {
        if (state.redoStack.length) state.redoStack = [];
        return;
      }

      runtime.pushUndoSnapshot(state);
      state.redoStack = [];
      coalesce = key ? { key, seq: undoSeq, docId: state.activeDocumentId } : null;
    },
  };

  return runtime;
}
