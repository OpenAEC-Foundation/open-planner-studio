import type { TextBaseline } from './draw2d';
import { hasRtlText, rtlReportFont } from './reportFont';
import { fontPx, type SvgTextMetrics } from './svgDraw2d';

export function createCanvasTextMetrics(): SvgTextMetrics {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('createCanvasTextMetrics: geen 2D-context');
  ctx.fontKerning = 'none';
  ctx.textRendering = 'geometricPrecision';
  let currentFont = '';
  const widths = new Map<string, Map<string, number>>();
  const vertical = new Map<string, { ascent: number; descent: number }>();

  const applyFont = (font: string) => {
    if (font !== currentFont) {
      ctx.font = font;
      currentFont = font;
    }
  };

  return {
    measure(text, font) {
      let perFont = widths.get(font);
      if (!perFont) { perFont = new Map(); widths.set(font, perFont); }
      const cached = perFont.get(text);
      if (cached !== undefined) return cached;
      const rtl = hasRtlText(text);
      applyFont(rtl ? rtlReportFont(font) : font);
      ctx.fontKerning = rtl ? 'normal' : 'none';
      const width = ctx.measureText(text).width;
      if (perFont.size > 20_000) perFont.clear();
      perFont.set(text, width);
      return width;
    },
    baselineShift(font, baseline: TextBaseline) {
      if (baseline === 'alphabetic') return 0;
      let m = vertical.get(font);
      if (!m) {
        applyFont(font);
        ctx.fontKerning = 'none';
        ctx.textBaseline = 'alphabetic';
        const probe = ctx.measureText('Hg');
        const size = fontPx(font);
        const ascent = Number.isFinite(probe.fontBoundingBoxAscent) ? probe.fontBoundingBoxAscent : size * 0.969;
        const descent = Number.isFinite(probe.fontBoundingBoxDescent) ? probe.fontBoundingBoxDescent : size * 0.242;
        m = { ascent, descent };
        vertical.set(font, m);
      }
      return baseline === 'middle' ? (m.ascent - m.descent) / 2 : -m.descent;
    },
  };
}
