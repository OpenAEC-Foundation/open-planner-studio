import type { Task } from '@/types/task';
import type { GroupLevel, Layout, SortLevel } from '@/types/view';
import { computeViewRows, sortTasks, type ViewContext, type ViewRow } from '@/engine/view/visibleRows';
import { evaluate } from '@/engine/view/filterEval';
import { computeResourceGanttRows, type ResourceGanttRowsOptions, type ResourceGanttRowsResult } from './resourceGantt';
import { taskInPeriod } from './reportPeriodRows';

export interface LayoutReportInput {
  tasks: readonly Task[];
  ctx: ViewContext;
}

export interface LayoutResourceOptions {
  includeUnassigned: boolean;
  groupByType: boolean;
  window?: ResourceGanttRowsOptions['window'];
  locale: string;
  typeLabels?: ResourceGanttRowsOptions['typeLabels'];
}

export interface ResourceBandShape {
  typeLevel: boolean;
  bandsDescending: boolean;
  typesDescending: boolean;
}

export interface LayoutReportRows {
  rows: ViewRow[];
  resource: ResourceGanttRowsResult | null;
  multiBand: boolean;
}

export function resourceBandShape(group: readonly GroupLevel[] | undefined): ResourceBandShape | null {
  if (!group || group.length === 0 || group.length > 2) return null;
  const last = group[group.length - 1];
  if (last.field.src !== 'resource') return null;
  if (group.length === 2 && group[0].field.src !== 'resourceType') return null;
  return {
    typeLevel: group.length === 2,
    bandsDescending: last.dir === 'desc',
    typesDescending: group.length === 2 && group[0].dir === 'desc',
  };
}

export function groupIsMultiBand(group: readonly GroupLevel[] | undefined): boolean {
  return (group ?? []).some(level => level.field.src === 'resource' || level.field.src === 'resourceType');
}

export function computeLayoutReportRows(
  layout: Pick<Layout, 'filter' | 'group' | 'sort'>,
  input: LayoutReportInput,
  resourceOptions: LayoutResourceOptions,
): LayoutReportRows {
  const filter = layout.filter ?? null;
  const group = layout.group ?? [];
  const sort = layout.sort ?? [];
  const { ctx } = input;
  const tasks = input.tasks as Task[];
  const shape = resourceBandShape(group);
  if (shape) {
    const filtered = filter === null ? tasks : tasks.filter(task => task.childIds.length > 0 || evaluate(filter, task, ctx));
    const ownSort = sort.length > 0 && !isStartAscending(sort);
    const resource = computeResourceGanttRows(
      { tasks: filtered, resources: ctx.resources, assignments: ctx.assignments },
      {
        includeUnassigned: resourceOptions.includeUnassigned,
        noneLabel: ctx.noneLabel,
        locale: resourceOptions.locale,
        groupByType: shape.typeLevel || resourceOptions.groupByType,
        typeLabels: resourceOptions.typeLabels,
        window: resourceOptions.window,
        sortTasks: ownSort ? list => sortTasks(list, sort, ctx) : undefined,
        bandsDescending: shape.bandsDescending,
        typesDescending: shape.typesDescending,
      },
    );
    return { rows: resource.rows, resource, multiBand: true };
  }
  const { window } = resourceOptions;
  const rows = computeViewRows(tasks, {
    filter, group, sort, collapsedTaskIds: new Set(), collapsedGroupKeys: new Set(),
    within: window ? task => taskInPeriod(task, window) : undefined,
  }, ctx);
  return { rows, resource: null, multiBand: groupIsMultiBand(group) };
}

function isStartAscending(sort: readonly SortLevel[]): boolean {
  const [level] = sort;
  return sort.length === 1 && level.dir === 'asc' && level.field.src === 'builtin' && level.field.key === 'start';
}
