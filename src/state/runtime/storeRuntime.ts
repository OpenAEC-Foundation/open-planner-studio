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

/** Bestaande publieke naam; de grens wordt per session-historyscope afgedwongen. */
export const MAX_UNDO = MAX_SESSION_HISTORY_EVENTS_PER_SCOPE;

export interface McpTransactionLease {
  readonly token: symbol;
}

export interface StoreRuntimeOptions {
  /** `false` ⇒ deze context zendt GEEN host-events uit. Gebruikt door de
   *  scratch-instantie (`scratchDocument.ts`): extensies zijn app-globaal geregistreerd en zouden
   *  anders cijfers krijgen van een document waar de gebruiker niet naar kijkt. Default `true`. */
  emitHostEvents?: boolean;
  /** Register van open tekstinvoer van de UI die bij DEZE context hoort (`pendingTextEdits.ts`).
   *  Default een eigen, leeg register: een scratch- of testcontext rondt nooit de invoer van de
   *  zichtbare app af. Alleen `appStoreContext` krijgt `mountedPendingTextEdits`. */
  pendingTextEdits?: PendingTextEdits;
}

interface ActiveMcpLease extends McpTransactionLease {
  timephasedLossTaskIds: Set<string>;
  /** Bewaard, afwijkend restwerk dat een duurbewerking in deze transactie opnieuw uitrekende. */
  recomputedWork: RecomputedRemainingWork[];
}

interface PendingDocumentMutation {
  before: Snapshot;
  documentId: string;
  label: string;
  coalesceKey: string | null;
  depth: number;
  /** Er liep binnen deze open mutatie een `finishMutation` (= een echte bewerking). */
  edited: boolean;
}

interface CoalesceMarker {
  key: string;
  eventId: string;
  documentId: string;
  /** `sequence` van het gecoalesceerde event: alleen zolang dat nog het LAATST opgenomen event is
   *  (`nextHistorySequence === sequence + 1`) mag een volgende mutatie erin opgaan. */
  sequence: number;
  /** Restwerk dat een duurbewerking binnen DEZE undo-stap herschreef, met het "vóór" van de eerste
   *  stap — zie `coalescedRecomputedWork`. Verdwijnt vanzelf met de marker. */
  recomputedWork?: RecomputedRemainingWork[];
}

export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string; label?: string }): void;
  /** `nonEdit: true` ⇒ het event is geen bewerking (zie `SessionHistoryDelta.nonEdit`), tenzij er
   *  binnen dezelfde open mutatie tóch een `finishMutation` liep. */
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
  /** Rond open tekstinvoer van deze context af (commit, dan de eigen rekenblokkade vrij). Elke
   *  actie die de actieve documentpayload vastlegt of vervangt, roept dit EERST aan. */
  finishPendingTextEdits(): void;
  /**
   * Open een bewerksessie (de taakdialoog). Zolang hij open staat krijgt elk
   * event dat via de interactieve route (`finishUndoable`, dus buiten batch en MCP-lease) ontstaat
   * `sessionKey` = de teruggegeven sleutel. Een nieuwe sessie vervangt een vergeten oude.
   */
  openHistorySession(): string;
  /** Sluit de sessie met deze sleutel; idempotent, en een andere (nieuwere) sessie blijft open. */
  endHistorySession(key: string): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  /**
   * Binnen een batch wordt `recomputeViewRows` uitgesteld tot het einde (`withTransaction`): per
   * bewerkte taak de hele rijenlijst afleiden maakte een bulkbewerking O(taken × selectie) — gemeten
   * 7,5 s voor 500 taken in een project van 8000. `true` = uitgesteld (de aanroeper rekent niet).
   */
  deferViewRows(): boolean;
  /** Was er in deze batch een uitgestelde rijenberekening? Leest en wist de vlag. */
  takeDeferredViewRows(): boolean;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  /** Herschreven afwijkend restwerk (`settleDurationEdit`) op de lease: de transactie meldt het één
   *  keer bij succes en de envelop noemt het (`remainingWorkRecomputed`). */
  recordMcpRecomputedWork(lease: McpTransactionLease, items: readonly RecomputedRemainingWork[]): void;
  mcpRecomputedWork(lease: McpTransactionLease): readonly RecomputedRemainingWork[];
  /**
   * Herschreven afwijkend restwerk binnen de gecoalesceerde undo-stap met deze `coalesceKey` (één
   * balksleep, een reeks toetsaanslagen in het paneel). Alleen de EERSTE stap ziet een afwijkend
   * restwerk; daarna klopt het al met inzet × restduur. Zo kan de melding toch de eindwaarde tonen,
   * met het "vóór" dat Ctrl+Z terugzet. Leeg zodra de laatste mutatie in een ánder event opging
   * (andere sleutel, een ander event ertussen, undo): de lijst hangt aan de coalesce-marker.
   */
  coalescedRecomputedWork(coalesceKey: string): readonly RecomputedRemainingWork[];
  /** Zet de lijst hierboven; doet niets als de laatste mutatie niet in een event met deze sleutel
   *  opging (bv. binnen een batch of MCP-lease, waar geen eigen event ontstaat). */
  setCoalescedRecomputedWork(coalesceKey: string, items: readonly RecomputedRemainingWork[]): void;
  exitMcpTransaction(lease: McpTransactionLease): void;
  /**
   * Monotone teller die bij ELKE undoable mutatie in deze context omhoog gaat — óók bij een
   * gecoalesceerde mutatie, die bewust géén nieuw history-event oplevert. Bewust NIET
   * hetzelfde als `nextHistorySequence` of de eventtelling: een gecoalesceerde sleepreeks schrijft
   * alleen de `after` van een BESTAAND event bij (`replaceCoalescedAfter`), dus die tellers staan
   * dan stil; en `historyDepthsForActiveScope().undoDepth` is bovendien onbruikbaar omdat
   * `pruneSessionHistory` van onderaf trimt op `MAX_SESSION_HISTORY_EVENTS_PER_SCOPE`.
   *
   * Afnemer: de voorstel-invalidatie van de verdeeldialoog (`proposalFingerprint.ts`). Die
   * combineert deze teller met de REFERENTIES van de documentvelden waarop het voorstel gerekend
   * heeft — de teller is de goedkope, grofmazige backstop; de referenties maken de bewaking
   * sluitend (`runCPM` muteert datums zonder ooit langs `beginUndoable` te komen).
   */
  mutationSeq(): number;
  /**
   * Zend een host-lifecycle-event uit namens DEZE context. Slices roepen dit aan in plaats van
   * `emitExtensionEvent` rechtstreeks — de bus zelf is app-globaal (extensies zijn app-niveau), maar
   * of een context er iets op zet is een eigenschap van die context. De scratch-instantie bouwt
   * haar context met `emitHostEvents: false`, zodat een efemere run op een slapend document geen
   * extensie-luisteraar bereikt.
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
  const pendingTextEdits = opts?.pendingTextEdits ?? createPendingTextEdits();
  const pendingByDraft = new WeakMap<object, PendingDocumentMutation>();
  let coalesce: CoalesceMarker | null = null;
  let batchDepth = 0;
  let viewRowsDeferred = false;
  let activeMcpLease: ActiveMcpLease | null = null;
  let activeHistorySession: string | null = null;
  let historySessionCounter = 0;
  // Monotone, per-context mutatieteller — zie het docblok bij
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
      // De bump staat als EERSTE regel — vóór de batch-/lease-guard én vóór de
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

      // Alleen coalescen als er sinds het marker-event NIETS anders in de geschiedenis is opgenomen.
      // Paden die buiten deze runtime om een event opnemen (de taakraster-commit via
      // `recordDocumentDataHistoryDelta`) resetten de marker niet; zonder deze check schreef een
      // tweede statusdatumwijziging ná een celbewerking de `after` van het OUDERE event over met een
      // toestand mét die celbewerking — undo draaide dan beide terug en redo verloor de tweede datum.
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
