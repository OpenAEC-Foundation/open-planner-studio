import type { CalendarEngine } from './CalendarEngine';
import { parseDate, parseInstant, utcDayStart, MS_PER_DAY } from '@/utils/dateUtils';

const MS_PER_MIN = 60_000;

export function deadlineBound(deadline: string | undefined, eng: CalendarEngine): Date | null {
  if (!deadline) return null;
  if (!eng.isHourMode) {
    const dl = parseDate(deadline);
    return isNaN(dl.getTime()) ? null : eng.prevWorkDay(dl);
  }
  if (deadline.includes('T')) {
    const at = parseInstant(deadline);
    return isNaN(at.getTime()) ? null : eng.prevWorkInstant(at);
  }
  const day = parseDate(deadline);
  if (isNaN(day.getTime())) return null;
  const bands = eng.effectiveBandsOn(day);
  if (bands.length > 0) {
    return new Date(utcDayStart(day).getTime() + bands[bands.length - 1].end * MS_PER_MIN);
  }
  return eng.prevWorkInstant(new Date(day.getTime() + MS_PER_DAY));
}
