import type { Baseline, BaselineTask } from '@/types/baseline';
import type { ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import type { ConstraintType, MilestoneKind, Task, TaskStatus, TaskType } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import type {
  CellValidationError,
  CellEditRoute,
  GridResult,
  GridWriteIntent,
  TaskAssignmentToken,
  TaskColumnCategory,
  TaskColumnContext,
  TaskColumnDescriptor,
  TaskColumnId,
} from '@/types/taskGrid';
import {
  activityCodeColumnId,
  baselineColumnId,
  customFieldColumnId,
  encodeTaskColumnIdSegment,
  taskColumnId,
  type BaselineTaskColumnField,
} from '@/engine/taskGrid/fieldIds';
import { taskRelations, type TaskRelationEntry } from '@/engine/taskGrid/relationIndex';
import {
  buildTaskRelationAnalysisItems,
  buildRelationCellItems,
  parseRelationCellText,
  relationCellClipboardText,
  relationDrivingText,
  relationFreeFloatText,
  relationCellText,
  relationWarningsText,
  type RelationCellItem,
} from '@/engine/taskGrid/relationCell';
import { isParsedRelationTokenArray } from '@/engine/taskGrid/relationPlan';
import { parseDuration as parseDurationMinutes } from '@/utils/durationFormat';
import {
  formatTaskDurationInput,
  parseTaskDurationInput,
  type ParsedTaskDuration,
} from '@/utils/taskDurationInput';

export const TASK_COLUMN_CATEGORY_ORDER: readonly TaskColumnCategory[] = [
  'task', 'planning', 'constraints', 'relations', 'resources',
  'progress', 'computed', 'baseline', 'custom', 'technical',
];

export interface TaskColumnRegistryInput {
  projectId: string;
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
  baselines: readonly Baseline[];
  customTaskTypes?: readonly CustomTaskType[];
}

type ValueKind = TaskColumnDescriptor['valueKind'];
type EditorKind = TaskColumnDescriptor['editorKind'];
type Reader = (task: Task, ctx: TaskColumnContext) => unknown;
type Formatter = (value: unknown, task: Task, ctx: TaskColumnContext) => string;
type Parser = NonNullable<TaskColumnDescriptor['parse']>;
type Validator = NonNullable<TaskColumnDescriptor['validate']>;
type Writer = NonNullable<TaskColumnDescriptor['planWrite']>;

interface ReadonlyColumnConfig {
  id: string | TaskColumnId;
  labelKey: string;
  category: TaskColumnCategory;
  valueKind: ValueKind;
  defaultWidth?: number;
  scheduleDerived?: boolean;
  read: Reader;
  format?: Formatter;
  copy?: (task: Task, ctx: TaskColumnContext) => string;
  available?: (ctx: TaskColumnContext) => boolean;
  tooltip?: (value: unknown, task: Task, ctx: TaskColumnContext) => string | null;
}

interface EditableColumnConfig extends Omit<ReadonlyColumnConfig, 'copy'> {
  editorKind: Exclude<EditorKind, 'none'>;
  editorOptions?: readonly { value: string; labelKey?: string; label?: string }[];
  readOnly?: (task: Task, ctx: TaskColumnContext) => boolean;
  route?: CellEditRoute;
  parse: Parser;
  validate: Validator;
  planWrite?: Writer;
  copy?: (task: Task, ctx: TaskColumnContext) => string;
  editText?: (task: Task, ctx: TaskColumnContext) => string;
}

function success<T>(value: T): GridResult<T, readonly CellValidationError[]> {
  return { ok: true, value };
}

function failure(code: string, value?: unknown): GridResult<never, readonly CellValidationError[]> {
  return { ok: false, errors: [{ code, messageKey: `taskGrid.validation.${code}`, value }] };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

export function canonicalGridJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? '';
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return canonicalGridJson(value);
  return String(value);
}

function copyScalar(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return canonicalGridJson(value);
  return String(value);
}

function readonlyColumn(config: ReadonlyColumnConfig): TaskColumnDescriptor {
  const id = typeof config.id === 'string' ? taskColumnId(config.id) : config.id;
  const format = config.format ?? ((value: unknown) => formatScalar(value));
  const copy = config.copy ?? ((task: Task, ctx: TaskColumnContext) => copyScalar(config.read(task, ctx)));
  return {
    id,
    labelKey: config.labelKey,
    category: config.category,
    valueKind: config.valueKind,
    editorKind: 'none',
    defaultWidth: config.defaultWidth ?? 140,
    scheduleDerived: config.scheduleDerived,
    available: config.available ?? (() => true),
    readOnly: true,
    read: config.read,
    format,
    copy,
    tooltip: config.tooltip,
    autoFitText: (task, ctx) => format(config.read(task, ctx), task, ctx),
  };
}

function editableColumn(config: EditableColumnConfig): TaskColumnDescriptor {
  const id = typeof config.id === 'string' ? taskColumnId(config.id) : config.id;
  const format = config.format ?? ((value: unknown) => formatScalar(value));
  const copy = config.copy ?? ((task: Task, ctx: TaskColumnContext) => copyScalar(config.read(task, ctx)));
  const rawPlanWrite: Writer = config.planWrite ?? ((value, task) => success<readonly GridWriteIntent[]>([{
    kind: 'cell-edit', taskId: task.id, columnId: id, route: config.route ?? 'task-field', value,
  }]));
  const planWrite: Writer = (value, task, ctx) => config.readOnly?.(task, ctx)
    ? failure('readOnly', value)
    : rawPlanWrite(value, task, ctx);
  return {
    id,
    labelKey: config.labelKey,
    category: config.category,
    valueKind: config.valueKind,
    editorKind: config.editorKind,
    editorOptions: config.editorOptions,
    defaultWidth: config.defaultWidth ?? 140,
    available: config.available ?? (() => true),
    readOnly: config.readOnly ?? false,
    read: config.read,
    format,
    copy,
    editText: config.editText,
    tooltip: config.tooltip,
    parse: config.parse,
    validate: config.validate,
    planWrite,
    planWriteUnchecked: rawPlanWrite,
    autoFitText: (task, ctx) => format(config.read(task, ctx), task, ctx),
  };
}

const parseText: Parser = text => success(text);
const parseOptionalText: Parser = text => success(text.trim() === '' ? undefined : text);
const validateAny: Validator = value => success(value);

const parseNumber: Parser = text => {
  if (text.trim() === '') return success(undefined);
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) ? success(value) : failure('number', text);
};

function finiteNumber(options: { min?: number; max?: number; integer?: boolean; optional?: boolean } = {}): Validator {
  return value => {
    if (value === undefined && options.optional) return success(undefined);
    if (typeof value !== 'number' || !Number.isFinite(value)) return failure('number', value);
    if (options.integer && !Number.isInteger(value)) return failure('integer', value);
    if (options.min !== undefined && value < options.min) return failure('min', value);
    if (options.max !== undefined && value > options.max) return failure('max', value);
    return success(value);
  };
}

const parseBoolean: Parser = text => {
  const value = text.trim().toLocaleLowerCase();
  if (value === '') return success(undefined);
  if (['true', '1', 'ja', 'yes'].includes(value)) return success(true);
  if (['false', '0', 'nee', 'no'].includes(value)) return success(false);
  return failure('boolean', text);
};
const validateBoolean: Validator = value =>
  value === undefined || typeof value === 'boolean' ? success(value) : failure('boolean', value);

function enumParser(values: readonly string[], optional = false): Parser {
  return text => {
    const value = text.trim();
    if (optional && value === '') return success(undefined);
    const exact = values.find(option => option.toLocaleLowerCase() === value.toLocaleLowerCase());
    return exact ? success(exact) : failure('enum', text);
  };
}

function enumValidator(values: readonly string[], optional = false): Validator {
  return value => {
    if (optional && value === undefined) return success(undefined);
    return typeof value === 'string' && values.includes(value)
      ? success(value)
      : failure('enum', value);
  };
}

function isValidIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) return false;
  return Number.isFinite(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value));
}

const parseDate: Parser = text => {
  const value = text.trim();
  if (value === '') return success(undefined);
  return isValidIso(value) ? success(value) : failure('date', text);
};
const validateDate: Validator = value =>
  value === undefined || (typeof value === 'string' && isValidIso(value))
    ? success(value)
    : failure('date', value);

const parsePercentage: Parser = text => {
  const normalized = text.trim().replace('%', '').replace(',', '.');
  if (normalized === '') return failure('percentage', text);
  const value = Number(normalized);
  return Number.isFinite(value) ? success(value / 100) : failure('percentage', text);
};
const validatePercentage: Validator = value =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? success(value)
    : failure('percentage', value);

function effectiveHoursPerDay(task: Task, ctx: TaskColumnContext): number {
  const supplied = ctx.effectiveHoursPerDay?.(task);
  if (typeof supplied === 'number' && Number.isFinite(supplied) && supplied > 0) return supplied;
  const minutes = task.time.durationMinutes;
  if (minutes !== undefined && task.time.scheduleDuration > 0) {
    const derived = minutes / task.time.scheduleDuration / 60;
    if (Number.isFinite(derived) && derived > 0) return derived;
  }
  return 8;
}

const parseTaskDuration: Parser = (text, task, ctx) => {
  if (text.trim() === '') return success(undefined);
  const hoursPerDay = effectiveHoursPerDay(task, ctx);
  const minutes = parseDurationMinutes(text, hoursPerDay);
  // De editor-/pastegrens draagt minuten. Task 12's bewaakte duurplanner houdt daaruit de
  // opgeslagen dag- en minutenvelden samen consistent; hier al terugdelen zou subdaginformatie
  // verliezen en van de kolomcontext afhankelijke fractionele dagen doorgeven.
  return minutes === null ? failure('duration', text) : success(minutes);
};
const validateOptionalDuration = finiteNumber({ min: 0, optional: true });

function isParsedTaskDuration(value: unknown): value is ParsedTaskDuration {
  if (!value || typeof value !== 'object') return false;
  const parsed = value as Partial<ParsedTaskDuration>;
  if (parsed.unit === 'days') {
    return typeof parsed.scheduleDuration === 'number'
      && Number.isSafeInteger(parsed.scheduleDuration)
      && parsed.scheduleDuration >= 0;
  }
  return parsed.unit === 'hours'
    && typeof parsed.durationMinutes === 'number'
    && Number.isSafeInteger(parsed.durationMinutes)
    && parsed.durationMinutes >= 0;
}

const parseScheduledTaskDuration: Parser = (text, task, ctx) => {
  const parsed = parseTaskDurationInput(text, task.time.durationUnit);
  if (parsed) return success(parsed);
  // Achterwaartse klembordcompatibiliteit: de bestaande rasterparser accepteert samengestelde
  // invoer zoals `2d 4u` en draagt die als minuten naar de oude transactieroute. Nieuwe enkelvoudige
  // invoer (`2d`, `12h`, of een getal in de huidige taakeenheid) gebruikt het expliciete unitobject.
  const legacyMinutes = parseDurationMinutes(text, effectiveHoursPerDay(task, ctx));
  return legacyMinutes === null ? failure('duration', text) : success(legacyMinutes);
};
const validateScheduledTaskDuration: Validator = value =>
  isParsedTaskDuration(value)
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    ? success(value)
    : failure('duration', value);

function scheduledTaskDurationText(task: Task, ctx?: TaskColumnContext): string {
  const suffixKey = task.time.durationUnit === 'hours' ? 'duration.suffixHour' : 'duration.suffixDay';
  const fallback = task.time.durationUnit === 'hours' ? 'h' : 'd';
  const suffix = ctx?.labelForText?.(suffixKey) ?? fallback;
  return `${formatTaskDurationInput(task)}${suffix}`;
}

const TASK_TYPES: readonly TaskType[] = [
  'CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE',
  'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED',
];
const TASK_STATUSES: readonly TaskStatus[] = ['NOT_STARTED', 'STARTED', 'COMPLETED'];
const MILESTONE_KINDS: readonly MilestoneKind[] = ['START', 'FINISH'];
const CONSTRAINT_TYPES: readonly ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];
const RESOURCE_CURVES: readonly ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];
const RESOURCE_CURVE_LABEL_KEYS: Readonly<Record<ResourceCurve, string>> = {
  UNIFORM: 'resource.curve.uniform',
  FRONT_LOADED: 'resource.curve.frontLoaded',
  BACK_LOADED: 'resource.curve.backLoaded',
  BELL: 'resource.curve.bell',
  EARLY_PEAK: 'resource.curve.earlyPeak',
  LATE_PEAK: 'resource.curve.latePeak',
};

function enumOptions(prefix: string, values: readonly string[], optional = false) {
  return [
    ...(optional ? [{ value: '', labelKey: `${prefix}.none` }] : []),
    ...values.map(value => ({ value, labelKey: `${prefix}.${value}` })),
  ];
}

function compactArraySummary(value: unknown, labelKey: string, ctx: TaskColumnContext): string {
  const count = Array.isArray(value) ? value.length : 0;
  if (count === 0) return '—';
  const label = ctx.labelForText?.(labelKey) ?? labelKey;
  return `${label}: ${count}`;
}

function assignments(task: Task, ctx: TaskColumnContext): readonly ResourceAssignment[] {
  return ctx.assignmentsByTaskId.get(task.id) ?? [];
}

function assignmentLabel(assignment: ResourceAssignment, ctx: TaskColumnContext): string {
  return ctx.resourcesById.get(assignment.resourceId)?.name ?? assignment.resourceId;
}

function assignmentWindowText(
  task: Task,
  ctx: TaskColumnContext,
  field: 'workWindowStart' | 'workWindowFinish',
): string {
  const values = assignments(task, ctx).flatMap(assignment => assignment[field]
    ? [`${assignmentLabel(assignment, ctx)}: ${assignment[field]}`]
    : []);
  return values.length > 0 ? values.join('; ') : '—';
}

const STRUCTURED_CLIPBOARD_SEPARATOR = '\u2063';
const ASSIGNMENT_CLIPBOARD_MARKER = `${STRUCTURED_CLIPBOARD_SEPARATOR}ops-assignment:`;
const ACTIVITY_CODE_CLIPBOARD_MARKER = `${STRUCTURED_CLIPBOARD_SEPARATOR}ops-activity-code:`;

function structuredClipboardText(visible: string, marker: string, payload: unknown): string {
  return `${visible}${marker}${encodeTaskColumnIdSegment(canonicalGridJson(payload))}`;
}

function structuredClipboardPayload(
  text: string,
  marker: string,
): GridResult<unknown | undefined, readonly CellValidationError[]> {
  const markerIndex = text.lastIndexOf(marker);
  if (markerIndex < 0) return success(undefined);
  const encoded = text.slice(markerIndex + marker.length);
  try {
    const decoded = decodeURIComponent(encoded);
    if (encodeTaskColumnIdSegment(decoded) !== encoded) return failure('structuredClipboard', text);
    return success(JSON.parse(decoded));
  } catch {
    return failure('structuredClipboard', text);
  }
}

function assignmentTokens(task: Task, ctx: TaskColumnContext): TaskAssignmentToken[] {
  return assignments(task, ctx).map(assignment => ({
    assignmentId: assignment.id,
    resourceId: assignment.resourceId,
    unitsPerDay: assignment.unitsPerDay,
    curve: assignment.curve,
  }));
}

function resolveResourceId(reference: string, ctx: TaskColumnContext): GridResult<string, readonly CellValidationError[]> {
  if (ctx.resourcesById.has(reference)) return success(reference);
  const matches = [...ctx.resourcesById.values()].filter(resource => resource.name === reference);
  if (matches.length === 1) return success(matches[0].id);
  return matches.length > 1
    ? failure('assignmentAmbiguous', reference)
    : failure('assignmentResource', reference);
}

function resolveAssignment(
  reference: string,
  task: Task,
  ctx: TaskColumnContext,
): GridResult<ResourceAssignment, readonly CellValidationError[]> {
  const current = assignments(task, ctx);
  const byId = current.find(item => item.id === reference);
  if (byId) return success(byId);
  const byResourceId = current.filter(item => item.resourceId === reference);
  if (byResourceId.length === 1) return success(byResourceId[0]);
  const byName = current.filter(item => ctx.resourcesById.get(item.resourceId)?.name === reference);
  if (byName.length === 1) return success(byName[0]);
  return byResourceId.length > 1 || byName.length > 1
    ? failure('assignmentAmbiguous', reference)
    : failure('assignmentResource', reference);
}

function validateAssignmentTokens(
  value: unknown,
  task: Task,
  ctx: TaskColumnContext,
  code: string,
): GridResult<unknown, readonly CellValidationError[]> {
  if (!Array.isArray(value)) return failure(code, value);
  const currentById = new Map(assignments(task, ctx).map(item => [item.id, item] as const));
  const normalized: TaskAssignmentToken[] = [];
  let removedForeignIdentity = false;
  const resourceIds = new Set<string>();
  const assignmentIds = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return failure(code, raw);
    const token = raw as Partial<TaskAssignmentToken>;
    if (typeof token.resourceId !== 'string' || !ctx.resourcesById.has(token.resourceId)) return failure(code, raw);
    if (typeof token.unitsPerDay !== 'number' || !Number.isFinite(token.unitsPerDay) || token.unitsPerDay <= 0) {
      return failure(code, raw);
    }
    if (token.curve !== undefined && !RESOURCE_CURVES.includes(token.curve)) return failure(code, raw);
    if (resourceIds.has(token.resourceId)) return failure('assignmentDuplicateResource', token.resourceId);
    resourceIds.add(token.resourceId);
    let assignmentId = token.assignmentId;
    if (assignmentId !== undefined) {
      if (typeof assignmentId !== 'string' || assignmentIds.has(assignmentId)) {
        return failure('assignmentDuplicateId', assignmentId);
      }
      const current = currentById.get(assignmentId);
      // Een volledige assignmentcel die naar een andere taak wordt geplakt draagt ids van de
      // brontaak. Op het doel is resource-identiteit leidend en ontstaat een nieuwe assignment.
      // Bestaat de id wél op dit doel, dan blijft een resourcewisseling streng verboden.
      if (current && current.resourceId !== token.resourceId) return failure('assignmentIdentity', raw);
      if (current) assignmentIds.add(assignmentId);
      else {
        assignmentId = undefined;
        removedForeignIdentity = true;
      }
    }
    normalized.push({
      ...(assignmentId ? { assignmentId } : {}),
      resourceId: token.resourceId,
      unitsPerDay: token.unitsPerDay,
      ...(token.curve ? { curve: token.curve } : {}),
    });
  }
  // Zelfde taak: behoud exact de bestaande payload, inclusief sleutelvolgorde voor canonieke
  // deduplicatie. Andere taak: verwijder uitsluitend de niet-overdraagbare assignment-id's.
  return success(removedForeignIdentity ? normalized : value);
}

const parseAssignmentResources: Parser = (text, task, ctx) => {
  const structured = structuredClipboardPayload(text, ASSIGNMENT_CLIPBOARD_MARKER);
  if (!structured.ok || structured.value !== undefined) return structured;
  const trimmed = text.trim();
  if (trimmed === '') return success([]);
  const exactNameMatches = [...ctx.resourcesById.values()].filter(resource => resource.name === trimmed);
  const references = ctx.resourcesById.has(trimmed) || exactNameMatches.length > 0
    ? [trimmed]
    : parseTokens(text);
  const currentByResourceId = new Map(assignmentTokens(task, ctx).map(token => [token.resourceId, token] as const));
  const result: TaskAssignmentToken[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    const resolved = resolveResourceId(reference, ctx);
    if (!resolved.ok) return resolved;
    if (seen.has(resolved.value)) return failure('assignmentDuplicateResource', resolved.value);
    seen.add(resolved.value);
    result.push(currentByResourceId.get(resolved.value) ?? { resourceId: resolved.value, unitsPerDay: 1 });
  }
  return success(result);
};

function assignmentPairs(text: string): string[] {
  return text.split(/[;\n]/).map(value => value.trim()).filter(Boolean);
}

const parseAssignmentUnits: Parser = (text, task, ctx) => {
  const structured = structuredClipboardPayload(text, ASSIGNMENT_CLIPBOARD_MARKER);
  if (!structured.ok || structured.value !== undefined) return structured;
  const pairs = assignmentPairs(text);
  if (pairs.length === 0) return failure('assignmentUnits', text);
  const result = assignmentTokens(task, ctx);
  const tokenByAssignmentId = new Map(result.map(token => [token.assignmentId, token] as const));
  const seen = new Set<string>();
  for (const pair of pairs) {
    const separator = pair.lastIndexOf(':');
    if (separator <= 0) return failure('assignmentUnits', pair);
    const resolved = resolveAssignment(pair.slice(0, separator).trim(), task, ctx);
    const unitsPerDay = Number(pair.slice(separator + 1).trim().replace(',', '.'));
    if (!resolved.ok) return resolved;
    if (!Number.isFinite(unitsPerDay) || unitsPerDay <= 0) return failure('assignmentUnits', pair);
    if (seen.has(resolved.value.id)) return failure('assignmentDuplicateId', resolved.value.id);
    seen.add(resolved.value.id);
    tokenByAssignmentId.get(resolved.value.id)!.unitsPerDay = unitsPerDay;
  }
  return success(result);
};

const parseAssignmentCurves: Parser = (text, task, ctx) => {
  const structured = structuredClipboardPayload(text, ASSIGNMENT_CLIPBOARD_MARKER);
  if (!structured.ok || structured.value !== undefined) return structured;
  const pairs = assignmentPairs(text);
  if (pairs.length === 0) return failure('assignmentCurve', text);
  const result = assignmentTokens(task, ctx);
  const tokenByAssignmentId = new Map(result.map(token => [token.assignmentId, token] as const));
  const seen = new Set<string>();
  for (const pair of pairs) {
    const separator = pair.lastIndexOf(':');
    if (separator <= 0) return failure('assignmentCurve', pair);
    const resolved = resolveAssignment(pair.slice(0, separator).trim(), task, ctx);
    const curve = pair.slice(separator + 1).trim().toUpperCase() as ResourceCurve;
    if (!resolved.ok) return resolved;
    if (!RESOURCE_CURVES.includes(curve)) return failure('assignmentCurve', pair);
    if (seen.has(resolved.value.id)) return failure('assignmentDuplicateId', resolved.value.id);
    seen.add(resolved.value.id);
    tokenByAssignmentId.get(resolved.value.id)!.curve = curve === 'UNIFORM' ? undefined : curve;
  }
  return success(result);
};

function parseTokens(text: string): string[] {
  return text.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
}

function fixedTaskColumns(input: TaskColumnRegistryInput): TaskColumnDescriptor[] {
  const customTaskTypes = input.customTaskTypes ?? [];
  const customTaskTypeIds = customTaskTypes.map(type => type.id);
  const columns: TaskColumnDescriptor[] = [
    readonlyColumn({ id: 'task.id', labelKey: 'taskGrid.columns.taskId', category: 'technical', valueKind: 'text', read: task => task.id }),
    editableColumn({ id: 'task.name', labelKey: 'taskGrid.columns.name', category: 'task', valueKind: 'text', editorKind: 'text', defaultWidth: 220, read: task => task.name, parse: parseText, validate: value => typeof value === 'string' && value.trim() ? success(value) : failure('required', value) }),
    editableColumn({ id: 'task.description', labelKey: 'taskGrid.columns.description', category: 'task', valueKind: 'text', editorKind: 'text', defaultWidth: 280, read: task => task.description, parse: parseText, validate: value => typeof value === 'string' ? success(value) : failure('text', value) }),
    editableColumn({ id: 'task.wbsCode', labelKey: 'taskGrid.columns.wbs', category: 'task', valueKind: 'text', editorKind: 'text', read: task => task.wbsCode, readOnly: (_task, ctx) => ctx.wbsAutoNumber === true, parse: parseText, validate: value => typeof value === 'string' && value.trim() ? success(value) : failure('required', value) }),
    editableColumn({ id: 'task.taskType', labelKey: 'taskGrid.columns.taskType', category: 'task', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('taskType', TASK_TYPES), read: task => task.taskType, parse: enumParser(TASK_TYPES), validate: enumValidator(TASK_TYPES) }),
    editableColumn({
      id: 'task.customTaskTypeId', labelKey: 'taskGrid.columns.customTaskType', category: 'task',
      valueKind: 'enum', editorKind: 'enum',
      editorOptions: [
        { value: '', label: '—' },
        ...customTaskTypes.map(type => ({ value: type.id, label: type.name })),
      ],
      read: task => task.customTaskTypeId,
      parse: enumParser(customTaskTypeIds, true),
      validate: enumValidator(customTaskTypeIds, true),
    }),
    editableColumn({ id: 'task.status', labelKey: 'taskGrid.columns.status', category: 'progress', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('taskStatus', TASK_STATUSES), route: 'task-progress', read: task => task.status, parse: enumParser(TASK_STATUSES), validate: enumValidator(TASK_STATUSES) }),
    editableColumn({ id: 'task.isMilestone', labelKey: 'taskGrid.columns.milestone', category: 'planning', valueKind: 'boolean', editorKind: 'boolean', route: 'task-milestone', read: task => task.isMilestone, parse: parseBoolean, validate: validateBoolean }),
    editableColumn({ id: 'task.milestoneKind', labelKey: 'taskGrid.columns.milestoneKind', category: 'planning', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('milestoneKind', MILESTONE_KINDS, true), route: 'task-milestone', read: task => task.milestoneKind, readOnly: task => !task.isMilestone, parse: enumParser(MILESTONE_KINDS, true), validate: enumValidator(MILESTONE_KINDS, true) }),
    editableColumn({ id: 'task.mandatory', labelKey: 'taskGrid.columns.mandatoryMilestone', category: 'planning', valueKind: 'boolean', editorKind: 'boolean', route: 'task-milestone', read: task => task.mandatory, readOnly: task => !task.isMilestone, parse: parseBoolean, validate: validateBoolean }),
    editableColumn({ id: 'task.priority', labelKey: 'taskGrid.columns.priority', category: 'planning', valueKind: 'number', editorKind: 'number', read: task => task.priority, parse: parseNumber, validate: finiteNumber({ min: 0, max: 1000, integer: true }) }),
    readonlyColumn({ id: 'task.levelingDelay', labelKey: 'taskGrid.columns.levelingDelay', category: 'computed', valueKind: 'duration', read: task => task.levelingDelay }),
    readonlyColumn({ id: 'task.levelingDelayMinutes', labelKey: 'taskGrid.columns.levelingDelayMinutes', category: 'technical', valueKind: 'number', read: task => task.levelingDelayMinutes }),
    readonlyColumn({ id: 'task.levelingDelayElapsed', labelKey: 'taskGrid.columns.levelingDelayElapsed', category: 'technical', valueKind: 'boolean', read: task => task.levelingDelayElapsed }),
    readonlyColumn({
      id: 'task.splitGaps', labelKey: 'taskGrid.columns.splitGaps', category: 'planning', valueKind: 'technical',
      read: task => task.splitGaps,
      format: (value, _task, ctx) => compactArraySummary(value, 'taskGrid.columns.splitGaps', ctx),
      copy: task => canonicalGridJson(task.splitGaps ?? []),
    }),
    readonlyColumn({ id: 'task.timephasedFinishFloor', labelKey: 'taskGrid.columns.timephasedFinishFloor', category: 'technical', valueKind: 'datetime', read: task => task.timephasedFinishFloor }),
    readonlyColumn({ id: 'task.timephasedStartAnchor', labelKey: 'taskGrid.columns.timephasedStartAnchor', category: 'technical', valueKind: 'datetime', read: task => task.timephasedStartAnchor }),
    readonlyColumn({
      id: 'task.timephasedDurationWalks', labelKey: 'taskGrid.columns.timephasedDurationWalks', category: 'technical', valueKind: 'technical',
      read: task => task.timephasedDurationWalks,
      format: (value, _task, ctx) => compactArraySummary(value, 'taskGrid.columns.timephasedDurationWalks', ctx),
      copy: task => canonicalGridJson(task.timephasedDurationWalks ?? []),
    }),
    readonlyColumn({
      id: 'task.timephasedContours', labelKey: 'taskGrid.columns.timephasedContours', category: 'technical', valueKind: 'technical',
      read: task => task.timephasedContours,
      format: (value, _task, ctx) => compactArraySummary(value, 'taskGrid.columns.timephasedContours', ctx),
      copy: task => canonicalGridJson(task.timephasedContours ?? []),
    }),
    readonlyColumn({ id: 'task.manuallyScheduled', labelKey: 'taskGrid.columns.manuallyScheduled', category: 'technical', valueKind: 'boolean', read: task => task.manuallyScheduled }),
    readonlyColumn({ id: 'task.mspTaskType', labelKey: 'taskGrid.columns.mspTaskType', category: 'technical', valueKind: 'enum', read: task => task.mspTaskType }),
    readonlyColumn({ id: 'task.effortDriven', labelKey: 'taskGrid.columns.effortDriven', category: 'technical', valueKind: 'boolean', read: task => task.effortDriven }),
    // XER/Primavera-herkomst: acht bronvelden die de XER-lezer op de taak zet en die door IFC
    // round-trippen. Ze zijn puur provenance (geen solverinvoer deze etappe), dus één readonly
    // technische kolom bundelt ze — zoals `task.activityCodes.technical` dat voor codes doet.
    readonlyColumn({
      id: 'task.p6Provenance', labelKey: 'taskGrid.columns.p6Provenance', category: 'technical', valueKind: 'technical',
      read: task => p6ProvenanceOf(task),
      format: value => {
        const entries = value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : [];
        return entries.length ? entries.map(([key, item]) => `${key}: ${String(item)}`).join(', ') : '—';
      },
      copy: task => canonicalGridJson(p6ProvenanceOf(task)),
    }),
    // Expliciete, kinderloze WBS-samenvatting (P6 PROJWBS). Alleen-lezen: de marker komt uit de
    // import en de hiërarchie zelf blijft via parentId/childIds bewerkbaar.
    readonlyColumn({ id: 'task.isSummary', labelKey: 'taskGrid.columns.explicitSummary', category: 'technical', valueKind: 'boolean', read: task => task.isSummary }),
    readonlyColumn({ id: 'task.parentId', labelKey: 'taskGrid.columns.parentId', category: 'technical', valueKind: 'text', read: task => task.parentId }),
    readonlyColumn({ id: 'task.childIds', labelKey: 'taskGrid.columns.childIds', category: 'technical', valueKind: 'technical', read: task => task.childIds, format: value => Array.isArray(value) && value.length ? value.join(', ') : '—', copy: task => canonicalGridJson(task.childIds) }),
    readonlyColumn({ id: 'task.resourceIds', labelKey: 'taskGrid.columns.resourceIds', category: 'technical', valueKind: 'technical', read: task => task.resourceIds, format: value => Array.isArray(value) && value.length ? value.join(', ') : '—', copy: task => canonicalGridJson(task.resourceIds) }),
    readonlyColumn({ id: 'task.activityCodes.technical', labelKey: 'taskGrid.columns.activityCodeData', category: 'technical', valueKind: 'technical', read: task => task.activityCodes, format: (value, _task, ctx) => value && typeof value === 'object' && Object.keys(value).length ? ctx.labelForText?.('taskGrid.summary.activityCodeAssignments', { count: Object.keys(value).length }) ?? String(Object.keys(value).length) : '—', copy: task => canonicalGridJson(task.activityCodes ?? {}) }),
    readonlyColumn({ id: 'task.customFields.technical', labelKey: 'taskGrid.columns.customFieldData', category: 'technical', valueKind: 'technical', read: task => task.customFields, format: (value, _task, ctx) => value && typeof value === 'object' && Object.keys(value).length ? ctx.labelForText?.('taskGrid.summary.customFields', { count: Object.keys(value).length }) ?? String(Object.keys(value).length) : '—', copy: task => canonicalGridJson(task.customFields ?? {}) }),
    editableColumn({ id: 'task.color', labelKey: 'taskGrid.columns.color', category: 'task', valueKind: 'text', editorKind: 'color', read: task => task.color, parse: parseOptionalText, validate: value => value === undefined || typeof value === 'string' ? success(value) : failure('color', value) }),
    editableColumn({ id: 'task.constraint.type', labelKey: 'taskGrid.columns.constraintType', category: 'constraints', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('constraintType', CONSTRAINT_TYPES), route: 'task-constraint', read: task => task.constraint?.type ?? 'ASAP', parse: enumParser(CONSTRAINT_TYPES), validate: enumValidator(CONSTRAINT_TYPES) }),
    editableColumn({ id: 'task.constraint.date', labelKey: 'taskGrid.columns.constraintDate', category: 'constraints', valueKind: 'date', editorKind: 'date', route: 'task-constraint', read: task => task.constraint?.date, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.constraint.hard', labelKey: 'taskGrid.columns.constraintHard', category: 'constraints', valueKind: 'boolean', editorKind: 'boolean', route: 'task-constraint', read: task => task.constraint?.hard, readOnly: task => task.constraint?.type !== 'MSO' && task.constraint?.type !== 'MFO', parse: parseBoolean, validate: validateBoolean }),
    editableColumn({ id: 'task.constraint2.type', labelKey: 'taskGrid.columns.constraint2Type', category: 'constraints', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('constraintType', CONSTRAINT_TYPES, true), route: 'task-constraint', read: task => task.constraint2?.type, parse: enumParser(CONSTRAINT_TYPES, true), validate: enumValidator(CONSTRAINT_TYPES, true) }),
    editableColumn({ id: 'task.constraint2.date', labelKey: 'taskGrid.columns.constraint2Date', category: 'constraints', valueKind: 'date', editorKind: 'date', route: 'task-constraint', read: task => task.constraint2?.date, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.isHammock', labelKey: 'taskGrid.columns.hammock', category: 'planning', valueKind: 'boolean', editorKind: 'boolean', route: 'task-hammock', read: task => task.isHammock, readOnly: task => task.isMilestone || task.childIds.length > 0, parse: parseBoolean, validate: validateBoolean }),
    editableColumn({ id: 'task.deadline', labelKey: 'taskGrid.columns.deadline', category: 'constraints', valueKind: 'date', editorKind: 'date', route: 'task-constraint', read: task => task.deadline, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.calendarId', labelKey: 'taskGrid.columns.calendar', category: 'planning', valueKind: 'text', editorKind: 'autocomplete', route: 'task-schedule', read: task => task.calendarId, parse: parseOptionalText, validate: validateAny }),
    editableColumn({
      id: 'task.notes', labelKey: 'taskGrid.columns.notes', category: 'task', valueKind: 'text', defaultWidth: 240,
      editorKind: 'text',
      read: task => task.notes,
      readOnly: task => (task.notes?.length ?? 0) > 1,
      format: value => Array.isArray(value) && value.length
        ? value.map(note => `${(note as { done: boolean }).done ? '✓' : '○'} ${(note as { text: string }).text}`).join('; ')
        : '—',
      copy: task => (task.notes ?? []).map(note => `${note.done ? '✓' : '○'} ${note.text}`).join('; '),
      editText: task => task.notes?.[0]?.text ?? '',
      parse: text => success(text.replace(/^[✓○]\s*/, '')),
      validate: value => typeof value === 'string' ? success(value) : failure('text', value),
    }),
    readonlyColumn({
      id: 'task.notes.technical', labelKey: 'taskGrid.columns.noteData', category: 'technical', valueKind: 'technical',
      read: task => task.notes,
      format: (value, _task, ctx) => compactArraySummary(value, 'taskGrid.columns.notes', ctx),
      copy: task => canonicalGridJson(task.notes ?? []),
    }),
  ];

  columns.push(...fixedTimeColumns(), ...fixedRelationColumns(), ...fixedAssignmentColumns());
  return columns;
}

function fixedTimeColumns(): TaskColumnDescriptor[] {
  return [
    editableColumn({ id: 'task.time.durationType', labelKey: 'taskGrid.columns.durationType', category: 'planning', valueKind: 'enum', editorKind: 'enum', editorOptions: enumOptions('durationType', ['WORKTIME', 'ELAPSEDTIME']), route: 'task-schedule', read: task => task.time.durationType, parse: enumParser(['WORKTIME', 'ELAPSEDTIME']), validate: enumValidator(['WORKTIME', 'ELAPSEDTIME']) }),
    editableColumn({ id: 'task.time.durationUnit', labelKey: 'duration.unit', category: 'planning', valueKind: 'enum', editorKind: 'enum', editorOptions: [{ value: 'days', labelKey: 'duration.days' }, { value: 'hours', labelKey: 'duration.hours' }], route: 'task-schedule', read: task => task.time.durationUnit, readOnly: task => task.isHammock === true || task.childIds.length > 0 || task.isMilestone, parse: enumParser(['days', 'hours']), validate: enumValidator(['days', 'hours']) }),
    editableColumn({ id: 'task.time.scheduleDuration', labelKey: 'taskGrid.columns.duration', category: 'planning', valueKind: 'duration', editorKind: 'duration', route: 'task-schedule', read: task => task.time.durationUnit === 'hours' ? task.time.durationMinutes : task.time.scheduleDuration, readOnly: task => task.isHammock === true || (task.isMilestone && task.time.scheduleDuration === 0), format: (_value, task, ctx) => scheduledTaskDurationText(task, ctx), copy: task => scheduledTaskDurationText(task), editText: task => formatTaskDurationInput(task), parse: parseScheduledTaskDuration, validate: validateScheduledTaskDuration }),
    readonlyColumn({ id: 'task.time.durationMinutes', labelKey: 'taskGrid.columns.durationMinutes', category: 'technical', valueKind: 'number', read: task => task.time.durationMinutes }),
    editableColumn({ id: 'task.time.scheduleStart', labelKey: 'taskGrid.columns.scheduleStart', category: 'planning', valueKind: 'datetime', editorKind: 'datetime', route: 'task-schedule', read: task => task.time.scheduleStart, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.time.scheduleFinish', labelKey: 'taskGrid.columns.scheduleFinish', category: 'planning', valueKind: 'datetime', editorKind: 'datetime', route: 'task-schedule', read: task => task.time.scheduleFinish, parse: parseDate, validate: validateDate }),
    readonlyColumn({ id: 'task.time.resume', labelKey: 'taskGrid.columns.resume', category: 'progress', valueKind: 'datetime', read: task => task.time.resume }),
    readonlyColumn({ id: 'task.time.stop', labelKey: 'taskGrid.columns.stop', category: 'progress', valueKind: 'datetime', read: task => task.time.stop }),
    readonlyColumn({ id: 'task.time.earlyStart', labelKey: 'taskGrid.columns.earlyStart', category: 'computed', valueKind: 'datetime', read: task => task.time.earlyStart }),
    readonlyColumn({ id: 'task.time.earlyFinish', labelKey: 'taskGrid.columns.earlyFinish', category: 'computed', valueKind: 'datetime', read: task => task.time.earlyFinish }),
    readonlyColumn({ id: 'task.time.lateStart', labelKey: 'taskGrid.columns.lateStart', category: 'computed', valueKind: 'datetime', read: task => task.time.lateStart }),
    readonlyColumn({ id: 'task.time.lateFinish', labelKey: 'taskGrid.columns.lateFinish', category: 'computed', valueKind: 'datetime', read: task => task.time.lateFinish }),
    readonlyColumn({ id: 'task.time.freeFloat', labelKey: 'taskGrid.columns.freeFloat', category: 'computed', valueKind: 'duration', read: task => task.time.freeFloat }),
    readonlyColumn({ id: 'task.time.totalFloat', labelKey: 'taskGrid.columns.totalFloat', category: 'computed', valueKind: 'duration', read: task => task.time.totalFloat }),
    readonlyColumn({ id: 'task.time.isCritical', labelKey: 'taskGrid.columns.critical', category: 'computed', valueKind: 'boolean', read: task => task.time.isCritical }),
    readonlyColumn({ id: 'task.time.interferingFloat', labelKey: 'taskGrid.columns.interferingFloat', category: 'computed', valueKind: 'duration', read: task => task.time.interferingFloat }),
    readonlyColumn({ id: 'task.time.isNearCritical', labelKey: 'taskGrid.columns.nearCritical', category: 'computed', valueKind: 'boolean', read: task => task.time.isNearCritical }),
    readonlyColumn({ id: 'task.time.floatPath', labelKey: 'taskGrid.columns.floatPath', category: 'computed', valueKind: 'number', read: task => task.time.floatPath }),
    editableColumn({ id: 'task.time.actualStart', labelKey: 'taskGrid.columns.actualStart', category: 'progress', valueKind: 'datetime', editorKind: 'datetime', route: 'task-progress', read: task => task.time.actualStart, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.time.actualFinish', labelKey: 'taskGrid.columns.actualFinish', category: 'progress', valueKind: 'datetime', editorKind: 'datetime', route: 'task-progress', read: task => task.time.actualFinish, parse: parseDate, validate: validateDate }),
    editableColumn({ id: 'task.time.actualDuration', labelKey: 'taskGrid.columns.actualDuration', category: 'progress', valueKind: 'duration', editorKind: 'duration', route: 'task-progress', read: task => task.time.actualDuration, parse: parseTaskDuration, validate: validateOptionalDuration }),
    editableColumn({ id: 'task.time.remainingTime', labelKey: 'taskGrid.columns.remainingTime', category: 'progress', valueKind: 'duration', editorKind: 'duration', route: 'task-progress', read: task => task.time.remainingTime, parse: parseTaskDuration, validate: validateOptionalDuration }),
    readonlyColumn({ id: 'task.time.remainingMinutes', labelKey: 'taskGrid.columns.remainingMinutes', category: 'technical', valueKind: 'number', read: task => task.time.remainingMinutes }),
    editableColumn({ id: 'task.time.completion', labelKey: 'taskGrid.columns.completion', category: 'progress', valueKind: 'number', editorKind: 'percentage', route: 'task-progress', read: task => task.time.completion, format: value => typeof value === 'number' ? `${Math.round(value * 10000) / 100}%` : '—', copy: task => `${Math.round(task.time.completion * 10000) / 100}%`, parse: parsePercentage, validate: validatePercentage }),
  ];
}

function fixedRelationColumns(): TaskColumnDescriptor[] {
  const cellItems = (
    task: Task,
    direction: 'predecessor' | 'successor',
    entries: readonly TaskRelationEntry[],
    ctx: TaskColumnContext,
  ) => buildRelationCellItems({ ownerTaskId: task.id, direction, entries, context: ctx });
  const relationColumn = (direction: 'predecessor' | 'successor'): TaskColumnDescriptor => editableColumn({
    id: `relation.${direction}s`,
    labelKey: `taskGrid.columns.${direction}s`,
    category: 'relations',
    valueKind: 'tokens',
    editorKind: 'relations',
    defaultWidth: 240,
    read: (task, ctx) => taskRelations(ctx.relationIndex, task.id, direction),
    format: (value, task, ctx) => Array.isArray(value) && value.length
      ? relationCellText(cellItems(task, direction, value as TaskRelationEntry[], ctx))
      : '—',
    copy: (task, ctx) => relationCellClipboardText(cellItems(
      task, direction, taskRelations(ctx.relationIndex, task.id, direction), ctx,
    )),
    editText: (task, ctx) => relationCellText(cellItems(
      task, direction, taskRelations(ctx.relationIndex, task.id, direction), ctx,
    )),
    parse: (text, task) => parseRelationCellText({ text, ownerTaskId: task.id, direction }),
    validate: value => isParsedRelationTokenArray(value) ? success(value) : failure('relations', value),
    planWrite: (value, task) => success([{ kind: 'relation-set', taskId: task.id, direction, value }]),
  });
  const analysisItems = (task: Task, ctx: TaskColumnContext) => buildTaskRelationAnalysisItems(task, ctx);
  return [
    relationColumn('predecessor'),
    relationColumn('successor'),
    readonlyColumn({
      id: 'relation.driving', labelKey: 'relations.driving', category: 'relations', valueKind: 'text',
      defaultWidth: 180, scheduleDerived: true,
      read: analysisItems,
      format: (value, _task, ctx) => relationDrivingText(value as readonly RelationCellItem[], ctx.textDirection),
    }),
    readonlyColumn({
      id: 'relation.freeFloat', labelKey: 'relations.freeFloat', category: 'relations', valueKind: 'text',
      defaultWidth: 220, scheduleDerived: true,
      read: analysisItems,
      format: (value, _task, ctx) => relationFreeFloatText(value as readonly RelationCellItem[], ctx.textDirection),
    }),
    readonlyColumn({
      id: 'relation.warnings', labelKey: 'relations.warnings', category: 'relations', valueKind: 'text',
      defaultWidth: 280, scheduleDerived: true,
      read: analysisItems,
      format: (value, _task, ctx) => relationWarningsText(
        value as readonly RelationCellItem[],
        key => ctx.labelForText?.(key) ?? key,
        ctx.textDirection,
      ),
    }),
    readonlyColumn({
      id: 'relation.internalTechnical', labelKey: 'taskGrid.columns.internalRelationData', category: 'technical', valueKind: 'technical',
      read: (task, ctx) => ctx.relationIndex.internalByTaskId.get(task.id) ?? [],
      format: (value, _task, ctx) => Array.isArray(value) && value.length
        ? ctx.labelForText?.('taskGrid.summary.internalRelations', { count: value.length }) ?? String(value.length)
        : '—',
      copy: (task, ctx) => canonicalGridJson(ctx.relationIndex.internalByTaskId.get(task.id) ?? []),
    }),
    readonlyColumn({
      id: 'relation.externalTechnical', labelKey: 'taskGrid.columns.externalRelationData', category: 'technical', valueKind: 'technical',
      read: (task, ctx) => ctx.relationIndex.externalByTaskId.get(task.id) ?? [],
      format: (value, _task, ctx) => Array.isArray(value) && value.length
        ? ctx.labelForText?.('taskGrid.summary.externalRelations', { count: value.length }) ?? String(value.length)
        : '—',
      copy: (task, ctx) => canonicalGridJson(ctx.relationIndex.externalByTaskId.get(task.id) ?? []),
    }),
  ];
}

function fixedAssignmentColumns(): TaskColumnDescriptor[] {
  return [
    editableColumn({
      id: 'assignment.resources', labelKey: 'taskGrid.columns.assignedResources', category: 'resources', valueKind: 'tokens', editorKind: 'autocomplete', defaultWidth: 220,
      read: assignmentTokens,
      readOnly: task => task.isMilestone || task.childIds.length > 0,
      format: (value, _task, ctx) => Array.isArray(value) && value.length
        ? value.map(raw => {
          const token = raw as TaskAssignmentToken;
          return ctx.resourcesById.get(token.resourceId)?.name ?? token.resourceId;
        }).join(', ') : '—',
      copy: (task, ctx) => {
        const tokens = assignmentTokens(task, ctx);
        return tokens.length === 0 ? '' : structuredClipboardText(
          assignments(task, ctx).map(item => assignmentLabel(item, ctx)).join(', '),
          ASSIGNMENT_CLIPBOARD_MARKER,
          tokens,
        );
      },
      editText: (task, ctx) => assignments(task, ctx).map(item => assignmentLabel(item, ctx)).join(', '),
      parse: parseAssignmentResources,
      validate: (value, task, ctx) => validateAssignmentTokens(value, task, ctx, 'assignments'),
      planWrite: (value, task) => success([{
        kind: 'assignment-set', taskId: task.id, columnId: taskColumnId('assignment.resources'),
        tokens: value as readonly TaskAssignmentToken[],
      }]),
    }),
    editableColumn({
      id: 'assignment.unitsPerDay', labelKey: 'taskGrid.columns.assignmentUnits', category: 'resources', valueKind: 'tokens', editorKind: 'custom', defaultWidth: 200,
      read: assignmentTokens,
      readOnly: (task, ctx) => task.isMilestone || task.childIds.length > 0 || assignments(task, ctx).length === 0,
      format: (value, _task, ctx) => Array.isArray(value) && value.length ? value.map(raw => {
        const item = raw as { resourceId: string; unitsPerDay: number };
        return `${ctx.resourcesById.get(item.resourceId)?.name ?? item.resourceId}: ${item.unitsPerDay}`;
      }).join('; ') : '—',
      copy: (task, ctx) => structuredClipboardText(
        assignments(task, ctx).map(item => `${assignmentLabel(item, ctx)}: ${item.unitsPerDay}`).join('; '),
        ASSIGNMENT_CLIPBOARD_MARKER,
        assignmentTokens(task, ctx),
      ),
      editText: (task, ctx) => assignments(task, ctx)
        .map(item => `${assignmentLabel(item, ctx)}: ${item.unitsPerDay}`).join('; '),
      parse: parseAssignmentUnits,
      validate: (value, task, ctx) => validateAssignmentTokens(value, task, ctx, 'assignmentUnits'),
      planWrite: (value, task) => success([{
        kind: 'assignment-set', taskId: task.id, columnId: taskColumnId('assignment.unitsPerDay'),
        tokens: value as readonly TaskAssignmentToken[],
      }]),
    }),
    editableColumn({
      id: 'assignment.curve', labelKey: 'taskGrid.columns.assignmentCurve', category: 'resources', valueKind: 'tokens', editorKind: 'custom', defaultWidth: 200,
      read: assignmentTokens,
      readOnly: (task, ctx) => task.isMilestone || task.childIds.length > 0 || assignments(task, ctx).length === 0,
      format: (value, _task, ctx) => Array.isArray(value) && value.length ? value.map(raw => {
        const item = raw as { resourceId: string; curve: ResourceCurve };
        const curve = item.curve ?? 'UNIFORM';
        const curveLabel = ctx.labelForText?.(RESOURCE_CURVE_LABEL_KEYS[curve]) ?? curve;
        return `${ctx.resourcesById.get(item.resourceId)?.name ?? item.resourceId}: ${curveLabel}`;
      }).join('; ') : '—',
      copy: (task, ctx) => structuredClipboardText(
        assignments(task, ctx).map(item => `${assignmentLabel(item, ctx)}: ${item.curve ?? 'UNIFORM'}`).join('; '),
        ASSIGNMENT_CLIPBOARD_MARKER,
        assignmentTokens(task, ctx),
      ),
      editText: (task, ctx) => assignments(task, ctx)
        .map(item => `${assignmentLabel(item, ctx)}: ${item.curve ?? 'UNIFORM'}`).join('; '),
      parse: parseAssignmentCurves,
      validate: (value, task, ctx) => validateAssignmentTokens(value, task, ctx, 'assignmentCurve'),
      planWrite: (value, task) => success([{
        kind: 'assignment-set', taskId: task.id, columnId: taskColumnId('assignment.curve'),
        tokens: value as readonly TaskAssignmentToken[],
      }]),
    }),
    readonlyColumn({ id: 'assignment.workWindowStart', labelKey: 'taskGrid.columns.workWindowStart', category: 'resources', valueKind: 'technical', read: (task, ctx) => assignments(task, ctx).map(item => ({ assignmentId: item.id, value: item.workWindowStart })), format: (_value, task, ctx) => assignmentWindowText(task, ctx, 'workWindowStart'), copy: (task, ctx) => canonicalGridJson(assignments(task, ctx).map(item => ({ assignmentId: item.id, workWindowStart: item.workWindowStart }))) }),
    readonlyColumn({ id: 'assignment.workWindowFinish', labelKey: 'taskGrid.columns.workWindowFinish', category: 'resources', valueKind: 'technical', read: (task, ctx) => assignments(task, ctx).map(item => ({ assignmentId: item.id, value: item.workWindowFinish })), format: (_value, task, ctx) => assignmentWindowText(task, ctx, 'workWindowFinish'), copy: (task, ctx) => canonicalGridJson(assignments(task, ctx).map(item => ({ assignmentId: item.id, workWindowFinish: item.workWindowFinish }))) }),
    readonlyColumn({ id: 'assignment.id', labelKey: 'taskGrid.columns.assignmentId', category: 'technical', valueKind: 'technical', read: (task, ctx) => assignments(task, ctx).map(item => item.id), format: value => Array.isArray(value) && value.length ? value.join(', ') : '—', copy: (task, ctx) => canonicalGridJson(assignments(task, ctx).map(item => item.id)) }),
    readonlyColumn({ id: 'assignment.taskId', labelKey: 'taskGrid.columns.assignmentTaskId', category: 'technical', valueKind: 'technical', read: (task, ctx) => assignments(task, ctx).map(item => item.taskId), format: value => Array.isArray(value) && value.length ? value.join(', ') : '—', copy: (task, ctx) => canonicalGridJson(assignments(task, ctx).map(item => item.taskId)) }),
    readonlyColumn({ id: 'assignment.resourceId', labelKey: 'taskGrid.columns.assignmentResourceId', category: 'technical', valueKind: 'technical', read: (task, ctx) => assignments(task, ctx).map(item => item.resourceId), format: value => Array.isArray(value) && value.length ? value.join(', ') : '—', copy: (task, ctx) => canonicalGridJson(assignments(task, ctx).map(item => item.resourceId)) }),
  ];
}

function activityCodeColumns(input: TaskColumnRegistryInput): TaskColumnDescriptor[] {
  return input.activityCodeTypes.map(type => {
    const id = activityCodeColumnId(input.projectId, type.id);
    return editableColumn({
      id,
      labelKey: type.name,
      category: 'custom',
      valueKind: 'enum',
      editorKind: 'autocomplete',
      editorOptions: type.values.map(value => ({
        value: value.id,
        label: value.description ? `${value.code} — ${value.description}` : value.code,
      })),
      route: 'activity-code',
      available: ctx => ctx.projectId === input.projectId,
      read: task => task.activityCodes?.[type.id],
      format: value => {
        if (value === undefined) return '—';
        const item = type.values.find(candidate => candidate.id === value);
        return item ? item.code : String(value);
      },
      copy: task => {
        const valueId = task.activityCodes?.[type.id];
        if (valueId === undefined) return '';
        const visible = type.values.find(value => value.id === valueId)?.code ?? valueId;
        return structuredClipboardText(visible, ACTIVITY_CODE_CLIPBOARD_MARKER, valueId);
      },
      parse: text => {
        const structured = structuredClipboardPayload(text, ACTIVITY_CODE_CLIPBOARD_MARKER);
        if (!structured.ok) return structured;
        if (structured.value !== undefined) {
          return typeof structured.value === 'string'
            ? success(structured.value)
            : failure('activityCode', structured.value);
        }
        return success(text.trim() === '' ? undefined : text);
      },
      validate: value => {
        if (value === undefined) return success(undefined);
        if (typeof value !== 'string') return failure('activityCode', value);
        const exactId = type.values.find(candidate => candidate.id === value);
        if (exactId) return success(exactId.id);
        const matches = type.values.filter(candidate => candidate.code === value);
        if (matches.length === 1) return success(matches[0].id);
        return matches.length > 1
          ? failure('activityCodeAmbiguous', value)
          : failure('activityCode', value);
      },
    });
  });
}

function customFieldParser(def: CustomFieldDef): Parser {
  if (def.type === 'number' || def.type === 'integer' || def.type === 'cost') return parseNumber;
  if (def.type === 'date') return parseDate;
  if (def.type === 'boolean') return parseBoolean;
  return parseOptionalText;
}

function customFieldValidator(def: CustomFieldDef): Validator {
  if (def.type === 'number' || def.type === 'cost') return finiteNumber({ optional: true });
  if (def.type === 'integer') return finiteNumber({ integer: true, optional: true });
  if (def.type === 'date') return validateDate;
  if (def.type === 'boolean') return validateBoolean;
  return value => value === undefined || typeof value === 'string' ? success(value) : failure('text', value);
}

function customEditorKind(def: CustomFieldDef): Exclude<EditorKind, 'none'> {
  if (def.type === 'number' || def.type === 'integer' || def.type === 'cost') return 'number';
  if (def.type === 'date') return 'date';
  if (def.type === 'boolean') return 'boolean';
  return 'text';
}

function customValueKind(def: CustomFieldDef): ValueKind {
  if (def.type === 'number' || def.type === 'integer' || def.type === 'cost') return 'number';
  if (def.type === 'date') return 'date';
  if (def.type === 'boolean') return 'boolean';
  return 'text';
}

function customFieldColumns(input: TaskColumnRegistryInput): TaskColumnDescriptor[] {
  return input.customFieldDefs.map(def => editableColumn({
    id: customFieldColumnId(input.projectId, def.id),
    labelKey: def.name,
    category: 'custom',
    valueKind: customValueKind(def),
    editorKind: customEditorKind(def),
    route: 'custom-field',
    available: ctx => ctx.projectId === input.projectId,
    read: task => task.customFields?.[def.id],
    parse: customFieldParser(def),
    validate: customFieldValidator(def),
  }));
}

const BASELINE_MISSING = Symbol('baseline-missing');

function defaultSignedWeekdaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return 0;
  const sign = from <= to ? 1 : -1;
  let cursor = new Date(sign === 1 ? from : to);
  const end = sign === 1 ? to : from;
  let workdays = 0;
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) workdays++;
  }
  return sign * workdays;
}

function currentTaskDate(task: Task, field: 'start' | 'finish'): string {
  return field === 'start'
    ? task.time.earlyStart || task.time.scheduleStart
    : task.time.earlyFinish || task.time.scheduleFinish;
}

function baselineValue(
  field: BaselineTaskColumnField,
  baselineTask: BaselineTask,
  task: Task,
  ctx: TaskColumnContext,
): unknown {
  if (field === 'start') return baselineTask.start;
  if (field === 'finish') return baselineTask.finish;
  if (field === 'duration') return baselineTask.duration;
  if (field === 'isMilestone') return baselineTask.isMilestone;
  if (field === 'milestoneKind') return baselineTask.milestoneKind;
  if (field === 'varianceDuration') return task.time.scheduleDuration - baselineTask.duration;
  const dateField = field === 'varianceStart' ? 'start' : 'finish';
  const from = dateField === 'start' ? baselineTask.start : baselineTask.finish;
  const to = currentTaskDate(task, dateField);
  return (ctx.signedWorkDaysBetween ?? defaultSignedWeekdaysBetween)(from, to);
}

function baselineColumns(input: TaskColumnRegistryInput): TaskColumnDescriptor[] {
  const result: TaskColumnDescriptor[] = [];
  const fields: readonly BaselineTaskColumnField[] = [
    'start', 'finish', 'duration', 'varianceStart', 'varianceFinish', 'varianceDuration',
    'isMilestone', 'milestoneKind',
  ];
  const fieldLabelKeys: Readonly<Record<BaselineTaskColumnField, string>> = {
    start: 'taskGrid.columns.scheduleStart',
    finish: 'taskGrid.columns.scheduleFinish',
    duration: 'taskGrid.columns.duration',
    varianceStart: 'taskGrid.summary.baselineVarianceStart',
    varianceFinish: 'taskGrid.summary.baselineVarianceFinish',
    varianceDuration: 'taskGrid.summary.baselineVarianceDuration',
    isMilestone: 'taskGrid.columns.milestone',
    milestoneKind: 'taskGrid.columns.milestoneKind',
  };
  for (const baseline of input.baselines) {
    // Expliciet één indexbouw per baseline. De descriptor-readers doen alleen Map.get(task.id).
    const taskIndex = new Map(baseline.tasks.map(task => [task.taskId, task] as const));
    for (const fieldName of fields) {
      const technical = fieldName === 'isMilestone' || fieldName === 'milestoneKind';
      const valueKind: ValueKind = fieldName === 'start' || fieldName === 'finish' ? 'datetime'
        : fieldName === 'isMilestone' ? 'boolean'
          : fieldName === 'milestoneKind' ? 'enum'
            : fieldName === 'duration' ? 'duration' : 'number';
      result.push(readonlyColumn({
        id: baselineColumnId(input.projectId, baseline.id, fieldName),
        labelKey: `${baseline.name} — ${fieldLabelKeys[fieldName]}`,
        category: technical ? 'technical' : 'baseline',
        valueKind,
        available: ctx => ctx.projectId === input.projectId && ctx.baselinesById.has(baseline.id),
        read: (task, ctx) => {
          const snapshot = taskIndex.get(task.id);
          return snapshot ? baselineValue(fieldName, snapshot, task, ctx) : BASELINE_MISSING;
        },
        format: value => value === BASELINE_MISSING ? '—' : formatScalar(value),
        tooltip: (value, _task, ctx) => value === BASELINE_MISSING
          ? ctx.labelForText?.('taskGrid.summary.baselineMissing') ?? null
          : null,
        copy: (task, ctx) => {
          const snapshot = taskIndex.get(task.id);
          return snapshot ? copyScalar(baselineValue(fieldName, snapshot, task, ctx)) : '';
        },
      }));
    }
  }
  return result;
}

/** De acht XER/Primavera-bronvelden van een taak, zonder de afwezige. */
function p6ProvenanceOf(task: Task): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (task.p6ProjectId !== undefined) out.p6ProjectId = task.p6ProjectId;
  if (task.p6TaskId !== undefined) out.p6TaskId = task.p6TaskId;
  if (task.p6ActivityType !== undefined) out.p6ActivityType = task.p6ActivityType;
  if (task.p6DurationType !== undefined) out.p6DurationType = task.p6DurationType;
  if (task.p6CompletePctType !== undefined) out.p6CompletePctType = task.p6CompletePctType;
  if (task.p6ExpectedFinish !== undefined) out.p6ExpectedFinish = task.p6ExpectedFinish;
  if (task.p6ExplicitTargetWindow !== undefined) out.p6ExplicitTargetWindow = task.p6ExplicitTargetWindow;
  if (task.p6SuspendResume !== undefined) out.p6SuspendResume = task.p6SuspendResume;
  return out;
}

/** Bouwt de volledige headless registry. De categorie-sortering is stabiel; binnen een categorie
 * blijft de declaratie/projectvolgorde behouden. Dubbele ids zijn een programmeerfout en stoppen
 * de bouw onmiddellijk in plaats van stil een descriptor te overschrijven. */
export function buildTaskColumnRegistry(input: TaskColumnRegistryInput): TaskColumnDescriptor[] {
  const columns = [
    ...fixedTaskColumns(input),
    ...activityCodeColumns(input),
    ...customFieldColumns(input),
    ...baselineColumns(input),
  ];
  const seen = new Set<TaskColumnId>();
  for (const column of columns) {
    if (seen.has(column.id)) throw new Error(`Dubbele TaskColumnId: ${column.id}`);
    seen.add(column.id);
  }
  return columns
    .map((column, declarationIndex) => ({ column, declarationIndex }))
    .sort((a, b) => TASK_COLUMN_CATEGORY_ORDER.indexOf(a.column.category)
      - TASK_COLUMN_CATEGORY_ORDER.indexOf(b.column.category)
      || a.declarationIndex - b.declarationIndex)
    .map(item => item.column);
}

/** Type-only garantie dat dynamische custom fields uitsluitend de bestaande opgeslagen union
 * produceren. Houdt de import hierboven betekenisdragend wanneer alle concrete defs runtime zijn. */
const _customFieldValueContract: CustomFieldValue | undefined = undefined;
void _customFieldValueContract;
