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
];

export const SEQUENCE_GROUPS: readonly IfcxFieldGroup<SequenceWriteSource, SequenceReadTarget, Sequence>[] = [
  { planning: SEQUENCE_PLANNING_FIELDS, ops: SEQUENCE_OPS_FIELDS, carries: SEQUENCE_KEYS_CARRIED },
];

export const planningFields = <W, R, D>(groups: readonly IfcxFieldGroup<W, R, D>[]) => groups.flatMap(group => group.planning);
export const opsFields = <W, R, D>(groups: readonly IfcxFieldGroup<W, R, D>[]) => groups.flatMap(group => group.ops);
export const carriedKeys = <W, R, D>(groups: readonly IfcxFieldGroup<W, R, D>[]) => new Set<keyof D>(groups.flatMap(group => group.carries));
