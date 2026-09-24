import { isValidUnits, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { TimephasedContourPeriod } from '@/types/task';
import { generateId } from '@/utils/id';
import { syncProjectCalendar } from '../syncProjectCalendar';
import { clearTimephasedWindow, clearLevelingGaps } from '@/utils/taskDefaults';
import {
  acceptedAssignmentPatch, applyAssignmentPatch, contoursAfterEdit, insertAssignment, insertResource,
  purgeResource, relocateAssignment, removeAssignment,
} from '../assignmentMutations';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import type { AppSliceFactory } from './types';

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
  /** Contour-UI (2026-09): zet of vervang de OPGESLAGEN contour van één toewijzing
   *  (`Task.timephasedContours`, gekoppeld via `resourceId` — `contourEngine.ts`'s
   *  `matchContoursToAssignments`), of laat 'm los (`null` ⇒ de toewijzing valt terug op de
   *  curve-formule). Raakt GEEN taakdatum en geen `splitGaps` (de contour verdeelt uren binnen de
   *  bestaande duur; zie `contourEdit.ts`) — daarom geen `scheduleStale`, wél undo/`isDirty` en een
   *  verse belasting. `null` op een toewijzing zonder contour is een no-op (geen snapshot). */
  setAssignmentContour: (assignmentId: string, periods: TimephasedContourPeriod[] | null) => void;
  /** Verplaats een bestaande toewijzing naar een andere taak (fase 2.10, item 4): `unitsPerDay`/
   *  `curve` blijven ONGEWIJZIGD, alleen `taskId` + `resourceIds` op beide taken worden bijgewerkt.
   *  Weigert (false, geen snapshot) bij een milestone/samenvattings-doeltaak of wanneer de resource
   *  al op de doeltaak is toegewezen (P6/MSP-invariant: geen dubbele resource-op-taak). */
  moveAssignment: (assignmentId: string, newTaskId: string) => boolean;
  /** Bibliotheek-CRUD (fase 2.8a, §4.1) — hernoemd uit add/update/removeCalendar. */
  addCalendar: (cal: Omit<WorkCalendar, 'id'>) => string;
  updateCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  /** Verwijder een bibliotheek-kalender: task/resource-verwijzingen én (indien de projectdefault)
   *  de projectkalender vallen terug op een fallback (§4.3/§9.2). */
  removeCalendar: (id: string) => void;
  /** Commit de complete kalender-bibliotheek + projectdefault in één keer (kalenderdialoog-buffer,
   *  fase 2.8b): vervangt `calendars`, ruimt verweesde task/resource-verwijzingen op en zet de
   *  projectkalender. Eén undo-snapshot voor de hele dialoogsessie. */
  commitCalendarLibrary: (calendars: WorkCalendar[], projectCalendarId: string) => void;
}

export const createResourceSlice: AppSliceFactory<ResourceSlice> = (runtime) => (set, get) => ({
  resources: [],
  assignments: [],
  calendars: [],

  addResource: (res) => {
    const id = generateId('res');
    set((s) => {
      runtime.beginUndoable(s);
      insertResource(s, res, id); // #21: met de automatische paletkleur als default.
      runtime.finishMutation(s);
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
      runtime.beginUndoable(s);
      Object.assign(s.resources[idx], patch);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  removeResource: (id) => {
    // mpp-nul-data-etappe, DEEL 1 — kan meerdere taken tegelijk raken (elke taak met een toewijzing
    // van deze resource krijgt de toewijzingen-trigger, zie `purgeResource`), dus tellen zoals
    // `moveAssignment`/`removeCalendar`; melden buiten de producer.
    let lostCount = 0;
    set((s) => {
      if (!s.resources.some(r => r.id === id)) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      lostCount = purgeResource(s, id, 'unset').length;
      runtime.finishMutation(s);
    });
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  assignResource: (taskId, resourceId, unitsPerDay, curve) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `taskSlice.ts`'s `updateTask` voor de discipline (buiten
    // de Immer-producer, `notify` doet zelf een `set()`).
    let lostTimephasedGuidance = false;
    set((s) => {
      // Leaf-only, geen-milestone-assignment-regel (§2.4): vroege return, geen snapshot.
      const task = s.tasks.find(t => t.id === taskId);
      if (!task || task.isMilestone || task.childIds.length > 0) return;
      // Onbekend (of null/undefined — JS-callers via de dev-bridge omzeilen de compiler)
      // resourceId: stil weigeren, geen snapshot (M6-conventie, zoals removeResource). Een
      // toewijzing zonder bestaande resource vergiftigt anders élke writeIFC/auto-save
      // (guidOf leest resourceId.length).
      if (!s.resources.some(r => r.id === resourceId)) return;
      // Weigeren (bevinding 1): 0/negatieve eenheden/dag is geen geldige toewijzing.
      if (!isValidUnits(unitsPerDay)) return;
      // Eén resource kan per taak maar één assignment dragen. Zonder deze guard kan dezelfde
      // invariant via de bestaande eigenschappen-/lint-route alsnog worden omzeild.
      if (s.assignments.some(a => a.taskId === taskId && a.resourceId === resourceId)) return;

      runtime.beginUndoable(s);
      // Het lichaam (en de invalidatie van MSP-sturing en nivelleergaten) deelt deze actie met
      // `createMcpTransactions.ts`'s `draft.assignResource`, zie `assignmentMutations.ts`.
      const id = generateId('asgn');
      lostTimephasedGuidance = insertAssignment(s, task, { id, taskId, resourceId, unitsPerDay, curve });
      runtime.finishMutation(s);
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  updateAssignment: (assignmentId, updates) => {
    set((s) => {
      const idx = s.assignments.findIndex(a => a.id === assignmentId);
      if (idx < 0) return;
      const patch = acceptedAssignmentPatch(updates);
      if (!patch) return;
      runtime.beginUndoable(s);
      applyAssignmentPatch(s.assignments[idx], patch);
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  setAssignmentContour: (assignmentId, periods) => {
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a) return;
      const task = s.tasks.find(t => t.id === a.taskId);
      if (!task) return;
      const edit = contoursAfterEdit(s, task, a, periods);
      if (!edit) return;
      runtime.beginUndoable(s);
      task.timephasedContours = edit.contours;
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
  },

  unassignResource: (assignmentId) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `assignResource` hierboven.
    let lostTimephasedGuidance = false;
    set((s) => {
      const removed = s.assignments.find(a => a.id === assignmentId);
      if (!removed) return;

      runtime.beginUndoable(s);
      lostTimephasedGuidance = removeAssignment(s, removed);
      runtime.finishMutation(s);
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  moveAssignment: (assignmentId, newTaskId) => {
    let moved = false;
    // mpp-nul-data-etappe, DEEL 1 — aantal taken dat sturing verloor (0, 1 of 2 — oude/nieuwe taak
    // apart getoetst), zie `assignResource` hierboven voor de discipline.
    let lostCount = 0;
    set((s) => {
      const assignment = s.assignments.find(a => a.id === assignmentId);
      if (!assignment) return;
      const newTask = s.tasks.find(t => t.id === newTaskId);
      // Zelfde milestone/summary-guard als assignResource (§2.4) — geen toewijzing op zulke taken.
      if (!newTask || newTask.isMilestone || newTask.childIds.length > 0) return;
      // Weiger dubbele resource-op-taak (dekt ook het degenererende geval newTaskId === oude taskId:
      // de bestaande toewijzing zelf telt al mee als "al op de doeltaak").
      const alreadyOnTarget = s.assignments.some(
        a => a.taskId === newTaskId && a.resourceId === assignment.resourceId
      );
      if (alreadyOnTarget) return;

      runtime.beginUndoable(s);
      lostCount = relocateAssignment(s, assignment, newTask).length;
      runtime.finishMutation(s);
      moved = true;
    });
    if (moved && lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    if (moved) {
      get().recomputeResourceLoad();
      get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
    }
    return moved;
  },

  addCalendar: (cal) => {
    const id = generateId('cal');
    set((s) => {
      runtime.beginUndoable(s);
      s.calendars.push({ ...cal, id });
      syncProjectCalendar(s); // houd de gedenormaliseerde projectkalender-cache in sync (§9.1).
      runtime.finishMutation(s, { stale: true }); // conservatief datum-beïnvloedend (§5.4).
    });
    get().recomputeResourceLoad();
  return id;
  },

  updateCalendar: (id, updates) => {
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      runtime.beginUndoable(s);
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      // Pure naamswijziging raakt geen datums (§5.4); elke andere mutatie wél.
      const onlyName = Object.keys(updates).length === 1 && 'name' in updates;
      runtime.finishMutation(s, { stale: !onlyName });
    });
    get().recomputeResourceLoad();
  },

  removeCalendar: (id) => {
    // mpp-nul-data-etappe, DEEL 1 — deze twee acties kunnen VEEL taken tegelijk raken (loop over
    // `s.tasks`), dus tellen zelf op i.p.v. één losse boolean; zie `assignResource` hierboven voor
    // de discipline.
    let lostCount = 0;
    set((s) => {
      if (!s.calendars.some(c => c.id === id)) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      s.calendars = s.calendars.filter(c => c.id !== id);
      // Verweesde verwijzingen opruimen: resources én taken vallen terug op de projectkalender.
      for (const r of s.resources) {
        if (r.calendarId === id) r.calendarId = undefined;
      }
      for (const t of s.tasks) {
        if (t.calendarId === id) {
          t.calendarId = undefined;
          // Z14b (F3-fixronde) — dit is dezelfde "kalender"-trigger als `setTaskCalendar`, alleen
          // via een ander pad (rechtstreekse mutatie i.p.v. de dedicated actie). Zonder deze
          // aanroep bleef een bevroren Z8-venster staan terwijl de taak-kalender onder 'm wegviel.
          if (clearTimephasedWindow(t)) lostCount++;
          // B1c-plan3 taak 3 (spec §4, "Invalidatie") — zie `clearLevelingGaps` in taskDefaults.ts
          // (geen melding: app-eigen afgeleide uitvoer, geen importverlies).
          clearLevelingGaps(t);
        }
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
      runtime.finishMutation(s, { stale: true });
    });
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
  },

  commitCalendarLibrary: (calendars, projectCalendarId) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `removeCalendar` hierboven.
    let lostCount = 0;
    set((s) => {
      runtime.beginUndoable(s);
      s.calendars = calendars;
      const ids = new Set(calendars.map(c => c.id));
      // Verweesde verwijzingen opruimen (spiegelt removeCalendar, §4.3/§9.2): resources én taken
      // die naar een niet-langer-bestaande kalender wijzen vallen terug op de projectkalender.
      for (const r of s.resources) {
        if (r.calendarId && !ids.has(r.calendarId)) r.calendarId = undefined;
      }
      for (const t of s.tasks) {
        if (t.calendarId && !ids.has(t.calendarId)) {
          t.calendarId = undefined;
          // Z14b (F3-fixronde) — zelfde reden als removeCalendar hierboven.
          if (clearTimephasedWindow(t)) lostCount++;
          // B1c-plan3 taak 3 — zie removeCalendar hierboven.
          clearLevelingGaps(t);
        }
      }
      // Projectdefault: het meegegeven id als het (nog) bestaat, anders de eerste entry (§9.2).
      if (ids.has(projectCalendarId)) {
        s.project.calendarId = projectCalendarId;
      } else if (calendars[0]) {
        s.project.calendarId = calendars[0].id;
      }
      syncProjectCalendar(s);
      runtime.finishMutation(s, { stale: true });
    });
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
  },
});
