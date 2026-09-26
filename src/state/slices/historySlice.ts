import { restoreSnapshot } from '../snapshot';
import {
  materializeHistoryEventTargets,
  recordSessionHistoryDeltas,
  selectRedoHistoryEvent,
  selectUndoHistoryEvent,
  type DocumentDataHistoryDelta,
  type SessionHistoryDelta,
  type SessionHistoryEvent,
} from '../sessionHistory';
import { saveTaskGridPreferences } from '@/utils/settingsStore';
import { persistedTaskGridPreferences } from './taskGridSlice';
import type { AppState } from '../appStore';
import type { StoreRuntime } from '../runtime/storeRuntime';
import type { AppSlice, AppSliceFactory } from './types';

export interface HistorySessionMark {
  sequence: number;
  sessionKey: string;
}

export interface HistorySlice {
  /** App-globale, niet-gepersisteerde chronologie over alle geopende documenten en gridsurfaces. */
  historyEvents: SessionHistoryEvent[];
  /** Volgende sessiebrede sequence; loopt door na pruning en documentwissels. */
  nextHistorySequence: number;
  /** Registreer een reeds toegepaste, voorbereide wijziging als één atomair event. */
  recordSessionHistoryEvent: (label: string, deltas: readonly SessionHistoryDelta[]) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Gebruikstest #170, G5: een BEWERKSESSIE (de taakdialoog) die relationele secties direct op de
   * store laat werken (toewijzingen, werkregel, werk) — `historyMark` opent de sessie (runtime-
   * sleutel + begin-sequence, en breekt undo-coalescing af zodat de eerste dialoogbewerking nooit
   * bij een ouder event aanschuift), `revertHistorySince` draait bij Annuleren de events van DEZE
   * sessie terug zonder redo, `squashHistorySince` maakt er bij Opslaan één undo-stap van.
   *
   * Alleen events met de `sessionKey` van de sessie tellen (PR #170-hercheck): een MCP-, batch- of
   * extensiemutatie die tijdens de open dialoog landt is geen dialoogwerk en blijft altijd staan.
   * Omdat een history-event een volledige documentsnapshot draagt, kan een dialoog-event dat ONDER
   * zo'n vreemd event ligt niet los worden teruggedraaid zonder het vreemde werk mee te nemen;
   * revert stopt daar dus (de chronologie blijft intact), laat die dialoogstappen als gewone
   * undo-stappen staan en meldt dat. Squash voegt alleen aaneengesloten sessie-events samen; een
   * vreemd event ertussen houdt zijn eigen stap.
   */
  historyMark: () => HistorySessionMark;
  revertHistorySince: (mark: HistorySessionMark) => void;
  squashHistorySince: (mark: HistorySessionMark, label: string) => void;
  /** Sluit de sessie zonder iets aan de historie te veranderen (dialoog op een andere manier dicht). */
  endHistorySession: (mark: HistorySessionMark) => void;
}

function isActiveDocumentDataEvent(event: SessionHistoryEvent, documentId: string): boolean {
  return event.deltas.every(delta => delta.kind === 'document-data' && delta.documentId === documentId);
}

function isSessionEvent(event: SessionHistoryEvent, mark: HistorySessionMark, documentId: string): boolean {
  return event.sequence >= mark.sequence
    && event.sessionKey === mark.sessionKey
    && isActiveDocumentDataEvent(event, documentId);
}

function withoutSessionKey(event: SessionHistoryEvent): SessionHistoryEvent {
  const { sessionKey: _sessionKey, ...rest } = event;
  return rest;
}

function persistGridWhenNeeded(state: Readonly<AppState>, event: SessionHistoryEvent): void {
  if (event.deltas.some(delta => delta.kind === 'grid-preference')) {
    void saveTaskGridPreferences(persistedTaskGridPreferences(state));
  }
}

function applyHistoryEvent(
  runtime: StoreRuntime,
  set: Parameters<AppSlice<HistorySlice>>[0],
  get: Parameters<AppSlice<HistorySlice>>[1],
  direction: 'undo' | 'redo',
): void {
  runtime.resetUndoCoalescing();
  const current = get();
  const event = direction === 'undo'
    ? selectUndoHistoryEvent(current.historyEvents, current.activeDocumentId)
    : selectRedoHistoryEvent(current.historyEvents, current.activeDocumentId);
  if (!event) return;

  const side = direction === 'undo' ? 'before' : 'after';
  const targets = materializeHistoryEventTargets(current, event, side);
  set((state) => {
    const stored = state.historyEvents.find(item => item.id === event.id);
    if (!stored || stored.state !== (direction === 'undo' ? 'applied' : 'undone')) return;

    for (const target of targets) {
      if (target.kind === 'document-data') {
        restoreSnapshot(state, target.snapshot, { clearImportPristine: target.clearImportPristine });
        state.viewRows = target.viewRows;
        state.resourceLoadResult = target.resourceLoadResult;
      } else if (target.kind === 'document-view') {
        Object.assign(state.view, target.view);
        state.viewRows = target.viewRows;
      } else {
        state.taskGridSurfaces[target.surface] = {
          columns: target.preferences.columns.map(column => ({ ...column })),
          scrollX: target.preferences.scrollX,
        };
      }
    }
    stored.state = direction === 'undo' ? 'undone' : 'applied';
  });
  persistGridWhenNeeded(get(), event);
}

export const createHistorySlice: AppSliceFactory<HistorySlice> = (runtime) => (set, get) => ({
  historyEvents: [],
  nextHistorySequence: 1,

  recordSessionHistoryEvent: (label, deltas) => {
    let recorded: SessionHistoryEvent | null = null;
    set((state) => {
      recorded = recordSessionHistoryDeltas(state, label, deltas);
    });
    if (recorded) persistGridWhenNeeded(get(), recorded);
  },

  undo: () => applyHistoryEvent(runtime, set, get, 'undo'),
  redo: () => applyHistoryEvent(runtime, set, get, 'redo'),

  historyMark: () => {
    runtime.resetUndoCoalescing();
    return { sequence: get().nextHistorySequence, sessionKey: runtime.openHistorySession() };
  },

  endHistorySession: (mark) => runtime.endHistorySession(mark.sessionKey),

  revertHistorySince: (mark) => {
    runtime.endHistorySession(mark.sessionKey);
    const documentId = get().activeDocumentId;
    // Undo zolang het nieuwste toepasbare event een event van DEZE sessie is.
    for (;;) {
      const current = get();
      const event = selectUndoHistoryEvent(current.historyEvents, current.activeDocumentId);
      if (!event || !isSessionEvent(event, mark, documentId)) break;
      applyHistoryEvent(runtime, set, get, 'undo');
      if (get().historyEvents.find(item => item.id === event.id)?.state !== 'undone') break;
    }
    // Annuleren is geen undo: de teruggedraaide sessiestappen horen niet als redo terug te komen.
    // Sessie-events die onder een vreemd event bleven liggen worden gewone stappen (sleutel weg).
    let stranded = 0;
    const events = get().historyEvents
      .filter(event => !(event.state === 'undone' && isSessionEvent(event, mark, documentId)))
      .map(event => {
        if (event.sessionKey !== mark.sessionKey) return event;
        if (event.state === 'applied') stranded++;
        return withoutSessionKey(event);
      });
    set({ historyEvents: events });
    runtime.resetUndoCoalescing();
    if (stranded > 0) {
      get().notify({
        severity: 'info',
        messageKey: 'notifications.taskEditRevertBlocked',
        dedupeKey: 'task-edit-revert-blocked',
      });
    }
  },

  squashHistorySince: (mark, label) => {
    runtime.endHistorySession(mark.sessionKey);
    const current = get();
    const documentId = current.activeDocumentId;
    const later = current.historyEvents
      .filter(event => event.sequence >= mark.sequence)
      .sort((left, right) => left.sequence - right.sequence);
    // Aaneengesloten reeksen sessie-events; elk ander event (MCP, ander document, grid) breekt.
    const runs: SessionHistoryEvent[][] = [];
    let run: SessionHistoryEvent[] = [];
    for (const event of later) {
      if (event.state === 'applied' && isSessionEvent(event, mark, documentId)) {
        run.push(event);
      } else {
        if (run.length > 0) runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);

    const replaced = new Map<string, SessionHistoryEvent>();
    const dropped = new Set<string>();
    for (const session of runs) {
      const first = session[0].deltas[0] as DocumentDataHistoryDelta;
      const last = session[session.length - 1].deltas[0] as DocumentDataHistoryDelta;
      replaced.set(session[0].id, withoutSessionKey({
        ...session[0],
        label: session.length > 1 ? label : session[0].label,
        deltas: [{ kind: 'document-data', documentId, before: first.before, after: last.after }],
      }));
      for (const event of session.slice(1)) dropped.add(event.id);
    }
    set({
      historyEvents: current.historyEvents
        .filter(event => !dropped.has(event.id))
        .map(event => replaced.get(event.id)
          ?? (event.sessionKey === mark.sessionKey ? withoutSessionKey(event) : event)),
    });
    runtime.resetUndoCoalescing();
  },
});
