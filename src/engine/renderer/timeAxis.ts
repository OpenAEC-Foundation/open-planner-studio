// Gedeelde tijd-as (fase 2.7 §6.4, audit C4/P7). GanttRenderer en HistogramRenderer hadden elk een
// VERBATIM kopie van `dateToX` — de uitlijning van de dagkolommen boven de taakbalken hing dus af
// van een "gelijk aan GanttRenderer.dateToX"-commentaar i.p.v. één bron. Deze pure functie is die
// ene bron: bit-identiek aan de vroegere kopieën, leest niets globaals, dus headless-testbaar.
//
// De MiniMapRenderer deelt bewust NIET mee: die mapt de hele projectperiode (min start .. max
// finish) op de stripbreedte (`dayToMiniX`), een andere transform dan deze scroll-/zoom-gebonden
// dag-as.

/** Milliseconden per kalenderdag — de tijd-as rekent in hele dagen sinds `viewStart`. */
export const MS_PER_DAY = 86400000;

/**
 * Datum (met optionele sub-dag-precisie) → X-pixel op het chart-canvas. Identiek aan de vroegere
 * `taskTableWidth + daysFromStart * zoom - scrollX`. De aanroepers geven hun LIVE opts-waarden mee
 * (geen object-allocatie op dit hot path), zodat het lees-moment van zoom/scrollX ongewijzigd blijft.
 */
export function dateToX(
  date: Date,
  viewStart: Date,
  taskTableWidth: number,
  zoom: number,
  scrollX: number,
): number {
  const daysFromStart = (date.getTime() - viewStart.getTime()) / MS_PER_DAY;
  return taskTableWidth + daysFromStart * zoom - scrollX;
}
