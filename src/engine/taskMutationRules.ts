import type { CustomFieldValue } from '@/types/structure';
import type { WorkCalendar } from '@/types/calendar';
import {
  blocksClock, dayEndInstant, dayStartInstant, ELAPSED_CLOCK, isDateOnly, isInstant, milestoneMomentOn, workdayOfInstant,
  type DayClock, type InstantSide,
} from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { Task, TaskTime } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { milestoneDay } from '@/utils/taskDateLabel';
import { shownStart } from '@/utils/taskDates';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { taskDurationUnit } from '@/engine/scheduler/duration';

export function isActualPastStatusDate(
  dateIso: string,
  statusDateIso: string,
  calendar?: WorkCalendar,
  side: InstantSide = 'start',
): boolean {
  if (!statusDateIso.includes('T')) {
    const day = workdayOfInstant(calendar ? blocksClock(calendar) : ELAPSED_CLOCK, dateIso, side);
    return parseDate(day).getTime() > parseDate(statusDateIso).getTime();
  }
  return parseInstant(dateIso).getTime() > parseInstant(statusDateIso).getTime();
}

export function actualDateSide(task: Task, field: 'actualStart' | 'actualFinish'): InstantSide {
  return isZeroDurationMilestone(task)
    ? task.milestoneKind === 'FINISH' ? 'end' : 'start'
    : field === 'actualFinish' ? 'end' : 'start';
}

export function isTaskActualPastStatusDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  dateIso: string,
  statusDateIso: string,
  calendar?: WorkCalendar,
): boolean {
  const side = actualDateSide(task, field);
  if (calendar && !statusDateIso.includes('T') && isZeroDurationMilestone(task)) {
    const day = milestoneDay(task, dateIso, calendar);
    if (day) return parseDate(day).getTime() > parseDate(statusDateIso).getTime();
  }
  return isActualPastStatusDate(dateIso, statusDateIso, isElapsedTask(task) ? undefined : calendar, side);
}

function plannedMilestoneActual(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  date: string,
  clock: DayClock,
): string | null {
  const planned = shownStart(task);
  if (!planned || !isInstant(planned)) return null;
  return milestoneMomentOn(clock, planned, date, actualDateSide(task, field));
}

function normalizeActualDateWith(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
  plannedClock: boolean,
): string | undefined {
  if (!value || !isDateOnly(value) || !calendar) return value;
  const clock = isElapsedTask(task) ? ELAPSED_CLOCK : blocksClock(calendar);
  const side = actualDateSide(task, field);
  const planned = plannedClock && isZeroDurationMilestone(task)
    ? plannedMilestoneActual(task, field, value, clock)
    : null;
  const moment = planned ?? (side === 'end' ? dayEndInstant(clock, value) : dayStartInstant(clock, value)) ?? value;
  if (statusDate?.includes('T') && value === workdayOfInstant(clock, statusDate, 'start')
    && parseInstant(moment) > parseInstant(statusDate)) return statusDate;
  return moment;
}

export function normalizeActualDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): string | undefined {
  return normalizeActualDateWith(task, field, value, statusDate, calendar, true);
}

export function normalizeLoadedActualDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): string | undefined {
  return normalizeActualDateWith(task, field, value, statusDate, calendar, false);
}

export type PlannedProgressDates = Pick<TaskTime, 'earlyStart' | 'earlyFinish'>;

export function rememberProgressBeforeRecalculation(before: Task, after: Task): void {
  const { completion, actualStart, actualFinish, remainingTime, remainingMinutes } = before.time;
  const time = after.time;
  if (completion === time.completion && actualStart === time.actualStart && actualFinish === time.actualFinish
    && remainingTime === time.remainingTime && remainingMinutes === time.remainingMinutes) return;
  if (time.completion === 0 && !time.actualStart && !time.actualFinish) {
    if (time.progressBeforeRecalculation) time.progressBeforeRecalculation = undefined;
    return;
  }
  if (time.actualFinish) return;
  time.progressBeforeRecalculation ??= {
    status: before.status, completion, actualStart, actualFinish, remainingTime, remainingMinutes,
    splitGaps: before.splitGaps,
  };
}

export function datesForProgress(
  task: Task, completion: number, lookup?: (task: Task) => PlannedProgressDates | undefined,
): PlannedProgressDates | undefined {
  if (completion >= 1 && !task.time.actualFinish) return lookup?.(task);
  if (completion > 0 && !task.time.actualStart && !isZeroDurationMilestone(task)) return lookup?.(task);
  return undefined;
}

function deriveActualFinish(
  task: Task, statusDate: string | undefined, calendar?: WorkCalendar, planned?: PlannedProgressDates,
): string | undefined {
  const finish = normalizeActualDate(task, 'actualFinish',
    planned?.earlyFinish || task.time.earlyFinish || task.time.scheduleFinish, statusDate, calendar);
  if (!statusDate || !finish || !isTaskActualPastStatusDate(task, 'actualFinish', finish, statusDate, calendar)) return finish;
  return normalizeActualDate(task, 'actualFinish', statusDate, statusDate, calendar);
}

export function defaultActualStart(time: Pick<TaskTime, 'earlyStart' | 'scheduleStart'>): string {
  return time.earlyStart || time.scheduleStart;
}

export function isActualFinishBeforeStart(time: Pick<TaskTime, 'actualStart' | 'actualFinish'>): boolean {
  return !!time.actualStart && !!time.actualFinish
    && parseInstant(time.actualFinish).getTime() < parseInstant(time.actualStart).getTime();
}

export function fillMissingActualStart(
  task: Task, statusDate: string | undefined, calendar?: WorkCalendar, planned?: PlannedProgressDates,
): void {
  const time = task.time;
  if (time.actualStart) return;
  const finish = time.actualFinish || (time.completion >= 1
    ? deriveActualFinish(task, statusDate, calendar, planned)
    : undefined);
  if (!time.actualFinish && finish && isZeroDurationMilestone(task)) {
    time.actualStart = finish;
    return;
  }
  const start = normalizeActualDate(task, 'actualStart', planned?.earlyStart || defaultActualStart(time), statusDate, calendar)!;
  time.actualStart = finish && isActualFinishBeforeStart({ actualStart: start, actualFinish: finish })
    ? finish
    : start;
}

export function applyCompletionEdit(
  task: Task, completion: number, statusDate: string | undefined, calendar?: WorkCalendar,
  planned?: PlannedProgressDates,
): void {
  const time = task.time;
  time.completion = completion;
  if (completion < 1) time.actualFinish = undefined;
  if (completion > 0) fillMissingActualStart(task, statusDate, calendar, planned);
}

export function applyActualDateEdit(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  date: string | undefined,
  statusDate: string | undefined,
  calendar?: WorkCalendar,
  planned?: PlannedProgressDates,
): void {
  task.time[field] = date || undefined;
  if (field === 'actualFinish' && !date && task.time.completion >= 1) task.time.completion = 0;
  applyProgressInvariants(task, statusDate, calendar, planned);
}

export function applyProgressInvariants(
  task: Task, statusDate: string | undefined, calendar?: WorkCalendar, planned?: PlannedProgressDates,
): void {
  const time = task.time;
  if (time.actualFinish) {
    time.completion = 1;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.completion >= 1) {
    time.actualFinish = deriveActualFinish(task, statusDate, calendar, planned);
    const startWasDerived = !time.actualStart;
    if (startWasDerived) time.actualStart = time.actualFinish;
    const finish = time.actualFinish!;
    if (!startWasDerived && isDateOnly(finish)) {
      if (time.actualStart!.slice(0, 10) > finish) time.actualFinish = time.actualStart;
    } else {
      orderActualsAfterDerivedFinish(time, statusDate, startWasDerived);
    }
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  applyRemainingDuration(task);
}

export function applyRemainingDuration(task: Task, keepRecordedRest = false): void {
  const time = task.time;
  const keep = keepRecordedRest && time.completion < 1;
  if (taskDurationUnit(task) !== 'hours') {
    const recorded = time.remainingTime;
    if (keep && recorded != null && Number.isFinite(recorded)) return;
    time.remainingTime = exactWorkdays(time.scheduleDuration * (1 - time.completion));
    return;
  }
  const minutes = keep && time.remainingMinutes != null
    ? time.remainingMinutes
    : Math.round((time.durationMinutes ?? 0) * (1 - time.completion));
  time.remainingMinutes = minutes;
  time.remainingTime = hourRemainingDays(time, minutes);
}

export function exactWorkdays(days: number): number {
  return Number.isFinite(days) ? Number(days.toPrecision(15)) : days;
}

export function hourRemainingDays(time: Pick<TaskTime, 'scheduleDuration' | 'durationMinutes'>, minutes: number): number {
  const totalMinutes = time.durationMinutes ?? 0;
  return totalMinutes > 0 ? (time.scheduleDuration * minutes) / totalMinutes : 0;
}

export function assignTaskActivityCode(
  task: Task,
  typeId: string,
  valueId: string | undefined,
): void {
  if (valueId === undefined) {
    if (task.activityCodes) delete task.activityCodes[typeId];
  } else {
    task.activityCodes = { ...(task.activityCodes ?? {}), [typeId]: valueId };
  }
}

export function assignTaskCustomField(
  task: Task,
  defId: string,
  value: CustomFieldValue | undefined,
): void {
  if (value === undefined) {
    if (task.customFields) delete task.customFields[defId];
  } else {
    task.customFields = { ...(task.customFields ?? {}), [defId]: value };
  }
}
