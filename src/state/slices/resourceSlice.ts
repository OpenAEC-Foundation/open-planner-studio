import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

/** Puur leesbaarheids-alias: `WorkCalendar` heeft al `id`/`name`, dus geen aparte intersectie
 *  nodig — een resource-kalender IS gewoon een `WorkCalendar` (zie fase 2.5-ontwerp §3.1). */
export type NamedCalendar = WorkCalendar;

export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** Resource-kalenders (fase 2.5). Informatief: raakt CPM niet aan, voedt alleen belasting. */
  resourceCalendars: WorkCalendar[];
  addResource: (res: Omit<Resource, 'id'>) => string;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  removeResource: (id: string) => void;
  /** Leaf-only (§2.4): geen-op op mijlpalen/samenvattingstaken — geen assignment, geen snapshot. */
  assignResource: (taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve) => void;
  unassignResource: (assignmentId: string) => void;
  addResourceCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateResourceCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  /** Resources met calendarId===id vallen terug op undefined (projectkalender). */
  removeResourceCalendar: (id: string) => void;
}

export const createResourceSlice: AppSlice<ResourceSlice> = (set) => ({
  resources: [],
  assignments: [],
  resourceCalendars: [],

  addResource: (res) => {
    const id = generateId('res');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resources.push({ ...res, id });
      s.isDirty = true;
    });
    return id;
  },

  updateResource: (id, updates) =>
    set((s) => {
      const idx = s.resources.findIndex(r => r.id === id);
      if (idx < 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.resources[idx], updates);
      s.isDirty = true;
    }),

  removeResource: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resources = s.resources.filter(r => r.id !== id);
      s.assignments = s.assignments.filter(a => a.resourceId !== id);
      // Verweesde verwijzingen in task.resourceIds opruimen.
      for (const task of s.tasks) {
        const idx = task.resourceIds.indexOf(id);
        if (idx >= 0) task.resourceIds.splice(idx, 1);
      }
      // Ploeg-lidmaatschap opruimen: leden van een verwijderde CREW vallen terug op geen ouder.
      for (const r of s.resources) {
        if (r.parentId === id) r.parentId = undefined;
      }
      s.isDirty = true;
    }),

  assignResource: (taskId, resourceId, unitsPerDay, curve) =>
    set((s) => {
      // Leaf-only, geen-milestone-assignment-regel (§2.4): vroege return, geen snapshot.
      const task = s.tasks.find(t => t.id === taskId);
      if (!task || task.isMilestone || task.childIds.length > 0) return;

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const id = generateId('asgn');
      s.assignments.push({ id, taskId, resourceId, unitsPerDay, curve });
      if (!task.resourceIds.includes(resourceId)) {
        task.resourceIds.push(resourceId);
      }
      s.isDirty = true;
    }),

  unassignResource: (assignmentId) =>
    set((s) => {
      const removed = s.assignments.find(a => a.id === assignmentId);
      if (!removed) return;

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      s.assignments = s.assignments.filter(a => a.id !== assignmentId);
      // task.resourceIds alleen opschonen als er geen andere toewijzing van
      // dezelfde resource aan dezelfde taak meer bestaat.
      const stillAssigned = s.assignments.some(
        a => a.taskId === removed.taskId && a.resourceId === removed.resourceId,
      );
      if (!stillAssigned) {
        const task = s.tasks.find(t => t.id === removed.taskId);
        const idx = task?.resourceIds.indexOf(removed.resourceId) ?? -1;
        if (task && idx >= 0) task.resourceIds.splice(idx, 1);
      }
      s.isDirty = true;
    }),

  addResourceCalendar: (cal) => {
    const id = generateId('rescal');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resourceCalendars.push({ ...cal, id });
      s.isDirty = true;
    });
    return id;
  },

  updateResourceCalendar: (id, updates) =>
    set((s) => {
      const idx = s.resourceCalendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.resourceCalendars[idx], updates);
      s.isDirty = true;
    }),

  removeResourceCalendar: (id) =>
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resourceCalendars = s.resourceCalendars.filter(c => c.id !== id);
      // Resources die naar deze kalender verwezen vallen terug op de projectkalender.
      for (const r of s.resources) {
        if (r.calendarId === id) r.calendarId = undefined;
      }
      s.isDirty = true;
    }),
});
