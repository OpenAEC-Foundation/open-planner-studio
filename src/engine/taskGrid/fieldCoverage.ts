import type { BaselineTask } from '@/types/baseline';
import type { ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type {
  ExternalLink,
  ExternalSourceRef,
  Task,
  TaskConstraint,
  TaskNote,
  TaskSplitGap,
  TaskTime,
  TaskTimephasedContour,
  TimephasedContourPeriod,
  TimephasedDurationWalk,
} from '@/types/task';
import type { TaskColumnDescriptor, TaskColumnId } from '@/types/taskGrid';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';

export type FieldCoverageKind = 'direct' | 'composite' | 'derived' | 'technical';
export type DynamicColumnFamily = 'activity-code' | 'custom-field' | 'baseline';

export interface FieldCoverage {
  kind: FieldCoverageKind;
  columnIds: readonly TaskColumnId[];
  dynamicFamily?: DynamicColumnFamily;
}

const ids = (...values: string[]): readonly TaskColumnId[] => values.map(taskColumnId);
const field = (kind: FieldCoverageKind, ...values: string[]): FieldCoverage => ({ kind, columnIds: ids(...values) });
const dynamic = (kind: FieldCoverageKind, dynamicFamily: DynamicColumnFamily): FieldCoverage => ({
  kind, columnIds: [], dynamicFamily,
});
const dynamicWith = (
  kind: FieldCoverageKind,
  dynamicFamily: DynamicColumnFamily,
  ...values: string[]
): FieldCoverage => ({ kind, columnIds: ids(...values), dynamicFamily });

const TASK_TIME_COLUMNS = [
  'task.time.durationType', 'task.time.durationUnit', 'task.time.scheduleDuration', 'task.time.durationMinutes',
  'task.time.scheduleStart', 'task.time.scheduleFinish', 'task.time.resume', 'task.time.stop',
  'task.time.earlyStart', 'task.time.earlyFinish', 'task.time.lateStart', 'task.time.lateFinish',
  'task.time.freeFloat', 'task.time.totalFloat', 'task.time.isCritical',
  'task.time.interferingFloat', 'task.time.isNearCritical', 'task.time.floatPath',
  'task.time.actualStart', 'task.time.actualFinish', 'task.time.actualDuration',
  'task.time.remainingTime', 'task.time.remainingMinutes', 'task.time.completion',
] as const;

export const TASK_FIELD_COVERAGE = {
  id: field('technical', 'task.id'),
  name: field('direct', 'task.name'),
  description: field('direct', 'task.description'),
  wbsCode: field('direct', 'task.wbsCode'),
  taskType: field('direct', 'task.taskType'),
  customTaskTypeId: field('direct', 'task.customTaskTypeId'),
  status: field('direct', 'task.status'),
  isMilestone: field('direct', 'task.isMilestone'),
  milestoneKind: field('direct', 'task.milestoneKind'),
  mandatory: field('direct', 'task.mandatory'),
  priority: field('direct', 'task.priority'),
  levelingDelay: field('derived', 'task.levelingDelay'),
  levelingDelayMinutes: field('technical', 'task.levelingDelayMinutes'),
  levelingDelayElapsed: field('technical', 'task.levelingDelayElapsed'),
  splitGaps: field('composite', 'task.splitGaps'),
  timephasedFinishFloor: field('technical', 'task.timephasedFinishFloor'),
  timephasedStartAnchor: field('technical', 'task.timephasedStartAnchor'),
  timephasedDurationWalks: field('technical', 'task.timephasedDurationWalks'),
  timephasedContours: field('technical', 'task.timephasedContours'),
  manuallyScheduled: field('technical', 'task.manuallyScheduled'),
  mspTaskType: field('technical', 'task.mspTaskType'),
  effortDriven: field('technical', 'task.effortDriven'),
  workRule: field('technical', 'task.workRule'),
  parentId: field('technical', 'task.parentId'),
  childIds: field('technical', 'task.childIds'),
  time: field('composite', ...TASK_TIME_COLUMNS),
  resourceIds: field('technical', 'task.resourceIds'),
  color: field('direct', 'task.color'),
  activityCodes: dynamicWith('direct', 'activity-code', 'task.activityCodes.technical'),
  customFields: dynamicWith('direct', 'custom-field', 'task.customFields.technical'),
  constraint: field('composite', 'task.constraint.type', 'task.constraint.date', 'task.constraint.hard'),
  constraint2: field('composite', 'task.constraint2.type', 'task.constraint2.date'),
  isHammock: field('direct', 'task.isHammock'),
  externalLinks: field('composite', 'relation.predecessors', 'relation.successors', 'relation.externalTechnical'),
  deadline: field('direct', 'task.deadline'),
  calendarId: field('direct', 'task.calendarId'),
  notes: field('composite', 'task.notes', 'task.notes.technical'),
} satisfies Record<keyof Task, FieldCoverage>;

export const TASK_TIME_FIELD_COVERAGE = {
  durationType: field('direct', 'task.time.durationType'),
  durationUnit: field('direct', 'task.time.durationUnit'),
  scheduleDuration: field('direct', 'task.time.scheduleDuration'),
  durationMinutes: field('technical', 'task.time.durationMinutes'),
  scheduleStart: field('direct', 'task.time.scheduleStart'),
  scheduleFinish: field('direct', 'task.time.scheduleFinish'),
  resume: field('direct', 'task.time.resume'),
  stop: field('direct', 'task.time.stop'),
  earlyStart: field('derived', 'task.time.earlyStart'),
  earlyFinish: field('derived', 'task.time.earlyFinish'),
  lateStart: field('derived', 'task.time.lateStart'),
  lateFinish: field('derived', 'task.time.lateFinish'),
  freeFloat: field('derived', 'task.time.freeFloat'),
  totalFloat: field('derived', 'task.time.totalFloat'),
  isCritical: field('derived', 'task.time.isCritical'),
  interferingFloat: field('derived', 'task.time.interferingFloat'),
  isNearCritical: field('derived', 'task.time.isNearCritical'),
  floatPath: field('derived', 'task.time.floatPath'),
  actualStart: field('direct', 'task.time.actualStart'),
  actualFinish: field('direct', 'task.time.actualFinish'),
  actualDuration: field('direct', 'task.time.actualDuration'),
  remainingTime: field('direct', 'task.time.remainingTime'),
  remainingMinutes: field('technical', 'task.time.remainingMinutes'),
  completion: field('direct', 'task.time.completion'),
} satisfies Record<keyof TaskTime, FieldCoverage>;

export const CONSTRAINT_FIELD_COVERAGE = {
  type: field('direct', 'task.constraint.type', 'task.constraint2.type'),
  date: field('direct', 'task.constraint.date', 'task.constraint2.date'),
  hard: field('direct', 'task.constraint.hard'),
} satisfies Record<keyof TaskConstraint, FieldCoverage>;

export const SEQUENCE_FIELD_COVERAGE = {
  id: field('technical', 'relation.internalTechnical'),
  predecessorId: field('composite', 'relation.predecessors', 'relation.successors'),
  successorId: field('composite', 'relation.predecessors', 'relation.successors'),
  type: field('composite', 'relation.predecessors', 'relation.successors'),
  lagDays: field('composite', 'relation.predecessors', 'relation.successors'),
  lagMinutes: field('composite', 'relation.predecessors', 'relation.successors'),
  lagUnit: field('composite', 'relation.predecessors', 'relation.successors'),
  lagPercent: field('composite', 'relation.predecessors', 'relation.successors'),
} satisfies Record<keyof Sequence, FieldCoverage>;

export const EXTERNAL_LINK_FIELD_COVERAGE = {
  id: field('technical', 'relation.externalTechnical'),
  direction: field('composite', 'relation.predecessors', 'relation.successors'),
  relType: field('composite', 'relation.predecessors', 'relation.successors'),
  lagDays: field('composite', 'relation.predecessors', 'relation.successors'),
  lagMinutes: field('composite', 'relation.predecessors', 'relation.successors'),
  anchorDate: field('technical', 'relation.externalTechnical'),
  sourceRef: field('technical', 'relation.externalTechnical'),
  sourceMissing: field('technical', 'relation.externalTechnical'),
} satisfies Record<keyof ExternalLink, FieldCoverage>;

export const ASSIGNMENT_FIELD_COVERAGE = {
  id: field('technical', 'assignment.id'),
  taskId: field('technical', 'assignment.taskId'),
  resourceId: field('composite', 'assignment.resources', 'assignment.resourceId'),
  unitsPerDay: field('direct', 'assignment.unitsPerDay'),
  curve: field('direct', 'assignment.curve'),
  workWindowStart: field('technical', 'assignment.workWindowStart'),
  workWindowFinish: field('technical', 'assignment.workWindowFinish'),
  curveValues: field('technical', 'assignment.curve'),
  // taaktypes-etappe (spec §4.3): alleen-lezen technische kolommen tot de bedradingsstap ze bewerkbaar maakt
  plannedWorkMinutes: field('technical', 'assignment.plannedWork'),
  actualWorkMinutes: field('technical', 'assignment.actualWork'),
  remainingWorkMinutes: field('technical', 'assignment.remainingWork'),
} satisfies Record<keyof ResourceAssignment, FieldCoverage>;

export const BASELINE_TASK_FIELD_COVERAGE = {
  taskId: field('technical', 'task.id'),
  start: dynamic('direct', 'baseline'),
  finish: dynamic('direct', 'baseline'),
  duration: dynamic('direct', 'baseline'),
  isMilestone: dynamic('technical', 'baseline'),
  milestoneKind: dynamic('technical', 'baseline'),
} satisfies Record<keyof BaselineTask, FieldCoverage>;

export const SPLIT_GAP_FIELD_COVERAGE = {
  afterMinutes: field('composite', 'task.splitGaps'),
  gapMinutes: field('composite', 'task.splitGaps'),
  source: field('technical', 'task.splitGaps'),
} satisfies Record<keyof TaskSplitGap, FieldCoverage>;

export const CONTOUR_FIELD_COVERAGE = {
  resourceUid: field('technical', 'task.timephasedContours'),
  resourceId: field('technical', 'task.timephasedContours'),
  periods: field('technical', 'task.timephasedContours'),
} satisfies Record<keyof TaskTimephasedContour, FieldCoverage>;

export const CONTOUR_PERIOD_FIELD_COVERAGE = {
  afterMinutes: field('technical', 'task.timephasedContours'),
  minutes: field('technical', 'task.timephasedContours'),
  workMinutes: field('technical', 'task.timephasedContours'),
  kind: field('technical', 'task.timephasedContours'),
} satisfies Record<keyof TimephasedContourPeriod, FieldCoverage>;

export const NOTE_FIELD_COVERAGE = {
  id: field('technical', 'task.notes.technical'),
  text: field('composite', 'task.notes', 'task.notes.technical'),
  done: field('composite', 'task.notes', 'task.notes.technical'),
} satisfies Record<keyof TaskNote, FieldCoverage>;

export const DURATION_WALK_FIELD_COVERAGE = {
  anchor: field('technical', 'task.timephasedDurationWalks'),
  resourceCalendarId: field('technical', 'task.timephasedDurationWalks'),
  workMinutes: field('technical', 'task.timephasedDurationWalks'),
} satisfies Record<keyof TimephasedDurationWalk, FieldCoverage>;

export const EXTERNAL_SOURCE_FIELD_COVERAGE = {
  projectId: field('technical', 'relation.externalTechnical'),
  projectName: field('technical', 'relation.externalTechnical'),
  taskId: field('technical', 'relation.externalTechnical'),
  taskName: field('technical', 'relation.externalTechnical'),
  filePath: field('technical', 'relation.externalTechnical'),
} satisfies Record<keyof ExternalSourceRef, FieldCoverage>;

export interface NamedFieldCoverage {
  typeName: string;
  fields: Record<string, FieldCoverage>;
}

export const ALL_TASK_FIELD_COVERAGE: readonly NamedFieldCoverage[] = [
  { typeName: 'Task', fields: TASK_FIELD_COVERAGE },
  { typeName: 'TaskTime', fields: TASK_TIME_FIELD_COVERAGE },
  { typeName: 'TaskConstraint', fields: CONSTRAINT_FIELD_COVERAGE },
  { typeName: 'Sequence', fields: SEQUENCE_FIELD_COVERAGE },
  { typeName: 'ExternalLink', fields: EXTERNAL_LINK_FIELD_COVERAGE },
  { typeName: 'ResourceAssignment', fields: ASSIGNMENT_FIELD_COVERAGE },
  { typeName: 'BaselineTask', fields: BASELINE_TASK_FIELD_COVERAGE },
  { typeName: 'TaskSplitGap', fields: SPLIT_GAP_FIELD_COVERAGE },
  { typeName: 'TaskTimephasedContour', fields: CONTOUR_FIELD_COVERAGE },
  { typeName: 'TimephasedContourPeriod', fields: CONTOUR_PERIOD_FIELD_COVERAGE },
  { typeName: 'TaskNote', fields: NOTE_FIELD_COVERAGE },
  { typeName: 'TimephasedDurationWalk', fields: DURATION_WALK_FIELD_COVERAGE },
  { typeName: 'ExternalSourceRef', fields: EXTERNAL_SOURCE_FIELD_COVERAGE },
];

export const coverageColumnFamilies = new Set<DynamicColumnFamily>([
  'activity-code', 'custom-field', 'baseline',
]);

export function validateCoverageAgainstRegistry(
  registry: readonly TaskColumnDescriptor[],
): { missing: TaskColumnId[] } {
  const registryIds = new Set(registry.map(column => column.id));
  const missing = new Set<TaskColumnId>();
  for (const table of ALL_TASK_FIELD_COVERAGE) {
    for (const coverage of Object.values(table.fields)) {
      for (const id of coverage.columnIds) {
        if (!registryIds.has(id)) missing.add(id);
      }
    }
  }
  return { missing: [...missing] };
}
