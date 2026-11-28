import type { LayoutOverlays } from '@/types/view';
import {
  saveShowBaselineOverlay, saveShowFloatBand, saveShowProgressLine, saveShowResourceAccent, saveShowStatusDateLine,
} from '@/utils/settingsStore';
import { saveBarColorSelection } from '@/utils/barColorSettings';

export function persistOverlays(overlays: Partial<LayoutOverlays>): void {
  if (overlays.baseline !== undefined) void saveShowBaselineOverlay(overlays.baseline);
  if (overlays.progressLine !== undefined) void saveShowProgressLine(overlays.progressLine);
  if (overlays.statusDateLine !== undefined) void saveShowStatusDateLine(overlays.statusDateLine);
  if (overlays.resourceAccent !== undefined) void saveShowResourceAccent(overlays.resourceAccent);
  if (overlays.floatBand !== undefined) void saveShowFloatBand(overlays.floatBand);
  if (overlays.barColors !== undefined) void saveBarColorSelection(overlays.barColors);
}
