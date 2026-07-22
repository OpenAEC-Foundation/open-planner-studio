import type { Draw2D, TextAlign, TextBaseline } from './draw2d';

/**
 * Canvas-backend voor `Draw2D` (preview/raster). Wrapt een `CanvasRenderingContext2D` en forwardt
 * elke primitief 1:1. De constructor neemt de high-DPI-canvas-setup over die voorheen los in
 * `renderPrintCanvas` stond: hij zet de raster- én CSS-maat van het canvas en schaalt de context
 * met `renderScale`, zodat alle teken-aanroepen in LOGISCHE/CSS-px werken (zoals de renderer al deed).
 */
export class CanvasDraw2D implements Draw2D {
  private ctx: CanvasRenderingContext2D;

  /**
   * @param canvas       het doel-canvas (wordt van maat voorzien)
   * @param logicalW     logische breedte in CSS-px
   * @param logicalH     logische hoogte in CSS-px
   * @param renderScale  raster-vs-logisch-multiplier (`canvas.width = logicalW * renderScale`)
   */
  constructor(canvas: HTMLCanvasElement, logicalW: number, logicalH: number, renderScale: number) {
    canvas.width = logicalW * renderScale;
    canvas.height = logicalH * renderScale;
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(renderScale, renderScale);
    // Fase-0-learning: schakel kerning uit zodat canvas-`measureText`/rendering pixel-WYSIWYG is
    // t.o.v. de latere pdf-lib-vector-export, die advances telt zónder kerning (§7-fase-0, learning 1).
    ctx.fontKerning = 'none';
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
   * Afgeronde rechthoek — exacte kopie van de oude losse `roundRect`-helper uit `printPreview.ts`
   * (arcTo-variant). Guard `if (w < 0) return`, `r = min(r, w/2, h/2)`. Geen ctx.roundRect gebruiken
   * (dat is nieuwer + geeft iets ander gedrag); deze helper blijft de bron van waarheid.
   */
  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    if (w < 0) return;
    r = Math.min(r, w / 2, h / 2);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ---- tekst ----
  fillText(text: string, x: number, y: number): void { this.ctx.fillText(text, x, y); }
  measureText(text: string): { width: number } { return this.ctx.measureText(text); }
}
