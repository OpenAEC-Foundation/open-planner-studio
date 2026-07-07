import { formatDate } from '@/utils/dateUtils';
import { TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import { getGanttChartWidth, clampGanttScroll } from '@/utils/ganttViewport';
import { getNoneLabelValue } from '@/utils/noneLabel';
import {
  computeViewRows, defaultColumns, type ViewRow, type ViewContext,
} from '@/engine/view/visibleRows';
import type {
  ViewState, TimeScale, AppSlice, ColumnConfig, FilterNode, GroupLevel, SortLevel,
  SplitViewState, Layout,
} from './types';

export interface ViewSlice {
  view: ViewState;
  /** Gedeelde, afgeleide zichtbare-rijenlijst (§4.3). Top-level cache, geen React/component-memo.
   *  NIET in payload/undo/IFC — herberekend via `recomputeViewRows()` op de §4.3-triggers. */
  viewRows: ViewRow[];
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;
  /** Vraag ná het openen/laden van een document een fit-to-project aan (issue #16): het HELE project
   *  moet in beeld komen (zoals Ctrl+0), niet alleen het begin. Zet enkel het `pendingFit`-signaal;
   *  de GanttCanvas voert de eigenlijke fit uit (die kent de viewport-breedte) en wist het signaal.
   *  Alleen aan te roepen vanaf laadpaden (openFile/openRecentFile/voorbeeld) — NIET bij undo/redo of
   *  herberekeningen. Een leeg project blijft "vandaag" (de canvas slaat de fit dan over). */
  requestFitToProject: () => void;
  /** Wis het `pendingFit`-signaal (door de GanttCanvas aangeroepen nadat de fit is uitgevoerd). */
  clearPendingFit: () => void;
  /** Kies de resource die de histogramstrook toont (undefined = alle renewables samen). */
  setHistogramResource: (resourceId?: string) => void;
  /** Split view (§10): twee tijdvensters binnen één document; undefined = uit. */
  setSplitView: (splitView: SplitViewState | undefined) => void;
  // --- Fase 2.7 view-mutaties (§4.3) ---
  setColumns: (columns: ColumnConfig[] | undefined) => void;
  setFilter: (filter: FilterNode | null) => void;
  setGroup: (group: GroupLevel[]) => void;
  setSort: (sort: SortLevel[]) => void;
  /** Klap een groepsband in/uit op zijn pad-gecodeerde sleutel (§7.1). */
  setCollapsedGroupKey: (key: string, collapsed: boolean) => void;
  /** Herbereken de `viewRows`-cache (resourceLoadResult-patroon: "manual, not reactive", §4.3). */
  recomputeViewRows: () => void;
  /** Layouts toepassen (§8.3): schrijft columns/group/sort/filter + de tijdschaal-zoom naar de
   *  huidige view en herberekent viewRows. Onbekende refs zijn stille tolerantie (§8.4) — die zit al
   *  in de evaluatie/render, niet hier. */
  applyLayout: (layout: Layout) => void;
}

export function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30, // pixels per dag
    timeScale: 'week',
    viewStartDate: formatDate(new Date()),
    filter: null,
    group: [],
    sort: [],
    collapsedGroupKeys: [],
  };
}

export const createViewSlice: AppSlice<ViewSlice> = (set, get) => ({
  view: createDefaultView(),
  viewRows: [],

  setZoom: (zoom) =>
    set((s) => {
      const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
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
    const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
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

  setHistogramResource: (resourceId) =>
    set((s) => {
      s.view.histogramResourceId = resourceId;
    }),

  setSplitView: (splitView) =>
    set((s) => {
      s.view.splitView = splitView;
    }),

  setColumns: (columns) => {
    set((s) => { s.view.columns = columns; });
    get().recomputeViewRows();
  },

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

  recomputeViewRows: () => {
    const s = get();
    const ctx: ViewContext = {
      activityCodeTypes: s.activityCodeTypes,
      customFieldDefs: s.customFieldDefs,
      resources: s.resources,
      assignments: s.assignments,
      // Vertaalde "(geen)"-label, door de consument (App) gezet — engine blijft i18n-vrij (§4.1).
      noneLabel: getNoneLabelValue(),
    };
    const rows = computeViewRows(
      s.tasks,
      {
        filter: s.view.filter ?? null,
        group: s.view.group ?? [],
        sort: s.view.sort ?? [],
        collapsedTaskIds: new Set(s.ui.collapsedTaskIds),
        collapsedGroupKeys: new Set(s.view.collapsedGroupKeys ?? []),
      },
      ctx,
    );
    set((st) => { st.viewRows = rows; });
  },

  applyLayout: (layout) => {
    set((s) => {
      s.view.columns = layout.columns;
      s.view.group = layout.group;
      s.view.sort = layout.sort;
      s.view.filter = layout.filter;
    });
    get().setTimeScale(layout.timeScale);
    get().recomputeViewRows();
  },
});

// Re-export voor consumenten (golf 2) die de default-kolommen los nodig hebben.
export { defaultColumns };
