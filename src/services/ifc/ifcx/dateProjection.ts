import { addCalendarDays, formatDate, MS_PER_DAY, parseDate, parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import { finishInstant, shownFinish, shownStart } from '@/utils/taskDates';
import { isExistingCalendarDate } from './fieldTable';

export function existingDatePart(moment: string): string | undefined {
  const date = moment.slice(0, 10);
  return isExistingCalendarDate(date) ? date : undefined;
}

export function nextCalendarDate(date: string): string {
  return formatDate(addCalendarDays(parseDate(date), 1));
}

export interface SharedSpan {
  readonly start?: string;
  readonly endExclusive?: string;
}

export function projectSpan(start: string, finish: string): SharedSpan {
  if (!start || existingDatePart(start) === undefined) return {};
  const startMs = parseInstant(start).getTime();
  if (Number.isNaN(startMs)) return {};
  const startDate = formatDate(new Date(startMs));
  const finishMs = finish && existingDatePart(finish) !== undefined ? finishInstant(finish).getTime() : Number.NaN;
  if (Number.isNaN(finishMs) || finishMs <= startMs) return { start: startDate, endExclusive: nextCalendarDate(startDate) };
  const finishDayStart = Math.floor(finishMs / MS_PER_DAY) * MS_PER_DAY;
  const endExclusive = formatDate(new Date(finishMs === finishDayStart ? finishMs : finishDayStart + MS_PER_DAY));
  return { start: startDate, endExclusive: endExclusive > startDate ? endExclusive : nextCalendarDate(startDate) };
}

export function momentOfSharedDate(date: string): string {
  return `${date}T00:00`;
}

export function taskWindow(task: Task): SharedSpan {
  return projectSpan(shownStart(task), shownFinish(task));
}
