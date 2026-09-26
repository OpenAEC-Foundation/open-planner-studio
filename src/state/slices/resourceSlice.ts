import { isValidUnits, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { TimephasedContourPeriod } from '@/types/task';
import { generateId } from '@/utils/id';
import { sameValue } from '@/utils/sameValue';
import { syncProjectCalendar } from '../syncProjectCalendar';
import {
  clearTimephasedWindow, clearLevelingGaps, taskCalendarHoursPerDay, taskWorkMinutesOf, hourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  acceptedAssignmentPatch, applyAssignmentPatch, contoursAfterEdit, insertAssignment, insertResource,
  purgeResource, relocateAssignment, removeAssignment,
} from '../assignmentMutations';
import {
  commitTrianglePlan, planWorkEdit,
  captureCalendarChange, settleCalendarChange, settleDurationAftermath, syncAssignmentWorkToContour,
} from '@/engine/work/workRuleApply';
import { notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { captureCalendarLibraryChange, settleCalendarLibraryChange, tasksOnCalendar } from '../calendarTasks';
import type { Task } from '@/types/task';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import type { AppSliceFactory } from './types';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { AppState } from '../appStore';

/** Puur leesbaarheids-alias: `WorkCalendar` heeft al `id`/`name`, dus geen aparte intersectie
 *  nodig — een resource-kalender IS gewoon een `WorkCalendar` (zie fase 2.5-ontwerp §3.1). */
export type NamedCalendar = WorkCalendar;

type CalendarLibraryState = Pick<AppState, 'calendars' | 'calendar' | 'project' | 'resources' | 'tasks'>;

/**
 * Zou `commitCalendarLibrary(calendars, projectCalendarId)` per saldo iets veranderen? Spiegelt de
 * effecten van die actie één voor één: de bibliotheek zelf, de projectdefault (met dezelfde
 * terugval), het opruimen van verweesde verwijzingen en het gelijkzetten van de projectkalender-
 * cache. Bestaat hier de reden voor: de kalenderdialoog commit bij Toepassen én bij elke Enter de
 * hele buffer; zonder deze toets werd een ongewijzigde buffer een lege undo-stap, een "gewijzigd"
 * document en — via de herberekening — het einde van de modus "datums zoals opgeslagen" (#63).
 */
function libraryCommitChanges(s: CalendarLibraryState, calendars: WorkCalendar[], projectCalendarId: string): boolean {
  if (!sameValue(s.calendars, calendars)) return true;
  const ids = new Set(calendars.map(c => c.id));
  const nextProjectId = ids.has(projectCalendarId) ? projectCalendarId : (calendars[0]?.id ?? s.project.calendarId);
  if (nextProjectId !== s.project.calendarId) return true;
  if (s.resources.some(r => r.calendarId && !ids.has(r.calendarId))) return true;
  if (s.tasks.some(t => t.calendarId && !ids.has(t.calendarId))) return true;
  const entry = calendars.find(c => c.id === nextProjectId);
  return !entry || !sameValue(s.calendar, entry);
}

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
  /** No-op (geen snapshot, geen isDirty/stale) als `updates` per saldo niets verandert — de
   *  resourcekalenderdialoog stuurt bij Toepassen altijd de hele draft mee. */
  updateCalendar: (id: string, updates: Partial<WorkCalendar>) => void;
  /** Verwijder een bibliotheek-kalender: task/resource-verwijzingen én (indien de projectdefault)
   *  de projectkalender vallen terug op een fallback (§4.3/§9.2). */
  removeCalendar: (id: string) => void;
  /** Commit de complete kalender-bibliotheek + projectdefault in één keer (kalenderdialoog-buffer,
   *  fase 2.8b): vervangt `calendars`, ruimt verweesde task/resource-verwijzingen op en zet de
   *  projectkalender. Eén undo-snapshot voor de hele dialoogsessie. Verandert de commit per saldo
   *  niets, dan is hij een no-op (geen snapshot, geen isDirty/stale) en geeft hij `false` terug, zodat
   *  de dialoog ook de herberekening overslaat; `true` = er is gecommit. */
  commitCalendarLibrary: (calendars: WorkCalendar[], projectCalendarId: string) => boolean;
}

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
      const outcome = purgeResource(s, id, 'unset');
      lostCount = outcome.lostTaskIds.length;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
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
      // Het lichaam (en de invalidatie van MSP-sturing en nivelleergaten) deelt deze actie met
      // `createMcpTransactions.ts`'s `draft.assignResource`, zie `assignmentMutations.ts`.
      const id = generateId('asgn');
      const outcome = insertAssignment(s, task, { id, taskId, resourceId, unitsPerDay, curve });
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
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
      const patch = acceptedAssignmentPatch(updates);
      if (!patch) return;
      runtime.beginUndoable(s);
      const outcome = applyAssignmentPatch(s, s.assignments[idx], patch);
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
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
      const finishBasis = hourInputFinishBasis(task); // B1: vóór `commitTrianglePlan`.
      // Eerst plannen (puur), dan pas de snapshot: een weigering laat geen lege undo-stap achter.
      const plan = planWorkEdit(task, s.assignments, s, assignmentId, remainingWorkMinutes);
      if (!plan) return;
      runtime.beginUndoable(s);
      const settled = commitTrianglePlan(task, s.assignments, plan);
      s.taskTypesVisible = true; // spec §7: documentontsluiting.
      if (settled.durationChanged) lostTimephasedGuidance = settleDurationAftermath(task, s, oldWorkMinutes, finishBasis);
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
      const edit = contoursAfterEdit(s, task, a, periods);
      if (!edit) return;
      runtime.beginUndoable(s);
      task.timephasedContours = edit.contours;
      // Fable-critreview #170, bevinding 3: de bewerkte verdeling IS het werk — een aanwezig werkveld
      // volgt de contoursom, anders wint het oude getal bij de volgende duurwijziging.
      syncAssignmentWorkToContour(a, periods);
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
      const outcome = removeAssignment(s, removed);
      lostTimephasedGuidance = outcome.lostTaskIds.length > 0;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
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
      const outcome = relocateAssignment(s, assignment, newTask);
      lostCount = outcome.lostTaskIds.length;
      runtime.finishMutation(s, { stale: outcome.durationChanged });
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
    let lost = 0;
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === id);
      if (idx < 0) return;
      // No-op-guard vóór de snapshot (zoals `setCalendar`): de resourcekalenderdialoog stuurt bij
      // Toepassen de hele draft; ongewijzigd ⇒ geen lege undo-stap, geen isDirty, geen stale.
      const current = s.calendars[idx] as unknown as Record<string, unknown>;
      if (Object.entries(updates).every(([k, v]) => sameValue(current[k], v))) return;
      runtime.beginUndoable(s);
      // K2 (eigenaarsbesluit 2026-09-05): andere uren per dag ⇒ de werkregel beslist per taak op
      // deze kalender (momentopnamen vóór de mutatie, want de kalender muteert in-place).
      const affected = tasksOnCalendar(s, id).map(task => ({ task, before: captureCalendarChange(task, s.assignments, s) }));
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      for (const { task, before } of affected) {
        const settled = settleCalendarChange(task, s.assignments, before, s);
        if (settled.durationChanged) changed++;
        if (settled.timephasedLost) lost++; // reviewronde G4: zelfde melding als de andere paden.
      }
      // Pure naamswijziging raakt geen datums (§5.4); elke andere mutatie wél.
      const onlyName = Object.keys(updates).length === 1 && 'name' in updates;
      runtime.finishMutation(s, { stale: !onlyName });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lost > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lost);
    get().recomputeResourceLoad();
  },

  removeCalendar: (id) => {
    // mpp-nul-data-etappe, DEEL 1 — deze twee acties kunnen VEEL taken tegelijk raken (loop over
    // `s.tasks`), dus tellen zelf op i.p.v. één losse boolean; zie `assignResource` hierboven voor
    // de discipline.
    let lostCount = 0;
    let changed = 0;
    set((s) => {
      if (!s.calendars.some(c => c.id === id)) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      // Fable-critreview #170, bevinding 2: K2 — de taken die van kalender wisselen (terugval op de
      // projectkalender, of een nieuwe projectkalender) volgen hun werkregel, net als `updateCalendar`.
      const k2 = captureCalendarLibraryChange(s);
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
      const settled = settleCalendarLibraryChange(s, k2);
      changed = settled.changed;
      lostCount += settled.lost;
      runtime.finishMutation(s, { stale: true });
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
  },

  commitCalendarLibrary: (calendars, projectCalendarId) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `removeCalendar` hierboven.
    let lostCount = 0;
    let changed = 0;
    let committed = false;
    set((s) => {
      // No-op-guard vóór de snapshot — zie `libraryCommitChanges`.
      if (!libraryCommitChanges(s, calendars, projectCalendarId)) return;
      committed = true;
      runtime.beginUndoable(s);
      // Fable-critreview #170, bevinding 2: dít is de UI-route voor uren per dag (`CalendarDialog`
      // commit de hele bibliotheek). K2 zoals `updateCalendar`: momentopname vóór, werkregel erna.
      const k2 = captureCalendarLibraryChange(s);
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
      const settled = settleCalendarLibraryChange(s, k2);
      changed = settled.changed;
      lostCount += settled.lost;
      runtime.finishMutation(s, { stale: true });
    });
    if (!committed) return false;
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, changed);
    if (lostCount > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, lostCount);
    get().recomputeResourceLoad();
    return true;
  },
});
