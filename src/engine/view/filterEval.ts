import type { Task } from '@/types/task';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import { groupBy } from '@/utils/collections';
import type { FieldRef, FilterNode, FilterOperator } from '@/types/view';
import { shownStart, shownFinish, shownSpanOverlapsDays } from '@/utils/taskDates';

export interface ViewContext {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  noneLabel: string;
  resourceTypeLabels?: Partial<Record<ResourceType, string>>;
}

export type FieldValue = string | number | boolean | string[] | undefined;

interface ViewIndexes {
  assignmentsByTask: Map<string, ResourceAssignment[]>;
  resourceById: Map<string, Resource>;
}
const indexCache = new WeakMap<ViewContext, ViewIndexes>();

function indexesFor(ctx: ViewContext): ViewIndexes {
  const hit = indexCache.get(ctx);
  if (hit) return hit;
  const assignmentsByTask = groupBy(ctx.assignments, a => a.taskId);
  const resourceById = new Map<string, Resource>();
  for (const r of ctx.resources) if (!resourceById.has(r.id)) resourceById.set(r.id, r);
  const built = { assignmentsByTask, resourceById };
  indexCache.set(ctx, built);
  return built;
}

export function resourceNames(task: Task, ctx: ViewContext): string[] {
  const { assignmentsByTask, resourceById } = indexesFor(ctx);
  const mine = assignmentsByTask.get(task.id);
  if (!mine) return [];
  const out: string[] = [];
  for (const a of mine) {
    const name = resourceById.get(a.resourceId)?.name;
    if (name) out.push(name);
  }
  return out;
}

export const RESOURCE_TYPE_BAND_ORDER: readonly ResourceType[] = ['LABOR', 'CREW', 'SUBCONTRACTOR', 'EQUIPMENT', 'MATERIAL', 'COST'];

export function resourceTypeRank(type: ResourceType): number {
  const i = RESOURCE_TYPE_BAND_ORDER.indexOf(type);
  return i < 0 ? RESOURCE_TYPE_BAND_ORDER.length : i;
}

export function assignedResources(task: Task, ctx: ViewContext): Resource[] {
  const { assignmentsByTask, resourceById } = indexesFor(ctx);
  const out: Resource[] = [];
  for (const a of assignmentsByTask.get(task.id) ?? []) {
    const resource = resourceById.get(a.resourceId);
    if (resource) out.push(resource);
  }
  return out;
}

export function resourceTypes(task: Task, ctx: ViewContext): ResourceType[] {
  const { assignmentsByTask, resourceById } = indexesFor(ctx);
  const mine = assignmentsByTask.get(task.id);
  if (!mine) return [];
  const types = new Set<ResourceType>();
  for (const a of mine) {
    const type = resourceById.get(a.resourceId)?.type;
    if (type) types.add(type);
  }
  return [...types].sort((a, b) => resourceTypeRank(a) - resourceTypeRank(b));
}

export function resourceCellValue(task: Task, ctx: ViewContext): string {
  return resourceNames(task, ctx).join(', ');
}

export function resolveField(field: FieldRef, task: Task, ctx: ViewContext): FieldValue {
  switch (field.src) {
    case 'builtin':
      switch (field.key) {
        case 'name': return task.name;
        case 'wbsCode': return task.wbsCode;
        case 'duration': return task.time.scheduleDuration;
        case 'start': return shownStart(task);
        case 'finish': return shownFinish(task);
        case 'totalFloat': return task.time.totalFloat;
        case 'isCritical': return task.time.isCritical;
        case 'completion': return task.time.completion;
        case 'taskType': return task.taskType;
        case 'isMilestone': return task.isMilestone;
        case 'freeFloat': return task.time.freeFloat;
        case 'interferingFloat': return task.time.interferingFloat;
        case 'isNearCritical': return task.time.isNearCritical;
        case 'floatPath': return task.time.floatPath;
      }
      return undefined;
    case 'activityCode':
      return task.activityCodes?.[field.typeId];
    case 'customField':
      return task.customFields?.[field.defId];
    case 'resource':
      return resourceNames(task, ctx);
    case 'resourceType':
      return resourceTypes(task, ctx).map(type => ctx.resourceTypeLabels?.[type] ?? type);
  }
}

function strOf(v: FieldValue): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export function asNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return undefined;
}

function looseEq(v: FieldValue, value: unknown): boolean {
  if (typeof v === 'boolean' || typeof value === 'boolean') {
    return String(v) === String(value);
  }
  const na = asNum(v), nb = asNum(value);
  if (na !== undefined && nb !== undefined) return na === nb;
  return strOf(v) === strOf(value as FieldValue);
}

function cmp(v: FieldValue, value: unknown): number {
  const na = asNum(v), nb = asNum(value);
  if (na !== undefined && nb !== undefined) return na - nb;
  const sa = strOf(v), sb = strOf(value as FieldValue);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function applyOperator(
  operator: FilterOperator,
  v: FieldValue,
  value?: string | number | boolean | string[],
  value2?: string | number,
): boolean {
  switch (operator) {
    case 'isEmpty':
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    case 'eq':
      return looseEq(v, value);
    case 'neq':
      return !looseEq(v, value);
    case 'lt':
      return v !== undefined && cmp(v, value) < 0;
    case 'lte':
      return v !== undefined && cmp(v, value) <= 0;
    case 'gt':
      return v !== undefined && cmp(v, value) > 0;
    case 'gte':
      return v !== undefined && cmp(v, value) >= 0;
    case 'contains':
      return strOf(v).toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'startsWith':
      return strOf(v).toLowerCase().startsWith(String(value ?? '').toLowerCase());
    case 'between':
      return v !== undefined && cmp(v, value) >= 0 && cmp(v, value2) <= 0;
    case 'in': {
      const set = Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)];
      if (Array.isArray(v)) return v.some(x => set.includes(String(x)));
      return v !== undefined && set.includes(String(v));
    }
  }
}

function evaluateActiveDuring(task: Task, value?: string | number | boolean | string[], value2?: string | number): boolean {
  if (typeof value !== 'string' || typeof value2 !== 'string') return false;
  if (!shownStart(task) || !shownFinish(task)) return false;
  return shownSpanOverlapsDays(task, value, value2);
}

export function evaluate(node: FilterNode, task: Task, ctx: ViewContext): boolean {
  if (node.kind === 'group') {
    if (node.children.length === 0) return true;
    return node.op === 'AND'
      ? node.children.every(c => evaluate(c, task, ctx))
      : node.children.some(c => evaluate(c, task, ctx));
  }
  if (node.field.src === 'builtin' && node.field.key === 'activeDuring') {
    return evaluateActiveDuring(task, node.value, node.value2);
  }
  const v = resolveField(node.field, task, ctx);
  if (node.field.src === 'builtin' && (node.field.key === 'start' || node.field.key === 'finish')
    && typeof v === 'string' && typeof node.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(node.value)
    && (node.value2 === undefined || (typeof node.value2 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(node.value2)))) {
    return applyOperator(node.operator, v.slice(0, 10), node.value, node.value2);
  }
  return applyOperator(node.operator, v, node.value, node.value2);
}
