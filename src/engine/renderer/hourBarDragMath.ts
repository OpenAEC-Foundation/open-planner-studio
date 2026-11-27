import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addElapsedMinutes, splitTotalSpanMinutes, subtractElapsedMinutes } from '@/engine/scheduler/duration';
import { toSplitPieces } from '@/engine/scheduler/splitEdit';
import type { MilestoneKind, TaskSplitGap } from '@/types/task';
import { addCalendarDays } from '@/utils/dateUtils';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';

export type DragClock = Pick<CalendarEngine, 'nextWorkInstant' | 'addWorkMinutes' | 'subtractWorkMinutes' | 'workMinutesBetween'>;

export const ELAPSED_DRAG_CLOCK: DragClock = {
  nextWorkInstant: t => new Date(t.getTime()),
  addWorkMinutes: addElapsedMinutes,
  subtractWorkMinutes: subtractElapsedMinutes,
  workMinutesBetween: (a, b) => (b.getTime() - a.getTime()) / 60_000,
};

function splitSpan(work: number, gaps: readonly TaskSplitGap[] | undefined, unit: number): number {
  if (!gaps || gaps.length === 0) return work;
  const minutes = work * unit;
  return work + (splitTotalSpanMinutes(gaps, minutes) - minutes) / unit;
}

function lastWorkPiece(work: number, gaps: readonly TaskSplitGap[] | undefined, unit: number): number {
  const pieces = gaps && gaps.length > 0 ? toSplitPieces(gaps, work * unit) : null;
  return pieces ? pieces[pieces.length - 1].minutes / unit : work;
}

export interface HourBarDragInput {
  calendar: DragClock;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  originalDurationMinutes: number;
  splitGaps?: readonly TaskSplitGap[];
  pointerStart: Date;
  pointerCurrent: Date;
  snapMinutes: number;
}

export interface HourBarDragResult {
  start: Date;
  finish: Date;
  durationMinutes: number;
}

function snappedDeltaMs(from: Date, to: Date, snapMinutes: number): number {
  const quantumMs = Math.max(1, snapMinutes) * 60_000;
  return Math.round((to.getTime() - from.getTime()) / quantumMs) * quantumMs;
}

export function resolveHourBarDrag(input: HourBarDragInput): HourBarDragResult {
  const {
    calendar,
    edge,
    originalStart,
    originalFinish,
    originalDurationMinutes,
    splitGaps,
    pointerStart,
    pointerCurrent,
    snapMinutes,
  } = input;
  const deltaMs = snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  const durationMinutes = Math.max(1, Math.round(originalDurationMinutes));
  const minimumResizeMinutes = snapMinutes <= 15 ? 15 : 60;
  const span = (minutes: number) => splitSpan(minutes, splitGaps, 1);
  const gapMinutes = span(durationMinutes) - durationMinutes;
  const minimumMinutes = durationMinutes - lastWorkPiece(durationMinutes, splitGaps, 1) + minimumResizeMinutes;

  if (edge === 'body') {
    const candidate = new Date(originalStart.getTime() + deltaMs);
    const start = calendar.nextWorkInstant(candidate);
    return {
      start,
      finish: calendar.addWorkMinutes(start, span(durationMinutes)),
      durationMinutes,
    };
  }

  if (edge === 'right') {
    const candidate = calendar.nextWorkInstant(new Date(originalFinish.getTime() + deltaMs));
    const nextDuration = Math.max(
      minimumMinutes,
      Math.round(calendar.workMinutesBetween(originalStart, candidate) - gapMinutes),
    );
    return {
      start: new Date(originalStart.getTime()),
      finish: calendar.addWorkMinutes(originalStart, span(nextDuration)),
      durationMinutes: nextDuration,
    };
  }

  const candidate = calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
  const nextDuration = Math.max(
    minimumMinutes,
    Math.round(calendar.workMinutesBetween(candidate, originalFinish) - gapMinutes),
  );
  return {
    start: calendar.subtractWorkMinutes(originalFinish, span(nextDuration)),
    finish: new Date(originalFinish.getTime()),
    durationMinutes: nextDuration,
  };
}

export interface DayMeasureBarDragInput {
  calendar: CalendarEngine;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  originalDays: number;
  splitGaps?: readonly TaskSplitGap[];
  workdaySteps?: number;
  pointerStart: Date;
  pointerCurrent: Date;
  snapMinutes: number;
}

export interface DayMeasureBarDragResult {
  start: Date;
  finish: Date;
  days: number;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function shiftByWorkdays(calendar: CalendarEngine, start: Date, steps: number): Date {
  const from = calendar.nextWorkInstant(start);
  if (steps > 0) return calendar.nextWorkInstant(calendar.addMeasuredWorkdays(from, steps));
  if (steps < 0) return calendar.subtractMeasuredWorkdays(from, -steps);
  return from;
}

export function resolveDayMeasureBarDrag(input: DayMeasureBarDragInput): DayMeasureBarDragResult {
  const { calendar, edge, originalStart, originalFinish, originalDays, splitGaps, workdaySteps, pointerStart, pointerCurrent, snapMinutes } = input;
  const dayZoom = workdaySteps !== undefined;
  const steps = workdaySteps ?? 0;
  const deltaMs = dayZoom ? 0 : snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  const days0 = Math.max(0, originalDays);
  const dayMinutes = Math.max(1, calendar.hoursPerDay * 60);
  const span = (days: number) => splitSpan(days, splitGaps, dayMinutes);
  const gapDays = span(days0) - days0;
  const lastPiece = lastWorkPiece(days0, splitGaps, dayMinutes);
  const minimumDays = round6(days0 - lastPiece + (dayZoom ? Math.min(1, lastPiece) : (snapMinutes <= 15 ? 15 : 60) / dayMinutes));

  if (edge === 'body') {
    const start = dayZoom
      ? shiftByWorkdays(calendar, originalStart, steps)
      : calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
    return { start, finish: calendar.addMeasuredWorkdays(start, span(days0)), days: days0 };
  }

  if (edge === 'right') {
    const start = calendar.nextWorkInstant(originalStart);
    const raw = dayZoom
      ? days0 + steps
      : calendar.measuredWorkdaysBetween(start, new Date(originalFinish.getTime() + deltaMs)) - gapDays;
    const days = round6(Math.max(minimumDays, raw));
    return { start: new Date(originalStart.getTime()), finish: calendar.addMeasuredWorkdays(start, span(days)), days };
  }

  const raw = dayZoom
    ? days0 - steps
    : calendar.measuredWorkdaysBetween(calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs)), originalFinish) - gapDays;
  const days = round6(Math.max(minimumDays, raw));
  return { start: calendar.subtractMeasuredWorkdays(originalFinish, span(days)), finish: new Date(originalFinish.getTime()), days };
}

function worksOn(calendar: CalendarEngine, day: Date): boolean {
  return calendar.isHourMode ? calendar.effectiveBandsOn(day).length > 0 : calendar.isWorkDay(day);
}

export function milestoneSitsAtFinish(
  calendar: CalendarEngine,
  original: Date,
  milestoneKind: MilestoneKind | undefined,
  drivenByPredecessor: boolean,
  looseAtDayEnd: boolean,
): boolean {
  if (milestoneKind === 'FINISH') return true;
  if (drivenByPredecessor) return false;
  if (looseAtDayEnd) return true;
  return !calendar.isWorkInstant(original) && calendar.prevWorkInstant(original).getTime() === original.getTime();
}

const landOn = (calendar: CalendarEngine, t: Date, finishSide: boolean): Date =>
  finishSide ? calendar.prevWorkInstant(t) : calendar.nextWorkInstant(t);

export function resolveMilestoneHourDrag(input: {
  calendar: CalendarEngine;
  original: Date;
  finishSide: boolean;
  candidate: Date;
  snapMinutes: number;
}): Date {
  const { calendar, original, finishSide, candidate, snapMinutes } = input;
  const deltaMs = snappedDeltaMs(original, candidate, snapMinutes);
  if (deltaMs === 0) return new Date(original.getTime());
  return landOn(calendar, new Date(original.getTime() + deltaMs), finishSide);
}

export function resolveMilestoneDayDrag(input: {
  calendar: CalendarEngine;
  original: Date;
  finishSide: boolean;
  workdaySteps: number;
}): Date {
  const { calendar, original, finishSide, workdaySteps } = input;
  if (workdaySteps === 0) return new Date(original.getTime());
  const from = workdayDateOfInstant(calendar, original, finishSide ? 'end' : 'start');
  const direction = Math.sign(workdaySteps);
  let day = from;
  for (let left = Math.abs(workdaySteps), i = 0; left > 0 && i < 3660; i++) {
    day = addCalendarDays(day, direction);
    if (worksOn(calendar, day)) left--;
  }
  const offset = (original.getTime() - from.getTime()) / 60_000;
  const bands = calendar.effectiveBandsOn(day);
  if (bands.length === 0) return new Date(day.getTime() + offset * 60_000);
  const fromBands = calendar.effectiveBandsOn(from);
  const onBoundary = fromBands.length === 0 || fromBands.some(band => band.start === offset || band.end === offset);
  const target = onBoundary ? (finishSide ? bands[bands.length - 1].end : bands[0].start) : offset;
  return landOn(calendar, new Date(day.getTime() + target * 60_000), finishSide);
}

export function milestoneDragLanding(calendar: CalendarEngine, at: Date, looseAtDayEnd: boolean, stepMinutes: number): Date {
  if (!looseAtDayEnd || !calendar.isWorkInstant(at)) return at;
  const workday = workdayDateOfInstant(calendar, at, 'end');
  const bands = calendar.effectiveBandsOn(workday);
  if (bands.length === 0 || workday.getTime() + bands[bands.length - 1].end * 60_000 !== at.getTime()) return at;
  const later = new Date(at.getTime() + stepMinutes * 60_000);
  return calendar.isWorkInstant(later) ? later : calendar.prevWorkInstant(later);
}
