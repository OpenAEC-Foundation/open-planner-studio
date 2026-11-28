import type { TaskSplitGap } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface SplitSegmentBounds {
  start: Date;
  end: Date;
}

export function computeSplitSegments(
  gaps: TaskSplitGap[] | undefined,
  taskStart: Date,
  taskEnd: Date,
  measure: boolean | 'workdays',
  eng: CalendarEngine,
): SplitSegmentBounds[] {
  if (!gaps || gaps.length === 0) return [{ start: taskStart, end: taskEnd }];
  if (taskEnd.getTime() <= taskStart.getTime()) return [{ start: taskStart, end: taskEnd }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const minutesPerDay = Math.max(1, eng.hoursPerDay * 60);
  const endMs = taskEnd.getTime();

  const workdays = measure === 'workdays' && eng.isHourMode;
  const walk = (from: Date, minutes: number): Date => {
    if (minutes <= 0) return from;
    const to = workdays
      ? eng.addMeasuredWorkdays(from, minutes / minutesPerDay)
      : measure === true
        ? eng.addWorkMinutes(from, minutes)
        : (() => {
            const days = Math.round(minutes / minutesPerDay);
            return days > 0 ? eng.addWorkingDaysSigned(from, days) : from;
          })();
    return to.getTime() > endMs ? taskEnd : to;
  };
  const boundary = (at: Date): Date => {
    if (!workdays) return at;
    const next = eng.nextWorkInstant(at);
    return next.getTime() > endMs ? taskEnd : next;
  };

  const segments: SplitSegmentBounds[] = [];
  let cursor = taskStart;
  let axisPos = 0;
  for (const gap of sorted) {
    if (!Number.isFinite(gap.afterMinutes) || !Number.isFinite(gap.gapMinutes) || gap.gapMinutes <= 0) continue;
    const gapStartAxis = Math.max(gap.afterMinutes, axisPos);
    const gapEndAxis = gap.afterMinutes + gap.gapMinutes;
    if (gapEndAxis <= gapStartAxis) continue;
    const workBefore = gapStartAxis - axisPos;
    if (workBefore > 0 || segments.length === 0) {
      const gapStart = boundary(walk(cursor, workBefore));
      segments.push({ start: cursor, end: gapStart });
      cursor = gapStart;
    }
    cursor = boundary(walk(cursor, gapEndAxis - gapStartAxis));
    axisPos = gapEndAxis;
  }
  segments.push({ start: cursor, end: taskEnd });
  return segments;
}

export function splitDayPattern(
  gaps: TaskSplitGap[] | undefined,
  minutesPerDay: number,
  durationDays: number,
): Array<{ work: number; gap: number }> {
  if (durationDays <= 0) return [{ work: 0, gap: 0 }];
  if (!gaps || gaps.length === 0) return [{ work: durationDays, gap: 0 }];
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  const mpd = Math.max(1, minutesPerDay);
  const blocks: Array<{ work: number; gap: number }> = [];
  let axisPos = 0;
  let used = 0;
  for (const g of sorted) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || g.gapMinutes <= 0) continue;
    const gapStartAxis = Math.max(g.afterMinutes, axisPos);
    const gapEndAxis = g.afterMinutes + g.gapMinutes;
    if (gapEndAxis <= gapStartAxis) continue;
    const work = Math.min(Math.max(0, Math.round((gapStartAxis - axisPos) / mpd)), durationDays - used);
    const gap = Math.max(0, Math.round((gapEndAxis - gapStartAxis) / mpd));
    if (work > 0 || blocks.length === 0) {
      blocks.push({ work, gap });
    } else {
      blocks[blocks.length - 1].gap += gap;
    }
    used += work;
    axisPos = gapEndAxis;
  }
  blocks.push({ work: Math.max(0, durationDays - used), gap: 0 });
  return blocks;
}

export function splitGapsFromWorkDayBlocks(
  blocks: Array<{ work: number; gap: number }>,
  minutesPerDay: number,
  source?: 'leveling' | 'user',
): TaskSplitGap[] {
  const mpd = Math.max(1, minutesPerDay);
  const gaps: TaskSplitGap[] = [];
  let axisPos = 0;
  for (const b of blocks) {
    const work = Math.max(0, Math.round(b.work));
    const gap = Math.max(0, Math.round(b.gap));
    axisPos += work * mpd;
    if (gap > 0) {
      gaps.push(source ? { afterMinutes: axisPos, gapMinutes: gap * mpd, source } : { afterMinutes: axisPos, gapMinutes: gap * mpd });
      axisPos += gap * mpd;
    }
  }
  return gaps;
}

export function enumerateTaskWorkDays(
  gaps: TaskSplitGap[] | undefined,
  engine: CalendarEngine,
  startIso: string,
  durationDays: number,
): string[] {
  const blocks = splitDayPattern(gaps, engine.hoursPerDay * 60, durationDays);
  const isos: string[] = [];
  let current = parseDate(startIso);
  let guard = 0;
  const MAX_DAYS = 200_000;
  const consumeWorkDays = (n: number, collect: boolean) => {
    let taken = 0;
    while (taken < n && guard++ < MAX_DAYS) {
      if (engine.isWorkDay(current)) {
        if (collect) isos.push(formatDate(current));
        taken++;
      }
      current = addCalendarDays(current, 1);
    }
  };
  for (const b of blocks) {
    consumeWorkDays(b.work, true);
    consumeWorkDays(b.gap, false);
  }
  return isos;
}
