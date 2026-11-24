import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';
import { isExistingCalendarDate } from './fieldTable';

export function existingDatePart(moment: string): string | undefined {
  const date = moment.slice(0, 10);
  return isExistingCalendarDate(date) ? date : undefined;
}

function isMidnight(moment: string): boolean {
  return /^(T00:00(:00(\.0{1,3})?)?)?$/.test(moment.slice(10));
}

export function nextCalendarDate(date: string): string {
  return formatDate(addCalendarDays(parseDate(date), 1));
}

export interface SharedSpan {
  readonly start?: string;
  readonly endExclusive?: string;
}

export function projectSpan(start: string, finish: string): SharedSpan {
  const startDate = existingDatePart(start);
  if (startDate === undefined) return {};
  const finishDate = existingDatePart(finish);
  if (finishDate === undefined || finish <= start) return { start: startDate, endExclusive: nextCalendarDate(startDate) };
  const endExclusive = isMidnight(finish) ? finishDate : nextCalendarDate(finishDate);
  return { start: startDate, endExclusive: endExclusive > startDate ? endExclusive : nextCalendarDate(startDate) };
}

export function momentOfSharedDate(date: string): string {
  return `${date}T00:00`;
}
