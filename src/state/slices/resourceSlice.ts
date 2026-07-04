import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import { syncProjectCalendar } from '../syncProjectCalendar';
import type { AppSlice } from './types';

/** Puur leesbaarheids-alias: `WorkCalendar` heeft al `id`/`name`, dus geen aparte intersectie
 *  nodig — een resource-kalender IS gewoon een `WorkCalendar` (zie fase 2.5-ontwerp §3.1). */
export type NamedCalendar = WorkCalendar;

export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** Gedeelde kalender-bibliotheek (fase 2.8a, §4.1): project, taken én resources wijzen hierin.
   *  Hernoemd uit `resourceCalendars` (fase 2.5). undefined calendarId = projectkalender. */
  calendars: WorkCalendar[];
  addResource: (res: Omit<Resource, 'id'>) => string;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  removeResource: (id: string) => void;
  /** Leaf-only (§2.4): geen-op op mijlpalen/samenvattingstaken — geen assignment, geen snapshot. */
  assignResource: (taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve) => void;
  /** Wijzig eenheden/curve van een bestaande toewijzing (inline-bewerken in de UI, §6.3). */
  updateAssignment: (assignmentId: string, updates: Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>) => void;
  unassignResource: (assignmentId: string) => void;
  /** Bibliotheek-CRUD (fase 2.8a, §4.1) — hernoemd uit add/update/removeCalendar. */
  addCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  /** Verwijder een bibliotheek-kalender: task/resource-verwijzingen én (indien de projectdefault)
   *  de projectkalender vallen terug op een fallback (§4.3/§9.2). */
  removeCalendar: (id: string) => void;
}

/** Geldige capaciteit/eenheden (fase 2.5 UX-fix, bevinding 1): strikt positief en eindig. 0 is
 *  nooit zinvol (een resource die 0 eenheden kan leveren, of een toewijzing van 0/dag). Fracties
 *  blijven toegestaan (materiaal-max.eenheden, halve-dag-toewijzingen). */
const isValidUnits = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

export const createResourceSlice: AppSlice<ResourceSlice> = (set, get) => ({
  resources: [],
  assignments: [],
  calendars: [],

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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
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
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  addCalendar: (cal) => {
    const id = generateId('cal');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.calendars.push({ ...cal, id });
      syncProjectCalendar(s); // houd de gedenormaliseerde projectkalender-cache in sync (§9.1).
      s.isDirty = true;
      s.scheduleStale = true; // conservatief datum-beïnvloedend (§5.4).
    });
    get().recomputeResourceLoad();
  return id;
  },

  updateCalendar: (id, updates) => {
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      s.isDirty = true;
      // Pure naamswijziging raakt geen datums (§5.4); elke andere mutatie wél.
      const onlyName = Object.keys(updates).length === 1 && 'name' in updates;
      if (!onlyName) s.scheduleStale = true;
    });
    get().recomputeResourceLoad();
  },

  removeCalendar: (id) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.calendars = s.calendars.filter(c => c.id !== id);
      // Verweesde verwijzingen opruimen: resources én taken vallen terug op de projectkalender.
      for (const r of s.resources) {
        if (r.calendarId === id) r.calendarId = undefined;
      }
      for (const t of s.tasks) {
        if (t.calendarId === id) t.calendarId = undefined;
      }
      // Was dit de projectdefault, dan de projectkalender op een fallback zetten (§9.2).
      if (s.project.calendarId === id) {
        const fallback = s.calendars[0];
        if (fallback) {
          s.project.calendarId = fallback.id;
          s.calendar = fallback;
        }
        // Geen enkele bibliotheek-entry meer: `s.calendar` blijft de laatst-bekende cache staan.
      }
      syncProjectCalendar(s);
      s.isDirty = true;
      s.scheduleStale = true;
    });
    get().recomputeResourceLoad();
  },
});
