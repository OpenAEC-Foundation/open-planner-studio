import { Task, createDefaultTaskTime } from '@/types/task';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface TaskSlice {
  tasks: Task[];
  selectedTaskIds: string[];
  addTask: (task: Partial<Task> & { name: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newParentId: string | null) => void;
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;
}

export const createTaskSlice: AppSlice<TaskSlice> = (set) => ({
  tasks: [],
  selectedTaskIds: [],

  addTask: (partial) => {
    const id = generateId('task');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const now = s.project.startDate || formatDate(new Date());
      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        taskType: partial.taskType || 'CONSTRUCTION',
        status: partial.status || 'NOT_STARTED',
        isMilestone: partial.isMilestone || false,
        priority: partial.priority || 0,
        parentId: partial.parentId || null,
        childIds: [],
        time: partial.time || createDefaultTaskTime(now, partial.isMilestone ? 0 : 5),
        resourceIds: partial.resourceIds || [],
        color: partial.color,
      };

      s.tasks.push(task);

      // Add to parent's children
      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) parent.childIds.push(id);
      }

      s.isDirty = true;
    });
    return id;
  },

  updateTask: (id, updates) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const idx = s.tasks.findIndex(t => t.id === id);
      if (idx >= 0) {
        Object.assign(s.tasks[idx], updates);
        s.isDirty = true;
      }
    }),

  deleteTask: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      // Remove from parent
      const task = s.tasks.find(t => t.id === id);
      if (task?.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) {
          parent.childIds = parent.childIds.filter(cid => cid !== id);
        }
      }

      // Remove child tasks recursively
      const removeIds = new Set<string>();
      const collectChildren = (taskId: string) => {
        removeIds.add(taskId);
        const t = s.tasks.find(tt => tt.id === taskId);
        if (t) t.childIds.forEach(collectChildren);
      };
      collectChildren(id);

      s.tasks = s.tasks.filter(t => !removeIds.has(t.id));
      s.sequences = s.sequences.filter(
        seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId)
      );
      s.assignments = s.assignments.filter(a => !removeIds.has(a.taskId));
      s.selectedTaskIds = s.selectedTaskIds.filter(sid => !removeIds.has(sid));
      s.isDirty = true;
    }),

  moveTask: (id, newParentId) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const task = s.tasks.find(t => t.id === id);
      if (!task) return;

      // Remove from old parent
      if (task.parentId) {
        const oldParent = s.tasks.find(t => t.id === task.parentId);
        if (oldParent) {
          oldParent.childIds = oldParent.childIds.filter(c => c !== id);
        }
      }

      // Add to new parent
      task.parentId = newParentId;
      if (newParentId) {
        const newParent = s.tasks.find(t => t.id === newParentId);
        if (newParent) newParent.childIds.push(id);
      }

      s.isDirty = true;
    }),

  selectTask: (id, multi = false, range = false) =>
    set((s) => {
      if (range && s.selectedTaskIds.length > 0) {
        // Shift+click: select range from last selected to clicked task
        const lastSelected = s.selectedTaskIds[s.selectedTaskIds.length - 1];
        const flatIds = s.tasks.map(t => t.id);
        const fromIdx = flatIds.indexOf(lastSelected);
        const toIdx = flatIds.indexOf(id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          const rangeIds = flatIds.slice(start, end + 1);
          // Merge with existing selection (union)
          const merged = new Set([...s.selectedTaskIds, ...rangeIds]);
          s.selectedTaskIds = Array.from(merged);
        } else {
          s.selectedTaskIds = [id];
        }
      } else if (multi) {
        const idx = s.selectedTaskIds.indexOf(id);
        if (idx >= 0) {
          s.selectedTaskIds.splice(idx, 1);
        } else {
          s.selectedTaskIds.push(id);
        }
      } else {
        s.selectedTaskIds = [id];
      }
    }),

  selectTaskRange: (fromId, toId) =>
    set((s) => {
      const flatIds = s.tasks.map(t => t.id);
      const fromIdx = flatIds.indexOf(fromId);
      const toIdx = flatIds.indexOf(toId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        s.selectedTaskIds = flatIds.slice(start, end + 1);
      }
    }),

  deselectAll: () =>
    set((s) => {
      s.selectedTaskIds = [];
    }),
});
