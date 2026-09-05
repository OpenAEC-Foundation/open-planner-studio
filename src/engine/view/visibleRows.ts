// De gedeelde, headless zichtbare-rijen-selector (fase 2.7 weergaven, KERN §4).
// Pijplijn: filter → groepeer → sorteer → flatten(collapse). PUUR: geen React-/store-imports
// (alleen type-only). Tabel én Gantt consumeren exact dezelfde ViewRow[] (§4.1), zodat divergentie
// structureel onmogelijk is.

import type { Task } from '@/types/task';
import type {
  FieldRef, FilterNode, GroupLevel, SortLevel, ViewState,
} from '@/state/slices/types';
import { evaluate, resolveField, resourceNames, type FieldValue, type ViewContext } from './filterEval';
import { isLeafTask } from '@/utils/taskHierarchy';

export type { ViewContext } from './filterEval';

export type ViewRow =
  | { kind: 'task'; rowKey: string; task: Task; depth: number; dimmed: boolean }
  | {
      kind: 'group';
      rowKey: string;
      key: string;
      label: string;
      count: number;
      depth: number;
      levelIndex: number;
      collapsed: boolean;
    };

export interface ViewRowOpts {
  filter: FilterNode | null;
  group: GroupLevel[];
  sort: SortLevel[];
  collapsedTaskIds: Set<string>;
  collapsedGroupKeys: Set<string>;
}

/** Rauwe sleutel voor de "(geen)"-band (taak zonder waarde op dit groepniveau). */
export const NONE_RAWKEY = '\u0000__none__';

/** Pad-gecodeerde bandsleutel (§7.1): JSON van de rauwe waardes t/m dit niveau. Uniek & escaping-vrij. */
export function encodeBandKey(rawKeys: string[]): string {
  return JSON.stringify(rawKeys);
}

/** Stabiele occurrence-key voor een taak in een gegroepeerd rauw bandpad. */
export function encodeGroupedTaskRowKey(groupPath: readonly string[], taskId: string): string {
  return JSON.stringify({ kind: 'task', groupPath, taskId });
}

/**
 * Pure boommodus (§4.5): structuur-mutaties (indent/outdent/row-move) zijn alleen dan zinvol.
 * Eén gedeelde selector zodat tabel, Gantt én ribbon dezelfde regel afdwingen.
 */
export function isTreeMode(view: Pick<ViewState, 'filter' | 'group' | 'sort'>): boolean {
  return (
    (view.filter ?? null) === null &&
    (view.group?.length ?? 0) === 0 &&
    (view.sort?.length ?? 0) === 0
  );
}

// --- Vergelijken (sort + bandvolgorde) ---

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return undefined;
}

/** Getallen numeriek, datums/strings lexicografisch, undefined/leeg altijd laatst. */
function cmpValues(a: FieldValue, b: FieldValue): number {
  const ea = a === undefined || (Array.isArray(a) && a.length === 0) || a === '';
  const eb = b === undefined || (Array.isArray(b) && b.length === 0) || b === '';
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  const na = asNum(a), nb = asNum(b);
  if (na !== undefined && nb !== undefined) return na - nb;
  const sa = Array.isArray(a) ? a.join(', ') : String(a);
  const sb = Array.isArray(b) ? b.join(', ') : String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Stabiele multi-key sort (§7.2). `sort: []` ⇒ oorspronkelijke volgorde behouden. */
function sortTasks(tasks: Task[], sort: SortLevel[], ctx: ViewContext): Task[] {
  if (sort.length === 0) return tasks;
  return tasks
    .map((t, i) => [t, i] as const)
    .sort(([a, ia], [b, ib]) => {
      for (const lvl of sort) {
        const c = cmpValues(resolveField(lvl.field, a, ctx), resolveField(lvl.field, b, ctx));
        if (c !== 0) return lvl.dir === 'asc' ? c : -c;
      }
      return ia - ib; // stabiliteit: gelijke sleutels behouden invoervolgorde
    })
    .map(([t]) => t);
}

// --- Banden (groeperen) ---

interface BandBucket {
  rawKey: string;
  label: string;
  order: FieldValue; // sorteersleutel voor de bandvolgorde
  isNone: boolean;
}

/** De band(en) waarin een taak op dit groepniveau valt. Resource kan er MEERDERE zijn (§7.1). */
function bucketsForLeaf(field: FieldRef, task: Task, ctx: ViewContext): BandBucket[] {
  if (field.src === 'resource') {
    const names = resourceNames(task, ctx);
    if (names.length === 0) return [noneBucket(ctx)];
    return names.map(n => ({ rawKey: n, label: n, order: n, isNone: false }));
  }
  if (field.src === 'activityCode') {
    const valueId = task.activityCodes?.[field.typeId];
    if (!valueId) return [noneBucket(ctx)];
    const type = ctx.activityCodeTypes.find(t => t.id === field.typeId);
    const idx = type ? type.values.findIndex(v => v.id === valueId) : -1;
    const val = idx >= 0 ? type!.values[idx] : undefined;
    const label = val ? (val.description ? `${val.code} — ${val.description}` : val.code) : valueId;
    // Bandvolgorde volgt de definitievolgorde van het codetype (idx); onbekend achteraan.
    return [{ rawKey: valueId, label, order: idx >= 0 ? idx : Number.MAX_SAFE_INTEGER, isNone: false }];
  }
  // builtin / customField: enkelvoudige waarde
  const v = resolveField(field, task, ctx);
  if (v === undefined || v === null || v === '') return [noneBucket(ctx)];
  const s = String(v);
  return [{ rawKey: s, label: s, order: v, isNone: false }];
}

function noneBucket(ctx: ViewContext): BandBucket {
  return { rawKey: NONE_RAWKEY, label: ctx.noneLabel, order: undefined, isNone: true };
}

/** Partitioneer bladeren in gesorteerde banden op één niveau; "(geen)" altijd achteraan. */
function partition(
  leaves: Task[], level: GroupLevel, ctx: ViewContext,
): { rawKey: string; label: string; leaves: Task[]; isNone: boolean }[] {
  const real = new Map<string, { label: string; order: FieldValue; leaves: Task[] }>();
  let none: { label: string; leaves: Task[] } | null = null;
  for (const leaf of leaves) {
    for (const b of bucketsForLeaf(level.field, leaf, ctx)) {
      if (b.isNone) {
        if (!none) none = { label: b.label, leaves: [] };
        none.leaves.push(leaf);
      } else {
        let e = real.get(b.rawKey);
        if (!e) { e = { label: b.label, order: b.order, leaves: [] }; real.set(b.rawKey, e); }
        e.leaves.push(leaf);
      }
    }
  }
  const arr = [...real.entries()].map(([rawKey, e]) => ({ rawKey, ...e }));
  arr.sort((a, b) => cmpValues(a.order, b.order));
  if (level.dir === 'desc') arr.reverse();
  const out = arr.map(({ rawKey, label, leaves: ls }) => ({ rawKey, label, leaves: ls, isNone: false }));
  if (none) out.push({ rawKey: NONE_RAWKEY, label: none.label, leaves: none.leaves, isNone: true });
  return out;
}

// --- De pijplijn ---

export function computeViewRows(tasks: Task[], opts: ViewRowOpts, ctx: ViewContext): ViewRow[] {
  const { filter, group, sort, collapsedTaskIds, collapsedGroupKeys } = opts;
  const byId = new Map(tasks.map(t => [t.id, t]));

  // Stap 1 — filter (§4.2/§6): matchende bladeren + hun gedimde ouderketen (P6 "show summaries").
  const visible = new Set<string>();
  const dimmed = new Map<string, boolean>();
  if (filter === null) {
    for (const t of tasks) { visible.add(t.id); dimmed.set(t.id, false); }
  } else {
    for (const leaf of tasks) {
      if (!isLeafTask(leaf)) continue;
      if (!evaluate(filter, leaf, ctx)) continue;
      visible.add(leaf.id);
      dimmed.set(leaf.id, false);
      let p = leaf.parentId;
      while (p) {
        if (!visible.has(p)) { visible.add(p); dimmed.set(p, true); }
        p = byId.get(p)?.parentId ?? null;
      }
    }
  }

  // Stap 2 — gegroepeerde modus (§4.2/§7): platte banden op zichtbare bladeren.
  if (group.length > 0) {
    const rows: ViewRow[] = [];
    const visibleLeaves = tasks.filter(t => isLeafTask(t) && visible.has(t.id));
    const walk = (leaves: Task[], levelIndex: number, path: string[]) => {
      if (levelIndex >= group.length) {
        for (const leaf of sortTasks(leaves, sort, ctx)) {
          rows.push({
            kind: 'task',
            rowKey: encodeGroupedTaskRowKey(path, leaf.id),
            task: leaf,
            depth: group.length,
            dimmed: false,
          });
        }
        return;
      }
      for (const band of partition(leaves, group[levelIndex], ctx)) {
        const key = encodeBandKey([...path, band.rawKey]);
        const collapsed = collapsedGroupKeys.has(key);
        rows.push({
          kind: 'group', rowKey: key, key, label: band.label, count: band.leaves.length,
          depth: levelIndex, levelIndex, collapsed,
        });
        if (!collapsed) walk(band.leaves, levelIndex + 1, [...path, band.rawKey]);
      }
    };
    walk(visibleLeaves, 0, []);
    return rows;
  }

  // Stap 2' — boommodus (§4.2 stap 2, else-tak): behoud de WBS-boom. Ingeklapte nakomelingen tellen
  // als "gezien" (recursie gaat door, maar emit niet), zodat het wees-vangnet ze niet oppikt — exact
  // het `hidden`-vlag-patroon van de bestaande flatTasks (TableEditor.tsx:73-90).
  const rows: ViewRow[] = [];
  const seen = new Set<string>();
  const emit = (task: Task, depth: number, hidden: boolean) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    if (!hidden && visible.has(task.id)) {
      rows.push({ kind: 'task', rowKey: task.id, task, depth, dimmed: dimmed.get(task.id) ?? false });
    }
    const hideChildren = hidden || collapsedTaskIds.has(task.id);
    const kids = task.childIds.map(id => byId.get(id)).filter((t): t is Task => !!t);
    for (const k of sortTasks(kids, sort, ctx)) emit(k, depth + 1, hideChildren);
  };
  const roots = tasks.filter(t => !t.parentId);
  for (const r of sortTasks(roots, sort, ctx)) emit(r, 0, false);
  // Wees-vangnet (§4.2): taken met een onbekende ouder alsnog tonen.
  for (const t of tasks) {
    if (!seen.has(t.id) && visible.has(t.id)) {
      rows.push({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: dimmed.get(t.id) ?? false });
    }
  }
  return rows;
}

/**
 * Alle bandsleutels van de huidige groepering — óók die van banden die op dit moment ingeklapt
 * zijn. Voor "alle groepen inklappen" (issue #35).
 *
 * Bewust NIET afgeleid uit de bestaande `viewRows`: `walk()` hierboven daalt niet af in een
 * ingeklapte band, dus zodra er ook maar één band dicht staat ontbreken de sleutels van al zijn
 * subbanden in `viewRows`. "Alles inklappen" zou dan precies de takken overslaan die de gebruiker
 * al eerder had dichtgeklapt — en na één keer uitklappen stonden die weer open. Daarom draaien we
 * de pijplijn hier één keer met een LEGE collapse-set: dan emit elk niveau al zijn banden.
 * Zonder groepering zijn er per definitie geen banden ⇒ lege lijst.
 */
export function allBandKeys(tasks: Task[], opts: ViewRowOpts, ctx: ViewContext): string[] {
  if (opts.group.length === 0) return [];
  const keys: string[] = [];
  for (const row of computeViewRows(tasks, { ...opts, collapsedGroupKeys: new Set() }, ctx)) {
    if (row.kind === 'group') keys.push(row.key);
  }
  return keys;
}

/**
 * taskId → eerste rij-index in `viewRows` (§7.1): bij multi-band-duplicaten wint de laagste index,
 * zodat de pijl-renderer één keer verbindt i.p.v. pijl-spaghetti.
 */
export function firstRowIndexByTask(rows: ViewRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, i) => {
    if (row.kind === 'task' && !map.has(row.task.id)) map.set(row.task.id, i);
  });
  return map;
}

export type TaskViewRow = Extract<ViewRow, { kind: 'task' }>;

/** Het deterministische eerste zichtbare voorkomen van een domeintaak. */
export function firstTaskOccurrence(
  rows: readonly ViewRow[],
  taskId: string,
): { rowKey: string; rowIndex: number; row: TaskViewRow } | null {
  const rowIndex = rows.findIndex(row => row.kind === 'task' && row.task.id === taskId);
  if (rowIndex < 0) return null;
  const row = rows[rowIndex] as TaskViewRow;
  return { rowKey: row.rowKey, rowIndex, row };
}

/** Alle taakoccurrences tussen twee zichtbare rowKeys; groepsrijen blijven alleen afstand dragen. */
export function taskRowsInRange(
  rows: readonly ViewRow[],
  fromRowKey: string,
  toRowKey: string,
): TaskViewRow[] {
  const fromIndex = rows.findIndex(row => row.rowKey === fromRowKey);
  const toIndex = rows.findIndex(row => row.rowKey === toRowKey);
  if (fromIndex < 0 || toIndex < 0) return [];
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return rows.slice(start, end + 1).filter((row): row is TaskViewRow => row.kind === 'task');
}

/** Geordende domeinselectie uit occurrences; een taak-id komt hoogstens één keer terug. */
export function uniqueTaskIds(rows: readonly ViewRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'task') ids.add(row.task.id);
  }
  return [...ids];
}

/**
 * Minimale headless rijcursorreconciliatie voor Task 7. De aanroeper bewaart de absolute rijindex
 * van de actieve occurrence. Blijft de rowKey bestaan, dan wint die; anders wint de taakrij met de
 * kleinste absolute indexafstand (bij gelijke afstand de eerdere rij). Zonder taakrij is er geen
 * geldige cel meer en wordt de cursor leeg.
 */
export interface TaskRowCursor {
  rowKey: string;
  rowIndex: number;
  taskId: string;
}

export function normalizeTaskRowCursor(
  rows: readonly ViewRow[],
  cursor: TaskRowCursor | null,
): TaskRowCursor | null {
  if (cursor === null) return null;
  const exactIndex = rows.findIndex(row => row.kind === 'task' && row.rowKey === cursor.rowKey);
  if (exactIndex >= 0) {
    const row = rows[exactIndex] as TaskViewRow;
    return { rowKey: row.rowKey, rowIndex: exactIndex, taskId: row.task.id };
  }

  let nearest: TaskRowCursor | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  rows.forEach((row, rowIndex) => {
    if (row.kind !== 'task') return;
    const distance = Math.abs(rowIndex - cursor.rowIndex);
    if (distance < nearestDistance) {
      nearest = { rowKey: row.rowKey, rowIndex, taskId: row.task.id };
      nearestDistance = distance;
    }
  });
  return nearest;
}
