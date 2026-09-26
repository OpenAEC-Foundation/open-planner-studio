// Gedeelde muteerlichamen voor resources en toewijzingen (resourceSlice én de MCP-draft).
//
// Deze stonden twee keer uitgeschreven: in de slice-acties (`resourceSlice.ts`) en in hun
// snapshot-vrije tweelingen (`runtime/createMcpTransactions.ts`). De LICHAMEN waren identiek; wat
// verschilt blijft bewust bij de aanroeper:
//  - de guards — de slice weigert STIL (geen snapshot), de draft GOOIT een herkenbare fout, en de
//    slice toetst bij toewijzen ook onbekende resource en dubbele resource-op-taak (de MCP-toollaag
//    valideert dat vooraf);
//  - undo/`isDirty`/`scheduleStale` — de slice via `beginUndoable`/`finishMutation`, de draft zet
//    alleen `isDirty`;
//  - het verlies van MSP-sturing — de slice telt en meldt zelf, de draft registreert per taak op
//    de MCP-lease. Daarom geven de lichamen de taak-ids terug die sturing verloren, niet een melding.
//
// Werkt op Immer-drafts (zoals `taskTree.ts`): de functies MUTEREN, doen geen snapshot en geen
// guard. Roep ze pas aan nadat de aanroeper zijn guards en `beginUndoable` gedaan heeft.
//
// Integratie groep B × #170 (besluit 2): dit is ook DE plek van de werkregel-nazorg (taaktypes-
// etappe, spec §5 rij 2/4/5): momentopname van de werkdriehoek vóór de wijziging (`captureTriangle`
// + oude werkminuten + `hourInputFinishBasis`), de regel na de wijziging (`settleAssignmentAdded`/
// `settleAssignmentRemoved`/`settleUnitsEdit`) en bij een gewijzigde taakduur de duurnazorg
// (`settleDurationAftermath`). DAARNA volgt onvoorwaardelijk de toewijzingen-trigger
// (`invalidateForAssignmentChange`). De uitkomst zegt welke taken MSP-sturing verloren en of er een
// taakduur veranderde (⇒ de slice markeert de planning verouderd).
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import { isValidUnits, type Resource, type ResourceAssignment } from '@/types/resource';
import { contourIndexForAssignment } from '@/engine/contour/contourEngine';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import type { WorkCalendar } from '@/types/calendar';
import {
  hourInputFinishBasis, invalidateForAssignmentChange, taskCalendarHoursPerDay, taskWorkMinutesOf,
  type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  captureTriangle, settleAssignmentAdded, settleAssignmentRemoved, settleDurationAftermath, settleUnitsEdit,
  type CapturedTriangle, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';

/** Minimale state-vorm (subset van AppState) — vermijdt een import van de volledige storetype. De
 *  kalender-/projectvelden zijn voor de werkdriehoek (`WorkRuleDeps`). */
interface AssignmentState extends WorkRuleDeps {
  tasks: Task[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  calendars: WorkCalendar[];
  calendar: WorkCalendar;
}

/** Wat een toewijzingswijziging teweegbracht. `lostTaskIds`: taken die MSP-sturing (laag 3/4)
 *  verloren, in bewerkingsvolgorde, zonder dubbelen — de slice meldt het aantal, de MCP-draft
 *  registreert ze op de lease. `durationChanged`: de werkregel veranderde een taakduur. */
export interface AssignmentChangeOutcome {
  lostTaskIds: string[];
  durationChanged: boolean;
}

/** Momentopname van één taak vóór een toewijzingswijziging (werkdriehoek, oude werkminuten en de
 *  basis van het ingevoerde uur-einde — B1: altijd van vóór de wijziging). */
interface AssignmentTaskCapture {
  task: Task;
  triangle: CapturedTriangle | null;
  oldWorkMinutes: number;
  finishBasis: HourInputFinishBasis;
}

function captureAssignmentTask(s: AssignmentState, task: Task): AssignmentTaskCapture {
  return {
    task,
    triangle: captureTriangle(task, s.assignments, s),
    oldWorkMinutes: taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar)),
    finishBasis: hourInputFinishBasis(task),
  };
}

/** Verzamelt de uitkomst: duurnazorg bij een gewijzigde taakduur, dan (per taak één keer) de
 *  toewijzingen-trigger. */
class OutcomeBuilder {
  private readonly lost: string[] = [];
  durationChanged = false;

  settled(s: AssignmentState, c: AssignmentTaskCapture, durationChanged: boolean): void {
    if (!durationChanged) return;
    this.durationChanged = true;
    if (settleDurationAftermath(c.task, s, c.oldWorkMinutes, c.finishBasis)) this.markLost(c.task.id);
  }

  invalidate(task: Task): void {
    if (invalidateForAssignmentChange(task)) this.markLost(task.id);
  }

  private markLost(id: string): void {
    if (!this.lost.includes(id)) this.lost.push(id);
  }

  build(): AssignmentChangeOutcome {
    return { lostTaskIds: this.lost, durationChanged: this.durationChanged };
  }
}

export type AssignmentPatch = Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>;

/** Voegt een nieuwe resource toe. #21: automatische kleur bij aanmaak (B7) — de eerste vrije
 *  paletkleur, tenzij de aanroeper zelf al een kleur meegaf (de resource-editor kan dat). Kleurloze
 *  resources vallen in de weergave terug op de deterministische hash — dit veld is dus puur gemak,
 *  geen vereiste. */
export function insertResource(s: AssignmentState, res: Omit<Resource, 'id'>, id: string): void {
  const color = res.color ?? nextFreePaletteColor(s.resources);
  s.resources.push({ ...res, id, color });
}

/** Verwijdert resource `id`, al zijn toewijzingen, de verweesde `task.resourceIds`-verwijzingen en
 *  het ploeg-lidmaatschap van zijn leden (die vallen terug op geen ouder). `crewKey` is het ene
 *  verschil tussen de twee paden: de slice zet `parentId = undefined`, de MCP-draft haalt de sleutel
 *  weg (`delete`, zoals de rest van de draft voor een schoon IFC-object).
 *
 *  Elke taak die daarbij een toewijzing kwijtraakt, krijgt dezelfde "toewijzingen"-trigger als
 *  `removeAssignment` (`invalidateForAssignmentChange`: laag 3/4 en de nivelleergaten) — anders
 *  bleef hier nivelleer- en MSP-sturing staan die bij de verdwenen toewijzing hoorde. Taken met
 *  alleen een verweesde `resourceIds`-verwijzing (zonder toewijzing) houden hun toewijzingenset en
 *  blijven dus ongemoeid. Werkregel: elke verdwijnende toewijzing is een "resource eraf" voor haar
 *  taak (zie `removeAssignment`). */
export function purgeResource(s: AssignmentState, id: string, crewKey: 'unset' | 'delete'): AssignmentChangeOutcome {
  // Taaktypes-etappe (spec §5 rij 5, reviewbevinding B4): elke verdwijnende toewijzing is een
  // "resource eraf" voor haar taak — momentopname MÉT de toewijzing, settle erná.
  const captured = s.assignments
    .filter(a => a.resourceId === id)
    .flatMap((a) => {
      const task = s.tasks.find(t => t.id === a.taskId);
      return task ? [{ assignmentId: a.id, capture: captureAssignmentTask(s, task) }] : [];
    });
  s.resources = s.resources.filter(r => r.id !== id);
  s.assignments = s.assignments.filter(a => a.resourceId !== id);
  const out = new OutcomeBuilder();
  for (const c of captured) {
    out.settled(s, c.capture, settleAssignmentRemoved(c.capture.task, s.assignments, c.capture.triangle, c.assignmentId).durationChanged);
  }
  const affected = new Set(captured.map(c => c.capture.task));
  for (const task of s.tasks) {
    const idx = task.resourceIds.indexOf(id);
    if (idx >= 0) task.resourceIds.splice(idx, 1);
    if (affected.has(task)) out.invalidate(task);
  }
  for (const r of s.resources) {
    if (r.parentId !== id) continue;
    if (crewKey === 'delete') delete r.parentId;
    else r.parentId = undefined;
  }
  return out.build();
}

/** Haalt `resourceId` uit `task.resourceIds`, maar alleen als er op die taak geen andere
 *  toewijzing van dezelfde resource meer bestaat. */
export function pruneTaskResourceRef(s: AssignmentState, taskId: string, resourceId: string): void {
  if (s.assignments.some(a => a.taskId === taskId && a.resourceId === resourceId)) return;
  const task = s.tasks.find(t => t.id === taskId);
  const idx = task?.resourceIds.indexOf(resourceId) ?? -1;
  if (task && idx >= 0) task.resourceIds.splice(idx, 1);
}

/** Voegt een al gevalideerde toewijzing toe aan `task`. Onder FIXED_WORK/FIXED_RATE (zonder MSP-
 *  `effortDriven: false`) blijft het restwerk staan en wordt de restduur korter; onder de
 *  standaardregel verandert niets (spec §5 rij 4, beslispunt 8-B: momentopname ZONDER de nieuwe). */
export function insertAssignment(s: AssignmentState, task: Task, assignment: ResourceAssignment): AssignmentChangeOutcome {
  const capture = captureAssignmentTask(s, task);
  s.assignments.push(assignment);
  if (!task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  const out = new OutcomeBuilder();
  out.settled(s, capture, settleAssignmentAdded(task, s.assignments, capture.triangle, assignment).durationChanged);
  // Z14b (F2-fixronde): "toewijzingen" hoort bij de invalidatie-triggerset, zie `taskDefaults.ts`.
  out.invalidate(task);
  return out.build();
}

/** Verwijdert een bestaande toewijzing (spec §5 rij 5: momentopname MÉT de toewijzing). */
export function removeAssignment(s: AssignmentState, removed: ResourceAssignment): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === removed.taskId);
  const capture = task ? captureAssignmentTask(s, task) : null;
  s.assignments = s.assignments.filter(a => a.id !== removed.id);
  const out = new OutcomeBuilder();
  if (capture) out.settled(s, capture, settleAssignmentRemoved(capture.task, s.assignments, capture.triangle, removed.id).durationChanged);
  pruneTaskResourceRef(s, removed.taskId, removed.resourceId);
  if (task) out.invalidate(task);
  return out.build();
}

/** Verplaatst `assignment` naar `newTask` (eenheden/curve blijven staan) en werkt `resourceIds` op
 *  oude én nieuwe taak bij. Werkregel (spec §5 rij 4/5, reviewbevinding B4): eraf bij de oude taak
 *  én erbij bij de nieuwe, beide momentopnamen vóór de wissel. De trigger raakt BEIDE taken; de
 *  verlieslijst noemt de oude taak eerst. */
export function relocateAssignment(s: AssignmentState, assignment: ResourceAssignment, newTask: Task): AssignmentChangeOutcome {
  const oldTaskId = assignment.taskId;
  const oldTask = s.tasks.find(t => t.id === oldTaskId);
  const oldCapture = oldTask ? captureAssignmentTask(s, oldTask) : null;
  const newCapture = captureAssignmentTask(s, newTask);
  assignment.taskId = newTask.id;
  const out = new OutcomeBuilder();
  if (oldCapture) out.settled(s, oldCapture, settleAssignmentRemoved(oldCapture.task, s.assignments, oldCapture.triangle, assignment.id).durationChanged);
  out.settled(s, newCapture, settleAssignmentAdded(newTask, s.assignments, newCapture.triangle, assignment).durationChanged);
  pruneTaskResourceRef(s, oldTaskId, assignment.resourceId);
  if (!newTask.resourceIds.includes(assignment.resourceId)) newTask.resourceIds.push(assignment.resourceId);
  if (oldTask) out.invalidate(oldTask);
  out.invalidate(newTask);
  return out.build();
}

/** Weigeren-met-behoud (bevinding 1): een ongeldige eenheden/dag valt uit de patch, een
 *  gelijktijdige curvewijziging gaat door. `null` ⇒ er blijft niets te doen. */
export function acceptedAssignmentPatch(updates: AssignmentPatch): AssignmentPatch | null {
  let patch = updates;
  if ('unitsPerDay' in patch && !isValidUnits(patch.unitsPerDay)) {
    patch = { ...patch };
    delete patch.unitsPerDay;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

/** Schrijft een geaccepteerde patch. Een inzetwijziging laat werk en/of restduur de werkregel van
 *  de taak volgen (spec §5 rij 2: momentopname VÓÓR, de exacte invoer eerst geschreven). Geen
 *  toewijzingen-trigger: de toewijzingenset blijft gelijk. */
export function applyAssignmentPatch(s: AssignmentState, assignment: ResourceAssignment, patch: AssignmentPatch): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === assignment.taskId);
  const capture = task && typeof patch.unitsPerDay === 'number' && patch.unitsPerDay !== assignment.unitsPerDay
    ? captureAssignmentTask(s, task)
    : null;
  Object.assign(assignment, patch);
  // Contour-engine (2026-09): een bewuste curvekeuze van de gebruiker vervangt de exacte
  // geïmporteerde 21-punts curve (`curveValues`, P6/MSPDI) — anders zou het histogram de oude
  // P6-vorm blijven tonen terwijl de dropdown de nieuwe keuze laat zien.
  if ('curve' in patch) delete assignment.curveValues;
  const out = new OutcomeBuilder();
  if (capture) {
    out.settled(s, capture, settleUnitsEdit(capture.task, s.assignments, capture.triangle, assignment.id, assignment.unitsPerDay).durationChanged);
  }
  return out.build();
}

/** De `timephasedContours` van `task` nadat de contour van `assignment` gezet (`periods`) of
 *  losgelaten (`null`) is. `null` als resultaat ⇒ no-op (loslaten zonder bestaande contour). */
export function contoursAfterEdit(
  s: AssignmentState,
  task: Task,
  assignment: ResourceAssignment,
  periods: TimephasedContourPeriod[] | null,
): { contours: TaskTimephasedContour[] | undefined } | null {
  const siblings = s.assignments.filter(x => x.taskId === assignment.taskId);
  const idx = contourIndexForAssignment(task.timephasedContours, siblings, assignment.id);
  if (periods === null && idx < 0) return null;
  const list = task.timephasedContours ? [...task.timephasedContours] : [];
  if (periods === null) {
    list.splice(idx, 1);
  } else if (idx >= 0) {
    list[idx] = { ...list[idx], resourceId: assignment.resourceId, periods };
  } else {
    // `resourceUid: null`: geen MS Project-herkomst — dit is een eigen verdeling van de gebruiker
    // (`TaskTimephasedNotice` leest dat onderscheid).
    list.push({ resourceUid: null, resourceId: assignment.resourceId, periods });
  }
  return { contours: list.length > 0 ? list : undefined };
}
