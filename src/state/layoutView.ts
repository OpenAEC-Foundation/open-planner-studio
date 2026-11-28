import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import { liveSessionLayouts } from '@/engine/view/layoutPresets';
import type { LayoutOverlays, LayoutViewParts, ViewState } from '@/types/view';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { UIState } from './slices/types';

export interface LayoutViewInputs {
  ui: Pick<UIState,
    | 'activeRibbonTab' | 'showBaselineOverlay' | 'showProgressLine' | 'showStatusDateLine'
    | 'showResourceAccent' | 'showFloatBand' | 'barColorSelection'>;
  view: ViewState;
  taskGridSurfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
}

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

export function activeLayoutIds(state: LayoutViewInputs): string[] {
  return liveSessionLayouts(state.view.layoutSession, currentLayoutParts(state)).map(layout => layout.id);
}

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
