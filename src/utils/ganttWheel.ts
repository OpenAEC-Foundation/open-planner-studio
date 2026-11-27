import type { ModifierMap, PositionDivision, ScrollMode, WheelFunction } from '@/state/slices/types';

const HORIZONTAL_SPLIT = 0.5;
const VERTICAL_BAND = 0.3;

export interface WheelFunctionInput {
  mode: ScrollMode;
  ctrl: boolean;
  shift: boolean;
  fracX: number;
  fracY: number;
  division: PositionDivision;
  map: ModifierMap;
}

export function resolveWheelFunction({
  mode,
  ctrl,
  shift,
  fracX,
  fracY,
  division,
  map,
}: WheelFunctionInput): WheelFunction {
  if (mode === 'drag') {
    return shift ? 'vertical' : 'zoom';
  }
  if (mode === 'modifier') {
    if (ctrl) return map.ctrl;
    if (shift) return map.shift;
    return map.plain;
  }
  if (ctrl) return 'zoom';
  if (shift) return 'horizontal';
  if (division === 'left-right') {
    return fracX < HORIZONTAL_SPLIT ? 'vertical' : 'horizontal';
  }
  if (division === 'top-bottom') {
    return fracY < VERTICAL_BAND ? 'horizontal' : 'vertical';
  }
  const topRight = fracX >= HORIZONTAL_SPLIT && fracY < 0.5;
  return topRight ? 'horizontal' : 'vertical';
}
