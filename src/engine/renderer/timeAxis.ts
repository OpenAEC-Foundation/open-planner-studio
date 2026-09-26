// Gedeelde tijd-as: de ene bron van `dateToX` voor GanttRenderer en HistogramRenderer, zodat de
// dagkolommen van het histogram exact onder de taakbalken staan. Puur, leest niets globaals, dus
// headless-testbaar.
//
// De MiniMapRenderer deelt bewust NIET mee: die mapt de hele projectperiode (min start .. max
// finish) op de stripbreedte (`dayToMiniX`), een andere transform dan deze scroll-/zoom-gebonden
// dag-as.

import { MS_PER_DAY } from '@/utils/dateUtils';

/**
 * Datum (met optionele sub-dag-precisie) → X-pixel op het chart-canvas:
 * `chartOriginX + daysFromStart * zoom - scrollX`. De aanroepers geven hun LIVE opts-waarden mee
 * (geen object-allocatie op dit hot path).
 */
export function dateToX(
  date: Date,
  viewStart: Date,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): number {
  const daysFromStart = (date.getTime() - viewStart.getTime()) / MS_PER_DAY;
  return chartOriginX + daysFromStart * zoom - scrollX;
}

/**
 * Zuivere inverse van `dateToX`: een X-pixel → het aantal (fractionele) dag-eenheden sinds
 * `viewStart`. Losstaand van `xToDate` geëxporteerd omdat sommige aanroepers (bv. de eerste
 * zichtbare-dag-index in de grid-loop) alleen het GETAL nodig hebben — een round-trip door een
 * `Date`-object zou daar een nutteloze afronding op hele milliseconden introduceren.
 */
export function xToDayOffset(
  x: number,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): number {
  return (x - chartOriginX + scrollX) / zoom;
}

/**
 * Inverse van `dateToX`: X-pixel op het chart-canvas → datum (met sub-dag-precisie). Dit is de
 * lineaire kalender-as; de `WorkdayAxis` (`workdayAxis.ts`) deelt dezelfde `GanttAxis`-vorm (zie
 * hieronder) maar comprimeert niet-werkdagen.
 */
export function xToDate(
  x: number,
  viewStart: Date,
  chartOriginX: number,
  zoom: number,
  scrollX: number,
): Date {
  const days = xToDayOffset(x, chartOriginX, zoom, scrollX);
  return new Date(viewStart.getTime() + days * MS_PER_DAY);
}

/**
 * As-abstractie. Twee implementaties in `workdayAxis.ts`: `buildCalendarAxis` (dunne wrapper om
 * `dateToX`/`xToDate` hierboven) en `buildWorkdayAxis`; de call-sites kennen alleen deze vorm.
 */
export interface GanttAxis {
  /** datum (met sub-dag-precisie) → X op het chart-canvas (incl. −scrollX). */
  dateToX(date: Date): number;
  /** inverse: een X op het chart-canvas → datum (met sub-dag-precisie). */
  xToDate(x: number): Date;
  /**
   * Aantal *getoonde* dag-eenheden tussen twee datums: op de kalender-as zijn dat
   * kalenderdagen, op de werkdagen-as werkdagen. Gebruikt door fit-to-project/scroll-bounds/
   * `totalContentWidth` zodat die eenheden-bewust rekenen i.p.v. impliciet in
   * kalenderdagen.
   */
  daySpan(from: Date, to: Date): number;
  /**
   * 0-based dag-index (met sub-dag-fractie) van `date` op de getoonde as — de as-eenheid-
   * pendant van "welke kolom is dit". Op een niet-werkdag (werkdagen-as) geldt kleef-rechts:
   * de index van de eerstvolgende werkdag.
   */
  dayIndexOf(date: Date): number;
  /** Inverse van `dayIndexOf`: de datum (start van de dag, met evt. sub-dag-fractie als
   *  `index` niet-heel is) op as-index `index`. */
  dateAtIndex(index: number): Date;
}
