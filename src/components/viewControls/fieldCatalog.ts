import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Resource } from '@/types/resource';
import type { BuiltinFieldKey, FieldRef, FilterOperator } from '@/state/slices/types';
import type { FilterNode } from '@/types/view';

export interface FieldCatalogCtx {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resources: Resource[];
  builtinLabels: Record<BuiltinFieldKey, string>;
  taskTypeLabels: Record<string, string>;
  resourceLabel: string;
  resourceTypeLabel?: string;
  activityCodeSuffix: string;
  customFieldSuffix: string;
}

export const FILTER_SORT_BUILTIN_KEYS: BuiltinFieldKey[] = [
  'wbsCode', 'name', 'duration', 'start', 'finish',
  'taskType', 'isCritical', 'totalFloat', 'completion', 'isMilestone',
  'freeFloat', 'interferingFloat', 'isNearCritical', 'floatPath',
];

export const GROUP_BUILTIN_KEYS: BuiltinFieldKey[] = ['wbsCode', 'taskType'];

export const FILTER_ONLY_BUILTIN_KEYS: BuiltinFieldKey[] = ['activeDuring'];

function fieldKey(field: FieldRef): string {
  switch (field.src) {
    case 'builtin': return `builtin:${field.key}`;
    case 'activityCode': return `activityCode:${field.typeId}`;
    case 'customField': return `customField:${field.defId}`;
    case 'resource': return 'resource';
    case 'resourceType': return 'resourceType';
  }
}

export function fieldsEqual(a: FieldRef, b: FieldRef): boolean {
  return fieldKey(a) === fieldKey(b);
}

export function fullFieldList(ctx: FieldCatalogCtx): FieldRef[] {
  return [
    ...FILTER_SORT_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
    ...ctx.activityCodeTypes.map((t): FieldRef => ({ src: 'activityCode', typeId: t.id })),
    ...ctx.customFieldDefs.map((d): FieldRef => ({ src: 'customField', defId: d.id })),
    { src: 'resource' },
  ];
}

export function sortFieldList(ctx: FieldCatalogCtx): FieldRef[] {
  return [...fullFieldList(ctx), { src: 'resourceType' }];
}

export function filterFieldList(ctx: FieldCatalogCtx): FieldRef[] {
  return [
    ...fullFieldList(ctx),
    ...FILTER_ONLY_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
  ];
}

export function groupFieldList(
  ctx: {
    activityCodeTypes: ReadonlyArray<ActivityCodeType>;
    customFieldDefs: ReadonlyArray<CustomFieldDef>;
  },
): FieldRef[] {
  return [
    ...GROUP_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
    ...ctx.activityCodeTypes.map((t): FieldRef => ({ src: 'activityCode', typeId: t.id })),
    ...ctx.customFieldDefs.map((d): FieldRef => ({ src: 'customField', defId: d.id })),
    { src: 'resource' },
    { src: 'resourceType' },
  ];
}

export function missingFilterFields(filter: FilterNode | null | undefined, ctx: FieldCatalogCtx): FieldRef[] {
  const known = [...filterFieldList(ctx), ...sortFieldList(ctx)];
  const missing: FieldRef[] = [];
  const visit = (node: FilterNode) => {
    if (node.kind === 'group') { node.children.forEach(visit); return; }
    if (known.some(field => fieldsEqual(field, node.field)) || missing.some(field => fieldsEqual(field, node.field))) return;
    missing.push(node.field);
  };
  if (filter) visit(filter);
  return missing;
}

export function fieldLabel(field: FieldRef, ctx: FieldCatalogCtx): string {
  switch (field.src) {
    case 'builtin': return ctx.builtinLabels[field.key] ?? field.key;
    case 'activityCode': return ctx.activityCodeTypes.find(t => t.id === field.typeId)?.name ?? field.typeId;
    case 'customField': return ctx.customFieldDefs.find(d => d.id === field.defId)?.name ?? field.defId;
    case 'resource': return ctx.resourceLabel;
    case 'resourceType': return ctx.resourceTypeLabel ?? 'resourceType';
  }
}

export function fieldOptions(
  fields: FieldRef[], ctx: FieldCatalogCtx,
): { field: FieldRef; label: string }[] {
  const rawLabels = fields.map(f => fieldLabel(f, ctx));
  const counts = new Map<string, number>();
  for (const label of rawLabels) counts.set(label, (counts.get(label) ?? 0) + 1);

  return fields.map((field, i) => {
    const label = rawLabels[i];
    if ((counts.get(label) ?? 0) <= 1) return { field, label };
    const suffix = field.src === 'activityCode' ? ctx.activityCodeSuffix
      : field.src === 'customField' ? ctx.customFieldSuffix
      : undefined;
    return { field, label: suffix ? `${label} (${suffix})` : label };
  });
}

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'activePeriod';

export function fieldKind(field: FieldRef, ctx: FieldCatalogCtx): FieldKind {
  if (field.src === 'builtin') {
    switch (field.key) {
      case 'name':
      case 'wbsCode':
        return 'text';
      case 'duration':
      case 'totalFloat':
      case 'completion':
      case 'freeFloat':
      case 'interferingFloat':
      case 'floatPath':
        return 'number';
      case 'start':
      case 'finish':
        return 'date';
      case 'isCritical':
      case 'isMilestone':
      case 'isNearCritical':
        return 'boolean';
      case 'taskType':
        return 'select';
      case 'activeDuring':
        return 'activePeriod';
    }
  }
  if (field.src === 'activityCode') return 'select';
  if (field.src === 'customField') {
    const def = ctx.customFieldDefs.find(d => d.id === field.defId);
    switch (def?.type) {
      case 'text': return 'text';
      case 'number':
      case 'integer':
      case 'cost':
        return 'number';
      case 'date': return 'date';
      case 'boolean': return 'boolean';
      default: return 'text';
    }
  }
  return 'multiselect';
}

export function operatorsForKind(kind: FieldKind): FilterOperator[] {
  switch (kind) {
    case 'text': return ['eq', 'neq', 'contains', 'startsWith', 'isEmpty'];
    case 'number':
    case 'date':
      return ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'isEmpty'];
    case 'boolean': return ['eq', 'neq'];
    case 'select': return ['eq', 'neq', 'in', 'isEmpty'];
    case 'multiselect': return ['in', 'isEmpty'];
    case 'activePeriod': return ['between'];
  }
}

export function selectOptions(
  field: FieldRef, ctx: FieldCatalogCtx,
): { value: string; label: string }[] {
  if (field.src === 'activityCode') {
    const type = ctx.activityCodeTypes.find(t => t.id === field.typeId);
    if (!type) return [];
    return type.values.map(v => ({ value: v.id, label: v.description ? `${v.code} — ${v.description}` : v.code }));
  }
  if (field.src === 'builtin' && field.key === 'taskType') {
    return Object.entries(ctx.taskTypeLabels).map(([value, label]) => ({ value, label }));
  }
  if (field.src === 'resource') {
    return ctx.resources.map(r => ({ value: r.name, label: r.name }));
  }
  return [];
}
