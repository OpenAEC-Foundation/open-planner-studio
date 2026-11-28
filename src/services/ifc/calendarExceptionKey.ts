import type { WorkingException } from '@/types/calendar';
import { minutesToClock } from '@/services/subdayIo';

export function calendarExceptionKey(exception: WorkingException): string {
  return calendarExceptionKeyFromClocks(exception, (exception.bands ?? []).map(b => [
    minutesToClock(b.start), minutesToClock(b.end, true),
  ]));
}

export function calendarExceptionKeyFromClocks(
  exception: Pick<WorkingException, 'name' | 'startDate' | 'endDate'>,
  clocks: readonly (readonly [string, string])[],
): string {
  const bands = clocks.map(pair => JSON.stringify(pair)).sort();
  return JSON.stringify([exception.name, exception.startDate, exception.endDate, bands]);
}
