import type { TaskSplitGap } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { addCalendarDays, formatDate, utcDayStart } from '@/utils/dateUtils';

/** De aanroeper lost het profiel op. `durationUnit` is geen maatbeleid. */
export type PlacementMeasure = 'minutes' | 'workdays';
export type PlacementMeasures = Readonly<Record<string, PlacementMeasure>>;

export interface PlacementRange {
  /** Fysieke werkminuten vanaf de start, inclusief de gaten op de cumulatieve split-as. */
  afterMinutes: number;
  minutes: number;
  /** Aandeel van een nominale werkdag, volgens de aangeleverde effectieve maat. */
  share: number;
}

export interface PlacementDay {
  /** Een nachtblok hoort bij de dag waarop het begint. */
  iso: string;
  minutes: number;
  share: number;
  ranges: PlacementRange[];
}

export type WorkPlacement = {
  start: Date;
  measure: PlacementMeasure;
  gaps?: readonly TaskSplitGap[];
} & ({ finish: Date; duration?: never } | {
  /** Minuten bij urenmaat, werkdagen bij dagenmaat; uitsluitend het werk, zonder gaten. */
  duration: number;
  finish?: never;
});

export interface PlacementResult {
  days: PlacementDay[];
  finish: Date;
}

/**
 * Eén wandeling voor een concrete plaatsing: effectieve blokken, deeldagen en splits.
 * Een expliciet einde is exclusief. Bij een kandidaat stopt de wandeling zodra haar hoeveelheid
 * verbruikt is. De split-as blijft fysiek in werkminuten, ook bij de dagenmaat.
 * De bestaande dagslotfuncties in splitWalk blijven ongewijzigd voor de renderer.
 */
export function workPlacement(engine: CalendarEngine, placement: WorkPlacement): PlacementResult {
  const { start, measure } = placement;
  const endMs = placement.finish?.getTime() ?? Infinity;
  let remaining = placement.duration ?? Infinity;
  const days: PlacementDay[] = [];
  if (!Number.isFinite(start.getTime()) || Number.isNaN(endMs) || endMs <= start.getTime()
    || !(remaining > 0) || !engine.isHourMode || !engine.hasWorkingDays()) return { days, finish: start };
  const gaps = (placement.gaps ?? []).filter(g => Number.isFinite(g.afterMinutes)
    && Number.isFinite(g.gapMinutes) && g.gapMinutes > 0)
    .slice().sort((a, b) => a.afterMinutes - b.afterMinutes);
  let gapIndex = 0;
  let axis = 0;
  let finish = start;
  // Ook de staart van een nachtblok van een eerdere dag kan de start bevatten.
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && remaining > 1e-12; scanned++) {
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
    const denominator = measure === 'workdays' ? dayMinutes : engine.hoursPerDay * 60;
    const ranges: PlacementRange[] = [];
    for (const band of bands) {
      let cursor = Math.max(start.getTime(), day.getTime() + band.start * 60_000);
      const end = Math.min(endMs, day.getTime() + band.end * 60_000);
      while (cursor < end && remaining > 1e-12) {
        // Overlappende en aaneensluitende gaten delen dezelfde cumulatieve as.
        while (gapIndex < gaps.length && gaps[gapIndex].afterMinutes + gaps[gapIndex].gapMinutes <= axis) gapIndex++;
        const gap = gaps[gapIndex];
        const inGap = gap && gap.afterMinutes <= axis;
        const boundary = gap ? (inGap ? gap.afterMinutes + gap.gapMinutes : gap.afterMinutes) : Infinity;
        const available = Math.min((end - cursor) / 60_000, boundary - axis);
        const wanted = measure === 'workdays' ? Math.round(remaining * denominator) : remaining;
        const minutes = inGap ? available : Math.min(available, wanted);
        if (!(minutes > 0)) { remaining = 0; break; }
        if (!inGap) {
          const share = minutes / denominator;
          ranges.push({ afterMinutes: axis, minutes, share });
          remaining -= measure === 'workdays' ? share : minutes;
        }
        axis += minutes;
        cursor += minutes * 60_000;
        finish = new Date(cursor);
      }
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
    });
    day = addCalendarDays(day, 1);
  }
  return { days, finish };
}
