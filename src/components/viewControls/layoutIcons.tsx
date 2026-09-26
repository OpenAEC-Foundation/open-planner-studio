import {
  CalendarRange, Filter, Flag, GanttChartSquare, HardHat, LayoutTemplate, ListTree, Milestone, Route,
  Star, Truck, Users, Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * De vaste icoonset van de layoutknoppen. Een layout bewaart alleen de SLEUTEL, zodat
 * een opgeslagen layout een icoonwissel in de app overleeft; een onbekende sleutel valt terug op
 * het standaardicoon in plaats van een lege knop.
 */
const LAYOUT_ICONS = {
  layout: LayoutTemplate,
  gantt: GanttChartSquare,
  tree: ListTree,
  filter: Filter,
  users: Users,
  crew: HardHat,
  equipment: Truck,
  tools: Wrench,
  critical: Route,
  milestone: Milestone,
  flag: Flag,
  period: CalendarRange,
  star: Star,
} as const;

export type LayoutIconKey = keyof typeof LAYOUT_ICONS;
export const LAYOUT_ICON_KEYS = Object.keys(LAYOUT_ICONS) as LayoutIconKey[];

export function layoutIcon(key: string | undefined, size = 20): ReactNode {
  const Icon = LAYOUT_ICONS[(key ?? 'layout') as LayoutIconKey] ?? LAYOUT_ICONS.layout;
  return <Icon size={size} />;
}
