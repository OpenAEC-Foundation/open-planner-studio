import type { TaskSplitGap, TimephasedContourPeriod } from '@/types/task';
import { splitDayPattern } from '@/engine/scheduler/splitWalk';
import {
  CONTOUR_SHAPE_VALUES, periodsFromSlotWork, periodsToWorkDaySlots, slotWeightsFromValues,
  type ContourShape,
} from './contourEngine';

export interface ContourDaySlots {
  actual: number[];
  remaining: number[];
}

export function contourDaySlots(
  periods: readonly TimephasedContourPeriod[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  minSlots = 0,
): ContourDaySlots {
  const actual = periodsToWorkDaySlots(periods.filter((p) => p.kind === 'actual'), gaps, slotMinutes, 0);
  const remaining = periodsToWorkDaySlots(periods.filter((p) => p.kind !== 'actual'), gaps, slotMinutes, 0);
  const n = Math.max(actual.length, remaining.length, Math.max(0, Math.ceil(minSlots)));
  while (actual.length < n) actual.push(0);
  while (remaining.length < n) remaining.push(0);
  return { actual, remaining };
}

export function workDaySlotsToPeriods(
  slotWork: readonly number[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  kind: 'actual' | 'remaining' = 'remaining',
): TimephasedContourPeriod[] {
  const mpd = Math.max(1, slotMinutes);
  if (!gaps || gaps.length === 0) return periodsFromSlotWork(slotWork, mpd, kind);
  const blocks = splitDayPattern([...gaps], mpd, slotWork.length);
  const out: TimephasedContourPeriod[] = [];
  let axisSlot = 0;
  let pos = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.work && pos < slotWork.length; i++, pos++, axisSlot++) {
      out.push({ afterMinutes: axisSlot * mpd, minutes: mpd, workMinutes: Math.max(0, slotWork[pos]), kind });
    }
    axisSlot += b.gap;
  }
  for (; pos < slotWork.length; pos++, axisSlot++) {
    out.push({ afterMinutes: axisSlot * mpd, minutes: mpd, workMinutes: Math.max(0, slotWork[pos]), kind });
  }
  return out;
}

export function buildEditedContourPeriods(
  existing: readonly TimephasedContourPeriod[] | undefined,
  remainingSlotWork: readonly number[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
): TimephasedContourPeriod[] {
  const actual = (existing ?? []).filter((p) => p.kind === 'actual');
  const cleaned = remainingSlotWork.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  return [...actual, ...workDaySlotsToPeriods(cleaned, gaps, slotMinutes, 'remaining')];
}

export function shapeSlotWork(shape: ContourShape, totalWorkMinutes: number, slotCount: number): number[] {
  const n = Math.max(0, Math.floor(slotCount));
  if (n === 0) return [];
  const total = Number.isFinite(totalWorkMinutes) && totalWorkMinutes > 0 ? totalWorkMinutes : 0;
  return slotWeightsFromValues(CONTOUR_SHAPE_VALUES[shape], n).map((w) => w * total);
}

export const EDITABLE_CONTOUR_SHAPES: readonly ContourShape[] = [
  'FLAT', 'BACK_LOADED', 'FRONT_LOADED', 'DOUBLE_PEAK', 'EARLY_PEAK', 'LATE_PEAK', 'BELL', 'TURTLE',
];
