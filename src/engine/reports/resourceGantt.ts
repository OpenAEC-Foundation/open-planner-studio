import type { Task } from '@/types/task';
import { contourSiblings, isCostResource, type Resource, type ResourceAssignment, type ResourceType } from '@/types/resource';
import { encodeBandKey, encodeGroupedTaskRowKey, NONE_RAWKEY, type ViewRow } from '@/engine/view/visibleRows';
import { RESOURCE_TYPE_BAND_ORDER, resourceTypeRank } from '@/engine/view/filterEval';
import { type AssignmentCurveState, assignmentCurveState, contouredAssignmentIds } from '@/engine/contour/curveState';
import { taskStart } from './reportCommon';
import { taskInPeriod } from './reportPeriodRows';
import type { ResolvedPeriod } from './reportingPeriod';

export interface ResourceGanttInput {
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
}

export interface ResourceGanttRowsOptions {
  includeUnassigned: boolean;
  noneLabel: string;
  locale: string;
  groupByType?: boolean;
  typeLabels?: Partial<Record<ResourceType, string>>;
  window?: ResolvedPeriod;
  sortTasks?: (tasks: Task[]) => Task[];
  bandsDescending?: boolean;
  typesDescending?: boolean;
}

export interface ResourceGanttRowsResult {
  rows: ViewRow[];
  assignmentByRowKey: Map<string, RowAssignment>;
  counts: {
    resources: number;
    assignments: number;
    unassignedTasks: number;
    outsidePeriod: number;
    inPeriod: number;
  };
}

export type RowCurve = AssignmentCurveState;

export interface RowAssignment {
  unitsPerDay: number;
  curve: RowCurve | null;
  cost?: true;
  costAmount?: number;
}

const NONE_BAND_KEY = encodeBandKey([NONE_RAWKEY]);

export { RESOURCE_TYPE_BAND_ORDER };

function typeRawKey(type: ResourceType): string {
  return `type:${type}`;
}

function sortByStart(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index, start: taskStart(task) }))
    .sort((a, b) => {
      if (a.start === b.start) return a.index - b.index;
      if (a.start === '') return 1;
      if (b.start === '') return -1;
      return a.start < b.start ? -1 : 1;
    })
    .map(entry => entry.task);
}

function bandCollator(locale: string): Intl.Collator {
  return new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
}

export function resourceBandLabels(resources: readonly Resource[], locale: string): Map<string, string> {
  const collator = bandCollator(locale);
  const bases = resources.map((r, i) => r.name.trim() || `#${i + 1}`);
  const groups: { base: string; members: number[] }[] = [];
  bases.forEach((base, i) => {
    const group = groups.find(g => collator.compare(g.base, base) === 0);
    if (group) group.members.push(i);
    else groups.push({ base, members: [i] });
  });
  const labels = new Map<string, string>();
  for (const group of groups) {
    group.members.forEach((i, n) => {
      labels.set(resources[i].id, group.members.length > 1 ? `${bases[i]} #${n + 1}` : bases[i]);
    });
  }
  return labels;
}

export function computeResourceGanttRows(
  ctx: ResourceGanttInput,
  opts: ResourceGanttRowsOptions,
): ResourceGanttRowsResult {
  const allLeaves = ctx.tasks.filter(t => t.childIds.length === 0);
  const { window } = opts;
  const leaves = window ? allLeaves.filter(t => taskInPeriod(t, window)) : allLeaves;
  const leafById = new Map(leaves.map(t => [t.id, t]));
  const resourceIds = new Set(ctx.resources.map(r => r.id));

  const tasksByResource = new Map<string, Map<string, Task>>();
  const loadByResourceTask = new Map<string, { unitsPerDay: number; curves: Set<RowCurve>; costAmount?: number }>();
  const costIds = new Set(ctx.resources.filter(isCostResource).map(r => r.id));
  const assignedTaskIds = new Set<string>();
  const recordsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of ctx.assignments) {
    if (!leafById.has(a.taskId)) continue;
    const list = recordsByTask.get(a.taskId) ?? [];
    list.push(a);
    recordsByTask.set(a.taskId, list);
  }
  const contouredIds = new Set<string>();
  for (const [taskId, list] of recordsByTask) {
    for (const id of contouredAssignmentIds(leafById.get(taskId)!, contourSiblings(list, costIds))) contouredIds.add(id);
  }
  const curveOf = (a: ResourceAssignment): RowCurve => assignmentCurveState(a, contouredIds.has(a.id));
  let assignments = 0;
  for (const a of ctx.assignments) {
    const task = leafById.get(a.taskId);
    if (!task || !resourceIds.has(a.resourceId)) continue;
    assignments++;
    let bucket = tasksByResource.get(a.resourceId);
    if (!bucket) { bucket = new Map(); tasksByResource.set(a.resourceId, bucket); }
    bucket.set(task.id, task);
    assignedTaskIds.add(task.id);
    const loadKey = `${a.resourceId}\u0000${task.id}`;
    const load = loadByResourceTask.get(loadKey) ?? { unitsPerDay: 0, curves: new Set<RowCurve>() };
    if (costIds.has(a.resourceId)) {
      if (a.costAmount !== undefined) load.costAmount = (load.costAmount ?? 0) + a.costAmount;
    } else {
      load.unitsPerDay += a.unitsPerDay;
      load.curves.add(curveOf(a));
    }
    loadByResourceTask.set(loadKey, load);
  }

  const labels = resourceBandLabels(ctx.resources, opts.locale);
  const collator = bandCollator(opts.locale);
  const bands = ctx.resources
    .map((r, index) => ({ id: r.id, index, label: labels.get(r.id) ?? r.id, tasks: tasksByResource.get(r.id) }))
    .filter((b): b is typeof b & { tasks: Map<string, Task> } => b.tasks !== undefined)
    .sort((a, b) => collator.compare(a.label, b.label) || a.index - b.index);
  if (opts.bandsDescending) bands.reverse();
  const orderTasks = opts.sortTasks ?? sortByStart;

  const rows: ViewRow[] = [];
  const assignmentByRowKey = new Map<string, RowAssignment>();
  const pushBand = (band: (typeof bands)[number], path: string[]) => {
    const groupPath = [...path, band.id];
    const key = encodeBandKey(groupPath);
    rows.push({
      kind: 'group', rowKey: key, key, label: band.label, count: band.tasks.size,
      depth: path.length, levelIndex: path.length, collapsed: false,
    });
    for (const task of orderTasks([...band.tasks.values()])) {
      const rowKey = encodeGroupedTaskRowKey(groupPath, task.id);
      rows.push({ kind: 'task', rowKey, task, depth: path.length + 1, dimmed: false });
      const load = loadByResourceTask.get(`${band.id}\u0000${task.id}`);
      if (load) {
        assignmentByRowKey.set(rowKey, costIds.has(band.id)
          ? { unitsPerDay: 0, curve: null, cost: true, ...(load.costAmount !== undefined ? { costAmount: load.costAmount } : {}) }
          : { unitsPerDay: load.unitsPerDay, curve: load.curves.size === 1 ? [...load.curves][0] : null });
      }
    }
  };
  if (opts.groupByType) {
    const typeOf = new Map(ctx.resources.map(r => [r.id, r.type]));
    const rank = resourceTypeRank;
    const types = [...new Set(bands.map(b => typeOf.get(b.id) as ResourceType))].sort((a, b) => rank(a) - rank(b));
    if (opts.typesDescending) types.reverse();
    for (const type of types) {
      const members = bands.filter(b => typeOf.get(b.id) === type);
      const raw = typeRawKey(type);
      const key = encodeBandKey([raw]);
      rows.push({
        kind: 'group', rowKey: key, key, label: opts.typeLabels?.[type] ?? type,
        count: members.reduce((n, b) => n + b.tasks.size, 0), depth: 0, levelIndex: 0, collapsed: false,
      });
      for (const band of members) pushBand(band, [raw]);
    }
  } else {
    for (const band of bands) pushBand(band, []);
  }

  const unassigned = orderTasks(leaves.filter(t => !assignedTaskIds.has(t.id)));
  if (opts.includeUnassigned && unassigned.length > 0) {
    rows.push({
      kind: 'group', rowKey: NONE_BAND_KEY, key: NONE_BAND_KEY, label: opts.noneLabel,
      count: unassigned.length, depth: 0, levelIndex: 0, collapsed: false,
    });
    for (const task of unassigned) {
      rows.push({ kind: 'task', rowKey: encodeGroupedTaskRowKey([NONE_RAWKEY], task.id), task, depth: 1, dimmed: false });
    }
  }

  return {
    rows,
    assignmentByRowKey,
    counts: {
      resources: bands.length, assignments, unassignedTasks: unassigned.length,
      outsidePeriod: allLeaves.length - leaves.length, inPeriod: leaves.length,
    },
  };
}
