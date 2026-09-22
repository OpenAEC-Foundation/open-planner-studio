// K-item 27: zie de kop van ../defaults — de fabriek is een bladmodule geworden om de
// import-cyclus met documentContract/snapshot te breken. Hier doorgegeven voor bestaande importers.
import { createDefaultView } from '../defaults';
export { createDefaultView };
import { maxGanttZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import { getGanttChartWidth, clampGanttScroll } from '@/utils/ganttViewport';
import {
  allBandKeys, firstTaskOccurrence, type ViewRow,
} from '@/engine/view/visibleRows';
import type {
  ViewState, TimeScale, AppSlice, FilterNode, GroupLevel, SortLevel,
  SplitViewState, Layout, LayoutSession,
} from './types';
import { liveSessionLayouts, switchLayoutOff, switchLayoutOn } from '@/engine/view/layoutPresets';
import { currentLayoutParts } from '../layoutView';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import {
  captureViewLayoutHistoryState,
  type SessionHistoryDelta,
} from '../sessionHistory';
import { deriveViewRows, viewRowInputs } from '../viewRows';
export { deriveViewRows } from '../viewRows';

/**
 * Occurrence-expliciete helft van `focusOnTask`: de storeactie hieronder bewaart bewust alleen het
 * domeindoel `taskId`; de visuele consument resolveert dat doel pas tegen de actuele `viewRows`.
 * Bij dubbele resource-occurrences wint deterministisch de eerste zichtbare rij en wordt die keuze
 * vanaf hier uitsluitend als `rowKey`/absolute rijindex doorgegeven.
 */
export interface FocusTaskOccurrence {
  taskId: string;
  rowKey: string;
  rowIndex: number;
}

export function resolveFirstVisibleFocusOccurrence(
  rows: readonly ViewRow[],
  taskId: string,
): FocusTaskOccurrence | null {
  const occurrence = firstTaskOccurrence(rows, taskId);
  return occurrence === null
    ? null
    : { taskId, rowKey: occurrence.rowKey, rowIndex: occurrence.rowIndex };
}

export interface ViewSlice {
  view: ViewState;
  /** Gedeelde, afgeleide zichtbare-rijenlijst (§4.3). Top-level cache, geen React/component-memo.
   *  NIET in payload/undo/IFC — herberekend via `recomputeViewRows()` op de §4.3-triggers. */
  viewRows: ViewRow[];
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;
  /** Vraag een fit-to-project aan (issue #16): het HELE project moet in beeld komen (zoals Ctrl+0),
   *  niet alleen het begin. Zet enkel het `pendingFit`-signaal; de GanttCanvas voert de eigenlijke
   *  fit uit (die kent de viewport-breedte) en wist het signaal. Twee soorten aanroepers: laadpaden
   *  (openFile/openRecentFile/voorbeeld) en een expliciete gebruikersactie (Ctrl+0, canvas-
   *  contextmenu, ribbon-knop Beeld → Tijdschaal, issue #78) — NIET bij undo/redo of herberekeningen.
   *  Een leeg project blijft "vandaag" (de canvas slaat de fit dan over). */
  requestFitToProject: () => void;
  /** Wis het `pendingFit`-signaal (door de GanttCanvas aangeroepen nadat de fit is uitgevoerd). */
  clearPendingFit: () => void;
  /** "Spring naar taak" (issue #65): klapt de oudersketen van `taskId` uit, selecteert 'm, en
   *  zet het `pendingFocusTaskId`-signaal — naar het patroon van `requestFitToProject`.
   *  GanttCanvas kent de canvas-afmetingen en de bijgewerkte `viewRows` (ná het uitklappen) en
   *  voert daar de echte zoom-/scrollberekening uit (`computeFocusTaskHorizontal`/
   *  `computeFocusTaskScrollY` in `ganttViewport.ts`). */
  focusOnTask: (taskId: string, opts?: { preserveZoom?: boolean }) => void;
  /** Wis het `pendingFocusTaskId`-signaal (door GanttCanvas aangeroepen nadat de sprong is
   *  uitgevoerd). */
  clearPendingFocusTask: () => void;
  /** Kies de resource die de histogramstrook toont (undefined = alle renewables samen). */
  setHistogramResource: (resourceId?: string) => void;
  /** Split view (§10): twee tijdvensters binnen één document; undefined = uit. */
  setSplitView: (splitView: SplitViewState | undefined) => void;
  // --- Fase 2.7 view-mutaties (§4.3) ---
  setFilter: (filter: FilterNode | null) => void;
  setGroup: (group: GroupLevel[]) => void;
  setSort: (sort: SortLevel[]) => void;
  /** Klap een groepsband in/uit op zijn pad-gecodeerde sleutel (§7.1). */
  setCollapsedGroupKey: (key: string, collapsed: boolean) => void;
  /** Issue #35: klap ALLE groepsbanden in — ook geneste, ook die nu al dicht staan (hun subbanden
   *  zitten dan niet in `viewRows`, zie `allBandKeys`). Zonder groepering een no-op. */
  collapseAllGroups: () => void;
  /** Issue #35: tegenhanger van `collapseAllGroups` — opent alle banden in één keer. */
  expandAllGroups: () => void;
  /** Herbereken de `viewRows`-cache (resourceLoadResult-patroon: "manual, not reactive", §4.3). */
  recomputeViewRows: () => void;
  /** Layouts toepassen (§8.3): schrijft columns/group/sort/filter + de tijdschaal-zoom naar de
   *  huidige view en herberekent viewRows. Onbekende refs zijn stille tolerantie (§8.4) — die zit al
   *  in de evaluatie/render, niet hier. */
  applyLayout: (layout: Layout) => void;
  /** Weergave-instellingen toepassen zonder layoutknop (de layoutdialoog, "zonder opslaan"). */
  applyViewSettings: (parts: Layout, label: string) => void;
  /** Layoutknop (issue #144): aan = toepassen; nogmaals = uit, terug naar het beeld van vóór de klik. */
  toggleLayout: (layout: Layout) => void;
  /** Relatielijnen in de Gantt tonen of verbergen (schermtegenhanger van de rapportoptie). */
  setShowRelations: (show: boolean) => void;
}


export const createViewSlice: AppSlice<ViewSlice> = (set, get) => {
  /** Schrijf de gedragen delen van `parts` naar het scherm als ÉÉN undo-stap, met de nieuwe sessie. */
  const writeLayoutParts = (parts: Layout, session: LayoutSession | undefined, label: string): void => {
    const beforeState = get();
    const documentId = beforeState.activeDocumentId;
    const surface = taskGridSurfaceForRibbonTab(beforeState.ui.activeRibbonTab);
    const viewBefore = captureViewLayoutHistoryState(beforeState.view);
    const gridBefore = {
      columns: beforeState.taskGridSurfaces[surface].columns.map(column => ({ ...column })),
      scrollX: beforeState.taskGridSurfaces[surface].scrollX,
    };
    set((s) => {
      if (parts.group !== undefined) s.view.group = parts.group;
      if (parts.sort !== undefined) s.view.sort = parts.sort;
      if (parts.filter !== undefined) s.view.filter = parts.filter;
      if (parts.showRelations !== undefined) s.view.showRelations = parts.showRelations;
      s.view.layoutSession = session;
    });
    if (parts.columns !== undefined) get().applyTaskGridLayoutColumns(parts.columns);
    if (parts.timeScale !== undefined) get().setTimeScale(parts.timeScale);
    get().recomputeViewRows();
    const afterState = get();
    const viewAfter = captureViewLayoutHistoryState(afterState.view);
    const gridAfter = {
      columns: afterState.taskGridSurfaces[surface].columns.map(column => ({ ...column })),
      scrollX: afterState.taskGridSurfaces[surface].scrollX,
    };
    const deltas: SessionHistoryDelta[] = [];
    if (documentId && JSON.stringify(viewBefore) !== JSON.stringify(viewAfter)) {
      deltas.push({ kind: 'document-view', documentId, before: viewBefore, after: viewAfter });
    }
    if (JSON.stringify(gridBefore) !== JSON.stringify(gridAfter)) {
      deltas.push({ kind: 'grid-preference', surface, before: gridBefore, after: gridAfter });
    }
    if (deltas.length > 0) afterState.recordSessionHistoryEvent(label, deltas);
  };

  return {
  view: createDefaultView(),
  viewRows: [],

  setZoom: (zoom) =>
    set((s) => {
      const max = maxGanttZoom(s.ui.enableQuarterHourZoom, s.ui.enableHourPlanning);
      s.view.zoom = Math.max(0.5, Math.min(max, zoom));
    }),

  // §3.2/3.3: de schaalkeuze mapt naar een zoom-preset; `view.timeScale` is geen bron van waarheid
  // meer (de getoonde schaal wordt afgeleid via `scaleFromZoom`). Recenter (BESLIST §3.3): de datum
  // onder het viewportmidden blijft onder het midden — dezelfde ankerformule als Ctrl+= /−
  // (useGanttZoom.zoomAt) met anchorX = midden van het chart-gedeelte. Headless (geen
  // geregistreerde viewport-breedte) valt terug op alleen zoomen.
  setTimeScale: (scale) => {
    const s = get();
    const oldZoom = s.view.zoom;
    const max = maxGanttZoom(s.ui.enableQuarterHourZoom, s.ui.enableHourPlanning);
    const newZoom = Math.max(0.5, Math.min(max, TIMESCALE_ZOOM[scale]));
    const chartW = getGanttChartWidth();
    if (chartW !== null && newZoom !== oldZoom) {
      // localX op het viewportmidden = chartW/2; dagen onder het anker blijven gelijk.
      const daysUnderCenter = (s.view.scrollX + chartW / 2) / oldZoom;
      const newScrollX = Math.max(0, daysUnderCenter * newZoom - chartW / 2);
      set((st) => {
        st.view.zoom = newZoom;
        st.view.scrollX = newScrollX;
      });
    } else {
      get().setZoom(newZoom);
    }
  },

  // Fix 2 (fase 2.8a QA): boven de ondergrens (§0) ook een bovengrens klemmen op de werkelijke
  // inhoud (GanttCanvas registreert die bij elke render, `ganttViewport.ts`) — anders kan een
  // (per ongeluk) verticale overscroll of een horizontale scroll ná een extreme zoom-cyclus de
  // taakbalken-laag permanent buiten beeld duwen, zonder enige render-pass die dat herstelt.
  // Headless (geen geregistreerde grenzen): identiek aan de oude ondergrens-only-clamp.
  setScroll: (x, y) =>
    set((s) => {
      const clamped = clampGanttScroll(Math.max(0, x), Math.max(0, y));
      s.view.scrollX = clamped.x;
      s.view.scrollY = clamped.y;
    }),

  setViewStartDate: (date) =>
    set((s) => {
      s.view.viewStartDate = date;
    }),

  // Issue #16: een planning die pas in (bv.) 2027 start opende op "vandaag", ver links van de
  // balken — en zelfs een verschuiving-naar-begin liet alleen het BEGIN zien. Wens: het HELE
  // project in beeld (zoals Ctrl+0). De fit heeft de viewport-breedte nodig (die de store niet
  // kent), dus we zetten hier enkel een signaal; de GanttCanvas voert de gedeelde
  // computeFitToProject uit en wist het signaal.
  requestFitToProject: () =>
    set((s) => {
      s.view.pendingFit = true;
    }),

  clearPendingFit: () =>
    set((s) => {
      s.view.pendingFit = false;
    }),

  focusOnTask: (taskId, opts) => {
    // Alleen het domeindoel reist door de store. Een rowKey is view-afgeleid en wordt door
    // resolveFirstVisibleFocusOccurrence pas tegen de actuele zichtbare occurrences gekozen.
    get().expandAncestorsOf(taskId);
    get().selectTask(taskId);
    set((s) => {
      s.view.pendingFocusTaskId = taskId;
      s.view.pendingFocusTaskPreserveZoom = opts?.preserveZoom;
    });
  },

  clearPendingFocusTask: () =>
    set((s) => {
      s.view.pendingFocusTaskId = undefined;
      s.view.pendingFocusTaskPreserveZoom = undefined;
    }),

  setHistogramResource: (resourceId) =>
    set((s) => {
      s.view.histogramResourceId = resourceId;
    }),

  setSplitView: (splitView) =>
    set((s) => {
      s.view.splitView = splitView;
    }),

  setFilter: (filter) => {
    set((s) => { s.view.filter = filter; });
    get().recomputeViewRows();
  },

  setGroup: (group) => {
    set((s) => {
      s.view.group = group;
    });
    get().recomputeViewRows();
  },

  setSort: (sort) => {
    set((s) => { s.view.sort = sort; });
    get().recomputeViewRows();
  },

  setCollapsedGroupKey: (key, collapsed) => {
    set((s) => {
      const has = s.view.collapsedGroupKeys.includes(key);
      if (collapsed && !has) s.view.collapsedGroupKeys.push(key);
      else if (!collapsed && has) {
        s.view.collapsedGroupKeys = s.view.collapsedGroupKeys.filter(k => k !== key);
      }
    });
    get().recomputeViewRows();
  },

  collapseAllGroups: () => {
    const s = get();
    if ((s.view.group?.length ?? 0) === 0) return; // geen groepering ⇒ geen banden
    const { opts, ctx } = viewRowInputs(s);
    const keys = allBandKeys(s.tasks, opts, ctx);
    // Vervangen, niet aanvullen: `keys` is per definitie de complete set, en zo verdwijnen meteen
    // sleutels van banden die na een data-/groepeerwijziging niet meer bestaan.
    set((st) => { st.view.collapsedGroupKeys = keys; });
    get().recomputeViewRows();
  },

  expandAllGroups: () => {
    set((st) => { st.view.collapsedGroupKeys = []; });
    get().recomputeViewRows();
  },

  recomputeViewRows: () => {
    const s = get();
    const rows = deriveViewRows(s);
    set((st) => { st.viewRows = rows; });
  },

  applyLayout: (layout) => {
    // Issue #144: een layout zet alleen de delen die hij draagt; zie `switchLayoutOn` voor wat er
    // met de al aanstaande layoutknoppen gebeurt.
    const state = get();
    const { session, write } = switchLayoutOn(state.view.layoutSession, currentLayoutParts(state), layout);
    writeLayoutParts(write, session, `Layout ${layout.name} toepassen`);
  },

  applyViewSettings: (parts, label) => {
    // "Toepassen zonder opslaan": het beeld verandert, maar er gaat geen layoutknop aan en er komt
    // dus ook geen herstelpunt. Een aanstaande knop valt vanzelf af zodra hij niet meer klopt.
    writeLayoutParts(parts, get().view.layoutSession, label);
  },

  toggleLayout: (layout) => {
    const state = get();
    const current = currentLayoutParts(state);
    const session = state.view.layoutSession;
    if (!session || !liveSessionLayouts(session, current).some(l => l.id === layout.id)) {
      get().applyLayout(layout);
      return;
    }
    // Uitzetten: alleen de delen van DEZE layout gaan terug naar het beeld van vóór de klik.
    const off = switchLayoutOff(session, current, layout.id);
    writeLayoutParts(off.write, off.session, `Layout ${layout.name} uitzetten`);
  },

  setShowRelations: (show) => {
    set((s) => { s.view.showRelations = show; });
  },
};
};
