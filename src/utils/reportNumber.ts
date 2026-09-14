/**
 * Getallen in rapporten (tabelrapporten én de toewijzingskolommen van het resourcediagram): één
 * notatie voor DOM, raster-PDF en vector-PDF — hoogstens twee decimalen, geen overbodige nullen,
 * geen duizendtalscheiding (het zijn dagen en eenheden, geen bedragen), en het decimaalteken van
 * de app-taal ("0,5" in nl/de/fr, "0.5" in en). Zonder `locale` (headless tests, oude aanroepen)
 * de neutrale punt-notatie. Eén functie, zodat twee rapporten in hetzelfde paneel niet met een
 * verschillende precisie of een verschillend decimaalteken kunnen uitkomen (review #138).
 */
export function formatReportNumber(n: number, locale?: string): string {
  if (!Number.isFinite(n)) return '';
  if (!locale) return String(Math.round(n * 100) / 100);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(n);
}

/** Zoals `formatReportNumber`, met een expliciete plus voor een positief getal (afwijkingen). */
export function formatSignedReportNumber(n: number, locale?: string): string {
  const text = formatReportNumber(n, locale);
  return n > 0 ? `+${text}` : text;
}
