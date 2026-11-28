import type { Task } from '@/types/task';
import { isHourModeCalendar, type WorkCalendar } from '@/types/calendar';
import type { TFunction } from 'i18next';
import { deriveHoursPerDay } from '@/services/subdayIo';
import { formatDuration, type DurationSuffixes } from '@/utils/durationFormat';
import { formatReportNumber } from '@/utils/reportNumber';
import type { DurationDisplay } from '@/types/view';
import { isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { Project } from '@/types/project';

export function profileCountsWorkdays(project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>): boolean {
  return effectiveSchedulingOptions(project).workdayDurationMeasure === true;
}

export function effectiveDurationDisplay(display: DurationDisplay, countsWorkdays: boolean): DurationDisplay {
  return countsWorkdays ? 'auto' : display;
}

export function durationSuffixesFrom(t: TFunction<'common'>): DurationSuffixes {
  return { day: t('duration.suffixDay'), hour: t('duration.suffixHour'), minute: t('duration.suffixMinute') };
}

export function effectiveCalendarOf(
  task: Task,
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): WorkCalendar {
  return resolveCalendar(task.calendarId, library, projectCal);
}

export function effHoursPerDay(cal: WorkCalendar): number {
  return isHourModeCalendar(cal) ? deriveHoursPerDay(cal.workTime!, cal.hoursPerDay) : cal.hoursPerDay;
}

export function durationHoursPerDay(task: Pick<Task, 'time'>, hoursPerDay: number): number {
  return task.time.durationType === 'ELAPSEDTIME' ? 24 : hoursPerDay;
}

export function hourTaskScheduleDuration(minutes: number, cal: WorkCalendar): number {
  const hpd = effHoursPerDay(cal);
  return hpd > 0 ? minutes / (hpd * 60) : 0;
}

export function taskDurationMinutes(task: Task, cal: WorkCalendar): number {
  const hpd = effHoursPerDay(cal);
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * hpd * 60;
}

export interface DurationTextFormat {
  display?: DurationDisplay;
  suffixes?: DurationSuffixes;
  locale?: string;
}

function suffixesOf(fmt: DurationTextFormat | undefined): DurationSuffixes {
  return {
    day: fmt?.suffixes?.day ?? 'd',
    hour: fmt?.suffixes?.hour ?? 'h',
    minute: fmt?.suffixes?.minute ?? 'm',
  };
}

export function formatWorkDaysText(days: number, fmt?: DurationTextFormat): string {
  const text = formatReportNumber(days, fmt?.locale);
  return text ? `${text}${suffixesOf(fmt).day}` : '—';
}

function hoursText(minutes: number, hoursPerDay: number, suffixes: DurationSuffixes): string {
  return formatDuration(Math.round(minutes), hoursPerDay, 'hours', suffixes);
}

export function formatTaskDurationText(task: Task, hoursPerDay: number, fmt?: DurationTextFormat): string {
  if (isZeroDurationMilestone(task)) return `0${suffixesOf(fmt).day}`;
  return formatMeasuredDurationText(taskMeasuredDuration(task), durationHoursPerDay(task, hoursPerDay), fmt);
}

export type MeasuredDuration = { unit: 'days'; days: number } | { unit: 'hours'; minutes: number };

export function taskMeasuredDuration(task: Task): MeasuredDuration {
  return taskDurationUnit(task) === 'hours'
    ? { unit: 'hours', minutes: task.time.durationMinutes ?? 0 }
    : { unit: 'days', days: task.time.scheduleDuration };
}

export function formatMeasuredDurationText(duration: MeasuredDuration, hoursPerDay: number, fmt?: DurationTextFormat): string {
  const suffixes = suffixesOf(fmt);
  const minutes = duration.unit === 'hours' ? duration.minutes : duration.days * hoursPerDay * 60;
  const native = duration.unit === 'days'
    ? formatWorkDaysText(duration.days, fmt)
    : hoursText(minutes, hoursPerDay, suffixes);

  const display = fmt?.display ?? 'auto';
  if (display === 'auto' || display === duration.unit) return native;
  const converted = display === 'days'
    ? formatWorkDaysText(hoursPerDay > 0 ? minutes / (hoursPerDay * 60) : NaN, fmt)
    : hoursText(minutes, hoursPerDay, suffixes);
  return `${converted}(${native})`;
}

export function remainingTaskMinutes(task: Task): number {
  if (task.status === 'COMPLETED' || task.time.actualFinish) return 0;
  return Math.max(0, task.time.remainingMinutes
    ?? Math.round((task.time.durationMinutes ?? 0) * (1 - task.time.completion)));
}

export function formatRemainingDurationText(task: Task, fmt?: DurationTextFormat): string {
  return formatMeasuredDurationText(remainingTaskMeasure(task), 1, { ...fmt, display: 'auto' });
}

export function remainingTaskMeasure(task: Task): MeasuredDuration {
  if (taskDurationUnit(task) === 'hours') return { unit: 'hours', minutes: remainingTaskMinutes(task) };
  return { unit: 'days', days: task.time.remainingTime ?? task.time.scheduleDuration * (1 - task.time.completion) };
}

export function formatTaskDurationDisplay(
  task: Task,
  cal: WorkCalendar,
  display: DurationDisplay,
  suffixes?: DurationSuffixes,
  locale?: string,
): string {
  return formatTaskDurationText(task, effHoursPerDay(cal), { display, suffixes, locale });
}

export function detectMixedCalendars(
  tasks: Task[],
  projectCal: WorkCalendar,
  library: WorkCalendar[],
): {
  mixed: boolean;
  hpds: number[];
  hasDay: boolean;
  hasHour: boolean;
  calendars: { id: string; name: string; hpd: number; isHour: boolean }[];
} {
  const hpdSet = new Set<number>();
  let hasDay = false;
  let hasHour = false;
  const seen = new Map<string, { id: string; name: string; hpd: number; isHour: boolean }>();
  const consider = (cal: WorkCalendar) => {
    const hpd = effHoursPerDay(cal);
    hpdSet.add(hpd);
    const hour = isHourModeCalendar(cal);
    if (!seen.has(cal.id)) seen.set(cal.id, { id: cal.id, name: cal.name, hpd, isHour: hour });
  };
  consider(projectCal);
  for (const t of tasks) {
    if (t.isMilestone) continue;
    consider(effectiveCalendarOf(t, projectCal, library));
    if (taskDurationUnit(t) === 'hours') hasHour = true;
    else hasDay = true;
  }
  const hpds = [...hpdSet].sort((a, b) => a - b);
  const mixed = hpds.length > 1 || (hasDay && hasHour);
  return { mixed, hpds, hasDay, hasHour, calendars: [...seen.values()] };
}
