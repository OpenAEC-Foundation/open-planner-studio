// Gedeelde veld-catalogus voor de Beeld-UI (fase 2.7 golf 3): filter-editor (§6/§13.1),
// groepeer-/sorteer-popovers (§7.4). DRY over de drie UI-stukken die allemaal een lijst van
// beschikbare FieldRefs + labels + (voor filter) waarde-editor-soort nodig hebben. De
// kolommen-dialoog heeft dit NIET nodig — die werkt direct op `ColumnConfig[]`/`defaultColumns()`.
//
// Geen store-/React-afhankelijkheid buiten types; ontvangt i18n-labels en context als argument
// zodat dit bestand testbaar en herbruikbaar blijft.

import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Resource } from '@/types/resource';
import type { BuiltinFieldKey, FieldRef, FilterOperator } from '@/state/slices/types';

export interface FieldCatalogCtx {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resources: Resource[];
  /** Vertaalde builtin-veldlabels, keyed op BuiltinFieldKey (uit task:table.*). */
  builtinLabels: Record<BuiltinFieldKey, string>;
  /** Vertaalde taskType-labels (uit task:taskType.*), voor het taskType-select-veld. */
  taskTypeLabels: Record<string, string>;
  resourceLabel: string; // t('column.resource')
}

/** Alle builtin-velden die in filter/sort zinvol zijn (§6.2 dekt ze allemaal). */
export const FILTER_SORT_BUILTIN_KEYS: BuiltinFieldKey[] = [
  'wbsCode', 'name', 'duration', 'start', 'finish',
  'taskType', 'isCritical', 'totalFloat', 'completion', 'isMilestone',
];

/** Groepeerbare builtin-velden (§7.4): alleen discrete velden, geen continue getallen/datums. */
export const GROUP_BUILTIN_KEYS: BuiltinFieldKey[] = ['wbsCode', 'taskType'];

function fieldKey(field: FieldRef): string {
  switch (field.src) {
    case 'builtin': return `builtin:${field.key}`;
    case 'activityCode': return `activityCode:${field.typeId}`;
    case 'customField': return `customField:${field.defId}`;
    case 'resource': return 'resource';
  }
}

export function fieldsEqual(a: FieldRef, b: FieldRef): boolean {
  return fieldKey(a) === fieldKey(b);
}

/** Volledige veldenlijst voor filter/sort: alle builtins + elke activity-code-type + elk custom field + resource. */
export function fullFieldList(ctx: FieldCatalogCtx): FieldRef[] {
  return [
    ...FILTER_SORT_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
    ...ctx.activityCodeTypes.map((t): FieldRef => ({ src: 'activityCode', typeId: t.id })),
    ...ctx.customFieldDefs.map((d): FieldRef => ({ src: 'customField', defId: d.id })),
    { src: 'resource' },
  ];
}

/** Groepeerbare veldenlijst (§7.4): WBS, taskType, activity codes, custom fields, resource. */
export function groupFieldList(ctx: FieldCatalogCtx): FieldRef[] {
  return [
    ...GROUP_BUILTIN_KEYS.map((key): FieldRef => ({ src: 'builtin', key })),
    ...ctx.activityCodeTypes.map((t): FieldRef => ({ src: 'activityCode', typeId: t.id })),
    ...ctx.customFieldDefs.map((d): FieldRef => ({ src: 'customField', defId: d.id })),
    { src: 'resource' },
  ];
}

export function fieldLabel(field: FieldRef, ctx: FieldCatalogCtx): string {
  switch (field.src) {
    case 'builtin': return ctx.builtinLabels[field.key] ?? field.key;
    case 'activityCode': return ctx.activityCodeTypes.find(t => t.id === field.typeId)?.name ?? field.typeId;
    case 'customField': return ctx.customFieldDefs.find(d => d.id === field.defId)?.name ?? field.defId;
    case 'resource': return ctx.resourceLabel;
  }
}

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

/** Bepaalt welke waarde-editor + operatorenset een veld krijgt in de filter-editor (§13.1). */
export function fieldKind(field: FieldRef, ctx: FieldCatalogCtx): FieldKind {
  if (field.src === 'builtin') {
    switch (field.key) {
      case 'name':
      case 'wbsCode':
        return 'text';
      case 'duration':
      case 'totalFloat':
      case 'completion':
        return 'number';
      case 'start':
      case 'finish':
        return 'date';
      case 'isCritical':
      case 'isMilestone':
        return 'boolean';
      case 'taskType':
        return 'select';
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
  // resource
  return 'multiselect';
}

/** Toegestane operatoren per veldsoort (§6.2). */
export function operatorsForKind(kind: FieldKind): FilterOperator[] {
  switch (kind) {
    case 'text': return ['eq', 'neq', 'contains', 'startsWith', 'isEmpty'];
    case 'number':
    case 'date':
      return ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'isEmpty'];
    case 'boolean': return ['eq', 'neq'];
    case 'select': return ['eq', 'neq', 'in', 'isEmpty'];
    case 'multiselect': return ['in', 'isEmpty'];
  }
}

/** Selecteerbare opties voor select/multiselect-velden (codes, taskType, resources). */
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
