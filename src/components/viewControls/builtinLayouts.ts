import type { ImportLabelT } from '@/i18n/importLabels';
import { BUILTIN_LAYOUT_PREFIX } from '@/engine/view/layoutPresets';
import type { Layout } from '@/types/view';

/**
 * Meegeleverde layouts (issue #144). Ze staan in code en NIET in de opslag: de naam komt uit een
 * vertaalsleutel en schakelt dus mee met de taal, en ze zijn niet te bewerken of te verwijderen.
 *
 * Ze dragen bewust alleen groepering + sortering. Wie midden in een vergadering wisselt tussen de
 * WBS-boom en het resourcediagram houdt zo zijn zoom, zijn kolommen en zijn filter.
 */
const BUILTIN_LAYOUT_DEFS = [
  { id: `${BUILTIN_LAYOUT_PREFIX}gantt-wbs`, nameKey: 'view.layout.builtinGanttWbs', group: [], sort: [] },
  {
    id: `${BUILTIN_LAYOUT_PREFIX}resource-diagram`,
    nameKey: 'view.layout.builtinResourceDiagram',
    group: [{ field: { src: 'resource' }, dir: 'asc' }],
    // Binnen de band op start, zoals het afdrukrapport Resourcediagram (`resourceGantt.ts`).
    sort: [{ field: { src: 'builtin', key: 'start' }, dir: 'asc' }],
  },
] as const satisfies readonly (Omit<Layout, 'name'> & { nameKey: string })[];

/** De meegeleverde layouts met vertaalde naam; `t` is de `common`-namespace. */
export function builtinLayouts(t: ImportLabelT): Layout[] {
  return BUILTIN_LAYOUT_DEFS.map(({ nameKey, ...layout }) => ({ ...layout, name: t(nameKey) }));
}
