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
import { dropBrokenLayouts, liveSessionLayouts, switchLayoutOff, switchLayoutOn } from '@/engine/view/layoutPresets';
import { currentLayoutParts, currentOverlays, overlaysToUi } from '../layoutView';
import type { LayoutOverlays } from '@/types/view';
import { persistOverlays } from '../overlaySettings';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import {
  captureViewLayoutHistoryState,
  type SessionHistoryDelta,
} from '../sessionHistory';
import { deriveViewRows, viewRowInputs } from '../viewRows';
import type { StoreRuntime } from '../runtime/storeRuntime';
export { deriveViewRows } from '../viewRows';

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
  viewRows: ViewRow[];
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;
  requestFitToProject: () => void;
  clearPendingFit: () => void;
  focusOnTask: (taskId: string, opts?: { preserveZoom?: boolean }) => void;
  clearPendingFocusTask: () => void;
  setHistogramResource: (resourceId?: string) => void;
  setSplitView: (splitView: SplitViewState | undefined) => void;
  setFilter: (filter: FilterNode | null) => void;
  setGroup: (group: GroupLevel[]) => void;
  setSort: (sort: SortLevel[]) => void;
  setCollapsedGroupKey: (key: string, collapsed: boolean) => void;
  collapseAllGroups: () => void;
  expandAllGroups: () => void;
  recomputeViewRows: () => void;
  applyLayout: (layout: Layout) => void;
  applyViewSettings: (parts: Layout, label: string) => void;
  toggleLayout: (layout: Layout) => void;
  setShowRelations: (show: boolean) => void;
  setOverlays: (overlays: Partial<LayoutOverlays>) => void;
  settleLayoutSession: () => void;
}


export const createViewSlice = (runtime: StoreRuntime): AppSlice<ViewSlice> => (set, get) => {
  const writeLayoutParts = (
    parts: Layout, session: LayoutSession | undefined, label: string, opts: { record?: boolean } = {},
  ): void => {
    const beforeState = get();
    const documentId = beforeState.activeDocumentId;
    const surface = taskGridSurfaceForRibbonTab(beforeState.ui.activeRibbonTab);
    const viewBefore = captureViewLayoutHistoryState(beforeState.view);
    const overlaysBefore = currentOverlays(beforeState.ui);
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
    if (parts.overlays !== undefined) {
      get().setUI(overlaysToUi(parts.overlays));
      persistOverlays(parts.overlays);
    }
    get().recomputeViewRows();
    if (opts.record === false) return;
    const afterState = get();
    const viewAfter = captureViewLayoutHistoryState(afterState.view);
    const gridAfter = {
      columns: afterState.taskGridSurfaces[surface].columns.map(column => ({ ...column })),
      scrollX: afterState.taskGridSurfaces[surface].scrollX,
    };
    const deltas: SessionHistoryDelta[] = [];
    const overlaysAfter = currentOverlays(afterState.ui);
    const overlaysChanged = JSON.stringify(overlaysBefore) !== JSON.stringify(overlaysAfter);
    if (documentId && (overlaysChanged || JSON.stringify(viewBefore) !== JSON.stringify(viewAfter))) {
      deltas.push({
        kind: 'document-view', documentId, before: viewBefore, after: viewAfter,
        ...(overlaysChanged ? { overlays: { before: overlaysBefore, after: overlaysAfter } } : {}),
      });
    }
    if (JSON.stringify(gridBefore) !== JSON.stringify(gridAfter)) {
      deltas.push({ kind: 'grid-preference', surface, before: gridBefore, after: gridAfter });
    }
    if (deltas.length > 0) afterState.recordSessionHistoryEvent(label, deltas);
  };

  const settleManualChange = (): void => {
    const state = get();
    const dropped = dropBrokenLayouts(state.view.layoutSession, currentLayoutParts(state));
    if (dropped) writeLayoutParts(dropped.write, dropped.session, '', { record: false });
  };

  return {
  view: createDefaultView(),
  viewRows: [],

  setZoom: (zoom) =>
    set((s) => {
      const max = maxGanttZoom(s.ui.enableQuarterHourZoom);
      s.view.zoom = Math.max(0.5, Math.min(max, zoom));
    }),

  setTimeScale: (scale) => {
    const s = get();
    const oldZoom = s.view.zoom;
    const max = maxGanttZoom(s.ui.enableQuarterHourZoom);
    const newZoom = Math.max(0.5, Math.min(max, TIMESCALE_ZOOM[scale]));
    const chartW = getGanttChartWidth();
    if (chartW !== null && newZoom !== oldZoom) {
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
      const clamped = clampGanttScroll(Math.max(0, x), Math.max(0, y));
      s.view.scrollX = clamped.x;
      s.view.scrollY = clamped.y;
    }),

  setViewStartDate: (date) =>
    set((s) => {
      s.view.viewStartDate = date;
    }),

  requestFitToProject: () =>
    set((s) => {
      s.view.pendingFit = true;
    }),

  clearPendingFit: () =>
    set((s) => {
      s.view.pendingFit = false;
    }),

  focusOnTask: (taskId, opts) => {
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
    settleManualChange();
  },

  setGroup: (group) => {
    set((s) => {
      s.view.group = group;
    });
    get().recomputeViewRows();
    settleManualChange();
  },

  setSort: (sort) => {
    set((s) => { s.view.sort = sort; });
    get().recomputeViewRows();
    settleManualChange();
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
    if ((s.view.group?.length ?? 0) === 0) return;
    const { opts, ctx } = viewRowInputs(s);
    const keys = allBandKeys(s.tasks, opts, ctx);
    set((st) => { st.view.collapsedGroupKeys = keys; });
    get().recomputeViewRows();
  },

  expandAllGroups: () => {
    set((st) => { st.view.collapsedGroupKeys = []; });
    get().recomputeViewRows();
  },

  recomputeViewRows: () => {
    if (runtime.deferViewRows()) return;
    const s = get();
    const rows = deriveViewRows(s);
    set((st) => { st.viewRows = rows; });
  },

  applyLayout: (layout) => {
    settleManualChange();
    const state = get();
    const { session, write } = switchLayoutOn(state.view.layoutSession, currentLayoutParts(state), layout);
    writeLayoutParts(write, session, `Layout ${layout.name} toepassen`);
  },

  applyViewSettings: (parts, label) => {
    writeLayoutParts(parts, get().view.layoutSession, label);
  },

  toggleLayout: (layout) => {
    settleManualChange();
    const state = get();
    const current = currentLayoutParts(state);
    const session = state.view.layoutSession;
    if (!session || !liveSessionLayouts(session, current).some(l => l.id === layout.id)) {
      get().applyLayout(layout);
      return;
    }
    const off = switchLayoutOff(session, current, layout.id);
    writeLayoutParts(off.write, off.session, `Layout ${layout.name} uitzetten`);
  },

  setShowRelations: (show) => {
    set((s) => { s.view.showRelations = show; });
    settleManualChange();
  },

  settleLayoutSession: () => settleManualChange(),

  setOverlays: (overlays) => {
    get().setUI(overlaysToUi(overlays));
    persistOverlays(overlays);
    settleManualChange();
  },
};
};
