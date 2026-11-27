export function shouldPromoteToRowDrag(dx: number, dy: number, threshold: number): boolean {
  return Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx);
}
