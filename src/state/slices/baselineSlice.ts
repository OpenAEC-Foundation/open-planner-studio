import type { Baseline } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface BaselineSlice {
  baselines: Baseline[];
  activeBaselineId: string | null;
  /** Snapshot huidige plan → nieuwe Baseline; retourneert het nieuwe id; zet direct als actief.
   *  Pure metadata: pusht ÉÉN undo-snapshot, roept NOOIT runCPM aan, zet NOOIT scheduleStale. */
  saveBaseline: (name: string) => string;
  /** Verwijder een baseline; was het de actieve, dan valt activeBaselineId op de nieuwste (of null). */
  deleteBaseline: (id: string) => void;
  renameBaseline: (id: string, name: string) => void;
  /** Actieve baseline voor overlay/variance; leest alleen, geen runCPM. */
  setActiveBaseline: (id: string | null) => void;
}

export const createBaselineSlice: AppSlice<BaselineSlice> = (set) => ({
  baselines: [],
  activeBaselineId: null,

  saveBaseline: (name) => {
    const id = generateId('baseline');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      // Snapshot de CPM-early-datums (= de balk zoals getekend, §2.1) per leaf-taak; fallback op
      // de schedule-datums voor het geval er nog nooit een runCPM is geweest.
      const leaves = s.tasks.filter((t) => t.childIds.length === 0);
      s.baselines.push({
        id,
        name,
        createdAt: new Date().toISOString(),
        tasks: leaves.map((t) => ({
          taskId: t.id,
          start: t.time.earlyStart || t.time.scheduleStart,
          finish: t.time.earlyFinish || t.time.scheduleFinish,
          duration: t.time.scheduleDuration,
          isMilestone: t.isMilestone,
          ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
        })),
        projectEnd: s.cpmResult?.projectEnd ?? '',
        projectDuration: s.cpmResult?.projectDuration ?? 0,
      });
      s.activeBaselineId = id;
      s.isDirty = true;
    });
    return id;
  },

  deleteBaseline: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.baselines = s.baselines.filter((b) => b.id !== id);
      if (s.activeBaselineId === id) {
        s.activeBaselineId = s.baselines.length ? s.baselines[s.baselines.length - 1].id : null;
      }
      s.isDirty = true;
    }),

  renameBaseline: (id, name) =>
    set((s) => {
      const b = s.baselines.find((x) => x.id === id);
      if (!b) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      b.name = name;
      s.isDirty = true;
    }),

  setActiveBaseline: (id) =>
    set((s) => {
      if (s.activeBaselineId === id) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.activeBaselineId = id;
      s.isDirty = true;
    }),
});
