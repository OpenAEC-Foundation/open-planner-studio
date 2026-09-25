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
import type { PersistedTaskGridPreferencesV1 } from '@/types/taskGrid';
import type { AppState } from '../appStore';
import type { StoreRuntime } from '../runtime/storeRuntime';
import type { AppSlice, AppSliceFactory } from './types';

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
   * store laat werken (toewijzingen, werkregel, werk) — `historyMark` legt het begin vast (de
   * volgende sequence), `revertHistorySince` draait bij Annuleren alles sinds dat punt terug en
   * laat er geen redo van achter, `squashHistorySince` maakt er bij Opslaan één undo-stap van.
   * Beide raken alleen events die uitsluitend documentdata van het ACTIEVE document dragen; komt
   * er iets anders tussen (grid-voorkeur, ander document, een undone event), dan stopt de actie
   * daar in plaats van half te knippen.
   */
  historyMark: () => number;
  revertHistorySince: (mark: number) => void;
  squashHistorySince: (mark: number, label: string) => void;
}

function isActiveDocumentDataEvent(event: SessionHistoryEvent, documentId: string): boolean {
  return event.deltas.every(delta => delta.kind === 'document-data' && delta.documentId === documentId);
}

function persistedGridPreferences(state: Readonly<AppState>): PersistedTaskGridPreferencesV1 {
  return {
    version: 1,
    surfaces: {
      'gantt-task-grid': {
        columns: state.taskGridSurfaces['gantt-task-grid'].columns.map(column => ({ ...column })),
        scrollX: state.taskGridSurfaces['gantt-task-grid'].scrollX,
      },
      'full-task-grid': {
        columns: state.taskGridSurfaces['full-task-grid'].columns.map(column => ({ ...column })),
        scrollX: state.taskGridSurfaces['full-task-grid'].scrollX,
      },
    },
    recent: [...state.recentTaskColumns],
  };
}

function persistGridWhenNeeded(state: Readonly<AppState>, event: SessionHistoryEvent): void {
  if (event.deltas.some(delta => delta.kind === 'grid-preference')) {
    void saveTaskGridPreferences(persistedGridPreferences(state));
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
        restoreSnapshot(state, target.snapshot);
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

  historyMark: () => get().nextHistorySequence,

  revertHistorySince: (mark) => {
    const documentId = get().activeDocumentId;
    // Undo zolang het nieuwste toepasbare event binnen de sessie valt en alleen dit document raakt.
    for (;;) {
      const current = get();
      const event = selectUndoHistoryEvent(current.historyEvents, current.activeDocumentId);
      if (!event || event.sequence < mark || !isActiveDocumentDataEvent(event, documentId)) break;
      applyHistoryEvent(runtime, set, get, 'undo');
      if (get().historyEvents.find(item => item.id === event.id)?.state !== 'undone') break;
    }
    // Annuleren is geen undo: de teruggedraaide sessiestappen horen niet als redo terug te komen.
    set({
      historyEvents: get().historyEvents.filter(event =>
        !(event.sequence >= mark && event.state === 'undone' && isActiveDocumentDataEvent(event, documentId))),
    });
    runtime.resetUndoCoalescing();
  },

  squashHistorySince: (mark, label) => {
    const current = get();
    const documentId = current.activeDocumentId;
    const session = current.historyEvents
      .filter(event => event.sequence >= mark)
      .sort((left, right) => left.sequence - right.sequence);
    if (session.length < 2) return;
    if (!session.every(event => event.state === 'applied' && isActiveDocumentDataEvent(event, documentId))) return;
    const first = session[0].deltas[0] as DocumentDataHistoryDelta;
    const last = session[session.length - 1].deltas[0] as DocumentDataHistoryDelta;
    const merged: SessionHistoryEvent = {
      ...session[0],
      label,
      deltas: [{ kind: 'document-data', documentId, before: first.before, after: last.after }],
    };
    const dropped = new Set(session.slice(1).map(event => event.id));
    set({
      historyEvents: current.historyEvents
        .filter(event => !dropped.has(event.id))
        .map(event => (event.id === merged.id ? merged : event)),
    });
    runtime.resetUndoCoalescing();
  },
});
