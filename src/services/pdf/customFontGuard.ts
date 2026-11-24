import type { ReportFontChoice } from './reportFont';

/** Een laat antwoord hoort alleen bij de nog actuele keuze en revisie. */
export function fontReadIsCurrent(
  expectedRev: number | undefined,
  current: { reportFontFamily: ReportFontChoice; customReportFont: { rev: number } | null },
): boolean {
  return current.reportFontFamily === 'custom' && current.customReportFont?.rev === expectedRev;
}
