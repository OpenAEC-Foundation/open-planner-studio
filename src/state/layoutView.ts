import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import { liveSessionLayouts } from '@/engine/view/layoutPresets';
import type { LayoutViewParts, ViewState } from '@/types/view';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { RibbonTab } from './slices/types';

/** Minimale structurele invoer; bewust geen AppState-import, zodat dit een bladmodule blijft. */
export interface LayoutViewInputs {
  ui: { activeRibbonTab: RibbonTab };
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
  };
}

/** Ids van de layoutknoppen die nu aanstaan. Een knop valt af zodra het scherm er niet meer mee klopt. */
export function activeLayoutIds(state: LayoutViewInputs): string[] {
  return liveSessionLayouts(state.view.layoutSession, currentLayoutParts(state)).map(layout => layout.id);
}
