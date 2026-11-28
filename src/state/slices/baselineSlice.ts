import {
  normalizeComparedBaselines, noComparedBaselines, toggleComparedBaseline,
  type Baseline, type ComparedBaselineIds,
} from '@/types/baseline';
import { generateId } from '@/utils/id';
import type { AppSliceFactory } from './types';
import { isLeafTask } from '@/utils/taskHierarchy';
import { shownFinish, shownStart } from '@/utils/taskDates';

export interface BaselineSlice {
  baselines: Baseline[];
  activeBaselineId: string | null;
  comparedBaselineIds: ComparedBaselineIds;
  saveBaseline: (name: string) => string;
  deleteBaseline: (id: string) => void;
  renameBaseline: (id: string, name: string) => void;
  setActiveBaseline: (id: string | null) => void;
  toggleComparedBaseline: (id: string) => void;
}

export const createBaselineSlice: AppSliceFactory<BaselineSlice> = (runtime) => (set) => ({
  baselines: [],
  activeBaselineId: null,
  comparedBaselineIds: noComparedBaselines(),

  saveBaseline: (name) => {
    const id = generateId('baseline');
    set((s) => {
      runtime.beginUndoable(s);
      const leaves = s.tasks.filter(isLeafTask);
      s.baselines.push({
        id,
        name,
        createdAt: new Date().toISOString(),
        tasks: leaves.map((t) => ({
          taskId: t.id,
          start: shownStart(t),
          finish: shownFinish(t),
          duration: t.time.scheduleDuration,
          isMilestone: t.isMilestone,
          ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
        })),
        projectEnd: s.cpmResult?.projectEnd ?? '',
        projectDuration: s.cpmResult?.projectDuration ?? 0,
      });
      s.activeBaselineId = id;
      runtime.finishMutation(s);
    });
    return id;
  },

  deleteBaseline: (id) =>
    set((s) => {
      if (!s.baselines.some((b) => b.id === id)) return;
      runtime.beginUndoable(s);
      s.baselines = s.baselines.filter((b) => b.id !== id);
      if (s.activeBaselineId === id) {
        s.activeBaselineId = s.baselines.length ? s.baselines[s.baselines.length - 1].id : null;
      }
      s.comparedBaselineIds = normalizeComparedBaselines(s.comparedBaselineIds, s.baselines, s.activeBaselineId);
      runtime.finishMutation(s);
    }),

  renameBaseline: (id, name) =>
    set((s) => {
      const b = s.baselines.find((x) => x.id === id);
      if (!b) return;
      runtime.beginUndoable(s);
      b.name = name;
      runtime.finishMutation(s);
    }),

  setActiveBaseline: (id) =>
    set((s) => {
      if (s.activeBaselineId === id) return;
      runtime.beginUndoable(s);
      s.activeBaselineId = id;
      s.comparedBaselineIds = normalizeComparedBaselines(s.comparedBaselineIds, s.baselines, s.activeBaselineId);
      runtime.finishMutation(s);
    }),

  toggleComparedBaseline: (id) =>
    set((s) => {
      if (id === s.activeBaselineId || !s.baselines.some((b) => b.id === id)) return;
      const next = toggleComparedBaseline(s.comparedBaselineIds, id);
      if (next[0] === s.comparedBaselineIds[0] && next[1] === s.comparedBaselineIds[1]) return;
      runtime.beginUndoable(s);
      s.comparedBaselineIds = next;
      runtime.finishMutation(s);
    }),
});
