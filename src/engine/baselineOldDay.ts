import type { Task } from '@/types/task';
import type { BaselineTask } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { engineForTaskCalendar } from '@/engine/scheduler/CPMSolver';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effHoursPerDay } from '@/utils/taskDuration';
import { parseInstant } from '@/utils/dateUtils';

const TOLERANCE_MINUTES = 1;

function dayLengths(cal: WorkCalendar): { stored: number; effective: number } | null {
  const stored = cal.hoursPerDay;
  const effective = effHoursPerDay(cal);
  if (!(stored > 0) || !(effective > 0)) return null;
  if (Math.abs(stored - effective) * 60 <= TOLERANCE_MINUTES) return null;
  return { stored, effective };
}

export function baselineHasOldDayCount(
  task: Task,
  baselineTask: BaselineTask,
  cal: WorkCalendar,
  engine: CalendarEngine,
): boolean {
  if (task.time.durationUnit !== 'hours') return false;
  const lengths = dayLengths(cal);
  if (!lengths) return false;
  if (!Number.isFinite(baselineTask.duration) || baselineTask.duration <= 0) return false;
  const fits = (minutes: number, hoursPerDay: number) =>
    Math.abs(baselineTask.duration * hoursPerDay * 60 - minutes) <= TOLERANCE_MINUTES;
  if (baselineTask.start && baselineTask.finish) {
    const start = parseInstant(baselineTask.start);
    const finish = parseInstant(baselineTask.finish);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime())) {
      const span = engine.workMinutesBetween(start, finish);
      if (span > 0 && fits(span, lengths.effective)) return false;
      if (span > 0 && fits(span, lengths.stored)) return true;
    }
  }
  const work = task.time.durationMinutes;
  if (!(typeof work === 'number' && Number.isFinite(work) && work > 0)) return false;
  return fits(work, lengths.stored) && !fits(work, lengths.effective);
}

export function createBaselineOldDayCheck(
  projectCalendar: WorkCalendar,
  calendars: readonly WorkCalendar[],
): (task: Task, baselineTask: BaselineTask) => boolean {
  const engines = new Map<string, CalendarEngine>();
  return (task, baselineTask) => {
    if (task.time.durationUnit !== 'hours') return false;
    const cal = resolveCalendar(task.calendarId, calendars as WorkCalendar[], projectCalendar);
    if (!dayLengths(cal)) return false;
    return baselineHasOldDayCount(task, baselineTask, cal, engineForTaskCalendar(engines, cal));
  };
}
