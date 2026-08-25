import { createSnapshot, restoreSnapshot, type Snapshot } from '../snapshot';
import { resetUndoCoalescing, pushUndoSnapshot } from '../transaction';
import { materializeHistoryTarget, type SessionHistoryDelta } from '../sessionHistory';
import type { AppSlice } from './types';

export interface HistorySlice {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  undo: () => void;
  redo: () => void;
}

function legacySnapshotDelta(documentId: string, snapshot: Snapshot): SessionHistoryDelta {
  return { kind: 'document-data', documentId, before: snapshot, after: snapshot };
}

export const createHistorySlice: AppSlice<HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  undo: () => {
    // Een undo breekt elke lopende coalesce-reeks af (pakket H): de eerstvolgende keyed mutatie
    // moet gegarandeerd een verse snapshot pushen.
    resetUndoCoalescing();
    const current = get();
    const targetSnapshot = current.undoStack[current.undoStack.length - 1];
    if (!targetSnapshot) return;
    const target = materializeHistoryTarget(
      current,
      legacySnapshotDelta(current.activeDocumentId, targetSnapshot),
      'before',
    );
    if (target.kind !== 'document-data') return;
    set((s) => {
      if (s.undoStack.length === 0) return;
      s.redoStack.push(createSnapshot(s));
      s.undoStack.pop();
      restoreSnapshot(s, target.snapshot);
      s.viewRows = target.viewRows;
      s.resourceLoadResult = target.resourceLoadResult;
    });
  },

  redo: () => {
    resetUndoCoalescing(); // idem als bij undo — zie daar.
    const current = get();
    const targetSnapshot = current.redoStack[current.redoStack.length - 1];
    if (!targetSnapshot) return;
    const target = materializeHistoryTarget(
      current,
      legacySnapshotDelta(current.activeDocumentId, targetSnapshot),
      'after',
    );
    if (target.kind !== 'document-data') return;
    set((s) => {
      if (s.redoStack.length === 0) return;
      // Via de helper, zodat de MAX_UNDO-grens en het coalesce-volgnummer op één plek blijven.
      pushUndoSnapshot(s);
      s.redoStack.pop();
      restoreSnapshot(s, target.snapshot);
      s.viewRows = target.viewRows;
      s.resourceLoadResult = target.resourceLoadResult;
    });
  },
});
