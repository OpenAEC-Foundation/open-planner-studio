import type { ReportFontChoice } from './reportFont';

export function fontReadIsCurrent(
  expectedRev: number | undefined,
  current: { reportFontFamily: ReportFontChoice; customReportFont: { rev: number } | null },
): boolean {
  return current.reportFontFamily === 'custom' && current.customReportFont?.rev === expectedRev;
}
