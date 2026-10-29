import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import type { IconId } from '@/components/icons';

/**
 * De vaste icoonset van de layoutknoppen. Een layout bewaart alleen de SLEUTEL, zodat
 * een opgeslagen layout een icoonwissel in de app overleeft; een onbekende sleutel valt terug op
 * het standaardicoon in plaats van een lege knop. De waarden zijn B2-icoon-id's (zie `Icon`).
 */
const LAYOUT_ICONS = {
  layout: 'layout.identity',
  gantt: 'planning.gantt',
  tree: 'layout.task-tree',
  filter: 'layout.filter',
  users: 'layout.resources',
  crew: 'layout.crew',
  equipment: 'layout.equipment',
  tools: 'layout.tools',
  critical: 'layout.critical',
  milestone: 'layout.milestone',
  flag: 'layout.flag',
  period: 'layout.period',
  star: 'layout.star',
} as const satisfies Record<string, IconId>;

export type LayoutIconKey = keyof typeof LAYOUT_ICONS;
export const LAYOUT_ICON_KEYS = Object.keys(LAYOUT_ICONS) as LayoutIconKey[];

export function layoutIcon(key: string | undefined, size = 20): ReactNode {
  const name = LAYOUT_ICONS[(key ?? 'layout') as LayoutIconKey] ?? LAYOUT_ICONS.layout;
  return <Icon id={name} size={size} />;
}
