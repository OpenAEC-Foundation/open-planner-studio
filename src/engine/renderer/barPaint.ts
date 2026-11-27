import { doneBarTones } from './themePalette';

export interface BarPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  beginPath(): void;
  roundRect(x: number, y: number, w: number, h: number, r: readonly [number, number, number, number]): void;
  fill(): void;
}

const SEAM_OVERLAP = 1;

function fillSided(d: BarPainter, x1: number, x2: number, y: number, h: number, r: number, roundLeft: boolean, roundRight: boolean): void {
  if (x2 <= x1 || h <= 0) return;
  const rl = roundLeft ? r : 0;
  const rr = roundRight ? r : 0;
  d.beginPath();
  d.roundRect(x1, y, x2 - x1, h, [rl, rr, rr, rl]);
  d.fill();
}

export function paintProgressBarPiece(
  d: BarPainter,
  x1: number, x2: number, y: number, h: number, r: number,
  base: string, progressX: number, dark: boolean,
  roundLeft = true, roundRight = true,
): void {
  if (x2 <= x1) return;
  const doneTo = Math.max(x1, Math.min(x2, progressX));
  if (x2 > doneTo) {
    const from = doneTo > x1 ? Math.max(x1, doneTo - SEAM_OVERLAP) : x1;
    d.fillStyle = base;
    fillSided(d, from, x2, y, h, r, doneTo <= x1 && roundLeft, roundRight);
  }
  if (doneTo > x1) {
    d.fillStyle = doneBarTones(base, dark).fill;
    fillSided(d, x1, doneTo, y, h, r, roundLeft, doneTo >= x2 && roundRight);
  }
}
