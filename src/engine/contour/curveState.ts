import type { ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import { matchContoursToAssignments } from './contourEngine';

export type AssignmentCurveState = ResourceCurve | 'contoured' | 'imported';

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
