import type { TextBaseline } from './draw2d';
import { fontPx, type SvgTextMetrics } from './svgDraw2d';

/**
 * Tekstmeting voor de SVG-backend in de browser: dezelfde `measureText` als de canvas-backend
 * (`CanvasDraw2D`, kerning uit), zodat afkappen, woordafbreking en labelplaatsing op het SVG-papier
 * precies zo uitvallen als in de rasterpreview en de PDF.
 *
 * De basislijnverschuiving volgt de vector-PDF (`PdfVectorDraw2D.place`): `middle` = halverwege
 * stijg- en daalhoogte van de letter, `bottom` = de daalhoogte. De maten komen uit de canvasmeting van
 * dezelfde letter (`fontBoundingBoxAscent/Descent`); zonder die maten de verhouding van Inter.
 *
 * Een meting wordt per letter en tekst onthouden: een rapport tekent dezelfde datums, duren en koppen
 * honderden keren.
 */
export function createCanvasTextMetrics(): SvgTextMetrics {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('createCanvasTextMetrics: geen 2D-context');
  ctx.fontKerning = 'none';
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
      applyFont(font);
      const width = ctx.measureText(text).width;
      // Begrensd: een grote planning heeft duizenden unieke namen; die hoeven niet eeuwig te blijven.
      if (perFont.size > 20_000) perFont.clear();
      perFont.set(text, width);
      return width;
    },
    baselineShift(font, baseline: TextBaseline) {
      if (baseline === 'alphabetic') return 0;
      let m = vertical.get(font);
      if (!m) {
        applyFont(font);
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
