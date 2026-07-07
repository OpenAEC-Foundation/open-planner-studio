import { formatDate } from '@/utils/dateUtils';
import { TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import { getGanttChartWidth, clampGanttScroll, ORIGIN_PADDING_DAYS } from '@/utils/ganttViewport';
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
  /** Verschuif het venster ná het openen/laden van een document naar de projectperiode: de
   *  vroegste taakstart komt met een kleine marge links in beeld op het huidige zoomniveau (issue
   *  #16). Alleen aan te roepen vanaf laadpaden (openFile/openRecentFile/voorbeeld) — NIET bij
   *  undo/redo of herberekeningen. Een leeg project is een no-op (huidige "vandaag"-gedrag blijft). */
  focusProjectStart: () => void;
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
  // balken — die stonden dan buiten beeld. Spiegelt de fit-to-project-anker­formule
  // (useZoomShortcuts): zet viewStartDate op de vroegste taakstart zodat de renderer-origin op
  // scrollX=0 (effectiveViewStart = minStart − ORIGIN_PADDING_DAYS) vlak vóór het project ligt, en
  // scroll dan tot vlak vóór minStart zodat die met een kleine, VASTE PIXEL-marge (FOCUS_MARGIN_PX)
  // links in beeld komt op het HUIDIGE zoomniveau. Een pixel-marge (i.p.v. een dag-marge) blijft
  // klein bij elke zoom: bij 400px/dag zou een marge van een paar dagen de balken juist voorbij de
  // rechterrand duwen. Werkt mee met de scroll-clamp (kleine scrollX ver binnen de inhoud). Zelfde
  // veldvolgorde als GanttCanvas.effectiveViewStart.
  focusProjectStart: () =>
    set((s) => {
      if (s.tasks.length === 0) return; // leeg/nieuw project: huidige "vandaag"-gedrag behouden.
      let minStart: string | null = null;
      for (const t of s.tasks) {
        const start = t.time.earlyStart || t.time.scheduleStart || t.time.lateStart;
        if (start && (!minStart || start < minStart)) minStart = start;
      }
      if (!minStart) return;
      const FOCUS_MARGIN_PX = 40;
      s.view.viewStartDate = minStart;
      // effectiveViewStart wordt (minStart − ORIGIN_PADDING_DAYS); scrollX = pad·zoom − marge legt
      // minStart FOCUS_MARGIN_PX rechts van de chart-linkerrand.
      s.view.scrollX = Math.max(0, ORIGIN_PADDING_DAYS * s.view.zoom - FOCUS_MARGIN_PX);
      s.view.scrollY = 0;
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
