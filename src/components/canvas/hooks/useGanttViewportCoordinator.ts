import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGanttZoom } from '@/hooks/useGanttZoom';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';
import { useSplitter } from '@/hooks/useSplitter';
import {
  buildSharedAxis,
  computeContentSpanDays,
  computeContentWidth,
} from '../ganttRenderOptions';
import {
  axisDayDistance,
  scrollbarScale,
  scrollbarRangeRatio,
  computeTimelineZoom,
  clearGanttScrollBounds,
  computeEffectiveViewStart,
  computeFitToProject,
  computeFocusTaskHorizontal,
  computeFocusTaskScrollY,
  computeGanttScrollBounds,
  DEFAULT_ZOOM,
  getGanttScrollBounds,
  setGanttChartWidth,
  setGanttScrollBounds,
} from '@/utils/ganttViewport';
import { resolveWheelFunction } from '@/utils/ganttWheel';
import { hasGhostRow } from '@/engine/taskGrid/ghostRow';
import { taskListScrollContentHeight } from '@/engine/taskGrid/scrollExtent';
import { maxGanttZoom } from '@/engine/renderer/timelineTiers';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant } from '@/utils/taskDates';
import { histogramPlotInsets } from '@/engine/renderer/HistogramRenderer';
import {
  HISTOGRAM_MAX_HEIGHT,
  HISTOGRAM_MIN_HEIGHT,
} from '@/utils/settingsStore';
import type {
  GanttViewportCoordinatorInput,
  GanttViewportCoordinatorOutput,
} from './ganttCoordinatorTypes';
import { shownFinish, shownStart } from '@/utils/taskDates';

function hScrollViewportWidth(element: HTMLElement): number {
  return element.parentElement?.clientWidth ?? element.clientWidth;
}

function ganttScrollContentHeight(
  current: Pick<GanttViewportCoordinatorInput, 'rows' | 'rowHeight' | 'view'>,
): number {
  return taskListScrollContentHeight(current.rows.length, current.rowHeight, hasGhostRow(current.view));
}

export function useGanttViewportCoordinator(
  input: GanttViewportCoordinatorInput,
): GanttViewportCoordinatorOutput {
  const paneRowRef = useRef<HTMLDivElement>(null);
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const histogramContainerRef = useRef<HTMLDivElement>(null);
  const primaryHScrollRef = useRef<HTMLDivElement>(null);
  const secondaryHScrollRef = useRef<HTMLDivElement>(null);
  const [primaryChartWidth, setPrimaryChartWidth] = useState(0);
  const [secondaryChartWidth, setSecondaryChartWidth] = useState(0);

  const latest = useRef(input);
  latest.current = input;

  const emptyReachDates = useMemo(
    () => input.tasks.length > 0 ? [] : input.calendar.holidays.map(h => h.endDate || h.startDate),
    [input.calendar.holidays, input.tasks.length],
  );

  const baselineEarliest = input.baselineReach?.earliest ?? null;
  const baselineLatest = input.baselineReach?.latest ?? null;
  const effectiveViewStart = useMemo(
    () => computeEffectiveViewStart(input.tasks, input.view.viewStartDate, baselineEarliest),
    [input.tasks, input.view.viewStartDate, baselineEarliest],
  );
  const navigationEndDates = useMemo(
    () => baselineLatest ? [...emptyReachDates, baselineLatest] : emptyReachDates,
    [emptyReachDates, baselineLatest],
  );
  const effectiveView = useMemo(
    () => ({ ...input.view, viewStartDate: effectiveViewStart }),
    [input.view, effectiveViewStart],
  );
  const sharedAxis = useMemo(
    () => buildSharedAxis({
      calendar: input.calendar,
      compressNonWorkdays: input.compressNonWorkdays,
      viewStartDate: effectiveView.viewStartDate,
      chartOriginX: 0,
      zoom: effectiveView.zoom,
      scrollX: effectiveView.scrollX,
    }),
    [input.calendar, input.compressNonWorkdays, effectiveView],
  );
  const histogramAxis = useMemo(
    () => buildSharedAxis({
      calendar: input.calendar,
      compressNonWorkdays: input.compressNonWorkdays,
      viewStartDate: effectiveView.viewStartDate,
      chartOriginX: histogramPlotInsets(input.histogramPickerWidth, input.histogramPickerSide).left,
      zoom: effectiveView.zoom,
      scrollX: effectiveView.scrollX,
    }),
    [input.calendar, input.compressNonWorkdays, effectiveView, input.histogramPickerWidth, input.histogramPickerSide],
  );
  const spanAxis = useMemo(
    () => buildSharedAxis({
      calendar: input.calendar,
      compressNonWorkdays: input.compressNonWorkdays,
      viewStartDate: effectiveViewStart,
      chartOriginX: 0,
      zoom: 1,
      scrollX: 0,
    }),
    [input.calendar, input.compressNonWorkdays, effectiveViewStart],
  );
  const contentSpanDays = useMemo(
    () => computeContentSpanDays(
      input.tasks,
      effectiveViewStart,
      input.compressNonWorkdays,
      spanAxis,
      navigationEndDates,
    ),
    [input.tasks, effectiveViewStart, input.compressNonWorkdays, spanAxis, navigationEndDates],
  );
  const contentWidthFor = useCallback(
    (zoom: number) => computeContentWidth(contentSpanDays, zoom),
    [contentSpanDays],
  );
  const primaryContentWidth = useMemo(
    () => contentWidthFor(input.view.zoom),
    [contentWidthFor, input.view.zoom],
  );
  const splitView = input.view.splitView;
  const splitEnabled = splitView !== undefined;
  const secondaryContentWidth = useMemo(
    () => splitView ? contentWidthFor(splitView.secondaryZoom) : 0,
    [contentWidthFor, splitView],
  );

  const onPrimarySize = useCallback((width: number, height: number) => {
    const current = latest.current;
    const chartWidth = Math.max(0, width);
    setGanttChartWidth(chartWidth);
    setPrimaryChartWidth(previous => Math.abs(previous - chartWidth) > 1 ? chartWidth : previous);
    setGanttScrollBounds(computeGanttScrollBounds(
      primaryContentWidth,
      ganttScrollContentHeight(current),
      current.headerHeight,
      width,
      height,
    ));
  }, [primaryContentWidth]);

  useEffect(() => clearGanttScrollBounds, []);

  const onSecondarySize = useCallback((width: number) => {
    setSecondaryChartWidth(previous => Math.abs(previous - width) > 1 ? width : previous);
  }, []);

  const dayDistance = useMemo(
    () => axisDayDistance(input.calendar, input.compressNonWorkdays),
    [input.calendar, input.compressNonWorkdays],
  );

  const registerBoundsForZoom = useCallback((zoom: number) => {
    const current = latest.current;
    const container = primaryContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setGanttScrollBounds(computeGanttScrollBounds(
      contentWidthFor(zoom),
      ganttScrollContentHeight(current),
      current.headerHeight,
      rect.width,
      rect.height,
    ));
  }, [contentWidthFor]);

  const resetZoom = useCallback(() => {
    const current = latest.current;
    current.setZoom(DEFAULT_ZOOM);
    current.setScroll(0, 0);
  }, []);

  const fitToProject = useCallback(() => {
    const current = latest.current;
    const container = primaryContainerRef.current;
    if (!container) return;
    if (current.tasks.length === 0) {
      resetZoom();
      return;
    }
    const rect = container.getBoundingClientRect();
    const fit = computeFitToProject(
      current.tasks,
      rect.width,
      current.enableQuarterHourZoom,

      dayDistance,
      current.baselineReach?.earliest ?? null,
    );
    if (!fit) return;
    registerBoundsForZoom(fit.zoom);
    current.setZoom(fit.zoom);
    current.setViewStartDate(fit.viewStartDate);
    current.setScroll(fit.scrollX, 0);
  }, [dayDistance, registerBoundsForZoom, resetZoom]);

  const { zoomAt } = useGanttZoom({
    containerRef: primaryContainerRef,
    view: input.view,
    enableQuarterHourZoom: input.enableQuarterHourZoom,

    scrollMode: input.scrollMode,
    positionDivision: input.positionDivision,
    modifierMap: input.modifierMap,
    setZoom: input.setZoom,
    setScroll: input.setScroll,
    prepareScrollBounds: registerBoundsForZoom,
  });
  useZoomShortcuts({
    zoomAt,
    containerRef: primaryContainerRef,
    view: input.view,
    resetZoom,
    fitToProject,
  });

  useEffect(() => {
    const current = latest.current;
    if (!current.view.pendingFit) return;
    const container = primaryContainerRef.current;
    if (!container) return;
    if (current.tasks.length === 0) {
      current.clearPendingFit();
      return;
    }
    const rect = container.getBoundingClientRect();
    const fit = computeFitToProject(
      current.tasks,
      rect.width,
      current.enableQuarterHourZoom,

      dayDistance,
      current.baselineReach?.earliest ?? null,
    );
    current.clearPendingFit();
    if (!fit) return;
    registerBoundsForZoom(fit.zoom);
    current.setZoom(fit.zoom);
    current.setViewStartDate(fit.viewStartDate);
    current.setScroll(fit.scrollX, 0);
  }, [input.view.pendingFit, input.tasks, input.enableQuarterHourZoom, input.clearPendingFit, input.setZoom, input.setViewStartDate, input.setScroll, dayDistance, registerBoundsForZoom]);

  useEffect(() => {
    const current = latest.current;
    const taskId = current.view.pendingFocusTaskId;
    if (!taskId) return;
    const container = primaryContainerRef.current;
    const task = current.tasks.find(candidate => candidate.id === taskId);
    if (!container || !task) {
      current.clearPendingFocusTask();
      return;
    }
    const startString = shownStart(task);
    const finishString = shownFinish(task);
    if (!startString || !finishString) {
      current.clearPendingFocusTask();
      return;
    }

    const rect = container.getBoundingClientRect();
    const usableWidth = rect.width;
    if (usableWidth <= 0) {
      current.clearPendingFocusTask();
      return;
    }
    const hourMode = startString.includes('T') || finishString.includes('T');
    const start = hourMode ? parseInstant(startString) : parseDate(startString);
    const finish = hourMode ? finishInstant(finishString) : parseDate(finishString);
    const startContentX = sharedAxis.dateToX(start) + current.view.scrollX;
    const finishContentX = sharedAxis.dateToX(finish) + current.view.scrollX
      + (hourMode ? 0 : current.view.zoom);
    const durationDays = (finishContentX - startContentX) / current.view.zoom;
    const middleDayOffset = (startContentX + finishContentX) / (2 * current.view.zoom);
    const horizontal = current.view.pendingFocusTaskPreserveZoom
      ? {
          zoom: current.view.zoom,
          scrollX: Math.max(0, middleDayOffset * current.view.zoom - usableWidth / 2),
        }
      : computeFocusTaskHorizontal(durationDays, middleDayOffset, usableWidth);
    const rowIndex = current.rows.findIndex(
      row => (row.kind === 'task' && row.task.id === taskId)
        || (row.kind === 'milestones' && row.tasks.some(t => t.id === taskId)),
    );
    const scrollY = rowIndex >= 0
      ? computeFocusTaskScrollY(rowIndex, current.rowHeight, current.headerHeight, rect.height)
      : current.view.scrollY;

    setGanttScrollBounds(computeGanttScrollBounds(
      contentWidthFor(horizontal.zoom),
      ganttScrollContentHeight(current),
      current.headerHeight,
      rect.width,
      rect.height,
    ));
    current.clearPendingFocusTask();
    if (!current.view.pendingFocusTaskPreserveZoom) current.setZoom(horizontal.zoom);
    current.setScroll(horizontal.scrollX, scrollY);
  }, [input.view.pendingFocusTaskId, input.view.scrollY, input.tasks, input.rows, input.rowHeight, input.headerHeight, input.clearPendingFocusTask, input.setZoom, input.setScroll, sharedAxis, contentWidthFor]);

  const primaryScrollbarScale = scrollbarScale(primaryContentWidth);
  const secondaryScrollbarScale = scrollbarScale(secondaryContentWidth);
  const contentWidthsRef = useRef({ primary: primaryContentWidth, secondary: secondaryContentWidth });
  contentWidthsRef.current = { primary: primaryContentWidth, secondary: secondaryContentWidth };
  useEffect(() => {
    const element = primaryHScrollRef.current;
    if (!element) return;
    const target = input.view.scrollX * scrollbarRangeRatio(primaryContentWidth, hScrollViewportWidth(element));
    if (Math.abs(element.scrollLeft - target) > 1) {
      element.scrollLeft = target;
    }
  }, [input.view.scrollX, input.view.zoom, primaryContentWidth]);
  useEffect(() => {
    const element = secondaryHScrollRef.current;
    if (!element || !splitView) return;
    const target = splitView.secondaryScrollX * scrollbarRangeRatio(secondaryContentWidth, hScrollViewportWidth(element));
    if (Math.abs(element.scrollLeft - target) > 1) {
      element.scrollLeft = target;
    }
  }, [splitView, secondaryContentWidth]);
  const onPrimaryHorizontalScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const current = latest.current;
    const el = event.currentTarget;
    const ratio = scrollbarRangeRatio(contentWidthsRef.current.primary, hScrollViewportWidth(el));
    const scrollX = el.scrollLeft / ratio;
    if (ratio !== 1 && Math.abs(scrollX - current.view.scrollX) * ratio <= 1) return;
    current.setScroll(scrollX, current.view.scrollY);
  }, []);
  const onSecondaryHorizontalScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const current = latest.current;
    const currentSplit = current.view.splitView;
    const el = event.currentTarget;
    const ratio = scrollbarRangeRatio(contentWidthsRef.current.secondary, hScrollViewportWidth(el));
    const scrollX = el.scrollLeft / ratio;
    if (!currentSplit || Math.abs(currentSplit.secondaryScrollX - scrollX) * ratio <= 1) return;
    current.setSplitView({ ...currentSplit, secondaryScrollX: Math.max(0, scrollX) });
  }, []);
  useEffect(() => {
    if (!splitEnabled) return;
    const container = secondaryContainerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = latest.current;
      const currentSplit = current.view.splitView;
      if (!currentSplit) return;
      const rect = container.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const wheelFunction = resolveWheelFunction({
        mode: current.scrollMode,
        ctrl: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        fracX: rect.width > 0 ? anchorX / rect.width : 0,
        fracY: rect.height > 0 ? anchorY / rect.height : 0,
        division: current.positionDivision,
        map: current.modifierMap,
      });
      const scrollSecondary = (change: number) => current.setSplitView({
        ...currentSplit,
        secondaryScrollX: Math.max(0, currentSplit.secondaryScrollX + change),
      });
      if (wheelFunction === 'zoom') {
        const requestedZoom = currentSplit.secondaryZoom * (delta > 0 ? 1 / 1.1 : 1.1);
        const next = computeTimelineZoom(
          currentSplit.secondaryZoom,
          requestedZoom,
          currentSplit.secondaryScrollX,
          anchorX,
          maxGanttZoom(current.enableQuarterHourZoom),
        );
        if (next.zoom !== currentSplit.secondaryZoom) current.setSplitView({
          ...currentSplit,
          secondaryZoom: next.zoom,
          secondaryScrollX: next.scrollX,
        });
      } else if (wheelFunction === 'horizontal') {
        scrollSecondary(delta);
      } else {
        const { maxScrollY } = getGanttScrollBounds();
        if (maxScrollY !== null && maxScrollY <= 0) scrollSecondary(delta);
        else current.setScroll(current.view.scrollX, current.view.scrollY + delta);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [splitEnabled]);

  const histogramSplitter = useSplitter({
    min: HISTOGRAM_MIN_HEIGHT,
    max: () => HISTOGRAM_MAX_HEIGHT,
    computeSize: event => {
      const container = histogramContainerRef.current;
      return container
        ? Math.round(container.getBoundingClientRect().bottom - event.clientY)
        : Number.NaN;
    },
    onResize: height => {
      if (!Number.isNaN(height)) latest.current.setHistogramHeight(height);
    },
    onCommit: () => latest.current.persistHistogramHeight(latest.current.histogramHeight),
  });
  const ratioSplitter = useSplitter({
    min: 0.15,
    max: 0.85,
    computeSize: event => {
      const row = paneRowRef.current;
      if (!row) return Number.NaN;
      const rect = row.getBoundingClientRect();
      return rect.width > 0 ? (event.clientX - rect.left) / rect.width : Number.NaN;
    },
    onResize: ratio => {
      const current = latest.current;
      const currentSplit = current.view.splitView;
      if (currentSplit && !Number.isNaN(ratio)) current.setSplitView({ ...currentSplit, ratio });
    },
  });

  const primaryScrollTo = useCallback((scrollX: number) => {
    const current = latest.current;
    current.setScroll(Math.max(0, scrollX), current.view.scrollY);
  }, []);
  const secondaryScrollTo = useCallback((scrollX: number) => {
    const current = latest.current;
    const currentSplit = current.view.splitView;
    if (currentSplit) current.setSplitView({ ...currentSplit, secondaryScrollX: Math.max(0, scrollX) });
  }, []);

  return {
    refs: {
      paneRowRef,
      primaryContainerRef,
      secondaryContainerRef,
      histogramContainerRef,
      primaryHScrollRef,
      secondaryHScrollRef,
    },
    primary: {
      chartWidth: primaryChartWidth,
      contentWidth: primaryContentWidth,
      scrollbarWidth: primaryContentWidth * primaryScrollbarScale,
      scrollX: input.view.scrollX,
      zoom: input.view.zoom,
    },
    secondary: splitView ? {
      chartWidth: secondaryChartWidth,
      contentWidth: secondaryContentWidth,
      scrollbarWidth: secondaryContentWidth * secondaryScrollbarScale,
      scrollX: splitView.secondaryScrollX,
      zoom: splitView.secondaryZoom,
    } : undefined,
    effectiveViewStart,
    effectiveView,
    sharedAxis,
    histogramAxis,
    scrollHandlers: {
      onPrimaryHorizontalScroll,
      onSecondaryHorizontalScroll,
    },
    splitters: {
      histogram: histogramSplitter,
      ratio: ratioSplitter,
    },
    minimap: { primaryScrollTo, secondaryScrollTo },
    onPrimarySize,
    onSecondarySize,
    resetZoom,
    fitToProject,
  };
}
