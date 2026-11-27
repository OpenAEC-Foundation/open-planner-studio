import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { isHourModeCalendar, type WorkCalendar } from '@/types/calendar';
import type { Baseline } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';
import { createTaskEngineCache, type TaskEngineCache } from '@/engine/scheduler/taskEngineCache';
import {
  durationHoursPerDay, effHoursPerDay, effectiveCalendarOf, remainingTaskMeasure, taskMeasuredDuration,
  type MeasuredDuration,
} from '@/utils/taskDuration';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { shownStart, shownFinish, shownSpanOverlapsDays } from '@/utils/taskDates';
import { taskDateLabelIn, type TaskDateLabelOptions } from '@/utils/taskDateLabel';
import { isDateOnly, isInstant, type InstantSide } from '@/engine/calendar/workdayRules';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { progressState, taskWorkDays, type ProgressState } from '@/engine/scheduler/summaryProgress';
import { type ReportingPeriod, type ResolvedPeriod, resolveReportingPeriod } from './reportingPeriod';

export interface ReportContext {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
  calendar: WorkCalendar;
  calendars: readonly WorkCalendar[];
  cpmResult: CPMResult | null;
  baseline: Baseline | null;
  statusDate?: string;
  today: string;
  datesAsRecorded?: boolean;
  solveOptions?: ProjectSolveOptions;
}

export type SolvedReportContext = ReportContext & { solveOptions: ProjectSolveOptions };

export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export type ReportTaskDateLabel = (taskId: string, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

export function makeTaskDateLabeler(ctx: Pick<ReportContext, 'tasks' | 'calendar' | 'calendars'>): ReportTaskDateLabel {
  const byId = new Map(ctx.tasks.map(t => [t.id, t]));
  return (taskId, value, side, opts) => {
    if (!value) return '';
    const task = byId.get(taskId);
    return task ? taskDateLabelIn(task, value, side, ctx, opts) : dayOf(value);
  };
}

export function activityTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(t => t.childIds.length === 0 && !t.isHammock);
}

export function referenceDay(ctx: ReportContext): { day: string; statusDateMissing: boolean } {
  return referenceDayOf(ctx.statusDate, ctx.today);
}

const DAY_MS = 86_400_000;

export function statusMoment(ctx: Pick<ReportContext, 'statusDate' | 'calendar'>): Date | undefined {
  return ctx.statusDate && isInstant(ctx.statusDate) && isHourModeCalendar(ctx.calendar) ? parseInstant(ctx.statusDate) : undefined;
}

export function onHourCalendar(ctx: Pick<ReportContext, 'calendar' | 'calendars'>, t: Task): boolean {
  return isHourModeCalendar(effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]));
}

export function elapsedWorkFraction(eng: CalendarEngine, start: string, finish: string, day: string, moment?: Date): number {
  if (!eng.isHourMode) {
    const from = dayOf(start);
    const to = dayOf(finish);
    if (day < from) return 0;
    if (day >= to) return 1;
    const s = parseDate(from);
    const total = eng.workDaysBetween(s, parseDate(to));
    if (!(total > 0)) return 1;
    return Math.min(1, Math.max(0, eng.workDaysBetween(s, parseDate(day)) / total));
  }
  const s = parseInstant(start);
  const f = isDateOnly(finish) ? new Date(parseDate(finish).getTime() + DAY_MS) : parseInstant(finish);
  const at = moment ?? new Date(parseDate(day).getTime() + DAY_MS);
  if (at <= s) return 0;
  if (at >= f) return 1;
  const total = eng.measuredWorkdaysBetween(s, f);
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, eng.measuredWorkdaysBetween(s, at) / total));
}

export function referenceDayOf(statusDate: string | undefined, today: string): { day: string; statusDateMissing: boolean } {
  if (statusDate) return { day: dayOf(statusDate), statusDateMissing: false };
  return { day: dayOf(today), statusDateMissing: true };
}

export { shownStart as taskStart, shownFinish as taskFinish };

export { progressState, type ProgressState };

export function scheduleSlip(t: Task, state: ProgressState, refDay: string): 'finish' | 'start' | undefined {
  if (state === 'complete') return undefined;
  if (dayOf(shownFinish(t)) < refDay) return 'finish';
  if (state === 'notStarted' && dayOf(shownStart(t)) < refDay) return 'start';
  return undefined;
}

export function durationDays(ctx: ReportContext, t: Task): number {
  return taskWorkDays(t, ctx.calendar, ctx.calendars);
}

export function remainingDays(ctx: ReportContext, t: Task): number {
  if (progressState(t) === 'complete') return 0;
  const cal = effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[]);
  const minPerDay = effHoursPerDay(cal) * 60;
  if (taskDurationUnit(t) === 'hours') {
    if (t.time.remainingMinutes !== undefined && minPerDay > 0) return round1(t.time.remainingMinutes / minPerDay);
  } else if (t.time.remainingTime !== undefined) {
    return round1(t.time.remainingTime);
  }
  return round1(durationDays(ctx, t) * (1 - t.time.completion));
}

export function remainingMeasure(t: Task): MeasuredDuration {
  const own = remainingTaskMeasure(t);
  if (progressState(t) !== 'complete') return own;
  return own.unit === 'hours' ? { unit: 'hours', minutes: 0 } : { unit: 'days', days: 0 };
}

export function durationMeasure(t: Task): MeasuredDuration {
  return taskMeasuredDuration(t);
}

export function taskHoursPerDay(ctx: ReportContext, t: Task): number {
  return durationHoursPerDay(t, effHoursPerDay(effectiveCalendarOf(t, ctx.calendar, ctx.calendars as WorkCalendar[])));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function makeEngineCache(ctx: ReportContext): TaskEngineCache {
  return createTaskEngineCache(ctx.calendars as WorkCalendar[], ctx.calendar);
}

export function projectSpan(tasks: readonly Task[]): ResolvedPeriod | undefined {
  let from: string | undefined;
  let to: string | undefined;
  for (const t of tasks) {
    const s = dayOf(shownStart(t));
    const f = dayOf(shownFinish(t));
    if (!s || !f) continue;
    if (!from || s < from) from = s;
    if (!to || f > to) to = f;
  }
  return from && to ? { from, to } : undefined;
}

export function resolvePeriodFor(ctx: ReportContext, period: ReportingPeriod): ResolvedPeriod & { refDay: string; statusDateMissing: boolean } {
  const { day, statusDateMissing } = referenceDay(ctx);
  const resolved = resolveReportingPeriod(period, day, projectSpan(ctx.tasks));
  return { ...resolved, refDay: day, statusDateMissing };
}

export { shownSpanOverlapsDays as overlapsWindow };

export function assignedResourceNamesIndex(ctx: ReportContext): Map<string, string[]> {
  const byId = new Map(ctx.resources.map(r => [r.id, r]));
  const out = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const a of ctx.assignments) {
    const key = `${a.taskId}\u0000${a.resourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = byId.get(a.resourceId);
    if (!r) continue;
    let list = out.get(a.taskId);
    if (!list) { list = []; out.set(a.taskId, list); }
    list.push(r.name);
  }
  return out;
}

export function isNearCritical(t: Task, thresholdDays: number): boolean {
  if (t.time.isCritical) return false;
  if (t.time.isNearCritical) return true;
  const tf = t.time.totalFloat;
  return thresholdDays > 0 && tf > 0 && tf <= thresholdDays;
}

export { taskDepths } from '@/utils/wbs';
