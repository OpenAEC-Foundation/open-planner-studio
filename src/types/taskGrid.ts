import type { Baseline } from '@/types/baseline';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { TaskRelationIndex } from '@/engine/taskGrid/relationIndex';

export type TaskGridSurfaceId = 'gantt-task-grid' | 'full-task-grid';
export type TaskColumnId = string & { readonly __taskColumnId: unique symbol };

export type GridResult<T, E> =
  | { ok: true; value: T }
  | { ok: false; errors: E };

export interface TaskGridColumnPreference {
  id: TaskColumnId;
  width: number;
  pinned: boolean;
}

export interface TaskGridSurfacePreferences {
  columns: TaskGridColumnPreference[];
  scrollX: number;
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
  columnId?: TaskColumnId;
  value?: unknown;
}

export interface CellEditIntent {
  kind: 'cell-edit';
  taskId: string;
  columnId: TaskColumnId;
  value: unknown;
}

export interface PasteIntent {
  kind: 'paste';
  edits: readonly CellEditIntent[];
}

export interface RelationSetIntent {
  kind: 'relation-set';
  taskId: string;
  direction: 'predecessor' | 'successor';
  value: unknown;
}

export interface AssignmentSetIntent {
  kind: 'assignment-set';
  taskId: string;
  value: unknown;
}

export type GridIntent = CellEditIntent | PasteIntent | RelationSetIntent | AssignmentSetIntent;

export interface TaskColumnContext {
  projectId: string;
  tasksById: ReadonlyMap<string, Task>;
  relationIndex: TaskRelationIndex;
  assignmentsByTaskId: ReadonlyMap<string, readonly ResourceAssignment[]>;
  resourcesById: ReadonlyMap<string, Resource>;
  baselinesById: ReadonlyMap<string, Baseline>;
  scheduleStale: boolean;
  /** Projectinstellingen die alleen de descriptorbewerkbaarheid/-parser sturen. */
  wbsAutoNumber?: boolean;
  effectiveHoursPerDay?: (task: Task) => number;
  /** De adapter levert hier de echte projectkalenderberekening voor baselineafwijkingen. */
  signedWorkDaysBetween?: (fromIso: string, toIso: string) => number;
}

export interface TaskColumnDescriptor {
  id: TaskColumnId;
  labelKey: string;
  category: TaskColumnCategory;
  valueKind: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'duration' | 'enum' | 'tokens' | 'technical';
  editorKind: 'text' | 'number' | 'percentage' | 'date' | 'datetime' | 'duration' | 'boolean' | 'enum' | 'color' | 'autocomplete' | 'relations' | 'custom' | 'none';
  defaultWidth: number;
  available(ctx: TaskColumnContext): boolean;
  readOnly: boolean | ((task: Task, ctx: TaskColumnContext) => boolean);
  read(task: Task, ctx: TaskColumnContext): unknown;
  format(value: unknown, task: Task, ctx: TaskColumnContext): string;
  copy(task: Task, ctx: TaskColumnContext): string;
  parse?: (text: string, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  validate?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  planWrite?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<readonly GridIntent[], readonly CellValidationError[]>;
  autoFitText(task: Task, ctx: TaskColumnContext): string;
}
