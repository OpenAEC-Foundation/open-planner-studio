import { createSnapshot } from '../snapshot';
import type { AppState } from '../appStore';
import { emitExtensionEvent, type HostEventName } from '@/services/extensionEvents';

/** Bovengrens op de undo-historie; blijft gedeeld beleid, niet gedeelde uitvoeringsstate. */
export const MAX_UNDO = 100;

export interface McpTransactionLease {
  readonly token: symbol;
}

export interface StoreRuntimeOptions {
  /** `false` ⇒ deze context zendt GEEN host-events uit (spec §5, rand (a)). Gebruikt door de
   *  scratch-instantie (`scratchDocument.ts`): extensies zijn app-globaal geregistreerd en zouden
   *  anders cijfers krijgen van een document waar de gebruiker niet naar kijkt. Default `true`. */
  emitHostEvents?: boolean;
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
  /**
   * Monotone teller die bij ELKE undoable mutatie in deze context omhoog gaat — óók bij een
   * gecoalesceerde mutatie, die bewust géén snapshot pusht (spec §6a). Bewust NIET hetzelfde als het
   * interne `undoSeq`: dat volgnummer stuurt de coalesce-vergelijking en beweegt daarom juist niet
   * tijdens een sleepreeks, en `undoStack.length` is onbruikbaar omdat `MAX_UNDO` van onderaf trimt.
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
export function createStoreRuntime(opts?: StoreRuntimeOptions): StoreRuntime {
  let coalesce: { key: string; seq: number; docId: string } | null = null;
  let undoSeq = 0;
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

  const runtime: StoreRuntime = {
    pushUndoSnapshot(state, base = state) {
      state.undoStack.push(createSnapshot(base));
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
      undoSeq++;
      mutationSeq++;
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
      // B1c-plan3 taak 4: de bump staat als EERSTE regel — vóór de batch-/lease-guard én vóór de
      // coalesce-tak. Een mutatie binnen een batch of MCP-transactie is nog steeds een mutatie, ook
      // al neemt de omvattende transactie de snapshot; en een gecoalesceerde mutatie (géén nieuwe
      // snapshot) is precies het geval waarvoor deze teller bestaat (zie het docblok hierboven).
      mutationSeq++;

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

    mutationSeq() {
      return mutationSeq;
    },

    emitHostEvent: opts?.emitHostEvents === false ? () => {} : emitExtensionEvent,
  };

  return runtime;
}
