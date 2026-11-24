import { parseDate, formatDate, addBusinessDays, parseInstant, formatInstant } from '@/utils/dateUtils';
import type { Task, TaskDurationUnit, TaskSplitGap, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { sameValue } from '@/utils/sameValue';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addElapsedMinutes, splitTotalSpanMinutes } from '@/engine/scheduler/duration';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { effHoursPerDay } from '@/utils/taskDuration';
import { clipUserGapsToWork, splitUnitMinutes } from '@/engine/scheduler/splitEdit';
import {
  rescaleContourForDuration, rescaleFactor, rescaleSplitGaps, taskAxisMinutes,
} from '@/engine/contour/contourEngine';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { ruleProtectsWork } from '@/engine/work/workTriangle';

export function effectiveEffortDriven(task: Pick<Task, 'mspTaskType' | 'effortDriven'>): boolean | undefined {
  return task.mspTaskType ? (task.effortDriven ?? false) : undefined;
}

export function contourKeepsWork(task: Pick<Task, 'workRule' | 'mspTaskType'>, defaultWorkRule?: WorkRule): boolean {
  if (task.workRule !== undefined) return ruleProtectsWork(task.workRule);
  return task.mspTaskType === 'FIXED_WORK' || ruleProtectsWork(defaultWorkRule ?? DEFAULT_WORK_RULE);
}

export function createDefaultTaskTime(
  start: string,
  durationDays: number,
  durationUnit: TaskDurationUnit = 'days',
  calendar?: WorkCalendar,
): TaskTime {
  const startDate = parseDate(start);
  const hourFinish = durationUnit === 'hours' && calendar
    ? hourTaskInputFinish({ scheduleStart: start, durationMinutes: durationDays * 60, durationType: 'WORKTIME' }, calendar)
    : undefined;
  const finish = hourFinish
    ?? (durationDays > 0 && !isNaN(startDate.getTime())
      ? formatDate(addBusinessDays(startDate, durationDays))
      : start);
  return {
    durationType: 'WORKTIME',
    durationUnit,
    scheduleDuration: durationDays,
    ...(durationUnit === 'hours' ? { durationMinutes: durationDays * 60 } : {}),
    scheduleStart: start,
    scheduleFinish: finish,
    earlyStart: start,
    earlyFinish: finish,
    lateStart: start,
    lateFinish: finish,
    freeFloat: 0,
    totalFloat: 0,
    isCritical: false,
    completion: 0,
  };
}

type HourInputFinishTime = Pick<TaskTime, 'scheduleStart' | 'durationType'> & { durationMinutes?: number };

export function hourTaskInputFinish(
  time: HourInputFinishTime,
  calendar: WorkCalendar,
  splitGaps?: readonly TaskSplitGap[],
): string | undefined {
  const start = parseInstant(time.scheduleStart);
  if (Number.isNaN(start.getTime())) return undefined;
  const minutes = Math.max(0, time.durationMinutes ?? 0);
  if (time.durationType === 'ELAPSEDTIME') return formatInstant(addElapsedMinutes(start, minutes), 'hour');
  const engine = new CalendarEngine(calendarForEngine(calendar));
  if (!engine.isHourMode) return undefined;
  const total = splitTotalSpanMinutes(splitGaps, minutes);
  return formatInstant(total > 0 ? engine.addWorkMinutes(start, total) : start, 'hour');
}

export function hourInputFinishFollowsEdits(task: Task): boolean {
  const legacy = task.time as TaskTime & { durationUnit?: TaskDurationUnit };
  const unit = legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
  if (unit !== 'hours') return false;
  if (task.isSummary || task.childIds.length > 0 || task.isHammock) return false;
  if (task.manuallyScheduled || task.p6ExplicitTargetWindow === true) return false;
  if (task.status !== 'NOT_STARTED') return false;
  const time = task.time;
  return !time.actualStart && !time.actualFinish && !(time.completion > 0);
}

export interface HourInputFinishBasis {
  readonly key: string;
  readonly scheduleFinish: string;
}

export function hourInputFinishBasis(task: Task): HourInputFinishBasis {
  const t = task.time;
  return {
    key: JSON.stringify([
      t.scheduleStart, t.durationUnit, t.durationMinutes, t.scheduleDuration, t.durationType,
      task.calendarId, task.isMilestone,
    ]),
    scheduleFinish: t.scheduleFinish,
  };
}

export function reconcileHourInputFinish(task: Task, before: HourInputFinishBasis, calendar: WorkCalendar): boolean {
  if (task.time.scheduleFinish !== before.scheduleFinish) return false;
  if (hourInputFinishBasis(task).key === before.key) return false;
  if (!hourInputFinishFollowsEdits(task)) return false;
  const finish = hourTaskInputFinish(task.time, calendar, task.splitGaps);
  if (!finish || finish === task.time.scheduleFinish) return false;
  task.time.scheduleFinish = finish;
  return true;
}

export function seedNewHourTaskFinish(task: Task, partialTime: Partial<TaskTime> | undefined, calendar: WorkCalendar): void {
  if (partialTime?.scheduleFinish !== undefined) return;
  if (!hourInputFinishFollowsEdits(task)) return;
  const finish = hourTaskInputFinish(task.time, calendar, task.splitGaps);
  if (!finish) return;
  task.time.scheduleFinish = finish;
  if (partialTime?.earlyFinish === undefined) task.time.earlyFinish = finish;
  if (partialTime?.lateFinish === undefined) task.time.lateFinish = finish;
}

export function buildNewTask(
  partial: Partial<Task> & { name: string },
  opts: { id: string; parentId: string | null; parentTask: Task | undefined; constructionMode: boolean; time: TaskTime },
): Task {
  const { parentTask } = opts;
  const taskType = partial.taskType || parentTask?.taskType || (opts.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED');
  return {
    id: opts.id,
    name: partial.name,
    description: partial.description || '',
    wbsCode: partial.wbsCode || '',
    taskType,
    customTaskTypeId: taskType === 'USERDEFINED'
      ? (partial.customTaskTypeId ?? (partial.taskType === undefined ? parentTask?.customTaskTypeId : undefined))
      : undefined,
    status: partial.status || 'NOT_STARTED',
    isMilestone: partial.isMilestone || false,
    milestoneKind: partial.milestoneKind,
    mandatory: partial.mandatory,
    priority: partial.priority ?? 500,
    parentId: opts.parentId,
    childIds: [],
    isSummary: partial.isSummary,
    time: opts.time,
    resourceIds: partial.resourceIds || [],
    color: partial.color,
    constraint: partial.constraint,
    constraint2: partial.constraint2,
    isHammock: partial.isHammock,
    externalLinks: partial.externalLinks,
    deadline: partial.deadline,
    calendarId: partial.calendarId,
    notes: partial.notes,
    splitGaps: partial.splitGaps,
    manuallyScheduled: partial.manuallyScheduled,
    levelingDelayMinutes: partial.levelingDelayMinutes,
    levelingDelayElapsed: partial.levelingDelayElapsed,
    workRule: partial.workRule,
  };
}

export function deriveScheduleDurationFromMinutes(time: TaskTime, hoursPerDay: number): void {
  if (time.durationUnit !== 'hours') return;
  time.scheduleDuration = hoursPerDay > 0 ? (time.durationMinutes ?? 0) / (hoursPerDay * 60) : 0;
}

export function mergeTaskTime(base: TaskTime, partial: Partial<TaskTime> | undefined): TaskTime {
  if (!partial) partial = {};
  const legacyBase = base as TaskTime & { durationUnit?: TaskDurationUnit };
  const durationUnit = partial.durationUnit
    ?? (('durationMinutes' in partial && partial.durationMinutes != null) ? 'hours' : undefined)
    ?? legacyBase.durationUnit
    ?? (('durationMinutes' in partial ? partial.durationMinutes : legacyBase.durationMinutes) != null ? 'hours' : 'days');
  const merged: TaskTime = {
    durationType: partial.durationType ?? base.durationType,
    durationUnit,
    scheduleDuration: partial.scheduleDuration ?? base.scheduleDuration,
    scheduleStart: partial.scheduleStart ?? base.scheduleStart,
    scheduleFinish: partial.scheduleFinish ?? base.scheduleFinish,
    earlyStart: partial.earlyStart ?? base.earlyStart,
    earlyFinish: partial.earlyFinish ?? base.earlyFinish,
    lateStart: partial.lateStart ?? base.lateStart,
    lateFinish: partial.lateFinish ?? base.lateFinish,
    freeFloat: partial.freeFloat ?? base.freeFloat,
    totalFloat: partial.totalFloat ?? base.totalFloat,
    isCritical: partial.isCritical ?? base.isCritical,
    completion: partial.completion ?? base.completion,
    durationMinutes: 'durationMinutes' in partial ? partial.durationMinutes : base.durationMinutes,
    interferingFloat: 'interferingFloat' in partial ? partial.interferingFloat : base.interferingFloat,
    totalFloatMinutes: 'totalFloatMinutes' in partial ? partial.totalFloatMinutes : base.totalFloatMinutes,
    freeFloatMinutes: 'freeFloatMinutes' in partial ? partial.freeFloatMinutes : base.freeFloatMinutes,
    isNearCritical: 'isNearCritical' in partial ? partial.isNearCritical : base.isNearCritical,
    floatPath: 'floatPath' in partial ? partial.floatPath : base.floatPath,
    actualStart: 'actualStart' in partial ? partial.actualStart : base.actualStart,
    actualFinish: 'actualFinish' in partial ? partial.actualFinish : base.actualFinish,
    actualDuration: 'actualDuration' in partial ? partial.actualDuration : base.actualDuration,
    remainingTime: 'remainingTime' in partial ? partial.remainingTime : base.remainingTime,
    remainingMinutes: 'remainingMinutes' in partial ? partial.remainingMinutes : base.remainingMinutes,
    resume: 'resume' in partial ? partial.resume : base.resume,
    stop: 'stop' in partial ? partial.stop : base.stop,
  };
  if (merged.durationUnit === 'days') {
    merged.durationMinutes = undefined;
  } else if (merged.durationMinutes == null && taskDurationUnitOfTime(base) === 'hours') {
    merged.durationMinutes = base.durationMinutes;
  }
  return merged;
}

function taskDurationUnitOfTime(time: TaskTime): TaskDurationUnit {
  const legacy = time as TaskTime & { durationUnit?: TaskDurationUnit };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

export function normalizeTaskDurationUnits(tasks: Task[]): Task[] {
  let changed = false;
  const out = tasks.map((task) => {
    const next = normalizeTaskDurationUnit(task);
    if (next !== task) changed = true;
    return next;
  });
  return changed ? out : tasks;
}

function normalizeTaskDurationUnit(task: Task): Task {
  if (!task?.time) return task;
  const legacy = task.time as TaskTime & { durationUnit?: TaskDurationUnit };
  const durationUnit = legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
  if (legacy.durationUnit === durationUnit && !(durationUnit === 'days' && legacy.durationMinutes != null)) {
    return task;
  }
  const time: TaskTime = { ...legacy, durationUnit };
  if (durationUnit === 'days') time.durationMinutes = undefined;
  return { ...task, time };
}

const TIMEPHASED_WINDOW_TIME_TRIGGERS = new Set<keyof TaskTime>([
  'scheduleDuration', 'durationMinutes', 'durationUnit', 'scheduleStart', 'scheduleFinish', 'durationType',
]);

const LEVELING_GAP_TIME_TRIGGERS = new Set<keyof TaskTime>([
  ...TIMEPHASED_WINDOW_TIME_TRIGGERS,
  'completion', 'actualStart', 'actualFinish',
]);

const LEVELING_GAP_TASK_TRIGGERS = ['calendarId', 'constraint', 'constraint2'] as const satisfies readonly (keyof Task)[];

export interface TaskTriggerChanges {
  timeBase: boolean;
  calendar: boolean;
  levelingGaps: boolean;
}

export type TaskTriggerFields = Pick<Task, 'time' | (typeof LEVELING_GAP_TASK_TRIGGERS)[number]>;

function timeTriggersChanged(before: TaskTime, after: TaskTime, keys: ReadonlySet<keyof TaskTime>): boolean {
  for (const key of keys) {
    const changed = key === 'durationUnit'
      ? taskDurationUnitOfTime(before) !== taskDurationUnitOfTime(after)
      : !sameValue(before[key], after[key]);
    if (changed) return true;
  }
  return false;
}

export function taskTriggerChanges(before: TaskTriggerFields, after: TaskTriggerFields): TaskTriggerChanges {
  const timeBase = timeTriggersChanged(before.time, after.time, TIMEPHASED_WINDOW_TIME_TRIGGERS);
  const calendar = !sameValue(before.calendarId, after.calendarId);
  const levelingGaps = timeBase
    || LEVELING_GAP_TASK_TRIGGERS.some((k) => !sameValue(before[k], after[k]))
    || timeTriggersChanged(before.time, after.time, LEVELING_GAP_TIME_TRIGGERS);
  return { timeBase, calendar, levelingGaps };
}

export function mergeTaskUpdate(task: Task, updates: Partial<Task>): Task {
  const { time, ...rest } = updates;
  return { ...task, ...rest, time: time ? mergeTaskTime(task.time, time) : task.time };
}

export function clearTimephasedWindow(task: Task): boolean {
  let cleared = false;
  if (task.timephasedFinishFloor !== undefined) { delete task.timephasedFinishFloor; cleared = true; }
  if (task.timephasedStartAnchor !== undefined) { delete task.timephasedStartAnchor; cleared = true; }
  return cleared;
}

export function clearTimephasedDurationWalks(task: Task): boolean {
  if (task.timephasedDurationWalks !== undefined) { delete task.timephasedDurationWalks; return true; }
  return false;
}

export function clearLevelingGaps(task: Task): boolean {
  const gaps = task.splitGaps;
  if (!gaps || gaps.length === 0) return false;
  const kept = gaps.filter(g => g.source !== 'leveling');
  if (kept.length === gaps.length) return false;
  task.splitGaps = kept.length > 0 ? kept : undefined;
  return true;
}

export function hasLevelingOutput(task: Task): boolean {
  return task.levelingDelay !== undefined
    || task.levelingDelayMinutes !== undefined
    || task.levelingDelayElapsed !== undefined
    || (task.splitGaps ?? []).some(g => g.source === 'leveling');
}

function dropSubDayLevelingDelay(task: Task): boolean {
  const rounded = task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined;
  task.levelingDelayMinutes = undefined;
  task.levelingDelayElapsed = undefined;
  return rounded;
}

export function clearLevelingOutput(task: Task): boolean {
  task.levelingDelay = undefined;
  const rounded = dropSubDayLevelingDelay(task);
  clearLevelingGaps(task);
  return rounded;
}

export function writeLevelingResult(
  tasks: Task[],
  write: Pick<LevelingResult, 'delays' | 'gaps' | 'delayMinutes'>,
  scopeTaskIds?: string[],
): number {
  const scope = scopeTaskIds ? new Set(scopeTaskIds) : null;
  let roundedCount = 0;
  for (const task of tasks) {
    if (scope && !scope.has(task.id)) continue;
    const d = write.delays[task.id];
    task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
    if (dropSubDayLevelingDelay(task) && !write.delayMinutes) roundedCount++;
    const m = write.delayMinutes?.[task.id];
    if (task.levelingDelay !== undefined && m !== undefined && Number.isFinite(m) && m > 0) {
      task.levelingDelayMinutes = Math.round(m);
    }
    const g = write.gaps[task.id];
    if (g !== undefined) task.splitGaps = g.length > 0 ? g : undefined;
    else clearLevelingGaps(task);
  }
  return roundedCount;
}

export function invalidateForTimeBaseChange(task: Task): boolean {
  if (task.time.progressBeforeRecalculation) task.time.progressBeforeRecalculation = undefined;
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = timephasedDurationWalksHaveFrozenWork(task) && clearTimephasedDurationWalks(task);
  return clearedWindow || clearedWalks;
}

export function invalidateForAssignmentChange(task: Task): boolean {
  if (task.time.progressBeforeRecalculation) task.time.progressBeforeRecalculation = undefined;
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = clearTimephasedDurationWalks(task);
  clearLevelingGaps(task);
  return clearedWindow || clearedWalks;
}

export function taskHasActiveTimephasedSteering(task: Task): boolean {
  return task.timephasedFinishFloor !== undefined
    || task.timephasedStartAnchor !== undefined
    || (task.timephasedDurationWalks?.length ?? 0) > 0;
}

export function taskHasTimephasedContours(task: Task): boolean {
  return (task.timephasedContours?.length ?? 0) > 0;
}

export function timephasedDurationWalksHaveFrozenWork(task: Task): boolean {
  return (task.timephasedDurationWalks ?? []).some((w) => w.workMinutes !== undefined);
}

export function taskCalendarHoursPerDay(task: Task, calendars: WorkCalendar[], projectCalendar: WorkCalendar): number {
  return effHoursPerDay(resolveCalendar(task.calendarId, calendars, projectCalendar));
}

export function taskWorkMinutesOf(task: Task, hoursPerDay: number): number {
  return taskAxisMinutes(task.time, hoursPerDay);
}

export function rescaleTaskContours(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  keepWork: boolean = task.mspTaskType === 'FIXED_WORK',
  opts?: { keepGaps?: boolean },
): boolean {
  const contours = task.timephasedContours;
  if (!contours || contours.length === 0) return false;
  const newWorkMinutes = taskAxisMinutes(task.time, hoursPerDay);
  const reference = contours.reduce((best, c) => {
    const span = c.periods.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0);
    return span > best.span ? { span, periods: c.periods } : best;
  }, { span: -1, periods: contours[0].periods });
  if (!rescaleFactor(reference.periods, oldWorkMinutes, newWorkMinutes)) return false;
  task.timephasedContours = contours.map((c) => ({
    ...c,
    periods: rescaleContourForDuration(c.periods, oldWorkMinutes, newWorkMinutes, keepWork ? 'FIXED_WORK' : undefined),
  }));
  if (!opts?.keepGaps) {
    const gaps = rescaleSplitGaps(
      task.splitGaps, reference.periods, oldWorkMinutes, newWorkMinutes,
      splitUnitMinutes(task, hoursPerDay),
    );
    if (gaps !== undefined) task.splitGaps = gaps;
  }
  return true;
}

export function applyDurationChangeRules(
  task: Task,
  oldWorkMinutes: number,
  hoursPerDay: number,
  opts?: { rescaleContours?: boolean; keepWork?: boolean },
): boolean {
  const rescaled = opts?.rescaleContours !== false
    && rescaleTaskContours(task, oldWorkMinutes, hoursPerDay, opts?.keepWork);
  if (!rescaled && task.splitGaps !== undefined) {
    const newWorkMinutes = taskAxisMinutes(task.time, hoursPerDay);
    if (newWorkMinutes < oldWorkMinutes - 1e-6) {
      const clipped = clipUserGapsToWork(task.splitGaps, newWorkMinutes);
      task.splitGaps = clipped && clipped.length > 0 ? clipped : undefined;
    }
  }
  const lost = invalidateForTimeBaseChange(task);
  clearLevelingGaps(task);
  return lost;
}
