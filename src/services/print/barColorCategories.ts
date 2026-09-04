import { fieldsEqual, groupFieldList } from '@/components/viewControls/fieldCatalog';
import { TASK_TYPE_BAR_COLOR_FIELD, type BarColorSelection } from '@/types/barColor';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Task } from '@/types/task';
import type { FieldRef } from '@/types/view';

/** Minimale projectcontext waarmee de gedeelde Group-veldlijst en fallback bepaald worden. */
export interface BarColorFieldContext {
  activityCodeTypes: ReadonlyArray<ActivityCodeType>;
  customFieldDefs: ReadonlyArray<CustomFieldDef>;
}

/** Projectdata die nodig is om de gekozen categorie ook per taak op te lossen. */
export interface BarColorContext extends BarColorFieldContext {
  resources: ReadonlyArray<Resource>;
  assignments: ReadonlyArray<ResourceAssignment>;
  taskTypeLabels?: Readonly<Record<string, string>>;
  noneLabel: string;
}

/** Een opgeloste categoriewaarde. Alleen Resource kan er meer dan een per taak opleveren. */
export interface BarCategoryValue {
  key: string;
  label: string;
  color?: string;
  weight: number;
  isNone: boolean;
}

export interface EffectiveBarColorSelection {
  effective: BarColorSelection;
  /** De bewaarde keuze die in dit project niet bestaat; de globale keuze zelf blijft intact. */
  missingField?: FieldRef;
}

function fieldIdentity(field: FieldRef): string {
  switch (field.src) {
    case 'builtin': return `builtin:${field.key}`;
    case 'activityCode': return `activityCode:${field.typeId}`;
    case 'customField': return `customField:${field.defId}`;
    case 'resource': return 'resource';
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

/** De toegestane categorievelden komen bewust rechtstreeks uit de Group-catalogus. */
export function isBarColorFieldAvailable(field: FieldRef, ctx: BarColorFieldContext): boolean {
  return groupFieldList(ctx).some(candidate => fieldsEqual(candidate, field));
}

/**
 * Een verdwenen projectgebonden keuze wordt alleen effectief Task Type. De oorspronkelijke
 * selectie wordt niet gewijzigd; de UI kan via `missingField` uitleggen waarom een fallback geldt.
 */
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

/** Lost één Group-veld op tot een stabiele sleutel, gebruikerslabel en eventuele expliciete kleur. */
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
  const value = String(rawValue);
  return [{
    key: value,
    label: field.key === 'taskType' ? (ctx.taskTypeLabels?.[value] ?? value) : value,
    weight: 1,
    isNone: false,
  }];
}

/** Unieke waarden van de daadwerkelijk zichtbare bladtaken, in eerste-weergavevolgorde. */
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
