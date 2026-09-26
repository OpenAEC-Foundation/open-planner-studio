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
  HistogramPickerSide,
  HistogramRenderer,
  HistogramRenderOptions,
} from '@/engine/renderer/HistogramRenderer';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { ModifierMap, NotifyInput, PositionDivision, ScrollMode } from '@/state/slices/types';
import type { Task } from '@/types/task';
import type { DateNotation, SplitViewState, ViewState } from '@/types/view';
import type { WorkCalendar } from '@/types/calendar';
import type { Splitter } from '@/hooks/useSplitter';
import type { GanttRenderOptionsSourceInput } from '../ganttRenderOptions';
import type { DragState, SplitDragLabel } from './useBarDrag';
import type { PanState } from './usePan';
import type { BoxSelectCandidate, BoxSelectState } from './useBoxSelect';
import type { DependencyDragState } from './useDependencyDraw';
import type { SplitGestureState } from './useSplitGesture';
import type { SplitPiece } from '@/engine/scheduler/splitEdit';

/** DOM-eigendom van de viewportlaag; renderer- en pointerlagen lenen exact deze refs. */
export interface GanttViewportRefs {
  paneRowRef: RefObject<HTMLDivElement | null>;
  primaryContainerRef: RefObject<HTMLDivElement | null>;
  secondaryContainerRef: RefObject<HTMLDivElement | null>;
  histogramContainerRef: RefObject<HTMLDivElement | null>;
  primaryHScrollRef: RefObject<HTMLDivElement | null>;
  secondaryHScrollRef: RefObject<HTMLDivElement | null>;
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
  histogramPickerWidth: number;
  /** Kant van de histogramkiezer (= de takenlijst); bepaalt mee waar de histogramas begint. */
  histogramPickerSide: HistogramPickerSide;
  histogramHeight: number;
  rowHeight: number;
  headerHeight: number;
  showHistogram: boolean;
  showMiniMap: boolean;
  compressNonWorkdays: boolean;
  enableQuarterHourZoom: boolean;
  enableHourPlanning: boolean;
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
}

export interface GanttViewportSplitters {
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
  /** Issue #146 etappe 3: de pauze die "Onderbreking opheffen" opheft — die onder de cursor, of die
   *  VÓÓR het aangeklikte stuk. `null` op stuk 0, zonder splits, of op een split die niet bewerkbaar
   *  is (dan blijft alleen "Alle onderbrekingen opheffen" over, spec §1). */
  splitGapIndex: number | null;
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

/** De vijf tijdlijngebaren blijven eigenaar van hun eigen state en windowlisteners. */
export interface GanttGestureOverlays {
  barDrag: DragState | null;
  /** Issue #146 etappe 3: het label bij een stuk- of stukrandsleep op een gesplitste balk. */
  barSplitDrag: SplitDragLabel | null;
  pan: PanState | null;
  boxSelectCandidate: BoxSelectCandidate | null;
  boxSelect: BoxSelectState | null;
  dependency: DependencyDragState | null;
  /** Issue #146: de geleidelijn van de splits-modus — ook bij hover, dus zonder lopend gebaar. */
  split: SplitGestureState | null;
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
    'refs' | 'effectiveView' | 'sharedAxis' | 'splitters'
  >;
  tasks: Task[];
  calendar: WorkCalendar;
  effectiveCalendarByTaskId: Map<string, WorkCalendar>;
  selectedTaskIds: string[];
  headerHeight: number;
  dependencyMode: boolean;
  /** Issue #146: splits-modus (`ui.showSplitMode`). Sluit `dependencyMode` uit — `setUI` bewaakt dat. */
  splitMode: boolean;
  scrollMode: ScrollMode;
  enableQuarterHourZoom: boolean;
  enableHourPlanning: boolean;
  compressNonWorkdays: boolean;
  selectTask: (id: string, additive?: boolean, range?: boolean) => void;
  selectTasks: (ids: string[], additive: boolean) => void;
  deselectAll: () => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { coalesceKey?: string }) => void;
  /** Issue #146: de ENE schrijfweg voor gebruikerssplits (`taskSlice.setTaskSplits`). */
  setTaskSplits: (taskId: string, pieces: SplitPiece[] | null, options?: { coalesceKey?: string }) => unknown;
  /** Esc midden in een splitsgebaar draait de lopende coalesce-stap terug. */
  undo: () => void;
  setScroll: (x: number, y: number) => void;
  openTask: (id: string) => void;
  clearHistogramTooltip: () => void;
  /** Een overwegend verticale sleep op een balkBODY wordt hieraan overgedragen (de rijsleep van de
   *  DOM-grid, via `ganttRowDragBridge`). Ontbreekt hij, dus is er geen ingebedde taakgrid, dan
   *  blijft de body een horizontale datumsleep zoals vóór 2026-08-27. Of de structuur bewerkbaar is
   *  beslist de ONTVANGER (`useTableRowDrag`'s `enabled`/`onBlocked`), niet deze poort: buiten de
   *  boomweergave krijgt de gebruiker daar dezelfde uitleg als bij een rijsleep. Randen slepen
   *  altijd duur. */
  startVerticalRowDrag?: (candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => void;
  /** W2-vervolg: bepaalt een voorganger de start van deze taak? Een gesleepte start (body, linkerrand)
   *  volgt dan dezelfde regel als een getypte: SNET, of — bij een andere constraint — niets toepassen
   *  en melden (`src/engine/startEditConstraint.ts`). */
  isStartDrivenByPredecessor: (taskId: string) => boolean;
  /** Het ene meldkanaal en de datumnotatie voor die startmelding na het loslaten. */
  notify: (notification: NotifyInput) => void;
  dateNotation: DateNotation;
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
