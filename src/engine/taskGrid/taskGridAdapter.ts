import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { copyGridEditorValue, parseGridEditorText, type TaskGridBooleanLabels } from '@/engine/taskGrid/editors';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Baseline } from '@/types/baseline';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Task } from '@/types/task';
import type { DateNotation } from '@/types/view';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { classifyTraceTask, taskGridTraceClass, type TaskTrace } from '@/engine/taskGrid/trace';
import type {
  CellValidationError,
  GridIntent,
  GridResult,
  TaskColumnCategory,
  TaskColumnContext,
  TaskColumnDescriptor,
  TaskColumnId,
  TaskGridSurfaceId,
} from '@/types/taskGrid';

export interface TaskGridAdapterColumn {
  id: TaskColumnId;
  label: string;
  category: TaskColumnCategory;
  defaultWidth: number;
  align?: 'start' | 'center' | 'end';
}

export type TaskGridAdapterRow =
  | {
      kind: 'data';
      rowKey: string;
      depth: number;
      dimmed?: boolean;
      selected?: boolean;
      traceClass?: string | null;
    }
  | { kind: 'group'; rowKey: string; label: string; count: number; depth: number; collapsed: boolean };

export interface TaskGridTaskRowMeta {
  rowKey: string;
  taskId: string;
  kind: 'task';
  depth: number;
  dimmed: boolean;
  selected: boolean;
  traceClass: string | null;
  /** De UI rendert hiermee de bestaande TaskTooltipContent; de adapter formatteert geen tweede tooltip. */
  tooltipData: { task: Task };
}

export interface TaskGridGroupRowMeta {
  rowKey: string;
  kind: 'group';
  depth: number;
  selected: false;
  traceClass: null;
}

export type TaskGridRowMeta = TaskGridTaskRowMeta | TaskGridGroupRowMeta;

export interface TaskGridAdapterCell {
  text: string;
  value: unknown;
  copyText: string;
  editText: string;
  readOnly: boolean;
  stale?: boolean;
  statusText?: string;
  title?: string;
}

export interface TaskGridAdapterEventTarget {
  surfaceId: TaskGridSurfaceId;
  rowKey: string;
  taskId?: string;
  columnId?: TaskColumnId;
}

export interface TaskGridAdapterCallbacks {
  onSelection?: (target: TaskGridAdapterEventTarget) => void;
  onCollapse?: (rowKey: string, collapsed: boolean) => void;
  onPrepareEdit?: (target: TaskGridAdapterEventTarget) => boolean;
  onCommitEdit?: (
    target: TaskGridAdapterEventTarget,
    intents: readonly GridIntent[],
  ) => GridResult<void, readonly CellValidationError[]>;
  onContextMenu?: (target: TaskGridAdapterEventTarget) => void;
  onHover?: (target: TaskGridAdapterEventTarget | null) => void;
}

export interface CreateTaskGridAdapterDomainInput {
  projectId: string;
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  cpmResult?: CPMResult | null;
  assignments: readonly ResourceAssignment[];
  resources: readonly Resource[];
  baselines: readonly Baseline[];
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
  scheduleStale: boolean;
  wbsAutoNumber: boolean;
  labelForColumn: (labelKey: string) => string;
  labelForBoolean?: (value: boolean) => string;
  labelForText?: (key: string, values?: Readonly<Record<string, string | number>>) => string;
  textDirection?: 'ltr' | 'rtl';
  effectiveHoursPerDay?: (task: Task) => number;
  signedWorkDaysBetween?: (fromIso: string, toIso: string) => number;
  dateNotation?: DateNotation;
  calendarOptions?: readonly { value: string; label: string }[];
}

export interface CreateTaskGridAdapterProjectionInput {
  surfaceId: TaskGridSurfaceId;
  rows: readonly ViewRow[];
  selectedTaskIds: readonly string[] | ReadonlySet<string>;
  trace?: TaskTrace;
  callbacks?: TaskGridAdapterCallbacks;
}

export type CreateTaskGridAdapterInput = CreateTaskGridAdapterDomainInput
  & CreateTaskGridAdapterProjectionInput;

/**
 * De selectie-onafhankelijke readmodel-laag van het taakraster. Een surface mag deze één keer
 * memoizen op domeinwijzigingen en daarna goedkoop verschillende rijselecties projecteren.
 */
export interface TaskGridAdapterDomain {
  context: TaskColumnContext;
  descriptors: readonly TaskColumnDescriptor[];
  descriptorsById: ReadonlyMap<TaskColumnId, TaskColumnDescriptor>;
  availableColumns: readonly TaskGridAdapterColumn[];
  dateNotation?: DateNotation;
  booleanLabels?: TaskGridBooleanLabels;
  labelForBoolean?: (value: boolean) => string;
  labelForText?: (key: string, values?: Readonly<Record<string, string | number>>) => string;
}

export interface TaskGridAdapter {
  surfaceId: TaskGridSurfaceId;
  rows: readonly TaskGridAdapterRow[];
  availableColumns: readonly TaskGridAdapterColumn[];
  rowMetaByKey: ReadonlyMap<string, TaskGridRowMeta>;
  descriptorsById: ReadonlyMap<TaskColumnId, TaskColumnDescriptor>;
  context: TaskColumnContext;
  dateNotation?: DateNotation;
  booleanLabels?: TaskGridBooleanLabels;
  callbacks: TaskGridAdapterCallbacks;
  getCell: (rowKey: string, columnId: TaskColumnId) => TaskGridAdapterCell | null;
  copyCell: (rowKey: string, columnId: TaskColumnId) => string | null;
  planEdit: (
    rowKey: string,
    columnId: TaskColumnId,
    text: string,
  ) => GridResult<readonly GridIntent[], readonly CellValidationError[]>;
  planValue: (
    rowKey: string,
    columnId: TaskColumnId,
    value: unknown,
  ) => GridResult<readonly GridIntent[], readonly CellValidationError[]>;
}

function failure(
  code: string,
  rowKey: string,
  columnId: TaskColumnId,
  taskId?: string,
  value?: unknown,
): GridResult<never, readonly CellValidationError[]> {
  return {
    ok: false,
    errors: [{
      code,
      messageKey: `taskGrid.validation.${code}`,
      rowKey,
      columnId,
      taskId,
      value,
    }],
  };
}

function withLocation(
  errors: readonly CellValidationError[],
  rowKey: string,
  columnId: TaskColumnId,
  taskId: string,
  value: unknown,
): readonly CellValidationError[] {
  return errors.map(error => ({
    ...error,
    rowKey,
    columnId,
    taskId,
    value: error.value ?? value,
  }));
}

function alignForDescriptor(descriptor: TaskColumnDescriptor): TaskGridAdapterColumn['align'] {
  if (descriptor.valueKind === 'number' || descriptor.valueKind === 'duration') return 'end';
  if (descriptor.valueKind === 'boolean') return 'center';
  return undefined;
}

function buildAssignmentsByTaskId(
  assignments: readonly ResourceAssignment[],
): ReadonlyMap<string, readonly ResourceAssignment[]> {
  const result = new Map<string, ResourceAssignment[]>();
  for (const assignment of assignments) {
    const current = result.get(assignment.taskId);
    if (current) current.push(assignment);
    else result.set(assignment.taskId, [assignment]);
  }
  return result;
}

/** Bouwt uitsluitend het dure, selectie-onafhankelijke domeindeel van de gridadapter. */
export function createTaskGridAdapterDomain(
  input: CreateTaskGridAdapterDomainInput,
): TaskGridAdapterDomain {
  const context: TaskColumnContext = {
    projectId: input.projectId,
    tasksById: new Map(input.tasks.map(task => [task.id, task] as const)),
    relationIndex: buildTaskRelationIndex(input.tasks, input.sequences, input.cpmResult),
    assignmentsByTaskId: buildAssignmentsByTaskId(input.assignments),
    resourcesById: new Map(input.resources.map(resource => [resource.id, resource] as const)),
    baselinesById: new Map(input.baselines.map(baseline => [baseline.id, baseline] as const)),
    scheduleStale: input.scheduleStale,
    labelForText: input.labelForText,
    textDirection: input.textDirection,
    wbsAutoNumber: input.wbsAutoNumber,
    effectiveHoursPerDay: input.effectiveHoursPerDay,
    signedWorkDaysBetween: input.signedWorkDaysBetween,
  };
  const descriptors = buildTaskColumnRegistry({
    projectId: input.projectId,
    activityCodeTypes: input.activityCodeTypes,
    customFieldDefs: input.customFieldDefs,
    baselines: input.baselines,
  }).filter(descriptor => descriptor.available(context)).map(descriptor => (
    descriptor.valueKind === 'tokens' && String(descriptor.id).startsWith('assignment.')
      ? {
          ...descriptor,
          editorOptions: input.resources.map(resource => ({ value: resource.id, label: resource.name })),
        }
      : descriptor.id === 'task.calendarId' && input.calendarOptions
      ? {
          ...descriptor,
          editorOptions: input.calendarOptions.map(option => ({ ...option })),
        }
      : descriptor
  ));
  const descriptorsById = new Map(descriptors.map(descriptor => [descriptor.id, descriptor] as const));
  const availableColumns = descriptors.map<TaskGridAdapterColumn>(descriptor => ({
    id: descriptor.id,
    label: input.labelForColumn(descriptor.labelKey),
    category: descriptor.category,
    defaultWidth: descriptor.defaultWidth,
    align: alignForDescriptor(descriptor),
  }));
  return {
    context,
    descriptors,
    descriptorsById,
    availableColumns,
    dateNotation: input.dateNotation,
    booleanLabels: input.labelForBoolean
      ? { true: input.labelForBoolean(true), false: input.labelForBoolean(false) }
      : undefined,
    labelForBoolean: input.labelForBoolean,
    labelForText: input.labelForText,
  };
}

/**
 * Pure domein-naar-gridprojectie. Beide taakoppervlakken krijgen dezelfde input en kunnen daardoor
 * niet verschillen in rijwaarden, bewerkbaarheid of de intents die een bewerking oplevert.
 *
 * De tweeargumentenvorm gebruikt een vooraf gebouwd domein en is de productroute voor snelle
 * selectiewissels. De eenargumentvorm blijft een handige atomaire fabriek voor losse consumers.
 */
export function createTaskGridAdapter(input: CreateTaskGridAdapterInput): TaskGridAdapter;
export function createTaskGridAdapter(
  input: CreateTaskGridAdapterProjectionInput,
  domain: TaskGridAdapterDomain,
): TaskGridAdapter;
export function createTaskGridAdapter(
  input: CreateTaskGridAdapterInput | CreateTaskGridAdapterProjectionInput,
  providedDomain?: TaskGridAdapterDomain,
): TaskGridAdapter {
  const projection = input as CreateTaskGridAdapterProjectionInput;
  const domain = providedDomain ?? createTaskGridAdapterDomain(input as CreateTaskGridAdapterInput);
  const { context, descriptorsById, availableColumns } = domain;
  const selectedTaskIds = projection.selectedTaskIds instanceof Set
    ? projection.selectedTaskIds
    : new Set(projection.selectedTaskIds);
  const rowMetaByKey = new Map<string, TaskGridRowMeta>();
  const rows = projection.rows.map<TaskGridAdapterRow>(row => {
    if (row.kind === 'group') {
      rowMetaByKey.set(row.rowKey, {
        rowKey: row.rowKey,
        kind: 'group',
        depth: row.depth,
        selected: false,
        traceClass: null,
      });
      return {
        kind: 'group',
        rowKey: row.rowKey,
        label: row.label,
        count: row.count,
        depth: row.depth,
        collapsed: row.collapsed,
      };
    }
    rowMetaByKey.set(row.rowKey, {
      rowKey: row.rowKey,
      taskId: row.task.id,
      kind: 'task',
      depth: row.depth,
      dimmed: row.dimmed,
      selected: selectedTaskIds.has(row.task.id),
      traceClass: taskGridTraceClass(classifyTraceTask(projection.trace, row.task.id)),
      tooltipData: { task: row.task },
    });
    return {
      kind: 'data',
      rowKey: row.rowKey,
      depth: row.depth,
      dimmed: row.dimmed,
      selected: selectedTaskIds.has(row.task.id),
      traceClass: taskGridTraceClass(classifyTraceTask(projection.trace, row.task.id)),
    };
  });

  function resolveTask(
    rowKey: string,
    columnId: TaskColumnId,
    value?: unknown,
  ): GridResult<Task, readonly CellValidationError[]> {
    const meta = rowMetaByKey.get(rowKey);
    if (!meta || meta.kind !== 'task') return failure('rowNotFound', rowKey, columnId, undefined, value);
    const task = context.tasksById.get(meta.taskId);
    return task
      ? { ok: true, value: task }
      : failure('taskNotFound', rowKey, columnId, meta.taskId, value);
  }

  function getCell(rowKey: string, columnId: TaskColumnId): TaskGridAdapterCell | null {
    const taskResult = resolveTask(rowKey, columnId);
    if (!taskResult.ok) return null;
    const descriptor = descriptorsById.get(columnId);
    if (!descriptor) return null;
    const task = taskResult.value;
    const value = descriptor.read(task, context);
    const readOnly = typeof descriptor.readOnly === 'function'
      ? descriptor.readOnly(task, context)
      : descriptor.readOnly;
    const stale = context.scheduleStale
      && (descriptor.category === 'computed' || descriptor.scheduleDerived === true);
    const enumOption = descriptor.valueKind === 'enum'
      ? descriptor.editorOptions?.find(option => option.value === value)
      : undefined;
    const enumLabelKey = enumOption && 'labelKey' in enumOption ? enumOption.labelKey : undefined;
    const translatedEnum = enumOption?.label
      ?? (enumLabelKey && domain.labelForText ? domain.labelForText(enumLabelKey) : undefined);
    const text = typeof value === 'boolean' && domain.labelForBoolean
      ? domain.labelForBoolean(value)
      : translatedEnum ?? (domain.dateNotation
        && (descriptor.valueKind === 'date' || descriptor.valueKind === 'datetime')
        && typeof value === 'string'
        ? copyGridEditorValue(descriptor, task, context, domain.dateNotation)
        : descriptor.format(value, task, context));
    const title = descriptor.tooltip?.(value, task, context)
      ?? ((descriptor.valueKind === 'date' || descriptor.valueKind === 'datetime') && typeof value === 'string'
        ? value
        : descriptor.valueKind === 'technical' ? descriptor.copy(task, context) : text);
    const booleanLabels = domain.booleanLabels;
    const copyText = domain.dateNotation
      ? copyGridEditorValue(descriptor, task, context, domain.dateNotation, booleanLabels)
      : typeof value === 'boolean' && booleanLabels
        ? booleanLabels[value ? 'true' : 'false']
        : descriptor.copy(task, context);
    return {
      text,
      value,
      copyText,
      editText: descriptor.editText?.(task, context)
        ?? (descriptor.editorKind === 'boolean'
          ? value === true ? 'true' : value === false ? 'false' : ''
          : domain.dateNotation
            ? copyGridEditorValue(descriptor, task, context, domain.dateNotation, booleanLabels)
            : descriptor.copy(task, context)),
      readOnly,
      stale: stale || undefined,
      statusText: stale ? 'taskGrid.status.stale' : undefined,
      title: title && title !== '—' ? title : undefined,
    };
  }

  function copyCell(rowKey: string, columnId: TaskColumnId): string | null {
    return getCell(rowKey, columnId)?.copyText ?? null;
  }

  function planEdit(
    rowKey: string,
    columnId: TaskColumnId,
    text: string,
  ): GridResult<readonly GridIntent[], readonly CellValidationError[]> {
    const taskResult = resolveTask(rowKey, columnId, text);
    if (!taskResult.ok) return taskResult;
    const task = taskResult.value;
    const descriptor = descriptorsById.get(columnId);
    if (!descriptor) return failure('plannerNotAvailable', rowKey, columnId, task.id, text);
    const readOnly = typeof descriptor.readOnly === 'function'
      ? descriptor.readOnly(task, context)
      : descriptor.readOnly;
    if (readOnly || !descriptor.parse || !descriptor.planWrite) {
      return failure('readOnly', rowKey, columnId, task.id, text);
    }
    const booleanLabels = domain.booleanLabels;
    const parsed = domain.dateNotation || booleanLabels
      ? parseGridEditorText(descriptor, text, task, context, domain.dateNotation ?? 'dmy', booleanLabels)
      : descriptor.parse(text, task, context);
    if (!parsed.ok) {
      return { ok: false, errors: withLocation(parsed.errors, rowKey, columnId, task.id, text) };
    }
    return planValue(rowKey, columnId, parsed.value);
  }

  function planValue(
    rowKey: string,
    columnId: TaskColumnId,
    inputValue: unknown,
  ): GridResult<readonly GridIntent[], readonly CellValidationError[]> {
    const taskResult = resolveTask(rowKey, columnId, inputValue);
    if (!taskResult.ok) return taskResult;
    const task = taskResult.value;
    const descriptor = descriptorsById.get(columnId);
    if (!descriptor) return failure('plannerNotAvailable', rowKey, columnId, task.id, inputValue);
    const readOnly = typeof descriptor.readOnly === 'function'
      ? descriptor.readOnly(task, context)
      : descriptor.readOnly;
    if (readOnly || !descriptor.planWrite) {
      return failure('readOnly', rowKey, columnId, task.id, inputValue);
    }
    let value = inputValue;
    if (descriptor.validate) {
      const validated = descriptor.validate(value, task, context);
      if (!validated.ok) {
        return { ok: false, errors: withLocation(validated.errors, rowKey, columnId, task.id, value) };
      }
      value = validated.value;
    }
    const planned = descriptor.planWrite(value, task, context);
    return planned.ok
      ? { ok: true, value: planned.value }
      : { ok: false, errors: withLocation(planned.errors, rowKey, columnId, task.id, value) };
  }

  return {
    surfaceId: projection.surfaceId,
    rows,
    availableColumns,
    rowMetaByKey,
    descriptorsById,
    context,
    dateNotation: domain.dateNotation,
    booleanLabels: domain.booleanLabels,
    callbacks: projection.callbacks ?? {},
    getCell,
    copyCell,
    planEdit,
    planValue,
  };
}
