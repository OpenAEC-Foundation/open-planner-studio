// Bron: MPXJ `MSPDIReader`, `MSPDIWriter` en `TimephasedHelper` als referentie voor de MSPDI- en P6-vorm van tijdgefaseerd werk (LGPL-2.1, github.com/joniles/mpxj).
import type { Task, TaskSplitGap, TaskTimephasedContour, TimephasedContourPeriod } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { periodsToSlotWork } from '@/engine/contour/contourEngine';
import { addCalendarDays, formatDate, utcDayStart } from '@/utils/dateUtils';
import { isSummaryTask } from '@/utils/taskHierarchy';

export type ContourKind = TimephasedContourPeriod['kind'];

export function countSplitTasksWithoutContour(tasks: readonly Task[]): number {
  return tasks.filter(t => t.splitGaps && t.splitGaps.length > 0
    && !(t.timephasedContours && t.timephasedContours.length > 0)).length;
}

export interface AbsoluteWorkItem {
  start: Date;
  finish: Date;
  workMinutes: number;
  kind: ContourKind;
}

export function slotMinutesOf(engine: CalendarEngine): number {
  return Math.max(1, engine.hoursPerDay * 60);
}

function hasTimeOfDay(d: Date): boolean {
  return d.getTime() !== utcDayStart(d).getTime();
}

export function axisOffsetMinutes(engine: CalendarEngine, taskStart: Date, at: Date, inclusiveDay = false): number {
  if (engine.isHourMode) return Math.max(0, engine.workMinutesBetween(taskStart, at));
  const mpd = slotMinutesOf(engine);
  const startDay = utcDayStart(taskStart);
  const atDay = utcDayStart(at);
  if (atDay.getTime() < startDay.getTime()) return 0;
  const before = engine.workDaysBetween(startDay, addCalendarDays(atDay, -1));
  const own = inclusiveDay && hasTimeOfDay(at) && engine.isWorkDay(atDay) ? 1 : 0;
  return (before + own) * mpd;
}

export function absoluteItemsToContourPeriods(
  engine: CalendarEngine,
  taskStart: Date,
  items: readonly AbsoluteWorkItem[],
): TimephasedContourPeriod[] {
  const out: TimephasedContourPeriod[] = [];
  for (const it of items) {
    if (isNaN(it.start.getTime()) || isNaN(it.finish.getTime()) || !Number.isFinite(it.workMinutes)) continue;
    const after = axisOffsetMinutes(engine, taskStart, it.start, false);
    const end = axisOffsetMinutes(engine, taskStart, it.finish, true);
    const minutes = end - after;
    if (!(minutes > 0)) continue;
    out.push({ afterMinutes: after, minutes, workMinutes: Math.max(0, it.workMinutes), kind: it.kind });
  }
  out.sort((a, b) => a.afterMinutes - b.afterMinutes || a.minutes - b.minutes);
  return out;
}

export function splitGapsFromContours(contours: readonly (readonly TimephasedContourPeriod[])[]): TaskSplitGap[] {
  return intersectAssignmentGaps(contours.map((periods) => gapsBetweenWorkedSpans(
    periods
      .filter((p) => p.workMinutes !== 0 && Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes))
      .map((p) => ({ start: p.afterMinutes, end: p.afterMinutes + p.minutes })),
  )));
}

export function collectContour(
  contoursByTaskId: Map<string, TaskTimephasedContour[]>, taskId: string, contour: TaskTimephasedContour,
): void {
  const list = contoursByTaskId.get(taskId);
  if (list) list.push(contour);
  else contoursByTaskId.set(taskId, [contour]);
}

export function attachContours(
  taskById: ReadonlyMap<string, Task>, contoursByTaskId: ReadonlyMap<string, TaskTimephasedContour[]>,
): void {
  for (const [taskId, contours] of contoursByTaskId) {
    const task = taskById.get(taskId);
    if (!task || isSummaryTask(task)) continue;
    task.timephasedContours = contours;
    if (!task.splitGaps || task.splitGaps.length === 0) {
      const gaps = splitGapsFromContours(contours.map(c => c.periods));
      if (gaps.length > 0) task.splitGaps = gaps;
    }
  }
}

export function gapsBetweenWorkedSpans(spans: readonly { start: number; end: number }[]): TaskSplitGap[] {
  const worked = spans.slice().sort((a, b) => a.start - b.start);
  const gaps: TaskSplitGap[] = [];
  for (let i = 1; i < worked.length; i++) {
    const prevEnd = worked[i - 1].end;
    const nextStart = worked[i].start;
    if (nextStart > prevEnd) gaps.push({ afterMinutes: prevEnd, gapMinutes: nextStart - prevEnd });
  }
  return gaps;
}

export function intersectAssignmentGaps(gapsByAssignment: readonly (readonly TaskSplitGap[])[]): TaskSplitGap[] {
  if (gapsByAssignment.length === 0) return [];
  return gapsByAssignment.slice(1).reduce<TaskSplitGap[]>(
    (acc, gaps) => intersectGapIntervals(acc, gaps),
    [...gapsByAssignment[0]],
  );
}

function intersectGapIntervals(a: readonly TaskSplitGap[], b: readonly TaskSplitGap[]): TaskSplitGap[] {
  const result: TaskSplitGap[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aStart = a[i].afterMinutes;
    const aEnd = aStart + a[i].gapMinutes;
    const bStart = b[j].afterMinutes;
    const bEnd = bStart + b[j].gapMinutes;
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    if (start < end) result.push({ afterMinutes: start, gapMinutes: end - start });
    if (aEnd < bEnd) i++; else j++;
  }
  return result;
}

export interface ContourDayItem {
  iso: string;
  start: Date;
  finish: Date;
  workMinutes: number;
  kind: ContourKind;
}

export function contourPeriodsToDayItems(
  engine: CalendarEngine,
  calendar: WorkCalendar,
  taskStart: Date,
  periods: readonly TimephasedContourPeriod[],
): ContourDayItem[] {
  const mpd = slotMinutesOf(engine);
  const kinds: ContourKind[] = ['actual', 'remaining'];
  const out: ContourDayItem[] = [];
  for (const kind of kinds) {
    const own = periods.filter((p) => p.kind === kind);
    if (own.length === 0) continue;
    const slots = periodsToSlotWork(own, mpd, 0);
    let first = -1;
    let last = -1;
    for (let k = 0; k < slots.length; k++) {
      if (slots[k] > 0) { if (first < 0) first = k; last = k; }
    }
    if (first < 0) continue;
    let day = utcDayStart(taskStart);
    let k = 0;
    let guard = 0;
    while (k <= last && guard++ < 200_000) {
      if (engine.isWorkDay(day)) {
        if (k >= first) {
          const { start, finish } = dayInstants(engine, calendar, day);
          out.push({ iso: formatDate(day), start, finish, workMinutes: slots[k], kind });
        }
        k++;
      }
      day = addCalendarDays(day, 1);
    }
  }
  return out;
}

function dayInstants(engine: CalendarEngine, calendar: WorkCalendar, day: Date): { start: Date; finish: Date } {
  const base = utcDayStart(day).getTime();
  if (engine.isHourMode) {
    const bands = engine.effectiveBandsOn(day);
    if (bands.length > 0) {
      return {
        start: new Date(base + bands[0].start * 60_000),
        finish: new Date(base + bands[bands.length - 1].end * 60_000),
      };
    }
  }
  const sh = Number.isFinite(calendar.workStartHour) ? calendar.workStartHour : 8;
  const eh = Number.isFinite(calendar.workEndHour) ? calendar.workEndHour : 17;
  return { start: new Date(base + sh * 3_600_000), finish: new Date(base + eh * 3_600_000) };
}

export function p6SpreadToContourPeriods(spread: string, anchorOffsetMinutes: number, kind: ContourKind): TimephasedContourPeriod[] {
  if (!spread || spread.indexOf(':') === -1) return [];
  const out: TimephasedContourPeriod[] = [];
  let cursor = Math.max(0, anchorOffsetMinutes);
  for (const item of spread.split(';')) {
    const parts = item.split(':');
    if (parts.length !== 2) return [];
    const work = parseFloat(parts[0]);
    const period = parseFloat(parts[1]);
    if (!Number.isFinite(work) || !Number.isFinite(period) || period <= 0 || work < 0) return [];
    out.push({ afterMinutes: cursor, minutes: period * 60, workMinutes: work * 60, kind });
    cursor += period * 60;
  }
  return out;
}

export function contourPeriodsToP6Spread(periods: readonly TimephasedContourPeriod[], anchorOffsetMinutes = 0): string | null {
  const sorted = periods
    .filter((p) => Number.isFinite(p.afterMinutes) && Number.isFinite(p.minutes) && p.minutes > 0)
    .sort((a, b) => a.afterMinutes - b.afterMinutes);
  if (sorted.length === 0) return null;
  const parts: string[] = [];
  let cursor = Math.max(0, anchorOffsetMinutes);
  for (const p of sorted) {
    const start = Math.max(p.afterMinutes, cursor);
    if (start > cursor + 1e-9) parts.push(`0:${fmtHours(start - cursor)}`);
    const end = p.afterMinutes + p.minutes;
    const len = end - start;
    if (len <= 0) continue;
    parts.push(`${fmtHours(Math.max(0, p.workMinutes))}:${fmtHours(len)}`);
    cursor = end;
  }
  return parts.length > 0 ? parts.join(';') : null;
}

function fmtHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return String(h);
}

export function mspdiValueToMinutes(value: string): number | null {
  if (!value) return null;
  const m = value.match(/^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const days = parseFloat(m[1] || '0');
  const hours = parseFloat(m[2] || '0');
  const mins = parseFloat(m[3] || '0');
  const secs = parseFloat(m[4] || '0');
  return days * 24 * 60 + hours * 60 + mins + secs / 60;
}

export function minutesToMspdiValue(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `PT${h}H${m}M${s}S`;
}
