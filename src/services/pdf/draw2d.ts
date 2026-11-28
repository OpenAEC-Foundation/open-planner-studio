export type TextAlign = 'left' | 'right' | 'center';
export type CornerRadii = number | readonly [number, number, number, number];

export function resolveCornerRadii(r: CornerRadii, w: number, h: number): [number, number, number, number] {
  const max = Math.max(0, Math.min(w / 2, h / 2));
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  return [Math.min(tl, max), Math.min(tr, max), Math.min(br, max), Math.min(bl, max)];
}
export type TextBaseline = 'middle' | 'alphabetic' | 'bottom';

export interface Draw2D {
  font: string;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  textAlign: TextAlign;
  textBaseline: TextBaseline;
  setLineDash(segments: number[]): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  roundRect(x: number, y: number, w: number, h: number, r: CornerRadii): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}
