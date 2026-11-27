export const INTER_PDF_FAMILY = 'InterPDF';

export const DEFAULT_REPORT_FONT_STACK = `${INTER_PDF_FAMILY}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

export const REPORT_FONT_IDS = ['inter', 'liberationSans', 'carlito', 'liberationSerif', 'liberationMono'] as const;
export type ReportFontId = (typeof REPORT_FONT_IDS)[number];
export const DEFAULT_REPORT_FONT_ID: ReportFontId = 'inter';

export interface ReportFontDef {
  family: string;
  files: { regular: string; bold: string };
  generic: 'sans-serif' | 'serif' | 'monospace';
}

export const REPORT_FONTS: Record<ReportFontId, ReportFontDef> = {
  inter: { family: INTER_PDF_FAMILY, files: { regular: 'Inter-Regular.ttf', bold: 'Inter-Bold.ttf' }, generic: 'sans-serif' },
  liberationSans: { family: 'OpsReportLiberationSans', files: { regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf' }, generic: 'sans-serif' },
  carlito: { family: 'OpsReportCarlito', files: { regular: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf' }, generic: 'sans-serif' },
  liberationSerif: { family: 'OpsReportLiberationSerif', files: { regular: 'LiberationSerif-Regular.ttf', bold: 'LiberationSerif-Bold.ttf' }, generic: 'serif' },
  liberationMono: { family: 'OpsReportLiberationMono', files: { regular: 'LiberationMono-Regular.ttf', bold: 'LiberationMono-Bold.ttf' }, generic: 'monospace' },
};

export type ReportFontChoice = ReportFontId | 'custom';

export const CUSTOM_REPORT_FAMILY = 'OpsReportCustom';

export function isReportFontId(value: unknown): value is ReportFontId {
  return typeof value === 'string' && (REPORT_FONT_IDS as readonly string[]).includes(value);
}

export function isRtlCodepoint(cp: number): boolean {
  return (
    (cp >= 0x0590 && cp <= 0x05FF) ||
    (cp >= 0x0600 && cp <= 0x06FF) ||
    (cp >= 0x0750 && cp <= 0x077F) ||
    (cp >= 0x08A0 && cp <= 0x08FF) ||
    (cp >= 0xFB50 && cp <= 0xFDFF) ||
    (cp >= 0xFE70 && cp <= 0xFEFF)
  );
}

export function hasRtlText(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isRtlCodepoint(cp)) return true;
  }
  return false;
}

export const ARABIC_REPORT_FAMILY = 'OpsReportArabic';

export const ARABIC_REPORT_UNICODE_RANGE = 'U+0009-000A, U+000D, U+0020, U+00A0, U+0600-06FF, U+0750-077F, U+08A0-08FF, U+2000-206F, U+FB50-FDFF, U+FE70-FEFF';

export function rtlReportFont(font: string): string {
  return font.replace(/(\d+(?:\.\d+)?px(?:\s*\/\s*\S+)?\s+)/, `$1"${ARABIC_REPORT_FAMILY}", `);
}

export function isRtlReportFont(font: string): boolean {
  return font.includes(`"${ARABIC_REPORT_FAMILY}"`);
}

export function reportTextFont(text: string, font: string): string {
  return hasRtlText(text) ? rtlReportFont(font) : font;
}

export function reportFontStack(id: ReportFontChoice): string {
  if (id === 'inter') return DEFAULT_REPORT_FONT_STACK;
  if (id === 'custom') return `"${CUSTOM_REPORT_FAMILY}", ${INTER_PDF_FAMILY}, sans-serif`;
  const def = REPORT_FONTS[id];
  return `"${def.family}", ${INTER_PDF_FAMILY}, ${def.generic}`;
}
