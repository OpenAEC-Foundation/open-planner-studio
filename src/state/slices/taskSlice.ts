import { Task, createDefaultTaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { deriveWbsCodes, applyWbsNumbering } from '@/utils/wbs';
import type { WbsTemplate } from '@/utils/wbsTemplates';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

/**
 * Zelfstandige kopie van een takenselectie (incl. subtaken), de interne
 * relaties en resource-toewijzingen. Deep-cloned bij het kopiëren, zodat
 * plakken ook werkt nadat de originelen gewijzigd of verwijderd zijn.
 * App-state, géén projectdata: rondt niet door de IFC-laag en zit niet in
 * de undo/redo-snapshots.
 */
export interface TaskClipboard {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
}

export interface TaskSlice {
  tasks: Task[];
  selectedTaskIds: string[];
  taskClipboard: TaskClipboard | null;
  addTask: (task: Partial<Task> & { name: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newParentId: string | null) => void;
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;
  /** Kopieer de opgegeven takken (default: de huidige selectie) incl. subtaken naar het klembord. */
  copyTasks: (ids?: string[]) => void;
  /** Plak het klembord als nieuwe takken; geeft de nieuwe root-ids terug (leeg als er niets te plakken viel). */
  pasteTasks: () => string[];
  /** Hernummer alle WBS-codes uit de boompositie (1.2.3.4) — de expliciete variant van wbsAutoNumber. */
  renumberWbs: () => void;
  /** Voeg een WBS-sjabloon in onder een ouder (null = rootniveau); geeft de nieuwe root-id terug. */
  insertWbsTemplate: (template: WbsTemplate, parentId: string | null) => string | null;
}

export const createTaskSlice: AppSlice<TaskSlice> = (set) => ({
  tasks: [],
  selectedTaskIds: [],
  taskClipboard: null,

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

      // WBS-code: bij auto-nummering de hele boom bijwerken; anders alleen deze taak een
      // afgeleide code geven wanneer de aanroeper er geen meegaf (lege codes breken de
      // CSV/MSP-export en -herimport, die op dotted codes koppelen).
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else if (!partial.wbsCode) {
        task.wbsCode = deriveWbsCodes(s.tasks).get(id) ?? '';
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
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
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

      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
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

  copyTasks: (ids) =>
    set((s) => {
      const sourceIds = ids ?? s.selectedTaskIds;
      if (sourceIds.length === 0) return;

      // Selectie uitbreiden met alle (klein)kinderen, net als bij verwijderen.
      const idSet = new Set<string>();
      const collect = (taskId: string) => {
        if (idSet.has(taskId)) return;
        idSet.add(taskId);
        const t = s.tasks.find(tt => tt.id === taskId);
        if (t) t.childIds.forEach(collect);
      };
      sourceIds.forEach(collect);

      const tasks = s.tasks.filter(t => idSet.has(t.id));
      if (tasks.length === 0) return;

      // Alleen relaties waarvan beide uiteinden mee gekopieerd worden.
      const sequences = s.sequences.filter(
        seq => idSet.has(seq.predecessorId) && idSet.has(seq.successorId),
      );
      const assignments = s.assignments.filter(a => idSet.has(a.taskId));

      // Deep-clone: het klembord blijft geldig na latere edits/undo van de bron.
      s.taskClipboard = JSON.parse(JSON.stringify({ tasks, sequences, assignments }));
    }),

  pasteTasks: () => {
    const newRootIds: string[] = [];
    set((s) => {
      const clip = s.taskClipboard;
      if (!clip || clip.tasks.length === 0) return;

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const copiedIds = new Set(clip.tasks.map(t => t.id));
      const resourceExists = new Set(s.resources.map(r => r.id));

      // Geplakte roots komen als sibling van de (eerst) geselecteerde taak;
      // zonder selectie op rootniveau.
      const anchor = s.selectedTaskIds.length > 0
        ? s.tasks.find(t => t.id === s.selectedTaskIds[0])
        : undefined;
      const targetParentId = anchor ? anchor.parentId : null;

      // Verse id voor elke gekopieerde taak.
      const idMap = new Map<string, string>();
      for (const t of clip.tasks) idMap.set(t.id, generateId('task'));

      for (const src of clip.tasks) {
        const newId = idMap.get(src.id)!;
        const parentInClip = !!src.parentId && copiedIds.has(src.parentId);
        if (!parentInClip) newRootIds.push(newId);

        const task: Task = {
          ...JSON.parse(JSON.stringify(src)),
          id: newId,
          parentId: parentInClip ? idMap.get(src.parentId!)! : targetParentId,
          childIds: src.childIds.filter(c => copiedIds.has(c)).map(c => idMap.get(c)!),
          // Verweesde resourceverwijzingen overslaan.
          resourceIds: src.resourceIds.filter(r => resourceExists.has(r)),
        };
        s.tasks.push(task);
      }

      // Nieuwe roots aan de doelouder hangen.
      if (targetParentId) {
        const parent = s.tasks.find(t => t.id === targetParentId);
        if (parent) parent.childIds.push(...newRootIds);
      }

      // Interne relaties opnieuw aanmaken met de nieuwe ids. Spread behoudt óók de
      // optionele lag-velden (lagUnit/lagPercent) — die vielen hier eerder stil weg.
      for (const seq of clip.sequences) {
        s.sequences.push({
          ...seq,
          id: generateId('seq'),
          predecessorId: idMap.get(seq.predecessorId)!,
          successorId: idMap.get(seq.successorId)!,
        });
      }

      // Resource-toewijzingen opnieuw aanmaken (resources die niet meer bestaan overslaan).
      for (const a of clip.assignments) {
        if (!resourceExists.has(a.resourceId)) continue;
        s.assignments.push({
          id: generateId('asgn'),
          taskId: idMap.get(a.taskId)!,
          resourceId: a.resourceId,
          units: a.units,
        });
      }

      // WBS: geplakte takken zouden anders de codes van hun bron letterlijk dupliceren.
      // Auto-nummering ⇒ hele boom; anders alleen de geplakte tak een afgeleide code geven.
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else {
        const codes = deriveWbsCodes(s.tasks);
        for (const newId of idMap.values()) {
          const t = s.tasks.find(x => x.id === newId);
          const code = codes.get(newId);
          if (t && code !== undefined) t.wbsCode = code;
        }
      }

      s.selectedTaskIds = newRootIds;
      s.isDirty = true;
    });
    return newRootIds;
  },

  renumberWbs: () =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      applyWbsNumbering(s.tasks);
      s.isDirty = true;
    }),

  insertWbsTemplate: (template, parentId) => {
    if (template.tasks.length === 0) return null;
    let newRootId: string | null = null;
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const startDate = s.project.startDate || formatDate(new Date());
      const idMap = new Map<string, string>();
      for (const tt of template.tasks) idMap.set(tt.id, generateId('task'));

      for (const tt of template.tasks) {
        const id = idMap.get(tt.id)!;
        const parent = tt.parentId ? idMap.get(tt.parentId)! : parentId;
        if (tt.parentId === null) newRootId = id;
        s.tasks.push({
          id,
          name: tt.name,
          description: tt.description,
          wbsCode: '',
          taskType: tt.taskType,
          status: 'NOT_STARTED',
          isMilestone: tt.isMilestone,
          priority: 0,
          parentId: parent ?? null,
          childIds: template.tasks.filter(c => c.parentId === tt.id).map(c => idMap.get(c.id)!),
          time: createDefaultTaskTime(startDate, tt.isMilestone ? 0 : tt.durationDays),
          resourceIds: [],
        });
      }
      if (parentId && newRootId) {
        const parent = s.tasks.find(t => t.id === parentId);
        if (parent) parent.childIds.push(newRootId);
      }
      for (const q of template.sequences) {
        s.sequences.push({
          ...q,
          id: generateId('seq'),
          predecessorId: idMap.get(q.predecessorId)!,
          successorId: idMap.get(q.successorId)!,
        });
      }

      // WBS-codes: auto ⇒ hele boom; anders alleen de ingevoegde tak afleiden.
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else {
        const codes = deriveWbsCodes(s.tasks);
        for (const id of idMap.values()) {
          const task = s.tasks.find(t2 => t2.id === id);
          const code = codes.get(id);
          if (task && code !== undefined) task.wbsCode = code;
        }
      }

      if (newRootId) s.selectedTaskIds = [newRootId];
      s.isDirty = true;
    });
    return newRootId;
  },
});
