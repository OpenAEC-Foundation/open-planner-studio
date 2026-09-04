import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { generateId } from '@/utils/id';
import type { Layout, ViewState } from '@/state/slices/types';
import type { TaskGridColumnPreference } from '@/types/taskGrid';

/** Bouwt een `Layout`-snapshot van de huidige `view` (§8.3). Hergebruikt door de layouts-dialoog
 *  én de ribbon-layoutcontrole zodat "opslaan als" en "bijwerken" exact hetzelfde snapshotten. */
export function snapshotLayout(
  view: ViewState,
  columns: readonly TaskGridColumnPreference[],
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
  };
}
