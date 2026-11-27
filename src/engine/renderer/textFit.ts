export interface TextMeasurer {
  measureText(text: string): { width: number };
}

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
