import type { Task } from '@/types/task';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { emitExtensionEvent, HOST_EVENTS } from '@/extensions/eventBus';
import type { AppSlice } from './types';

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  runCPM: () => void;
}

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set, get) => ({
  cpmResult: null,

  runCPM: () => {
    set((s) => {
      const calEngine = new CalendarEngine(s.calendar);
      // Only run CPM on leaf tasks (non-summary)
      const leafTasks = s.tasks.filter(t => t.childIds.length === 0);
      const solver = new CPMSolver(leafTasks, s.sequences, calEngine);
      const result = solver.solve();

      // If circular dependency detected, store the result (with error) and bail
      if (result.error) {
        s.cpmResult = result;
        return;
      }

      // Apply results back to tasks
      for (const task of s.tasks) {
        const r = result.tasks.get(task.id);
        if (r) {
          task.time.earlyStart = r.earlyStart;
          task.time.earlyFinish = r.earlyFinish;
          task.time.lateStart = r.lateStart;
          task.time.lateFinish = r.lateFinish;
          task.time.totalFloat = r.totalFloat;
          task.time.freeFloat = r.freeFloat;
          task.time.isCritical = r.isCritical;
          task.time.scheduleStart = r.earlyStart;
          task.time.scheduleFinish = r.earlyFinish;
        }
      }

      // Update summary tasks (roll up dates from children)
      const updateSummary = (taskId: string) => {
        const task = s.tasks.find(t => t.id === taskId);
        if (!task || task.childIds.length === 0) return;

        for (const childId of task.childIds) {
          updateSummary(childId);
        }

        const children = task.childIds
          .map(cid => s.tasks.find(t => t.id === cid))
          .filter(Boolean) as Task[];

        if (children.length > 0) {
          const starts = children.map(c => c.time.earlyStart).sort();
          const finishes = children.map(c => c.time.earlyFinish).sort();
          task.time.earlyStart = starts[0];
          task.time.scheduleStart = starts[0];
          task.time.earlyFinish = finishes[finishes.length - 1];
          task.time.scheduleFinish = finishes[finishes.length - 1];
          task.time.isCritical = children.some(c => c.time.isCritical);

          // Ook de LATE datums en speling oprollen — anders bleven die op de
          // createDefaultTaskTime-defaults staan (lf=es, tf=0) en schreef o.a. ifcWriter
          // misleidende fase-speling weg (een niet-kritieke fase met "tf=0").
          const lateStarts = children.map(c => c.time.lateStart).sort();
          const lateFinishes = children.map(c => c.time.lateFinish).sort();
          task.time.lateStart = lateStarts[0];
          task.time.lateFinish = lateFinishes[lateFinishes.length - 1];
          // Een verzameltaak kan maar zo veel opschuiven als zijn krapste kind: min over de kinderen.
          task.time.totalFloat = Math.min(...children.map(c => c.time.totalFloat));
          task.time.freeFloat = Math.min(...children.map(c => c.time.freeFloat));
        }
      };

      // Find root tasks (no parent)
      for (const task of s.tasks) {
        if (!task.parentId) updateSummary(task.id);
      }

      s.cpmResult = result;
    });

    const cpm = get().cpmResult;
    emitExtensionEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: get().tasks.filter((t) => t.time.isCritical).length,
    });
  },
});
