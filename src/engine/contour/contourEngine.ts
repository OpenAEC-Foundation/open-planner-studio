import type { DurationType, TaskSplitGap, TaskTimephasedContour, TimephasedContourPeriod, MspTaskType } from '@/types/task';
import type { ResourceAssignment, ResourceCurve } from '@/types/resource';
import { splitDayPattern } from '@/engine/scheduler/splitWalk';
import { isFiniteNumber } from '@/utils/guards';

export type ContourShape =
  | 'FLAT' | 'BACK_LOADED' | 'FRONT_LOADED' | 'DOUBLE_PEAK' | 'EARLY_PEAK' | 'LATE_PEAK' | 'BELL' | 'TURTLE';

// Bron van de tabel: MPXJ `org.mpxj.WorkContour` (LGPL-2.1, github.com/joniles/mpxj).
export const CONTOUR_SHAPE_VALUES: Record<ContourShape, readonly number[]> = {
  FLAT: [0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  BACK_LOADED: [0, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
  FRONT_LOADED: [0, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5],
  DOUBLE_PEAK: [0, 1.3, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5, 2.5, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5],
  EARLY_PEAK: [0, 1.2, 2.5, 3.8, 5, 7.5, 10.1, 10.1, 10.1, 8.8, 7.5, 6.3, 5.0, 5.0, 5.0, 3.8, 2.5, 2.0, 1.5, 1.3, 1.0],
  LATE_PEAK: [0, 1.0, 1.3, 1.5, 2.0, 2.5, 3.8, 5.0, 5.0, 5.0, 6.3, 7.5, 8.8, 10.1, 10.1, 10.1, 7.5, 5, 3.8, 2.5, 1.2],
  BELL: [0, 0.5, 0.5, 1.5, 1.5, 4.0, 4.0, 7.5, 7.5, 11.5, 11.5, 11.5, 11.5, 7.5, 7.5, 4, 4, 1.5, 1.5, 0.5, 0.5],
  TURTLE: [0, 1.0, 1.0, 3.5, 3.5, 5.5, 5.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 5.5, 5.5, 3.5, 3.5, 1.0, 1.0],
};

export const MSPDI_WORKCONTOUR_CONTOURED = 8;

export const CURVE_TO_SHAPE: Record<ResourceCurve, ContourShape> = {
  UNIFORM: 'FLAT', FRONT_LOADED: 'FRONT_LOADED', BACK_LOADED: 'BACK_LOADED', BELL: 'BELL',
  EARLY_PEAK: 'EARLY_PEAK', LATE_PEAK: 'LATE_PEAK', DOUBLE_PEAK: 'DOUBLE_PEAK', TURTLE: 'TURTLE',
};

export const SHAPE_TO_CURVE: Record<ContourShape, ResourceCurve> = {
  FLAT: 'UNIFORM', FRONT_LOADED: 'FRONT_LOADED', BACK_LOADED: 'BACK_LOADED', BELL: 'BELL',
  EARLY_PEAK: 'EARLY_PEAK', LATE_PEAK: 'LATE_PEAK', DOUBLE_PEAK: 'DOUBLE_PEAK', TURTLE: 'TURTLE',
};

export const CURVE_VALUE_COUNT = 21;

export function normalizeCurveValues(values: unknown): number[] | null {
  if (!Array.isArray(values) || values.length !== CURVE_VALUE_COUNT) return null;
  const out: number[] = [];
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    out.push(v);
  }
  out[0] = 0;
  const sum = out.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  return out;
}

export function isFlatCurveValues(values: readonly number[]): boolean {
  if (values.length !== CURVE_VALUE_COUNT || values[0] !== 0) return false;
  const first = values[1];
  for (let i = 2; i < values.length; i++) if (values[i] !== first) return false;
  return true;
}

export function matchCurveValues(values: readonly number[]): ResourceCurve | undefined {
  const shape = matchContourShape(values);
  return shape && SHAPE_TO_CURVE[shape];
}

export function matchContourShape(values: readonly number[]): ContourShape | undefined {
  if (values.length !== CURVE_VALUE_COUNT) return undefined;
  if (isFlatCurveValues(values)) return 'FLAT';
  for (const shape of Object.keys(CONTOUR_SHAPE_VALUES) as ContourShape[]) {
    const table = CONTOUR_SHAPE_VALUES[shape];
    let same = true;
    for (let i = 0; i < CURVE_VALUE_COUNT; i++) {
      if (Math.abs(table[i] - values[i]) > 1e-6) { same = false; break; }
    }
    if (same) return shape;
  }
  return undefined;
}

export function slotWeightsFromValues(values: readonly number[], slotCount: number): number[] {
  if (!(slotCount > 0)) return [];
  const n = Math.ceil(slotCount);
  const density = values.slice(1, CURVE_VALUE_COUNT);
  const total = density.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return new Array<number>(n).fill(1 / n);
  const weights: number[] = [];
  const sliceWidth = 1 / density.length;
  for (let k = 0; k < n; k++) {
    const lo = k / n;
    const hi = (k + 1) / n;
    let acc = 0;
    for (let s = 0; s < density.length; s++) {
      const sLo = s * sliceWidth;
      const sHi = (s + 1) * sliceWidth;
      const overlap = Math.min(hi, sHi) - Math.max(lo, sLo);
      if (overlap > 0) acc += density[s] * (overlap / sliceWidth);
    }
    weights.push(acc / total);
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 1) > 1e-12) {
    const last = weights.length - 1;
    weights[last] += 1 - sum;
  }
  return weights;
}

function usablePeriods(periods: readonly TimephasedContourPeriod[]): TimephasedContourPeriod[] {
  return periods.filter((p) =>
    Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes) && Number.isFinite(p.workMinutes)
    && p.afterMinutes >= 0 && p.minutes > 0 && p.workMinutes >= 0);
}

export function periodsSpanMinutes(periods: readonly TimephasedContourPeriod[]): number {
  let end = 0;
  for (const p of usablePeriods(periods)) end = Math.max(end, p.afterMinutes + p.minutes);
  return end;
}

export function periodsWorkMinutes(periods: readonly TimephasedContourPeriod[]): number {
  let sum = 0;
  for (const p of usablePeriods(periods)) sum += p.workMinutes;
  return sum;
}

export function periodsToSlotWork(
  periods: readonly TimephasedContourPeriod[],
  slotMinutes: number,
  minSlots = 0,
): number[] {
  const mpd = Math.max(1, slotMinutes);
  const usable = usablePeriods(periods);
  const span = periodsSpanMinutes(usable);
  const slotCount = Math.max(Math.ceil(span / mpd - 1e-9), Math.max(0, Math.ceil(minSlots)));
  const out = new Array<number>(slotCount).fill(0);
  for (const p of usable) {
    if (p.workMinutes <= 0) continue;
    const start = p.afterMinutes;
    const end = p.afterMinutes + p.minutes;
    const first = Math.floor(start / mpd);
    const last = Math.min(slotCount - 1, Math.ceil(end / mpd) - 1);
    for (let k = first; k <= last; k++) {
      const overlap = Math.min(end, (k + 1) * mpd) - Math.max(start, k * mpd);
      if (overlap > 0) out[k] += p.workMinutes * (overlap / p.minutes);
    }
  }
  return out;
}

export function periodsToWorkDaySlots(
  periods: readonly TimephasedContourPeriod[],
  gaps: readonly TaskSplitGap[] | undefined,
  slotMinutes: number,
  minSlots = 0,
): number[] {
  const raw = periodsToSlotWork(periods, slotMinutes, 0);
  if (!gaps || gaps.length === 0) {
    while (raw.length < minSlots) raw.push(0);
    return raw;
  }
  const blocks = splitDayPattern([...gaps], slotMinutes, raw.length);
  const out: number[] = [];
  let pos = 0;
  let carry = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.work && pos < raw.length; i++, pos++) {
      out.push(raw[pos] + carry);
      carry = 0;
    }
    for (let i = 0; i < b.gap && pos < raw.length; i++, pos++) carry += raw[pos];
  }
  for (; pos < raw.length; pos++) { out.push(raw[pos] + carry); carry = 0; }
  if (carry > 0) {
    if (out.length > 0) out[out.length - 1] += carry; else out.push(carry);
  }
  while (out.length < minSlots) out.push(0);
  return out;
}

export function periodsFromSlotWork(
  slotWork: readonly number[],
  slotMinutes: number,
  kind: 'actual' | 'remaining' = 'remaining',
): TimephasedContourPeriod[] {
  const mpd = Math.max(1, slotMinutes);
  return slotWork.map((w, k) => ({ afterMinutes: k * mpd, minutes: mpd, workMinutes: Math.max(0, w), kind }));
}

export function matchContoursToAssignments(
  contours: readonly TaskTimephasedContour[] | undefined,
  assignments: readonly ResourceAssignment[],
): Map<string, TaskTimephasedContour> {
  const out = new Map<string, TaskTimephasedContour>();
  if (!contours || contours.length === 0 || assignments.length === 0) return out;
  const used = new Set<number>();
  for (const a of assignments) {
    const idx = contours.findIndex((c, i) => !used.has(i) && c.resourceId !== undefined && c.resourceId === a.resourceId);
    if (idx >= 0) { used.add(idx); out.set(a.id, contours[idx]); }
  }
  if (out.size === 0 && contours.length === 1 && assignments.length === 1 && contours[0].resourceId === undefined) {
    out.set(assignments[0].id, contours[0]);
  }
  return out;
}

export function contourIndexForAssignment(
  contours: readonly TaskTimephasedContour[] | undefined,
  siblings: readonly ResourceAssignment[],
  assignmentId: string,
): number {
  if (!contours || contours.length === 0) return -1;
  const matched = matchContoursToAssignments(contours, siblings).get(assignmentId);
  return matched ? contours.indexOf(matched) : -1;
}

export function rescaleContourForDuration(
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
  taskType?: MspTaskType,
): TimephasedContourPeriod[] {
  const factorInfo = rescaleFactor(periods, oldWorkMinutes, newWorkMinutes);
  if (!factorInfo) return periods.map((p) => ({ ...p }));
  const { anchor, factor } = factorInfo;
  const keepWork = taskType === 'FIXED_WORK';
  return periods.map((p) => {
    if (p.kind === 'actual' || !Number.isFinite(p.afterMinutes) || !Number.isFinite(p.minutes)) return { ...p };
    const start = Math.max(anchor, p.afterMinutes);
    const newAfter = anchor + (start - anchor) * factor;
    const newMinutes = p.minutes * factor;
    return {
      afterMinutes: newAfter,
      minutes: newMinutes,
      workMinutes: keepWork ? p.workMinutes : p.workMinutes * factor,
      kind: p.kind,
    };
  });
}

export function rescaleSplitGaps(
  gaps: readonly TaskSplitGap[] | undefined,
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
  unitMinutes?: number,
): TaskSplitGap[] | undefined {
  if (!gaps || gaps.length === 0) return gaps ? [...gaps] : gaps;
  const factorInfo = rescaleFactor(periods, oldWorkMinutes, newWorkMinutes);
  if (!factorInfo) return gaps.map((g) => ({ ...g }));
  const { anchor, factor } = factorInfo;
  const unit = unitMinutes !== undefined && unitMinutes > 0 ? unitMinutes : 0;
  return gaps.map((g) => {
    if (g.source === 'leveling' || !Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes)) return { ...g };
    if (g.afterMinutes < anchor) return { ...g };
    const after = anchor + (g.afterMinutes - anchor) * factor;
    const gapMinutes = g.gapMinutes * factor;
    if (g.source === 'user' && unit > 0) {
      return {
        ...g,
        afterMinutes: Math.round(after / unit) * unit,
        gapMinutes: Math.max(unit, Math.round(gapMinutes / unit) * unit),
      };
    }
    return { ...g, afterMinutes: after, gapMinutes };
  });
}

export function rescaleFactor(
  periods: readonly TimephasedContourPeriod[],
  oldWorkMinutes: number,
  newWorkMinutes: number,
): { anchor: number; factor: number } | null {
  if (!Number.isFinite(oldWorkMinutes) || !Number.isFinite(newWorkMinutes) || newWorkMinutes <= 0) return null;
  let anchor = 0;
  let actualWork = 0;
  for (const p of usablePeriods(periods)) {
    if (p.kind !== 'actual') continue;
    anchor = Math.max(anchor, p.afterMinutes + p.minutes);
    if (p.workMinutes > 0) actualWork += p.minutes;
  }
  const oldRest = oldWorkMinutes - actualWork;
  const newRest = newWorkMinutes - actualWork;
  if (!(oldRest > 0) || !(newRest > 0)) return null;
  const factor = newRest / oldRest;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  if (Math.abs(factor - 1) < 1e-12) return null;
  return { anchor, factor };
}

export function taskWorkMinutes(
  time: { durationUnit?: 'days' | 'hours'; durationMinutes?: number; scheduleDuration: number },
  hoursPerDay: number,
): number {
  if (time.durationUnit === 'hours' && isFiniteNumber(time.durationMinutes)) {
    return Math.max(0, time.durationMinutes);
  }
  return Math.max(0, time.scheduleDuration) * Math.max(0, hoursPerDay) * 60;
}

export function taskAxisMinutes(
  time: { durationType?: DurationType; durationUnit?: 'days' | 'hours'; durationMinutes?: number; scheduleDuration: number },
  hoursPerDay: number,
): number {
  if (time.durationType !== 'ELAPSEDTIME') return taskWorkMinutes(time, hoursPerDay);
  const clockDays = time.durationUnit === 'hours' && isFiniteNumber(time.durationMinutes)
    ? time.durationMinutes / 1440
    : time.scheduleDuration;
  return Math.max(0, clockDays) * Math.max(0, hoursPerDay) * 60;
}
