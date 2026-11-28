import type { ResourceAssignment } from '@/types/resource';
import type { Task, TaskTimephasedContour } from '@/types/task';
import { remainingMinutesOf } from './workRuleApply';

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

export function shownWorkHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
