import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { GanttRenderer, GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import { HistogramRenderer, HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { resolveUIFontStack } from '@/utils/uiFont';
import { setGanttChartWidth, setGanttScrollBounds, getGanttScrollBounds, computeGanttScrollBounds, computeFitToProject, computeEffectiveViewStart, computeFocusTaskHorizontal, computeFocusTaskScrollY, DEFAULT_ZOOM } from '@/utils/ganttViewport';
import { resolveWheelFunction } from '@/utils/ganttWheel';
import { MiniMap } from './MiniMap';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { effectiveCalendarByTask } from '@/services/subdayIo';
import { durationSuffixesFrom } from '@/utils/taskDuration';
import { Task } from '@/types/task';
import { isTreeMode } from '@/engine/view/visibleRows';
import { resolveFirstVisibleFocusOccurrence } from '@/state/slices/viewSlice';
import { ContextMenu } from './ContextMenu';
// Issue #42/#45: reikwijdte (aangeklikte taak = handgreep, selectie = bereik) + de bulk-uitvoering
// als ÉÉN undo-stap. DOM-vrij afgezonderd zodat de regressiebatterij dezelfde functies draait.
import { contextMenuOutlineScope, contextMenuBulk } from './contextMenuScope';
import { RelationTypePopover } from './RelationTypePopover';
// Issue #58: hover-tooltip die zichzelf binnen het venster houdt (nodig zodra de titel wrapt).
import { HoverTooltip } from './HoverTooltip';
import { TaskTooltipContent } from './TaskTooltipContent';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { dateToX as axisDateToX, MS_PER_DAY } from '@/engine/renderer/timeAxis';
import { useGanttZoom } from '@/hooks/useGanttZoom';
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';
import { useSplitter } from '@/hooks/useSplitter';
import { saveHistogramHeight, HISTOGRAM_MIN_HEIGHT, HISTOGRAM_MAX_HEIGHT } from '@/utils/settingsStore';
// K-item 33: de pure afleidingen achter de weergave + de opbouw van `GanttRenderOptions`. Ze zijn
// hierheen verhuisd zodat ze headless te controleren zijn; de `useMemo`-aanroepen hieronder blijven
// bewust in dit component staan (zie de kop van dat bestand voor waarom).
import {
  buildBaselineOverlay, buildTrace, buildSharedAxis,
  computeContentSpanDays, computeContentWidth,
  buildHistogramPicker, buildHistogramSeries, buildGanttRenderOptions,
} from './ganttRenderOptions';
import { useCanvasLayer } from './hooks/useCanvasLayer';
import { useBarDrag } from './hooks/useBarDrag';
import { usePan } from './hooks/usePan';
import { useBoxSelect } from './hooks/useBoxSelect';
import { useDependencyDraw } from './hooks/useDependencyDraw';

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

export interface GanttGridRevealRequest {
  taskId: string;
  nonce: number;
}

export interface GanttCanvasProps {
  revealRequest?: GanttGridRevealRequest | null;
}

export function GanttCanvas({ revealRequest = null }: GanttCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  // Issue #35: eigen horizontale balk voor het secundaire split-view-pane.
  const hScrollSecondaryRef = useRef<HTMLDivElement>(null);
  const depLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramContainerRef = useRef<HTMLDivElement>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramRendererRef = useRef<HistogramRenderer | null>(null);

  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');

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
  const pendingFit = useAppStore(s => s.view.pendingFit);
  const pendingFocusTaskId = useAppStore(s => s.view.pendingFocusTaskId);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const collapsedTaskIds = useAppStore(s => s.ui.collapsedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const selectTasks = useAppStore(s => s.selectTasks);
  const deselectAll = useAppStore(s => s.deselectAll);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  // Issue #40: de relatiemodus is een "plakkende Shift" — staat hij aan, dan armt een mousedown op
  // een balk hetzelfde dependency-tekenen als shift+slepen. Dit is de ENIGE lezer die gedrag
  // stuurt; vóór deze fix werd de vlag alleen geschreven (dode modus, knop deed niets zichtbaars).
  const dependencyMode = useAppStore(s => s.ui.showDependencyMode);
  // Issue #21 punt 1 (fase 2): store-actie uit fase 1 — verplaatst één taak naar een exacte
  // positie (reorder of reparent), gebruikt door useRowDrag bij mouseup.
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
  const traceMode = useAppStore(s => s.ui.traceMode);
  const cpmResult = useAppStore(s => s.cpmResult);
  // DE gedeelde zichtbare-rijenlijst (fase 2.7, §4.3): zelfde store-veld als TableEditor.
  const viewRows = useAppStore(s => s.viewRows);
  const setCollapsedGroupKey = useAppStore(s => s.setCollapsedGroupKey);
  const splitView = useAppStore(s => s.view.splitView);
  const setSplitView = useAppStore(s => s.setSplitView);
  const showMiniMap = useAppStore(s => s.ui.showMiniMap);
  // Task 15: de linker taaktabel is nu DOM en staat buiten dit component. Het primaire canvas
  // is vanaf deze commit timeline-only; Task 16B verwijdert de daardoor dode renderermethodes.
  const taskTableWidth = 0;
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
  // Idem voor het secundaire pane (issue #35 punt 1): daar is taskTableWidth 0, dus de chart-breedte
  // is de volle pane-breedte. Voedt het viewport-kader van de tweede mini-map-strook.
  const [secondaryChartWidth, setSecondaryChartWidth] = useState(0);
  // Onderdrukt de eerstvolgende click-afhandeling ná een gepromoveerd kader (en na een Escape-annulering
  // ervan) — anders deselecteert/hertekent de gewone click-logica de zojuist gezette boxselectie.
  // Gedeeld met de pan- en box-select-hooks.
  const justBoxSelectedRef = useRef(false);
  // Issue #21 punt 1 (fase 2): zelfde onderdrukkingspatroon, maar voor rijsleep — anders zou de
  // click ná een mouseup-move (dat de rij daadwerkelijk verplaatst heeft) de selectie/inklap-
  // logica van handleClick alsnog triggeren.
  const [cursor, setCursor] = useState('default');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Fase 2.10 (item 3): popover die na een dependency-drag verschijnt om het relatietype/lag
  // meteen te corrigeren — de sequence zelf bestaat al (FS+lag0, zie de dependency-drag-mouseup
  // hieronder), dit is puur een correctie-UI.
  const [relationPopover, setRelationPopover] = useState<{ sequenceId: string; x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [histoTooltip, setHistoTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const localizedMonths = useMemo(() => getLocalizedMonths(i18n.language), [i18n.language]);
  // issue #21 punt 2 (vervolg: dagnamen): 7 weekdag-afkortingen in getUTCDay()-volgorde
  // (0=zondag … 6=zaterdag). Hergebruikt de bestaande kalender-vertalingen uit het menu-
  // namespace (ribbon.calendarDialog.days, ISO 1=ma … 7=zo) en remapt die naar Sun-first.
  // Gememoized op taal, net als localizedMonths, zodat de renderer-opts stabiel blijven.
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
    [i18n.language], // eslint-disable-line react-hooks/exhaustive-deps
  );
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
  const barDrag = useBarDrag({ zoom: view.zoom, enableQuarterHourZoom, enableHourPlanning, calendar, effectiveCalById, compressNonWorkdays, updateTask });
  // Issue #51: tijdens een RAND-sleep zet de renderer een compact duur-pilletje tegen die balkrand.
  // De duur staat op dat moment al live in de store (elke mousemove commit een `updateTask`), dus
  // dit is puur "welke taak, welke rand" — er wordt hier niets herrekend. Een `body`-sleep
  // (verplaatsen) valt er BEWUST buiten: die verandert de duur niet, en een meelopend duurcijfer bij
  // een gebaar dat hem niet raakt is misleidend. De start/finish die dán wél schuiven staan al in de
  // taakregel links en in de balkpositie zelf.
  const durationDrag = useMemo(
    () => (barDrag.dragState && barDrag.dragState.edge !== 'body'
      ? { taskId: barDrag.dragState.taskId, edge: barDrag.dragState.edge }
      : undefined),
    [barDrag.dragState],
  );
  const pan = usePan({ setScroll, justBoxSelectedRef });
  const boxSelect = useBoxSelect({ canvasRef, rendererRef, selectTasks, deselectAll, justBoxSelectedRef });
  const depDraw = useDependencyDraw({
    canvasRef,
    containerRef,
    depLineCanvasRef,
    rendererRef,
    onRelationCreated: useCallback(
      (sequenceId: string, x: number, y: number) => setRelationPopover({ sequenceId, x, y }),
      [],
    ),
  });

  // De enige splitter ín het canvascomponent is nog de histogramhoogte. De grid/timeline-splitter
  // hoort vanaf Task 15 bij GanttWorkspace.
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

  // Effective timeline origin (the date mapped to scrollX = 0). The stored
  // viewStartDate defaults to "today" and never accounts for tasks that start
  // earlier; since the horizontal scrollbar (and the setScroll clamp) only
  // allow scrollX >= 0, anything left of the origin is unreachable. Pin the
  // origin to the earliest task start (or today, whichever is earlier) minus a
  // small padding so past tasks become scrollable into view.
  const effectiveViewStart = useMemo(
    () => computeEffectiveViewStart(tasks, view.viewStartDate),
    [tasks, view.viewStartDate],
  );

  // The view handed to the renderer/content-width uses the effective origin so
  // the date<->x mapping stays consistent across canvas, scrollbar and zoom.
  const effectiveView = useMemo(
    () => ({ ...view, viewStartDate: effectiveViewStart }),
    [view, effectiveViewStart],
  );

  // Issue #21 punt 5 (fase 2, ontwerp §10.1 — BINDEND): ÉÉN gedeelde `GanttAxis`-instantie voor de
  // primaire Gantt-pane ÉN de Histogram (zelfde `taskTableWidth`/`effectiveView`, dus zelfde
  // kolomindeling) — anders schuiven de resource-staafjes onder de verkeerde kolommen zodra de as
  // gecomprimeerd is. Fresh per render via de dep-array, geen cross-render cache (§2.5). De
  // secundaire split-view-pane (`drawSecondary`) heeft een eigen zoom/scrollX en bouwt daarom zijn
  // eigen as (via `compressNonWorkdays` in de opts) — die deelt bewust NIET in deze instantie.
  const sharedAxis = useMemo(
    () => buildSharedAxis({
      calendar,
      compressNonWorkdays,
      viewStartDate: effectiveView.viewStartDate,
      chartOriginX: taskTableWidth,
      zoom: effectiveView.zoom,
      scrollX: effectiveView.scrollX,
    }),
    [calendar, compressNonWorkdays, effectiveView, taskTableWidth],
  );

  // Content-span in dagen vanaf de effectieve origin — bewust ZONDER zoom/taskTableWidth, zodat
  // dezelfde span ook voor het secundaire split-view-venster (eigen zoom, geen taaktabel) gebruikt
  // kan worden zonder de compressie-logica te dupliceren (issue #35 punt 1). `null` = leeg project.
  const contentSpanDays = useMemo(
    () => computeContentSpanDays(tasks, effectiveViewStart, compressNonWorkdays, sharedAxis),
    [tasks, effectiveViewStart, compressNonWorkdays, sharedAxis],
  );

  /** Contentbreedte (px) van een tijdvenster met de gegeven zoom en tabelbreedte. */
  const contentWidthFor = useCallback(
    (zoom: number, tableWidth: number) => computeContentWidth(contentSpanDays, zoom, tableWidth),
    [contentSpanDays],
  );

  // Calculate total content width based on task date range
  const totalContentWidth = useMemo(
    () => contentWidthFor(view.zoom, taskTableWidth),
    [contentWidthFor, view.zoom, taskTableWidth],
  );

  // Idem voor het secundaire pane: eigen zoom, en daar is `taskTableWidth` 0 (drawSecondary
  // tekent geen taaktabel). 0 zolang split view uit staat — dan is er ook geen tweede balk.
  const secondaryContentWidth = useMemo(
    () => (splitView ? contentWidthFor(splitView.secondaryZoom, 0) : 0),
    [contentWidthFor, splitView],
  );

  // --- Histogram (fase 2.5, §6.4) ---
  const histogramPicker = useMemo<HistogramPickerItem[]>(
    () => buildHistogramPicker(resources, resourceLoadResult, tCommon('resource.histogram.allResources')),
    [resources, resourceLoadResult, tCommon],
  );

  const histogramSeries = useMemo<HistogramSeries>(
    () => buildHistogramSeries(resourceLoadResult, histogramResourceId, resources),
    [resourceLoadResult, histogramResourceId, resources],
  );

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
      // Issue #21 punt 5 (fase 2, §10.1): dezelfde as-instantie als de primaire Gantt-pane.
      axis: sharedAxis,
      // Issue #25 punt 4: zelfde lettertypefamilie als de Gantt erboven en de DOM-chrome.
      fontFamily: canvasFontFamily,
      // Issue #60 (nazit uit de PR-review): zelfde tekstschaal als de Gantt erboven, anders staan
      // de strooklabels zichtbaar uit de pas op de gedeelde as.
      fontScale,
      labels: { unitsSuffix: tCommon('resource.histogram.units') },
      emptyHint: !resourceLoadResult
        ? tCommon('resource.histogram.noData')
        : resources.length === 0
          ? tCommon('resource.histogram.noResources')
          : undefined,
    });
    histogramRendererRef.current = renderer;
    renderer.render();
  }, [histogramSeries, histogramPicker, histogramResourceId, effectiveView, taskTableWidth, resourceLoadResult, resources.length, tCommon, uiTheme, sharedAxis, canvasFontFamily, fontScale]);

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
    setGanttScrollBounds(
      computeGanttScrollBounds(totalContentWidth, viewRows.length, rowHeight, headerHeight, width, height),
    );

    const opts: GanttRenderOptions = buildGanttRenderOptions({
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
      showBaselineOverlay,
      baselineOverlay,
      trace,
      canvasWidth: width,
      canvasHeight: height,
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
      // Issue #51: live duur-pilletje bij een lopende rand-sleep (undefined ⇒ niets extra's).
      durationDrag,
      highContrast: uiTheme === 'high-contrast',
      // Audit C5/P17: de renderer leest zijn palet zelf uit de DOM zolang we er geen injecteren.
      // Expliciet opschrijven, want het invoertype is afgeleid van `GanttRenderOptions` — een
      // weggelaten veld is hier een compilefout, geen stilte.
      palette: undefined,
      // Issue #21 punt 5 (fase 2): vlag + de gedeelde as-instantie (§10.1, zelfde als Histogram).
      compressNonWorkdays,
      axis: sharedAxis,
      // Issue #25 punt 4: de gekozen interface-lettertypefamilie als concrete stack.
      fontFamily: canvasFontFamily,
      // Issue #60: Tekengrootte-schaal (rowHeight/headerHeight hierboven schalen al mee).
      fontScale,
    });

    const renderer = new GanttRenderer(ctx, opts);
    rendererRef.current = renderer;
    renderer.render();
  }, [viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, localizedWeekdays, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, taskTableWidth, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay, totalContentWidth, effectiveCalById, barSplitMode, enableHourPlanning, durationDisplay, durationSuffixes, compressNonWorkdays, sharedAxis, canvasFontFamily, durationDrag, fontScale, rowHeight, headerHeight, tTask]);

  useCanvasLayer({ canvasRef, containerRef, draw: drawPrimary });

  // --- Split view (fase 2.7, §10): secundair tijdvenster met eigen zoom/scrollX; gedeelde
  // rijen + scrollY; geen canvas-taaktabel (taskTableWidth 0) — die tekent alleen links. ---
  const drawSecondary = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!splitView) return;
    // Zelfde >1px-drempel als bij `primaryChartWidth`: zonder die drempel zet elke render een
    // nieuwe state en tolt de render-lus rond (setState → render → setState).
    setSecondaryChartWidth(prev => (Math.abs(prev - width) > 1 ? width : prev));
    const renderer = new GanttRenderer(ctx, buildGanttRenderOptions({
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
      showBaselineOverlay,
      baselineOverlay,
      trace,
      canvasWidth: width,
      canvasHeight: height,
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
      // Deze drie voeden alléén de duurkolom (`drawTaskTable`, die bij `taskTableWidth <= 0` meteen
      // terugkeert) en het sleep-pilletje. Dit pane heeft geen van beide, dus ze zijn hier inert —
      // expliciet `undefined` in plaats van weggelaten, zodat het een keuze blijft en geen omissie.
      enableHourPlanning: undefined,
      durationDisplay: undefined,
      durationSuffixes: undefined,
      // WEL vullen: dit is geen tabelveld. Het label wordt in de CHART getekend
      // (`drawTaskBars` -> `drawExternalGhosts`), dus zonder dit toonde dit pane het
      // hardgecodeerde NL 'verouderd' ongeacht de ingestelde taal. `tTask` staat daarom óók in de
      // dep-array hieronder: hij ontbrak daar aanvankelijk en de taalwissel werkte alleen doordat
      // `columnHeaders` (een TABELveld dat dit pane niet eens gebruikt) toevallig op `[tTask]`
      // gememoized is. Haalt iemand dat inerte veld weg, dan bevriest de badge stil.
      externalStaleLabel: tTask('externalLinks.stale'),
      // Rand-slepen gebeurt alleen in de primaire pane.
      durationDrag: undefined,
      highContrast: uiTheme === 'high-contrast',
      palette: undefined,
      // Issue #21 punt 5 (fase 2): geen `axis` meegegeven — de secundaire split-view-pane heeft
      // eigen zoom/scrollX, dus bouwt de renderer zelf een consistente as via `compressNonWorkdays`.
      compressNonWorkdays,
      axis: undefined,
      // Issue #25 punt 4: de secundaire pane volgt dezelfde lettertypefamilie als de primaire.
      fontFamily: canvasFontFamily,
      // Issue #60: en dezelfde tekengrootte-schaal.
      fontScale,
    }));
    secondaryRendererRef.current = renderer;
    renderer.render();
  }, [splitView, viewRows, sequences, calendar, effectiveView, selectedTaskIds, collapsedTaskIds, cpmResult, trace, localizedMonths, localizedWeekdays, columnHeaders, uiTheme, weekStartDay, enableQuarterHourZoom, statusDate, showStatusDateLine, showProgressLine, showBaselineOverlay, baselineOverlay, effectiveCalById, barSplitMode, compressNonWorkdays, canvasFontFamily, fontScale, rowHeight, headerHeight, tTask]);

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

  // Wiel boven het secundaire pane. Wélke functie het wiel uitvoert (zoom/horizontaal/verticaal)
  // wordt bepaald door exact dezelfde gedeelde beslissing als links (`resolveWheelFunction`), dus
  // het secundaire pane volgt de gebruikersinstelling `ui.scrollMode` mee. Vóór deze fix had dit
  // pane eigen hardgecodeerde regels (Ctrl = zoom, Shift = horizontaal, plat = verticaal), zodat
  // in de STANDAARDmodus 'drag' hetzelfde wiel links zoomde en rechts verticaal scrolde — twee
  // navigatiemethoden in één venster. Alleen het DOEL verschilt hier: zoom en horizontaal gaan
  // naar de EIGEN `secondaryZoom`/`secondaryScrollX` (§10.3), verticaal blijft gedeeld
  // (`view.scrollY` — beide panes tekenen dezelfde rijen).
  useEffect(() => {
    if (!splitView) return;
    const container = secondaryContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useAppStore.getState();
      const sv = st.view.splitView;
      if (!sv) return;
      const rect = container.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      // Cursorfracties tegen de EIGEN container: dit pane heeft geen takentabel
      // (`taskTableWidth` is hier 0), dus de hele breedte is chart — de 'position'-verdelingen
      // (links/rechts, boven/onder, hoek) gelden 1-op-1 over deze rect.
      const fn = resolveWheelFunction({
        mode: st.ui.scrollMode,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        fracX: rect.width > 0 ? anchorX / rect.width : 0,
        fracY: rect.height > 0 ? anchorY / rect.height : 0,
        division: st.ui.positionDivision,
        map: st.ui.modifierMap,
      });

      const scrollSecondaryX = (d: number) =>
        st.setSplitView({ ...sv, secondaryScrollX: Math.max(0, sv.secondaryScrollX + d) });

      if (fn === 'zoom') {
        const max = st.ui.enableQuarterHourZoom ? 1000 : 400;
        const factor = delta > 0 ? 1 / 1.1 : 1.1;
        const clamped = Math.max(0.5, Math.min(max, sv.secondaryZoom * factor));
        if (clamped === sv.secondaryZoom) return;
        // Zelfde ankerformule als useGanttZoom.zoomAt, met taskTableWidth 0.
        const daysUnderCursor = (anchorX + sv.secondaryScrollX) / sv.secondaryZoom;
        const newScrollX = Math.max(0, daysUnderCursor * clamped - anchorX);
        st.setSplitView({ ...sv, secondaryZoom: clamped, secondaryScrollX: newScrollX });
      } else if (fn === 'horizontal') {
        scrollSecondaryX(delta);
      } else {
        // Verticaal is gedeeld: `view.scrollY` verschuift de rijen in BEIDE panes, ongeacht boven
        // welk pane je scrollt. De "dood wiel"-terugval van het primaire pad geldt hier net zo
        // goed: past het hele project verticaal in beeld (`maxScrollY <= 0`), dan doet verticaal
        // scrollen niets en zou het wiel niets lijken te doen — val dan terug op horizontaal, maar
        // wél op de EIGEN tijdas van dit pane. De grenzen zijn gedeeld: `maxScrollY` wordt in de
        // primaire render geregistreerd uit dezelfde rijenlijst, en beide panes zijn even hoog.
        // `maxScrollY === null` = nog geen render-pass (headless) → ongewijzigd verticaal.
        const { maxScrollY } = getGanttScrollBounds();
        if (maxScrollY !== null && maxScrollY <= 0) {
          scrollSecondaryX(delta);
        } else {
          st.setScroll(st.view.scrollX, st.view.scrollY + delta);
        }
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

  // Ook het secundaire pane selecteert uitsluitend een zichtbare balk of mijlpaal. De rij als
  // geheel blijft eigendom van de gedeelde DOM-grid.
  const handleSecondaryClick = useCallback((e: React.MouseEvent) => {
    const canvas = secondaryCanvasRef.current;
    const renderer = secondaryRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < headerHeight) return;
    const task = renderer.getRelationSourceAt(x, y);
    if (task) selectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey);
    else deselectAll();
  }, [selectTask, deselectAll, headerHeight]);

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

  // "Spring naar taak" (issue #65): `focusOnTask` (aangeroepen vanuit de WBS-sprongknop bij een
  // afhankelijkheid) klapt eerst de oudersketen uit en selecteert de taak, en zet dit signaal —
  // hier, waar de canvas-afmetingen én de al-bijgewerkte `viewRows` bekend zijn, kiezen we het
  // zoomniveau + de scroll (computeFocusTaskHorizontal/computeFocusTaskScrollY in
  // ganttViewport.ts) en wissen het signaal. Zelfde start/finish- en hour-mode-conventie als
  // `revealTaskIfOffscreen` hierboven — bewust een aparte effect, want die functie scrollt alleen
  // (zoom ongewijzigd, tegen de linkerrand), dit zoomt juist wél en centreert.
  //
  // Meet `containerRef`, niet `canvasRef` (hyperkritische review issue #65): de canvas-attributen
  // worden pas in de rAF-paint van `useCanvasLayer` gezet, dus `canvasRef` kan vlak na een
  // resize/splitter-sleep nog de vorige (of zelfs de HTML-default 300×150) afmeting hebben terwijl
  // `containerRef` — CSS-layout, geen canvas-attribuut — al klopt. Zelfde keuze als `pendingFit`.
  useEffect(() => {
    if (!pendingFocusTaskId) return;
    const clearPendingFocusTask = useAppStore.getState().clearPendingFocusTask;
    const container = containerRef.current;
    const task = tasks.find(t => t.id === pendingFocusTaskId);
    if (!container || !task) { clearPendingFocusTask(); return; }
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (!startStr || !endStr) { clearPendingFocusTask(); return; }

    const rect = container.getBoundingClientRect();
    const usable = rect.width - taskTableWidth;
    if (usable <= 0) { clearPendingFocusTask(); return; }

    const st = useAppStore.getState();
    const evs = parseDate(computeEffectiveViewStart(st.tasks, st.view.viewStartDate));
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const endRaw = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const endMs = endRaw.getTime() + (hourMode ? 0 : MS_PER_DAY);
    const durationDays = (endMs - start.getTime()) / MS_PER_DAY;
    const midDayOffset = ((start.getTime() + endMs) / 2 - evs.getTime()) / MS_PER_DAY;

    const { zoom, scrollX } = computeFocusTaskHorizontal(durationDays, midDayOffset, usable);

    // `focusOnTask` blijft een domeinactie met taskId-input. Bij resourcegroepering kan die taak
    // meerdere keren zichtbaar zijn: benoem daarom lokaal eerst deterministisch de eerste
    // occurrence als rowKey en zoek de visuele rij uitsluitend via die occurrence-key.
    const focusRowKey = resolveFirstVisibleFocusOccurrence(viewRows, pendingFocusTaskId)?.rowKey;
    const rowIndex = focusRowKey === undefined
      ? -1
      : viewRows.findIndex(row => row.rowKey === focusRowKey);
    const scrollY = rowIndex >= 0
      ? computeFocusTaskScrollY(rowIndex, rowHeight, headerHeight, rect.height)
      : st.view.scrollY; // niet gevonden (bv. weggefilterd) — verticaal onaangeroerd

    // Verouderde klem (hyperkritische review issue #65): `setScroll` klemt tegen `maxScrollX`/
    // `maxScrollY`, en die twee worden UITSLUITEND in `drawPrimary` gezet — pas in de eerstvolgende
    // rAF-paint, dus ná deze regel. Zonder correctie klemt `setScroll` hieronder tegen de grenzen
    // van de VORIGE zoom/rijtelling (bv. bijna nul vlak na een open-fit, of exact nul zolang alles
    // nog ingeklapt stond), en landt de sprong niet op de taak. Herbereken de grenzen daarom hier
    // zelf, met dezelfde formule als `drawPrimary` (`contentWidthFor` is dezelfde memoized functie,
    // geen kopie) en de NIEUWE zoom/rijtelling, vóór `setScroll` ze leest.
    setGanttScrollBounds(
      computeGanttScrollBounds(
        contentWidthFor(zoom, taskTableWidth), viewRows.length, rowHeight, headerHeight,
        rect.width, rect.height,
      ),
    );

    clearPendingFocusTask();
    st.setZoom(zoom);
    st.setScroll(scrollX, scrollY);
  }, [pendingFocusTaskId, tasks, viewRows, taskTableWidth, rowHeight, headerHeight, contentWidthFor]);

  // Sync horizontal scrollbar with canvas scrollX (also re-sync after zoom changes)
  useEffect(() => {
    const hScroll = hScrollRef.current;
    if (!hScroll) return;
    const desired = view.scrollX;
    if (Math.abs(hScroll.scrollLeft - desired) > 1) {
      hScroll.scrollLeft = desired;
    }
  }, [view.scrollX, view.zoom]);

  // Idem voor de secundaire balk (issue #35 punt 1). Nevengevolg — bewust: `setSplitView` klemt
  // niet (anders dan `setScroll`), dus een wheel-overscroll kon `secondaryScrollX` voorbij de
  // content duwen. De browser klemt `scrollLeft` op de echte scrollrange en het `onScroll` dat
  // daarop volgt schrijft die geklemde waarde terug — de balk werkt zo meteen als bovengrens.
  useEffect(() => {
    const el = hScrollSecondaryRef.current;
    if (!el || !splitView) return;
    const desired = splitView.secondaryScrollX;
    if (Math.abs(el.scrollLeft - desired) > 1) {
      el.scrollLeft = desired;
    }
  }, [splitView, secondaryContentWidth]);

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
    const tableW = 0;
    const rect = canvas.getBoundingClientRect();
    const usable = rect.width - tableW;
    if (usable <= 0) return;

    // effectiveViewStart: sinds K-item 33 LETTERLIJK dezelfde functie als de render-memo, niet meer
    // een tweede kopie die met de hand in de pas gehouden moest worden. Identiek aan de vorige
    // inline-lus voor elke geldige ISO-datum vanaf jaar 100 (`parseDate` kapt naar UTC-middernacht,
    // `addCalendarDays` houdt die vast, dus de format/parse-heenweg is verliesvrij). Twee
    // uitzonderingen staan bij de functie zelf beschreven: jaren onder 100, en een onparseerbare
    // `viewStartDate` — die gaf hier vroeger NaN en gooit nu.
    const evs = parseDate(computeEffectiveViewStart(st.tasks, v.viewStartDate));

    // Balk-uiteinden in content-x (dateToX zonder de −scrollX-term, dus `scrollX=0`), zelfde
    // uur/dag-splitsing als GanttRenderer.barGeometry: uur-taak [start, finish), dag-taak
    // [start, finish+1 dag]. Gedeeld met GanttRenderer/HistogramRenderer via `timeAxis.dateToX`
    // (issue #21 punt 5, fase 0-consolidatie) — zelfde formule, geen gedragswijziging.
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const end = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const cx1 = axisDateToX(start, evs, tableW, v.zoom, 0);
    const cx2 = axisDateToX(end, evs, tableW, v.zoom, 0) + (hourMode ? 0 : v.zoom);

    // Zichtbaar content-venster: canvas-x = content-x − scrollX ∈ [tableW, rect.width].
    const visibleLeft = tableW + v.scrollX;
    const visibleRight = visibleLeft + usable;
    if (cx2 > visibleLeft && cx1 < visibleRight) return; // al (deels) in beeld → geen sprong.

    // Lijn de START links uit met een kleine marge (dekt ook een balk breder dan het venster).
    const REVEAL_MARGIN_PX = 40;
    st.setScroll(Math.max(0, cx1 - tableW - REVEAL_MARGIN_PX), v.scrollY);
  }, []);

  // De DOM-grid is de eigenaar van rijselectie; deze eenrichtingsmelding vraagt uitsluitend om
  // de bijbehorende balk horizontaal te onthullen. De canvasselectie zelf blijft onaangeroerd.
  useEffect(() => {
    if (!revealRequest) return;
    const task = tasks.find(candidate => candidate.id === revealRequest.taskId);
    if (task) revealTaskIfOffscreen(task);
  }, [revealRequest, tasks, revealTaskIfOffscreen]);

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

    if (y < headerHeight) return;

    // De tijdlijn selecteert alleen een echte balk of mijlpaal. Rijselectie, disclosure en het
    // directe subtaak-plusje behoren nu uitsluitend aan de DOM-grid links van dit canvas.
    const task = renderer.getRelationSourceAt(x, y);
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
  }, [selectTask, deselectAll, headerHeight]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const task = renderer.getRelationSourceAt(x, y);
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

    if (y < headerHeight) return;

    const task = renderer.getRelationSourceAt(x, y);
    if (task) {
      // issue #21 punt 3: rechtsklik op een taak die al in de selectie zit behoudt de
      // multiselectie (standaard-UX) — alleen resetten naar enkele selectie als hij er nog niet
      // in zat. Zo werkt rechtsklik op één van meerdere geselecteerde balken als groepsactie.
      if (!selectedTaskIds.includes(task.id)) {
        selectTask(task.id, false);
      }
    }
    // `barHit` poort in ContextMenu.tsx precies één menu-item: `context.startRelationHere`
    // ("Relatie leggen vanaf hier"). Dat is een relatie-actie, geen sleep/resize-actie — dus
    // hoort hij de relatie-hittest te gebruiken, niet `getTaskBarBounds` (die is geschreven voor
    // slepen/resizen en weigert mijlpalen daarom terecht: een ruit heeft geen duur om te
    // resizen). Vóór de mijlpaal-fix (2026-08-14) miste een rechtsklik op een mijlpaal het item,
    // terwijl slepen vanaf diezelfde mijlpaal via `getRelationSourceAt` al wél werkte (zie
    // GanttRenderer.ts). Sinds het eigenaarsbesluit van 2026-08-15 geldt hetzelfde voor
    // verzamelbalken: `getRelationSourceAt` armt ze nu ook als bron, dus dit item verschijnt daar
    // óók. `getRelationSourceAt` geeft nog steeds null op de rij ernaast en op een datumloze taak
    // (geen zinnige balk om vanaf te starten) — die krijgen dan gewoon het rij-menu zonder het
    // relatie-item, zoals bedoeld. De uiteindelijke legaliteit (o.a. de voorouder-weigering) wordt
    // pas bij het loslaten bepaald, niet hier.
    if (!task) return;
    setContextMenu({ x: e.clientX, y: e.clientY, task, barHit: true, group: null });
  }, [selectTask, selectedTaskIds, headerHeight]);

  // Drag and drop: mousedown (task move/resize + dependency drawing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Issue #52 punt 2: middelste muisknop ingedrukt = pannen, in élke scroll-modus en ongeacht
    // wat er onder de cursor ligt (balk, tabel of lege achtergrond). preventDefault onderdrukt
    // meteen de browser-autoscroll die sommige platforms op middelklik starten. Loopt er al een
    // ánder gebaar (balk-drag/resize, relatie tekenen, rij-drag, box-select of een pan), dan
    // start er níét een tweede eroverheen — anders pant elke mousemove het beeld terwijl de
    // balk-drag doorloopt en landt de taak op een onbedoelde datum.
    if (e.button === 1) {
      e.preventDefault();
      if (barDrag.active || depDraw.active || boxSelect.active || pan.active) return;
      const v = useAppStore.getState().view;
      pan.startPan({
        button: 1,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originScrollX: v.scrollX,
        originScrollY: v.scrollY,
      });
      return;
    }
    if (e.button !== 0) return;
    // Spiegelbeeld van de guard hierboven: tijdens een lopende middelklik-pan mag een linksklik
    // geen balk-drag/box-select armen bovenop het schuivende beeld.
    if (pan.active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const renderer = rendererRef.current;
    if (!renderer) return;

    if (y < headerHeight) return;

    // Shift+drag tekent een relatie — en sinds issue #40 doet de relatiemodus exact hetzelfde
    // zónder toets ("plakkende Shift"), zodat de lint-knop/het contextmenu-item een écht gebaar
    // armen in plaats van een dode vlag te zetten. Bewust hetzelfde pad: een tweede interactie zou
    // met box-select (ctrl) en de balk-sleep om dezelfde muis-events vechten.
    //
    // Eigen hittest (spec 2026-08-14): getTaskBarBounds weigert mijlpalen omdat een ruit geen duur
    // heeft om te resizen — voor een relatie is dat geen bezwaar en was het een bug.
    if (e.shiftKey || dependencyMode) {
      const source = renderer.getRelationSourceAt(x, y);
      if (source) {
        e.preventDefault();
        depDraw.startDepDraw({
          sourceTaskId: source.id,
          sourceX: e.clientX,
          sourceY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        return;
      }
    }

    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // issue #21 punt 3: Ctrl/Cmd-klik op een balk is een selectiegebaar, geen drag/resize.
      // Vroeger liep mousedown hier altijd door naar barDrag + een harde single-reset
      // (selectTask(id, false)), waarna handleClick's toggle het id er weer uit haalde → bij
      // ctrl+klik netto deselectie. Nu armen we niets en laat handleClick de toggle doen; zonder
      // modifier is het gedrag identiek aan vroeger (select + drag armen).
      // NB: shift heeft hierboven een eigen pad (dependency-tekenen) en doet geen reset, dus
      // shift+klik-range-select werkte al — shift bewust niet in deze check opgenomen.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
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

    // Geen balk geraakt: de canvasachtergrond blijft eigenaar van pan en boxselectie.
    if (scrollMode === 'drag' && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const v = useAppStore.getState().view;
      pan.startPan({
        button: 0,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originScrollX: v.scrollX,
        originScrollY: v.scrollY,
      });
      return;
    }

    e.preventDefault();
    boxSelect.startBoxSelect({ startClientX: e.clientX, startClientY: e.clientY });
  }, [selectTask, scrollMode, depDraw, barDrag, boxSelect, pan, dependencyMode, headerHeight]);

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

    if (y < headerHeight) {
      setCursor('default');
      setTooltip(null);
      return;
    }

    // Check for task bar edges
    const hit = renderer.getTaskBarBounds(x, y);
    if (hit) {
      // Issue #40: shift OF de relatiemodus armt het relatie-tekenen — en dat wint in mousedown
      // óók op de randen (die branch staat vóór de resize-branch), dus toont de cursor hier
      // hetzelfde. Zo is de actieve modus zichtbaar zodra je boven een balk komt.
      if (e.shiftKey || dependencyMode) {
        setCursor('crosshair');
      } else if (hit.edge === 'left' || hit.edge === 'right') {
        setCursor('ew-resize');
      } else {
        setCursor('grab');
      }
      // Show tooltip for the hovered task
      setTooltip({ x: e.clientX, y: e.clientY, task: hit.task });
      return;
    }

    setTooltip(null);

    // In 'drag' scroll mode, show a grab affordance over the pannable chart
    // background so panning is discoverable — maar met Ctrl/Cmd ingedrukt schakelt de
    // achtergrond naar box-select, dus toon dan het crosshair (zelfde signaal als elders).
    if (scrollMode === 'drag') {
      setCursor(e.ctrlKey || e.metaKey ? 'crosshair' : 'grab');
      return;
    }

    setCursor('default');
  }, [barDrag.active, depDraw.active, pan.active, boxSelect.active, contextMenu, scrollMode, dependencyMode, headerHeight]);

  // Hide tooltip on mouse leave
  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // De andere as komt VERS uit de store, niet uit de render-closure: sinds issue #35 kunnen er twee
  // scrollbalken (horizontaal + verticaal) in dezelfde tick vuren — bv. een diagonale trackpad-veeg.
  // Met een closure-waarde zou de tweede handler de as van de eerste terugzetten naar de stand van
  // de laatste render; met een verse lezing houden beide assen elkaars update vast.
  const handleHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScroll(target.scrollLeft, useAppStore.getState().view.scrollY);
  }, [setScroll]);

  // Issue #35 punt 1: het secundaire pane heeft een EIGEN tijdvenster, dus deze balk schrijft naar
  // `splitView.secondaryScrollX` en mag `view.scrollX` niet aanraken. Alles vers uit de store
  // (zelfde patroon als de secundaire wheel-handler): zo blijft de callback stabiel en kan hij
  // nooit een verouderde ratio/zoom mee terugschrijven in het `{...sv}`-object.
  const handleSecondaryHScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const st = useAppStore.getState();
    const sv = st.view.splitView;
    if (!sv || Math.abs(sv.secondaryScrollX - scrollLeft) <= 1) return;
    st.setSplitView({ ...sv, secondaryScrollX: Math.max(0, scrollLeft) });
  }, []);

  // Idem voor de tweede mini-map-strook (issue #35 punt 1): stabiele callback, verse store-state —
  // MiniMap zelf weet niets van split view, hij levert alleen een nieuwe scrollX.
  const handleSecondaryMiniScroll = useCallback((next: number) => {
    const st = useAppStore.getState();
    const sv = st.view.splitView;
    if (!sv) return;
    st.setSplitView({ ...sv, secondaryScrollX: Math.max(0, next) });
  }, []);

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
          className="absolute inset-0"
          style={{
            cursor: pan.panState
                ? 'grabbing'
                : barDrag.dragState
                  ? (barDrag.dragState.edge === 'body' ? 'grabbing' : 'ew-resize')
                  : depDraw.active
                    ? 'crosshair'
                    : boxSelect.boxSelectState
                      ? 'crosshair'
                        // Issue #40: staat de relatiemodus aan, dan is een balk-cursor altijd het
                        // crosshair — ook als de muis sinds het aanzetten niet bewogen heeft (de
                        // hover-handler hierboven vuurt dan immers niet).
                        : dependencyMode && (cursor === 'grab' || cursor === 'ew-resize')
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
          onScroll={handleHScroll}
        >
          <div style={{ width: Math.max(1, totalContentWidth - taskTableWidth), height: 1 }} />
        </div>
      </div>
      {/* Secundair pane (§10): eigen tijdvenster, gedeelde rijen + verticale scroll */}
      {splitView && (
        <>
          <div
            data-testid="split-ratio-bar"
            onMouseDown={e => { e.preventDefault(); setIsResizingSplit(true); }}
            style={{ width: SPLIT_RATIO_BAR_WIDTH, flexShrink: 0, cursor: 'col-resize', background: 'var(--theme-border)' }}
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
              onScroll={handleSecondaryHScroll}
            >
              <div style={{ width: Math.max(1, secondaryContentWidth), height: 1 }} />
            </div>
          </div>
        </>
      )}
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
              <HoverTooltip left={histoTooltip.x + 14} top={histoTooltip.y - 10}>
                {/* Issue #58 geldt hier net zo goed: dit zijn resourcenamen, tot 9 regels. */}
                {histoTooltip.lines.map((l, i) => (
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
            <MiniMap originDate={effectiveViewStart} chartWidth={primaryChartWidth} />
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
                  onScrollXChange={handleSecondaryMiniScroll}
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
          onClose={() => setContextMenu(null)}
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
          onExpandAll={() => expandAllGroups()}
          onCollapseAll={() => collapseAllGroups()}
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
    </div>
  );
}
