// De gedeelde, headless zichtbare-rijen-selector.
// Pijplijn: filter → groepeer → sorteer → flatten(collapse). PUUR: geen React-/store-imports
// (alleen type-only). Tabel én Gantt consumeren exact dezelfde ViewRow[], zodat divergentie
// structureel onmogelijk is.

import type { Task } from '@/types/task';
import type {
  FieldRef, FilterNode, GroupLevel, SortLevel, ViewState,
} from '@/state/slices/types';
import {
  asNum, assignedResources, evaluate, resolveField, resourceNames, resourceTypeRank, resourceTypes,
  type FieldValue, type ViewContext,
} from './filterEval';
import { isLeafTask } from '@/utils/taskHierarchy';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { shownFinish, shownStart } from '@/utils/taskDates';

export type { ViewContext } from './filterEval';

export type ViewRow =
  | {
      kind: 'task'; rowKey: string; task: Task; depth: number; dimmed: boolean;
      /** Issue #868: deze taak is de eerste van een uitgeklapte mijlpalenreeks van `runSize` mijlpalen
       *  (het pijltje om de reeks in te klappen). Ontbreekt bij elke andere rij. */
      runSize?: number;
    }
  /** Issue #868: een ingeklapte mijlpalenreeks, één rij met alle ruitjes. `tasks` in lijstvolgorde;
   *  de eerste is de kop, wiens id in `collapsedTaskIds` staat. */
  | { kind: 'milestones'; rowKey: string; tasks: Task[]; depth: number; dimmed: boolean }
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
  /**
   * Alleen bladtaken waarvoor dit waar is, met hun ouders (issue #997: het tijdvak van de Gantt-afdruk). Werkt
   * vóór groeperen en inklappen, net als het filter, zodat banden, tellingen en reeksen alleen over deze taken
   * gaan. Anders dan bij het filter worden de ouders niet gedimd. Afwezig = geen beperking.
   */
  within?: (task: Task) => boolean;
}

/** Rauwe sleutel voor de "(geen)"-band (taak zonder waarde op dit groepniveau). */
export const NONE_RAWKEY = '\u0000__none__';

/** Pad-gecodeerde bandsleutel: JSON van de rauwe waardes t/m dit niveau. Uniek & escaping-vrij. */
export function encodeBandKey(rawKeys: string[]): string {
  return JSON.stringify(rawKeys);
}

/** Stabiele occurrence-key voor een taak in een gegroepeerd rauw bandpad. */
export function encodeGroupedTaskRowKey(groupPath: readonly string[], taskId: string): string {
  return JSON.stringify({ kind: 'task', groupPath, taskId });
}

/**
 * Pure boommodus: structuur-mutaties (indent/outdent/row-move) zijn alleen dan zinvol.
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

/** Sorteersleutel van één veld. Resourcetype sorteert in de vaste bandvolgorde (arbeid eerst), niet
 *  alfabetisch op het vertaalde label; een taak met meerdere typen telt met haar eerste. */
function sortValue(field: FieldRef, task: Task, ctx: ViewContext): FieldValue {
  if (field.src === 'resourceType') {
    const types = resourceTypes(task, ctx);
    return types.length > 0 ? resourceTypeRank(types[0]) : undefined;
  }
  return resolveField(field, task, ctx);
}

/** Stabiele multi-key sort. `sort: []` ⇒ oorspronkelijke volgorde behouden. Ook gebruikt door het
 *  Rapport-tabblad (#861) voor de taken binnen een resourceband (`layoutReport.ts`). */
export function sortTasks(tasks: Task[], sort: SortLevel[], ctx: ViewContext): Task[] {
  if (sort.length === 0) return tasks;
  return tasks
    .map((t, i) => [t, i] as const)
    .sort(([a, ia], [b, ib]) => {
      for (const lvl of sort) {
        const c = cmpValues(sortValue(lvl.field, a, ctx), sortValue(lvl.field, b, ctx));
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

/**
 * Het bereik van een geneste band. Resource en resourcetype zijn twee kanten van
 * dezelfde toewijzingen: onder de typeband Arbeid hoort alleen de ARBEIDSresource van een taak,
 * niet ook het beton dat op dezelfde taak staat. Zo geeft Resourcetype → Resource dezelfde indeling
 * als het rapport Resourcediagram, en Resource → Resourcetype alleen het type van die resource.
 */
interface BandScope {
  resourceType?: string;
  resourceName?: string;
}

/** De band(en) waarin een taak op dit groepniveau valt. Resource kan er MEERDERE zijn. */
function bucketsForLeaf(field: FieldRef, task: Task, ctx: ViewContext, scope: BandScope): BandBucket[] {
  if (field.src === 'resource') {
    const names = scope.resourceType === undefined
      ? resourceNames(task, ctx)
      : assignedResources(task, ctx).filter(r => r.type === scope.resourceType && r.name).map(r => r.name);
    if (names.length === 0) return [noneBucket(ctx)];
    return names.map(n => ({ rawKey: n, label: n, order: n, isNone: false }));
  }
  if (field.src === 'resourceType') {
    // Net als resource: een taak met resources van twee typen staat onder beide typebanden.
    const types = scope.resourceName === undefined
      ? resourceTypes(task, ctx)
      : resourceTypes(task, ctx).filter(type => assignedResources(task, ctx)
        .some(r => r.type === type && r.name === scope.resourceName));
    if (types.length === 0) return [noneBucket(ctx)];
    return types.map(type => ({
      rawKey: type, label: ctx.resourceTypeLabels?.[type] ?? type, order: resourceTypeRank(type), isNone: false,
    }));
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
  leaves: Task[], level: GroupLevel, ctx: ViewContext, scope: BandScope,
): { rawKey: string; label: string; leaves: Task[]; isNone: boolean }[] {
  const real = new Map<string, { label: string; order: FieldValue; leaves: Task[] }>();
  let none: { label: string; leaves: Task[] } | null = null;
  for (const leaf of leaves) {
    for (const b of bucketsForLeaf(level.field, leaf, ctx, scope)) {
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

// --- Mijlpalenreeksen (issue #868) ---

/** Mag deze taak in een reeks: een nulduurmijlpaal zonder kinderen. */
function isRunMilestone(task: Task): boolean {
  return isZeroDurationMilestone(task) && isLeafTask(task);
}

/**
 * Deelt een rij broers (in lijstvolgorde) op in losse taken en reeksen: twee of meer
 * nulduurmijlpalen direct achter elkaar. Al het andere breekt een reeks.
 */
function splitIntoRuns(siblings: readonly Task[]): (Task | Task[])[] {
  const out: (Task | Task[])[] = [];
  let run: Task[] = [];
  const flush = () => {
    if (run.length >= 2) out.push(run);
    else out.push(...run);
    run = [];
  };
  for (const task of siblings) {
    if (isRunMilestone(task)) run.push(task);
    else { flush(); out.push(task); }
  }
  flush();
  return out;
}

/** De kinderen van `task` in lijstvolgorde (onbekende ids vallen weg). */
function childrenOf(task: Task, byId: ReadonlyMap<string, Task>): Task[] {
  return task.childIds.map(id => byId.get(id)).filter((t): t is Task => !!t);
}

/** Ids van de eerste mijlpaal van elke reeks in de boom: wat "alles inklappen" ook inklapt. */
export function milestoneRunHeads(tasks: readonly Task[]): string[] {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const heads: string[] = [];
  const visit = (siblings: readonly Task[]) => {
    for (const part of splitIntoRuns(siblings)) if (Array.isArray(part)) heads.push(part[0].id);
  };
  visit(tasks.filter(t => !t.parentId));
  for (const task of tasks) if (task.childIds.length > 0) visit(childrenOf(task, byId));
  return heads;
}

/** De kop van de reeks waar `taskId` in zit, of `null` als die taak niet in een reeks staat. */
export function milestoneRunHeadOf(tasks: readonly Task[], taskId: string): string | null {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const task = byId.get(taskId);
  if (!task || !isRunMilestone(task)) return null;
  const parent = task.parentId ? byId.get(task.parentId) : undefined;
  const siblings = parent ? childrenOf(parent, byId) : tasks.filter(t => !t.parentId);
  for (const part of splitIntoRuns(siblings)) {
    if (Array.isArray(part) && part.some(t => t.id === taskId)) return part[0].id;
  }
  return null;
}

// --- De pijplijn ---

/**
 * De bladtaken waarvoor `keep` waar is, met hun ouderketen: id → `true` voor een ouder die alleen als ouder
 * meekomt, `false` voor een blad. Stap 1 van `computeViewRows`; de Gantt-afdruk gebruikt hem ook voor het tijdvak
 * bij *Alle taken* (#997).
 */
export function leavesWithAncestors(
  tasks: readonly Task[],
  keep: (leaf: Task) => boolean,
  byId: ReadonlyMap<string, Task> = new Map(tasks.map(t => [t.id, t])),
): Map<string, boolean> {
  const selected = new Map<string, boolean>();
  for (const leaf of tasks) {
    if (!isLeafTask(leaf) || !keep(leaf)) continue;
    selected.set(leaf.id, false);
    // Stoppen bij de eerste al gekozen ouder: die kreeg zijn hele keten al eerder mee. Dat is
    // ook de cyclusbewaking (zoals `ancestorIds` in utils/wbs, maar zonder per blad een generator
    // en Set — dit draait na elke mutatie): een `parentId`-kring liep hier anders eindeloos rond.
    for (let p = leaf.parentId; p && !selected.has(p); p = byId.get(p)?.parentId ?? null) selected.set(p, true);
  }
  return selected;
}

export function computeViewRows(tasks: Task[], opts: ViewRowOpts, ctx: ViewContext): ViewRow[] {
  const { filter, group, sort, collapsedTaskIds, collapsedGroupKeys, within } = opts;
  const byId = new Map(tasks.map(t => [t.id, t]));

  // Stap 1 — filter: matchende bladeren + hun gedimde ouderketen (P6 "show summaries"). Het tijdvak
  // (`within`) beperkt de bladeren op dezelfde plek; zijn ouders zijn alleen gedimd als er ook een filter is.
  const selected = filter === null && !within ? null : leavesWithAncestors(
    tasks, leaf => (filter === null || evaluate(filter, leaf, ctx)) && (!within || within(leaf)), byId);
  const visible = { has: (id: string) => selected === null || selected.has(id) };
  const dimmed = { get: (id: string) => filter !== null && selected?.get(id) === true };

  // Stap 2 — gegroepeerde modus: platte banden op zichtbare bladeren.
  if (group.length > 0) {
    const rows: ViewRow[] = [];
    const visibleLeaves = tasks.filter(t => isLeafTask(t) && visible.has(t.id));
    const walk = (leaves: Task[], levelIndex: number, path: string[], scope: BandScope) => {
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
      const field = group[levelIndex].field;
      for (const band of partition(leaves, group[levelIndex], ctx, scope)) {
        const key = encodeBandKey([...path, band.rawKey]);
        const collapsed = collapsedGroupKeys.has(key);
        rows.push({
          kind: 'group', rowKey: key, key, label: band.label, count: band.leaves.length,
          depth: levelIndex, levelIndex, collapsed,
        });
        const inner: BandScope = band.isNone ? scope
          : field.src === 'resourceType' ? { ...scope, resourceType: band.rawKey }
            : field.src === 'resource' ? { ...scope, resourceName: band.rawKey }
              : scope;
        if (!collapsed) walk(band.leaves, levelIndex + 1, [...path, band.rawKey], inner);
      }
    };
    walk(visibleLeaves, 0, [], {});
    return rows;
  }

  // Stap 2' — boommodus: behoud de WBS-boom. Ook ingeklapte nakomelingen bezoeken,
  // zodat het wees-vangnet ze niet oppikt. Een expliciete stack bewaart diepte en verborgenheid
  // zonder één JavaScript-aanroep per WBS-niveau.
  // Reeksen alleen in de zuivere boom (#868, punt 9): bij een filter of sortering staan ze uitgeklapt.
  const runs = filter === null && sort.length === 0;
  const rows: ViewRow[] = [];
  const seen = new Set<string>();
  type Item = { task: Task; depth: number; hidden: boolean; runSize?: number } | { run: Task[]; depth: number; hidden: boolean };
  const pushSiblings = (stack: Item[], siblings: Task[], depth: number, hidden: boolean) => {
    const parts = runs ? splitIntoRuns(siblings) : siblings;
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!Array.isArray(part)) { stack.push({ task: part, depth, hidden }); continue; }
      if (collapsedTaskIds.has(part[0].id)) { stack.push({ run: part, depth, hidden }); continue; }
      for (let j = part.length - 1; j >= 0; j--) {
        stack.push({ task: part[j], depth, hidden, ...(j === 0 ? { runSize: part.length } : {}) });
      }
    }
  };
  const emit = (stack: Item[]) => {
    while (stack.length > 0) {
      const item = stack.pop()!;
      if ('run' in item) {
        for (const t of item.run) seen.add(t.id);
        // Een reeks houdt haar sleutel (en dus haar inklapstand) als de eerste mijlpaal buiten het tijdvak valt.
        const shown = within ? item.run.filter(t => visible.has(t.id)) : item.run;
        if (!item.hidden && shown.length > 0) {
          rows.push({ kind: 'milestones', rowKey: `milestones:${item.run[0].id}`, tasks: shown, depth: item.depth, dimmed: false });
        }
        continue;
      }
      const { task, depth, hidden } = item;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      if (!hidden && visible.has(task.id)) {
        rows.push({
          kind: 'task', rowKey: task.id, task, depth, dimmed: dimmed.get(task.id),
          ...(item.runSize ? { runSize: item.runSize } : {}),
        });
      }
      const hideChildren = hidden || collapsedTaskIds.has(task.id);
      pushSiblings(stack, sortTasks(childrenOf(task, byId), sort, ctx), depth + 1, hideChildren);
    }
  };
  // Eén stapel voor alle wortels, zodat ook een reeks bovenaan (broers zonder ouder) herkend wordt.
  const rootStack: Item[] = [];
  pushSiblings(rootStack, sortTasks(tasks.filter(t => !t.parentId), sort, ctx), 0, false);
  emit(rootStack);
  // Wees-vangnet: taken met een onbekende ouder alsnog tonen.
  for (const t of tasks) {
    if (!seen.has(t.id) && visible.has(t.id)) {
      rows.push({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: dimmed.get(t.id) });
    }
  }
  return rows;
}

/**
 * Alle bandsleutels van de huidige groepering — óók die van banden die op dit moment ingeklapt
 * zijn. Voor "alle groepen inklappen".
 *
 * Bewust NIET afgeleid uit de bestaande `viewRows`: `walk()` hierboven daalt niet af in een
 * ingeklapte band, dus zodra er ook maar één band dicht staat ontbreken de sleutels van al zijn
 * subbanden in `viewRows`. "Alles inklappen" zou dan precies de takken overslaan die de gebruiker
 * al eerder had dichtgeklapt — en na één keer uitklappen zouden die weer open staan. Daarom draaien we
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
 * taskId → eerste rij-index in `viewRows`: bij multi-band-duplicaten wint de laagste index,
 * zodat de pijl-renderer één keer verbindt i.p.v. pijl-spaghetti.
 */
export function firstRowIndexByTask(rows: ViewRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, i) => {
    if (row.kind === 'task' && !map.has(row.task.id)) map.set(row.task.id, i);
    // Een ingeklapte reeks: al haar mijlpalen staan op deze ene rij (#868).
    if (row.kind === 'milestones') for (const t of row.tasks) if (!map.has(t.id)) map.set(t.id, i);
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

/** De datum waarop het ruitje van een mijlpaal in een ingeklapte reeks staat (#868), dezelfde kant
 *  als `milestoneAnchorX`. */
export function milestoneAnchorDate(task: Task): string {
  return shownStart(task) || shownFinish(task) || '';
}

/** De leden van een ingeklapte mijlpalenreeks zoals ze getekend staan: van links naar rechts.
 *  Stabiel, dus gelijke momenten houden de volgorde van de reeks (review #1004, ronde 11). */
export function milestonesInDrawnOrder(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const left = milestoneAnchorDate(a);
    const right = milestoneAnchorDate(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

/** Geordende domeinselectie uit occurrences; een taak-id komt hoogstens één keer terug. */
export function uniqueTaskIds(rows: readonly ViewRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'task') ids.add(row.task.id);
    else if (row.kind === 'milestones') for (const t of row.tasks) ids.add(t.id);
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
