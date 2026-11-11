import { resolveCornerRadii, type CornerRadii, type Draw2D, type TextAlign, type TextBaseline } from './draw2d';
import { hasRtlText, rtlReportFont } from './reportFont';

/**
 * Canvas-backend voor `Draw2D` (raster). Wrapt een `CanvasRenderingContext2D` en forwardt
 * elke primitief 1:1. De constructor doet de high-DPI-canvas-setup: hij zet de raster- én CSS-maat
 * van het canvas en schaalt de context met `renderScale`, zodat alle teken-aanroepen in
 * LOGISCHE/CSS-px werken.
 */
export class CanvasDraw2D implements Draw2D {
  private ctx: CanvasRenderingContext2D;

  /**
   * @param canvas       het doel-canvas (wordt van maat voorzien)
   * @param logicalW     logische breedte in CSS-px
   * @param logicalH     logische hoogte in CSS-px
   * @param renderScale  raster-vs-logisch-multiplier (`canvas.width = logicalW * renderScale`)
   */
  constructor(
    canvas: HTMLCanvasElement,
    logicalW: number,
    logicalH: number,
    renderScale: number,
  ) {
    canvas.width = logicalW * renderScale;
    canvas.height = logicalH * renderScale;
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(renderScale, renderScale);
    // Kerning uit zodat canvas-`measureText`/rendering pixel-WYSIWYG is t.o.v. de pdf-lib-vector-export,
    // die advances telt zónder kerning (tekst met Arabisch of Hebreeuws: zie `withScreenFont`).
    ctx.fontKerning = 'none';
    // Letterbreedtes zoals het fontbestand ze geeft, zoals op het SVG-papier (review Sol #847). Zonder deze
    // instelling rondt Chromium op Linux bij kleine letters elke letterbreedte af op hele pixels: "Stakeholder
    // management" in 9 px Inter meet dan 115 in plaats van 109,0. De naamkolom is op 109,0 gemeten (de meting
    // van de PDF), dus dan kapte de rasterexport de langste naam af terwijl afkappen uit stond.
    ctx.textRendering = 'geometricPrecision';
    this.ctx = ctx;
  }

  // ---- stijl: forward 1:1 naar de context ----
  get font(): string { return this.ctx.font; }
  set font(v: string) { this.ctx.font = v; }
  get fillStyle(): string { return this.ctx.fillStyle as string; }
  set fillStyle(v: string) { this.ctx.fillStyle = v; }
  get strokeStyle(): string { return this.ctx.strokeStyle as string; }
  set strokeStyle(v: string) { this.ctx.strokeStyle = v; }
  get lineWidth(): number { return this.ctx.lineWidth; }
  set lineWidth(v: number) { this.ctx.lineWidth = v; }
  get textAlign(): TextAlign { return this.ctx.textAlign as TextAlign; }
  set textAlign(v: TextAlign) { this.ctx.textAlign = v; }
  get textBaseline(): TextBaseline { return this.ctx.textBaseline as TextBaseline; }
  set textBaseline(v: TextBaseline) { this.ctx.textBaseline = v; }

  setLineDash(segments: number[]): void { this.ctx.setLineDash(segments); }

  // ---- rects ----
  fillRect(x: number, y: number, w: number, h: number): void { this.ctx.fillRect(x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.ctx.strokeRect(x, y, w, h); }

  // ---- paths ----
  beginPath(): void { this.ctx.beginPath(); }
  moveTo(x: number, y: number): void { this.ctx.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.ctx.lineTo(x, y); }
  closePath(): void { this.ctx.closePath(); }
  fill(): void { this.ctx.fill(); }
  stroke(): void { this.ctx.stroke(); }

  /**
   * Afgeronde rechthoek (arcTo-variant). Guard `if (w < 0) return`, elke straal begrensd op
   * `min(w/2, h/2)`. `r` per hoek mag (`CornerRadii`). Geen ctx.roundRect gebruiken (dat is nieuwer +
   * geeft iets ander gedrag); deze helper blijft de bron van waarheid.
   */
  roundRect(x: number, y: number, w: number, h: number, r: CornerRadii): void {
    if (w < 0) return;
    const [tl, tr, br, bl] = resolveCornerRadii(r, w, h);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  // ---- tekst ----
  fillText(text: string, x: number, y: number): void {
    if (hasRtlText(text)) this.withScreenFont(() => this.ctx.fillText(text, x, y));
    else this.ctx.fillText(text, x, y);
  }

  measureText(text: string): { width: number } {
    return hasRtlText(text) ? this.withScreenFont(() => this.ctx.measureText(text)) : this.ctx.measureText(text);
  }

  /**
   * Tekst met Arabisch of Hebreeuws tekent de PDF via de shaping-kern: Arabisch en neutrale tekens in Noto
   * Sans Arabic, met kerning. Het canvas tekent hem daarom met Noto vooraan en kerning aan, net als het
   * SVG-papier (`reportTextFont` in `reportFont.ts`); daarna weer de gewone letter.
   */
  private withScreenFont<T>(run: () => T): T {
    const ctx = this.ctx;
    const font = ctx.font;
    ctx.font = rtlReportFont(font);
    ctx.fontKerning = 'normal';
    try {
      return run();
    } finally {
      ctx.font = font;
      ctx.fontKerning = 'none';
    }
  }
}
