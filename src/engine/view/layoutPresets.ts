// Layouts als weergavepresets (issue #144) — de pure kern. Een layout legt alleen vast wat hij
// DRAAGT: een ontbrekende sleutel laat dat deel van het beeld met rust. Geen store, geen opslag;
// headless getest in `tests/planning/check-layout-presets.ts`.
// Ontwerp: docs/superpowers/specs/2026-09-19-layouts-als-weergavepresets-design.md

import { LAYOUT_PARTS } from '@/types/view';
import type { Layout, LayoutOverlays, LayoutPart, LayoutSession, LayoutViewParts, SavedFilter } from '@/types/view';

export type { LayoutViewParts } from '@/types/view';

/** Id-prefix van de meegeleverde layouts; `generateId('layout')` kan die nooit opleveren. */
export const BUILTIN_LAYOUT_PREFIX = 'builtin:';

export function isBuiltinLayoutId(id: string): boolean {
  return id.startsWith(BUILTIN_LAYOUT_PREFIX);
}

/** Welke delen draagt deze layout, in de vaste UI-volgorde. `filter: null` TELT als gedragen. */
export function layoutParts(layout: Layout): LayoutPart[] {
  return LAYOUT_PARTS.filter(part => layout[part] !== undefined);
}

/** Draagt de layout uitsluitend een filter — de opvolger van het losse opgeslagen filter. */
export function isFilterOnlyLayout(layout: Layout): boolean {
  const parts = layoutParts(layout);
  return parts.length === 1 && parts[0] === 'filter';
}

/** Het beeld ná toepassen: gedragen delen uit de layout, de rest ongewijzigd uit `current`. */
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

/** De layouts van de sessie die nog echt op het scherm staan; de rest is handmatig overschreven. */
export function liveSessionLayouts(session: LayoutSession | undefined, current: LayoutViewParts): Layout[] {
  return (session?.layouts ?? []).filter(layout => layoutMatchesView(layout, current));
}

/** Een sessie-uitkomst: de nieuwe sessie (undefined = geen knop meer aan) en de te schrijven delen. */
export interface LayoutSwitch {
  session: LayoutSession | undefined;
  /** Layout-vormige drager van de delen die naar het scherm moeten; id/naam zijn van de geklikte knop. */
  write: Layout;
}

function setPart(target: Layout, part: LayoutPart, value: unknown): void {
  (target as unknown as Record<LayoutPart, unknown>)[part] = value;
}

/**
 * Zet `layout` AAN. Levende layouts die geen deel met hem delen blijven aan; een layout die wél een
 * deel deelt gaat uit, en zijn overige delen keren terug naar het herstelpunt. Dat herstelpunt is
 * het beeld van vóór de eerste nog levende layoutklik — anders het beeld van nu.
 */
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

/** Zet de layout met `layoutId` UIT: alleen ZIJN delen gaan terug naar het herstelpunt. */
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

/**
 * Vergelijkbare vorm van één deel. De overlays zijn een object dat uit twee bronnen komt (de
 * opgeslagen layout en de losse `ui`-vlaggen): hun sleutelvolgorde ligt hier vast, zodat een andere
 * volgorde in de opslag nooit een knop laat uitvallen.
 */
function partKey(part: LayoutPart, value: unknown): string {
  if (part === 'overlays' && value && typeof value === 'object') {
    const o = value as LayoutOverlays;
    return JSON.stringify([o.baseline, o.progressLine, o.statusDateLine, o.resourceAccent, o.floatBand, o.barColors]);
  }
  return JSON.stringify(value);
}

/** Komen ALLE gedragen delen overeen met het scherm? Een layout zonder delen matcht nooit. */
export function layoutMatchesView(layout: Layout, current: LayoutViewParts): boolean {
  const parts = layoutParts(layout);
  if (parts.length === 0) return false;
  return parts.every(part => partKey(part, layout[part]) === partKey(part, current[part]));
}

/**
 * Ruim de layouts van de sessie op die niet meer op het scherm staan (issue #173). Een handmatige
 * wijziging aan een gedragen deel zet de knop uit; zonder meer bleven zijn overige delen dan staan —
 * een beeld dat niet meer de layout is en ook niet het beeld van ervoor. Hier gaan de delen die nog
 * de WAARDE VAN DE LAYOUT tonen terug naar het herstelpunt, precies zoals bij uitzetten; een deel dat
 * afwijkt (wat de gebruiker zelf wijzigde) blijft staan, net als delen van nog levende layouts.
 *
 * Bewust zonder "beeld van ervoor": dezelfde regel ruimt ook een sessie op die ELDERS verouderde —
 * de overlays zijn app-breed, dus een overlay omzetten in document B laat een layout in document A
 * vallen. Zonder deze opruiming werd dat halve beeld bij de volgende klik het nieuwe herstelpunt.
 *
 * `null` = er valt niets op te ruimen.
 */
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

/** Beperk een volledige momentopname tot de gevraagde delen (Opslaan als… / Bijwerken). */
export function pickLayoutParts(full: Layout, parts: readonly LayoutPart[]): Layout {
  const out: Layout = { id: full.id, name: full.name };
  for (const part of LAYOUT_PARTS) {
    if (!parts.includes(part) || full[part] === undefined) continue;
    (out as unknown as Record<string, unknown>)[part] = full[part];
  }
  return out;
}

/**
 * Neem de losse opgeslagen filters van vóór #144 op als layouts met alleen een filter. Idempotent op
 * id: een filter dat al als layout bestaat wordt niet opnieuw toegevoegd, ook niet als de gebruiker
 * die layout intussen heeft hernoemd of uitgebreid.
 */
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
