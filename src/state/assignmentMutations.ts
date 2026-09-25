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
import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import { isValidUnits, type Resource, type ResourceAssignment } from '@/types/resource';
import { contourIndexForAssignment } from '@/engine/contour/contourEngine';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { invalidateForAssignmentChange } from '@/utils/taskDefaults';

/** Minimale state-vorm (subset van AppState) — vermijdt een import van de volledige storetype. */
interface AssignmentState {
  tasks: Task[];
  resources: Resource[];
  assignments: ResourceAssignment[];
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
 *  blijven dus ongemoeid. Geeft, zoals `relocateAssignment`, de ids terug van de taken die
 *  MSP-sturing verloren (in takenvolgorde). */
export function purgeResource(s: AssignmentState, id: string, crewKey: 'unset' | 'delete'): string[] {
  const affectedTaskIds = new Set<string>();
  for (const a of s.assignments) if (a.resourceId === id) affectedTaskIds.add(a.taskId);
  s.resources = s.resources.filter(r => r.id !== id);
  s.assignments = s.assignments.filter(a => a.resourceId !== id);
  const lost: string[] = [];
  for (const task of s.tasks) {
    const idx = task.resourceIds.indexOf(id);
    if (idx >= 0) task.resourceIds.splice(idx, 1);
    if (affectedTaskIds.has(task.id) && invalidateForAssignmentChange(task)) lost.push(task.id);
  }
  for (const r of s.resources) {
    if (r.parentId !== id) continue;
    if (crewKey === 'delete') delete r.parentId;
    else r.parentId = undefined;
  }
  return lost;
}

/** Haalt `resourceId` uit `task.resourceIds`, maar alleen als er op die taak geen andere
 *  toewijzing van dezelfde resource meer bestaat. */
export function pruneTaskResourceRef(s: AssignmentState, taskId: string, resourceId: string): void {
  if (s.assignments.some(a => a.taskId === taskId && a.resourceId === resourceId)) return;
  const task = s.tasks.find(t => t.id === taskId);
  const idx = task?.resourceIds.indexOf(resourceId) ?? -1;
  if (task && idx >= 0) task.resourceIds.splice(idx, 1);
}

/** Voegt een al gevalideerde toewijzing toe aan `task`. `true` ⇒ de taak verloor MSP-sturing. */
export function insertAssignment(s: AssignmentState, task: Task, assignment: ResourceAssignment): boolean {
  s.assignments.push(assignment);
  if (!task.resourceIds.includes(assignment.resourceId)) task.resourceIds.push(assignment.resourceId);
  // Z14b (F2-fixronde): "toewijzingen" hoort bij de invalidatie-triggerset, zie `taskDefaults.ts`.
  return invalidateForAssignmentChange(task);
}

/** Verwijdert een bestaande toewijzing. `true` ⇒ haar taak verloor MSP-sturing. */
export function removeAssignment(s: AssignmentState, removed: ResourceAssignment): boolean {
  s.assignments = s.assignments.filter(a => a.id !== removed.id);
  pruneTaskResourceRef(s, removed.taskId, removed.resourceId);
  const task = s.tasks.find(t => t.id === removed.taskId);
  return task ? invalidateForAssignmentChange(task) : false;
}

/** Verplaatst `assignment` naar `newTask` (eenheden/curve blijven staan) en werkt `resourceIds` op
 *  oude én nieuwe taak bij. De trigger raakt BEIDE taken; geeft de ids terug die sturing verloren
 *  (oude taak eerst). */
export function relocateAssignment(s: AssignmentState, assignment: ResourceAssignment, newTask: Task): string[] {
  const oldTaskId = assignment.taskId;
  assignment.taskId = newTask.id;
  pruneTaskResourceRef(s, oldTaskId, assignment.resourceId);
  if (!newTask.resourceIds.includes(assignment.resourceId)) newTask.resourceIds.push(assignment.resourceId);
  const lost: string[] = [];
  const oldTask = s.tasks.find(t => t.id === oldTaskId);
  if (oldTask && invalidateForAssignmentChange(oldTask)) lost.push(oldTaskId);
  if (invalidateForAssignmentChange(newTask)) lost.push(newTask.id);
  return lost;
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

export function applyAssignmentPatch(assignment: ResourceAssignment, patch: AssignmentPatch): void {
  Object.assign(assignment, patch);
  // Contour-engine (2026-09): een bewuste curvekeuze van de gebruiker vervangt de exacte
  // geïmporteerde 21-punts curve (`curveValues`, P6/MSPDI) — anders zou het histogram de oude
  // P6-vorm blijven tonen terwijl de dropdown de nieuwe keuze laat zien.
  if ('curve' in patch) delete assignment.curveValues;
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
