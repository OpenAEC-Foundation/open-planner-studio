// Gedeelde muteerlichamen voor resources en toewijzingen (resourceSlice én de MCP-draft).
//
// Gedeeld door de slice-acties (`resourceSlice.ts`) en hun snapshot-vrije tweelingen
// (`runtime/createMcpTransactions.ts`). Het LICHAAM is gedeeld; wat verschilt blijft bewust bij de
// aanroeper:
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
// Dit is ook DE plek van de werkregel-nazorg: momentopname van de werkdriehoek vóór de wijziging
// (`captureTriangle` + oude werkminuten + `hourInputFinishBasis`), de regel na de wijziging
// (`settleAssignmentAdded`/`settleAssignmentRemoved`/`settleUnitsEdit`) en bij een gewijzigde
// taakduur de duurnazorg (`settleDurationAftermath`). DAARNA volgt de toewijzingen-trigger
// (`invalidateForAssignmentChange`), behalve voor een kostenresource (issue #815): een bedrag erbij
// of eraf raakt geen datum en wist dus nooit vensters, duur-walks of nivelleergaten. De uitkomst zegt welke taken MSP-sturing
// verloren en of er een taakduur veranderde (⇒ de slice markeert de planning verouderd).
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import {
  clearCostResourceFields, isCostResource, isValidCostAmount, isValidUnits, type Resource, type ResourceAssignment,
} from '@/types/resource';
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
 *  basis van het ingevoerde uur-einde — altijd van vóór de wijziging). */
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

/** Gaat een typewissel van `current` naar `nextType` over de COST-grens (naar of van kosten)? */
export function crossesCostBoundary(current: Pick<Resource, 'type'>, nextType: Resource['type'] | undefined): boolean {
  return nextType !== undefined && nextType !== current.type && (current.type === 'COST' || nextType === 'COST');
}

/** Heeft resource `id` toewijzingen in dit document? */
export function resourceHasAssignments(s: Pick<AssignmentState, 'assignments'>, id: string): boolean {
  return s.assignments.some(a => a.resourceId === id);
}

/** Waarom een resourcepatch (deels) niet mag (issue #815). */
export type CostResourcePatchRefusal =
  /** Typewissel naar of van COST terwijl de resource toewijzingen heeft. */
  | 'typeChangeWithAssignments'
  /** Tarief, kalender, stappen, eenheid, ploeg of max. eenheden ≠ 1 op een kostenresource. */
  | 'costResourceField';

/** Velden die een kostenresource nooit draagt; `maxUnits` mag alleen 1 zijn. */
const COST_REFUSED_KEYS = ['costPerHour', 'calendarId', 'availabilitySteps', 'unitOfMeasure', 'parentId'] as const;

/**
 * De kostenregels op een resourcepatch (issue #815, plan §1): een typewissel over de COST-grens
 * mag niet zolang de resource toewijzingen heeft (anders zou inzet/werk stil in een bedrag vertaald
 * moeten worden en terug), en een (wordende) kostenresource krijgt geen tarief, kalender, stappen,
 * eenheid, ploeg of max. eenheden ≠ 1. Geeft de patch zonder die sleutels terug plus wat er weg viel;
 * de store weigert met behoud (rest gaat door), de MCP-draft gooit bij een weigering.
 */
export function acceptedCostResourcePatch(
  s: Pick<AssignmentState, 'assignments'>,
  resource: Resource,
  updates: Partial<Resource>,
): { patch: Partial<Resource>; refused: CostResourcePatchRefusal[] } {
  const refused: CostResourcePatchRefusal[] = [];
  let patch = updates;
  const drop = (key: keyof Resource) => {
    if (patch === updates) patch = { ...updates };
    delete patch[key];
  };
  if (crossesCostBoundary(resource, patch.type) && resourceHasAssignments(s, resource.id)) {
    drop('type');
    refused.push('typeChangeWithAssignments');
  }
  const effectiveType = patch.type ?? resource.type;
  if (effectiveType === 'COST') {
    let dropped = false;
    for (const key of COST_REFUSED_KEYS) {
      if (patch[key] !== undefined) { drop(key); dropped = true; }
    }
    if ('maxUnits' in patch && patch.maxUnits !== 1) { drop('maxUnits'); dropped = true; }
    if (dropped) refused.push('costResourceField');
  }
  return { patch, refused };
}

/** Na een geaccepteerde patch: een kostenresource draagt de werkvelden niet (wist ze in-place). */
export function settleCostResourceFields(resource: Resource): void {
  if (isCostResource(resource)) clearCostResourceFields(resource);
}

/** Is `assignment` een toewijzing aan een kostenresource (issue #815)? */
export function isCostAssignment(s: Pick<AssignmentState, 'resources'>, assignment: Pick<ResourceAssignment, 'resourceId'>): boolean {
  return isCostResource(s.resources.find(r => r.id === assignment.resourceId));
}

/** De ongewijzigde invoer voor `setAssignmentCost`: een geldig bedrag (eindig, ≥ 0) of `undefined`
 *  (wissen). `false` ⇒ weigeren. */
export function acceptedCostAmount(amount: unknown): number | undefined | false {
  if (amount === undefined) return undefined;
  return isValidCostAmount(amount) ? amount : false;
}

/** Zet of wist het begrote bedrag van een kostentoewijzing (issue #815). Raakt geen datum, geen
 *  werk en geen sturing: geen werkregel, geen trigger. `false` ⇒ niets veranderd. */
export function applyAssignmentCost(assignment: ResourceAssignment, amount: number | undefined): boolean {
  if (assignment.costAmount === amount) return false;
  if (amount === undefined) delete assignment.costAmount;
  else assignment.costAmount = amount;
  return true;
}

/** Voegt een nieuwe resource toe, met automatische kleur bij aanmaak — de eerste vrije
 *  paletkleur, tenzij de aanroeper zelf al een kleur meegaf (de resource-editor kan dat). Kleurloze
 *  resources vallen in de weergave terug op de deterministische hash — dit veld is dus puur gemak,
 *  geen vereiste. */
export function insertResource(s: AssignmentState, res: Omit<Resource, 'id'>, id: string): void {
  const color = res.color ?? nextFreePaletteColor(s.resources);
  const resource: Resource = { ...res, id, color };
  settleCostResourceFields(resource); // kostenresource: geen tarief, kalender, eenheid, … (issue #815).
  s.resources.push(resource);
}

/** Verwijdert resource `id`, al zijn toewijzingen, de verweesde `task.resourceIds`-verwijzingen en
 *  het ploeg-lidmaatschap van zijn leden (die vallen terug op geen ouder). `crewKey` is het ene
 *  verschil tussen de twee paden: de slice zet `parentId = undefined`, de MCP-draft haalt de sleutel
 *  weg (`delete`, zoals de rest van de draft voor een schoon IFC-object).
 *
 *  Elke taak die daarbij een toewijzing kwijtraakt, krijgt dezelfde "toewijzingen"-trigger als
 *  `removeAssignment` (`invalidateForAssignmentChange`: laag 3/4 en de nivelleergaten) — anders
 *  blijft hier nivelleer- en MSP-sturing staan die bij de verdwenen toewijzing hoorde. Taken met
 *  alleen een verweesde `resourceIds`-verwijzing (zonder toewijzing) houden hun toewijzingenset en
 *  blijven dus ongemoeid. Werkregel: elke verdwijnende toewijzing is een "resource eraf" voor haar
 *  taak (zie `removeAssignment`). */
export function purgeResource(s: AssignmentState, id: string, crewKey: 'unset' | 'delete'): AssignmentChangeOutcome {
  // Elke verdwijnende toewijzing is een
  // "resource eraf" voor haar taak — momentopname MÉT de toewijzing, settle erná.
  const captured = s.assignments
    .filter(a => a.resourceId === id)
    .flatMap((a) => {
      const task = s.tasks.find(t => t.id === a.taskId);
      return task ? [{ assignmentId: a.id, capture: captureAssignmentTask(s, task) }] : [];
    });
  // Een kostenresource (issue #815) wist geen sturing: zijn toewijzingen zijn geen trigger.
  const cost = isCostResource(s.resources.find(r => r.id === id));
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
    if (affected.has(task) && !cost) out.invalidate(task);
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
 *  standaardregel verandert niets (momentopname ZONDER de nieuwe). */
export function insertAssignment(s: AssignmentState, task: Task, assignment: ResourceAssignment): AssignmentChangeOutcome {
  const capture = captureAssignmentTask(s, task);
  s.assignments.push(assignment);
  if (!task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  const out = new OutcomeBuilder();
  out.settled(s, capture, settleAssignmentAdded(task, s.assignments, capture.triangle, assignment).durationChanged);
  // "Toewijzingen" hoort bij de invalidatie-triggerset, zie `taskDefaults.ts` (kosten niet).
  if (!isCostAssignment(s, assignment)) out.invalidate(task);
  return out.build();
}

/** Verwijdert een bestaande toewijzing (momentopname MÉT de toewijzing). */
export function removeAssignment(s: AssignmentState, removed: ResourceAssignment): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === removed.taskId);
  const capture = task ? captureAssignmentTask(s, task) : null;
  s.assignments = s.assignments.filter(a => a.id !== removed.id);
  const out = new OutcomeBuilder();
  if (capture) out.settled(s, capture, settleAssignmentRemoved(capture.task, s.assignments, capture.triangle, removed.id).durationChanged);
  pruneTaskResourceRef(s, removed.taskId, removed.resourceId);
  if (task && !isCostAssignment(s, removed)) out.invalidate(task);
  return out.build();
}

/** Verplaatst `assignment` naar `newTask` (eenheden/curve blijven staan) en werkt `resourceIds` op
 *  oude én nieuwe taak bij. Werkregel: eraf bij de oude taak
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
  if (!isCostAssignment(s, assignment)) {
    if (oldTask) out.invalidate(oldTask);
    out.invalidate(newTask);
  }
  return out.build();
}

/** Weigeren-met-behoud: een ongeldige eenheden/dag valt uit de patch, een
 *  gelijktijdige curvewijziging gaat door. `null` ⇒ er blijft niets te doen. */
export function acceptedAssignmentPatch(updates: AssignmentPatch, isCost = false): AssignmentPatch | null {
  // Een kostentoewijzing heeft geen inzet en geen curve (issue #815).
  if (isCost) return null;
  let patch = updates;
  if ('unitsPerDay' in patch && !isValidUnits(patch.unitsPerDay)) {
    patch = { ...patch };
    delete patch.unitsPerDay;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

/** Schrijft een geaccepteerde patch. Een inzetwijziging laat werk en/of restduur de werkregel van
 *  de taak volgen (momentopname VÓÓR, de exacte invoer eerst geschreven). Geen
 *  toewijzingen-trigger: de toewijzingenset blijft gelijk. */
export function applyAssignmentPatch(s: AssignmentState, assignment: ResourceAssignment, patch: AssignmentPatch): AssignmentChangeOutcome {
  const task = s.tasks.find(t => t.id === assignment.taskId);
  const capture = task && typeof patch.unitsPerDay === 'number' && patch.unitsPerDay !== assignment.unitsPerDay
    ? captureAssignmentTask(s, task)
    : null;
  Object.assign(assignment, patch);
  // Een bewuste curvekeuze van de gebruiker vervangt de exacte
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
  // Een kostentoewijzing heeft geen urenverdeling (issue #815).
  if (isCostAssignment(s, assignment)) return null;
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
