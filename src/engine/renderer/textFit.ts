/** Alles wat tekst kan meten: een `CanvasRenderingContext2D` én de print-abstractie `Draw2D`. */
export interface TextMeasurer {
  measureText(text: string): { width: number };
}

/**
 * Kort `text` in met een ellips zodat het binnen `maxWidth` (in de eenheid van `measureText`) past.
 * Binaire zoektocht over `measureText` (O(log n) metingen) naar de langste prefix die met "…" past.
 * `''` betekent: zelfs de ellips past niet — dan hoort er niets getekend te worden. De aanroeper moet
 * het font al gezet hebben; `measureText` hangt daarvan af.
 *
 * Knipt op TEKEN-grens, niet op UTF-16-code-unit: `slice` kan een surrogaatpaar halveren, en een
 * emoji of CJK-extensieteken wordt dan een losse vervangingsglyph (U+FFFD) vlak vóór de ellips.
 * `Array.from` splitst op code points; gekozen boven `Intl.Segmenter` omdat die niet overal in de
 * canvas-testomgeving bestaat en per aanroep een object kost.
 */
export function ellipsize(measurer: TextMeasurer, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (measurer.measureText(text).width <= maxWidth) return text;
  const dots = '…';
  if (measurer.measureText(dots).width > maxWidth) return '';
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measurer.measureText(chars.slice(0, mid).join('') + dots).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('') + dots;
}
