// Balkgeometrie binnen één Gantt-rij. De rijhoogte zelf komt uit `engine/taskGrid/rowHeight.ts`
// (gedeeld met het taakraster). De renderer leidt de balk en de strook eronder (resource-accent +
// baseline) af van `barLayout`, zodat tekenen, hit-testen en de sleep-duurbadge dezelfde
// balkhoogte gebruiken.

/** Balkhoogte als fractie van de rijhoogte. */
export const BAR_HEIGHT_RATIO = 0.6;

export interface BarLayout {
  /** Hoogte van de hoofdbalk. */
  barHeight: number;
  /** Afstand van de rijbovenkant tot de balk (= vrije strook onder de balk). */
  barOffset: number;
  /** Hoogte van het resource-accent onder de balk. */
  accentHeight: number;
  /** Hoogte van de baseline-onderbalk. */
  baselineHeight: number;
}

/**
 * Balkgeometrie binnen een rij van `rowHeight`.
 *
 * Resource-accent en baseline delen de vrije strook onder de balk (`barOffset`) VAST: 1 px lucht,
 * dan het accent, dan de baseline. Beide krijgen hun hoogte hier, los van welke van de twee aan
 * staat — zo is de baseline even dik met of zonder accent (vroeger kromp hij bij de combinatie tot
 * wat er overbleef) en past de combinatie altijd binnen de rij. Staat het accent uit, dan schuift
 * de baseline op naar direct onder de balk, maar hij houdt dezelfde hoogte.
 */
export function barLayout(rowHeight: number): BarLayout {
  const barHeight = rowHeight * BAR_HEIGHT_RATIO;
  const barOffset = (rowHeight - barHeight) / 2;
  const strip = Math.max(0, barOffset - 1);
  const accentHeight = Math.max(2, Math.round(strip / 2));
  const baselineHeight = Math.max(2, strip - accentHeight);
  return { barHeight, barOffset, accentHeight, baselineHeight };
}
