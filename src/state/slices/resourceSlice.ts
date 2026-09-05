import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { TimephasedContourPeriod } from '@/types/task';
import { contourIndexForAssignment } from '@/engine/contour/contourEngine';
import { generateId } from '@/utils/id';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { syncProjectCalendar } from '../syncProjectCalendar';
import {
  clearTimephasedWindow, clearTimephasedDurationWalks, taskCalendarHoursPerDay, taskWorkMinutesOf,
} from '@/utils/taskDefaults';
import {
  captureTriangle, commitTrianglePlan, planWorkEdit, settleAssignmentAdded, settleAssignmentRemoved,
  settleCalendarChange, settleDurationAftermath, settleUnitsEdit,
} from '@/engine/work/workRuleApply';
import { notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { tasksOnCalendar } from '../calendarTasks';
import type { Task } from '@/types/task';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import type { AppSliceFactory } from './types';
import { isSummaryTask } from '@/utils/taskHierarchy';

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
  /** Taaktypes-etappe (spec 2026-09-04 §5 rij 3): zet het RESTERENDE werk (werkminuten, > 0) van
   *  één toewijzing; de werkdriehoek leidt daaruit inzet of restduur af volgens de regel van de
   *  taak (`workTriangle.ts`'s `applyWorkEdit`). Een gewijzigde taakduur zet `scheduleStale`,
   *  herschaalt de contour en wist het Z8-venster — precies zoals een duurbewerking. Weigert stil
   *  (geen snapshot) bij onbekend id, ongeldig werk of een taak waarop de regel niet werkt. */
  setAssignmentWork: (assignmentId: string, remainingWorkMinutes: number) => void;
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

/** Geldige capaciteit/eenheden (fase 2.5 UX-fix, bevinding 1): strikt positief en eindig. 0 is
 *  nooit zinvol (een resource die 0 eenheden kan leveren, of een toewijzing van 0/dag). Fracties
 *  blijven toegestaan (materiaal-max.eenheden, halve-dag-toewijzingen). */
const isValidUnits = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Taaktypes-etappe: oude werkminuten van een taak vóór een driehoekstap (voor de contourherschaling). */
function workMinutesBefore(s: { calendars: WorkCalendar[]; calendar: WorkCalendar }, task: Task): number {
  return taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar));
}

export const createResourceSlice: AppSliceFactory<ResourceSlice> = (runtime) => (set, get) => ({
  resources: [],
  assignments: [],
  calendars: [],

  addResource: (res) => {
    const id = generateId('res');
    set((s) => {
      runtime.beginUndoable(s);
      // #21: automatische kleur bij aanmaak (B7) — eerste vrije paletkleur, tenzij de aanroeper
      // zelf al een kleur meegaf (de resource-editor kan dat). Kleurloze resources vallen in de
      // weergave terug op de deterministische hash — dit veld is dus puur gemak, geen vereiste.
      const color = res.color ?? nextFreePaletteColor(s.resources);
      s.resources.push({ ...res, id, color });
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
    set((s) => {
      if (!s.resources.some(r => r.id === id)) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      // Taaktypes-etappe (spec §5 rij 5, reviewbevinding B4): elke verdwijnende toewijzing is een
      // "resource eraf" voor haar taak — momentopname MÉT de toewijzing, settle erná.
      const doomed = s.assignments.filter(a => a.resourceId === id);
      const captured = doomed.map(a => {
        const task = s.tasks.find(t => t.id === a.taskId);
        return task ? { task, assignmentId: a.id, triangle: captureTriangle(task, s.assignments, s), oldWorkMinutes: workMinutesBefore(s, task) } : null;
      });
      s.resources = s.resources.filter(r => r.id !== id);
      s.assignments = s.assignments.filter(a => a.resourceId !== id);
      let stale = false;
      for (const c of captured) {
        if (!c) continue;
        if (settleAssignmentRemoved(c.task, s.assignments, c.triangle, c.assignmentId).durationChanged) {
          settleDurationAftermath(c.task, s, c.oldWorkMinutes);
          stale = true;
        }
      }
      // Verweesde verwijzingen in task.resourceIds opruimen.
      for (const task of s.tasks) {
        const idx = task.resourceIds.indexOf(id);
        if (idx >= 0) task.resourceIds.splice(idx, 1);
      }
      // Ploeg-lidmaatschap opruimen: leden van een verwijderde CREW vallen terug op geen ouder.
      for (const r of s.resources) {
        if (r.parentId === id) r.parentId = undefined;
      }
      runtime.finishMutation(s, { stale });
    });
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
      if (!task || task.isMilestone || isSummaryTask(task)) return;
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

      // Taaktypes-etappe (spec §5 rij 4, beslispunt 8-B): momentopname ZONDER de nieuwe toewijzing.
      const triangle = captureTriangle(task, s.assignments, s);
      const oldWorkMinutes = workMinutesBefore(s, task);
      const id = generateId('asgn');
      const added: ResourceAssignment = { id, taskId, resourceId, unitsPerDay, curve };
      s.assignments.push(added);
      if (!task.resourceIds.includes(resourceId)) {
        task.resourceIds.push(resourceId);
      }
      // Onder FIXED_WORK/FIXED_RATE (zonder MSP-`effortDriven: false`) blijft het restwerk staan en
      // wordt de restduur korter; onder de standaardregel verandert niets (byte-identiek).
      const settled = settleAssignmentAdded(task, s.assignments, triangle, added);
      if (settled.durationChanged) settleDurationAftermath(task, s, oldWorkMinutes);
      // Z14b (eigenaarsprincipe 2026-08-18, F2-fixronde) — "toewijzingen" is expliciet onderdeel
      // van de edit-time-invalidatie-triggerset (zie `taskDefaults.ts`'s `clearTimephasedWindow`/
      // `clearTimephasedDurationWalks`): een andere resource kan een andere resourcekalender
      // betekenen, precies de Z8-laag-4-discriminator — dus BEIDE lagen wissen, niet alleen het
      // laag-3-venster. `mcpTransaction.ts`'s `assignResource` is de gedocumenteerde tweeling.
      const clearedWindow = clearTimephasedWindow(task);
      const clearedWalks = clearTimephasedDurationWalks(task);
      lostTimephasedGuidance = clearedWindow || clearedWalks;
      runtime.finishMutation(s, { stale: settled.durationChanged });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  updateAssignment: (assignmentId, updates) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `assignResource` hierboven (alleen relevant wanneer de
    // werkdriehoek de taakduur verandert).
    let lostTimephasedGuidance = false;
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
      runtime.beginUndoable(s);
      // Taaktypes-etappe (spec §5 rij 2): momentopname VÓÓR de inzetwijziging; de exacte invoer
      // wordt eerst geschreven, daarna volgen werk en/of restduur de regel van de taak.
      const task = s.tasks.find(t => t.id === s.assignments[idx].taskId);
      const unitsEdit = task && typeof patch.unitsPerDay === 'number' && patch.unitsPerDay !== s.assignments[idx].unitsPerDay
        ? { task, triangle: captureTriangle(task, s.assignments, s), oldWorkMinutes: workMinutesBefore(s, task) }
        : null;
      Object.assign(s.assignments[idx], patch);
      // Contour-engine (2026-09): een bewuste curvekeuze van de gebruiker vervangt de exacte
      // geïmporteerde 21-punts curve (`curveValues`, P6/MSPDI) — anders zou het histogram de oude
      // P6-vorm blijven tonen terwijl de dropdown de nieuwe keuze laat zien.
      if ('curve' in patch) delete s.assignments[idx].curveValues;
      let stale = false;
      if (unitsEdit) {
        const settled = settleUnitsEdit(unitsEdit.task, s.assignments, unitsEdit.triangle, assignmentId, s.assignments[idx].unitsPerDay);
        if (settled.durationChanged) {
          lostTimephasedGuidance = settleDurationAftermath(unitsEdit.task, s, unitsEdit.oldWorkMinutes);
          stale = true;
        }
      }
      runtime.finishMutation(s, { stale });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeResourceLoad();
    get().recomputeViewRows(); // resource-naam/toewijzing raakt kolom/groep/filter (§4.3).
  },

  setAssignmentWork: (assignmentId, remainingWorkMinutes) => {
    let lostTimephasedGuidance = false;
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a) return;
      const task = s.tasks.find(t => t.id === a.taskId);
      if (!task) return;
      if (typeof remainingWorkMinutes !== 'number' || !Number.isFinite(remainingWorkMinutes) || remainingWorkMinutes <= 0) return;
      const oldWorkMinutes = workMinutesBefore(s, task);
      // Eerst plannen (puur), dan pas de snapshot: een weigering laat geen lege undo-stap achter.
      const plan = planWorkEdit(task, s.assignments, s, assignmentId, remainingWorkMinutes);
      if (!plan) return;
      runtime.beginUndoable(s);
      const settled = commitTrianglePlan(task, s.assignments, plan);
      s.taskTypesVisible = true; // spec §7: documentontsluiting.
      if (settled.durationChanged) lostTimephasedGuidance = settleDurationAftermath(task, s, oldWorkMinutes);
      runtime.finishMutation(s, { stale: settled.durationChanged });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  setAssignmentContour: (assignmentId, periods) => {
    set((s) => {
      const a = s.assignments.find(x => x.id === assignmentId);
      if (!a) return;
      const task = s.tasks.find(t => t.id === a.taskId);
      if (!task) return;
      const siblings = s.assignments.filter(x => x.taskId === a.taskId);
      const idx = contourIndexForAssignment(task.timephasedContours, siblings, assignmentId);
      if (periods === null && idx < 0) return;
      runtime.beginUndoable(s);
      const list = task.timephasedContours ? [...task.timephasedContours] : [];
      if (periods === null) {
        list.splice(idx, 1);
      } else if (idx >= 0) {
        list[idx] = { ...list[idx], resourceId: a.resourceId, periods };
      } else {
        // `resourceUid: null`: geen MS Project-herkomst — dit is een eigen verdeling van de gebruiker
        // (`TaskTimephasedNotice` leest dat onderscheid).
        list.push({ resourceUid: null, resourceId: a.resourceId, periods });
      }
      task.timephasedContours = list.length > 0 ? list : undefined;
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

      // Taaktypes-etappe (spec §5 rij 5): momentopname MÉT de te verwijderen toewijzing.
      const triangleTask = s.tasks.find(t => t.id === removed.taskId);
      const triangle = triangleTask ? captureTriangle(triangleTask, s.assignments, s) : null;
      const oldWorkMinutes = triangleTask ? workMinutesBefore(s, triangleTask) : 0;
      s.assignments = s.assignments.filter(a => a.id !== assignmentId);
      let stale = false;
      if (triangleTask) {
        const settled = settleAssignmentRemoved(triangleTask, s.assignments, triangle, assignmentId);
        if (settled.durationChanged) { settleDurationAftermath(triangleTask, s, oldWorkMinutes); stale = true; }
      }
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
      // Z14b (F2-fixronde) — "toewijzingen"-trigger, beide lagen (zie assignResource hierboven).
      const removedTask = s.tasks.find(t => t.id === removed.taskId);
      if (removedTask) {
        const clearedWindow = clearTimephasedWindow(removedTask);
        const clearedWalks = clearTimephasedDurationWalks(removedTask);
        lostTimephasedGuidance = clearedWindow || clearedWalks;
      }
      runtime.finishMutation(s, { stale });
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
      if (!newTask || newTask.isMilestone || isSummaryTask(newTask)) return;
      // Weiger dubbele resource-op-taak (dekt ook het degenererende geval newTaskId === oude taskId:
      // de bestaande toewijzing zelf telt al mee als "al op de doeltaak").
      const alreadyOnTarget = s.assignments.some(
        a => a.taskId === newTaskId && a.resourceId === assignment.resourceId
      );
      if (alreadyOnTarget) return;

      runtime.beginUndoable(s);

      const oldTaskId = assignment.taskId;
      // Taaktypes-etappe (spec §5 rij 4/5, reviewbevinding B4): verplaatsen = eraf bij de oude taak
      // én erbij bij de nieuwe. Beide momentopnamen VÓÓR de wissel (oud mét, nieuw zónder).
      const oldTaskForTriangle = s.tasks.find(t => t.id === oldTaskId);
      const oldTriangle = oldTaskForTriangle ? captureTriangle(oldTaskForTriangle, s.assignments, s) : null;
      const oldWorkOld = oldTaskForTriangle ? workMinutesBefore(s, oldTaskForTriangle) : 0;
      const newTriangle = captureTriangle(newTask, s.assignments, s);
      const oldWorkNew = workMinutesBefore(s, newTask);
      assignment.taskId = newTaskId;
      let stale = false;
      if (oldTaskForTriangle && settleAssignmentRemoved(oldTaskForTriangle, s.assignments, oldTriangle, assignmentId).durationChanged) {
        settleDurationAftermath(oldTaskForTriangle, s, oldWorkOld);
        stale = true;
      }
      if (settleAssignmentAdded(newTask, s.assignments, newTriangle, assignment).durationChanged) {
        settleDurationAftermath(newTask, s, oldWorkNew);
        stale = true;
      }

      // task.resourceIds bijwerken op de OUDE taak (verwijderen als geen andere toewijzing van
      // dezelfde resource meer resteert — spiegelt unassignResource) en de NIEUWE taak (toevoegen
      // als nog niet aanwezig — spiegelt assignResource).
      const stillOnOld = s.assignments.some(
        a => a.taskId === oldTaskId && a.resourceId === assignment.resourceId
      );
      if (!stillOnOld) {
        const oldTask = s.tasks.find(t => t.id === oldTaskId);
        const idx = oldTask?.resourceIds.indexOf(assignment.resourceId) ?? -1;
        if (oldTask && idx >= 0) oldTask.resourceIds.splice(idx, 1);
      }
      if (!newTask.resourceIds.includes(assignment.resourceId)) {
        newTask.resourceIds.push(assignment.resourceId);
      }
      // Z14b (F2-fixronde) — "toewijzingen"-trigger raakt BEIDE taken, BEIDE lagen (zie
      // assignResource hierboven).
      const oldTaskForWindow = s.tasks.find(t => t.id === oldTaskId);
      if (oldTaskForWindow) {
        const clearedOldWindow = clearTimephasedWindow(oldTaskForWindow);
        const clearedOldWalks = clearTimephasedDurationWalks(oldTaskForWindow);
        if (clearedOldWindow || clearedOldWalks) lostCount++;
      }
      const clearedNewWindow = clearTimephasedWindow(newTask);
      const clearedNewWalks = clearTimephasedDurationWalks(newTask);
      if (clearedNewWindow || clearedNewWalks) lostCount++;
      runtime.finishMutation(s, { stale });
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
    let changed = 0;
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      runtime.beginUndoable(s);
      // K2 (eigenaarsbesluit 2026-09-05): andere uren per dag ⇒ de werkregel beslist per taak op
      // deze kalender (momentopnamen vóór de mutatie, want de kalender muteert in-place).
      const affected = tasksOnCalendar(s, id).map(task => ({ task, before: captureTriangle(task, s.assignments, s), oldDays: task.time.scheduleDuration }));
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      for (const { task, before, oldDays } of affected) {
        if (settleCalendarChange(task, s.assignments, before, s).durationChanged) {
          settleDurationAftermath(task, s, oldDays * taskCalendarHoursPerDay(task, s.calendars, s.calendar) * 60);
          changed++;
        }
      }
      // Pure naamswijziging raakt geen datums (§5.4); elke andere mutatie wél.
      const onlyName = Object.keys(updates).length === 1 && 'name' in updates;
      runtime.finishMutation(s, { stale: !onlyName });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, get().activeDocumentId, changed);
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
