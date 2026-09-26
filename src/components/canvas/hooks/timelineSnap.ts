import { pickTiers, TIER_CONFIG } from '@/engine/renderer/timelineTiers';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import { utcDayStart } from '@/utils/dateUtils';

// Gedeeld snappen van de balkgebaren (`useBarDrag`) en de splits-modus (`useSplitGesture`): beide
// moeten onder dezelfde canvas-x exact dezelfde datum vinden.

/**
 * Snap-quantum (minuten) van een uurgebaar: dezelfde actieve minor-tier als de tijdkop. Op
 * kwartierzoom is 15 minuten bereikbaar; zonder die opt-in blijft de ondergrens één uur.
 */
export function hourSnapMinutesFor(zoom: number, enableQuarterHourZoom: boolean, enableHourPlanning: boolean): number {
  const minorTier = pickTiers(zoom, enableQuarterHourZoom, enableHourPlanning).minor;
  return Math.max(enableQuarterHourZoom ? 15 : 60, Math.round(TIER_CONFIG[minorTier].stepDays * 1440));
}

/**
 * De gesnapte datum onder een canvas-x: in dag-modus het begin van de dag, in uur-modus het
 * snap-quantum. De x loopt via de gedeelde as, dus werkdagencompressie zit er al in. `null` als de
 * as op die x geen datum heeft.
 */
export function snapTimelineDate(axis: GanttAxis, x: number, hourMode: boolean, hourSnapMinutes: number): Date | null {
  const raw = axis.xToDate(x);
  if (Number.isNaN(raw.getTime())) return null;
  if (!hourMode) return utcDayStart(raw);
  const q = Math.max(1, hourSnapMinutes) * 60_000;
  return new Date(Math.round(raw.getTime() / q) * q);
}
