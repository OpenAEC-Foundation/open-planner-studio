import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { parseDate, addCalendarDays, diffCalendarDays, formatDate, utcDayIndex } from '@/utils/dateUtils';

export interface FreePeriod {
  start: string;
  end: string;
  days: number;
  name?: string;
}

const MAX_EXPAND_SCAN = 400;

export function findLongFreePeriods(
  calendar: WorkCalendar,
  startIso: string | undefined,
  finishIso: string | undefined,
  minDays = 8,
): FreePeriod[] {
  if (!startIso || !finishIso) return [];

  const start = parseDate(startIso);
  const finish = parseDate(finishIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return [];
  if (finish.getTime() < start.getTime()) return [];

  const engine = new CalendarEngine(calendar);
  if (!engine.hasWorkingDays()) return [];

  const totalTaskDays = diffCalendarDays(start, finish) + 1;
  const results: FreePeriod[] = [];
  let lastPeriodEndIdx = -Infinity;

  let cursor = new Date(start.getTime());
  for (let i = 0; i < totalTaskDays; i++) {
    const dayIdx = utcDayIndex(cursor.getTime());
    if (dayIdx <= lastPeriodEndIdx) {
      cursor = addCalendarDays(cursor, 1);
      continue;
    }
    if (!engine.isWorkDay(cursor)) {
      let periodStart = new Date(cursor.getTime());
      for (let scan = 0; scan < MAX_EXPAND_SCAN; scan++) {
        const prev = addCalendarDays(periodStart, -1);
        if (engine.isWorkDay(prev)) break;
        periodStart = prev;
      }
      let periodEnd = new Date(cursor.getTime());
      for (let scan = 0; scan < MAX_EXPAND_SCAN; scan++) {
        const next = addCalendarDays(periodEnd, 1);
        if (engine.isWorkDay(next)) break;
        periodEnd = next;
      }

      const days = diffCalendarDays(periodStart, periodEnd) + 1;
      if (days >= minDays) {
        const { hasHolidayException, name } = analyzeHolidayOverlap(calendar, periodStart, periodEnd, days);
        if (hasHolidayException) {
          results.push({ start: formatDate(periodStart), end: formatDate(periodEnd), days, name });
        }
      }
      lastPeriodEndIdx = utcDayIndex(periodEnd.getTime());
    }
    cursor = addCalendarDays(cursor, 1);
  }

  return results;
}

function analyzeHolidayOverlap(
  calendar: WorkCalendar,
  periodStart: Date,
  periodEnd: Date,
  periodDays: number,
): { hasHolidayException: boolean; name?: string } {
  let bestOverlapDays = 0;
  let bestName: string | undefined;
  let hasHolidayException = false;

  for (const holiday of calendar.holidays) {
    const hStart = parseDate(holiday.startDate);
    const hEnd = parseDate(holidayEndDate(holiday));
    const overlapStart = hStart.getTime() > periodStart.getTime() ? hStart : periodStart;
    const overlapEnd = hEnd.getTime() < periodEnd.getTime() ? hEnd : periodEnd;
    if (overlapEnd.getTime() < overlapStart.getTime()) continue;
    hasHolidayException = true;
    const overlapDays = diffCalendarDays(overlapStart, overlapEnd) + 1;
    if (overlapDays > bestOverlapDays) {
      bestOverlapDays = overlapDays;
      bestName = holiday.name;
    }
  }

  const name = bestName && bestOverlapDays / periodDays >= 0.5 ? bestName : undefined;
  return { hasHolidayException, name };
}
