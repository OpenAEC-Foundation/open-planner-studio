import { createSnapshot, type Snapshot } from '../snapshot';
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
      const snapshot = s.undoStack.pop()!;
      s.tasks = snapshot.tasks;
      s.sequences = snapshot.sequences;
      s.resources = snapshot.resources;
      s.assignments = snapshot.assignments;
      // Oudere snapshots (van vóór fase 2.2/2.5) kunnen deze velden missen.
      s.resourceCalendars = snapshot.resourceCalendars ?? s.resourceCalendars;
      s.activityCodeTypes = snapshot.activityCodeTypes ?? s.activityCodeTypes;
      s.customFieldDefs = snapshot.customFieldDefs ?? s.customFieldDefs;
      // Afgeleide resultaten mee terugdraaien (A5) — anders bleef bv. na undo van applyLeveling de
      // statusbalk/het histogram op het genivelleerde schema staan. `?? null`/`?? false` houdt oude,
      // veldloze snapshots veilig.
      s.cpmResult = snapshot.cpmResult ?? null;
      s.resourceLoadResult = snapshot.resourceLoadResult ?? null;
      s.scheduleStale = snapshot.scheduleStale ?? false;
      // Baselines (fase 2.6): `?? s.baselines` voor pre-2.6-snapshots; activeBaselineId met een
      // expliciete `!== undefined`-guard — `null` ("geen actieve baseline") is een legitieme waarde
      // die een undo moet kunnen terugzetten (?? zou die null wegslikken).
      s.baselines = snapshot.baselines ?? s.baselines;
      s.activeBaselineId = snapshot.activeBaselineId !== undefined ? snapshot.activeBaselineId : s.activeBaselineId;
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  redo: () => {
    set((s) => {
      if (s.redoStack.length === 0) return;
      s.undoStack.push(createSnapshot(s));
      const snapshot = s.redoStack.pop()!;
      s.tasks = snapshot.tasks;
      s.sequences = snapshot.sequences;
      s.resources = snapshot.resources;
      s.assignments = snapshot.assignments;
      s.resourceCalendars = snapshot.resourceCalendars ?? s.resourceCalendars;
      s.activityCodeTypes = snapshot.activityCodeTypes ?? s.activityCodeTypes;
      s.customFieldDefs = snapshot.customFieldDefs ?? s.customFieldDefs;
      s.cpmResult = snapshot.cpmResult ?? null;
      s.resourceLoadResult = snapshot.resourceLoadResult ?? null;
      s.scheduleStale = snapshot.scheduleStale ?? false;
      s.baselines = snapshot.baselines ?? s.baselines;
      s.activeBaselineId = snapshot.activeBaselineId !== undefined ? snapshot.activeBaselineId : s.activeBaselineId;
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },
});
