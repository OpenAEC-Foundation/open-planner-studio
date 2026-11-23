// shownWork.ts — het resterende werk van een toewijzing zoals het veld *Werk (u)* het toont. Puur, geen
// store. Het paneel (`TaskAssignmentsSection`) en de melding over de uren van anderen
// (`state/otherWorkNotice.ts`, #954) lezen hiermee hetzelfde getal.
import type { ResourceAssignment } from '@/types/resource';
import type { Task, TaskTimephasedContour } from '@/types/task';
import { remainingMinutesOf } from './workRuleApply';

/** Opgeslagen restwerk, anders de som van de `remaining`-periodes van de gekoppelde contour, anders
 *  restduur × inzet. In werkminuten. */
export function shownRemainingWorkMinutes(
  task: Task,
  assignment: Pick<ResourceAssignment, 'unitsPerDay' | 'remainingWorkMinutes'>,
  contour: TaskTimephasedContour | undefined,
  hoursPerDay: number,
): number {
  const contourRemaining = contour
    ? contour.periods.reduce((sum, p) => sum + (p.kind === 'actual' ? 0 : p.workMinutes), 0)
    : undefined;
  return assignment.remainingWorkMinutes ?? contourRemaining ?? remainingMinutesOf(task, { hoursPerDay }) * assignment.unitsPerDay;
}

/** Werkminuten als uren op twee decimalen, zoals *Werk (u)* ze toont. */
export function shownWorkHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
