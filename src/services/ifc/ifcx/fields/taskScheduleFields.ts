import type { ConstraintType, Task, TaskConstraint, TaskSplitGap, TimephasedDurationWalk } from '@/types/task';
import { WORK_RULES } from '@/types/workRule';
import {
  arrayOf, BOOLEAN, enumOf, integer, LOCAL_MOMENT_OR_EMPTY, objectOf, REAL, TEXT, type IfcxField, type IfcxMember, type IfcxValue,
} from '../fieldTable';
import { enumOfTable, optional, passthroughField, required } from './passthroughFields';
import type { TaskReadTarget, TaskWriteSource } from './taskFields';

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;

const CONSTRAINT_TYPES = {
  ASAP: true, ALAP: true, SNET: true, SNLT: true, FNET: true, FNLT: true, MSO: true, MFO: true,
} satisfies Record<ConstraintType, true>;
const SPLIT_SOURCES = { leveling: true, user: true } satisfies Record<NonNullable<TaskSplitGap['source']>, true>;

const CONSTRAINT = objectOf({
  type: required(enumOfTable(CONSTRAINT_TYPES)), date: optional(LOCAL_MOMENT_OR_EMPTY), hard: optional(BOOLEAN),
} satisfies Record<keyof TaskConstraint, IfcxMember>);
const SECOND_CONSTRAINT = objectOf({
  type: required(enumOfTable(CONSTRAINT_TYPES)), date: optional(LOCAL_MOMENT_OR_EMPTY),
} satisfies Record<Exclude<keyof TaskConstraint, 'hard'>, IfcxMember>);

const SPLIT_GAPS = arrayOf(objectOf({
  afterMinutes: required(REAL), gapMinutes: required(REAL), source: optional(enumOfTable(SPLIT_SOURCES)),
} satisfies Record<keyof TaskSplitGap, IfcxMember>));

const DURATION_WALKS = arrayOf(objectOf({
  anchor: required(TEXT), resourceCalendarId: required(TEXT), workMinutes: optional(REAL),
} satisfies Record<keyof TimephasedDurationWalk, IfcxMember>));

export function taskField<K extends keyof Task>(key: K, value: IfcxValue): TaskField {
  return passthroughField<TaskWriteSource, TaskReadTarget, Task[K]>(
    key, value, source => source.task[key], (target, stored) => { target.task[key] = stored; },
  );
}

export const TASK_SCHEDULE_FIELDS: readonly TaskField[] = [
  taskField('constraint', CONSTRAINT),
  taskField('constraint2', SECOND_CONSTRAINT),
  taskField('deadline', LOCAL_MOMENT_OR_EMPTY),
  taskField('isHammock', BOOLEAN),
  taskField('workRule', enumOf(WORK_RULES)),
  taskField('levelingDelay', integer()),
  taskField('levelingDelayMinutes', integer()),
  taskField('levelingDelayElapsed', BOOLEAN),
  taskField('splitGaps', SPLIT_GAPS),
  taskField('timephasedFinishFloor', TEXT),
  taskField('timephasedStartAnchor', TEXT),
  taskField('timephasedDurationWalks', DURATION_WALKS),
];

export const TASK_SCHEDULE_KEYS_CARRIED = TASK_SCHEDULE_FIELDS.map(field => field.key as keyof Task);
