import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { MS_PER_DAY, utcDayIndex } from '@/utils/dateUtils';
import { dateToX as calendarDateToX, xToDate as calendarXToDate, GanttAxis } from './timeAxis';

export interface CalendarAxisOptions {
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

export function buildCalendarAxis(options: CalendarAxisOptions): GanttAxis {
  const { origin, chartOriginX, zoom, scrollX } = options;
  return {
    dateToX: (date: Date) => calendarDateToX(date, origin, chartOriginX, zoom, scrollX),
    xToDate: (x: number) => calendarXToDate(x, origin, chartOriginX, zoom, scrollX),
    daySpan: (from: Date, to: Date) => (to.getTime() - from.getTime()) / MS_PER_DAY,
    dayIndexOf: (date: Date) => (date.getTime() - origin.getTime()) / MS_PER_DAY,
    dateAtIndex: (index: number) => new Date(origin.getTime() + index * MS_PER_DAY),
  };
}

function dateFromUtcDayIndex(dayIdx: number): Date {
  return new Date(dayIdx * MS_PER_DAY);
}

const EPOCH = new Date(0);

export interface WorkdayAxisOptions {
  calendar: CalendarEngine;
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
  initialPaddingDays?: number;
}

const DEFAULT_INITIAL_PADDING_DAYS = 30;
const GROWTH_CHUNK_DAYS = 400;
const MAX_WINDOW_DAYS = 50_000;

export function buildWorkdayAxis(options: WorkdayAxisOptions): GanttAxis {
  const { calendar, origin, chartOriginX, zoom, scrollX } = options;
  const initialPadding = options.initialPaddingDays ?? DEFAULT_INITIAL_PADDING_DAYS;

  if (!calendar.hasWorkingDays()) {
    throw new Error(
      'buildWorkdayAxis: kalender heeft geen enkele werkdag (hasWorkingDays()===false) — ' +
        'de werkdagen-as kan niet gebouwd worden. Val terug op buildCalendarAxis().',
    );
  }

  let windowStart = 0;
  let windowEnd = -1;
  let prefix: Uint32Array = new Uint32Array(0);
  let workDayList: number[] = [];
  let preWindowCount = 0;

  function buildWindow(start: number, end: number): void {
    const len = end - start + 1;
    const nextPrefix = new Uint32Array(len);
    const nextWorkDayList: number[] = [];
    let count = 0;
    for (let k = 0; k < len; k++) {
      const dIdx = start + k;
      if (dIdx >= 0 && calendar.isWorkDay(dateFromUtcDayIndex(dIdx))) {
        count++;
        nextWorkDayList.push(dIdx);
      }
      nextPrefix[k] = count;
    }
    windowStart = start;
    windowEnd = end;
    prefix = nextPrefix;
    workDayList = nextWorkDayList;
    preWindowCount = start > 0 ? calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(start - 1)) : 0;
  }

  buildWindow(utcDayIndex(origin.getTime()) - initialPadding, utcDayIndex(origin.getTime()) + initialPadding);

  function ensureContainsDay(dayIdx: number): boolean {
    if (dayIdx >= windowStart && dayIdx <= windowEnd) return true;
    let newStart = windowStart;
    let newEnd = windowEnd;
    if (dayIdx < newStart) newStart = dayIdx - GROWTH_CHUNK_DAYS;
    if (dayIdx > newEnd) newEnd = dayIdx + GROWTH_CHUNK_DAYS;
    if (newEnd - newStart + 1 > MAX_WINDOW_DAYS) return false;
    buildWindow(newStart, newEnd);
    return true;
  }

  function countThroughDay(dayIdx: number): number {
    if (ensureContainsDay(dayIdx)) {
      return preWindowCount + prefix[dayIdx - windowStart];
    }
    return calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(dayIdx));
  }

  function workdayIndexOfDay(dayIdx: number): number {
    const isWork = calendar.isWorkDay(dateFromUtcDayIndex(dayIdx));
    return countThroughDay(dayIdx) - (isWork ? 1 : 0);
  }

  function intraDayFraction(date: Date, dayIdx: number): number {
    if (!calendar.isWorkDay(date)) return 0;
    const dayStartMs = dayIdx * MS_PER_DAY;
    return (date.getTime() - dayStartMs) / MS_PER_DAY;
  }

  function fractionalIndexOf(date: Date): number {
    const dIdx = utcDayIndex(date.getTime());
    return workdayIndexOfDay(dIdx) + intraDayFraction(date, dIdx);
  }

  const originIndex = fractionalIndexOf(origin);

  function dayAtWorkdayIndex(index: number): number {
    while (index < preWindowCount || index >= preWindowCount + workDayList.length) {
      const needForward = index >= preWindowCount + workDayList.length;
      const newStart = needForward ? windowStart : windowStart - GROWTH_CHUNK_DAYS;
      const newEnd = needForward ? windowEnd + GROWTH_CHUNK_DAYS : windowEnd;
      if (newEnd - newStart + 1 > MAX_WINDOW_DAYS) {
        return utcDayIndex(calendar.addWorkDays(EPOCH, index + 1).getTime());
      }
      buildWindow(newStart, newEnd);
    }
    return workDayList[index - preWindowCount];
  }

  const axis: GanttAxis = {
    dateToX(date: Date): number {
      const idx = fractionalIndexOf(date);
      return chartOriginX + (idx - originIndex) * zoom - scrollX;
    },
    xToDate(x: number): Date {
      const floatIdx = (x - chartOriginX + scrollX) / zoom + originIndex;
      const wholeIdx = Math.floor(floatIdx);
      const frac = floatIdx - wholeIdx;
      const dayIdx = dayAtWorkdayIndex(wholeIdx);
      return new Date(dayIdx * MS_PER_DAY + frac * MS_PER_DAY);
    },
    daySpan(from: Date, to: Date): number {
      return fractionalIndexOf(to) - fractionalIndexOf(from);
    },
    dayIndexOf(date: Date): number {
      return fractionalIndexOf(date);
    },
    dateAtIndex(index: number): Date {
      const wholeIdx = Math.floor(index);
      const frac = index - wholeIdx;
      const dayIdx = dayAtWorkdayIndex(wholeIdx);
      return new Date(dayIdx * MS_PER_DAY + frac * MS_PER_DAY);
    },
  };
  return axis;
}

export interface ResolveGanttAxisOptions {
  calendar: CalendarEngine;
  compressNonWorkdays: boolean;
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

export function isCompressedEffective(calendar: CalendarEngine, compressNonWorkdays: boolean): boolean {
  return compressNonWorkdays && calendar.hasWorkingDays();
}

export function resolveGanttAxis(options: ResolveGanttAxisOptions): GanttAxis {
  const { calendar, compressNonWorkdays, origin, chartOriginX, zoom, scrollX } = options;
  if (compressNonWorkdays) {
    if (calendar.hasWorkingDays()) {
      return buildWorkdayAxis({ calendar, origin, chartOriginX, zoom, scrollX });
    }
    console.warn(
      'compressNonWorkdays: de kalender heeft geen enkele werkdag — val terug op de kalender-as ' +
        '(issue #21 punt 5, randgeval §9.4).',
    );
  }
  return buildCalendarAxis({ origin, chartOriginX, zoom, scrollX });
}
