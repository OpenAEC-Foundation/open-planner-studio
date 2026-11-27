export const BAR_HEIGHT_RATIO = 0.6;

export interface BarLayout {
  barHeight: number;
  barOffset: number;
  accentHeight: number;
  baselineHeight: number;
  baselineStripeWidth: number;
}

export interface BarLayoutOptions {
  resourceAccent?: boolean;
  baselines?: boolean;
}

export const MIN_BAR_HEIGHT_RATIO = 0.4;
export const MIN_BAR_HEIGHT_PX = 6;

export function barLayout(rowHeight: number, options: BarLayoutOptions = {}): BarLayout {
  const normalBar = rowHeight * BAR_HEIGHT_RATIO;
  const normalOffset = (rowHeight - normalBar) / 2;
  const strip = Math.max(0, normalOffset - 1);
  const accentHeight = Math.max(2, Math.round(strip / 2));
  const baselineHeight = Math.max(2, Math.floor(strip));
  const baselineStripeWidth = Math.max(2, Math.round(rowHeight / 10));
  if (!(options.resourceAccent && options.baselines)) {
    return { barHeight: normalBar, barOffset: normalOffset, accentHeight, baselineHeight, baselineStripeWidth };
  }
  const below = 1 + accentHeight + baselineHeight;
  const minBar = Math.max(MIN_BAR_HEIGHT_PX, rowHeight * MIN_BAR_HEIGHT_RATIO);
  const barHeight = Math.min(normalBar, Math.max(minBar, rowHeight - normalOffset - below));
  const room = rowHeight - below - barHeight;
  const barOffset = room >= normalOffset - 1e-9 ? normalOffset : Math.max(0, room);
  return { barHeight, barOffset, accentHeight, baselineHeight, baselineStripeWidth };
}
