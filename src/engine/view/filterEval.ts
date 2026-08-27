// Filter-evaluator + gedeelde veld-resolver (fase 2.7 weergaven, §6).
// PUUR & HEADLESS: geen React-, geen store-imports (alleen type-only imports, compile-time erased),
// zodat de tests deze functies rechtstreeks kunnen aanroepen (§14.1).

import type { Task } from '@/types/task';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { FieldRef, FilterNode, FilterOperator } from '@/types/view';

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

/**
 * Indexen op een `ViewContext`, lui gebouwd en gecachet op de context-INSTANTIE (K-item 36).
 *
 * Waarom een WeakMap en geen extra velden op `ViewContext`: de context wordt op drie plekken
 * opgebouwd (`viewSlice.buildViewInput`, `TableEditor`, de benchmark-runner) en die zouden alle
 * drie de indexen moeten vullen — precies het soort met-de-hand-bijhouden dat elders in dit
 * traject is opgeruimd. De cache is veilig omdat élke bouwplek een VERS objectliteraal maakt
 * (viewSlice per recompute, TableEditor via een `useMemo` op de array-identiteiten) en Immer bij
 * elke wijziging nieuwe arrays teruggeeft: een gewijzigde `assignments` betekent dus altijd een
 * nieuwe context en daarmee een nieuwe index. Een WeakMap laat de oude bovendien vanzelf vallen.
 */
interface ViewIndexes {
  assignmentsByTask: Map<string, ResourceAssignment[]>;
  resourceById: Map<string, Resource>;
}
const indexCache = new WeakMap<ViewContext, ViewIndexes>();

function indexesFor(ctx: ViewContext): ViewIndexes {
  const hit = indexCache.get(ctx);
  if (hit) return hit;
  const assignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of ctx.assignments) {
    const list = assignmentsByTask.get(a.taskId);
    if (list) list.push(a);
    else assignmentsByTask.set(a.taskId, [a]);
  }
  const resourceById = new Map<string, Resource>();
  // `!has` en niet kaal `set`: `Map.set` houdt bij een dubbele id de LAATSTE, terwijl de
  // `find()` die dit verving de EERSTE koos. Onbereikbaar met de huidige id-generatie, maar deze
  // wijziging hoort een pure prestatiewijziging te zijn en dan mag ook een onbereikbaar
  // semantisch verschil er niet in sluipen.
  for (const r of ctx.resources) if (!resourceById.has(r.id)) resourceById.set(r.id, r);
  const built = { assignmentsByTask, resourceById };
  indexCache.set(ctx, built);
  return built;
}

/**
 * Namen van de aan de taak toegewezen resources (join via assignments, §5.3).
 *
 * Draaide hiervóór twee volledige scans PER TAAK — `assignments.filter(...)` plus een
 * `resources.find(...)` per treffer — terwijl `visibleRows` deze functie voor élke taak aanroept.
 * Dat is O(taken × toewijzingen × resources) op het pad dat na iedere mutatie opnieuw loopt
 * (`recomputeViewRows`). Met de index erboven is het O(toewijzingen van deze taak).
 */
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
 * "Actief tussen"-synthetisch filterveld (issue-discussie #32): een taak is actief in [van, tot]
 * wanneer haar eigen interval [start, finish] dát overlapt — de klassieke interval-overlaptest
 * (start ≤ tot ÉN finish ≥ van). Dit past niet in de generieke resolver: die levert per veld één
 * scalar die de operator tegen `value`/`value2` legt, terwijl deze check start ÉN finish
 * tegelijk nodig heeft. Vandaar de special-case hier in plaats van een uitbreiding van
 * `resolveField`/`applyOperator`. ISO-datums vergelijken lexicografisch correct (zie `cmp`).
 */
function evaluateActiveDuring(task: Task, value?: string | number | boolean | string[], value2?: string | number): boolean {
  if (typeof value !== 'string' || typeof value2 !== 'string') return false;
  const start = task.time.earlyStart || task.time.scheduleStart;
  const finish = task.time.earlyFinish || task.time.scheduleFinish;
  if (!start || !finish) return false;
  return start <= value2 && finish >= value;
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
  if (node.field.src === 'builtin' && node.field.key === 'activeDuring') {
    return evaluateActiveDuring(task, node.value, node.value2);
  }
  const v = resolveField(node.field, task, ctx);
  return applyOperator(node.operator, v, node.value, node.value2);
}
