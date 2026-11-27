import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { resourceHasLoad, resourceIsLevelable, type Resource } from '@/types/resource';
import { buildBaselineOverlay, type BaselineOverlay } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { diffDays, parseDate } from '@/utils/dateUtils';
import { resolveTaskFinish } from '@/utils/ganttViewport';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';

export { buildBaselineOverlay };
export type { BaselineOverlay };

export interface SharedAxisInput {
  calendar: WorkCalendar;
  compressNonWorkdays: boolean;
  viewStartDate: string;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

export function buildSharedAxis(input: SharedAxisInput): GanttAxis {
  const engine = new CalendarEngine(input.calendar);
  return resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: input.compressNonWorkdays,
    origin: parseDate(input.viewStartDate),
    chartOriginX: input.chartOriginX,
    zoom: input.zoom,
    scrollX: input.scrollX,
  });
}

export function computeContentSpanDays(
  tasks: Task[],
  effectiveViewStart: string,
  compressNonWorkdays: boolean,
  axis: GanttAxis,
  navigationEndDates: string[] = [],
): number | null {
  if (tasks.length === 0 && navigationEndDates.length === 0) return null;
  let maxDays = 365;
  for (const task of tasks) {
    const end = resolveTaskFinish(task);
    if (end) {
      const days = compressNonWorkdays
        ? axis.daySpan(parseDate(effectiveViewStart), parseDate(end))
        : diffDays(effectiveViewStart, end);
      if (days > maxDays) maxDays = days;
    }
  }
  for (const end of navigationEndDates) {
    const parsed = parseDate(end);
    if (Number.isNaN(parsed.getTime())) continue;
    const days = compressNonWorkdays
      ? axis.daySpan(parseDate(effectiveViewStart), parsed)
      : diffDays(effectiveViewStart, end);
    if (days > maxDays) maxDays = days;
  }
  return maxDays;
}

export function computeContentWidth(
  contentSpanDays: number | null,
  zoom: number,
): number {
  return contentSpanDays === null
    ? 2000
    : Math.max(2000, (contentSpanDays * 1.2) * zoom);
}

export function buildHistogramPicker(
  resources: Resource[],
  resourceLoadResult: ResourceLoadResult | null | undefined,
  allResourcesLabel: string,
): HistogramPickerItem[] {
  const over = resourceLoadResult?.overallocatedDays ?? {};
  const anyRenewableOver = resources.some(
    r => resourceIsLevelable(r) && (over[r.id]?.length ?? 0) > 0,
  );
  const items: HistogramPickerItem[] = [
    { id: undefined, label: allResourcesLabel, overallocated: anyRenewableOver },
  ];
  for (const r of resources) {
    if (!resourceHasLoad(r)) continue;
    items.push({ id: r.id, label: r.name || r.id, overallocated: (over[r.id]?.length ?? 0) > 0 });
  }
  return items;
}

export function buildHistogramSeries(
  resourceLoadResult: ResourceLoadResult | null | undefined,
  histogramResourceId: string | undefined,
  resources: Resource[],
): HistogramSeries {
  if (!resourceLoadResult) return { load: {}, capacity: {}, overSet: new Set<string>() };
  const { load, capacity, overallocatedDays } = resourceLoadResult;
  if (histogramResourceId) {
    return {
      load: load[histogramResourceId] ?? {},
      capacity: capacity[histogramResourceId] ?? {},
      overSet: new Set(overallocatedDays[histogramResourceId] ?? []),
    };
  }
  const aggLoad: Record<string, number> = {};
  const aggCap: Record<string, number> = {};
  for (const r of resources) {
    if (!resourceIsLevelable(r)) continue;
    const l = load[r.id];
    const cp = capacity[r.id];
    if (l) for (const iso in l) aggLoad[iso] = (aggLoad[iso] ?? 0) + l[iso];
    if (cp) for (const iso in cp) aggCap[iso] = (aggCap[iso] ?? 0) + cp[iso];
  }
  const overSet = new Set<string>();
  for (const iso in aggLoad) if (exceedsCapacity(aggLoad[iso], aggCap[iso] ?? 0)) overSet.add(iso);
  return { load: aggLoad, capacity: aggCap, overSet };
}

type DerivedFromCpm = 'drivingSequenceIds' | 'violatedConstraintTaskIds' | 'missedDeadlineTaskIds';

type ExplicitlyRequired<T> = { [K in keyof Required<T>]: T[K] };

export type GanttRenderOptionsInput =
  ExplicitlyRequired<Omit<GanttRenderOptions, DerivedFromCpm>>
  & {
    cpmResult: CPMResult | null | undefined;
  };

export type GanttRenderOptionsSourceInput = Omit<
  GanttRenderOptionsInput,
  'canvasWidth' | 'canvasHeight'
>;

export function buildGanttRenderOptions(input: GanttRenderOptionsInput): GanttRenderOptions {
  const { cpmResult, ...rest } = input;
  const cpm = cpmResult && !cpmResult.error ? cpmResult : undefined;
  return {
    ...rest,
    drivingSequenceIds: knownDrivingSequenceIds(cpm),
    violatedConstraintTaskIds: cpm?.violatedConstraintTaskIds,
    missedDeadlineTaskIds: cpm?.missedDeadlineTaskIds,
  };
}
