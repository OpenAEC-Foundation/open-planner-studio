import type { Task, TaskSplitGap, TaskTimephasedContour } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import type { EffectiveSchedulingOptions } from '@/types/project';
import { CalendarEngine } from './CalendarEngine';
import { taskCountsInWorkdays } from './conventions/durationMeasure';
import { durationMinutesOf, isPinnedComplete, isPinnedInProgress, splitTotalSpanMinutes } from './duration';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatDate, parseInstant, utcDayStart } from '@/utils/dateUtils';

export type PlacementMeasure = 'minutes' | 'workdays';

export type PlacementOptions = Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>;

export interface PlacementRange {
  afterMinutes: number;
  axisMinutes: number;
  minutes: number;
  share: number;
}

export interface PlacementDay {
  iso: string;
  minutes: number;
  share: number;
  residueMinutes?: number;
  dayAxisMinutes: number;
  ranges: PlacementRange[];
}

export type WorkPlacement = {
  start: Date;
  measure: PlacementMeasure;
  gaps?: readonly TaskSplitGap[];
} & ({ finish: Date; duration?: never } | {
  duration: number;
  finish?: never;
});

export interface PlacementResult {
  days: PlacementDay[];
  finish: Date;
}

const AXIS_EPS = 1e-9;

export function workPlacement(engine: CalendarEngine, placement: WorkPlacement): PlacementResult {
  const { start, measure } = placement;
  const endMs = placement.finish?.getTime() ?? Infinity;
  const remaining = placement.duration ?? Infinity;
  const days: PlacementDay[] = [];
  if (!Number.isFinite(start.getTime()) || Number.isNaN(endMs) || endMs <= start.getTime()
    || !(remaining > 0) || !engine.isHourMode || !engine.hasWorkingDays()) return { days, finish: start };
  const gaps = (placement.gaps ?? []).filter(g => Number.isFinite(g.afterMinutes)
    && Number.isFinite(g.gapMinutes) && g.gapMinutes > 0)
    .slice().sort((a, b) => a.afterMinutes - b.afterMinutes);
  if (measure === 'workdays') {
    const spanEnd = placement.duration !== undefined
      ? engine.addMeasuredWorkdays(start, measuredSpanDays(placement.duration, gaps, engine)).getTime()
      : undefined;
    return measuredWorkdayWalk(engine, start, Math.min(endMs, spanEnd ?? Infinity), remaining, gaps, spanEnd);
  }
  const toMs = CalendarEngine.walkMs;
  let axisEndMs = placement.duration !== undefined ? toMs(splitTotalSpanMinutes(gaps, remaining)) : Infinity;
  let rest = remaining;
  let gapIndex = 0;
  let axisMs = 0;
  let finish = start;
  let lastStepDay: Date | null = null;
  let lastStepDayMinutes = 0;
  const denominator = engine.hoursPerDay * 60;
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && axisMs < axisEndMs; scanned++) {
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
    const ranges: PlacementRange[] = [];
    let dayResidue = 0;
    for (const band of bands) {
      let cursor = Math.max(start.getTime(), day.getTime() + band.start * 60_000);
      const end = Math.min(endMs, day.getTime() + band.end * 60_000);
      while (cursor < end && axisMs < axisEndMs) {
        while (gapIndex < gaps.length && toMs(gaps[gapIndex].afterMinutes + gaps[gapIndex].gapMinutes) <= axisMs) gapIndex++;
        const gap = gaps[gapIndex];
        const inGap = gap && toMs(gap.afterMinutes) <= axisMs;
        const boundary = gap ? toMs(inGap ? gap.afterMinutes + gap.gapMinutes : gap.afterMinutes) : Infinity;
        const step = Math.min(end - cursor, boundary - axisMs, axisEndMs - axisMs);
        if (!(step > 0)) { axisEndMs = axisMs; break; }
        if (!inGap) {
          const time = step / 60_000;
          const minutes = axisMs + step >= axisEndMs ? rest : Math.min(time, rest);
          rest -= minutes;
          if (minutes > time) dayResidue += minutes - time;
          ranges.push({ afterMinutes: axisMs / 60_000, axisMinutes: time, minutes, share: Math.min(minutes, time) / denominator });
        }
        axisMs += step;
        cursor += step;
        finish = new Date(cursor);
        lastStepDay = day;
        lastStepDayMinutes = dayMinutes;
      }
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges, dayAxisMinutes: dayMinutes,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
      ...(dayResidue > 0 ? { residueMinutes: dayResidue } : {}),
    });
    day = addCalendarDays(day, 1);
  }
  if (rest > 0 && Number.isFinite(rest) && lastStepDay) {
    const residue: PlacementRange = { afterMinutes: axisMs / 60_000, axisMinutes: 0, minutes: rest, share: 0 };
    const iso = formatDate(lastStepDay);
    const tail = days[days.length - 1];
    if (tail?.iso === iso) {
      tail.ranges.push(residue);
      tail.minutes += rest;
      tail.residueMinutes = (tail.residueMinutes ?? 0) + rest;
    } else {
      days.push({
        iso, ranges: [residue], dayAxisMinutes: lastStepDayMinutes,
        minutes: rest, share: 0, residueMinutes: rest,
      });
    }
  }
  return { days, finish };
}

function capacityFraction(days: readonly PlacementDay[]): number {
  let work = 0;
  let residue = 0;
  for (const d of days) {
    work += d.minutes;
    residue += d.residueMinutes ?? 0;
  }
  return residue > 0 && work > residue ? (work - residue) / work : 1;
}

export function placementResidueAxis(days: readonly PlacementDay[]): { from: number; to: number } | null {
  let residue = 0;
  let from = -Infinity;
  for (const d of days) {
    residue += d.residueMinutes ?? 0;
    for (const r of d.ranges) from = Math.max(from, r.afterMinutes + r.axisMinutes);
  }
  return residue > 0 && Number.isFinite(from) ? { from, to: from + residue } : null;
}

export function assignmentPlacementWork(
  units: readonly number[],
  days: readonly PlacementDay[],
  contour: TaskTimephasedContour | null,
  mpd: number,
): number {
  const booked = units.reduce((sum, u) => sum + u, 0);
  if (contour && contour.periods.length > 0) {
    return placementResidueAxis(days) ? booked + contourCut(days, mpd, contour).residue : booked;
  }
  return booked / capacityFraction(days);
}

function contourCut(
  days: readonly PlacementDay[],
  mpd: number,
  contour: TaskTimephasedContour,
): { units: number[]; residue: number } {
  const units = days.map(() => 0);
  let residue = 0;
  const tail = placementResidueAxis(days);
  const ranges = days.flatMap((d, day) => d.ranges.map(r => ({ ...r, day })));
  for (const p of contour.periods) {
    if (!Number.isFinite(p.afterMinutes) || !Number.isFinite(p.minutes) || !Number.isFinite(p.workMinutes)
      || p.afterMinutes < 0 || p.minutes <= 0 || p.workMinutes <= 0) continue;
    let cursor = p.afterMinutes;
    const end = cursor + p.minutes;
    let lo = 0;
    let hi = ranges.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ranges[mid].afterMinutes + ranges[mid].axisMinutes <= cursor) lo = mid + 1; else hi = mid;
    }
    for (let i = lo; i < ranges.length; i++) {
      const r = ranges[i];
      const stop = Math.min(end, r.afterMinutes + r.axisMinutes);
      if (stop > cursor) {
        units[r.day] += p.workMinutes * (stop - cursor) / p.minutes / mpd;
        cursor = stop;
      }
      if (cursor >= end) break;
    }
    if (cursor < end && days.length > 0) {
      const free = tail ? Math.max(0, Math.min(end, tail.to) - Math.max(cursor, tail.from)) : 0;
      if (free > 0) residue += p.workMinutes * free / p.minutes / mpd;
      units[days.length - 1] += p.workMinutes * (end - cursor - free) / p.minutes / mpd;
    }
  }
  return { units, residue };
}

function measuredWorkdayWalk(
  engine: CalendarEngine,
  start: Date,
  endMs: number,
  durationDays: number,
  gaps: readonly TaskSplitGap[],
  spanEnd: number | undefined,
): PlacementResult {
  const mpd = Math.max(1, engine.hoursPerDay * 60);
  const startMs = start.getTime();
  const days: PlacementDay[] = [];
  let remaining = durationDays * mpd;
  let gapIndex = 0;
  let axis = 0;
  let finish = start;
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && remaining > AXIS_EPS; scanned++) {
    const dayMs = day.getTime();
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
    const ranges: PlacementRange[] = [];
    let at = workOffset(bands, dayMs, startMs);
    const to = workOffset(bands, dayMs, endMs);
    const scale = dayMinutes > 0 ? mpd / dayMinutes : 0;
    while (at < to && remaining > AXIS_EPS) {
      while (gapIndex < gaps.length && gaps[gapIndex].afterMinutes + gaps[gapIndex].gapMinutes <= axis + AXIS_EPS) gapIndex++;
      const gap = gaps[gapIndex];
      const inGap = gap !== undefined && gap.afterMinutes <= axis + AXIS_EPS;
      const boundary = gap ? (inGap ? gap.afterMinutes + gap.gapMinutes : gap.afterMinutes) : Infinity;
      const toBoundary = boundary - axis;
      const room = Math.min((to - at) * scale, toBoundary);
      const step = inGap ? room : Math.min(room, remaining);
      if (!(step > AXIS_EPS)) break;
      const next = at + step / scale;
      if (!inGap) {
        ranges.push({
          afterMinutes: axis, axisMinutes: step, share: step / mpd,
          minutes: Math.round(next) - Math.round(at),
        });
        remaining -= step;
      }
      axis = step === toBoundary ? boundary : axis + step;
      at = next;
      finish = momentAtOffset(engine, bands, dayMs, Math.round(at));
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges, dayAxisMinutes: mpd,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
    });
    day = addCalendarDays(day, 1);
  }
  if (spanEnd !== undefined && days.length > 0) finish = new Date(spanEnd);
  return { days, finish };
}

function measuredSpanDays(durationDays: number, gaps: readonly TaskSplitGap[], engine: CalendarEngine): number {
  if (gaps.length === 0) return durationDays;
  const workMinutes = durationDays * engine.hoursPerDay * 60;
  return durationDays + (splitTotalSpanMinutes(gaps, workMinutes) - workMinutes) / (engine.hoursPerDay * 60);
}

function workOffset(bands: ReadonlyArray<{ start: number; end: number }>, dayMs: number, tMs: number): number {
  let offset = 0;
  for (const b of bands) {
    const from = dayMs + b.start * 60_000;
    if (tMs <= from) break;
    offset += (Math.min(dayMs + b.end * 60_000, tMs) - from) / 60_000;
  }
  return offset;
}

function momentAtOffset(
  engine: CalendarEngine,
  bands: ReadonlyArray<{ start: number; end: number }>,
  dayMs: number,
  offset: number,
): Date {
  if (offset <= 0) return engine.prevWorkInstant(new Date(dayMs + bands[0].start * 60_000));
  let left = offset;
  for (const b of bands) {
    const len = b.end - b.start;
    if (left <= len) return new Date(dayMs + (b.start + left) * 60_000);
    left -= len;
  }
  return new Date(dayMs + bands[bands.length - 1].end * 60_000);
}

export function hasManualPlacement(task: Pick<Task, 'manuallyScheduled'>): boolean {
  return task.manuallyScheduled === true;
}

export function placementFollowsSpan(task: Task): boolean {
  const t = task.time;
  return t.durationType === 'ELAPSEDTIME' || isPinnedComplete(t) || isPinnedInProgress(t)
    || hasManualPlacement(task) || task.isHammock === true;
}

export function taskWorkPlacement(
  task: Task,
  engine: CalendarEngine,
  options: PlacementOptions,
  start?: Date,
): WorkPlacement | null {
  const t = task.time;
  const anchor = parseInstant(t.earlyStart ?? '');
  const from = start ?? anchor;
  if (!Number.isFinite(from.getTime())) return null;
  const measure: PlacementMeasure = taskCountsInWorkdays(task, options) ? 'workdays' : 'minutes';
  if (placementFollowsSpan(task)) {
    const elapsed = t.durationType === 'ELAPSEDTIME';
    const finish = spanFinish(t.earlyFinish ?? '', engine, elapsed);
    if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(finish.getTime())) return null;
    const keepsGaps = !elapsed && !isPinnedComplete(t);
    const gaps = keepsGaps && task.splitGaps ? { gaps: task.splitGaps } : {};
    const shift = from.getTime() - anchor.getTime();
    if (shift === 0 || elapsed) return { start: from, finish: new Date(finish.getTime() + shift), measure, ...gaps };
    const span = workPlacement(engine, { start: anchor, finish, measure, ...gaps });
    const amount = span.days.reduce((sum, d) => sum + (measure === 'workdays' ? d.share : d.minutes), 0);
    return { start: from, duration: amount, measure, ...gaps };
  }
  const duration = measure === 'workdays' ? t.scheduleDuration : durationMinutesOf(task, engine);
  return { start: from, duration, measure, ...(task.splitGaps ? { gaps: task.splitGaps } : {}) };
}

function spanFinish(
  value: string,
  engine: Pick<CalendarEngine, 'effectiveBandsOn' | 'typicalWorkdayBands'>,
  elapsed: boolean,
): Date {
  const parsed = parseInstant(value);
  if (!isDateOnly(value) || !Number.isFinite(parsed.getTime())) return parsed;
  if (elapsed) return addCalendarDays(parsed, 1);
  const own = engine.effectiveBandsOn(parsed);
  const bands = own.length > 0 ? own : engine.typicalWorkdayBands();
  return bands.length > 0
    ? new Date(parsed.getTime() + bands[bands.length - 1].end * 60_000)
    : addCalendarDays(parsed, 1);
}

export function assignmentPlacementLoad(
  assignment: ResourceAssignment,
  days: readonly PlacementDay[],
  mpd: number,
  contour: TaskTimephasedContour | null,
  slots: () => readonly number[],
): number[] {
  if (contour && contour.periods.length > 0) return contourCut(days, mpd, contour).units;
  const totalShare = days.reduce((sum, d) => sum + d.share, 0);
  if (!(totalShare > 0)) return days.map(() => 0);
  const uniform = (): number[] => days.map(d => d.share * assignment.unitsPerDay);
  if (!assignment.curveValues && assignment.remainingWorkMinutes === undefined
    && (!assignment.curve || assignment.curve === 'UNIFORM')) {
    return uniform();
  }
  const source = slots();
  const storedWork = assignment.remainingWorkMinutes !== undefined && Number.isFinite(assignment.remainingWorkMinutes);
  const sourceTotal = source.reduce((sum, u) => sum + u, 0);
  if (!storedWork && !(sourceTotal > 0)) return uniform();
  const scale = storedWork ? capacityFraction(days) : assignment.unitsPerDay * totalShare / sourceTotal;
  let position = 0;
  return days.map(d => {
    const end = position + d.share / totalShare * source.length;
    let load = 0;
    for (let i = Math.floor(position); i < Math.min(source.length, Math.ceil(end)); i++) {
      load += source[i] * Math.max(0, Math.min(end, i + 1) - Math.max(position, i));
    }
    position = end;
    return load * scale;
  });
}
