// Filter-evaluator + gedeelde veld-resolver (fase 2.7 weergaven, §6).
// PUUR & HEADLESS: geen React-, geen store-imports (alleen type-only imports, compile-time erased),
// zodat de tests deze functies rechtstreeks kunnen aanroepen (§14.1).

import type { Task } from '@/types/task';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { FieldRef, FilterNode, FilterOperator } from '@/state/slices/types';

/** Gedeelde context voor filter/groep/sort/kolom-resolutie (§4.1). */
export interface ViewContext {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  /** = t('structure.none') — de bestaande i18n-key, hergebruikt (§4.1). */
  noneLabel: string;
}

/** Ruwe, vergelijkbare veldwaarde (filter/sort). `resource` levert een array van namen. */
export type FieldValue = string | number | boolean | string[] | undefined;

/** Namen van de aan de taak toegewezen resources (join via assignments, §5.3). */
export function resourceNames(task: Task, ctx: ViewContext): string[] {
  return ctx.assignments
    .filter(a => a.taskId === task.id)
    .map(a => ctx.resources.find(r => r.id === a.resourceId)?.name)
    .filter((n): n is string => !!n);
}

/** Komma-gescheiden resource-namen voor de resource-kolom (§5.3). */
export function resourceCellValue(task: Task, ctx: ViewContext): string {
  return resourceNames(task, ctx).join(', ');
}

/**
 * De gedeelde resolver (ook door groep/sort gebruikt, §6.2). Kiest per builtin-key het JUISTE pad:
 * totalFloat/isCritical/completion staan onder `task.time`, NIET direct op `Task`. Onbekende
 * refs (layout uit een ander document) → `undefined`, nooit een throw (§8.4).
 */
export function resolveField(field: FieldRef, task: Task, ctx: ViewContext): FieldValue {
  switch (field.src) {
    case 'builtin':
      switch (field.key) {
        case 'name': return task.name;
        case 'wbsCode': return task.wbsCode;
        case 'duration': return task.time.scheduleDuration;
        case 'start': return task.time.earlyStart || task.time.scheduleStart;
        case 'finish': return task.time.earlyFinish || task.time.scheduleFinish;
        case 'totalFloat': return task.time.totalFloat;
        case 'isCritical': return task.time.isCritical;
        case 'completion': return task.time.completion;
        case 'taskType': return task.taskType;
        case 'isMilestone': return task.isMilestone;
        // Fase 2.9 (§3.5): additieve analyse-velden. freeFloat is altijd aanwezig; de andere drie
        // zijn optioneel (undefined tot de bijbehorende analyse-golf draait) — undefined-tolerant.
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
  }
}

/** Stringrepresentatie voor substring-/gelijkheids-vergelijkingen. Arrays → kommalijst. */
function strOf(v: FieldValue): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** Numerieke waarde als beide zijden als getal te lezen zijn, anders undefined. */
function asNum(v: unknown): number | undefined {
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

/** Vergelijk twee waarden numeriek (indien mogelijk) of lexicografisch (ISO-datums werken zo). */
function cmp(v: FieldValue, value: unknown): number {
  const na = asNum(v), nb = asNum(value);
  if (na !== undefined && nb !== undefined) return na - nb;
  const sa = strOf(v), sb = strOf(value as FieldValue);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Past één operator toe (§6.2). Undefined-tolerant: geen throw, ontbrekende waarde matcht niet. */
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

/**
 * Evalueer een filterknoop op één taak (§6.2). Een lege groep matcht alles (neutraal element).
 */
export function evaluate(node: FilterNode, task: Task, ctx: ViewContext): boolean {
  if (node.kind === 'group') {
    if (node.children.length === 0) return true; // lege groep = neutraal (matcht)
    return node.op === 'AND'
      ? node.children.every(c => evaluate(c, task, ctx))
      : node.children.some(c => evaluate(c, task, ctx));
  }
  const v = resolveField(node.field, task, ctx);
  return applyOperator(node.operator, v, node.value, node.value2);
}
