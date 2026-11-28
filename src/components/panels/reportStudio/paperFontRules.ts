import { REPORT_PAGE_TEXT_RULE, reportFontRule } from '@/services/pdf/svgDraw2d';

const known = new Set<string>();
let sheet: CSSStyleSheet | null = null;

function paperSheet(): CSSStyleSheet | null {
  if (sheet?.ownerNode?.isConnected) return sheet;
  known.clear();
  const style = document.createElement('style');
  style.dataset.opsReportPaperFonts = '';
  style.textContent = REPORT_PAGE_TEXT_RULE;
  document.head.appendChild(style);
  sheet = style.sheet;
  return sheet;
}

export function ensurePaperFontRules(fonts: readonly string[]): void {
  if (fonts.every(font => known.has(font)) && sheet?.ownerNode?.isConnected) return;
  const target = paperSheet();
  if (!target) return;
  for (const font of fonts) {
    if (known.has(font)) continue;
    target.insertRule(reportFontRule(font), target.cssRules.length);
    known.add(font);
  }
}
