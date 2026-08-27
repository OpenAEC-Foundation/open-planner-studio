// Expliciete naden rond de drie verantwoordelijkheden die uit GanttCanvas worden gehaald.
//
// Dit bestand bevat uitsluitend types. Het koppelt geen store, mount geen DOM en voert geen
// domeinmutatie uit. Daardoor kunnen de volgende extractiestappen hun invoer eerst tegen een smal
// contract leggen en pas daarna bestaande code verplaatsen, zonder ongemerkt de hele applicatiestaat
// als gemaksargument door te geven.
import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  UIEvent as ReactUIEvent,
} from 'react';
import type { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type {
  HistogramRenderer,
  HistogramRenderOptions,
} from '@/engine/renderer/HistogramRenderer';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { DropTarget } from '@/engine/view/dropTarget';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { ModifierMap, PositionDivision, ScrollMode } from '@/state/slices/types';
import type { Task } from '@/types/task';
import type { SplitViewState, ViewState } from '@/types/view';
import type { WorkCalendar } from '@/types/calendar';
import type { Splitter } from '@/hooks/useSplitter';
import type { GanttRenderOptionsSourceInput } from '../ganttRenderOptions';
import type { DragState } from './useBarDrag';
import type { PanState } from './usePan';
import type { BoxSelectCandidate, BoxSelectState } from './useBoxSelect';
import type { RowDragCandidate, RowDragState } from './useRowDrag';
import type { DependencyDragState } from './useDependencyDraw';

/** DOM-eigendom van de viewportlaag; renderer- en pointerlagen lenen exact deze refs. */
export interface GanttViewportRefs {
  paneRowRef: RefObject<HTMLDivElement | null>;
  primaryContainerRef: RefObject<HTMLDivElement | null>;
  secondaryContainerRef: RefObject<HTMLDivElement | null>;
  histogramContainerRef: RefObject<HTMLDivElement | null>;
  primaryHScrollRef: RefObject<HTMLDivElement | null>;
  secondaryHScrollRef: RefObject<HTMLDivElement | null>;
  sharedVScrollRef: RefObject<HTMLDivElement | null>;
}

/** Histograminvoer zonder afmetingen; de host meet die op het paintmoment aan zijn container. */
export type HistogramRenderInput = Omit<HistogramRenderOptions, 'canvasWidth' | 'canvasHeight'>;

/** Alle waarden die één hostpaint volledig bepalen. `renderRevision` dekt CSS-gebonden paints. */
export interface GanttRendererHostInput {
  containers: Pick<
    GanttViewportRefs,
    'primaryContainerRef' | 'secondaryContainerRef' | 'histogramContainerRef'
  >;
  primary: GanttRenderOptionsSourceInput;
  secondary?: GanttRenderOptionsSourceInput;
  histogram?: HistogramRenderInput;
  renderRevision: string | number;
  onPrimarySize: (width: number, height: number) => void;
  onSecondarySize: (width: number, height: number) => void;
}

/** Levende canvassen en renderers die de pointerlaag uitsluitend voor hit-tests mag lezen. */
export interface GanttRendererHost {
  primaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  primaryRendererRef: RefObject<GanttRenderer | null>;
  secondaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  secondaryRendererRef: RefObject<GanttRenderer | null>;
  histogramCanvasRef: RefObject<HTMLCanvasElement | null>;
  histogramRendererRef: RefObject<HistogramRenderer | null>;
  dependencyCanvasRef: RefObject<HTMLCanvasElement | null>;
}

/** Concrete viewportwaarden en gerichte setters; geen taak- of planningsmutaties. */
export interface GanttViewportCoordinatorInput {
  tasks: Task[];
  rows: ViewRow[];
  calendar: WorkCalendar;
  view: ViewState;
  taskTableWidth: number;
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
  setTaskTableWidth: (width: number) => void;
  setHistogramHeight: (height: number) => void;
  persistTaskTableWidth: (width: number) => void;
  persistHistogramHeight: (height: number) => void;
}

/** Afmetingen en scrolltoestand van één zelfstandig horizontaal tijdvenster. */
export interface GanttPaneViewport {
  chartWidth: number;
  contentWidth: number;
  scrollX: number;
  zoom: number;
}

export interface GanttViewportScrollHandlers {
  onPrimaryHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  onSecondaryHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  onSharedVerticalScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
}

export interface GanttViewportSplitters {
  table: Splitter;
  histogram: Splitter;
  ratio: Splitter;
}

export interface GanttViewportMiniMapControllers {
  primaryScrollTo: (scrollX: number) => void;
  secondaryScrollTo: (scrollX: number) => void;
}

/** Volledig afgeleide viewportuitvoer die host en JSX mogen consumeren. */
export interface GanttViewportCoordinatorOutput {
  refs: GanttViewportRefs;
  primary: GanttPaneViewport;
  secondary?: GanttPaneViewport;
  effectiveViewStart: string;
  effectiveView: ViewState;
  sharedAxis: GanttAxis;
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
}

export interface GanttTooltipState {
  x: number;
  y: number;
  task: Task;
}

export interface GanttRelationPopoverState {
  sourceTaskId: string;
  targetTaskId: string;
  x: number;
  y: number;
}

/** De vijf bestaande gesture-hooks blijven eigenaar van hun eigen state en windowlisteners. */
export interface GanttGestureOverlays {
  barDrag: DragState | null;
  pan: PanState | null;
  boxSelectCandidate: BoxSelectCandidate | null;
  boxSelect: BoxSelectState | null;
  rowDragCandidate: RowDragCandidate | null;
  rowDrag: RowDragState | null;
  dependency: DependencyDragState | null;
}

/**
 * Smalle pointerinvoer: rendererrefs voor hit-tests, viewportwaarden voor prioriteit/geometrie en
 * alleen de acties die een pointergebaar werkelijk mag uitvoeren.
 */
export interface GanttPointerCoordinatorInput {
  host: Pick<
    GanttRendererHost,
    'primaryCanvasRef' | 'primaryRendererRef' | 'dependencyCanvasRef'
  >;
  viewport: Pick<
    GanttViewportCoordinatorOutput,
    'refs' | 'effectiveView' | 'splitters'
  >;
  tasks: Task[];
  rows: ViewRow[];
  calendar: WorkCalendar;
  effectiveCalendarByTaskId: Map<string, WorkCalendar>;
  selectedTaskIds: string[];
  taskTableWidth: number;
  headerHeight: number;
  dependencyMode: boolean;
  treeMode: boolean;
  scrollMode: ScrollMode;
  enableQuarterHourZoom: boolean;
  enableHourPlanning: boolean;
  compressNonWorkdays: boolean;
  selectTask: (id: string, additive?: boolean, range?: boolean) => void;
  selectTasks: (ids: string[], additive: boolean) => void;
  deselectAll: () => void;
  toggleCollapse: (id: string) => void;
  setCollapsedGroupKey: (key: string, collapsed: boolean) => void;
  addChildTask: (parentId: string) => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { coalesceKey?: string }) => void;
  moveTaskTo: (id: string, target: DropTarget) => void;
  moveTasksTo: (ids: string[], target: DropTarget) => void;
  setScroll: (x: number, y: number) => void;
  openTask: (id: string) => void;
  revealTaskIfOffscreen: (task: Task) => void;
  clearHistogramTooltip: () => void;
}

/** React-bedrading en vluchtige presentatie die uitsluitend bij pointerinteractie hoort. */
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
}
