import type { Project } from '@/types/project';
import type { Task, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import type { IfcxField } from './fieldTable';
import {
  DOCUMENT_OPS_FIELDS, PROJECT_KEYS_CARRIED, WORKPLAN_FIELDS, type DocumentReadTarget, type DocumentWriteSource,
} from './fields/documentFields';
import {
  CALENDAR_KEYS_CARRIED, CALENDAR_OPS_FIELDS, CALENDAR_PLANNING_FIELDS, type CalendarReadTarget, type CalendarWriteSource,
} from './fields/calendarFields';
import {
  TASK_ACTIVITY_FIELDS, TASK_KEYS_CARRIED, TASK_OPS_FIELDS, TASK_TIME_KEYS_CARRIED, type TaskReadTarget, type TaskWriteSource,
} from './fields/taskFields';
import {
  SEQUENCE_KEYS_CARRIED, SEQUENCE_OPS_FIELDS, SEQUENCE_PLANNING_FIELDS, type SequenceReadTarget, type SequenceWriteSource,
} from './fields/sequenceFields';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import { TASK_RESOURCE_KEYS_CARRIED, TASK_RESOURCE_OPS_FIELDS } from './fields/taskResourceFields';
import {
  RESOURCE_KEYS_CARRIED, RESOURCE_OPS_FIELDS, RESOURCE_PLANNING_FIELDS, type ResourceReadTarget, type ResourceWriteSource,
} from './fields/resourceFields';
import {
  ASSIGNMENT_KEYS_CARRIED, ASSIGNMENT_OPS_FIELDS, ASSIGNMENT_PLANNING_FIELDS, type AssignmentReadTarget, type AssignmentWriteSource,
} from './fields/assignmentFields';
import {
  BASELINE_KEYS_CARRIED, BASELINE_OPS_FIELDS, BASELINE_PLANNING_FIELDS, type BaselineReadTarget, type BaselineWriteSource,
} from './fields/baselineFields';

export interface IfcxFieldGroup<W, R, D> {
  readonly planning: readonly IfcxField<W, R>[];
  readonly ops: readonly IfcxField<W, R>[];
  readonly carries: readonly (keyof D)[];
}

export interface TaskFieldGroup extends IfcxFieldGroup<TaskWriteSource, TaskReadTarget, Task> {
  readonly carriesTime: readonly (keyof TaskTime)[];
}

export const DOCUMENT_GROUPS: readonly IfcxFieldGroup<DocumentWriteSource, DocumentReadTarget, Project>[] = [
  { planning: WORKPLAN_FIELDS, ops: DOCUMENT_OPS_FIELDS, carries: PROJECT_KEYS_CARRIED },
];

export const CALENDAR_GROUPS: readonly IfcxFieldGroup<CalendarWriteSource, CalendarReadTarget, WorkCalendar>[] = [
  { planning: CALENDAR_PLANNING_FIELDS, ops: CALENDAR_OPS_FIELDS, carries: CALENDAR_KEYS_CARRIED },
];

export const TASK_GROUPS: readonly TaskFieldGroup[] = [
  { planning: TASK_ACTIVITY_FIELDS, ops: TASK_OPS_FIELDS, carries: TASK_KEYS_CARRIED, carriesTime: TASK_TIME_KEYS_CARRIED },
  { planning: [], ops: TASK_RESOURCE_OPS_FIELDS, carries: TASK_RESOURCE_KEYS_CARRIED, carriesTime: [] },
];

export const SEQUENCE_GROUPS: readonly IfcxFieldGroup<SequenceWriteSource, SequenceReadTarget, Sequence>[] = [
  { planning: SEQUENCE_PLANNING_FIELDS, ops: SEQUENCE_OPS_FIELDS, carries: SEQUENCE_KEYS_CARRIED },
];

export const RESOURCE_GROUPS: readonly IfcxFieldGroup<ResourceWriteSource, ResourceReadTarget, Resource>[] = [
  { planning: RESOURCE_PLANNING_FIELDS, ops: RESOURCE_OPS_FIELDS, carries: RESOURCE_KEYS_CARRIED },
];

export const ASSIGNMENT_GROUPS: readonly IfcxFieldGroup<AssignmentWriteSource, AssignmentReadTarget, ResourceAssignment>[] = [
  { planning: ASSIGNMENT_PLANNING_FIELDS, ops: ASSIGNMENT_OPS_FIELDS, carries: ASSIGNMENT_KEYS_CARRIED },
];

export const BASELINE_GROUPS: readonly IfcxFieldGroup<BaselineWriteSource, BaselineReadTarget, Baseline>[] = [
  { planning: BASELINE_PLANNING_FIELDS, ops: BASELINE_OPS_FIELDS, carries: BASELINE_KEYS_CARRIED },
];

function fieldsOf<W, R, D>(groups: readonly IfcxFieldGroup<W, R, D>[]) {
  return { planning: groups.flatMap(group => group.planning), ops: groups.flatMap(group => group.ops) };
}

export const DOCUMENT_AREA = fieldsOf(DOCUMENT_GROUPS);
export const CALENDAR_AREA = fieldsOf(CALENDAR_GROUPS);
export const TASK_AREA = fieldsOf(TASK_GROUPS);
export const SEQUENCE_AREA = fieldsOf(SEQUENCE_GROUPS);
export const RESOURCE_AREA = fieldsOf(RESOURCE_GROUPS);
export const ASSIGNMENT_AREA = fieldsOf(ASSIGNMENT_GROUPS);
export const BASELINE_AREA = fieldsOf(BASELINE_GROUPS);

export const carriedKeys = <W, R, D>(groups: readonly IfcxFieldGroup<W, R, D>[]) => new Set<keyof D>(groups.flatMap(group => group.carries));
