import {
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { resolveUIFontStack } from '@/utils/uiFont';
import { scopeTaskResources } from '@/utils/taskResourceScope';
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { MiniMap } from './MiniMap';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { effectiveCalendarByTask } from '@/services/subdayIo';
import { durationSuffixesFrom } from '@/utils/taskDuration';
import type { Task } from '@/types/task';
import { isTreeMode } from '@/engine/view/visibleRows';
import { ContextMenu } from './ContextMenu';
// Issue #42/#45: reikwijdte (aangeklikte taak = handgreep, selectie = bereik) + de bulk-uitvoering
// als ÉÉN undo-stap. DOM-vrij afgezonderd zodat de regressiebatterij dezelfde functies draait.
import { contextMenuOutlineScope, contextMenuBulk } from './contextMenuScope';
import { RelationTypePopover } from './RelationTypePopover';
import { createRelationDraftWithFeedback } from '@/state/relationActions';
// Issue #58: hover-tooltip die zichzelf binnen het venster houdt (nodig zodra de titel wrapt).
import { HoverTooltip } from './HoverTooltip';
import { TaskTooltipContent } from './TaskTooltipContent';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { dateToX as axisDateToX } from '@/engine/renderer/timeAxis';
import { saveLeftPanelWidth, saveHistogramHeight } from '@/utils/settingsStore';
// K-item 33: de pure afleidingen achter de weergave + de opbouw van `GanttRenderOptions`. Ze zijn
// hierheen verhuisd zodat ze headless te controleren zijn; de `useMemo`-aanroepen hieronder blijven
// bewust in dit component staan (zie de kop van dat bestand voor waarom).
import {
  buildBaselineOverlay, buildTrace,
  buildHistogramPicker, buildHistogramSeries,
  type GanttRenderOptionsSourceInput,
} from './ganttRenderOptions';
import { useGanttRendererHost, useGanttRendererRefs } from './hooks/useGanttRendererHost';
import { useGanttViewportCoordinator } from './hooks/useGanttViewportCoordinator';
import { useGanttHistogramInteraction } from './hooks/useGanttHistogramInteraction';
import { useGanttPointerCoordinator } from './hooks/useGanttPointerCoordinator';
import type { HistogramRenderInput } from './hooks/ganttCoordinatorTypes';

// Basisgeometrie op Tekengrootte 100% (issue #60): de component leidt hieruit de EFFECTIEVE
// `rowHeight`/`headerHeight` af (× ui.uiFontScale/100) — gebruik binnen de component die geschaalde
// waarden, nooit deze constanten direct, anders lopen tekenen en hit-testen uit de pas.
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 50;
// Dikte van de ZWEVENDE scrollbalken over de panes (issue #22 horizontaal, #35 verticaal).
// Exact de `::-webkit-scrollbar`-maat uit globals.css (8px) — NIET ruimer. Stond eerst op 14 met
// als gedachte "dan plakt de balk niet tegen de canvasrand", maar dat leverde 6px dode strook op
// die als een veel te brede balk las (user-feedback bij #35). Sinds de balken overlays zijn is
// gelijkheid met globals.css bovendien functioneel: de strook is dan precies één scrollbalk dik,
// dus er ontstaat geen dode klikzone náást de balk die de kaart eronder afdekt.
const SCROLLBAR_GUTTER = 8;
// Breedte van de sleepbare ratio-balk tussen de twee panes — de mini-map-strook eronder laat
// exact dezelfde tussenruimte, anders schuift hij t.o.v. zijn pane.
const SPLIT_RATIO_BAR_WIDTH = 5;

export function GanttCanvas() {
  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const { labels: taskTypeLabels } = useTaskTypeLabels();

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const barSplitMode = useAppStore(s => s.ui.barSplitMode);
  // Issue #21 punt 5 (fase 2): «alleen werkbare dagen tonen» — globale weergavevoorkeur.
  const compressNonWorkdays = useAppStore(s => s.ui.compressNonWorkdays);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const view = useAppStore(s => s.view);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const selectTasks = useAppStore(s => s.selectTasks);
  const deselectAll = useAppStore(s => s.deselectAll);
  const toggleCollapse = useAppStore(s => s.toggleCollapse);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  // Issue #40: de relatiemodus is een "plakkende Shift" — staat hij aan, dan armt een mousedown op
  // een balk hetzelfde dependency-tekenen als shift+slepen. Dit is de ENIGE lezer die gedrag
  // stuurt; vóór deze fix werd de vlag alleen geschreven (dode modus, knop deed niets zichtbaars).
  const dependencyMode = useAppStore(s => s.ui.showDependencyMode);
  // Issue #21 punt 1 (fase 2): store-actie uit fase 1 — verplaatst één taak naar een exacte
  // positie (reorder of reparent), gebruikt door useRowDrag bij mouseup.
  const moveTaskTo = useAppStore(s => s.moveTaskTo);
  // Issue #26 (vervolgmelding): dezelfde sleep, maar met de hele selectie — op het canvas is een
  // meervoudige selectie extra gewoon door de box-select.
  const moveTasksTo = useAppStore(s => s.moveTasksTo);
  const setScroll = useAppStore(s => s.setScroll);
  const setUI = useAppStore(s => s.setUI);
  // Fase 2.10 golf 2 (contextmenu's): golf-1-helpers + bestaande taak-acties die het contextmenu
  // nu ook ontsluit. De muterende taak-acties (in-/uitspringen, mijlpaal, kalender, voortgang,
  // prioriteit, verwijderen) lopen sinds issue #45 via `contextMenuBulk` en worden hier daarom niet
  // meer los uit de store getrokken.
  const pasteTasks = useAppStore(s => s.pasteTasks);
  const taskClipboard = useAppStore(s => s.taskClipboard);
  // Issue #35b: het bandkop-contextmenu bestaat alléén in gegroepeerde weergave, en daar neemt
  // `computeViewRows` de taak-collapse (collapsedTaskIds) volledig over door de groepsbanden. De oude
  // `expandAll`/`collapseAll` werken op summary-taken en zijn daar dus inert — vandaar dat
  // "Alles uit-/inklappen" in het bandkop-menu niets deed. Die items gebruiken nu de groepsacties
  // (zelfde als de Beeld-tab in gegroepeerde weergave).
  const expandAllGroups = useAppStore(s => s.expandAllGroups);
  const collapseAllGroups = useAppStore(s => s.collapseAllGroups);
  // Issue #42: het taakcontextmenu klapt APART in/uit (net als de Beeld-tab) en gebruikt daarom
  // dezelfde gerichte acties als `outlineGroup` — niet de toggle.
  const collapseTasks = useAppStore(s => s.collapseTasks);
  const expandTasks = useAppStore(s => s.expandTasks);
  const setZoom = useAppStore(s => s.setZoom);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  // Primitive invalidatiesleutel voor Canvas-2D: CSS-variabelen veranderen buiten de teken-
  // callbackidentiteit om, dus elke canvaslaag krijgt dit expliciete thema-contract mee.
  const canvasThemeRevision = uiTheme;
  // Interface-lettertypefamilie (issue #25 punt 4) → concrete CSS font-stack voor de Canvas-2D-
  // renderers. De DOM krijgt de familie via CSS-variabelen, maar een canvas leest die niet, dus
  // resolven we hem hier één keer en geven we de string mee aan beide renderers. De waarde staat
  // ook in de deps van de teken-callbacks: zonder dat hertekent het canvas niet bij een wijziging
  // en lijkt de instelling stuk (de chrome schakelt wél om, de planning niet).
  const uiFontFamily = useAppStore(s => s.ui.uiFontFamily);
  const canvasFontFamily = resolveUIFontStack(uiFontFamily);
  // Issue #60: de Tekengrootte-instelling (ui.uiFontScale). De DOM-chrome schaalt via de rem-basis
  // (`--ui-font-scale` in App.tsx), maar een canvas leest geen CSS — de factor gaat daarom als
  // `fontScale` mee naar de renderer, en schaalt hier óók de rij-/headerhoogte: zonder dat zou
  // grotere tekst in de vaste 28px-rij clippen. Alle hit-tests, overlays en scrollgrenzen hieronder
  // rekenen met dezelfde geschaalde waarden, zodat tekenen en aanwijzen op de pixel blijven kloppen.
  const uiFontScale = useAppStore(s => s.ui.uiFontScale);
  const fontScale = uiFontScale / 100;
  const rowHeight = Math.round(ROW_HEIGHT * fontScale);
  const headerHeight = Math.round(HEADER_HEIGHT * fontScale);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const scrollMode = useAppStore(s => s.ui.scrollMode);
  const positionDivision = useAppStore(s => s.ui.positionDivision);
  const modifierMap = useAppStore(s => s.ui.modifierMap);
  const traceMode = useAppStore(s => s.ui.traceMode);
  const cpmResult = useAppStore(s => s.cpmResult);
  // DE gedeelde zichtbare-rijenlijst (fase 2.7, §4.3): zelfde store-veld als TableEditor.
  const viewRows = useAppStore(s => s.viewRows);
  const setCollapsedGroupKey = useAppStore(s => s.setCollapsedGroupKey);
  const splitView = useAppStore(s => s.view.splitView);
  const setSplitView = useAppStore(s => s.setSplitView);
  const clearPendingFit = useAppStore(s => s.clearPendingFit);
  const clearPendingFocusTask = useAppStore(s => s.clearPendingFocusTask);
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
  // #21: resource-accent + de bijbehorende resources/toewijzingen (zelfde bron als de histogram/
  // tabelweergave — de renderer krijgt alles doorgegeven en leeft buiten de store).
  const showResourceAccent = useAppStore(s => s.ui.showResourceAccent);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const setHistogramResource = useAppStore(s => s.setHistogramResource);

  const scopedTaskResources = useMemo(
    () => scopeTaskResources(resources, assignments, selectedTaskIds),
    [resources, assignments, selectedTaskIds],
  );

  const scopedResourceLoadResult = useMemo(() => {
    if (!resourceLoadResult || !scopedTaskResources.isFiltered) return resourceLoadResult;
    return computeResourceLoad(
      scopedTaskResources.resources,
      scopedTaskResources.assignments,
      tasks,
      calendar,
      calendars,
    );
  }, [resourceLoadResult, scopedTaskResources, tasks, calendar, calendars]);

  // Een handmatig gekozen histogramresource blijft als voorkeur bewaard. Valt hij buiten de
  // tijdelijke taakcontext, dan is de samengevoegde scoped reeks het eerlijke alternatief.
  const effectiveHistogramResourceId = scopedTaskResources.resources.some(
    resource => resource.id === histogramResourceId,
  ) ? histogramResourceId : undefined;

  const viewport = useGanttViewportCoordinator({
    tasks,
    rows: viewRows,
    calendar,
    view,
    taskTableWidth,
    histogramHeight,
    rowHeight,
    headerHeight,
    showHistogram,
    showMiniMap,
    compressNonWorkdays,
    enableQuarterHourZoom,
    scrollMode,
    positionDivision,
    modifierMap,
    setScroll,
    setZoom,
    setViewStartDate,
    clearPendingFit,
    clearPendingFocusTask,
    setSplitView,
    setTaskTableWidth: width => setUI({ leftPanelWidth: width }),
    setHistogramHeight: height => setUI({ histogramHeight: height }),
    persistTaskTableWidth: width => { void saveLeftPanelWidth(width); },
    persistHistogramHeight: height => { void saveHistogramHeight(height); },
  });
  const {
    paneRowRef,
    primaryContainerRef: containerRef,
    secondaryContainerRef,
    histogramContainerRef,
    primaryHScrollRef: hScrollRef,
    secondaryHScrollRef: hScrollSecondaryRef,
    sharedVScrollRef: vScrollRef,
  } = viewport.refs;
  const effectiveViewStart = viewport.effectiveViewStart;
  const effectiveView = viewport.effectiveView;
  const sharedAxis = viewport.sharedAxis;
  const totalContentWidth = viewport.primary.contentWidth;
  const secondaryContentWidth = viewport.secondary?.contentWidth ?? 0;
  const primaryChartWidth = viewport.primary.chartWidth;
  const secondaryChartWidth = viewport.secondary?.chartWidth ?? 0;
  const histogramSplitter = viewport.splitters.histogram;
  // De refs komen uit de rendererhostmodule maar worden vóór de renderopties samengesteld: zo kan
  // de pointercoördinator zijn gesturehooks bezitten en tegelijk de actieve resize aan de renderer
  // leveren, zonder een tweede canvas-/rendererinstantie te introduceren.
  const rendererHost = useGanttRendererRefs();
  const {
    primaryCanvasRef: canvasRef,
    secondaryCanvasRef,
    secondaryRendererRef,
    histogramCanvasRef,
    histogramRendererRef,
    dependencyCanvasRef: depLineCanvasRef,
  } = rendererHost;

  const localizedMonths = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);
  // issue #21 punt 2 (vervolg: dagnamen): 7 weekdag-afkortingen in getUTCDay()-volgorde
  // (0=zondag … 6=zaterdag). Hergebruikt de bestaande kalender-vertalingen uit het menu-
  // namespace (ribbon.calendarDialog.days, ISO 1=ma … 7=zo) en remapt die naar Sun-first.
  // Gememoized op de gebonden vertaalfunctie, zodat een taalwissel de labels vernieuwt en de
  // renderer-opts tussen taalwissels stabiel blijven.
  const localizedWeekdays = useMemo(
    () => [
      tMenu('ribbon.calendarDialog.days.7'), // zo (getUTCDay 0 = zondag)
      tMenu('ribbon.calendarDialog.days.1'), // ma
      tMenu('ribbon.calendarDialog.days.2'), // di
      tMenu('ribbon.calendarDialog.days.3'), // wo
      tMenu('ribbon.calendarDialog.days.4'), // do
      tMenu('ribbon.calendarDialog.days.5'), // vr
      tMenu('ribbon.calendarDialog.days.6'), // za
    ],
    [tMenu],
  );
  // Vertaalde duur-eenheid-suffixen voor de duurkolom-weergave (§6.4/§11). De gebonden
  // vertaalfunctie wisselt mee met de taal; daarbuiten blijft de rendereroptie stabiel.
  const durationSuffixes = useMemo(() => durationSuffixesFrom(tCommon), [tCommon]);

  // Fase 2.8b (§6.1/§6.9): effectieve kalender per taak (task.calendarId → bibliotheek, anders de
  // projectkalender). De renderer leest hieruit per taak uur- vs dag-modus en de banden voor de
  // balk-opsplitsing. Gememoized zodat er niet per frame een map gebouwd wordt.
  const effectiveCalById = useMemo(
    () => effectiveCalendarByTask(tasks, calendar, calendars),
    [tasks, calendar, calendars],
  );

  const formatHistogramContributionLabel = useCallback(
    (count: number, isoDate: string) => tCommon('resource.histogram.overallocatedTooltip', {
      count,
      date: isoDate,
    }),
    [tCommon],
  );
  const histogramInteraction = useGanttHistogramInteraction({
    canvasRef: histogramCanvasRef,
    rendererRef: histogramRendererRef,
    assignments: scopedTaskResources.assignments,
    resources: scopedTaskResources.resources,
    tasks,
    selectedResourceId: effectiveHistogramResourceId,
    selectResource: setHistogramResource,
    formatContributionLabel: formatHistogramContributionLabel,
  });

  const defaultTaskName = tTask('defaultTask');
  const defaultMilestoneName = tTask('defaultMilestone');
  const revealTaskIfOffscreen = useCallback((task: Task) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const startString = task.time.earlyStart || task.time.scheduleStart;
    const finishString = task.time.earlyFinish || task.time.scheduleFinish;
    if (!startString || !finishString) return;
    const state = useAppStore.getState();
    const currentView = state.view;
    const tableWidth = state.ui.leftPanelWidth;
    const rect = canvas.getBoundingClientRect();
    const usableWidth = rect.width - tableWidth;
    if (usableWidth <= 0) return;
    const origin = parseDate(effectiveViewStart);
    const hourMode = startString.includes('T') || finishString.includes('T');
    const start = hourMode ? parseInstant(startString) : parseDate(startString);
    const finish = hourMode ? parseInstant(finishString) : parseDate(finishString);
    const startX = axisDateToX(start, origin, tableWidth, currentView.zoom, 0);
    const finishX = axisDateToX(finish, origin, tableWidth, currentView.zoom, 0)
      + (hourMode ? 0 : currentView.zoom);
    const visibleLeft = tableWidth + currentView.scrollX;
    const visibleRight = visibleLeft + usableWidth;
    if (finishX > visibleLeft && startX < visibleRight) return;
    state.setScroll(Math.max(0, startX - tableWidth - 40), currentView.scrollY);
  }, [canvasRef, effectiveViewStart]);

  /**
   * Issue #87: de primaire taaktabel en de balken delen één canvas en daarmee één focusoppervlak.
   * De pijltjes volgen uitsluitend taken die in de huidige `viewRows` zichtbaar zijn: filters,
   * sortering, groepering en ingeklapte takken veranderen de loopvolgorde dus niet stiekem.
   */
  const handleTaskCanvasKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (
      (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    ) return;
    const taskRows = viewRows.filter(
      (row): row is Extract<typeof row, { kind: 'task' }> => row.kind === 'task',
    );
    if (taskRows.length === 0) return;

    const selectedId = selectedTaskIds[selectedTaskIds.length - 1];
    const selectedIndex = taskRows.findIndex(row => row.task.id === selectedId);
    const step = event.key === 'ArrowUp' ? -1 : 1;
    const currentIndex = selectedIndex >= 0
      ? selectedIndex
      : step > 0 ? 0 : taskRows.length - 1;
    const nextIndex = Math.max(0, Math.min(taskRows.length - 1, currentIndex + (selectedIndex >= 0 ? step : 0)));
    const nextTask = taskRows[nextIndex].task;

    event.preventDefault();
    event.stopPropagation();
    if (selectedId === nextTask.id) return;
    selectTask(nextTask.id);

    // Houd de nieuw gekozen rij bruikbaar zichtbaar, zonder de doelgerichte zoom van
    // `focusOnTask` te activeren. De formule is dezelfde als die van GanttRenderer.rowToY.
    const rowIndex = viewRows.findIndex(row => row.kind === 'task' && row.task.id === nextTask.id);
    const canvasHeight = event.currentTarget.getBoundingClientRect().height;
    if (rowIndex >= 0 && canvasHeight > headerHeight) {
      const rowTop = headerHeight + rowIndex * rowHeight - view.scrollY;
      const rowBottom = rowTop + rowHeight;
      if (rowTop < headerHeight) setScroll(view.scrollX, rowIndex * rowHeight);
      else if (rowBottom > canvasHeight) {
        setScroll(view.scrollX, (rowIndex + 1) * rowHeight - (canvasHeight - headerHeight));
      }
    }
    revealTaskIfOffscreen(nextTask);
  }, [viewRows, selectedTaskIds, selectTask, headerHeight, rowHeight, view.scrollX, view.scrollY, setScroll, revealTaskIfOffscreen]);
  const addChildTask = useCallback((parentId: string) => {
    addTask({ name: defaultTaskName, parentId });
  }, [addTask, defaultTaskName]);
  const openTask = useCallback((taskId: string) => {
    setUI({ showTaskDialog: true, editingTaskId: taskId });
  }, [setUI]);

  const pointer = useGanttPointerCoordinator({
    host: rendererHost,
    viewport,
    tasks,
    rows: viewRows,
    calendar,
    effectiveCalendarByTaskId: effectiveCalById,
    selectedTaskIds,
    taskTableWidth,
    headerHeight,
    dependencyMode,
    treeMode: isTreeMode(view),
    scrollMode,
    enableQuarterHourZoom,
    enableHourPlanning,
    compressNonWorkdays,
    selectTask,
    selectTasks,
    deselectAll,
    toggleCollapse,
    setCollapsedGroupKey,
    addChildTask,
    updateTask,
    moveTaskTo,
    moveTasksTo,
    setScroll,
    openTask,
    revealTaskIfOffscreen,
    clearHistogramTooltip: histogramInteraction.clearTooltip,
  });

  // Canvas is wel tabbable, maar krijgt bij een gepositioneerde canvas-klik niet in elke browser
  // automatisch DOM-focus. Doe dat expliciet op de bestaande klikroutes, zodat muis én Tab naar
  // precies hetzelfde ↑/↓-oppervlak leiden.
  const focusCanvas = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus({ preventScroll: true });
  }, []);
  const handlePrimaryClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    focusCanvas(event);
    pointer.onClick(event);
  }, [focusCanvas, pointer]);
  const handleHistogramClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    focusCanvas(event);
    histogramInteraction.onClick(event);
  }, [focusCanvas, histogramInteraction]);

  // Issue #51: alleen een actieve RAND-sleep voedt de bestaande duurpil in de renderer.
  const durationDrag = useMemo(
    () => (pointer.overlays.barDrag && pointer.overlays.barDrag.edge !== 'body'
      ? { taskId: pointer.overlays.barDrag.taskId, edge: pointer.overlays.barDrag.edge }
      : undefined),
    [pointer.overlays.barDrag],
  );

  // Baseline-overlay-Map uit de actieve baseline (fase 2.6, §6.2): keyed op Task.id (leaf-taken).
  const baselineOverlay = useMemo(
    () => buildBaselineOverlay(baselines, activeBaselineId),
    [baselines, activeBaselineId],
  );

  const columnHeaders = useMemo(() => ({
    wbs: tTask('table.wbs'),
    taskName: tTask('table.name'),
    duration: tTask('table.duration'),
  }), [tTask]);

  // Path tracing rond de (eerst) geselecteerde taak: transitieve voorgangers/opvolgers, met de
  // driving-ketens apart zodat de renderer die sterker kan tinten (MSP Task Path-conventie).
  const trace = useMemo(
    () => buildTrace(traceMode, selectedTaskIds, sequences, cpmResult),
    [traceMode, selectedTaskIds, sequences, cpmResult],
  );

  // --- Histogram (fase 2.5, §6.4) ---
  const histogramPicker = useMemo<HistogramPickerItem[]>(
    () => buildHistogramPicker(scopedTaskResources.resources, scopedResourceLoadResult, tCommon('resource.histogram.allResources')),
    [scopedTaskResources.resources, scopedResourceLoadResult, tCommon],
  );

  const histogramSeries = useMemo<HistogramSeries>(
    () => buildHistogramSeries(scopedResourceLoadResult, effectiveHistogramResourceId, scopedTaskResources.resources),
    [scopedResourceLoadResult, effectiveHistogramResourceId, scopedTaskResources.resources],
  );

  const histogramRenderInput = useMemo<HistogramRenderInput | undefined>(() => (
    showHistogram ? {
      series: histogramSeries,
      picker: histogramPicker,
      selectedResourceId: effectiveHistogramResourceId,
      view: effectiveView,
      taskTableWidth,
      // Issue #21 punt 5 (fase 2, §10.1): dezelfde as-instantie als de primaire Gantt-pane.
      axis: sharedAxis,
      // Issue #25 punt 4: zelfde lettertypefamilie als de Gantt erboven en de DOM-chrome.
      fontFamily: canvasFontFamily,
      // Issue #60 (nazit uit de PR-review): zelfde tekstschaal als de Gantt erboven, anders staan
      // de strooklabels zichtbaar uit de pas op de gedeelde as.
      fontScale,
      labels: { unitsSuffix: tCommon('resource.histogram.units') },
      emptyHint: !scopedResourceLoadResult
        ? tCommon('resource.histogram.noData')
        : scopedTaskResources.resources.length === 0
          ? tCommon('resource.histogram.noResources')
          : undefined,
    } : undefined
  ), [showHistogram, histogramSeries, histogramPicker, effectiveHistogramResourceId, effectiveView, taskTableWidth, scopedResourceLoadResult, scopedTaskResources.resources.length, tCommon, sharedAxis, canvasFontFamily, fontScale]);

  const primaryRenderInput = useMemo<GanttRenderOptionsSourceInput>(() => ({
    rows: viewRows,
    sequences,
    calendar,
    view: effectiveView,
    selectedTaskIds,
    collapsedTaskIds,
    cpmResult,
    statusDate,
    showStatusDateLine,
    showProgressLine,
    showResourceAccent,
    barColorSelection,
    activityCodeTypes,
    customFieldDefs,
    taskTypeLabels,
    barColorNoneLabel: tTask('structure.none'),
    resources,
    assignments,
    showBaselineOverlay,
    baselineOverlay,
    trace,
    taskTableWidth,
    rowHeight,
    headerHeight,
    localizedMonths,
    localizedWeekdays,
    columnHeaders,
    weekStartDay,
    enableQuarterHourZoom,
    effectiveCalById,
    barSplitMode,
    enableHourPlanning,
    durationDisplay,
    durationSuffixes,
    externalStaleLabel: tTask('externalLinks.stale'),
    durationDrag,
    highContrast: uiTheme === 'high-contrast',
    palette: undefined,
    darkTheme: uiTheme === 'dark',
    compressNonWorkdays,
    axis: sharedAxis,
    fontFamily: canvasFontFamily,
    fontScale,
  }), [viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, statusDate, showStatusDateLine, showProgressLine, showResourceAccent, barColorSelection, activityCodeTypes, customFieldDefs, taskTypeLabels, resources, assignments, showBaselineOverlay, baselineOverlay, trace, taskTableWidth, rowHeight, headerHeight, localizedMonths, localizedWeekdays, columnHeaders, weekStartDay, enableQuarterHourZoom, effectiveCalById, barSplitMode, enableHourPlanning, durationDisplay, durationSuffixes, tTask, durationDrag, uiTheme, compressNonWorkdays, sharedAxis, canvasFontFamily, fontScale]);

  // Secondary houdt exact zijn eigen zoom/scrollX, gedeelde rows/scrollY en taskTableWidth 0.
  const secondaryRenderInput = useMemo<GanttRenderOptionsSourceInput | undefined>(() => (
    splitView ? {
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
      cpmResult,
      statusDate,
      showStatusDateLine,
      showProgressLine,
      showResourceAccent,
      barColorSelection,
      activityCodeTypes,
      customFieldDefs,
      taskTypeLabels,
      barColorNoneLabel: tTask('structure.none'),
      resources,
      assignments,
      showBaselineOverlay,
      baselineOverlay,
      trace,
      taskTableWidth: 0,
      rowHeight,
      headerHeight,
      localizedMonths,
      localizedWeekdays,
      columnHeaders,
      weekStartDay,
      enableQuarterHourZoom,
      effectiveCalById,
      barSplitMode,
      // Deze velden voeden alleen de ontbrekende taaktabel of primaire rand-sleep.
      enableHourPlanning: undefined,
      durationDisplay: undefined,
      durationSuffixes: undefined,
      externalStaleLabel: tTask('externalLinks.stale'),
      durationDrag: undefined,
      highContrast: uiTheme === 'high-contrast',
      palette: undefined,
      darkTheme: uiTheme === 'dark',
      // Geen gedeelde primary/histogram-as: secondary heeft een eigen tijdvenster.
      compressNonWorkdays,
      axis: undefined,
      fontFamily: canvasFontFamily,
      fontScale,
    } : undefined
  ), [splitView, viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, statusDate, showStatusDateLine, showProgressLine, showResourceAccent, barColorSelection, activityCodeTypes, customFieldDefs, taskTypeLabels, resources, assignments, showBaselineOverlay, baselineOverlay, trace, rowHeight, headerHeight, localizedMonths, localizedWeekdays, columnHeaders, weekStartDay, enableQuarterHourZoom, effectiveCalById, barSplitMode, tTask, uiTheme, compressNonWorkdays, canvasFontFamily, fontScale]);

  useGanttRendererHost({
    containers: {
      primaryContainerRef: containerRef,
      secondaryContainerRef,
      histogramContainerRef,
    },
    primary: primaryRenderInput,
    secondary: secondaryRenderInput,
    histogram: histogramRenderInput,
    renderRevision: canvasThemeRevision,
    onPrimarySize: viewport.onPrimarySize,
    onSecondarySize: viewport.onSecondarySize,
  }, rendererHost);

  // Selectie-klik in het secundaire pane (bandkop → collapse-toggle, net als links).
  const handleSecondaryClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    const canvas = secondaryCanvasRef.current;
    const renderer = secondaryRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < headerHeight) return;
    const row = renderer.getRowAtY(y);
    if (row?.kind === 'group') {
      setCollapsedGroupKey(row.key, !row.collapsed);
      return;
    }
    if (row?.kind === 'task') selectTask(row.task.id, e.ctrlKey || e.metaKey, e.shiftKey);
    else deselectAll();
  }, [secondaryCanvasRef, secondaryRendererRef, selectTask, deselectAll, setCollapsedGroupKey, headerHeight]);

  const { contextMenu, relationPopover, tooltip } = pointer;
  const boxSelectState = pointer.overlays.boxSelect;
  const rowDragState = pointer.overlays.rowDrag;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Pane-rij (§10). De scrollbalken zijn ZWEVENDE overlays binnen deze rij en binnen de panes
          zelf (issue #35): ze staan niet meer als eigen kolom/rij in de layout. Dat was geen
          cosmetiek — een echte 8px-goot/-rij snoept die 8px van de kaart af en laat onder de
          takenlijst een strook achter die daar niets te zoeken heeft (de user: "het onderliggende
          paneel moet daar gewoon in doorlopen"). Als overlay houdt het canvas de volle hoogte en
          breedte en loopt het paneel eronder door tot de rand.
          `dir="ltr"` op de pane-rij is FUNCTIONEEL: de renderer kent geen RTL (`isInTaskTable` is
          letterlijk `canvasX < taskTableWidth`), dus de taaktabel wordt in ar/fa óók links
          getekend. Liet je deze rij mirroren, dan wisselen primair en secundair pane visueel van
          plek terwijl de mini-map-strook hieronder wél LTR gepind is — die kwam dan onder het
          VERKEERDE pane te liggen (gemeten in ar). Dezelfde pin houdt bovendien de ratio-sleep
          kloppend, die `clientX - rect.left` tegen `paneRowRef` rekent en dus een niet-gespiegelde
          rij veronderstelt, én zet de overlay-balken hieronder aan de kant waar ze horen. */}
      <div ref={paneRowRef} className="flex-1 min-w-0 flex overflow-hidden relative" dir="ltr">
      <div
        ref={containerRef}
        className="overflow-hidden relative"
        style={{ width: splitView ? `${splitView.ratio * 100}%` : '100%', flexShrink: 0 }}
      >
        <canvas
          ref={canvasRef}
          data-testid="gantt-primary-canvas"
          tabIndex={0}
          className="absolute inset-0"
          style={{ cursor: pointer.cursor }}
          onClick={handlePrimaryClick}
          onKeyDown={handleTaskCanvasKeyDown}
          onDoubleClick={pointer.onDoubleClick}
          onMouseDown={pointer.onMouseDown}
          onMouseMove={pointer.onMouseMove}
          onMouseLeave={pointer.onMouseLeave}
          onContextMenu={pointer.onContextMenu}
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
        {boxSelectState && (() => {
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

        {/* Issue #21 punt 1 (fase 2, NIET fase 3): minimale invoeg-indicator, hergebruikt exact het
            box-select-overlaypatroon hierboven — dit is bewust sober (geen autoscroll, geen
            "verborgen kind"-label, geen bron-rij-dimming; dat is allemaal fase 3). Alleen zichtbaar
            bij een geldig doel (`dropTarget !== null`); canvas vult de container exact (`inset-0`),
            dus canvas-relatieve Y = container-relatieve Y, geen client→container-omrekening nodig
            zoals bij het box-selectiekader. */}
        {rowDragState?.dropTarget && rowDragState.hoverRowIndex !== null && (() => {
          const { hoverRowIndex, hoverZone } = rowDragState;
          const rowTop = headerHeight + hoverRowIndex * rowHeight - view.scrollY;
          if (hoverZone === 'nest') {
            return (
              <div
                data-testid="row-drag-nest"
                className="absolute"
                style={{
                  left: 0, right: 0, top: rowTop, height: rowHeight,
                  border: '1px solid var(--theme-accent)',
                  pointerEvents: 'none',
                  zIndex: 6,
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'var(--theme-accent)', opacity: 0.15 }} />
              </div>
            );
          }
          const lineTop = hoverZone === 'after' ? rowTop + rowHeight : rowTop;
          return (
            <div
              data-testid="row-drag-line"
              className="absolute"
              style={{ left: 0, right: 0, top: lineTop - 1, height: 2, background: 'var(--theme-accent)', pointerEvents: 'none', zIndex: 6 }}
            />
          );
        })()}

        {/* Tooltip — issue #58: HoverTooltip houdt de doos binnen het venster. Issue #65: de
            content zit sinds de extractie in TaskTooltipContent, gedeeld met de WBS-sprongknop
            in het eigenschappenpaneel. */}
        {tooltip && (
          <HoverTooltip left={tooltip.x + 16} top={tooltip.y - 10}>
            <TaskTooltipContent task={tooltip.task} />
          </HoverTooltip>
        )}

        {/* Horizontale scrollbalk van het primaire pane (issue #22, sinds #35 een overlay). Hij
            zweeft ONDERIN dit pane in plaats van in een eigen rij eronder, zodat het canvas de
            volle hoogte houdt en de kaart tot de onderrand doorloopt.
            Hij begint pas bij `taskTableWidth`: de taaktabel schuift horizontaal niet mee, dus een
            balk daaronder was verwarrend (#22) — en dát is precies wat de losse rij weer opleverde.
            DE VALKUIL: de scrollrange moet exact gelijk zijn aan de klem in `setScroll`
            (`maxScrollX = totalContentWidth − canvasbreedte`, gezet in `drawPrimary`). Dat klopt
            hier omdat zowel de zichtbare breedte (`left: taskTableWidth; right: 0` ⇒ paneBreedte −
            taskTableWidth) als de spacer (`totalContentWidth − taskTableWidth`) met dezelfde
            `taskTableWidth` krimpen. Laat hem dus NIET vóór de verticale balk stoppen (`right: 8`):
            dan is hij 8px smaller dan het chartgebied en loopt de DOM-range 8px uit de pas met
            `maxScrollX`. De 8×8px hoekoverlap met de verticale balk is bewust geaccepteerd. */}
        <div
          ref={hScrollRef}
          data-testid="gantt-hscroll"
          className="gantt-overlay-scrollbar absolute overflow-x-auto overflow-y-hidden"
          style={{ left: taskTableWidth, right: 0, bottom: 0, height: SCROLLBAR_GUTTER, zIndex: 4 }}
          onScroll={viewport.scrollHandlers.onPrimaryHorizontalScroll}
        >
          <div style={{ width: Math.max(1, totalContentWidth - taskTableWidth), height: 1 }} />
        </div>
      </div>
      {/* Secundair pane (§10): eigen tijdvenster, gedeelde rijen + verticale scroll */}
      {splitView && (
        <>
          <div
            data-testid="split-ratio-bar"
            onMouseDown={e => { e.preventDefault(); viewport.splitters.ratio.start(); }}
            style={{ width: SPLIT_RATIO_BAR_WIDTH, flexShrink: 0, cursor: 'col-resize', background: 'var(--theme-border)' }}
          />
          <div
            ref={secondaryContainerRef}
            data-testid="split-secondary-pane"
            className="flex-1 overflow-hidden relative"
          >
            <canvas
              ref={secondaryCanvasRef}
              data-testid="gantt-secondary-canvas"
              tabIndex={0}
              className="absolute inset-0"
              onClick={handleSecondaryClick}
              onKeyDown={handleTaskCanvasKeyDown}
            />
            {/* Eigen zwevende horizontale balk (issue #35 punt 1): dit pane heeft een EIGEN
                tijdvenster (`secondaryScrollX`/`secondaryZoom`) en geen taaktabel — drawSecondary
                tekent met `taskTableWidth: 0`, dus `left: 0` en de spacer is de volle
                `secondaryContentWidth`. Zichtbare breedte == canvasbreedte, dus de DOM-range is
                per constructie `secondaryContentWidth − canvasbreedte`. */}
            <div
              ref={hScrollSecondaryRef}
              data-testid="gantt-hscroll-secondary"
              className="gantt-overlay-scrollbar absolute overflow-x-auto overflow-y-hidden"
              style={{ left: 0, right: 0, bottom: 0, height: SCROLLBAR_GUTTER, zIndex: 4 }}
              onScroll={viewport.scrollHandlers.onSecondaryHorizontalScroll}
            >
              <div style={{ width: Math.max(1, secondaryContentWidth), height: 1 }} />
            </div>
          </div>
        </>
      )}
      {/* Verticale scrollbalk (issue #35 punt 2): snelle rij-navigatie voor grote WBS-structuren,
          waar alleen het muiswiel te traag was. Eén balk voor BEIDE panes — `view.scrollY` is
          gedeeld (drawSecondary hergebruikt hem) — dus hij zweeft rechts in de pane-RIJ, niet in
          één pane.
          De scrollrange moet EXACT gelijk zijn aan de klem in `setScroll`
          (`maxScrollY = rijen·ROW_HEIGHT − (paneHoogte − HEADER_HEIGHT)`), anders loopt de balk vóór
          of achter op het canvas. Daarom begint hij op `top: HEADER_HEIGHT` en loopt tot
          `bottom: 0`: dan is hij precies zo hoog als het rijen-gebied (paneHoogte − HEADER_HEIGHT)
          terwijl de spacer de volledige contenthoogte (rijen·ROW_HEIGHT) is — hetzelfde trucje als
          de `left: taskTableWidth` van de horizontale balk. Vroeger deed een leeg blokje van
          HEADER_HEIGHT dat werk in een echte goot-kolom; die kolom sneed 8px van de kaart af en is
          nu een overlay. */}
      <div
        ref={vScrollRef}
        data-testid="gantt-vscroll"
        className="gantt-overlay-scrollbar absolute overflow-y-auto overflow-x-hidden"
        style={{ right: 0, top: headerHeight, bottom: 0, width: SCROLLBAR_GUTTER, zIndex: 5 }}
        onScroll={viewport.scrollHandlers.onSharedVerticalScroll}
      >
        <div style={{ height: Math.max(1, viewRows.length * rowHeight), width: 1 }} />
      </div>
      </div>
      {/* Histogramstrook (fase 2.5, §6.4) — derde canvas met gedeelde X-as. Loopt over de volle
          breedte, net als de pane-rij hierboven: sinds de scrollbalken overlays zijn, is er geen
          goot meer om onder te blijven en dus ook geen opvulblokje meer nodig. */}
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
              data-testid="gantt-histogram-canvas"
              tabIndex={0}
              className="absolute inset-0"
              style={{ cursor: 'pointer' }}
              onClick={handleHistogramClick}
              onKeyDown={histogramInteraction.onKeyDown}
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
            {histogramInteraction.tooltip && (
              <HoverTooltip left={histogramInteraction.tooltip.x + 14} top={histogramInteraction.tooltip.y - 10}>
                {/* Issue #58 geldt hier net zo goed: dit zijn resourcenamen, tot 9 regels. */}
                {histogramInteraction.tooltip.lines.map((l, i) => (
                  <div key={i} className={i === 0 ? 'tooltip-title' : 'tooltip-row'}>{l}</div>
                ))}
              </HoverTooltip>
            )}
          </div>
        </>
      )}

      {/* Mini-map (fase 2.7, §11): thumbnail van de hele projectperiode + viewport-kader.
          Issue #35 punt 1: bij split view krijgt ELK pane een eigen strook — de tweede bestuurt
          `splitView.secondaryScrollX`/`secondaryZoom` i.p.v. de gedeelde `view`. De breedte-
          expressies (ratio-% + dezelfde 5px tussenruimte als de ratio-balk) zijn letterlijk die van
          de pane-rij, zodat elke strook onder zijn eigen pane ligt. Zonder split view: één strook
          over de volle breedte, exact zoals voorheen.
          `dir="ltr"` pint de rij net als de pane-rij: de panes zelf spiegelen niet mee met de
          leesrichting, dus deze stroken mogen dat ook niet — anders liggen ze in ar/fa onder het
          verkeerde pane. Er is geen opvulblokje meer nodig: de verticale scrollbalk is een overlay
          en neemt geen kolombreedte meer in. */}
      {showMiniMap && (
        <div className="flex" dir="ltr" style={{ flexShrink: 0 }}>
          <div style={{ width: splitView ? `${splitView.ratio * 100}%` : '100%', flexShrink: 0 }}>
            <MiniMap
              originDate={effectiveViewStart}
              chartWidth={primaryChartWidth}
              scrollX={viewport.primary.scrollX}
              zoom={viewport.primary.zoom}
              onScrollXChange={viewport.minimap.primaryScrollTo}
            />
          </div>
          {splitView && (
            <>
              <div style={{ width: SPLIT_RATIO_BAR_WIDTH, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <MiniMap
                  originDate={effectiveViewStart}
                  chartWidth={secondaryChartWidth}
                  scrollX={splitView.secondaryScrollX}
                  zoom={splitView.secondaryZoom}
                  onScrollXChange={viewport.minimap.secondaryScrollTo}
                  testId="minimap-secondary"
                />
              </div>
            </>
          )}
        </div>
      )}

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
          onClose={pointer.closeContextMenu}
          onEdit={() => {
            if (contextMenu.task) setUI({ showTaskDialog: true, editingTaskId: contextMenu.task.id });
          }}
          onAddSubtask={() => {
            const parentId = contextMenu.task?.id || null;
            addTask({
              name: defaultTaskName,
              parentId,
            });
          }}
          onAddMilestone={() => {
            addTask({
              name: defaultMilestoneName,
              isMilestone: true,
              taskType: 'ATTENDANCE',
              parentId: contextMenu.task?.id || null,
            });
          }}
          onAddRelation={() => {
            // Issue #40: zette vroeger dezelfde dode vlag als de lint-knop (plus een nooit gelezen
            // `dependencySourceId`) en was dus óók een no-op. Nu armt het de echte relatiemodus.
            // De aangeklikte taak wordt geselecteerd zodat zichtbaar is vanaf welke balk je sleept.
            if (contextMenu.task) {
              selectTask(contextMenu.task.id, false);
              setUI({ showDependencyMode: true });
            }
          }}
          onSaveTemplate={() => {
            if (!contextMenu.task) return;
            const st = useAppStore.getState();
            const tpl = saveBranchAsWbsTemplate(contextMenu.task.name, contextMenu.task.id, st.tasks, st.sequences);
            // Bevinding K8: lokale toast-state is opgeheven; de sjabloonmelding gaat door het
            // gecentraliseerde kanaal (zichtbaar óók buiten de Gantt).
            st.notify({
              severity: 'info',
              messageKey: 'notifications.templateSaved',
              params: { name: tpl.name },
            });
          }}
          onTracePath={() => {
            if (traceMode !== 'off') {
              setUI({ traceMode: 'off' });
            } else if (contextMenu.task) {
              selectTask(contextMenu.task.id);
              setUI({ traceMode: 'both' });
            }
          }}
          onCollapse={() => {
            if (contextMenu.task) collapseTasks(contextMenuOutlineScope(contextMenu.task.id));
          }}
          onExpand={() => {
            if (contextMenu.task) expandTasks(contextMenuOutlineScope(contextMenu.task.id));
          }}
          onDelete={() => {
            if (contextMenu.task) contextMenuBulk.remove(contextMenu.task.id);
          }}
          onAddTask={() => {
            contextMenuBulk.addNearSelection(defaultTaskName);
          }}
          onInsertAbove={() => {
            if (contextMenu.task) contextMenuBulk.insert(contextMenu.task.id, 'above', defaultTaskName);
          }}
          onInsertBelow={() => {
            if (contextMenu.task) contextMenuBulk.insert(contextMenu.task.id, 'below', defaultTaskName);
          }}
          onIndent={() => { if (contextMenu.task) contextMenuBulk.indent(contextMenu.task.id); }}
          onOutdent={() => { if (contextMenu.task) contextMenuBulk.outdent(contextMenu.task.id); }}
          onToggleMilestone={() => {
            if (contextMenu.task) contextMenuBulk.toggleMilestone(contextMenu.task);
          }}
          onSetCalendar={(calendarId) => {
            if (contextMenu.task) contextMenuBulk.setCalendar(contextMenu.task.id, calendarId);
          }}
          onSetProgress={(completion) => {
            if (contextMenu.task) contextMenuBulk.setProgress(contextMenu.task.id, completion);
          }}
          onSetPriority={(priority) => {
            if (contextMenu.task) contextMenuBulk.setPriority(contextMenu.task.id, priority);
          }}
          onStartRelationFromBar={() => {
            // Zelfde route als `onAddRelation` (balk-contextmenu i.p.v. rij-contextmenu).
            if (contextMenu.task) {
              selectTask(contextMenu.task.id, false);
              setUI({ showDependencyMode: true });
            }
          }}
          onPaste={() => { pasteTasks(); }}
          onZoomReset={viewport.resetZoom}
          onFitToProject={viewport.fitToProject}
          onToggleGroupCollapse={() => {
            if (contextMenu.group) setCollapsedGroupKey(contextMenu.group.key, !contextMenu.group.collapsed);
          }}
          onExpandAll={() => expandAllGroups()}
          onCollapseAll={() => collapseAllGroups()}
        />
      )}

      {relationPopover && (
        <RelationTypePopover
          sourceTaskId={relationPopover.sourceTaskId}
          targetTaskId={relationPopover.targetTaskId}
          x={relationPopover.x}
          y={relationPopover.y}
          onCommit={(relation) => {
            createRelationDraftWithFeedback(relation);
            pointer.closeRelationPopover();
          }}
          onCancel={pointer.closeRelationPopover}
        />
      )}
    </div>
  );
}
