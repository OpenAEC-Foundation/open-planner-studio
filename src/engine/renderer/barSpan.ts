import type { Task } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant, shownFinish, shownStart } from '@/utils/taskDates';

export interface TaskBarSpan {
  hourMode: boolean;
  start: Date;
  end: Date;
  x1: number;
  x2: number;
}

const parsedSpans = new WeakMap<Task, { startStr: string; endStr: string; hourMode: boolean; startMs: number; endMs: number }>();

export function taskBarSpan(task: Task, dateToX: (date: Date) => number, zoom: number): TaskBarSpan | null {
  const rawStart = shownStart(task) || '';
  const rawEnd = shownFinish(task) || '';
  const startStr = rawStart || rawEnd;
  const endStr = rawEnd || rawStart;
  if (!startStr) return null;
  let parsed = parsedSpans.get(task);
  if (!parsed || parsed.startStr !== startStr || parsed.endStr !== endStr) {
    const hourMode = startStr.includes('T') || endStr.includes('T');
    parsed = {
      startStr, endStr, hourMode,
      startMs: (hourMode ? parseInstant(startStr) : parseDate(startStr)).getTime(),
      endMs: (hourMode ? finishInstant(endStr) : parseDate(endStr)).getTime(),
    };
    parsedSpans.set(task, parsed);
  }
  const { hourMode } = parsed;
  const start = new Date(parsed.startMs);
  const end = new Date(parsed.endMs);
  const x1 = dateToX(start);
  const x2 = hourMode ? dateToX(end) : dateToX(end) + zoom;
  return { hourMode, start, end, x1, x2 };
}

export function milestoneAnchorX(task: Task, dateToX: (date: Date) => number, zoom: number): number | null {
  const moment = milestoneMoment(task);
  if (!moment) return null;
  const anchor = moment.hourMode ? 0 : task.milestoneKind === 'START' ? 0 : task.milestoneKind === 'FINISH' ? zoom : zoom / 2;
  return dateToX(moment.date) + anchor;
}

export function milestoneMoment(task: Task): { date: Date; hourMode: boolean } | null {
  const startStr = shownStart(task) || shownFinish(task);
  if (!startStr) return null;
  const hourMode = startStr.includes('T');
  return { date: hourMode ? parseInstant(startStr) : parseDate(startStr), hourMode };
}
