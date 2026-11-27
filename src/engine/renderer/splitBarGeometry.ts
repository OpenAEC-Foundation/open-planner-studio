import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { taskCountsInWorkdays } from '@/engine/scheduler/conventions/durationMeasure';
import { computeSplitSegments, type SplitSegmentBounds } from '@/engine/scheduler/splitWalk';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { finishInstant, shownFinish, shownStart } from '@/utils/taskDates';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

export { computeSplitSegments, type SplitSegmentBounds };

export function taskSplitMeasure(task: Task, workdayDurationMeasure: boolean): true | 'workdays' {
  return taskCountsInWorkdays(task, { workdayDurationMeasure }) ? 'workdays' : true;
}

const splitEngines = new WeakMap<WorkCalendar, CalendarEngine>();

export function splitEngineFor(calendar: WorkCalendar): CalendarEngine {
  let engine = splitEngines.get(calendar);
  if (!engine) {
    engine = new CalendarEngine(calendarForEngine(calendar));
    splitEngines.set(calendar, engine);
  }
  return engine;
}

export function taskSplitSegments(
  task: Task,
  calendar: WorkCalendar,
  workdayDurationMeasure: boolean,
): SplitSegmentBounds[] | null {
  const startStr = shownStart(task) || '';
  const endStr = shownFinish(task) || '';
  if (!startStr || !endStr) return null;
  const instants = startStr.includes('T') || endStr.includes('T');
  const start = instants ? parseInstant(startStr) : parseDate(startStr);
  const end = instants ? finishInstant(endStr) : parseDate(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const measure = instants ? taskSplitMeasure(task, workdayDurationMeasure) : false;
  return computeSplitSegments(task.splitGaps, start, end, measure, splitEngineFor(calendar));
}
