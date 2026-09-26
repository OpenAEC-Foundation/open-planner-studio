import type { ImportLabelT } from '@/i18n/importLabels';
import { BUILTIN_LAYOUT_PREFIX } from '@/engine/view/layoutPresets';
import type { Layout } from '@/types/view';

/**
 * Meegeleverde layouts. Ze staan in code en NIET in de opslag: de naam komt uit een
 * vertaalsleutel en schakelt dus mee met de taal, en ze zijn niet te bewerken of te verwijderen.
 *
 * Een layoutknop is een schakelaar: uitzetten brengt het beeld van vóór de klik terug. Er is daarom
 * geen aparte "Gantt (WBS)"-layout nodig om terug te keren.
 *
 * Het resourcediagram draagt bewust geen kolommen, filter of tijdschaal: wie midden in een
 * vergadering schakelt houdt zijn zoom, zijn kolommen en zijn filter. Relatielijnen gaan uit, zoals
 * in het afdrukrapport — een taak kan onder meerdere banden staan.
 */
const BUILTIN_LAYOUT_DEFS = [
  {
    id: `${BUILTIN_LAYOUT_PREFIX}resource-diagram`,
    nameKey: 'view.layout.builtinResourceDiagram',
    icon: 'users',
    group: [{ field: { src: 'resource' }, dir: 'asc' }],
    // Binnen de band op start, zoals het afdrukrapport Resourcediagram (`resourceGantt.ts`).
    sort: [{ field: { src: 'builtin', key: 'start' }, dir: 'asc' }],
    showRelations: false,
  },
] as const satisfies readonly (Omit<Layout, 'name'> & { nameKey: string })[];

/** De meegeleverde layouts met vertaalde naam; `t` is de `common`-namespace. */
export function builtinLayouts(t: ImportLabelT): Layout[] {
  return BUILTIN_LAYOUT_DEFS.map(({ nameKey, ...layout }) => ({ ...layout, name: t(nameKey) }));
}
