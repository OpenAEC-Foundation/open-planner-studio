import { LAYOUT_PARTS } from '@/types/view';
import type { Layout, LayoutOverlays, LayoutPart, LayoutSession, LayoutViewParts, SavedFilter } from '@/types/view';

export type { LayoutViewParts } from '@/types/view';

export const BUILTIN_LAYOUT_PREFIX = 'builtin:';

export const RESOURCE_DIAGRAM_LAYOUT_ID = `${BUILTIN_LAYOUT_PREFIX}resource-diagram`;

export function isBuiltinLayoutId(id: string): boolean {
  return id.startsWith(BUILTIN_LAYOUT_PREFIX);
}

export function layoutParts(layout: Layout): LayoutPart[] {
  return LAYOUT_PARTS.filter(part => layout[part] !== undefined);
}

export function isFilterOnlyLayout(layout: Layout): boolean {
  const parts = layoutParts(layout);
  return parts.length === 1 && parts[0] === 'filter';
}

export function applyLayoutParts(current: LayoutViewParts, layout: Layout): LayoutViewParts {
  return {
    columns: layout.columns !== undefined ? layout.columns.map(column => ({ ...column })) : current.columns,
    filter: layout.filter !== undefined ? layout.filter : current.filter,
    group: layout.group !== undefined ? layout.group : current.group,
    sort: layout.sort !== undefined ? layout.sort : current.sort,
    timeScale: layout.timeScale !== undefined ? layout.timeScale : current.timeScale,
    showRelations: layout.showRelations !== undefined ? layout.showRelations : current.showRelations,
    overlays: layout.overlays !== undefined ? { ...layout.overlays } : current.overlays,
  };
}

export function liveSessionLayouts(session: LayoutSession | undefined, current: LayoutViewParts): Layout[] {
  return (session?.layouts ?? []).filter(layout => layoutMatchesView(layout, current));
}

export interface LayoutSwitch {
  session: LayoutSession | undefined;
  write: Layout;
}

function setPart(target: Layout, part: LayoutPart, value: unknown): void {
  (target as unknown as Record<LayoutPart, unknown>)[part] = value;
}

export function switchLayoutOn(
  session: LayoutSession | undefined, current: LayoutViewParts, layout: Layout,
): LayoutSwitch {
  const live = liveSessionLayouts(session, current).filter(l => l.id !== layout.id);
  const restore = live.length > 0 && session ? session.restore : structuredClone(current) as LayoutViewParts;
  const mine = new Set(layoutParts(layout));
  const kept = live.filter(l => layoutParts(l).every(part => !mine.has(part)));
  const keptParts = new Set(kept.flatMap(layoutParts));
  const write: Layout = { id: layout.id, name: layout.name };
  for (const dropped of live.filter(l => !kept.includes(l))) {
    for (const part of layoutParts(dropped)) {
      if (!mine.has(part) && !keptParts.has(part)) setPart(write, part, restore[part]);
    }
  }
  for (const part of mine) setPart(write, part, layout[part]);
  return { session: { layouts: [...kept, layout], restore }, write };
}

export function switchLayoutOff(
  session: LayoutSession, current: LayoutViewParts, layoutId: string,
): LayoutSwitch {
  const live = liveSessionLayouts(session, current);
  const target = live.find(l => l.id === layoutId);
  const write: Layout = { id: layoutId, name: target?.name ?? '' };
  for (const part of target ? layoutParts(target) : []) setPart(write, part, session.restore[part]);
  const rest = live.filter(l => l.id !== layoutId);
  return { session: rest.length > 0 ? { layouts: rest, restore: session.restore } : undefined, write };
}

function partKey(part: LayoutPart, value: unknown): string {
  if (part === 'overlays' && value && typeof value === 'object') {
    const o = value as LayoutOverlays;
    return JSON.stringify([o.baseline, o.progressLine, o.statusDateLine, o.resourceAccent, o.floatBand, o.barColors]);
  }
  return JSON.stringify(value);
}

export function layoutMatchesView(layout: Layout, current: LayoutViewParts): boolean {
  const parts = layoutParts(layout);
  if (parts.length === 0) return false;
  return parts.every(part => partKey(part, layout[part]) === partKey(part, current[part]));
}

export function dropBrokenLayouts(session: LayoutSession | undefined, current: LayoutViewParts): LayoutSwitch | null {
  if (!session) return null;
  const live = liveSessionLayouts(session, current);
  const stale = session.layouts.filter(layout => !live.includes(layout));
  if (stale.length === 0) return null;
  const keptParts = new Set(live.flatMap(layoutParts));
  const write: Layout = { id: stale[0].id, name: stale[0].name };
  for (const layout of stale) {
    for (const part of layoutParts(layout)) {
      if (keptParts.has(part) || session.restore[part] === undefined) continue;
      if (partKey(part, layout[part]) === partKey(part, current[part])) setPart(write, part, session.restore[part]);
    }
  }
  return { session: live.length > 0 ? { layouts: live, restore: session.restore } : undefined, write };
}

export function pickLayoutParts(full: Layout, parts: readonly LayoutPart[]): Layout {
  const out: Layout = { id: full.id, name: full.name };
  for (const part of LAYOUT_PARTS) {
    if (!parts.includes(part) || full[part] === undefined) continue;
    (out as unknown as Record<string, unknown>)[part] = full[part];
  }
  return out;
}

export function migrateSavedFilters(layouts: readonly Layout[], savedFilters: readonly SavedFilter[]): Layout[] {
  const known = new Set(layouts.map(layout => layout.id));
  const out = [...layouts];
  for (const saved of savedFilters) {
    if (known.has(saved.id)) continue;
    known.add(saved.id);
    out.push({ id: saved.id, name: saved.name, filter: structuredClone(saved.filter) });
  }
  return out;
}
