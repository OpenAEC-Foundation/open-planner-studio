import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { GanttRenderer, GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { HistogramRenderer, HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { setGanttChartWidth } from '@/utils/ganttViewport';
import { MiniMap } from './MiniMap';
import { diffDays, formatDate, parseDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { createDefaultTaskTime, Task } from '@/types/task';
import { ContextMenu } from './ContextMenu';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { useGanttZoom } from '@/hooks/useGanttZoom';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';
import { saveLeftPanelWidth, saveHistogramHeight, TASK_TABLE_MIN_WIDTH, TASK_TABLE_MAX_WIDTH, HISTOGRAM_MIN_HEIGHT, HISTOGRAM_MAX_HEIGHT } from '@/utils/settingsStore';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 50;
// Halve breedte van de grijpzone rond de tabel/chart-scheiding (splitter).
const SPLITTER_GRAB_MARGIN = 4;
// Days of empty padding kept to the left of the earliest task / today so the
// timeline origin never sits exactly on a task bar.
const ORIGIN_PADDING_DAYS = 14;

interface ContextMenuState {
  x: number;
  y: number;
  task: Task | null;
}

interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'body';
  startX: number;
  originalStart: string;
  originalFinish: string;
  originalDuration: number;
}

interface TooltipState {
  x: number;
  y: number;
  task: Task;
}

interface DependencyDragState {
  sourceTaskId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

interface ToastState {
  message: string;
  type: 'error' | 'info';
}

// Map-style drag-to-pan (Optie 3 / 'drag' scroll mode). Captures the pointer
// origin and the scroll offsets at grab time; movement is applied as a delta.
interface PanState {
  startClientX: number;
  startClientY: number;
  originScrollX: number;
  originScrollY: number;
}

export function GanttCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const depLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramContainerRef = useRef<HTMLDivElement>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramRendererRef = useRef<HistogramRenderer | null>(null);

  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const view = useAppStore(s => s.view);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const deselectAll = useAppStore(s => s.deselectAll);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const addTask = useAppStore(s => s.addTask);
  const addSequence = useAppStore(s => s.addSequence);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const setScroll = useAppStore(s => s.setScroll);
  const setUI = useAppStore(s => s.setUI);
  const project = useAppStore(s => s.project);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const scrollMode = useAppStore(s => s.ui.scrollMode);
  const traceMode = useAppStore(s => s.ui.traceMode);
  const cpmResult = useAppStore(s => s.cpmResult);
  // DE gedeelde zichtbare-rijenlijst (fase 2.7, §4.3): zelfde store-veld als TableEditor.
  const viewRows = useAppStore(s => s.viewRows);
  const setCollapsedGroupKey = useAppStore(s => s.setCollapsedGroupKey);
  const splitView = useAppStore(s => s.view.splitView);
  const setSplitView = useAppStore(s => s.setSplitView);
  const showMiniMap = useAppStore(s => s.ui.showMiniMap);
  const taskTableWidth = useAppStore(s => s.ui.leftPanelWidth);
  const showHistogram = useAppStore(s => s.ui.showHistogram);
  const histogramHeight = useAppStore(s => s.ui.histogramHeight);
  const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  // Voortgang & baselines (fase 2.6, §6)
  const statusDate = useAppStore(s => s.project.statusDate);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  const showProgressLine = useAppStore(s => s.ui.showProgressLine);
  const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const setHistogramResource = useAppStore(s => s.setHistogramResource);

  const { zoomAt } = useGanttZoom({ containerRef, taskTableWidth });
  useZoomShortcuts({ zoomAt, containerRef, taskTableWidth, originPaddingDays: ORIGIN_PADDING_DAYS });

  const rendererRef = useRef<GanttRenderer | null>(null);
  // Split view (fase 2.7, §10): secundair tijdvenster + sleepbare ratio-balk.
  const paneRowRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryRendererRef = useRef<GanttRenderer | null>(null);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [primaryChartWidth, setPrimaryChartWidth] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isResizingTable, setIsResizingTable] = useState(false);
  const [depDragState, setDepDragState] = useState<DependencyDragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [cursor, setCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isResizingHistogram, setIsResizingHistogram] = useState(false);
  const [histoTooltip, setHistoTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const localizedMonths = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);

  // Baseline-overlay-Map uit de actieve baseline (fase 2.6, §6.2): keyed op Task.id (leaf-taken).
  const baselineOverlay = useMemo(() => {
    if (!activeBaselineId) return undefined;
    const active = baselines.find(b => b.id === activeBaselineId);
    if (!active) return undefined;
    const map = new Map<string, { start: string; finish: string; isMilestone: boolean }>();
    for (const bt of active.tasks) {
      map.set(bt.taskId, { start: bt.start, finish: bt.finish, isMilestone: bt.isMilestone });
    }
    return map;
  }, [baselines, activeBaselineId]);

  const columnHeaders = useMemo(() => ({
    wbs: tTask('table.wbs'),
    taskName: tTask('table.name'),
    duration: tTask('table.duration'),
  }), [tTask]);

  // Path tracing rond de (eerst) geselecteerde taak: transitieve voorgangers/opvolgers, met de
  // driving-ketens apart zodat de renderer die sterker kan tinten (MSP Task Path-conventie).
  const trace = useMemo(() => {
    if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
    const focusId = selectedTaskIds[0];
    const drivingIds = cpmResult && !cpmResult.error
      ? new Set(cpmResult.drivingSequenceIds)
      : undefined;
    const tr = traceFrom(focusId, sequences, drivingIds);
    return {
      focusId,
      predecessors: traceMode !== 'successors' ? [...tr.predecessors] : [],
      drivingPredecessors: traceMode !== 'successors' ? [...tr.drivingPredecessors] : [],
      successors: traceMode !== 'predecessors' ? [...tr.successors] : [],
      drivenSuccessors: traceMode !== 'predecessors' ? [...tr.drivenSuccessors] : [],
    };
  }, [traceMode, selectedTaskIds, sequences, cpmResult]);

  // Show toast when CPM detects circular dependency
  useEffect(() => {
    if (cpmResult?.error) {
      setToast({ message: cpmResult.error, type: 'error' });
    }
  }, [cpmResult]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Effective timeline origin (the date mapped to scrollX = 0). The stored
  // viewStartDate defaults to "today" and never accounts for tasks that start
  // earlier; since the horizontal scrollbar (and the setScroll clamp) only
  // allow scrollX >= 0, anything left of the origin is unreachable. Pin the
  // origin to the earliest task start (or today, whichever is earlier) minus a
  // small padding so past tasks become scrollable into view.
  const effectiveViewStart = useMemo(() => {
    let earliest = parseDate(view.viewStartDate);
    for (const task of tasks) {
      const start = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
      if (start) {
        const d = parseDate(start);
        if (d.getTime() < earliest.getTime()) earliest = d;
      }
    }
    return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
  }, [tasks, view.viewStartDate]);

  // The view handed to the renderer/content-width uses the effective origin so
  // the date<->x mapping stays consistent across canvas, scrollbar and zoom.
  const effectiveView = useMemo(
    () => ({ ...view, viewStartDate: effectiveViewStart }),
    [view, effectiveViewStart],
  );

  // Calculate total content width based on task date range
  const totalContentWidth = useMemo(() => {
    if (tasks.length === 0) return 2000;
    const viewStart = effectiveViewStart;
    let maxDays = 365;
    for (const task of tasks) {
      const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
      if (end) {
        const days = diffDays(viewStart, end);
        if (days > maxDays) maxDays = days;
      }
    }
    return Math.max(2000, (maxDays * 1.2) * view.zoom + taskTableWidth);
  }, [tasks, effectiveViewStart, view.zoom, taskTableWidth]);

  // --- Histogram (fase 2.5, §6.4) ---
  const histogramPicker = useMemo<HistogramPickerItem[]>(() => {
    const over = resourceLoadResult?.overallocatedDays ?? {};
    const anyRenewableOver = resources.some(
      r => r.type !== 'MATERIAL' && (over[r.id]?.length ?? 0) > 0,
    );
    const items: HistogramPickerItem[] = [
      { id: undefined, label: tCommon('resource.histogram.allResources'), overallocated: anyRenewableOver },
    ];
    for (const r of resources) {
      items.push({ id: r.id, label: r.name || r.id, overallocated: (over[r.id]?.length ?? 0) > 0 });
    }
    return items;
  }, [resources, resourceLoadResult, tCommon]);

  const histogramSeries = useMemo<HistogramSeries>(() => {
    if (!resourceLoadResult) return { load: {}, capacity: {}, overSet: new Set<string>() };
    const { load, capacity, overallocatedDays } = resourceLoadResult;
    if (histogramResourceId) {
      return {
        load: load[histogramResourceId] ?? {},
        capacity: capacity[histogramResourceId] ?? {},
        overSet: new Set(overallocatedDays[histogramResourceId] ?? []),
      };
    }
    // "Alle resources": som over alle renewables (materiaal telt niet mee, §6.4).
    const aggLoad: Record<string, number> = {};
    const aggCap: Record<string, number> = {};
    for (const r of resources) {
      if (r.type === 'MATERIAL') continue;
      const l = load[r.id];
      const cp = capacity[r.id];
      if (l) for (const iso in l) aggLoad[iso] = (aggLoad[iso] ?? 0) + l[iso];
      if (cp) for (const iso in cp) aggCap[iso] = (aggCap[iso] ?? 0) + cp[iso];
    }
    const overSet = new Set<string>();
    for (const iso in aggLoad) if (aggLoad[iso] > (aggCap[iso] ?? 0) + 1e-9) overSet.add(iso);
    return { load: aggLoad, capacity: aggCap, overSet };
  }, [resourceLoadResult, histogramResourceId, resources]);

  const renderHistogram = useCallback(() => {
    const canvas = histogramCanvasRef.current;
    const container = histogramContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const renderer = new HistogramRenderer(ctx, {
      series: histogramSeries,
      picker: histogramPicker,
      selectedResourceId: histogramResourceId,
      view: effectiveView,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      taskTableWidth,
      labels: { unitsSuffix: tCommon('resource.histogram.units') },
      emptyHint: !resourceLoadResult
        ? tCommon('resource.histogram.noData')
        : resources.length === 0
          ? tCommon('resource.histogram.noResources')
          : undefined,
    });
    histogramRendererRef.current = renderer;
    renderer.render();
  }, [histogramSeries, histogramPicker, histogramResourceId, effectiveView, taskTableWidth, resourceLoadResult, resources.length, tCommon, uiTheme]);

  useEffect(() => {
    if (!showHistogram) return;
    const frame = requestAnimationFrame(renderHistogram);
    return () => cancelAnimationFrame(frame);
  }, [showHistogram, histogramHeight, renderHistogram]);

  useEffect(() => {
    if (!showHistogram) return;
    const container = histogramContainerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => requestAnimationFrame(renderHistogram));
    obs.observe(container);
    return () => obs.disconnect();
  }, [showHistogram, renderHistogram]);

  // Histogram-splitter: hoogte volgt de muis (geklemd), opslaan bij loslaten.
  useEffect(() => {
    if (!isResizingHistogram) return;
    const handleMove = (e: MouseEvent) => {
      const container = histogramContainerRef.current;
      if (!container) return;
      const bottom = container.getBoundingClientRect().bottom;
      const h = Math.min(HISTOGRAM_MAX_HEIGHT, Math.max(HISTOGRAM_MIN_HEIGHT, Math.round(bottom - e.clientY)));
      setUI({ histogramHeight: h });
    };
    const handleUp = () => {
      setIsResizingHistogram(false);
      void saveHistogramHeight(useAppStore.getState().ui.histogramHeight);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingHistogram, setUI]);

  // Auto-dismiss van de drill-down-tooltip.
  useEffect(() => {
    if (!histoTooltip) return;
    const timer = setTimeout(() => setHistoTooltip(null), 6000);
    return () => clearTimeout(timer);
  }, [histoTooltip]);

  const contributingTaskNames = useCallback((iso: string): string[] => {
    const names = new Set<string>();
    for (const a of assignments) {
      if (histogramResourceId && a.resourceId !== histogramResourceId) continue;
      if (!histogramResourceId) {
        const res = resources.find(r => r.id === a.resourceId);
        if (!res || res.type === 'MATERIAL') continue;
      }
      const task = tasks.find(t => t.id === a.taskId);
      if (!task) continue;
      const es = task.time.earlyStart || task.time.scheduleStart;
      const ef = task.time.earlyFinish || task.time.scheduleFinish;
      if (es && ef && iso >= es && iso <= ef) names.add(task.name || task.id);
    }
    return [...names];
  }, [assignments, resources, tasks, histogramResourceId]);

  const handleHistogramClick = useCallback((e: React.MouseEvent) => {
    const canvas = histogramCanvasRef.current;
    const renderer = histogramRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pick = renderer.pickerAt(x, y);
    if (pick) {
      setHistogramResource(pick.id);
      setHistoTooltip(null);
      return;
    }
    const iso = renderer.dayAt(x, y);
    if (iso) {
      const names = contributingTaskNames(iso);
      setHistoTooltip({
        x: e.clientX,
        y: e.clientY,
        lines: [tCommon('resource.histogram.overallocatedTooltip', { count: names.length, date: iso }), ...names.slice(0, 8)],
      });
    } else {
      setHistoTooltip(null);
    }
  }, [setHistogramResource, contributingTaskNames, tCommon]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Registreer het zichtbare tijdvenster (primaire pane) voor de recenter-formule van
    // setTimeScale (§3.3) en voor het mini-map-viewportkader (§11).
    const chartW = Math.max(0, rect.width - taskTableWidth);
    setGanttChartWidth(chartW);
    setPrimaryChartWidth(prev => (Math.abs(prev - chartW) > 1 ? chartW : prev));

    const opts: GanttRenderOptions = {
      rows: viewRows,
      sequences,
      calendar,
      view: effectiveView,
      selectedTaskIds,
      collapsedTaskIds,
      drivingSequenceIds: cpmResult && !cpmResult.error ? cpmResult.drivingSequenceIds : undefined,
      violatedConstraintTaskIds: cpmResult && !cpmResult.error ? cpmResult.violatedConstraintTaskIds : undefined,
      missedDeadlineTaskIds: cpmResult && !cpmResult.error ? cpmResult.missedDeadlineTaskIds : undefined,
      statusDate,
      showStatusDateLine,
      showProgressLine,
      showBaselineOverlay,
      baselineOverlay,
      trace,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      taskTableWidth,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      localizedMonths,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
    };

    const renderer = new GanttRenderer(ctx, opts);
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, taskTableWidth, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay]);

  // --- Split view (fase 2.7, §10): secundair tijdvenster met eigen zoom/scrollX; gedeelde
  // rijen + scrollY; geen canvas-taaktabel (taskTableWidth 0) — die tekent alleen links. ---
  const renderSecondary = useCallback(() => {
    if (!splitView) return;
    const canvas = secondaryCanvasRef.current;
    const container = secondaryContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const renderer = new GanttRenderer(ctx, {
      rows: viewRows,
      sequences,
      calendar,
      view: {
        ...effectiveView,
        zoom: splitView.secondaryZoom,
        scrollX: splitView.secondaryScrollX,
      },
      selectedTaskIds,
      collapsedTaskIds,
      drivingSequenceIds: cpmResult && !cpmResult.error ? cpmResult.drivingSequenceIds : undefined,
      violatedConstraintTaskIds: cpmResult && !cpmResult.error ? cpmResult.violatedConstraintTaskIds : undefined,
      missedDeadlineTaskIds: cpmResult && !cpmResult.error ? cpmResult.missedDeadlineTaskIds : undefined,
      statusDate,
      showStatusDateLine,
      showProgressLine,
      showBaselineOverlay,
      baselineOverlay,
      trace,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      taskTableWidth: 0,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      localizedMonths,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
    });
    secondaryRendererRef.current = renderer;
    renderer.render();
  }, [splitView, viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay]);

  useEffect(() => {
    if (!splitView) { secondaryRendererRef.current = null; return; }
    const frameId = requestAnimationFrame(renderSecondary);
    return () => cancelAnimationFrame(frameId);
  }, [splitView, renderSecondary]);

  useEffect(() => {
    if (!splitView) return;
    const container = secondaryContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => requestAnimationFrame(renderSecondary));
    observer.observe(container);
    return () => observer.disconnect();
  }, [splitView, renderSecondary]);

  // Ctrl+scroll boven het secundaire pane past de EIGEN zoom aan (cursor-verankerd, §10.3);
  // shift = eigen horizontale scroll; gewoon scrollen = gedeelde verticale scroll.
  useEffect(() => {
    if (!splitView) return;
    const container = secondaryContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sv = useAppStore.getState().view.splitView;
      if (!sv) return;
      const st = useAppStore.getState();
      const rect = container.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      if (e.ctrlKey || e.metaKey) {
        const max = st.ui.enableQuarterHourZoom ? 1000 : 400;
        const factor = delta > 0 ? 1 / 1.1 : 1.1;
        const clamped = Math.max(0.5, Math.min(max, sv.secondaryZoom * factor));
        if (clamped === sv.secondaryZoom) return;
        // Zelfde ankerformule als useGanttZoom.zoomAt, met taskTableWidth 0.
        const daysUnderCursor = (anchorX + sv.secondaryScrollX) / sv.secondaryZoom;
        const newScrollX = Math.max(0, daysUnderCursor * clamped - anchorX);
        st.setSplitView({ ...sv, secondaryZoom: clamped, secondaryScrollX: newScrollX });
      } else if (e.shiftKey) {
        st.setSplitView({ ...sv, secondaryScrollX: Math.max(0, sv.secondaryScrollX + delta) });
      } else {
        st.setScroll(st.view.scrollX, st.view.scrollY + delta);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
    // Alleen her-attachen bij aan/uit; de handler leest de actuele splitView uit de store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!splitView]);

  // Sleepbare ratio-balk tussen de panes (§10.3).
  useEffect(() => {
    if (!isResizingSplit) return;
    const handleMove = (e: MouseEvent) => {
      const row = paneRowRef.current;
      const sv = useAppStore.getState().view.splitView;
      if (!row || !sv) return;
      const rect = row.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(0.85, Math.max(0.15, (e.clientX - rect.left) / rect.width));
      setSplitView({ ...sv, ratio });
    };
    const handleUp = () => setIsResizingSplit(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingSplit, setSplitView]);

  // Selectie-klik in het secundaire pane (bandkop → collapse-toggle, net als links).
  const handleSecondaryClick = useCallback((e: React.MouseEvent) => {
    const canvas = secondaryCanvasRef.current;
    const renderer = secondaryRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < HEADER_HEIGHT) return;
    const row = renderer.getRowAtY(y);
    if (row?.kind === 'group') {
      setCollapsedGroupKey(row.key, !row.collapsed);
      return;
    }
    if (row?.kind === 'task') selectTask(row.task.id, e.ctrlKey || e.metaKey, e.shiftKey);
    else deselectAll();
  }, [selectTask, deselectAll, setCollapsedGroupKey]);

  // Render on changes
  useEffect(() => {
    const frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [render]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(render);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  // Sync horizontal scrollbar with canvas scrollX (also re-sync after zoom changes)
  useEffect(() => {
    const hScroll = hScrollRef.current;
    if (!hScroll) return;
    const desired = view.scrollX;
    if (Math.abs(hScroll.scrollLeft - desired) > 1) {
      hScroll.scrollLeft = desired;
    }
  }, [view.scrollX, view.zoom]);

  const defaultTaskName = tTask('defaultTask');
  const defaultMilestoneName = tTask('defaultMilestone');

  // Click handler with collapse/expand, '+' button support, and multi-selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    setHistoTooltip(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    // Bandkop-rij (§4.5): alleen collapse-toggle, geen taak-interactie.
    const hitRow = renderer.getRowAtY(y);
    if (hitRow?.kind === 'group') {
      setCollapsedGroupKey(hitRow.key, !hitRow.collapsed);
      return;
    }

    // Check collapse/expand toggle
    if (renderer.isInTaskTable(x)) {
      const collapseTask = renderer.isCollapseToggle(x, y);
      if (collapseTask) {
        toggleCollapse(collapseTask.id);
        return;
      }

      // Check '+' button (add child task)
      const addTarget = renderer.isAddButton(x, y);
      if (addTarget) {
        const startDate = project.startDate || formatDate(new Date());
        addTask({
          name: defaultTaskName,
          parentId: addTarget.id,
          time: createDefaultTaskTime(startDate, 5),
        });
        return;
      }
    }

    // Normal task selection with multi-select support
    const task = renderer.getTaskAtY(y);
    if (task) {
      if (e.shiftKey) {
        // Shift+click: range selection
        selectTask(task.id, false, true);
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: toggle individual task in selection
        selectTask(task.id, true, false);
      } else {
        // Plain click: single select (deselect others)
        selectTask(task.id, false, false);
      }
    } else {
      deselectAll();
    }
  }, [selectTask, deselectAll, toggleCollapse, addTask, project.startDate, defaultTaskName, setCollapsedGroupKey]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const task = renderer.getTaskAtY(y);
    if (task) {
      setUI({ showTaskDialog: true, editingTaskId: task.id });
    }
  }, [setUI]);

  // Right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    const task = renderer.getTaskAtY(y);
    if (task) {
      selectTask(task.id, false);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  }, [selectTask]);

  // Drag and drop: mousedown (task move/resize + dependency drawing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    // Splitter tussen takentabel en chart: heeft voorrang op alle andere
    // interacties (ook in de header, zodat de hele lijn grijpbaar is).
    if (Math.abs(x - taskTableWidth) <= SPLITTER_GRAB_MARGIN) {
      e.preventDefault();
      setIsResizingTable(true);
      return;
    }

    if (y < HEADER_HEIGHT) return;

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // Shift+drag from task bar starts dependency drawing
      if (e.shiftKey) {
        e.preventDefault();
        setDepDragState({
          sourceTaskId: hit.task.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }

      e.preventDefault();
      setDragState({
        taskId: hit.task.id,
        edge: hit.edge,
        startX: e.clientX,
        originalStart: hit.task.time.earlyStart || hit.task.time.scheduleStart,
        originalFinish: hit.task.time.earlyFinish || hit.task.time.scheduleFinish,
        originalDuration: hit.task.time.scheduleDuration,
      });
      selectTask(hit.task.id, false);
      return;
    }

    // No bar hit: in 'drag' scroll mode, grabbing the empty chart background
    // pans the view (map-style). Only in the gantt area, never the task table
    // (the table has no horizontal pan and stays interactive).
    if (scrollMode === 'drag' && x >= taskTableWidth) {
      e.preventDefault();
      const v = useAppStore.getState().view;
      setPanState({
        startClientX: e.clientX,
        startClientY: e.clientY,
        originScrollX: v.scrollX,
        originScrollY: v.scrollY,
      });
    }
  }, [selectTask, scrollMode, taskTableWidth]);

  // Splitter-drag: breedte volgt de muis (geklemd), opslaan bij loslaten.
  useEffect(() => {
    if (!isResizingTable) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const x = e.clientX - canvas.getBoundingClientRect().left;
      const w = Math.min(TASK_TABLE_MAX_WIDTH, Math.max(TASK_TABLE_MIN_WIDTH, Math.round(x)));
      setUI({ leftPanelWidth: w });
    };

    const handleMouseUp = () => {
      setIsResizingTable(false);
      void saveLeftPanelWidth(useAppStore.getState().ui.leftPanelWidth);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTable, setUI]);

  // Map-style pan: translate pointer movement into scroll offsets. Dragging the
  // canvas content to the right reveals earlier content, so scrollX decreases.
  useEffect(() => {
    if (!panState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panState.startClientX;
      const dy = e.clientY - panState.startClientY;
      setScroll(panState.originScrollX - dx, panState.originScrollY - dy);
    };

    const handleMouseUp = () => setPanState(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panState, setScroll]);

  // Dependency drag: draw temporary line and handle release
  useEffect(() => {
    if (!depDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDepDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (canvas && renderer) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const targetTask = renderer.getTaskAtY(y);
        if (targetTask && targetTask.id !== depDragState.sourceTaskId && x >= useAppStore.getState().ui.leftPanelWidth) {
          // Create Finish-to-Start dependency
          addSequence({
            predecessorId: depDragState.sourceTaskId,
            successorId: targetTask.id,
            type: 'FINISH_START',
            lagDays: 0,
          });
        }
      }
      setDepDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [depDragState, addSequence]);

  // Draw temporary dependency line on overlay canvas
  useEffect(() => {
    const depCanvas = depLineCanvasRef.current;
    const container = containerRef.current;
    if (!depCanvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    depCanvas.width = rect.width * dpr;
    depCanvas.height = rect.height * dpr;
    depCanvas.style.width = `${rect.width}px`;
    depCanvas.style.height = `${rect.height}px`;

    const ctx = depCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (depDragState) {
      const canvasRect = depCanvas.getBoundingClientRect();
      const startX = depDragState.sourceX - canvasRect.left;
      const startY = depDragState.sourceY - canvasRect.top;
      const endX = depDragState.currentX - canvasRect.left;
      const endY = depDragState.currentY - canvasRect.top;

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim() || '#F59E0B';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.setLineDash([]);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }, [depDragState]);

  // Drag and drop: mousemove (via native event for performance)
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const pixelDelta = e.clientX - dragState.startX;
      const daysDelta = Math.round(pixelDelta / view.zoom);
      if (daysDelta === 0) return;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);

      if (dragState.edge === 'body') {
        // Move entire task
        const newStart = addCalendarDays(origStart, daysDelta);
        const newFinish = addCalendarDays(origFinish, daysDelta);
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(newStart),
            scheduleFinish: formatDate(newFinish),
            earlyStart: formatDate(newStart),
            earlyFinish: formatDate(newFinish),
          },
        });
      } else if (dragState.edge === 'right') {
        // Resize from right (change duration/finish)
        const newFinish = addCalendarDays(origFinish, daysDelta);
        const newDuration = Math.max(1, diffCalendarDays(origStart, newFinish));
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleFinish: formatDate(newFinish),
            earlyFinish: formatDate(newFinish),
            scheduleDuration: newDuration,
          },
        });
      } else if (dragState.edge === 'left') {
        // Resize from left (change start/duration)
        const newStart = addCalendarDays(origStart, daysDelta);
        const newDuration = Math.max(1, diffCalendarDays(newStart, origFinish));
        updateTask(dragState.taskId, {
          time: {
            ...useAppStore.getState().tasks.find(t => t.id === dragState.taskId)!.time,
            scheduleStart: formatDate(newStart),
            earlyStart: formatDate(newStart),
            scheduleDuration: newDuration,
          },
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, view.zoom, updateTask]);

  // Cursor changes on hover + tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState || depDragState || panState) {
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    // Splitter-affordance: col-resize-cursor rond de tabel/chart-grens.
    if (Math.abs(x - taskTableWidth) <= SPLITTER_GRAB_MARGIN) {
      setCursor('col-resize');
      setTooltip(null);
      return;
    }

    if (y < HEADER_HEIGHT) {
      setCursor('default');
      setTooltip(null);
      return;
    }

    // Check for task bar edges
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      if (hit.edge === 'left' || hit.edge === 'right') {
        setCursor('ew-resize');
      } else {
        setCursor(e.shiftKey ? 'crosshair' : 'grab');
      }
      // Show tooltip for the hovered task
      setTooltip({ x: e.clientX, y: e.clientY, task: hit.task });
      return;
    }

    // Check if hovering task row in gantt area (not just bar)
    const hoveredTask = renderer.getTaskAtY(y);
    if (hoveredTask && x >= taskTableWidth) {
      setTooltip({ x: e.clientX, y: e.clientY, task: hoveredTask });
    } else {
      setTooltip(null);
    }

    // Check for collapse toggle or '+' button
    if (renderer.isInTaskTable(x)) {
      if (renderer.isCollapseToggle(x, y) || renderer.isAddButton(x, y)) {
        setCursor('pointer');
        setTooltip(null);
        return;
      }
    }

    // In 'drag' scroll mode, show a grab affordance over the pannable chart
    // background so panning is discoverable.
    if (scrollMode === 'drag' && x >= taskTableWidth) {
      setCursor('grab');
      return;
    }

    setCursor('default');
  }, [dragState, depDragState, panState, scrollMode, taskTableWidth]);

  // Hide tooltip on mouse leave
  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScroll(target.scrollLeft, view.scrollY);
  }, [setScroll, view.scrollY]);

  const startDate = project.startDate || formatDate(new Date());

  // Format date for tooltip display
  const formatTooltipDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = parseDate(dateStr);
      return `${d.getUTCDate().toString().padStart(2, '0')}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Pane-rij (§10): primair pane (met canvas-taaktabel) + optioneel secundair tijdvenster */}
      <div ref={paneRowRef} className="flex-1 flex overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden relative"
        style={{ width: splitView ? `${splitView.ratio * 100}%` : '100%', flexShrink: 0 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            cursor: isResizingTable
              ? 'col-resize'
              : panState
                ? 'grabbing'
                : dragState
                  ? (dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
                  : depDragState
                    ? 'crosshair'
                    : cursor,
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />
        {/* Overlay canvas for dependency drag line */}
        <canvas
          ref={depLineCanvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="gantt-tooltip"
            style={{
              left: tooltip.x - (containerRef.current?.getBoundingClientRect().left || 0) + 16,
              top: tooltip.y - (containerRef.current?.getBoundingClientRect().top || 0) - 10,
            }}
          >
            <div className="tooltip-title">{tooltip.task.name}</div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.wbs')}:</span>
              <span className="tooltip-value">{tooltip.task.wbsCode || '-'}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.duration')}:</span>
              <span className="tooltip-value">{tooltip.task.time.scheduleDuration}d</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.start')}:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyStart || tooltip.task.time.scheduleStart)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.finish')}:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyFinish || tooltip.task.time.scheduleFinish)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('tooltip.status')}:</span>
              <span className="tooltip-value">{tooltip.task.status}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.critical')}:</span>
              <span className={tooltip.task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}>
                {tooltip.task.time.isCritical ? tCommon('yes') : tCommon('no')}
              </span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('properties.totalFloat')}</span>
              <span className="tooltip-value">{tooltip.task.time.totalFloat}d</span>
            </div>
          </div>
        )}
      </div>
      {/* Secundair pane (§10): eigen tijdvenster, gedeelde rijen + verticale scroll */}
      {splitView && (
        <>
          <div
            data-testid="split-ratio-bar"
            onMouseDown={e => { e.preventDefault(); setIsResizingSplit(true); }}
            style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: 'var(--theme-border)' }}
          />
          <div
            ref={secondaryContainerRef}
            data-testid="split-secondary-pane"
            className="flex-1 overflow-hidden relative"
          >
            <canvas
              ref={secondaryCanvasRef}
              className="absolute inset-0"
              onClick={handleSecondaryClick}
            />
          </div>
        </>
      )}
      </div>
      {/* Histogramstrook (fase 2.5, §6.4) — derde canvas met gedeelde X-as */}
      {showHistogram && (
        <>
          <div
            className="histogram-splitter"
            onMouseDown={e => { e.preventDefault(); setIsResizingHistogram(true); }}
            style={{ height: 5, flexShrink: 0, cursor: 'row-resize', background: 'var(--theme-border)' }}
          />
          <div
            ref={histogramContainerRef}
            className="relative overflow-hidden"
            style={{ height: histogramHeight, flexShrink: 0 }}
          >
            <canvas
              ref={histogramCanvasRef}
              className="absolute inset-0"
              style={{ cursor: 'pointer' }}
              onClick={handleHistogramClick}
            />
            {/* Verouderd-hint (A6): het histogram volgt de belasting direct, maar de CPM-datums
                eronder kunnen na een datum-mutatie verouderd zijn — subtiel melden. */}
            {scheduleStale && (
              <div
                className="absolute top-1 right-2 text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
                style={{ background: 'var(--theme-surface)', color: 'var(--theme-warning-text)', opacity: 0.9 }}
              >
                ⚠ {tCommon('resource.histogram.staleHint')}
              </div>
            )}
            {histoTooltip && (
              <div
                className="gantt-tooltip"
                style={{
                  left: histoTooltip.x - (histogramContainerRef.current?.getBoundingClientRect().left || 0) + 14,
                  top: histoTooltip.y - (histogramContainerRef.current?.getBoundingClientRect().top || 0) - 10,
                }}
              >
                {histoTooltip.lines.map((l, i) => (
                  <div key={i} className={i === 0 ? 'tooltip-title' : 'tooltip-row'}>{l}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mini-map (fase 2.7, §11): thumbnail van de hele projectperiode + viewport-kader
          (toont het primaire pane bij split view, §10.3) */}
      {showMiniMap && (
        <MiniMap originDate={effectiveViewStart} chartWidth={primaryChartWidth} />
      )}

      {/* Horizontal scrollbar */}
      <div
        ref={hScrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: 14, flexShrink: 0 }}
        onScroll={handleHScroll}
      >
        <div style={{ width: totalContentWidth, height: 1 }} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          traceActive={traceMode !== 'off'}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (contextMenu.task) setUI({ showTaskDialog: true, editingTaskId: contextMenu.task.id });
          }}
          onAddSubtask={() => {
            const parentId = contextMenu.task?.id || null;
            addTask({
              name: defaultTaskName,
              parentId,
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
          onAddMilestone={() => {
            addTask({
              name: defaultMilestoneName,
              isMilestone: true,
              taskType: 'ATTENDANCE',
              parentId: contextMenu.task?.id || null,
              time: createDefaultTaskTime(startDate, 0),
            });
          }}
          onAddRelation={() => {
            if (contextMenu.task) {
              setUI({ showDependencyMode: true, dependencySourceId: contextMenu.task.id });
            }
          }}
          onSaveTemplate={() => {
            if (!contextMenu.task) return;
            const st = useAppStore.getState();
            const tpl = saveBranchAsWbsTemplate(contextMenu.task.name, contextMenu.task.id, st.tasks, st.sequences);
            setToast({ message: tTask('structure.templateSaved', { name: tpl.name }), type: 'info' });
          }}
          onTracePath={() => {
            if (traceMode !== 'off') {
              setUI({ traceMode: 'off' });
            } else if (contextMenu.task) {
              selectTask(contextMenu.task.id);
              setUI({ traceMode: 'both' });
            }
          }}
          onToggleCollapse={() => {
            if (contextMenu.task) toggleCollapse(contextMenu.task.id);
          }}
          onDelete={() => {
            if (contextMenu.task) deleteTask(contextMenu.task.id);
          }}
          onAddTask={() => {
            addTask({
              name: defaultTaskName,
              time: createDefaultTaskTime(startDate, 5),
            });
          }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`gantt-toast ${toast.type === 'error' ? 'toast-error' : 'toast-info'}`}
          onClick={() => setToast(null)}
          style={{ cursor: 'pointer' }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
