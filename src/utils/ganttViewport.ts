import { parseDate, diffCalendarDays, addCalendarDays, formatDate, localTodayIso } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import { shownBaselineReach, type Baseline } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { maxGanttZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import { shownFinish, shownStart } from '@/utils/taskDates';

export function resolveTaskStart(task: Task): string | undefined {
  return shownStart(task) || task.time.lateStart || undefined;
}

export function resolveTaskFinish(task: Task): string | undefined {
  return shownFinish(task) || task.time.lateFinish || resolveTaskStart(task);
}

export const ZOOM_STEP = 10;

export const DEFAULT_ZOOM = 30;

export const ORIGIN_PADDING_DAYS = 14;

export interface TimelineZoomResult {
  zoom: number;
  scrollX: number;
}

export function computeTimelineZoom(
  currentZoom: number,
  requestedZoom: number,
  scrollX: number,
  anchorX: number,
  maxZoom: number,
): TimelineZoomResult {
  const zoom = Math.max(0.5, Math.min(maxZoom, requestedZoom));
  if (zoom === currentZoom) return { zoom, scrollX };
  const daysUnderCursor = (anchorX + scrollX) / currentZoom;
  return {
    zoom,
    scrollX: Math.max(0, daysUnderCursor * zoom - anchorX),
  };
}

export interface SplitPaneWidths {
  primary: number;
  secondary: number;
}

export function computeSplitPaneWidths(
  totalWidth: number,
  ratio: number,
  splitterWidth: number,
): SplitPaneWidths {
  const available = Math.max(0, totalWidth - Math.max(0, splitterWidth));
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const primary = available * clampedRatio;
  return { primary, secondary: available - primary };
}

export function splitPanePrimaryWidthCss(ratio: number, splitterWidth: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const clampedSplitter = Math.max(0, splitterWidth);
  return `calc(${clampedRatio * 100}% - ${clampedSplitter * clampedRatio}px)`;
}

export interface AnchoredZoomInput {
  currentZoom: number;
  currentScrollX: number;
  requestedZoom: number;
  anchorX: number;
  chartOriginX: number;
  maxZoom: number;
}

export function computeAnchoredZoom(input: AnchoredZoomInput): { zoom: number; scrollX: number } | null {
  const chartAnchorX = input.anchorX - input.chartOriginX;
  const result = computeTimelineZoom(
    input.currentZoom,
    input.requestedZoom,
    input.currentScrollX,
    chartAnchorX,
    input.maxZoom,
  );
  return result.zoom === input.currentZoom ? null : result;
}

export function computeEffectiveViewStart(
  tasks: Task[],
  viewStartDate: string,
  baselineEarliest: string | null = null,
): string {
  let earliest = parseDate(viewStartDate);
  if (baselineEarliest) {
    const b = parseDate(baselineEarliest);
    if (b.getTime() < earliest.getTime()) earliest = b;
  }
  for (const task of tasks) {
    const start = resolveTaskStart(task);
    if (start) {
      const d = parseDate(start);
      if (d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  if (Number.isNaN(earliest.getTime())) return viewStartDate;
  return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
}

export interface FitToProject {
  zoom: number;
  viewStartDate: string;
  scrollX: number;
}

export function computeFitToProject(
  tasks: Task[],
  timelineWidth: number,
  enableQuarterHourZoom: boolean,
  dayDistance: (from: Date, to: Date) => number = diffCalendarDays,
  baselineEarliest: string | null = null,
): FitToProject | null {
  if (tasks.length === 0 || timelineWidth <= 0) return null;
  let minStart: string | null = null;
  let maxFinish: string | null = null;
  for (const task of tasks) {
    const s = resolveTaskStart(task);
    const f = resolveTaskFinish(task);
    if (s && (!minStart || s < minStart)) minStart = s;
    if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
  }
  if (!minStart || !maxFinish) return null;
  const span = Math.max(1, dayDistance(parseDate(minStart), parseDate(maxFinish)) + 1);
  const max = maxGanttZoom(enableQuarterHourZoom);
  const zoom = Math.max(0.5, Math.min(max, timelineWidth / span));
  const effectiveStart = computeEffectiveViewStart(tasks, minStart, baselineEarliest);
  const scrollX = Math.max(0, dayDistance(parseDate(effectiveStart), parseDate(minStart)) * zoom);
  return { zoom, viewStartDate: minStart, scrollX };
}

const SCROLL_TO_DATE_MARGIN_DAYS = 3;

export interface ScrollToDateState {
  tasks: Task[];
  baselines?: Baseline[];
  activeBaselineId?: string | null;
  comparedBaselineIds?: readonly (string | null)[];
  view: { viewStartDate: string; zoom: number };
  project: { statusDate?: string };
  calendar?: WorkCalendar;
  ui?: { compressNonWorkdays?: boolean };
}

export function computeScrollToDate(date: string | undefined, state: ScrollToDateState): number {
  const target = date || state.project.statusDate || localTodayIso();
  const reach = state.baselines
    ? shownBaselineReach(state.baselines, state.activeBaselineId, state.comparedBaselineIds)
    : null;
  const effectiveViewStart = parseDate(computeEffectiveViewStart(state.tasks, state.view.viewStartDate, reach?.earliest ?? null));

  const days = axisDayDistance(state.calendar, state.ui?.compressNonWorkdays)(effectiveViewStart, parseDate(target));
  return Math.max(0, (days - SCROLL_TO_DATE_MARGIN_DAYS) * state.view.zoom);
}

export function axisDayDistance(
  calendar: WorkCalendar | undefined,
  compressNonWorkdays: boolean | undefined,
): (from: Date, to: Date) => number {
  if (!calendar || !compressNonWorkdays) return (from, to) => diffCalendarDays(from, to);
  const engine = new CalendarEngine(calendar);
  return (from, to) => {
    const axis = resolveGanttAxis({ calendar: engine, compressNonWorkdays: true, origin: from, chartOriginX: 0, zoom: 1, scrollX: 0 });
    return axis.dayIndexOf(to) - axis.dayIndexOf(from);
  };
}

export const MAX_SCROLL_SPACER_PX = 15_000_000;
export function scrollbarScale(contentWidth: number): number {
  return contentWidth > MAX_SCROLL_SPACER_PX ? MAX_SCROLL_SPACER_PX / contentWidth : 1;
}

export function scrollbarRangeRatio(contentWidth: number, viewportWidth: number): number {
  const scale = scrollbarScale(contentWidth);
  if (scale === 1) return 1;
  const range = contentWidth - viewportWidth;
  const spacerRange = contentWidth * scale - viewportWidth;
  return range > 0 && spacerRange > 0 ? spacerRange / range : scale;
}

let chartWidth: number | null = null;

export function setGanttChartWidth(width: number): void {
  chartWidth = Number.isFinite(width) && width > 0 ? width : null;
}

export function getGanttChartWidth(): number | null {
  return chartWidth;
}

let maxScrollX: number | null = null;
let maxScrollY: number | null = null;

export function computeGanttScrollBounds(
  contentWidth: number,
  contentHeight: number,
  headerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { maxScrollX: number; maxScrollY: number } {
  return {
    maxScrollX: Math.max(0, contentWidth - canvasWidth),
    maxScrollY: Math.max(0, contentHeight - (canvasHeight - headerHeight)),
  };
}

export function setGanttScrollBounds(bounds: { maxScrollX: number; maxScrollY: number }): void {
  maxScrollX = Number.isFinite(bounds.maxScrollX) ? Math.max(0, bounds.maxScrollX) : null;
  maxScrollY = Number.isFinite(bounds.maxScrollY) ? Math.max(0, bounds.maxScrollY) : null;
}

export function clearGanttScrollBounds(): void {
  maxScrollX = null;
  maxScrollY = null;
}

export function clampGanttScroll(x: number, y: number): { x: number; y: number } {
  return {
    x: maxScrollX !== null ? Math.min(x, maxScrollX) : x,
    y: maxScrollY !== null ? Math.min(y, maxScrollY) : y,
  };
}

export function getGanttScrollBounds(): { maxScrollX: number | null; maxScrollY: number | null } {
  return { maxScrollX, maxScrollY };
}

const FOCUS_TASK_WIDTH_FRACTION = 0.2;

export const FOCUS_TASK_MIN_ZOOM = TIMESCALE_ZOOM.quarter;
export const FOCUS_TASK_MAX_ZOOM = TIMESCALE_ZOOM.day;

export interface FocusTaskHorizontal {
  zoom: number;
  scrollX: number;
}

export function computeFocusTaskHorizontal(
  durationDays: number,
  midDayOffset: number,
  timelineWidth: number,
): FocusTaskHorizontal {
  const duration = Math.max(1, durationDays);
  const rawZoom = (timelineWidth * FOCUS_TASK_WIDTH_FRACTION) / duration;
  const zoom = Math.max(FOCUS_TASK_MIN_ZOOM, Math.min(FOCUS_TASK_MAX_ZOOM, rawZoom));
  const scrollX = Math.max(0, midDayOffset * zoom - timelineWidth / 2);
  return { zoom, scrollX };
}

export function computeFocusTaskScrollY(
  rowIndex: number,
  rowHeight: number,
  headerHeight: number,
  canvasHeight: number,
): number {
  const visibleHeight = canvasHeight - headerHeight;
  return Math.max(0, rowIndex * rowHeight + rowHeight / 2 - visibleHeight / 2);
}
