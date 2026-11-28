import { resolveCornerRadii, type CornerRadii, type Draw2D, type TextAlign, type TextBaseline } from './draw2d';
import { hasRtlText, rtlReportFont } from './reportFont';

export class CanvasDraw2D implements Draw2D {
  private ctx: CanvasRenderingContext2D;

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
    ctx.fontKerning = 'none';
    ctx.textRendering = 'geometricPrecision';
    this.ctx = ctx;
  }

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

  fillRect(x: number, y: number, w: number, h: number): void { this.ctx.fillRect(x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.ctx.strokeRect(x, y, w, h); }

  beginPath(): void { this.ctx.beginPath(); }
  moveTo(x: number, y: number): void { this.ctx.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.ctx.lineTo(x, y); }
  closePath(): void { this.ctx.closePath(); }
  fill(): void { this.ctx.fill(); }
  stroke(): void { this.ctx.stroke(); }

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

  fillText(text: string, x: number, y: number): void {
    if (hasRtlText(text)) this.withScreenFont(() => this.ctx.fillText(text, x, y));
    else this.ctx.fillText(text, x, y);
  }

  measureText(text: string): { width: number } {
    return hasRtlText(text) ? this.withScreenFont(() => this.ctx.measureText(text)) : this.ctx.measureText(text);
  }

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
