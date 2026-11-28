import { fieldsEqual, groupFieldList } from '@/components/viewControls/fieldCatalog';
import { TASK_TYPE_BAR_COLOR_FIELD, type BarColorSelection } from '@/types/barColor';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CustomTaskType, Task } from '@/types/task';
import type { FieldRef } from '@/types/view';

export interface BarColorFieldContext {
  activityCodeTypes: ReadonlyArray<ActivityCodeType>;
  customFieldDefs: ReadonlyArray<CustomFieldDef>;
}

export interface BarColorContext extends BarColorFieldContext {
  resources: ReadonlyArray<Resource>;
  assignments: ReadonlyArray<ResourceAssignment>;
  taskTypeLabels?: Readonly<Record<string, string>>;
  customTaskTypes?: ReadonlyArray<CustomTaskType>;
  noneLabel: string;
}

export interface BarCategoryValue {
  key: string;
  label: string;
  color?: string;
  weight: number;
  isNone: boolean;
}

export interface EffectiveBarColorSelection {
  effective: BarColorSelection;
  missingField?: FieldRef;
}

function fieldIdentity(field: FieldRef): string {
  switch (field.src) {
    case 'builtin': return `builtin:${field.key}`;
    case 'activityCode': return `activityCode:${field.typeId}`;
    case 'customField': return `customField:${field.defId}`;
    case 'resource': return 'resource';
    case 'resourceType': return 'resourceType';
  }
}

function noneValue(field: FieldRef, noneLabel: string): BarCategoryValue {
  return {
    key: `${fieldIdentity(field)}:none`,
    label: noneLabel,
    weight: 1,
    isNone: true,
  };
}

export function isBarColorCandidate(field: FieldRef): boolean {
  return field.src !== 'resourceType';
}

export function isBarColorFieldAvailable(field: FieldRef, ctx: BarColorFieldContext): boolean {
  return isBarColorCandidate(field) && groupFieldList(ctx).some(candidate => fieldsEqual(candidate, field));
}

export function effectiveBarColorSelection(
  selection: BarColorSelection,
  ctx: BarColorFieldContext,
): EffectiveBarColorSelection {
  if (selection.mode !== 'category' || isBarColorFieldAvailable(selection.field, ctx)) {
    return { effective: selection };
  }
  return {
    effective: { mode: 'category', field: TASK_TYPE_BAR_COLOR_FIELD },
    missingField: selection.field,
  };
}

function resourceValues(task: Task, ctx: BarColorContext): BarCategoryValue[] {
  const resourcesById = new Map(ctx.resources.map(resource => [resource.id, resource]));
  const values: BarCategoryValue[] = [];
  for (const assignment of ctx.assignments) {
    if (assignment.taskId !== task.id) continue;
    const resource = resourcesById.get(assignment.resourceId);
    if (!resource) continue;
    values.push({
      key: resource.id,
      label: resource.name,
      color: resource.color,
      weight: assignment.unitsPerDay,
      isNone: false,
    });
  }
  return values;
}

export function resolveBarCategoryValues(
  task: Task,
  field: FieldRef,
  ctx: BarColorContext,
): BarCategoryValue[] {
  if (field.src === 'resource') {
    const values = resourceValues(task, ctx);
    return values.length > 0 ? values : [noneValue(field, ctx.noneLabel)];
  }

  if (field.src === 'activityCode') {
    const valueId = task.activityCodes?.[field.typeId];
    if (!valueId) return [noneValue(field, ctx.noneLabel)];
    const type = ctx.activityCodeTypes.find(candidate => candidate.id === field.typeId);
    const value = type?.values.find(candidate => candidate.id === valueId);
    return [{
      key: valueId,
      label: value ? (value.description ? `${value.code} — ${value.description}` : value.code) : valueId,
      color: value?.color,
      weight: 1,
      isNone: false,
    }];
  }

  if (field.src === 'resourceType') return [noneValue(field, ctx.noneLabel)];

  if (field.src === 'customField') {
    const value = task.customFields?.[field.defId];
    if (value === undefined || value === null || value === '') {
      return [noneValue(field, ctx.noneLabel)];
    }
    return [{ key: String(value), label: String(value), weight: 1, isNone: false }];
  }

  const rawValue = field.key === 'wbsCode' ? task.wbsCode : task.taskType;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return [noneValue(field, ctx.noneLabel)];
  }
  const customType = field.key === 'taskType' && rawValue === 'USERDEFINED' && task.customTaskTypeId
    ? ctx.customTaskTypes?.find(candidate => candidate.id === task.customTaskTypeId)
    : undefined;
  if (customType) {
    return [{
      key: `customTaskType:${customType.id}`,
      label: customType.name,
      color: customType.color,
      weight: 1,
      isNone: false,
    }];
  }
  const value = String(rawValue);
  return [{
    key: value,
    label: field.key === 'taskType' ? (ctx.taskTypeLabels?.[value] ?? value) : value,
    weight: 1,
    isNone: false,
  }];
}

export function visibleBarColorCategories(
  tasks: ReadonlyArray<Task>,
  field: FieldRef,
  ctx: BarColorContext,
): BarCategoryValue[] {
  const seen = new Set<string>();
  const categories: BarCategoryValue[] = [];
  for (const task of tasks) {
    if (task.childIds.length > 0) continue;
    for (const value of resolveBarCategoryValues(task, field, ctx)) {
      if (seen.has(value.key)) continue;
      seen.add(value.key);
      categories.push(value);
    }
  }
  return categories;
}
