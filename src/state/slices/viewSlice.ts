import { formatDate } from '@/utils/dateUtils';
import { TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import { getGanttChartWidth } from '@/utils/ganttViewport';
import { getNoneLabelValue } from '@/utils/noneLabel';
import {
  computeViewRows, defaultColumns, type ViewRow, type ViewContext,
} from '@/engine/view/visibleRows';
import type {
  ViewState, TimeScale, AppSlice, ColumnConfig, FilterNode, GroupLevel, SortLevel,
  SplitViewState,
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

  setScroll: (x, y) =>
    set((s) => {
      s.view.scrollX = Math.max(0, x);
      s.view.scrollY = Math.max(0, y);
    }),

  setViewStartDate: (date) =>
    set((s) => {
      s.view.viewStartDate = date;
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
});

// Re-export voor consumenten (golf 2) die de default-kolommen los nodig hebben.
export { defaultColumns };
