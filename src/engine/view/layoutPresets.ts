// Layouts als weergavepresets (issue #144) — de pure kern. Een layout legt alleen vast wat hij
// DRAAGT: een ontbrekende sleutel laat dat deel van het beeld met rust. Geen store, geen opslag;
// headless getest in `tests/planning/check-layout-presets.ts`.
// Ontwerp: docs/superpowers/specs/2026-09-19-layouts-als-weergavepresets-design.md

import { LAYOUT_PARTS } from '@/types/view';
import type { Layout, LayoutPart, LayoutSession, LayoutViewParts, SavedFilter } from '@/types/view';

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
  };
}

/** Staat de layout van deze sessie nog echt op het scherm? Zo niet, dan is het herstelpunt verlopen. */
export function isLayoutSessionLive(
  session: LayoutSession | undefined, current: LayoutViewParts,
): session is LayoutSession {
  return !!session && layoutMatchesView(session.layout, current);
}

/**
 * De sessie ná het aanzetten van `layout`. Loopt er al een levende sessie (wissel van layout A naar
 * B), dan blijft het herstelpunt dat van vóór A; anders is het huidige beeld het nieuwe herstelpunt.
 */
export function startLayoutSession(
  live: LayoutSession | undefined, current: LayoutViewParts, layout: Layout,
): LayoutSession {
  const touched = new Set<LayoutPart>(live?.touched ?? []);
  for (const part of layoutParts(layout)) touched.add(part);
  return {
    layout,
    restore: live?.restore ?? structuredClone(current) as LayoutViewParts,
    touched: LAYOUT_PARTS.filter(part => touched.has(part)),
  };
}

/** Het beeld ná uitzetten: alleen de door layouts gezette delen gaan terug naar het herstelpunt. */
export function endLayoutSession(session: LayoutSession, current: LayoutViewParts): LayoutViewParts {
  const out = { ...current } as Record<LayoutPart, unknown>;
  for (const part of session.touched) out[part] = session.restore[part];
  return out as unknown as LayoutViewParts;
}

/** Komen ALLE gedragen delen overeen met het scherm? Een layout zonder delen matcht nooit. */
export function layoutMatchesView(layout: Layout, current: LayoutViewParts): boolean {
  const parts = layoutParts(layout);
  if (parts.length === 0) return false;
  return parts.every(part => JSON.stringify(layout[part]) === JSON.stringify(current[part]));
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
