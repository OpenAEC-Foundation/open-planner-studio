import type { ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import { matchContoursToAssignments } from './contourEngine';

/**
 * De WEERGAVE-toestand van de curve van één toewijzing — de ene regel die het eigenschappenpaneel
 * (`TaskAssignmentsSection`) en het resourcediagram (`computeResourceGanttRows`) delen, zodat een
 * uitgedeeld vel nooit iets anders zegt dan het paneel:
 *
 * 1. een aan de toewijzing gekoppelde CONTOUR op de taak (`Task.timephasedContours` via
 *    `matchContoursToAssignments`) ⇒ `'contoured'` — de urenverdeling is dan data, de curve doet
 *    er niet toe;
 * 2. anders exacte geïmporteerde curvewaarden ZONDER OPS-vorm (`curveValues` en geen `curve`,
 *    zoals een P6-/MSP-curve die geen van de acht eigen vormen is) ⇒ `'imported'`;
 * 3. anders de OPS-vorm, `curve` afwezig = `'UNIFORM'`.
 *
 * Let op: dit is bewust NIET de verdeelregel van `ResourceLoad.ts`'s `assignmentDayUnits`. Die
 * verdeelt met `curveValues` zodra die er zijn — óók naast een `curve` (het gewone P6-pad:
 * naamterugval plús exacte waarden) — en negeert een contour zonder periodes. Weergave en
 * verdeling mogen dus verschillen ("Vooraan belast" op het scherm, P6's exacte 21 waarden in het
 * histogram); wat hier vastligt is dat alle WEERGAVEN onderling gelijk zijn. Wie de verdeelregel
 * ooit gelijk wil trekken, doet dat in `assignmentDayUnits`, niet hier.
 */
export type AssignmentCurveState = ResourceCurve | 'contoured' | 'imported';

/** De ids van de toewijzingen van `task` waaraan een contour gekoppeld is. Geef ALLE records van
 *  de taak mee (ook naar een onbekende resource): de legacy-terugval in
 *  `matchContoursToAssignments` telt de lijstlengte, dus een gefilterde lijst valt anders uit dan
 *  het paneel en de lastverdeling. */
export function contouredAssignmentIds(
  task: Pick<Task, 'timephasedContours'>,
  records: readonly ResourceAssignment[],
): Set<string> {
  if (!task.timephasedContours || task.timephasedContours.length === 0) return new Set();
  return new Set(matchContoursToAssignments(task.timephasedContours, records).keys());
}

export function assignmentCurveState(a: ResourceAssignment, contoured: boolean): AssignmentCurveState {
  if (contoured) return 'contoured';
  if (!a.curve && a.curveValues && a.curveValues.length > 0) return 'imported';
  return a.curve ?? 'UNIFORM';
}
