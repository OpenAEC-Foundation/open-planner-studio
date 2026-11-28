import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { generateId } from '@/utils/id';
import type { Layout, ViewState } from '@/state/slices/types';
import type { LayoutOverlays } from '@/types/view';
import type { TaskGridColumnPreference } from '@/types/taskGrid';

export function snapshotLayout(
  view: ViewState,
  columns: readonly TaskGridColumnPreference[],
  overlays: LayoutOverlays,
  name: string,
  id?: string,
): Layout {
  return {
    id: id ?? generateId('layout'),
    name,
    columns: columns.map(column => ({ ...column })),
    group: view.group ?? [],
    sort: view.sort ?? [],
    filter: view.filter ?? null,
    timeScale: scaleFromZoom(view.zoom),
    showRelations: view.showRelations ?? true,
    overlays: { ...overlays },
  };
}
