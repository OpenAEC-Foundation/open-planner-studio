import type { Baseline, BaselineTask } from '@/types/baseline';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { WorkRule } from '@/types/workRule';
import type { DurationDisplay, TimeNotation } from '@/types/view';
import type { TaskRelationIndex } from '@/engine/taskGrid/relationIndex';

export type TaskGridSurfaceId = 'gantt-task-grid' | 'full-task-grid';
export type TaskColumnId = string & { readonly __taskColumnId: unique symbol };

export type RecordedTaskAxis = 'ls' | 'lf' | 'tf' | 'ff';
export type RecordedTaskMark = 'partly-unrecorded' | undefined;

export type GridResult<T, E> =
  | { ok: true; value: T }
  | { ok: false; errors: E };

export interface TaskGridColumnPreference {
  id: TaskColumnId;
  width: number;
  pinned: boolean;
  manualWidth?: boolean;
}

export interface TaskGridSurfacePreferences {
  columns: TaskGridColumnPreference[];
  scrollX: number;
}

export interface PersistedTaskGridPreferencesV1 {
  version: 1;
  surfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
  recent: TaskColumnId[];
}

export type TaskColumnCategory =
  | 'task'
  | 'planning'
  | 'constraints'
  | 'relations'
  | 'resources'
  | 'progress'
  | 'computed'
  | 'baseline'
  | 'custom'
  | 'technical';

export interface CellValidationError {
  code: string;
  messageKey: string;
  taskId?: string;
  rowKey?: string;
  columnId?: TaskColumnId;
  tokenIndex?: number;
  start?: number;
  end?: number;
  cycle?: readonly string[];
  value?: unknown;
}

export interface CellEditIntent {
  kind: 'cell-edit';
  taskId: string;
  columnId: TaskColumnId;
  route: CellEditRoute;
  value: unknown;
}

export type CellEditRoute =
  | 'task-field'
  | 'task-schedule'
  | 'task-progress'
  | 'task-milestone'
  | 'task-constraint'
  | 'task-hammock'
  | 'activity-code'
  | 'custom-field';

export interface RelationSetIntent {
  kind: 'relation-set';
  taskId: string;
  direction: 'predecessor' | 'successor';
  value: unknown;
}

export interface AssignmentSetIntent {
  kind: 'assignment-set';
  taskId: string;
  columnId: TaskColumnId;
  tokens: readonly TaskAssignmentToken[];
}

export interface TaskAssignmentToken {
  resourceId: string;
  assignmentId?: string;
  unitsPerDay: number;
  curve?: ResourceCurve;
  remainingWorkMinutes?: number;
  costAmount?: number;
  resourceKind?: TaskAssignmentResourceKind;
}

export type TaskAssignmentResourceKind = 'cost' | 'work';

export type GridWriteIntent = CellEditIntent | RelationSetIntent | AssignmentSetIntent;

export interface PasteIntent {
  kind: 'paste';
  writes: readonly GridWriteIntent[];
  allowSkippingReadOnlyCells?: boolean;
  skippedReadOnlyCount?: number;
  skippedReadOnlyTaskIds?: string[];
}

export type GridIntent = GridWriteIntent | PasteIntent;

export interface TaskColumnContext {
  projectId: string;
  tasksById: ReadonlyMap<string, Task>;
  relationIndex: TaskRelationIndex;
  assignmentsByTaskId: ReadonlyMap<string, readonly ResourceAssignment[]>;
  resourcesById: ReadonlyMap<string, Resource>;
  baselinesById: ReadonlyMap<string, Baseline>;
  scheduleStale: boolean;
  labelForText?: (key: string, values?: Readonly<Record<string, string | number>>) => string;
  textDirection?: 'ltr' | 'rtl';
  wbsAutoNumber?: boolean;
  effectiveHoursPerDay?: (task: Task) => number;
  effectiveCalendar?: (task: Task) => WorkCalendar;
  durationDisplay?: DurationDisplay;
  workdayDurationMeasure?: boolean;
  numberLocale?: string;
  signedWorkDaysBetween?: (fromIso: string, toIso: string) => number;
  baselineOldDay?: (task: Task, baselineTask: BaselineTask) => boolean;
  recordedMark?: (task: Task) => RecordedTaskMark;
  recordedUnrecordedAxes?: (task: Task) => readonly RecordedTaskAxis[];
  taskTypesUnlocked?: boolean;
  defaultWorkRule?: WorkRule;
  timeNotation?: TimeNotation;
}

export type TaskColumnLabelSource =
  | { labelKey: string; labelText?: undefined }
  | { labelText: string; labelKey?: string };

export type TaskColumnDescriptor = TaskColumnDescriptorFields & TaskColumnLabelSource;

export interface TaskCellWarning {
  kind: 'baseline-old-day' | 'remaining-work-deviates';
  text: string;
}

interface TaskColumnDescriptorFields {
  id: TaskColumnId;
  category: TaskColumnCategory;
  valueKind: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'duration' | 'enum' | 'tokens' | 'technical';
  editorKind: 'text' | 'number' | 'percentage' | 'date' | 'datetime' | 'duration' | 'boolean' | 'enum' | 'color' | 'autocomplete' | 'relations' | 'custom' | 'none';
  editorOptions?: readonly { value: string; labelKey?: string; label?: string }[];
  defaultWidth: number;
  scheduleDerived?: boolean;
  available(ctx: TaskColumnContext): boolean;
  readOnly: boolean | ((task: Task, ctx: TaskColumnContext) => boolean);
  readOnlyReason?: (task: Task, ctx: TaskColumnContext) => string | undefined;
  read(task: Task, ctx: TaskColumnContext): unknown;
  format(value: unknown, task: Task, ctx: TaskColumnContext): string;
  copy(task: Task, ctx: TaskColumnContext): string;
  editText?: (task: Task, ctx: TaskColumnContext) => string;
  tooltip?: (value: unknown, task: Task, ctx: TaskColumnContext) => string | null;
  warning?: (value: unknown, task: Task, ctx: TaskColumnContext) => TaskCellWarning | null;
  parse?: (text: string, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  validate?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  planWrite?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<readonly GridWriteIntent[], readonly CellValidationError[]>;
  planWriteUnchecked?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<readonly GridWriteIntent[], readonly CellValidationError[]>;
  autoFitText(task: Task, ctx: TaskColumnContext): string;
}
