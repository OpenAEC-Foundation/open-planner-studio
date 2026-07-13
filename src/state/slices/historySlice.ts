import { createSnapshot, restoreSnapshot, type Snapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface HistorySlice {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  undo: () => void;
  redo: () => void;
}

export const createHistorySlice: AppSlice<HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  undo: () => {
    set((s) => {
      if (s.undoStack.length === 0) return;
      s.redoStack.push(createSnapshot(s));
      restoreSnapshot(s, s.undoStack.pop()!);
    });
    get().recomputeViewRows();
  },

  redo: () => {
    set((s) => {
      if (s.redoStack.length === 0) return;
      s.undoStack.push(createSnapshot(s));
      restoreSnapshot(s, s.redoStack.pop()!);
    });
    get().recomputeViewRows();
  },
});
