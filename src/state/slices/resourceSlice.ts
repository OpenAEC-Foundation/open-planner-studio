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
  /** Wijzig eenheden/curve van een bestaande toewijzing (inline-bewerken in de UI, §6.3). */
  updateAssignment: (assignmentId: string, updates: Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>) => void;
  unassignResource: (assignmentId: string) => void;
  addResourceCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateResourceCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  /** Resources met calendarId===id vallen terug op undefined (projectkalender). */
  removeResourceCalendar: (id: string) => void;
}

/** Geldige capaciteit/eenheden (fase 2.5 UX-fix, bevinding 1): strikt positief en eindig. 0 is
 *  nooit zinvol (een resource die 0 eenheden kan leveren, of een toewijzing van 0/dag). Fracties
 *  blijven toegestaan (materiaal-max.eenheden, halve-dag-toewijzingen). */
const isValidUnits = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

export const createResourceSlice: AppSlice<ResourceSlice> = (set, get) => ({
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
    // A6: pure resource-mutatie → histogram direct verversen (geen runCPM, datums onaangeroerd).
    get().recomputeResourceLoad();
    return id;
  },

  updateResource: (id, updates) => {
    set((s) => {
      const idx = s.resources.findIndex(r => r.id === id);
      if (idx < 0) return;
      // Weigeren-met-behoud (bevinding 1): een ongeldige max.eenheden-invoer wordt genegeerd,
      // de rest van de update gaat gewoon door (de oude maxUnits blijft staan).
      let patch = updates;
      if ('maxUnits' in patch && !isValidUnits(patch.maxUnits)) {
        patch = { ...patch };
        delete patch.maxUnits;
      }
      if (Object.keys(patch).length === 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.resources[idx], patch);
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
  },

  removeResource: (id) => {
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
    });
    get().recomputeResourceLoad();
  },

  assignResource: (taskId, resourceId, unitsPerDay, curve) => {
    set((s) => {
      // Leaf-only, geen-milestone-assignment-regel (§2.4): vroege return, geen snapshot.
      const task = s.tasks.find(t => t.id === taskId);
      if (!task || task.isMilestone || task.childIds.length > 0) return;
      // Weigeren (bevinding 1): 0/negatieve eenheden/dag is geen geldige toewijzing.
      if (!isValidUnits(unitsPerDay)) return;

      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      const id = generateId('asgn');
      s.assignments.push({ id, taskId, resourceId, unitsPerDay, curve });
      if (!task.resourceIds.includes(resourceId)) {
        task.resourceIds.push(resourceId);
      }
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
  },

  updateAssignment: (assignmentId, updates) => {
    set((s) => {
      const idx = s.assignments.findIndex(a => a.id === assignmentId);
      if (idx < 0) return;
      // Weigeren-met-behoud (bevinding 1): een ongeldige eenheden/dag-invoer wordt genegeerd,
      // een gelijktijdige curve-wijziging gaat wel door.
      let patch = updates;
      if ('unitsPerDay' in patch && !isValidUnits(patch.unitsPerDay)) {
        patch = { ...patch };
        delete patch.unitsPerDay;
      }
      if (Object.keys(patch).length === 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.assignments[idx], patch);
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
  },

  unassignResource: (assignmentId) => {
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
    });
    get().recomputeResourceLoad();
  },

  addResourceCalendar: (cal) => {
    const id = generateId('rescal');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resourceCalendars.push({ ...cal, id });
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
    return id;
  },

  updateResourceCalendar: (id, updates) => {
    set((s) => {
      const idx = s.resourceCalendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.resourceCalendars[idx], updates);
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
  },

  removeResourceCalendar: (id) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.resourceCalendars = s.resourceCalendars.filter(c => c.id !== id);
      // Resources die naar deze kalender verwezen vallen terug op de projectkalender.
      for (const r of s.resources) {
        if (r.calendarId === id) r.calendarId = undefined;
      }
      s.isDirty = true;
    });
    get().recomputeResourceLoad();
  },
});
