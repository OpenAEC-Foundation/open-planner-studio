import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import { liveSessionLayouts } from '@/engine/view/layoutPresets';
import type { LayoutOverlays, LayoutViewParts, ViewState } from '@/types/view';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { UIState } from './slices/types';

/** Minimale structurele invoer; bewust geen AppState-import, zodat dit een bladmodule blijft. */
export interface LayoutViewInputs {
  ui: Pick<UIState,
    | 'activeRibbonTab' | 'showBaselineOverlay' | 'showProgressLine' | 'showStatusDateLine'
    | 'showResourceAccent' | 'showFloatBand' | 'barColorSelection'>;
  view: ViewState;
  taskGridSurfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
}

/** De layoutdelen zoals ze NU op het scherm staan (issue #144) — de ene bron voor store en lint. */
export function currentLayoutParts(state: LayoutViewInputs): LayoutViewParts {
  const surface = taskGridSurfaceForRibbonTab(state.ui.activeRibbonTab);
  return {
    columns: state.taskGridSurfaces[surface].columns,
    filter: state.view.filter ?? null,
    group: state.view.group ?? [],
    sort: state.view.sort ?? [],
    timeScale: scaleFromZoom(state.view.zoom),
    showRelations: state.view.showRelations ?? true,
    overlays: currentOverlays(state.ui),
  };
}

/** De overlay-schermopties zoals ze nu staan (issue #173), in de vorm van het layoutdeel. */
export function currentOverlays(ui: LayoutViewInputs['ui']): LayoutOverlays {
  return {
    baseline: ui.showBaselineOverlay,
    progressLine: ui.showProgressLine,
    statusDateLine: ui.showStatusDateLine,
    resourceAccent: ui.showResourceAccent,
    floatBand: ui.showFloatBand,
    barColors: ui.barColorSelection,
  };
}

/** Ids van de layoutknoppen die nu aanstaan. Een knop valt af zodra het scherm er niet meer mee klopt. */
export function activeLayoutIds(state: LayoutViewInputs): string[] {
  return liveSessionLayouts(state.view.layoutSession, currentLayoutParts(state)).map(layout => layout.id);
}

/** Omgekeerde richting van `currentOverlays`: de `ui`-velden voor een (deel van een) overlay-deel. */
export function overlaysToUi(overlays: Partial<LayoutOverlays>): Partial<UIState> {
  const ui: Partial<UIState> = {};
  if (overlays.baseline !== undefined) ui.showBaselineOverlay = overlays.baseline;
  if (overlays.progressLine !== undefined) ui.showProgressLine = overlays.progressLine;
  if (overlays.statusDateLine !== undefined) ui.showStatusDateLine = overlays.statusDateLine;
  if (overlays.resourceAccent !== undefined) ui.showResourceAccent = overlays.resourceAccent;
  if (overlays.floatBand !== undefined) ui.showFloatBand = overlays.floatBand;
  if (overlays.barColors !== undefined) ui.barColorSelection = overlays.barColors;
  return ui;
}
