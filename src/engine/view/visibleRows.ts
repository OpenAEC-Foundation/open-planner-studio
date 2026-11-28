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
      runSize?: number;
    }
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
  within?: (task: Task) => boolean;
}

export const NONE_RAWKEY = '\u0000__none__';

export function encodeBandKey(rawKeys: string[]): string {
  return JSON.stringify(rawKeys);
}

export function encodeGroupedTaskRowKey(groupPath: readonly string[], taskId: string): string {
  return JSON.stringify({ kind: 'task', groupPath, taskId });
}

export function isTreeMode(view: Pick<ViewState, 'filter' | 'group' | 'sort'>): boolean {
  return (
    (view.filter ?? null) === null &&
    (view.group?.length ?? 0) === 0 &&
    (view.sort?.length ?? 0) === 0
  );
}

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

function sortValue(field: FieldRef, task: Task, ctx: ViewContext): FieldValue {
  if (field.src === 'resourceType') {
    const types = resourceTypes(task, ctx);
    return types.length > 0 ? resourceTypeRank(types[0]) : undefined;
  }
  return resolveField(field, task, ctx);
}

export function sortTasks(tasks: Task[], sort: SortLevel[], ctx: ViewContext): Task[] {
  if (sort.length === 0) return tasks;
  return tasks
    .map((t, i) => [t, i] as const)
    .sort(([a, ia], [b, ib]) => {
      for (const lvl of sort) {
        const c = cmpValues(sortValue(lvl.field, a, ctx), sortValue(lvl.field, b, ctx));
        if (c !== 0) return lvl.dir === 'asc' ? c : -c;
      }
      return ia - ib;
    })
    .map(([t]) => t);
}

interface BandBucket {
  rawKey: string;
  label: string;
  order: FieldValue;
  isNone: boolean;
}

interface BandScope {
  resourceType?: string;
  resourceName?: string;
}

function bucketsForLeaf(field: FieldRef, task: Task, ctx: ViewContext, scope: BandScope): BandBucket[] {
  if (field.src === 'resource') {
    const names = scope.resourceType === undefined
      ? resourceNames(task, ctx)
      : assignedResources(task, ctx).filter(r => r.type === scope.resourceType && r.name).map(r => r.name);
    if (names.length === 0) return [noneBucket(ctx)];
    return names.map(n => ({ rawKey: n, label: n, order: n, isNone: false }));
  }
  if (field.src === 'resourceType') {
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
    return [{ rawKey: valueId, label, order: idx >= 0 ? idx : Number.MAX_SAFE_INTEGER, isNone: false }];
  }
  const v = resolveField(field, task, ctx);
  if (v === undefined || v === null || v === '') return [noneBucket(ctx)];
  const s = String(v);
  return [{ rawKey: s, label: s, order: v, isNone: false }];
}

function noneBucket(ctx: ViewContext): BandBucket {
  return { rawKey: NONE_RAWKEY, label: ctx.noneLabel, order: undefined, isNone: true };
}

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

function isRunMilestone(task: Task): boolean {
  return isZeroDurationMilestone(task) && isLeafTask(task);
}

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

function childrenOf(task: Task, byId: ReadonlyMap<string, Task>): Task[] {
  return task.childIds.map(id => byId.get(id)).filter((t): t is Task => !!t);
}

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

export function leavesWithAncestors(
  tasks: readonly Task[],
  keep: (leaf: Task) => boolean,
  byId: ReadonlyMap<string, Task> = new Map(tasks.map(t => [t.id, t])),
): Map<string, boolean> {
  const selected = new Map<string, boolean>();
  for (const leaf of tasks) {
    if (!isLeafTask(leaf) || !keep(leaf)) continue;
    selected.set(leaf.id, false);
    for (let p = leaf.parentId; p && !selected.has(p); p = byId.get(p)?.parentId ?? null) selected.set(p, true);
  }
  return selected;
}

export function computeViewRows(tasks: Task[], opts: ViewRowOpts, ctx: ViewContext): ViewRow[] {
  const { filter, group, sort, collapsedTaskIds, collapsedGroupKeys, within } = opts;
  const byId = new Map(tasks.map(t => [t.id, t]));

  const selected = filter === null && !within ? null : leavesWithAncestors(
    tasks, leaf => (filter === null || evaluate(filter, leaf, ctx)) && (!within || within(leaf)), byId);
  const visible = { has: (id: string) => selected === null || selected.has(id) };
  const dimmed = { get: (id: string) => filter !== null && selected?.get(id) === true };

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
  const rootStack: Item[] = [];
  pushSiblings(rootStack, sortTasks(tasks.filter(t => !t.parentId), sort, ctx), 0, false);
  emit(rootStack);
  for (const t of tasks) {
    if (!seen.has(t.id) && visible.has(t.id)) {
      rows.push({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: dimmed.get(t.id) });
    }
  }
  return rows;
}

export function allBandKeys(tasks: Task[], opts: ViewRowOpts, ctx: ViewContext): string[] {
  if (opts.group.length === 0) return [];
  const keys: string[] = [];
  for (const row of computeViewRows(tasks, { ...opts, collapsedGroupKeys: new Set() }, ctx)) {
    if (row.kind === 'group') keys.push(row.key);
  }
  return keys;
}

export function firstRowIndexByTask(rows: ViewRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, i) => {
    if (row.kind === 'task' && !map.has(row.task.id)) map.set(row.task.id, i);
    if (row.kind === 'milestones') for (const t of row.tasks) if (!map.has(t.id)) map.set(t.id, i);
  });
  return map;
}

export type TaskViewRow = Extract<ViewRow, { kind: 'task' }>;

export function firstTaskOccurrence(
  rows: readonly ViewRow[],
  taskId: string,
): { rowKey: string; rowIndex: number; row: TaskViewRow } | null {
  const rowIndex = rows.findIndex(row => row.kind === 'task' && row.task.id === taskId);
  if (rowIndex < 0) return null;
  const row = rows[rowIndex] as TaskViewRow;
  return { rowKey: row.rowKey, rowIndex, row };
}

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

export function milestoneAnchorDate(task: Task): string {
  return shownStart(task) || shownFinish(task) || '';
}

export function milestonesInDrawnOrder(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const left = milestoneAnchorDate(a);
    const right = milestoneAnchorDate(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

export function uniqueTaskIds(rows: readonly ViewRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'task') ids.add(row.task.id);
    else if (row.kind === 'milestones') for (const t of row.tasks) ids.add(t.id);
  }
  return [...ids];
}

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
