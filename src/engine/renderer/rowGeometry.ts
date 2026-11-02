// Balkgeometrie binnen één Gantt-rij. De rijhoogte zelf komt uit `engine/taskGrid/rowHeight.ts`
// (gedeeld met het taakraster). De renderer leidt de balk en de strook eronder (resource-accent +
// baseline) af van `barLayout`, zodat tekenen, hit-testen en de sleep-duurbadge dezelfde
// balkhoogte gebruiken.

/** Balkhoogte als fractie van de rijhoogte. */
export const BAR_HEIGHT_RATIO = 0.6;

export interface BarLayout {
  /** Hoogte van de hoofdbalk. */
  barHeight: number;
  /** Afstand van de rijbovenkant tot de balk. */
  barOffset: number;
  /** Hoogte van het resource-accent onder de balk. */
  accentHeight: number;
  /** Hoogte van de baselinestrook: altijd dezelfde, met of zonder accent. */
  baselineHeight: number;
  /** Breedte (px, horizontaal gemeten) van één schuine band waar baselines overlappen. */
  baselineStripeWidth: number;
}

/** Wat er onder de balken van deze weergave staat. Geldt voor de hele weergave, niet per rij. */
export interface BarLayoutOptions {
  /** Het resource-accent staat aan (`showResourceAccent`). */
  resourceAccent?: boolean;
  /** De baseline-overlay staat aan en er is een baseline om te tekenen. */
  baselines?: boolean;
}

/** Ondergrens van de balkhoogte als accent en baselinestrook samen onder de balk staan. */
export const MIN_BAR_HEIGHT_RATIO = 0.4;
export const MIN_BAR_HEIGHT_PX = 6;

/**
 * Balkgeometrie binnen een rij van `rowHeight`. ÉÉN bron voor tekenen, hit-testen, de
 * sleep-duurbadge en de balklabel-pasmeting: de renderer roept dit één keer aan met de opties van
 * de weergave en rekent nergens zelf.
 *
 * Onder de balk ligt een vrije strook (`barOffset`, de balk staat in het midden van de rij): 1 px
 * lucht, dan het resource-accent, dan de baseline. Issue #391 (meerdere baselines): de
 * baselinestrook vult zonder accent de hele vrije strook (~5 px bij rijhoogte 32) zodat kleuren en
 * strepen te zien zijn. De schuine banden schalen mee met de rijhoogte (~3 px bij 32).
 *
 * Accent én baselines samen (eigenaarsbesluit 2026-10-20, optie 2 van 3): de taakbalk wordt iets
 * lager, zodat accent en baselinestrook allebei hun eigen dikte houden. Zo blijft de regel uit
 * fe70487a2 (2026-09-30) staan: de baseline is even dik met of zonder accent. De balk houdt zijn
 * bovenkant en krimpt alleen zoveel als nodig is (rij 32: 19,2 → 16,6 px); alles blijft binnen de
 * rij. Ondergrens: 40 % van de rijhoogte en minstens 6 px; wordt die bereikt, dan schuift de balk
 * omhoog. Afgewezen: de strook laten krimpen (optie 1) en het accent boven de balk (optie 3).
 * Staat maar één van beide aan, of geen, dan is de geometrie dezelfde als zonder opties.
 */
export function barLayout(rowHeight: number, options: BarLayoutOptions = {}): BarLayout {
  const normalBar = rowHeight * BAR_HEIGHT_RATIO;
  const normalOffset = (rowHeight - normalBar) / 2;
  const strip = Math.max(0, normalOffset - 1);
  const accentHeight = Math.max(2, Math.round(strip / 2));
  const baselineHeight = Math.max(2, Math.floor(strip));
  const baselineStripeWidth = Math.max(2, Math.round(rowHeight / 10));
  if (!(options.resourceAccent && options.baselines)) {
    return { barHeight: normalBar, barOffset: normalOffset, accentHeight, baselineHeight, baselineStripeWidth };
  }
  const below = 1 + accentHeight + baselineHeight;
  const minBar = Math.max(MIN_BAR_HEIGHT_PX, rowHeight * MIN_BAR_HEIGHT_RATIO);
  const barHeight = Math.min(normalBar, Math.max(minBar, rowHeight - normalOffset - below));
  // Past de balk op zijn gewone plek (op afronding na), dan houdt hij precies zijn bovenkant.
  const room = rowHeight - below - barHeight;
  const barOffset = room >= normalOffset - 1e-9 ? normalOffset : Math.max(0, room);
  return { barHeight, barOffset, accentHeight, baselineHeight, baselineStripeWidth };
}
