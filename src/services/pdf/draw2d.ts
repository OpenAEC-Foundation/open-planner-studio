/**
 * `Draw2D` — de gesloten teken-abstractie waar de print-renderer (`printPreview.ts`) tegenaan
 * tekent i.p.v. rechtstreeks tegen een `CanvasRenderingContext2D`. Twee backends implementeren 'm:
 * de canvas-backend (`CanvasDraw2D`, preview/raster) en — in fase 2 — de pdf-lib-vector-backend.
 * Eén renderer, twee backends houdt preview en export gegarandeerd in sync (§4.1 ontwerpdoc).
 *
 * De vorm is bewust minimaal en vast: exact de primitieven die `printPreview.ts` gebruikt. Style-
 * property-setters (font/fillStyle/…) houden de diff met de bestaande `ctx.xxx = …`-aanroepen zo
 * klein mogelijk. Coördinaten zijn LOGISCHE/CSS-px (de canvas-backend zet de dpr-scale intern).
 */

export type TextAlign = 'left' | 'right' | 'center';
export type TextBaseline = 'middle' | 'alphabetic' | 'bottom';

export interface Draw2D {
  // stijl (property-setters — minimale diff t.o.v. ctx.xxx = ...)
  font: string;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  textAlign: TextAlign;
  textBaseline: TextBaseline;
  setLineDash(segments: number[]): void;
  // rects
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  // paths
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  // tekst
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}
