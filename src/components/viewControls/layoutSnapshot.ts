import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { defaultColumns } from '@/engine/view/visibleRows';
import { generateId } from '@/utils/id';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Layout, ViewState } from '@/state/slices/types';

/** Bouwt een `Layout`-snapshot van de huidige `view` (§8.3). Hergebruikt door de layouts-dialoog
 *  én de ribbon-layoutcontrole zodat "opslaan als" en "bijwerken" exact hetzelfde snapshotten. */
export function snapshotLayout(
  view: ViewState,
  activityCodeTypes: ActivityCodeType[],
  customFieldDefs: CustomFieldDef[],
  name: string,
  id?: string,
): Layout {
  return {
    id: id ?? generateId('layout'),
    name,
    columns: view.columns ?? defaultColumns(activityCodeTypes, customFieldDefs),
    group: view.group ?? [],
    sort: view.sort ?? [],
    filter: view.filter ?? null,
    timeScale: scaleFromZoom(view.zoom),
  };
}
