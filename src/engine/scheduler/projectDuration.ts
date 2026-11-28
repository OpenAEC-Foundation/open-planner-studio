import type { Task } from '@/types/task';
import type { CalendarEngine } from './CalendarEngine';
import { isDateOnly, workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import type { InstantSide } from '@/engine/calendar/workdayRules';
import { formatDate, parseDate, parseInstant } from '@/utils/dateUtils';

export function projectDurationOf(
  engine: CalendarEngine,
  projStart: Date | string | null,
  projEnd: Date | string,
  tasks: Iterable<Task>,
): number {
  if (!projStart) return 0;
  const dayOf = (value: Date | string, side: InstantSide): Date => {
    if (typeof value === 'string' && isDateOnly(value)) return parseDate(value);
    const instant = typeof value === 'string' ? parseInstant(value) : value;
    return engine.isHourMode ? workdayDateOfInstant(engine, instant, side) : instant;
  };
  const startDay = dayOf(projStart, 'start');
  const endDay = dayOf(projEnd, 'end');
  let duration = engine.workDaysBetween(startDay, endDay);
  if (formatDate(startDay) === formatDate(endDay)) {
    const anyRealWork = [...tasks].some((t) => !t.isMilestone && t.time.scheduleDuration > 0);
    if (!anyRealWork) duration = 0;
  }
  return duration;
}
