import { restoreSnapshot } from '../snapshot';
import { resetUndoCoalescing } from '../transaction';
import {
  materializeHistoryEventTargets,
  recordSessionHistoryDeltas,
  selectRedoHistoryEvent,
  selectUndoHistoryEvent,
  type SessionHistoryDelta,
  type SessionHistoryEvent,
} from '../sessionHistory';
import { saveTaskGridPreferences } from '@/utils/settingsStore';
import type { PersistedTaskGridPreferencesV1 } from '@/types/taskGrid';
import type { AppState } from '../appStore';
import type { AppSlice } from './types';

export interface HistorySlice {
  /** App-globale, niet-gepersisteerde chronologie over alle geopende documenten en gridsurfaces. */
  historyEvents: SessionHistoryEvent[];
  /** Volgende sessiebrede sequence; loopt door na pruning en documentwissels. */
  nextHistorySequence: number;
  /** Registreer een reeds toegepaste, voorbereide wijziging als één atomair event. */
  recordSessionHistoryEvent: (label: string, deltas: readonly SessionHistoryDelta[]) => void;
  undo: () => void;
  redo: () => void;
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
  set: Parameters<AppSlice<HistorySlice>>[0],
  get: Parameters<AppSlice<HistorySlice>>[1],
  direction: 'undo' | 'redo',
): void {
  resetUndoCoalescing();
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

export const createHistorySlice: AppSlice<HistorySlice> = (set, get) => ({
  historyEvents: [],
  nextHistorySequence: 1,

  recordSessionHistoryEvent: (label, deltas) => {
    let recorded: SessionHistoryEvent | null = null;
    set((state) => {
      recorded = recordSessionHistoryDeltas(state, label, deltas);
    });
    if (recorded) persistGridWhenNeeded(get(), recorded);
  },

  undo: () => applyHistoryEvent(set, get, 'undo'),
  redo: () => applyHistoryEvent(set, get, 'redo'),
});
