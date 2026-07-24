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

/**
 * Zuivere inverse van `dateToX`: een X-pixel → het aantal (fractionele) dag-eenheden sinds
 * `viewStart`. Losstaand van `xToDate` geëxporteerd omdat sommige aanroepers (bv. de eerste
 * zichtbare-dag-index in de grid-loop) alleen het GETAL nodig hebben — een round-trip door een
 * `Date`-object zou daar een nutteloze (en potentieel niet-byte-identieke) afronding op hele
 * milliseconden introduceren.
 */
export function xToDayOffset(
  x: number,
  taskTableWidth: number,
  zoom: number,
  scrollX: number,
): number {
  return (x - taskTableWidth + scrollX) / zoom;
}

/**
 * Inverse van `dateToX`: X-pixel op het chart-canvas → datum (met sub-dag-precisie). Fase 0
 * (issue #21 punt 5, `docs/superpowers/werkdagen-as-ontwerp.md` §2.1/§3.1): dit is de huidige
 * lineaire kalender-as; een latere `WorkdayAxis`-implementatie deelt dezelfde `GanttAxis`-vorm
 * (zie hieronder) maar comprimeert niet-werkdagen — geen gedragswijziging hier.
 */
export function xToDate(
  x: number,
  viewStart: Date,
  taskTableWidth: number,
  zoom: number,
  scrollX: number,
): Date {
  const days = xToDayOffset(x, taskTableWidth, zoom, scrollX);
  return new Date(viewStart.getTime() + days * MS_PER_DAY);
}

/**
 * As-abstractie (werkdagen-as-ontwerp §2.1, met de §10-correctie dat dit bestand zonder
 * `axis/`-submap blijft). Alleen een TYPE in fase 0 — er bestaat nog géén tweede implementatie
 * (`WorkdayAxis`); de losse `dateToX`/`xToDate`-functies hierboven zijn de facto de
 * `CalendarAxis`. Vastgelegd zodat een latere fase een `WorkdayAxis` ernaast kan zetten zonder
 * de call-sites opnieuw te hoeven vinden.
 */
export interface GanttAxis {
  /** datum (met sub-dag-precisie) → X op het chart-canvas (incl. −scrollX). */
  dateToX(date: Date): number;
  /** inverse: een X op het chart-canvas → datum (met sub-dag-precisie). */
  xToDate(x: number): Date;
  /**
   * Aantal *getoonde* dag-eenheden tussen twee datums (issue #21 punt 5, fase 1 —
   * `docs/superpowers/werkdagen-as-ontwerp.md` §2.1/§5.3/§5.5): op de kalender-as zijn dat
   * kalenderdagen, op de werkdagen-as werkdagen. Gebruikt door fit-to-project/scroll-bounds/
   * `totalContentWidth` (fase 2/3) zodat die eenheden-bewust rekenen i.p.v. impliciet in
   * kalenderdagen.
   */
  daySpan(from: Date, to: Date): number;
  /**
   * 0-based dag-index (met sub-dag-fractie) van `date` op de getoonde as — de as-eenheid-
   * pendant van "welke kolom is dit". Op een niet-werkdag (werkdagen-as) geldt kleef-rechts
   * (§2.4): de index van de eerstvolgende werkdag.
   */
  dayIndexOf(date: Date): number;
  /** Inverse van `dayIndexOf`: de datum (start van de dag, met evt. sub-dag-fractie als
   *  `index` niet-heel is) op as-index `index`. */
  dateAtIndex(index: number): Date;
}
