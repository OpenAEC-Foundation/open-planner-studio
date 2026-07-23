import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { GanttRenderer, GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { HistogramRenderer, HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { setGanttChartWidth, setGanttScrollBounds, ORIGIN_PADDING_DAYS, computeFitToProject } from '@/utils/ganttViewport';
import { MiniMap } from './MiniMap';
import { diffDays, formatDate, parseDate, parseInstant, addCalendarDays } from '@/utils/dateUtils';
import { effectiveCalendarByTask } from '@/services/subdayIo';
import { durationSuffixesFrom } from '@/utils/taskDuration';
import { useDisplayDate } from '@/hooks/displayDate';
import { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { isTreeMode } from '@/engine/view/visibleRows';
import { ContextMenu } from './ContextMenu';
import { RelationTypePopover } from './RelationTypePopover';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { useGanttZoom } from '@/hooks/useGanttZoom';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';
import { useSplitter } from '@/hooks/useSplitter';
import { saveLeftPanelWidth, saveHistogramHeight, TASK_TABLE_MIN_WIDTH, TASK_TABLE_MAX_WIDTH, HISTOGRAM_MIN_HEIGHT, HISTOGRAM_MAX_HEIGHT } from '@/utils/settingsStore';
import { useCanvasLayer } from './hooks/useCanvasLayer';
import { useBarDrag } from './hooks/useBarDrag';
import { usePan } from './hooks/usePan';
import { useBoxSelect } from './hooks/useBoxSelect';
import { useDependencyDraw } from './hooks/useDependencyDraw';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 50;
// Halve breedte van de grijpzone rond de tabel/chart-scheiding (splitter).
const SPLITTER_GRAB_MARGIN = 4;
// Zelfde default als de kale '0'-toets in useZoomShortcuts.ts (Zoom reset, leeg-canvas-contextmenu).
const DEFAULT_ZOOM = 30;

interface ContextMenuState {
  x: number;
  y: number;
  task: Task | null;
  /** Fase 2.10 golf 2: rechtsklik landde op de balk zelf (i.p.v. alleen de rij) — bepaalt of de
   *  balk-specifieke items (relatie leggen vanaf hier / constraint instellen) getoond worden. */
  barHit: boolean;
  /** Fase 2.10 golf 2: rechtsklik op een bandkop-rij (gegroepeerde weergave). */
  group: { key: string; collapsed: boolean } | null;
}

interface TooltipState {
  x: number;
  y: number;
  task: Task;
}

interface ToastState {
  message: string;
  type: 'error' | 'info';
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
  const dd = useDisplayDate();

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const barSplitMode = useAppStore(s => s.ui.barSplitMode);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const view = useAppStore(s => s.view);
  const pendingFit = useAppStore(s => s.view.pendingFit);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const selectTasks = useAppStore(s => s.selectTasks);
  const deselectAll = useAppStore(s => s.deselectAll);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const addTask = useAppStore(s => s.addTask);
  const addSequence = useAppStore(s => s.addSequence);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const setScroll = useAppStore(s => s.setScroll);
  const setUI = useAppStore(s => s.setUI);
  // Fase 2.10 golf 2 (contextmenu's): golf-1-helpers + bestaande taak-acties die het contextmenu
  // nu ook ontsluit.
  const indentTasks = useAppStore(s => s.indentTasks);
  const outdentTasks = useAppStore(s => s.outdentTasks);
  const setTaskCalendar = useAppStore(s => s.setTaskCalendar);
  const setTaskProgress = useAppStore(s => s.setTaskProgress);
  const pasteTasks = useAppStore(s => s.pasteTasks);
  const taskClipboard = useAppStore(s => s.taskClipboard);
  // Golf 1-docstring (uiSlice.ts): expandAll/collapseAll werken op de summary-taken
  // (collapsedTaskIds) en zijn expliciet "voor het bandkop-contextmenu" gebouwd.
  const expandAll = useAppStore(s => s.expandAll);
  const collapseAll = useAppStore(s => s.collapseAll);
  const setZoom = useAppStore(s => s.setZoom);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
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
  useZoomShortcuts({ zoomAt, containerRef, taskTableWidth });

  const rendererRef = useRef<GanttRenderer | null>(null);
  // Split view (fase 2.7, §10): secundair tijdvenster + sleepbare ratio-balk.
  const paneRowRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryRendererRef = useRef<GanttRenderer | null>(null);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [primaryChartWidth, setPrimaryChartWidth] = useState(0);
  // Onderdrukt de eerstvolgende click-afhandeling ná een gepromoveerd kader (en na een Escape-annulering
  // ervan) — anders deselecteert/hertekent de gewone click-logica de zojuist gezette boxselectie.
  // Gedeeld met de pan- en box-select-hooks.
  const justBoxSelectedRef = useRef(false);
  const [cursor, setCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Fase 2.10 (item 3): popover die na een dependency-drag verschijnt om het relatietype/lag
  // meteen te corrigeren — de sequence zelf bestaat al (FS+lag0, zie de dependency-drag-mouseup
  // hieronder), dit is puur een correctie-UI.
  const [relationPopover, setRelationPopover] = useState<{ sequenceId: string; x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [histoTooltip, setHistoTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const localizedMonths = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);
  // Vertaalde duur-eenheid-suffixen voor de duurkolom-weergave (§6.4/§11). Gememoized op taal zodat de
  // renderer-opts stabiel blijven tussen renders (geen memo-bust per frame).
  const durationSuffixes = useMemo(() => durationSuffixesFrom(tCommon), [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fase 2.8b (§6.1/§6.9): effectieve kalender per taak (task.calendarId → bibliotheek, anders de
  // projectkalender). De renderer leest hieruit per taak uur- vs dag-modus en de banden voor de
  // balk-opsplitsing. Gememoized zodat er niet per frame een map gebouwd wordt.
  const effectiveCalById = useMemo(
    () => effectiveCalendarByTask(tasks, calendar, calendars),
    [tasks, calendar, calendars],
  );

  // ── Muisgebaar-hooks (audit P20/B1) ───────────────────────────────────────
  // De interactie-logica die vroeger als losse state + effecten in dit component woonde, zit nu per
  // gebaar in een eigen hook (elk bezit zijn eigen state + window-listeners). De centrale
  // mousedown-dispatch (handleMouseDown) doet nog de hit-test en roept de juiste `start…`-functie
  // aan; de hover-guard leest de gebundelde `active`-vlaggen i.p.v. een lange lijst losse states.
  const barDrag = useBarDrag({ zoom: view.zoom, enableQuarterHourZoom, calendar, effectiveCalById, updateTask });
  const pan = usePan({ setScroll, justBoxSelectedRef });
  const boxSelect = useBoxSelect({ canvasRef, rendererRef, selectTasks, deselectAll, justBoxSelectedRef });
  const depDraw = useDependencyDraw({
    canvasRef,
    containerRef,
    depLineCanvasRef,
    rendererRef,
    addSequence,
    onRelationCreated: (sequenceId, x, y) => setRelationPopover({ sequenceId, x, y }),
  });

  // Twee generieke sleep-splitters (pakket L, `useSplitter`): tabel/chart-breedte + histogram-hoogte.
  // `max` altijd als functie (de hook vangt zijn opts bij drag-start; een kaal getal zou mid-drag
  // stale kunnen zijn). `computeSize` valt terug op NaN als de ref (heel even) ontbreekt, en
  // `onResize` slaat NaN over — zo blijft het "doe niets als het element weg is"-gedrag behouden.
  const tableSplitter = useSplitter({
    min: TASK_TABLE_MIN_WIDTH,
    max: () => TASK_TABLE_MAX_WIDTH,
    computeSize: (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return NaN;
      return Math.round(e.clientX - canvas.getBoundingClientRect().left);
    },
    onResize: (w) => { if (!Number.isNaN(w)) setUI({ leftPanelWidth: w }); },
    onCommit: () => { void saveLeftPanelWidth(useAppStore.getState().ui.leftPanelWidth); },
  });
  const histogramSplitter = useSplitter({
    min: HISTOGRAM_MIN_HEIGHT,
    max: () => HISTOGRAM_MAX_HEIGHT,
    computeSize: (e) => {
      const container = histogramContainerRef.current;
      if (!container) return NaN;
      return Math.round(container.getBoundingClientRect().bottom - e.clientY);
    },
    onResize: (h) => { if (!Number.isNaN(h)) setUI({ histogramHeight: h }); },
    onCommit: () => { void saveHistogramHeight(useAppStore.getState().ui.histogramHeight); },
  });

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

  // Histogram-teken-callback (§6.4): dpr/resize-boilerplate zit nu in useCanvasLayer; hier alleen de
  // HistogramRenderer opbouwen + tekenen. `extraDeps: [histogramHeight]` bewaart de originele
  // expliciete herteken-trigger op hoogte-wijziging.
  const drawHistogram = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const renderer = new HistogramRenderer(ctx, {
      series: histogramSeries,
      picker: histogramPicker,
      selectedResourceId: histogramResourceId,
      view: effectiveView,
      canvasWidth: width,
      canvasHeight: height,
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

  useCanvasLayer({
    canvasRef: histogramCanvasRef,
    containerRef: histogramContainerRef,
    draw: drawHistogram,
    enabled: showHistogram,
    extraDeps: [histogramHeight],
  });

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

  // Primaire Gantt-teken-callback: dpr/resize-boilerplate zit nu in useCanvasLayer; hier alleen de
  // viewport-registratie + het opbouwen/tekenen van de GanttRenderer (in CSS-pixels, `width`/`height`).
  const drawPrimary = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Registreer het zichtbare tijdvenster (primaire pane) voor de recenter-formule van
    // setTimeScale (§3.3) en voor het mini-map-viewportkader (§11).
    const chartW = Math.max(0, width - taskTableWidth);
    setGanttChartWidth(chartW);
    setPrimaryChartWidth(prev => (Math.abs(prev - chartW) > 1 ? chartW : prev));

    // Fix 2 (fase 2.8a QA): registreer de werkelijke scrolbare grenzen bij elke render, zodat
    // `setScroll` (viewSlice) nooit voorbij de content kan klemmen — de vorige versie klemde
    // alleen naar 0, zonder bovengrens, waardoor een verticale overscroll (of horizontaal ná een
    // extreme zoom-uit/-in-cyclus) de taakbalken-laag permanent buiten beeld kon duwen.
    setGanttScrollBounds({
      maxScrollX: Math.max(0, totalContentWidth - width),
      maxScrollY: Math.max(0, viewRows.length * ROW_HEIGHT - (height - HEADER_HEIGHT)),
    });

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
      canvasWidth: width,
      canvasHeight: height,
      taskTableWidth,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      localizedMonths,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
      effectiveCalById,
      barSplitMode,
      enableHourPlanning,
      durationDisplay,
      durationSuffixes,
      externalStaleLabel: tTask('externalLinks.stale'),
      highContrast: uiTheme === 'high-contrast',
    };

    const renderer = new GanttRenderer(ctx, opts);
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, taskTableWidth, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay, totalContentWidth, effectiveCalById, barSplitMode, enableHourPlanning, durationDisplay, durationSuffixes]);

  useCanvasLayer({ canvasRef, containerRef, draw: drawPrimary });

  // --- Split view (fase 2.7, §10): secundair tijdvenster met eigen zoom/scrollX; gedeelde
  // rijen + scrollY; geen canvas-taaktabel (taskTableWidth 0) — die tekent alleen links. ---
  const drawSecondary = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!splitView) return;
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
      canvasWidth: width,
      canvasHeight: height,
      taskTableWidth: 0,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      localizedMonths,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
      effectiveCalById,
      barSplitMode,
      highContrast: uiTheme === 'high-contrast',
    });
    secondaryRendererRef.current = renderer;
    renderer.render();
  }, [splitView, viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay, effectiveCalById, barSplitMode]);

  useCanvasLayer({
    canvasRef: secondaryCanvasRef,
    containerRef: secondaryContainerRef,
    draw: drawSecondary,
    enabled: !!splitView,
  });

  // Reset de secundaire renderer-ref zodra split view uit gaat (het canvas verdwijnt dan; de
  // klik-handler ernaar mag geen stale renderer meer zien). Was voorheen inline in het render-effect.
  useEffect(() => {
    if (!splitView) secondaryRendererRef.current = null;
  }, [splitView]);

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

  // Open-fit (issue #16, WENS 1): fileSlice zet `view.pendingFit` na een load; hier — waar de
  // viewport-breedte bekend is — voeren we de gedeelde computeFitToProject uit zodat het HELE
  // project in beeld komt (zoals Ctrl+0), en wissen het signaal meteen. Leeg project: geen fit
  // (het "vandaag"-gedrag blijft). Alleen op de load-trigger; undo/redo raakt `view` niet.
  useEffect(() => {
    if (!pendingFit) return;
    const container = containerRef.current;
    const clearPendingFit = useAppStore.getState().clearPendingFit;
    if (!container) return;
    if (tasks.length === 0) { clearPendingFit(); return; }
    const rect = container.getBoundingClientRect();
    const fit = computeFitToProject(tasks, rect.width - taskTableWidth, enableQuarterHourZoom);
    clearPendingFit();
    if (!fit) return;
    const st = useAppStore.getState();
    st.setZoom(fit.zoom);
    st.setViewStartDate(fit.viewStartDate);
    st.setScroll(fit.scrollX, 0);
  }, [pendingFit, tasks, taskTableWidth, enableQuarterHourZoom]);

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

  // WENS 2 (reveal-on-select): klikt de gebruiker een taak in de linker takenlijst en valt zijn
  // balk qua TIJD volledig buiten het zichtbare venster, scroll dan horizontaal zodat hij in beeld
  // komt (kleine marge). Al (deels) zichtbaar → niets doen (geen sprong). Alléén horizontaal
  // scrollen; zoom onaangeroerd. Gebruikt exact dezelfde effectiveViewStart/dateToX-conventie als de
  // renderer (effectiveViewStart = vroegste start − ORIGIN_PADDING_DAYS; content-x = tableW +
  // dagen·zoom) zodat de positie 1-op-1 klopt. Alles vers uit de store → geen closure-deps.
  const revealTaskIfOffscreen = useCallback((task: Task) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (!startStr || !endStr) return; // geen datums (bv. ongeplande taak): niets te onthullen.

    const st = useAppStore.getState();
    const v = st.view;
    const tableW = st.ui.leftPanelWidth;
    const rect = canvas.getBoundingClientRect();
    const usable = rect.width - tableW;
    if (usable <= 0) return;

    // effectiveViewStart: zelfde veldvolgorde + ORIGIN_PADDING_DAYS als de render-memo.
    let earliest = parseDate(v.viewStartDate);
    for (const tk of st.tasks) {
      const s = tk.time.earlyStart || tk.time.scheduleStart || tk.time.lateStart;
      if (s) { const d = parseDate(s); if (d.getTime() < earliest.getTime()) earliest = d; }
    }
    const evs = addCalendarDays(earliest, -ORIGIN_PADDING_DAYS);

    // Balk-uiteinden in content-x (dateToX zonder de −scrollX-term), zelfde uur/dag-splitsing als
    // GanttRenderer.barGeometry: uur-taak [start, finish), dag-taak [start, finish+1 dag].
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const end = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const msPerDay = 86400000;
    const cx1 = tableW + ((start.getTime() - evs.getTime()) / msPerDay) * v.zoom;
    const cx2 = tableW + ((end.getTime() - evs.getTime()) / msPerDay) * v.zoom + (hourMode ? 0 : v.zoom);

    // Zichtbaar content-venster: canvas-x = content-x − scrollX ∈ [tableW, rect.width].
    const visibleLeft = tableW + v.scrollX;
    const visibleRight = visibleLeft + usable;
    if (cx2 > visibleLeft && cx1 < visibleRight) return; // al (deels) in beeld → geen sprong.

    // Lijn de START links uit met een kleine marge (dekt ook een balk breder dan het venster).
    const REVEAL_MARGIN_PX = 40;
    st.setScroll(Math.max(0, cx1 - tableW - REVEAL_MARGIN_PX), v.scrollY);
  }, []);

  // Click handler with collapse/expand, '+' button support, and multi-selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Fase 2.10 golf 4: een net voltooid (of met Escape geannuleerd) selectie-kader onderdrukt de
    // eerstvolgende click — anders overschrijft/deselecteert de gewone klik-afhandeling hieronder
    // meteen de zojuist gezette boxselectie (of doet iets onbedoelds na de Escape-annulering).
    if (justBoxSelectedRef.current) {
      justBoxSelectedRef.current = false;
      return;
    }
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
        // WENS 2: onthul de balk als hij qua tijd buiten beeld ligt, maar ALLEEN als de klik in de
        // linker takenlijst viel (niet bij ctrl/shift-multiselect, en niet bij een klik in het
        // Gantt-gebied zelf — anders springt het beeld weg bij wegklikken/verslepen daar).
        if (renderer.isInTaskTable(x)) {
          revealTaskIfOffscreen(task);
        }
      }
    } else {
      deselectAll();
    }
  }, [selectTask, deselectAll, toggleCollapse, addTask, project.startDate, defaultTaskName, setCollapsedGroupKey, revealTaskIfOffscreen]);

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
    // Fase 2.10 fix-golf 2: een balk-hover-tooltip die nog zichtbaar is bij het rechtsklikken zou
    // anders over de bovenste menu-items blijven hangen (z-tooltip > z-50 van het menu). Wissen is
    // de primaire fix; de z-index-bump hieronder is het vangnet voor tooltips die via mousemove
    // ná het openen alsnog opnieuw gezet zouden worden (zie de guard in handleMouseMove).
    setTooltip(null);
    setHistoTooltip(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < HEADER_HEIGHT) return;

    // Bandkop-rij (fase 2.10 golf 2): eigen, klein contextmenu — zelfde detectie als handleClick.
    const hitRow = renderer.getRowAtY(y);
    if (hitRow?.kind === 'group') {
      setContextMenu({
        x: e.clientX, y: e.clientY, task: null, barHit: false,
        group: { key: hitRow.key, collapsed: hitRow.collapsed },
      });
      return;
    }

    const task = renderer.getTaskAtY(y);
    if (task) {
      selectTask(task.id, false);
    }
    // Balk-hit (fase 2.10 golf 2): dezelfde hit-test als drag-start; geeft null op de rij ernaast,
    // op een mijlpaal en op een summary-balk (getTaskBarBounds sluit die bewust uit) — die krijgen
    // dan gewoon het rij-menu zonder balk-specifieke items, zoals bedoeld.
    const barHit = !!task && !!renderer.getTaskBarBounds(x, y);
    setContextMenu({ x: e.clientX, y: e.clientY, task, barHit, group: null });
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
      tableSplitter.start();
      return;
    }

    if (y < HEADER_HEIGHT) return;

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // Shift+drag from task bar starts dependency drawing
      if (e.shiftKey) {
        e.preventDefault();
        depDraw.startDepDraw({
          sourceTaskId: hit.task.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }

      e.preventDefault();
      barDrag.startBarDrag({
        taskId: hit.task.id,
        edge: hit.edge,
        startX: e.clientX,
        originalStart: hit.task.time.earlyStart || hit.task.time.scheduleStart,
        originalFinish: hit.task.time.earlyFinish || hit.task.time.scheduleFinish,
        originalDuration: hit.task.time.scheduleDuration,
        originalDurationMinutes: hit.task.time.durationMinutes,
      });
      selectTask(hit.task.id, false);
      return;
    }

    // No bar hit, lege achtergrond. Takentabel: pant nooit → altijd box-select-kandidaat (fase 2.10
    // golf 4). Chart: in 'drag' scroll mode wint pannen (map-style, ongewijzigd gedrag) — BEHALVE met
    // Ctrl/Cmd ingedrukt, dan box-select (anders is box-select in deze modus onbereikbaar). In de
    // overige scroll-modi is lege chart-achtergrond sowieso box-select-kandidaat.
    if (renderer.isInTaskTable(x)) {
      e.preventDefault();
      boxSelect.startBoxSelect({ startClientX: e.clientX, startClientY: e.clientY });
      return;
    }

    if (scrollMode === 'drag' && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const v = useAppStore.getState().view;
      pan.startPan({
        startClientX: e.clientX,
        startClientY: e.clientY,
        originScrollX: v.scrollX,
        originScrollY: v.scrollY,
      });
      return;
    }

    e.preventDefault();
    boxSelect.startBoxSelect({ startClientX: e.clientX, startClientY: e.clientY });
  }, [selectTask, scrollMode, taskTableWidth, tableSplitter, depDraw, barDrag, boxSelect, pan]);

  // Cursor changes on hover + tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Fase 2.10 fix-golf 2: terwijl het contextmenu open staat mag een mousemove de balk-tooltip
    // niet opnieuw zetten (anders duikt hij, ondanks het wissen bij het openen, alsnog weer op
    // over de menu-items zodra de muis binnen het canvas beweegt). De gebundelde `active`-vlaggen
    // (audit P20) vervangen de vroegere lange lijst losse drag-states — één per gebaar-hook.
    if (barDrag.active || depDraw.active || pan.active || boxSelect.active || contextMenu) {
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
    // background so panning is discoverable — maar met Ctrl/Cmd ingedrukt schakelt de
    // achtergrond naar box-select, dus toon dan het crosshair (zelfde signaal als elders).
    if (scrollMode === 'drag' && x >= taskTableWidth) {
      setCursor(e.ctrlKey || e.metaKey ? 'crosshair' : 'grab');
      return;
    }

    setCursor('default');
  }, [barDrag.active, depDraw.active, pan.active, boxSelect.active, contextMenu, scrollMode, taskTableWidth]);

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
  // Tooltip-datums volgen de datumnotatie-instelling (taak #53); leeg → '-'.
  const formatTooltipDate = (dateStr: string) => (dateStr ? dd.date(dateStr) : '-');

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
            cursor: tableSplitter.isResizing
              ? 'col-resize'
              : pan.panState
                ? 'grabbing'
                : barDrag.dragState
                  ? (barDrag.dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
                  : depDraw.active
                    ? 'crosshair'
                    : boxSelect.boxSelectState
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

        {/* Box-selection kader (fase 2.10 golf 4): half-transparant rechthoekje tijdens de sleep,
            in viewport-coördinaten — hoeft niet mee te scrollen (§spec), de rij-intersectie zelf
            wordt op het actuele moment berekend (getTaskIdsInYRange). */}
        {boxSelect.boxSelectState && (() => {
          const boxSelectState = boxSelect.boxSelectState;
          const containerRect = containerRef.current?.getBoundingClientRect();
          const left = (containerRect?.left ?? 0);
          const top = (containerRect?.top ?? 0);
          const x1 = Math.min(boxSelectState.startClientX, boxSelectState.currentClientX) - left;
          const y1 = Math.min(boxSelectState.startClientY, boxSelectState.currentClientY) - top;
          const w = Math.abs(boxSelectState.currentClientX - boxSelectState.startClientX);
          const h = Math.abs(boxSelectState.currentClientY - boxSelectState.startClientY);
          return (
            <div
              data-testid="box-select-rect"
              className="absolute"
              style={{
                left: x1,
                top: y1,
                width: w,
                height: h,
                border: '1px solid var(--theme-accent)',
                pointerEvents: 'none',
                zIndex: 5,
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'var(--theme-accent)', opacity: 0.15 }} />
            </div>
          );
        })()}

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
            onMouseDown={e => { e.preventDefault(); histogramSplitter.start(); }}
            style={{ height: 5, flexShrink: 0, cursor: 'row-resize', background: 'var(--theme-border)' }}
          />
          <div
            ref={histogramContainerRef}
            className="relative overflow-hidden"
            style={{ height: histogramHeight, flexShrink: 0 }}
            data-tour-anchor="histogram-strip"
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
          barHit={contextMenu.barHit}
          group={contextMenu.group}
          traceActive={traceMode !== 'off'}
          isTreeMode={isTreeMode(view)}
          calendars={calendars}
          canPaste={!!taskClipboard}
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
          onInsertAbove={() => {
            if (!contextMenu.task) return;
            addTask({
              name: defaultTaskName,
              time: createDefaultTaskTime(startDate, 5),
              position: { anchorId: contextMenu.task.id, where: 'above' },
            });
          }}
          onInsertBelow={() => {
            if (!contextMenu.task) return;
            addTask({
              name: defaultTaskName,
              time: createDefaultTaskTime(startDate, 5),
              position: { anchorId: contextMenu.task.id, where: 'below' },
            });
          }}
          onIndent={() => { if (contextMenu.task) indentTasks([contextMenu.task.id]); }}
          onOutdent={() => { if (contextMenu.task) outdentTasks([contextMenu.task.id]); }}
          onToggleMilestone={() => {
            if (contextMenu.task) updateTask(contextMenu.task.id, { isMilestone: !contextMenu.task.isMilestone });
          }}
          onSetCalendar={(calendarId) => {
            if (contextMenu.task) setTaskCalendar(contextMenu.task.id, calendarId);
          }}
          onSetProgress={(completion) => {
            if (contextMenu.task) setTaskProgress(contextMenu.task.id, completion);
          }}
          onSetPriority={(priority) => {
            if (contextMenu.task) updateTask(contextMenu.task.id, { priority });
          }}
          onStartRelationFromBar={() => {
            if (contextMenu.task) {
              setUI({ showDependencyMode: true, dependencySourceId: contextMenu.task.id });
            }
          }}
          onPaste={() => { pasteTasks(); }}
          onZoomReset={() => { setZoom(DEFAULT_ZOOM); setScroll(0, 0); }}
          onFitToProject={() => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (tasks.length === 0) { setZoom(DEFAULT_ZOOM); setScroll(0, 0); return; }
            const fit = computeFitToProject(tasks, rect.width - taskTableWidth, enableQuarterHourZoom);
            if (!fit) return;
            setZoom(fit.zoom);
            setViewStartDate(fit.viewStartDate);
            setScroll(fit.scrollX, 0);
          }}
          onToggleGroupCollapse={() => {
            if (contextMenu.group) setCollapsedGroupKey(contextMenu.group.key, !contextMenu.group.collapsed);
          }}
          onExpandAll={() => expandAll()}
          onCollapseAll={() => collapseAll()}
        />
      )}

      {relationPopover && (
        <RelationTypePopover
          sequenceId={relationPopover.sequenceId}
          x={relationPopover.x}
          y={relationPopover.y}
          onClose={() => setRelationPopover(null)}
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
