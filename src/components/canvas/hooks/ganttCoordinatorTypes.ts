import type { SelectedRow } from '@/state/slices/selectionSlice';
import type { BaselineReach } from '@/types/baseline';
import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  UIEvent as ReactUIEvent,
} from 'react';
import type { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type {
  HistogramPickerSide,
  HistogramRenderer,
  HistogramRenderOptions,
} from '@/engine/renderer/HistogramRenderer';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { ModifierMap, NotifyInput, PositionDivision, ScrollMode } from '@/state/slices/types';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import type { Task } from '@/types/task';
import type { DateNotation, SplitViewState, TimeNotation, ViewState } from '@/types/view';
import type { WorkCalendar } from '@/types/calendar';
import type { Splitter } from '@/hooks/useSplitter';
import type { GanttRenderOptionsSourceInput } from '../ganttRenderOptions';
import type { DragState, SplitDragLabel } from './useBarDrag';
import type { PanState } from './usePan';
import type { BoxSelectCandidate, BoxSelectState } from './useBoxSelect';
import type { DependencyDragState } from './useDependencyDraw';
import type { SplitGestureState } from './useSplitGesture';
import type { SplitPiece } from '@/engine/scheduler/splitEdit';

export interface GanttViewportRefs {
  paneRowRef: RefObject<HTMLDivElement | null>;
  primaryContainerRef: RefObject<HTMLDivElement | null>;
  secondaryContainerRef: RefObject<HTMLDivElement | null>;
  histogramContainerRef: RefObject<HTMLDivElement | null>;
  primaryHScrollRef: RefObject<HTMLDivElement | null>;
  secondaryHScrollRef: RefObject<HTMLDivElement | null>;
}

export type HistogramRenderInput = Omit<HistogramRenderOptions, 'canvasWidth' | 'canvasHeight'>;

export interface GanttRendererHostInput {
  containers: Pick<
    GanttViewportRefs,
    'primaryContainerRef' | 'secondaryContainerRef' | 'histogramContainerRef'
  > & {
    histogramContainer: HTMLDivElement | null;
  };
  primary: GanttRenderOptionsSourceInput;
  secondary?: GanttRenderOptionsSourceInput;
  histogram?: HistogramRenderInput;
  renderRevision: string | number;
  onPrimarySize: (width: number, height: number) => void;
  onSecondarySize: (width: number, height: number) => void;
}

export interface GanttRendererHost {
  primaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  primaryRendererRef: RefObject<GanttRenderer | null>;
  secondaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  secondaryRendererRef: RefObject<GanttRenderer | null>;
  histogramCanvasRef: RefObject<HTMLCanvasElement | null>;
  histogramRendererRef: RefObject<HistogramRenderer | null>;
  dependencyCanvasRef: RefObject<HTMLCanvasElement | null>;
}

export interface GanttViewportCoordinatorInput {
  tasks: Task[];
  baselineReach?: BaselineReach;
  rows: ViewRow[];
  calendar: WorkCalendar;
  view: ViewState;
  histogramPickerWidth: number;
  histogramPickerSide: HistogramPickerSide;
  histogramHeight: number;
  rowHeight: number;
  headerHeight: number;
  showHistogram: boolean;
  showMiniMap: boolean;
  compressNonWorkdays: boolean;
  enableQuarterHourZoom: boolean;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
  setScroll: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  setViewStartDate: (isoDate: string) => void;
  clearPendingFit: () => void;
  clearPendingFocusTask: () => void;
  setSplitView: (splitView: SplitViewState | undefined) => void;
  setHistogramHeight: (height: number) => void;
  persistHistogramHeight: (height: number) => void;
}

export interface GanttPaneViewport {
  chartWidth: number;
  contentWidth: number;
  scrollbarWidth: number;
  scrollX: number;
  zoom: number;
}

export interface GanttViewportScrollHandlers {
  onPrimaryHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  onSecondaryHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
}

export interface GanttViewportSplitters {
  histogram: Splitter;
  ratio: Splitter;
}

export interface GanttViewportMiniMapControllers {
  primaryScrollTo: (scrollX: number) => void;
  secondaryScrollTo: (scrollX: number) => void;
}

export interface GanttViewportCoordinatorOutput {
  refs: GanttViewportRefs;
  primary: GanttPaneViewport;
  secondary?: GanttPaneViewport;
  effectiveViewStart: string;
  effectiveView: ViewState;
  sharedAxis: GanttAxis;
  histogramAxis: GanttAxis;
  scrollHandlers: GanttViewportScrollHandlers;
  splitters: GanttViewportSplitters;
  minimap: GanttViewportMiniMapControllers;
  onPrimarySize: (width: number, height: number) => void;
  onSecondarySize: (width: number, height: number) => void;
  resetZoom: () => void;
  fitToProject: () => void;
}

export interface GanttContextMenuState {
  x: number;
  y: number;
  task: Task | null;
  barHit: boolean;
  group: { key: string; collapsed: boolean } | null;
  splitGapIndex: number | null;
  clickDate?: string | null;
  rowKey?: string;
}

export interface GanttTooltipState {
  x: number;
  y: number;
  task: Task;
  baselineSlots?: (0 | 1 | 2)[];
  group?: readonly Task[];
}

export interface GanttRelationPopoverState {
  sourceTaskId: string;
  targetTaskId: string;
  x: number;
  y: number;
}

export interface GanttGestureOverlays {
  barDrag: DragState | null;
  barSplitDrag: SplitDragLabel | null;
  pan: PanState | null;
  boxSelectCandidate: BoxSelectCandidate | null;
  boxSelect: BoxSelectState | null;
  dependency: DependencyDragState | null;
  split: SplitGestureState | null;
}

export interface GanttPointerCoordinatorInput {
  host: Pick<
    GanttRendererHost,
    'primaryCanvasRef' | 'primaryRendererRef' | 'dependencyCanvasRef'
  >;
  viewport: Pick<
    GanttViewportCoordinatorOutput,
    'refs' | 'effectiveView' | 'sharedAxis' | 'splitters'
  >;
  tasks: Task[];
  calendar: WorkCalendar;
  effectiveCalendarByTaskId: Map<string, WorkCalendar>;
  selectedTaskIds: string[];
  headerHeight: number;
  dependencyMode: boolean;
  splitMode: boolean;
  scrollMode: ScrollMode;
  enableQuarterHourZoom: boolean;
  workdayDurationMeasure: boolean;
  compressNonWorkdays: boolean;
  selectTask: (id: string, additive?: boolean, range?: boolean, row?: SelectedRow) => void;
  selectTasks: (ids: string[], additive: boolean) => void;
  setGridActiveRowKey: (rowKey: string) => void;
  deselectAll: () => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { coalesceKey?: string }) => void;
  setTaskSplits: (taskId: string, pieces: SplitPiece[] | null, options?: { coalesceKey?: string }) => unknown;
  undo: () => void;
  historyMark: () => HistorySessionMark;
  revertHistorySince: (mark: HistorySessionMark) => void;
  endHistorySession: (mark: HistorySessionMark) => void;
  setScroll: (x: number, y: number) => void;
  openTask: (id: string) => void;
  clearHistogramTooltip: () => void;
  startVerticalRowDrag?: (candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => void;
  isStartDrivenByPredecessor: (taskId: string) => boolean;
  looseDayEndMilestone: (taskId: string) => boolean;
  notify: (notification: NotifyInput) => void;
  dateNotation: DateNotation;
  timeNotation: TimeNotation;
}

export interface GanttPointerCoordinatorOutput {
  onClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseDown: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: () => void;
  cursor: string;
  overlays: GanttGestureOverlays;
  contextMenu: GanttContextMenuState | null;
  relationPopover: GanttRelationPopoverState | null;
  tooltip: GanttTooltipState | null;
  closeContextMenu: () => void;
  closeRelationPopover: () => void;
  closeForDocumentSwitch: () => void;
}
