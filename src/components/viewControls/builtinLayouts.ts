import type { ImportLabelT } from '@/i18n/importLabels';
import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';
import type { Layout } from '@/types/view';

const BUILTIN_LAYOUT_DEFS = [
  {
    id: RESOURCE_DIAGRAM_LAYOUT_ID,
    nameKey: 'view.layout.builtinResourceDiagram',
    icon: 'users',
    group: [{ field: { src: 'resource' }, dir: 'asc' }],
    sort: [{ field: { src: 'builtin', key: 'start' }, dir: 'asc' }],
    showRelations: false,
  },
] as const satisfies readonly (Omit<Layout, 'name'> & { nameKey: string })[];

export function builtinLayouts(t: ImportLabelT): Layout[] {
  return BUILTIN_LAYOUT_DEFS.map(({ nameKey, ...layout }) => ({ ...layout, name: t(nameKey) }));
}
