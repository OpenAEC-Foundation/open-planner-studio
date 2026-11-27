import { ELAPSED_CLOCK, isInstant } from '@/engine/calendar/workdayRules';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { diffDays, parseInstant } from '@/utils/dateUtils';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { momentLabel, taskDateLabel } from '@/utils/taskDateLabel';

export function taskCalendarDaySpan(task: Task, calendar?: WorkCalendar): number | undefined {
  const start = shownStart(task);
  const finish = shownFinish(task);
  if (!start || !finish) return undefined;
  if (isZeroDurationMilestone(task)) return 0;
  if (isInstant(start) && isInstant(finish)) {
    const startMs = parseInstant(start).getTime();
    const finishMs = parseInstant(finish).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return undefined;
    if (finishMs <= startMs) return 0;
  }
  const startDay = shownDay(task, start, 'start', calendar);
  const finishDay = shownDay(task, finish, 'end', calendar);
  const days = diffDays(startDay, finishDay);
  if (!Number.isFinite(days)) return undefined;
  return Math.max(0, days + 1);
}

function shownDay(task: Task, value: string, side: 'start' | 'end', calendar?: WorkCalendar): string {
  const label = calendar ? taskDateLabel(task, value, side, calendar) : momentLabel(ELAPSED_CLOCK, value, side);
  return label.slice(0, 10);
}
