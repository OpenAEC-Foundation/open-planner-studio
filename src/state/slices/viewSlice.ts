import { formatDate } from '@/utils/dateUtils';
import type { ViewState, TimeScale, AppSlice } from './types';

export interface ViewSlice {
  view: ViewState;
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;
  /** Groepeer tabel + Gantt op een activity-code-type (undefined = WBS-boomweergave). */
  setGroupBy: (codeTypeId?: string) => void;
  /** Kies de resource die de histogramstrook toont (undefined = alle renewables samen). */
  setHistogramResource: (resourceId?: string) => void;
}

export function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30, // pixels per dag
    timeScale: 'week',
    viewStartDate: formatDate(new Date()),
  };
}

export const createViewSlice: AppSlice<ViewSlice> = (set) => ({
  view: createDefaultView(),

  setZoom: (zoom) =>
    set((s) => {
      const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
      s.view.zoom = Math.max(0.5, Math.min(max, zoom));
    }),

  setTimeScale: (scale) =>
    set((s) => {
      s.view.timeScale = scale;
    }),

  setScroll: (x, y) =>
    set((s) => {
      s.view.scrollX = Math.max(0, x);
      s.view.scrollY = Math.max(0, y);
    }),

  setViewStartDate: (date) =>
    set((s) => {
      s.view.viewStartDate = date;
    }),

  setGroupBy: (codeTypeId) =>
    set((s) => {
      s.view.groupBy = codeTypeId;
    }),

  setHistogramResource: (resourceId) =>
    set((s) => {
      s.view.histogramResourceId = resourceId;
    }),
});
