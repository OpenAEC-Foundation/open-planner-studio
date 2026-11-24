import type { Task, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import { arrayOf, enumOf, integer, NON_EMPTY_TEXT, NON_NEGATIVE, objectOf, type IfcxField } from '../fieldTable';
import type { TaskReadTarget, TaskWriteSource } from './taskFields';

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;

const PERIOD = objectOf({
  afterMinutes: { value: NON_NEGATIVE }, minutes: { value: NON_NEGATIVE }, workMinutes: { value: NON_NEGATIVE }, kind: { value: enumOf(['actual', 'remaining']) },
});

const periodsOf = (periods: readonly TimephasedContourPeriod[]): TimephasedContourPeriod[] =>
  periods.map(period => ({ afterMinutes: period.afterMinutes, minutes: period.minutes, workMinutes: period.workMinutes, kind: period.kind }));

function contoursOut(contours: readonly TaskTimephasedContour[]) {
  return contours.map(contour => ({
    ...(contour.resourceUid !== null ? { resourceUid: contour.resourceUid } : {}),
    ...(contour.resourceId !== undefined ? { resourceId: contour.resourceId } : {}),
    periods: periodsOf(contour.periods),
  }));
}

function contoursIn(value: readonly { resourceUid?: number; resourceId?: string; periods: TimephasedContourPeriod[] }[]): TaskTimephasedContour[] {
  return value.map(contour => ({
    resourceUid: contour.resourceUid ?? null,
    ...(contour.resourceId !== undefined ? { resourceId: contour.resourceId } : {}),
    periods: periodsOf(contour.periods),
  }));
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

export const TASK_RESOURCE_OPS_FIELDS: readonly TaskField[] = [
  {
    key: 'resourceIds', value: arrayOf(NON_EMPTY_TEXT), optional: true,
    write: s => (sameList(s.task.resourceIds, s.assignedResourceIds) ? undefined : [...s.task.resourceIds]),
    read: (v, t) => { t.resourceIdsOverride = v === undefined ? undefined : [...(v as string[])]; },
  },
  {
    key: 'timephasedContours', optional: true,
    value: arrayOf(objectOf({
      resourceUid: { value: integer(), optional: true }, resourceId: { value: NON_EMPTY_TEXT, optional: true }, periods: { value: arrayOf(PERIOD) },
    })),
    write: s => (s.task.timephasedContours ? contoursOut(s.task.timephasedContours) : undefined),
    read: (v, t) => {
      if (v !== undefined) t.task.timephasedContours = contoursIn(v as { resourceUid?: number; resourceId?: string; periods: TimephasedContourPeriod[] }[]);
    },
  },
];

export const TASK_RESOURCE_KEYS_CARRIED: readonly (keyof Task)[] = ['resourceIds', 'timephasedContours'];
