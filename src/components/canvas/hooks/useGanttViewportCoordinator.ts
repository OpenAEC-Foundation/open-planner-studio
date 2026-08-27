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
  computeAnchoredZoom,
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
import { maxGanttZoom } from '@/engine/renderer/timelineTiers';
import { MS_PER_DAY } from '@/engine/renderer/timeAxis';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import {
  HISTOGRAM_MAX_HEIGHT,
  HISTOGRAM_MIN_HEIGHT,
  TASK_TABLE_MAX_WIDTH,
  TASK_TABLE_MIN_WIDTH,
} from '@/utils/settingsStore';
import type {
  GanttViewportCoordinatorInput,
  GanttViewportCoordinatorOutput,
} from './ganttCoordinatorTypes';

/**
 * Bezit de volledige Gantt-viewport: afleidingen, DOM-scrollsync, wheel/zoom, fit/focus, minimaps
 * en de drie splitters. De hook krijgt concrete waarden en gerichte acties; hij leest geen store.
 */
export function useGanttViewportCoordinator(
  input: GanttViewportCoordinatorInput,
): GanttViewportCoordinatorOutput {
  const paneRowRef = useRef<HTMLDivElement>(null);
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const histogramContainerRef = useRef<HTMLDivElement>(null);
  const primaryHScrollRef = useRef<HTMLDivElement>(null);
  const secondaryHScrollRef = useRef<HTMLDivElement>(null);
  const sharedVScrollRef = useRef<HTMLDivElement>(null);
  const [primaryChartWidth, setPrimaryChartWidth] = useState(0);
  const [secondaryChartWidth, setSecondaryChartWidth] = useState(0);

  const latest = useRef(input);
  latest.current = input;

  // Ook zonder taken moet de tijdlijn de concrete kalenderuitzonderingen kunnen bereiken. Een
  // feestdag is dan de enige domeindatum die de gebruiker naar de Gantt kan willen pannen.
  const calendarNavigationDates = useMemo(() => input.tasks.length === 0 ? ({
    starts: input.calendar.holidays.map(holiday => holiday.startDate),
    ends: input.calendar.holidays.map(holiday => holiday.endDate || holiday.startDate),
  }) : ({ starts: [], ends: [] }), [input.calendar.holidays, input.tasks.length]);

  const effectiveViewStart = useMemo(
    () => computeEffectiveViewStart(input.tasks, input.view.viewStartDate, calendarNavigationDates.starts),
    [input.tasks, input.view.viewStartDate, calendarNavigationDates.starts],
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
      taskTableWidth: input.taskTableWidth,
      zoom: effectiveView.zoom,
      scrollX: effectiveView.scrollX,
    }),
    [input.calendar, input.compressNonWorkdays, effectiveView, input.taskTableWidth],
  );
  const contentSpanDays = useMemo(
    () => computeContentSpanDays(
      input.tasks,
      effectiveViewStart,
      input.compressNonWorkdays,
      sharedAxis,
      calendarNavigationDates.ends,
    ),
    [input.tasks, effectiveViewStart, input.compressNonWorkdays, sharedAxis, calendarNavigationDates.ends],
  );
  const contentWidthFor = useCallback(
    (zoom: number, tableWidth: number) => computeContentWidth(contentSpanDays, zoom, tableWidth),
    [contentSpanDays],
  );
  const primaryContentWidth = useMemo(
    () => contentWidthFor(input.view.zoom, input.taskTableWidth),
    [contentWidthFor, input.view.zoom, input.taskTableWidth],
  );
  const splitView = input.view.splitView;
  const splitEnabled = splitView !== undefined;
  const secondaryContentWidth = useMemo(
    () => splitView ? contentWidthFor(splitView.secondaryZoom, 0) : 0,
    [contentWidthFor, splitView],
  );

  const onPrimarySize = useCallback((width: number, height: number) => {
    const current = latest.current;
    const chartWidth = Math.max(0, width - current.taskTableWidth);
    setGanttChartWidth(chartWidth);
    setPrimaryChartWidth(previous => Math.abs(previous - chartWidth) > 1 ? chartWidth : previous);
    setGanttScrollBounds(computeGanttScrollBounds(
      primaryContentWidth,
      current.rows.length,
      current.rowHeight,
      current.headerHeight,
      width,
      height,
    ));
  }, [primaryContentWidth]);

  const onSecondarySize = useCallback((width: number) => {
    setSecondaryChartWidth(previous => Math.abs(previous - width) > 1 ? width : previous);
  }, []);

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
      current.setZoom(DEFAULT_ZOOM);
      current.setScroll(0, 0);
      return;
    }
    const rect = container.getBoundingClientRect();
    const fit = computeFitToProject(
      current.tasks,
      rect.width - current.taskTableWidth,
      current.enableQuarterHourZoom,
      current.enableHourPlanning,
    );
    if (!fit) return;
    current.setZoom(fit.zoom);
    current.setViewStartDate(fit.viewStartDate);
    current.setScroll(fit.scrollX, 0);
  }, []);

  const { zoomAt } = useGanttZoom({
    containerRef: primaryContainerRef,
    taskTableWidth: input.taskTableWidth,
    view: input.view,
    enableQuarterHourZoom: input.enableQuarterHourZoom,
    enableHourPlanning: input.enableHourPlanning,
    scrollMode: input.scrollMode,
    positionDivision: input.positionDivision,
    modifierMap: input.modifierMap,
    setZoom: input.setZoom,
    setScroll: input.setScroll,
  });
  useZoomShortcuts({
    zoomAt,
    containerRef: primaryContainerRef,
    view: input.view,
    resetZoom,
    fitToProject,
  });

  // Open-fit wist het signaal één keer. Een leeg project behoudt het bestaande viewportgedrag.
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
      rect.width - current.taskTableWidth,
      current.enableQuarterHourZoom,
      current.enableHourPlanning,
    );
    current.clearPendingFit();
    if (!fit) return;
    current.setZoom(fit.zoom);
    current.setViewStartDate(fit.viewStartDate);
    current.setScroll(fit.scrollX, 0);
  }, [input.view.pendingFit, input.tasks, input.taskTableWidth, input.enableQuarterHourZoom, input.enableHourPlanning, input.clearPendingFit, input.setZoom, input.setViewStartDate, input.setScroll]);

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
    const startString = task.time.earlyStart || task.time.scheduleStart;
    const finishString = task.time.earlyFinish || task.time.scheduleFinish;
    if (!startString || !finishString) {
      current.clearPendingFocusTask();
      return;
    }

    const rect = container.getBoundingClientRect();
    const usableWidth = rect.width - current.taskTableWidth;
    if (usableWidth <= 0) {
      current.clearPendingFocusTask();
      return;
    }
    const origin = parseDate(effectiveViewStart);
    const hourMode = startString.includes('T') || finishString.includes('T');
    const start = hourMode ? parseInstant(startString) : parseDate(startString);
    const finish = hourMode ? parseInstant(finishString) : parseDate(finishString);
    const finishMillis = finish.getTime() + (hourMode ? 0 : MS_PER_DAY);
    const durationDays = (finishMillis - start.getTime()) / MS_PER_DAY;
    const middleDayOffset = ((start.getTime() + finishMillis) / 2 - origin.getTime()) / MS_PER_DAY;
    const horizontal = current.view.pendingFocusTaskPreserveZoom
      ? {
          zoom: current.view.zoom,
          scrollX: Math.max(0, middleDayOffset * current.view.zoom - usableWidth / 2),
        }
      : computeFocusTaskHorizontal(durationDays, middleDayOffset, usableWidth);
    const rowIndex = current.rows.findIndex(
      row => row.kind === 'task' && row.task.id === taskId,
    );
    const scrollY = rowIndex >= 0
      ? computeFocusTaskScrollY(rowIndex, current.rowHeight, current.headerHeight, rect.height)
      : current.view.scrollY;

    setGanttScrollBounds(computeGanttScrollBounds(
      contentWidthFor(horizontal.zoom, current.taskTableWidth),
      current.rows.length,
      current.rowHeight,
      current.headerHeight,
      rect.width,
      rect.height,
    ));
    current.clearPendingFocusTask();
    if (!current.view.pendingFocusTaskPreserveZoom) current.setZoom(horizontal.zoom);
    current.setScroll(horizontal.scrollX, scrollY);
  }, [input.view.pendingFocusTaskId, input.view.scrollY, input.tasks, input.rows, input.taskTableWidth, input.rowHeight, input.headerHeight, input.clearPendingFocusTask, input.setZoom, input.setScroll, effectiveViewStart, contentWidthFor]);

  useEffect(() => {
    const element = primaryHScrollRef.current;
    if (element && Math.abs(element.scrollLeft - input.view.scrollX) > 1) {
      element.scrollLeft = input.view.scrollX;
    }
  }, [input.view.scrollX, input.view.zoom]);
  useEffect(() => {
    const element = secondaryHScrollRef.current;
    if (element && splitView && Math.abs(element.scrollLeft - splitView.secondaryScrollX) > 1) {
      element.scrollLeft = splitView.secondaryScrollX;
    }
  }, [splitView, secondaryContentWidth]);
  useEffect(() => {
    const element = sharedVScrollRef.current;
    if (element && Math.abs(element.scrollTop - input.view.scrollY) > 1) {
      element.scrollTop = input.view.scrollY;
    }
  }, [input.view.scrollY, input.rows.length]);

  const onPrimaryHorizontalScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const current = latest.current;
    current.setScroll(event.currentTarget.scrollLeft, current.view.scrollY);
  }, []);
  const onSecondaryHorizontalScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const current = latest.current;
    const currentSplit = current.view.splitView;
    const scrollX = event.currentTarget.scrollLeft;
    if (!currentSplit || Math.abs(currentSplit.secondaryScrollX - scrollX) <= 1) return;
    current.setSplitView({ ...currentSplit, secondaryScrollX: Math.max(0, scrollX) });
  }, []);
  const onSharedVerticalScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const current = latest.current;
    current.setScroll(current.view.scrollX, event.currentTarget.scrollTop);
  }, []);

  // Secondary gebruikt dezelfde wheelbeslissing en dezelfde ankerformule als primary, maar schrijft
  // horizontaal en zoom uitsluitend in zijn eigen splitview.
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
        const next = computeAnchoredZoom({
          currentZoom: currentSplit.secondaryZoom,
          currentScrollX: currentSplit.secondaryScrollX,
          requestedZoom,
          anchorX,
          taskTableWidth: 0,
          maxZoom: maxGanttZoom(current.enableQuarterHourZoom, current.enableHourPlanning),
        });
        if (next) current.setSplitView({
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

  const tableSplitter = useSplitter({
    min: TASK_TABLE_MIN_WIDTH,
    max: () => TASK_TABLE_MAX_WIDTH,
    computeSize: event => {
      const container = primaryContainerRef.current;
      return container
        ? Math.round(event.clientX - container.getBoundingClientRect().left)
        : Number.NaN;
    },
    onResize: width => {
      if (!Number.isNaN(width)) latest.current.setTaskTableWidth(width);
    },
    onCommit: () => latest.current.persistTaskTableWidth(latest.current.taskTableWidth),
  });
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
      sharedVScrollRef,
    },
    primary: {
      chartWidth: primaryChartWidth,
      contentWidth: primaryContentWidth,
      scrollX: input.view.scrollX,
      zoom: input.view.zoom,
    },
    secondary: splitView ? {
      chartWidth: secondaryChartWidth,
      contentWidth: secondaryContentWidth,
      scrollX: splitView.secondaryScrollX,
      zoom: splitView.secondaryZoom,
    } : undefined,
    effectiveViewStart,
    effectiveView,
    sharedAxis,
    scrollHandlers: {
      onPrimaryHorizontalScroll,
      onSecondaryHorizontalScroll,
      onSharedVerticalScroll,
    },
    splitters: {
      table: tableSplitter,
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
