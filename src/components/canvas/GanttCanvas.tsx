import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useEffectiveDurationDisplay, useProfileCountsWorkdays } from '@/hooks/useDurationMeasure';
import { useAppStore } from '@/state/appStore';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { useDisplayDate } from '@/hooks/displayDate';
import { useTranslation } from 'react-i18next';
import {
  histogramPlotInsets,
  type HistogramPickerItem,
  type HistogramPickerSide,
  type HistogramSeries,
} from '@/engine/renderer/HistogramRenderer';
import { saveBranchAsWbsTemplate } from '@/utils/wbsTemplates';
import { resolveUIFontStack } from '@/utils/uiFont';
import { scopeTaskResources } from '@/utils/taskResourceScope';
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { MiniMap } from './MiniMap';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant } from '@/utils/taskDates';
import { splitPanePrimaryWidthCss } from '@/utils/ganttViewport';
import { effectiveCalendarByTask } from '@/services/subdayIo';
import { durationSuffixesFrom } from '@/utils/taskDuration';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { isTreeMode } from '@/engine/view/visibleRows';
import { ContextMenu } from './ContextMenu';
import { contextMenuOutlineScope, contextMenuBulk } from './contextMenuScope';
import { addTaskAtEnd } from '@/state/taskInsertActions';
import { buildNewTask, createDefaultTaskTime, deriveScheduleDurationFromMinutes, seedNewHourTaskFinish } from '@/utils/taskDefaults';
import { newTaskTimeUnit, settleNewTaskMeasure } from '@/state/newTaskMeasure';
import { effHoursPerDay } from '@/utils/taskDuration';
import { RelationTypePopover } from './RelationTypePopover';
import { createRelationDraftWithFeedback, requestRelationAssign } from '@/state/relationActions';
import { HoverTooltip } from './HoverTooltip';
import { MilestoneGroupTooltipContent, TaskTooltipContent } from './TaskTooltipContent';
import { getLocalizedMonths } from '@/i18n/dateFormat';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { saveHistogramHeight } from '@/utils/settingsStore';
import { buildBaselineLayers, comparisonOverlays, shownBaselineReach } from '@/types/baseline';
import { BaselineTooltipContent } from './BaselineTooltipContent';
import {
  buildBaselineOverlay,
  buildSharedAxis,
  buildHistogramPicker, buildHistogramSeries,
  type GanttRenderOptionsSourceInput,
} from './ganttRenderOptions';
import { buildTrace } from '@/engine/taskGrid/trace';
import { isLooseDayEndMilestone, predecessorDrivenTaskIds } from '@/engine/startEditConstraint';
import { useGanttRendererHost, useGanttRendererRefs } from './hooks/useGanttRendererHost';
import { useGanttViewportCoordinator } from './hooks/useGanttViewportCoordinator';
import { useGanttHistogramInteraction } from './hooks/useGanttHistogramInteraction';
import { useGanttHistogramPickerScroll } from './hooks/useGanttHistogramPickerScroll';
import { useGanttPointerCoordinator } from './hooks/useGanttPointerCoordinator';
import { editableSplitPieces } from './hooks/useBarDrag';
import { removeGap } from '@/engine/scheduler/splitEdit';
import { useGanttRowDragBridge } from './ganttRowDragBridge';
import { TASK_ROW_HEIGHT } from '@/engine/taskGrid/rowHeight';
import { OVERLAY_SCROLLBAR_SIZE } from '@/engine/taskGrid/scrollExtent';
import { GANTT_WORKSPACE_SPLITTER_GRIP } from './ganttSplitter';
import type { GanttTooltipState, HistogramRenderInput } from './hooks/ganttCoordinatorTypes';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { Icon } from '@/components/icons';

const ROW_HEIGHT = TASK_ROW_HEIGHT;
const HEADER_HEIGHT = 50;
const SPLIT_RATIO_BAR_WIDTH = 5;

export interface GanttGridRevealRequest {
  taskId: string;
  nonce: number;
}

export interface GanttCanvasProps {
  revealRequest?: GanttGridRevealRequest | null;
  histogramHost: HTMLDivElement | null;
  histogramPickerWidth: number;
  histogramPickerSide: HistogramPickerSide;
  miniMapHost: HTMLDivElement | null;
}

const NO_SEQUENCES: Sequence[] = [];

export function GanttCanvas({
  revealRequest = null,
  histogramHost,
  histogramPickerWidth,
  histogramPickerSide,
  miniMapHost,
}: GanttCanvasProps) {
  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const displayDateFormat = useDisplayDate();
  const { labels: taskTypeLabels } = useTaskTypeLabels();

  const tasks = useAppStore(s => s.tasks);
  const allSequences = useAppStore(s => s.sequences);
  const showRelations = useAppStore(s => s.view.showRelations ?? true);
  const sequences = useMemo(() => (showRelations ? allSequences : NO_SEQUENCES), [showRelations, allSequences]);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const barSplitMode = useAppStore(s => s.ui.barSplitMode);
  const compressNonWorkdays = useAppStore(s => s.ui.compressNonWorkdays);

  const durationDisplay = useEffectiveDurationDisplay();
  const workdayDurationMeasure = useProfileCountsWorkdays();
  const view = useAppStore(s => s.view);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const selectTasks = useAppStore(s => s.selectTasks);
  const deselectAll = useAppStore(s => s.deselectAll);
  const addTask = useAppStore(s => s.addTask);
  const updateTask = useAppStore(s => s.updateTask);
  const notify = useAppStore(s => s.notify);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const timeNotation = useAppStore(s => s.ui.timeNotation);
  const isStartDrivenByPredecessor = useCallback(
    (taskId: string) => predecessorDrivenTaskIds(tasks, allSequences).has(taskId),
    [tasks, allSequences],
  );
  const dependencyMode = useAppStore(s => s.ui.showDependencyMode);
  const splitMode = useAppStore(s => s.ui.showSplitMode);
  const setTaskSplits = useAppStore(s => s.setTaskSplits);
  const undo = useAppStore(s => s.undo);
  const historyMark = useAppStore(s => s.historyMark);
  const revertHistorySince = useAppStore(s => s.revertHistorySince);
  const endHistorySession = useAppStore(s => s.endHistorySession);
  const setScroll = useAppStore(s => s.setScroll);
  const setUI = useAppStore(s => s.setUI);
  const setGridActiveRowKey = useCallback((rowKey: string) => setUI({ gridActiveRowKey: rowKey }), [setUI]);
  const pasteTasks = useAppStore(s => s.pasteTasks);
  const taskClipboard = useAppStore(s => s.taskClipboard);
  const expandAllGroups = useAppStore(s => s.expandAllGroups);
  const collapseAllGroups = useAppStore(s => s.collapseAllGroups);
  const collapseTasks = useAppStore(s => s.collapseTasks);
  const expandTasks = useAppStore(s => s.expandTasks);
  const setZoom = useAppStore(s => s.setZoom);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const uiTheme = useResolvedUITheme();
  const canvasThemeRevision = uiTheme;
  const uiFontFamily = useAppStore(s => s.ui.uiFontFamily);
  const canvasFontFamily = resolveUIFontStack(uiFontFamily);
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
  const viewRows = useAppStore(s => s.viewRows);
  const setCollapsedGroupKey = useAppStore(s => s.setCollapsedGroupKey);
  const splitView = useAppStore(s => s.view.splitView);
  const setSplitView = useAppStore(s => s.setSplitView);
  const clearPendingFit = useAppStore(s => s.clearPendingFit);
  const clearPendingFocusTask = useAppStore(s => s.clearPendingFocusTask);
  const showMiniMap = useAppStore(s => s.ui.showMiniMap);
  const showHistogram = useAppStore(s => s.ui.showHistogram);
  const histogramHeight = useAppStore(s => s.ui.histogramHeight);
  const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const statusDate = useAppStore(s => s.project.statusDate);
  const schedulingProfile = useAppStore(s => s.project.schedulingProfile);
  const projectSchedulingOptions = useAppStore(s => s.project.schedulingOptions);
  const looseDayEndMilestone = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const dayEnd = effectiveSchedulingOptions({ schedulingProfile, schedulingOptions: projectSchedulingOptions })
      .milestoneWithoutPredecessorAtDayEnd;
    return !!task && isLooseDayEndMilestone(task, tasks, allSequences, dayEnd);
  }, [tasks, allSequences, schedulingProfile, projectSchedulingOptions]);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  const showProgressLine = useAppStore(s => s.ui.showProgressLine);
  const showResourceAccent = useAppStore(s => s.ui.showResourceAccent);
  const showFloatBand = useAppStore(s => s.ui.showFloatBand);
  const showBarDates = useAppStore(s => s.ui.showBarDates);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const customTaskTypes = useAppStore(s => s.customTaskTypes);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const comparedBaselineIds = useAppStore(s => s.comparedBaselineIds);
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
      effectiveSchedulingOptions({ schedulingProfile, schedulingOptions: projectSchedulingOptions }),
    );
  }, [resourceLoadResult, scopedTaskResources, tasks, calendar, calendars, schedulingProfile, projectSchedulingOptions]);

  const effectiveHistogramResourceId = scopedTaskResources.resources.some(
    resource => resource.id === histogramResourceId,
  ) ? histogramResourceId : undefined;

  const baselineReach = useMemo(
    () => shownBaselineReach(baselines, activeBaselineId, comparedBaselineIds),
    [baselines, activeBaselineId, comparedBaselineIds],
  );
  const viewport = useGanttViewportCoordinator({
    tasks,
    baselineReach,
    rows: viewRows,
    calendar,
    view,
    histogramPickerWidth,
    histogramPickerSide,
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
    setHistogramHeight: height => setUI({ histogramHeight: height }),
    persistHistogramHeight: height => { void saveHistogramHeight(height); },
  });
  const {
    paneRowRef,
    primaryContainerRef: containerRef,
    secondaryContainerRef,
    histogramContainerRef,
    primaryHScrollRef: hScrollRef,
    secondaryHScrollRef: hScrollSecondaryRef,
  } = viewport.refs;
  const [histogramContainerEl, setHistogramContainerEl] = useState<HTMLDivElement | null>(null);
  const setHistogramContainerNode = useCallback((node: HTMLDivElement | null) => {
    histogramContainerRef.current = node;
    setHistogramContainerEl(node);
  }, [histogramContainerRef]);
  const effectiveViewStart = viewport.effectiveViewStart;
  const effectiveView = viewport.effectiveView;
  const sharedAxis = viewport.sharedAxis;
  const histogramAxis = viewport.histogramAxis;
  const minimapAxisDayOf = useMemo(() => {
    if (!compressNonWorkdays) return undefined;
    const axis = buildSharedAxis({
      calendar, compressNonWorkdays, viewStartDate: effectiveViewStart, chartOriginX: 0, zoom: 1, scrollX: 0,
    });
    const originIndex = axis.dayIndexOf(parseDate(effectiveViewStart));
    return (date: Date) => axis.dayIndexOf(date) - originIndex;
  }, [calendar, compressNonWorkdays, effectiveViewStart]);
  const primaryChartWidth = viewport.primary.chartWidth;
  const secondaryChartWidth = viewport.secondary?.chartWidth ?? 0;
  const histogramSplitter = viewport.splitters.histogram;
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
  const localizedWeekdays = useMemo(
    () => [
      tMenu('ribbon.calendarDialog.days.7'),
      tMenu('ribbon.calendarDialog.days.1'),
      tMenu('ribbon.calendarDialog.days.2'),
      tMenu('ribbon.calendarDialog.days.3'),
      tMenu('ribbon.calendarDialog.days.4'),
      tMenu('ribbon.calendarDialog.days.5'),
      tMenu('ribbon.calendarDialog.days.6'),
    ],
    [tMenu],
  );
  const durationSuffixes = useMemo(() => durationSuffixesFrom(tCommon), [tCommon]);

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
  const describeHistogramNonWorkingDay = useCallback((resourceId: string, isoDate: string): string | null => {
    const reason = scopedResourceLoadResult?.overallocatedReasons[resourceId]?.[isoDate];
    if (reason !== 'non-working-day') return null;
    const resource = scopedTaskResources.resources.find(r => r.id === resourceId);
    const resourceCalendar = resolveCalendar(resource?.calendarId, calendars, calendar);
    return tCommon('resource.histogram.overallocatedNonWorkingDay', { calendar: resourceCalendar.name });
  }, [scopedResourceLoadResult, scopedTaskResources, calendars, calendar, tCommon]);
  const histogramInteraction = useGanttHistogramInteraction({
    canvasRef: histogramCanvasRef,
    rendererRef: histogramRendererRef,
    assignments: scopedTaskResources.assignments,
    resources: scopedTaskResources.resources,
    tasks,
    selectedResourceId: effectiveHistogramResourceId,
    selectResource: setHistogramResource,
    formatContributionLabel: formatHistogramContributionLabel,
    describeNonWorkingDay: describeHistogramNonWorkingDay,
    active: showHistogram,
  });

  const defaultTaskName = tTask('defaultTask');
  const defaultMilestoneName = tTask('defaultMilestone');
  const addAtClickedDate = (milestone: boolean) => {
    const date = pointer.contextMenu?.clickDate;
    const partial = {
      name: milestone ? defaultMilestoneName : defaultTaskName,
      ...(milestone ? { isMilestone: true, milestoneKind: 'FINISH' as const, taskType: 'USERDEFINED' as const } : {}),
    };
    if (!date) { addTaskAtEnd(partial); return; }
    if (milestone) { addTaskAtEnd({ ...partial, time: createDefaultTaskTime(date, 0, 'days', calendar) }); return; }
    const state = useAppStore.getState();
    const task = buildNewTask(partial, { id: '', parentId: null, parentTask: undefined, constructionMode: state.ui.constructionMode,
      time: createDefaultTaskTime(date, milestone ? 0 : 5, newTaskTimeUnit(state.project), calendar) });
    const hoursPerDay = effHoursPerDay(calendar);
    deriveScheduleDurationFromMinutes(task.time, hoursPerDay);
    settleNewTaskMeasure(task, state.project, false, hoursPerDay);
    seedNewHourTaskFinish(task, undefined, calendar);
    addTaskAtEnd({ ...partial, time: task.time });
  };
  const revealTaskIfOffscreen = useCallback((task: Task) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const startString = shownStart(task);
    const finishString = shownFinish(task);
    if (!startString || !finishString) return;
    const state = useAppStore.getState();
    const currentView = state.view;
    const rect = canvas.getBoundingClientRect();
    const usableWidth = rect.width;
    if (usableWidth <= 0) return;
    const hourMode = startString.includes('T') || finishString.includes('T');
    const start = hourMode ? parseInstant(startString) : parseDate(startString);
    const finish = hourMode ? finishInstant(finishString) : parseDate(finishString);
    const startX = sharedAxis.dateToX(start) + currentView.scrollX;
    const finishX = sharedAxis.dateToX(finish) + currentView.scrollX
      + (hourMode ? 0 : currentView.zoom);
    const visibleLeft = currentView.scrollX;
    const visibleRight = visibleLeft + usableWidth;
    if (finishX > visibleLeft && startX < visibleRight) return;
    state.setScroll(Math.max(0, startX - 40), currentView.scrollY);
  }, [canvasRef, sharedAxis]);

  const handledRevealNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!revealRequest) return;
    if (handledRevealNonceRef.current === revealRequest.nonce) return;
    handledRevealNonceRef.current = revealRequest.nonce;
    const task = tasks.find(candidate => candidate.id === revealRequest.taskId);
    if (task) revealTaskIfOffscreen(task);
  }, [revealRequest, tasks, revealTaskIfOffscreen]);

  const openTask = useCallback((taskId: string) => {
    setUI({ showTaskDialog: true, editingTaskId: taskId });
  }, [setUI]);

  const rowDragBridge = useGanttRowDragBridge();
  const startVerticalRowDrag = useCallback((candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => {
    rowDragBridge?.startRef.current?.(candidate);
  }, [rowDragBridge]);

  const pointer = useGanttPointerCoordinator({
    host: rendererHost,
    viewport,
    tasks,
    calendar,
    effectiveCalendarByTaskId: effectiveCalById,
    selectedTaskIds,
    headerHeight,
    dependencyMode,
    splitMode,
    scrollMode,
    enableQuarterHourZoom,
    workdayDurationMeasure,

    compressNonWorkdays,
    selectTask,
    selectTasks,
    setGridActiveRowKey,
    deselectAll,
    updateTask,
    setTaskSplits,
    undo,
    historyMark,
    revertHistorySince,
    endHistorySession,
    setScroll,
    openTask,
    clearHistogramTooltip: histogramInteraction.clearTooltip,
    startVerticalRowDrag: rowDragBridge ? startVerticalRowDrag : undefined,
    isStartDrivenByPredecessor,
    looseDayEndMilestone,
    notify,
    dateNotation,
    timeNotation,
  });

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

  const durationDrag = useMemo(
    () => (pointer.overlays.barDrag && pointer.overlays.barDrag.edge !== 'body'
      ? { taskId: pointer.overlays.barDrag.taskId, edge: pointer.overlays.barDrag.edge }
      : undefined),
    [pointer.overlays.barDrag],
  );

  const baselineOverlay = useMemo(
    () => buildBaselineOverlay(baselines, activeBaselineId),
    [baselines, activeBaselineId],
  );
  const baselineLayers = useMemo(
    () => buildBaselineLayers(baselines, activeBaselineId, comparedBaselineIds),
    [baselines, activeBaselineId, comparedBaselineIds],
  );
  const baselineComparisons = useMemo(() => comparisonOverlays(baselineLayers), [baselineLayers]);

  const trace = useMemo(
    () => buildTrace(traceMode, selectedTaskIds, allSequences, cpmResult),
    [traceMode, selectedTaskIds, allSequences, cpmResult],
  );

  const histogramPicker = useMemo<HistogramPickerItem[]>(
    () => buildHistogramPicker(scopedTaskResources.resources, scopedResourceLoadResult, tCommon('resource.histogram.allResources')),
    [scopedTaskResources.resources, scopedResourceLoadResult, tCommon],
  );

  const histogramSeries = useMemo<HistogramSeries>(
    () => buildHistogramSeries(scopedResourceLoadResult, effectiveHistogramResourceId, scopedTaskResources.resources),
    [scopedResourceLoadResult, effectiveHistogramResourceId, scopedTaskResources.resources],
  );

  const histogramPickerIds = useMemo(
    () => histogramPicker.map(item => item.id),
    [histogramPicker],
  );
  const { pickerScrollY: histogramPickerScrollY } = useGanttHistogramPickerScroll({
    container: showHistogram ? histogramContainerEl : null,
    pickerWidth: histogramPickerWidth,
    pickerSide: histogramPickerSide,
    canvasHeight: histogramHeight,
    itemCount: histogramPicker.length,
    pickerIds: histogramPickerIds,
    selectedResourceId: effectiveHistogramResourceId,
    fontScale,
  });

  const histogramRenderInput = useMemo<HistogramRenderInput | undefined>(() => (
    showHistogram ? {
      series: histogramSeries,
      picker: histogramPicker,
      selectedResourceId: effectiveHistogramResourceId,
      view: effectiveView,
      pickerWidth: histogramPickerWidth,
      pickerSide: histogramPickerSide,
      pickerScrollY: histogramPickerScrollY,
      axis: histogramAxis,
      fontFamily: canvasFontFamily,
      fontScale,
      labels: { unitsSuffix: tCommon('resource.histogram.units'), numberLocale: i18n.language },
      emptyHint: !scopedResourceLoadResult
        ? tCommon('resource.histogram.noData')
        : scopedTaskResources.resources.length === 0
          ? tCommon('resource.histogram.noResources')
          : undefined,
    } : undefined
  ), [showHistogram, histogramSeries, histogramPicker, effectiveHistogramResourceId, effectiveView, histogramPickerWidth, histogramPickerSide, histogramPickerScrollY, scopedResourceLoadResult, scopedTaskResources.resources.length, tCommon, i18n.language, histogramAxis, canvasFontFamily, fontScale]);

  const primaryRenderInput = useMemo<GanttRenderOptionsSourceInput>(() => ({
    rows: viewRows,
    sequences,
    calendar,
    view: effectiveView,
    selectedTaskIds,
    cpmResult,
    statusDate,
    showStatusDateLine,
    showProgressLine,
    showResourceAccent,
    showFloatBand,
    showBarDates,
    barColorSelection,
    activityCodeTypes,
    customFieldDefs,
    taskTypeLabels,
    customTaskTypes,
    barColorNoneLabel: tTask('structure.none'),
    resources,
    assignments,
    showBaselineOverlay,
    baselineOverlay,
    baselineComparisons,
    trace,
    rowHeight,
    headerHeight,
    localizedMonths,
    localizedWeekdays,
    weekStartDay,
    timeNotation,
    dateNotation,
    enableQuarterHourZoom,
    effectiveCalById,
    barSplitMode,

    durationDisplay,
    workdayDurationMeasure,
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
  }), [viewRows, sequences, calendar, effectiveView, selectedTaskIds, cpmResult, statusDate, showStatusDateLine, showProgressLine, showResourceAccent, showFloatBand, showBarDates, barColorSelection, activityCodeTypes, customFieldDefs, taskTypeLabels, customTaskTypes, resources, assignments, showBaselineOverlay, baselineOverlay, baselineComparisons, trace, rowHeight, headerHeight, localizedMonths, localizedWeekdays, weekStartDay, timeNotation, dateNotation, enableQuarterHourZoom, effectiveCalById, barSplitMode, durationDisplay, workdayDurationMeasure, durationSuffixes, tTask, durationDrag, uiTheme, compressNonWorkdays, sharedAxis, canvasFontFamily, fontScale]);

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
      cpmResult,
      statusDate,
      showStatusDateLine,
      showProgressLine,
      showResourceAccent,
      showFloatBand,
      showBarDates,
      barColorSelection,
      activityCodeTypes,
      customFieldDefs,
      taskTypeLabels,
      customTaskTypes,
      barColorNoneLabel: tTask('structure.none'),
      resources,
      assignments,
      showBaselineOverlay,
      baselineOverlay,
      baselineComparisons,
      trace,
      rowHeight,
      headerHeight,
      localizedMonths,
      localizedWeekdays,
      weekStartDay,
      timeNotation,
      dateNotation,
      enableQuarterHourZoom,
      effectiveCalById,
      barSplitMode,

      durationDisplay: undefined,
      workdayDurationMeasure,
      durationSuffixes: undefined,
      externalStaleLabel: tTask('externalLinks.stale'),
      durationDrag: undefined,
      highContrast: uiTheme === 'high-contrast',
      palette: undefined,
      darkTheme: uiTheme === 'dark',
      compressNonWorkdays,
      axis: undefined,
      fontFamily: canvasFontFamily,
      fontScale,
    } : undefined
  ), [splitView, viewRows, sequences, calendar, effectiveView, selectedTaskIds, cpmResult, statusDate, showStatusDateLine, showProgressLine, showResourceAccent, showFloatBand, showBarDates, barColorSelection, activityCodeTypes, customFieldDefs, taskTypeLabels, customTaskTypes, resources, assignments, showBaselineOverlay, baselineOverlay, baselineComparisons, trace, rowHeight, headerHeight, localizedMonths, localizedWeekdays, weekStartDay, timeNotation, dateNotation, enableQuarterHourZoom, effectiveCalById, barSplitMode, workdayDurationMeasure, tTask, uiTheme, compressNonWorkdays, canvasFontFamily, fontScale]);

  useGanttRendererHost({
    containers: {
      primaryContainerRef: containerRef,
      secondaryContainerRef,
      histogramContainerRef,
      histogramContainer: histogramContainerEl,
    },
    primary: primaryRenderInput,
    secondary: secondaryRenderInput,
    histogram: histogramRenderInput,
    renderRevision: canvasThemeRevision,
    onPrimarySize: viewport.onPrimarySize,
    onSecondarySize: viewport.onSecondarySize,
  }, rendererHost);

  const handleSecondaryClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    const canvas = secondaryCanvasRef.current;
    const renderer = secondaryRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < headerHeight) return;
    const task = renderer.getRelationSourceAt(x, y) ?? renderer.getTaskNameAt(x, y);
    if (task) {
      selectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey, {
        rowKey: renderer.getRowAtY(y)?.rowKey,
        taskIds: renderer.getMilestoneGroup(task.id)?.map(member => member.id),
      });
    } else deselectAll();
  }, [secondaryCanvasRef, secondaryRendererRef, selectTask, deselectAll, headerHeight]);

  const [secondaryTooltip, setSecondaryTooltip] = useState<GanttTooltipState | null>(null);
  const handleSecondaryMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = secondaryCanvasRef.current;
    const renderer = secondaryRendererRef.current;
    if (!canvas || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hit = y >= headerHeight ? renderer.getBaselineAt(e.clientX - rect.left, y) : null;
    setSecondaryTooltip(hit ? { x: e.clientX, y: e.clientY, task: hit.task, baselineSlots: hit.slots } : null);
  }, [secondaryCanvasRef, secondaryRendererRef, headerHeight]);

  const { contextMenu, relationPopover, tooltip } = pointer;
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const { closeForDocumentSwitch } = pointer;
  useEffect(() => { closeForDocumentSwitch(); }, [activeDocumentId, closeForDocumentSwitch]);
  const boxSelectState = pointer.overlays.boxSelect;
  const splitOverlay = pointer.overlays.split;
  const splitDragLabel = pointer.overlays.barSplitDrag;

  const histogramPortal = histogramHost
    ? createPortal(showHistogram ? (
        <div data-testid="gantt-histogram" style={{ display: 'contents' }}>
          <div
            className="histogram-splitter"
            onMouseDown={event => { event.preventDefault(); histogramSplitter.start(); }}
            style={{ height: 5, flexShrink: 0, cursor: 'row-resize', background: 'var(--theme-border)' }}
          />
          <div
            ref={setHistogramContainerNode}
            className="relative overflow-hidden"
            style={{ height: histogramHeight, flexShrink: 0 }}
            data-tour-anchor="histogram-strip"
          >
            <canvas
              ref={histogramCanvasRef}
              data-testid="gantt-histogram-canvas"
              tabIndex={0}
              className="absolute inset-0 outline-none"
              style={{ cursor: 'pointer' }}
              onClick={handleHistogramClick}
              onMouseMove={histogramInteraction.onMouseMove}
              onMouseLeave={histogramInteraction.onMouseLeave}
              onKeyDown={histogramInteraction.onKeyDown}
            />
            {scheduleStale && (
              <div
                className={`absolute top-1 !text-small px-1.5 py-0.5 rounded pointer-events-none${' inline-flex items-center gap-1'}`}
                data-ops-histogram-stale-hint
                style={{
                  right: `calc(${histogramPlotInsets(histogramPickerWidth, histogramPickerSide).right}px + 0.5rem)`,
                  background: 'var(--theme-surface)',
                  color: 'var(--theme-warning-text)',
                  opacity: 0.9,
                }}
              >
                <Icon id="status.warning" size={16} />{tCommon('resource.histogram.staleHint')}
              </div>
            )}
            {histogramInteraction.tooltip && (
              <HoverTooltip left={histogramInteraction.tooltip.x + 14} top={histogramInteraction.tooltip.y - 10}>
                {histogramInteraction.tooltip.lines.map((line, index) => (
                  <div key={index} className={index === 0 ? 'tooltip-title' : 'tooltip-row'}>{line}</div>
                ))}
              </HoverTooltip>
            )}
          </div>
        </div>
      ) : null, histogramHost)
    : null;

  const miniMapPortal = miniMapHost
    ? createPortal(showMiniMap ? (
        <div className="flex w-full" dir="ltr" style={{ flexShrink: 0 }}>
          <div
            style={{
              width: splitView
                ? splitPanePrimaryWidthCss(splitView.ratio, SPLIT_RATIO_BAR_WIDTH)
                : '100%',
              flexShrink: 0,
            }}
          >
            <MiniMap
              originDate={effectiveViewStart}
              axisDayOf={minimapAxisDayOf}
              timelineWidth={primaryChartWidth}
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
                  axisDayOf={minimapAxisDayOf}
                  timelineWidth={secondaryChartWidth}
                  scrollX={splitView.secondaryScrollX}
                  zoom={splitView.secondaryZoom}
                  onScrollXChange={viewport.minimap.secondaryScrollTo}
                  testId="minimap-secondary"
                />
              </div>
            </>
          )}
        </div>
      ) : null, miniMapHost)
    : null;

  const splitterOnLeft = histogramPickerSide === 'left';
  const primaryHScrollInset = {
    left: splitterOnLeft ? GANTT_WORKSPACE_SPLITTER_GRIP : 0,
    right: !splitterOnLeft && !splitView ? GANTT_WORKSPACE_SPLITTER_GRIP : 0,
  };
  const secondaryHScrollInsetRight = !splitterOnLeft && splitView ? GANTT_WORKSPACE_SPLITTER_GRIP : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={paneRowRef} className="flex-1 min-w-0 flex overflow-hidden relative" dir="ltr">
      <div
        ref={containerRef}
        className="overflow-hidden relative"
        style={{
          width: splitView
            ? splitPanePrimaryWidthCss(splitView.ratio, SPLIT_RATIO_BAR_WIDTH)
            : '100%',
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="gantt-primary-canvas"
          tabIndex={0}
          className="absolute inset-0 outline-none"
          style={{ cursor: pointer.cursor }}
          onClick={handlePrimaryClick}
          onDoubleClick={pointer.onDoubleClick}
          onMouseDown={pointer.onMouseDown}
          onMouseMove={pointer.onMouseMove}
          onMouseLeave={pointer.onMouseLeave}
          onContextMenu={pointer.onContextMenu}
        />
        <canvas
          ref={depLineCanvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        />

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

        {splitOverlay && (
          <div
            data-testid="split-mode-label"
            className="absolute text-small leading-4 px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap"
            style={{
              left: Math.max(splitOverlay.anchorX, splitOverlay.currentX) + 6,
              top: splitOverlay.top - 18,
              background: 'var(--theme-accent)',
              color: 'var(--theme-accent-contrast, #fff)',
              zIndex: 3,
            }}
          >
            {splitOverlay.gapUnits > 0
              ? tTask(splitOverlay.hourMode ? 'split.gapHours' : 'split.gapDays', { count: splitOverlay.gapUnits })
              : displayDateFormat.dateTime(splitOverlay.atIso)}
          </div>
        )}

        {splitDragLabel && (
          <div
            data-testid="split-drag-label"
            className="absolute text-small leading-4 px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap"
            style={{
              left: splitDragLabel.x + 6,
              top: splitDragLabel.top - 18,
              background: 'var(--theme-accent)',
              color: 'var(--theme-accent-contrast, #fff)',
              zIndex: 3,
            }}
          >
            {splitDragLabel.kind === 'gap'
              ? (splitDragLabel.units > 0
                ? tTask(splitDragLabel.hourMode ? 'split.gapHours' : 'split.gapDays', { count: splitDragLabel.units })
                : tTask('split.merged'))
              : tTask(splitDragLabel.hourMode ? 'split.pieceHours' : 'split.pieceDays', { count: splitDragLabel.units })}
          </div>
        )}

        {tooltip && (
          <HoverTooltip left={tooltip.x + 16} top={tooltip.y - 10}>
            {tooltip.baselineSlots !== undefined
              ? <BaselineTooltipContent task={tooltip.task} slots={tooltip.baselineSlots} layers={baselineLayers} />
              : tooltip.group
                ? <MilestoneGroupTooltipContent tasks={tooltip.group} />
                : <TaskTooltipContent task={tooltip.task} />}
          </HoverTooltip>
        )}
        {secondaryTooltip?.baselineSlots && (
          <HoverTooltip left={secondaryTooltip.x + 16} top={secondaryTooltip.y - 10}>
            <BaselineTooltipContent task={secondaryTooltip.task} slots={secondaryTooltip.baselineSlots} layers={baselineLayers} />
          </HoverTooltip>
        )}

        <div
          ref={hScrollRef}
          data-testid="gantt-hscroll"
          className="gantt-overlay-scrollbar absolute overflow-x-auto overflow-y-hidden"
          style={{ left: primaryHScrollInset.left, right: primaryHScrollInset.right, bottom: 0, height: OVERLAY_SCROLLBAR_SIZE, zIndex: 4 }}
          onScroll={viewport.scrollHandlers.onPrimaryHorizontalScroll}
        >
          <div style={{ width: Math.max(1, viewport.primary.scrollbarWidth - primaryHScrollInset.left - primaryHScrollInset.right), height: 1 }} />
        </div>
      </div>
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
              className="absolute inset-0 outline-none"
              onClick={handleSecondaryClick}
              onMouseMove={handleSecondaryMouseMove}
              onMouseLeave={() => setSecondaryTooltip(null)}
            />
            <div
              ref={hScrollSecondaryRef}
              data-testid="gantt-hscroll-secondary"
              className="gantt-overlay-scrollbar absolute overflow-x-auto overflow-y-hidden"
              style={{ left: 0, right: secondaryHScrollInsetRight, bottom: 0, height: OVERLAY_SCROLLBAR_SIZE, zIndex: 4 }}
              onScroll={viewport.scrollHandlers.onSecondaryHorizontalScroll}
            >
              <div style={{ width: Math.max(1, (viewport.secondary?.scrollbarWidth ?? 0) - secondaryHScrollInsetRight), height: 1 }} />
            </div>
          </div>
        </>
      )}
      </div>
      {histogramPortal}
      {miniMapPortal}

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
            if (!contextMenu.task) { addAtClickedDate(true); return; }
            addTask({
              name: defaultMilestoneName,
              isMilestone: true,
              milestoneKind: 'FINISH',
              taskType: 'USERDEFINED',
              parentId: contextMenu.task?.id || null,
            });
          }}
          onAddRelation={() => {
            if (contextMenu.task) {
              selectTask(contextMenu.task.id, false);
              setUI({ showDependencyMode: true });
            }
          }}
          onAssignRelation={direction => {
            if (contextMenu.task) requestRelationAssign(contextMenu.task.id, direction, contextMenu.rowKey);
          }}
          onSaveTemplate={() => {
            if (!contextMenu.task) return;
            const st = useAppStore.getState();
            const tpl = saveBranchAsWbsTemplate(contextMenu.task.name, contextMenu.task.id, st.tasks, st.sequences);
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
          onDissolve={() => {
            if (contextMenu.task) contextMenuBulk.dissolve(contextMenu.task.id);
          }}
          onAddTask={() => {
            addAtClickedDate(false);
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
            if (contextMenu.task) void contextMenuBulk.setProgress(contextMenu.task.id, completion);
          }}
          onSetPriority={(priority) => {
            if (contextMenu.task) contextMenuBulk.setPriority(contextMenu.task.id, priority);
          }}
          splitGapIndex={contextMenu.splitGapIndex}
          onRemoveSplitGap={(gapIndex) => {
            const task = contextMenu.task && useAppStore.getState().tasks.find(t => t.id === contextMenu.task!.id);
            if (!task?.splitGaps) return;
            const pieces = editableSplitPieces(task, effectiveCalById.get(task.id) ?? calendar, task.splitGaps.length + 1);
            const result = pieces ? removeGap(pieces, gapIndex) : null;
            if (result?.ok) setTaskSplits(task.id, result.pieces);
          }}
          onRemoveAllSplitGaps={() => { if (contextMenu.task) setTaskSplits(contextMenu.task.id, null); }}
          onStartRelationFromBar={() => {
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
