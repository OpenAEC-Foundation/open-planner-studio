import { createSnapshot, restoreSnapshot, type Snapshot } from '../snapshot';
import type { AppSliceFactory } from './types';

export interface HistorySlice {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  undo: () => void;
  redo: () => void;
}

export const createHistorySlice: AppSliceFactory<HistorySlice> = (runtime) => (set, get) => ({
  undoStack: [],
  redoStack: [],

  undo: () => {
    // Een undo breekt elke lopende coalesce-reeks af (pakket H): de eerstvolgende keyed mutatie
    // moet gegarandeerd een verse snapshot pushen.
    runtime.resetUndoCoalescing();
    set((s) => {
      if (s.undoStack.length === 0) return;
      s.redoStack.push(createSnapshot(s));
      restoreSnapshot(s, s.undoStack.pop()!);
    });
    get().recomputeViewRows();
  },

  redo: () => {
    runtime.resetUndoCoalescing(); // idem als bij undo — zie daar.
    set((s) => {
      if (s.redoStack.length === 0) return;
      // Via de helper, zodat de MAX_UNDO-grens en het coalesce-volgnummer op één plek blijven.
      runtime.pushUndoSnapshot(s);
      restoreSnapshot(s, s.redoStack.pop()!);
    });
    get().recomputeViewRows();
  },
});
