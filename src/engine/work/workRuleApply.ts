import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import { isCostResource, resourceDrivesDuration, type Resource, type ResourceAssignment } from '@/types/resource';
import type { Task, TaskTime } from '@/types/task';
import { applyProgressInvariants, defaultActualStart, hourRemainingDays, type PlannedProgressDates } from '@/engine/taskMutationRules';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { storedWorkDeviates } from '@/engine/work/workDeviation';
import { contourIndexForAssignment, taskAxisMinutes, taskWorkMinutes } from '@/engine/contour/contourEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { finishOfTaskDuration, taskDurationUnit } from '@/engine/scheduler/duration';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import { durationHoursPerDay, effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import {
  applyDurationChangeRules, contourKeepsWork, effectiveEffortDriven,
  hourInputFinishBasis, reconcileHourInputFinish, rescaleTaskContours,
  type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  applyAssignmentAdded, applyAssignmentRemoved, applyDurationEdit, applyRuleChange, applySlotChange,
  applyUnitsEdit, applyWorkEdit, durationEditKeepsWork, type TriangleAssignment, type TriangleState,
} from '@/engine/work/workTriangle';

export interface WorkRuleContext {
  hoursPerDay: number;
  defaultWorkRule?: WorkRule;
  resourceById?: (id: string) => Resource | undefined;
}

export function effectiveWorkRule(task: Pick<Task, 'workRule'>, defaultWorkRule?: WorkRule): WorkRule {
  return task.workRule ?? defaultWorkRule ?? DEFAULT_WORK_RULE;
}

export function durationEditKeepsWorkOf(
  task: Pick<Task, 'workRule' | 'mspTaskType' | 'effortDriven'>,
  defaultWorkRule?: WorkRule,
): boolean {
  return durationEditKeepsWork(effectiveWorkRule(task, defaultWorkRule), effectiveEffortDriven(task));
}

export function workRuleApplies(task: Task): boolean {
  return task.childIds.length === 0
    && !task.isMilestone
    && task.isHammock !== true
    && task.time.durationType !== 'ELAPSEDTIME';
}

export function slotMinutesOf(ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  return Math.max(1, ctx.hoursPerDay * 60);
}

export function isHourTask(t: Task['time']): t is Task['time'] & { durationMinutes: number } {
  return t.durationUnit === 'hours' && typeof t.durationMinutes === 'number' && Number.isFinite(t.durationMinutes);
}

export function remainingMinutesOf(task: Task, ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  const t = task.time;
  const slot = slotMinutesOf(ctx);
  if (isHourTask(t)) {
    const rem = t.remainingMinutes ?? t.durationMinutes * (1 - (t.completion ?? 0));
    return Math.max(0, rem);
  }
  const days = t.remainingTime ?? t.scheduleDuration * (1 - (t.completion ?? 0));
  return Math.max(0, days) * slot;
}

export function totalMinutesOf(task: Task, ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  return taskWorkMinutes(task.time, ctx.hoursPerDay);
}

function drivesDuration(assignment: ResourceAssignment, ctx: WorkRuleContext): boolean {
  return resourceDrivesDuration(ctx.resourceById?.(assignment.resourceId));
}

function contourOwn(own: readonly ResourceAssignment[], ctx: WorkRuleContext): ResourceAssignment[] {
  return own.filter(a => !isCostResource(ctx.resourceById?.(a.resourceId)));
}

function inTriangle(resourceId: string, ctx: WorkRuleContext): boolean {
  return ctx.resourceById?.(resourceId)?.type !== 'COST';
}

export function triangleStateOf(task: Task, assignments: readonly ResourceAssignment[], ctx: WorkRuleContext): TriangleState {
  return {
    rule: effectiveWorkRule(task, ctx.defaultWorkRule),
    effortDriven: effectiveEffortDriven(task),
    remainingMinutes: remainingMinutesOf(task, ctx),
    slotMinutes: slotMinutesOf(ctx),
    assignments: assignments
      .filter((a) => a.taskId === task.id && inTriangle(a.resourceId, ctx))
      .map((a): TriangleAssignment => ({
        id: a.id,
        unitsPerDay: a.unitsPerDay,
        drivesDuration: drivesDuration(a, ctx),
        ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
      })),
  };
}

export interface TriangleWriteBack {
  durationChanged: boolean;
  changedAssignmentIds: string[];
}

export function applyTriangleResult(
  task: Task,
  assignments: ResourceAssignment[],
  before: TriangleState,
  after: TriangleState,
  ctx: WorkRuleContext,
  opts?: { skipDuration?: boolean; actualWork?: ReadonlyMap<string, number> },
): TriangleWriteBack {
  const changed: string[] = [];
  const started = (task.time.completion ?? 0) > 0 || !!task.time.actualStart;
  for (const next of after.assignments) {
    const a = assignments.find((x) => x.id === next.id);
    if (!a) continue;
    const unitsChanged = Math.abs(a.unitsPerDay - next.unitsPerDay) > 1e-9;
    const newcomer = next.drivesDuration && started && !before.assignments.some(x => x.id === a.id);
    const actual = opts?.actualWork?.get(a.id) ?? (newcomer ? 0 : undefined);
    const actualChanged = a.actualWorkMinutes === undefined && actual !== undefined;
    const work = next.remainingWorkMinutes
      ?? (next.drivesDuration && (a.actualWorkMinutes !== undefined || actual !== undefined)
        ? after.remainingMinutes * next.unitsPerDay : undefined);
    const workChanged = (a.remainingWorkMinutes === undefined) !== (work === undefined)
      || (work !== undefined && a.remainingWorkMinutes !== undefined
        && Math.abs(a.remainingWorkMinutes - work) > 1e-6);
    if (!unitsChanged && !workChanged && !actualChanged) continue;
    if (actualChanged) a.actualWorkMinutes = actual;
    if (unitsChanged) a.unitsPerDay = next.unitsPerDay;
    if (work === undefined) delete a.remainingWorkMinutes;
    else a.remainingWorkMinutes = work;
    changed.push(a.id);
  }

  reconcileContourWork(task, assignments, changed, ctx);

  let durationChanged = false;
  if (!opts?.skipDuration && Math.abs(after.remainingMinutes - before.remainingMinutes) > 1e-6) {
    const slot = slotMinutesOf(ctx);
    const total = totalMinutesOf(task, ctx);
    const doneMinutes = Math.max(0, total - before.remainingMinutes);
    const newTotal = doneMinutes + after.remainingMinutes;
    const t = task.time;
    const started = (t.completion ?? 0) > 0 || !!t.actualStart;
    if (isHourTask(t)) {
      t.durationMinutes = newTotal;
      t.scheduleDuration = t.durationMinutes / slot;
      if (started || t.remainingMinutes !== undefined) {
        t.remainingMinutes = Math.max(0, after.remainingMinutes);
        t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
        syncCompletionToRemaining(task);
      }
    } else {
      t.scheduleDuration = Math.max(0, newTotal / slot);
      delete t.durationMinutes;
      if (started || t.remainingTime !== undefined) {
        t.remainingTime = Math.max(0, after.remainingMinutes / slot);
        syncCompletionToRemaining(task);
      }
    }
    durationChanged = true;
  }
  return { durationChanged, changedAssignmentIds: changed };
}

export function syncCompletionToRemaining(task: Task): void {
  const t = task.time;
  let completion: number;
  if (isHourTask(t)) {
    if (t.remainingMinutes === undefined) return;
    completion = t.durationMinutes > 0 ? Math.max(0, Math.min(1, 1 - t.remainingMinutes / t.durationMinutes)) : 1;
  } else {
    if (t.remainingTime === undefined) return;
    completion = t.scheduleDuration > 0 ? Math.max(0, Math.min(1, 1 - t.remainingTime / t.scheduleDuration)) : 1;
  }
  t.completion = completion;
  if (completion > 0 && !t.actualStart) t.actualStart = t.earlyStart || t.scheduleStart;
  if (completion < 1) t.actualFinish = undefined;
}

function reconcileContourWork(
  task: Task,
  assignments: readonly ResourceAssignment[],
  changedIds: readonly string[],
  ctx: WorkRuleContext,
): void {
  const contours = task.timephasedContours;
  if (!contours || contours.length === 0 || changedIds.length === 0) return;
  const siblings = contourOwn(assignments.filter((a) => a.taskId === task.id), ctx);
  let next = contours;
  for (const id of changedIds) {
    const a = siblings.find((x) => x.id === id);
    if (!a || a.remainingWorkMinutes === undefined) continue;
    const idx = contourIndexForAssignment(next, siblings, id);
    if (idx < 0) continue;
    const periods = next[idx].periods;
    const remainingSum = periods.reduce((s, p) => s + (p.kind === 'actual' ? 0 : p.workMinutes), 0);
    if (!(remainingSum > 0) || Math.abs(remainingSum - a.remainingWorkMinutes) < 1e-6) continue;
    const factor = a.remainingWorkMinutes / remainingSum;
    next = next.map((c, i) => (i === idx
      ? { ...c, periods: c.periods.map((p) => (p.kind === 'actual' ? p : { ...p, workMinutes: p.workMinutes * factor })) }
      : c));
  }
  if (next !== contours) task.timephasedContours = next;
}

export interface WorkRuleDeps {
  calendars: readonly WorkCalendar[];
  calendar: WorkCalendar;
  project: Pick<Project, 'defaultWorkRule'>;
  resources: readonly Resource[];
}

export function workRuleContextOf(task: Task, deps: WorkRuleDeps): WorkRuleContext {
  const resources = deps.resources;
  return {
    hoursPerDay: effHoursPerDay(resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar)),
    ...(deps.project.defaultWorkRule !== undefined ? { defaultWorkRule: deps.project.defaultWorkRule } : {}),
    resourceById: (id) => resources.find((r) => r.id === id),
  };
}

export interface CapturedTriangle {
  state: TriangleState;
  ctx: WorkRuleContext;
  totalMinutes: number;
  finishBasis: HourInputFinishBasis;
  time: TaskTime;
  assignments: ResourceAssignment[];
  actualWork: ReadonlyMap<string, number>;
}

export function captureTriangle(task: Task, assignments: readonly ResourceAssignment[], deps: WorkRuleDeps): CapturedTriangle | null {
  if (!workRuleApplies(task)) return null;
  const ctx = workRuleContextOf(task, deps);
  const own = assignments.filter((a) => a.taskId === task.id);
  const state = triangleStateOf(task, own, ctx);
  const totalMinutes = totalMinutesOf(task, ctx);
  const doneMinutes = Math.max(0, totalMinutes - state.remainingMinutes);
  const actualWork = new Map<string, number>();
  const contourList = contourOwn(own, ctx);
  for (const a of own) {
    if (a.actualWorkMinutes !== undefined || !drivesDuration(a, ctx)) continue;
    const idx = contourIndexForAssignment(task.timephasedContours, contourList, a.id);
    const periods = idx < 0 ? [] : task.timephasedContours![idx].periods;
    const actuals = periods.filter(p => p.kind === 'actual');
    const done = actuals.length > 0
      ? actuals.reduce((sum, p) => sum + p.workMinutes, 0)
      : doneMinutes * a.unitsPerDay;
    if (done > 0 || actuals.length > 0) actualWork.set(a.id, done);
  }
  return {
    state, ctx, totalMinutes, actualWork,
    finishBasis: hourInputFinishBasis(task), time: { ...task.time }, assignments: own,
  };
}

const NO_CHANGE: TriangleWriteBack = { durationChanged: false, changedAssignmentIds: [] };

function settleCompletedWork(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle,
): TriangleWriteBack | null {
  if (captured.time.completion !== 1 || captured.state.remainingMinutes !== 0) return null;
  const after = triangleStateOf(task, assignments, captured.ctx);
  if (after.assignments.some(a => !Number.isFinite(a.unitsPerDay) || a.unitsPerDay <= 0)) return null;
  return applyTriangleResult(task, assignments, captured.state, after, captured.ctx, {
    skipDuration: true, actualWork: captured.actualWork,
  });
}

export interface RecomputedRemainingWork {
  taskId: string;
  taskName: string;
  assignmentId: string;
  resourceId: string;
  beforeMinutes: number;
  afterMinutes: number;
}

export interface DurationEditWriteBack extends TriangleWriteBack {
  recomputedWork: RecomputedRemainingWork[];
}

const NO_DURATION_CHANGE: DurationEditWriteBack = { ...NO_CHANGE, recomputedWork: [] };

export function settleDurationEdit(task: Task, captured: CapturedTriangle | null): DurationEditWriteBack {
  if (!captured) return NO_DURATION_CHANGE;
  const newTotal = totalMinutesOf(task, captured.ctx);
  if (Math.abs(newTotal - captured.totalMinutes) < 1e-6) return NO_DURATION_CHANGE;
  followRemainingOfUnstartedTask(task, captured.time);
  const newRemaining = remainingMinutesOf(task, captured.ctx);
  if (Math.abs(newRemaining - captured.state.remainingMinutes) < 1e-6) return NO_DURATION_CHANGE;
  const doneBefore = captured.totalMinutes - captured.state.remainingMinutes;
  const completedByShortening = newRemaining < 1e-6 && task.time.completion >= 1
    && Math.abs(newTotal - doneBefore) < 1e-6;
  const result = completedByShortening
    ? completedByDurationEdit(captured.state)
    : applyDurationEdit(captured.state, newRemaining);
  if (!result.ok) return NO_DURATION_CHANGE;
  const own = captured.assignments;
  const deviating = deviatingStoredWork(task, contourOwn(own, captured.ctx), captured.state);
  const written = applyTriangleResult(task, own, captured.state, result.state, captured.ctx, { skipDuration: true, actualWork: captured.actualWork });
  const recomputedWork: RecomputedRemainingWork[] = [];
  for (const before of deviating) {
    const after = own.find((a) => a.id === before.id);
    if (!after || after.remainingWorkMinutes === undefined) continue;
    if (Math.abs(after.remainingWorkMinutes - before.minutes) <= 1e-6) continue;
    recomputedWork.push({
      taskId: task.id, taskName: task.name, assignmentId: after.id, resourceId: after.resourceId,
      beforeMinutes: before.minutes, afterMinutes: after.remainingWorkMinutes,
    });
  }
  return { ...written, recomputedWork };
}

function completedByDurationEdit(state: TriangleState): { ok: true; state: TriangleState } {
  return {
    ok: true,
    state: {
      ...state,
      remainingMinutes: 0,
      assignments: state.assignments.map((a) => (a.drivesDuration ? { ...a, remainingWorkMinutes: 0 } : a)),
    },
  };
}

function followRemainingOfUnstartedTask(task: Task, before: TaskTime): void {
  const t = task.time;
  if (task.isMilestone) return;
  if (t.remainingTime === undefined && t.remainingMinutes === undefined) return;
  const unstarted = (time: TaskTime) => !(time.completion > 0) && !time.actualStart && !time.actualFinish;
  if (!unstarted(before) || !unstarted(t)) return;
  const progressTouched = t.completion !== before.completion
    || t.remainingTime !== before.remainingTime || t.remainingMinutes !== before.remainingMinutes;
  if (progressTouched) return;
  if (isHourTask(t)) {
    t.remainingMinutes = t.durationMinutes;
    t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
  } else t.remainingTime = t.scheduleDuration;
}

function deviatingStoredWork(
  task: Task,
  own: readonly ResourceAssignment[],
  before: TriangleState,
): { id: string; minutes: number }[] {
  const out: { id: string; minutes: number }[] = [];
  const contoured = (task.timephasedContours?.length ?? 0) > 0;
  for (const a of before.assignments) {
    if (!a.drivesDuration || a.remainingWorkMinutes === undefined) continue;
    if (contoured && contourIndexForAssignment(task.timephasedContours, own, a.id) >= 0) continue;
    if (!storedWorkDeviates(a.remainingWorkMinutes, before.remainingMinutes * a.unitsPerDay)) continue;
    out.push({ id: a.id, minutes: a.remainingWorkMinutes });
  }
  return out;
}

export function settleUnitsEdit(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  assignmentId: string,
  newUnitsPerDay: number,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const completed = settleCompletedWork(task, assignments, captured);
  if (completed) return completed;
  const result = applyUnitsEdit(captured.state, assignmentId, newUnitsPerDay);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

export interface TrianglePlan {
  captured: CapturedTriangle;
  after: TriangleState;
}

export function planWorkEdit(
  task: Task,
  assignments: readonly ResourceAssignment[],
  deps: WorkRuleDeps,
  assignmentId: string,
  newWorkMinutes: number,
): TrianglePlan | null {
  const captured = captureTriangle(task, assignments, deps);
  if (!captured) return null;
  const result = applyWorkEdit(captured.state, assignmentId, newWorkMinutes);
  if (!result.ok) return null;
  return { captured, after: result.state };
}

export function commitTrianglePlan(task: Task, assignments: ResourceAssignment[], plan: TrianglePlan): TriangleWriteBack {
  return applyTriangleResult(task, assignments, plan.captured.state, plan.after, plan.captured.ctx, { actualWork: plan.captured.actualWork });
}

export function settleWorkEdit(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  assignmentId: string,
  newWorkMinutes: number,
): TriangleWriteBack | null {
  const plan = planWorkEdit(task, assignments, deps, assignmentId, newWorkMinutes);
  return plan ? commitTrianglePlan(task, assignments, plan) : null;
}

export function settleAssignmentAdded(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  added: ResourceAssignment,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  if (!inTriangle(added.resourceId, captured.ctx)) return NO_CHANGE;
  const completed = settleCompletedWork(task, assignments, captured);
  if (completed) return completed;
  const resource = captured.ctx.resourceById?.(added.resourceId);
  const result = applyAssignmentAdded(captured.state, {
    id: added.id, unitsPerDay: added.unitsPerDay, drivesDuration: resourceDrivesDuration(resource),
  });
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

export function settleAssignmentRemoved(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  removedId: string,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const result = applyAssignmentRemoved(captured.state, removedId);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

export interface RuleChangeWriteBack extends TriangleWriteBack {
  durationUnitChanged: boolean;
}

export function settleRuleChange(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  rule: WorkRule | undefined,
): RuleChangeWriteBack {
  const captured = captureTriangle(task, assignments, deps);
  if (rule === undefined) delete task.workRule; else task.workRule = rule;
  if (!captured) return NO_RULE_CHANGE;
  return settleEffectiveRuleChange(task, assignments, captured, effectiveWorkRule(task, captured.ctx.defaultWorkRule));
}

const NO_RULE_CHANGE: RuleChangeWriteBack = { ...NO_CHANGE, durationUnitChanged: false };

export function settleDefaultRuleChange(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  nextDefault: WorkRule | undefined,
): RuleChangeWriteBack {
  if (task.workRule !== undefined) return NO_RULE_CHANGE;
  const captured = captureTriangle(task, assignments, deps);
  if (!captured) return NO_RULE_CHANGE;
  const rule = effectiveWorkRule(task, nextDefault);
  if (rule === effectiveWorkRule(task, captured.ctx.defaultWorkRule)) return NO_RULE_CHANGE;
  const ctx: WorkRuleContext = { ...captured.ctx };
  if (nextDefault === undefined) delete ctx.defaultWorkRule; else ctx.defaultWorkRule = nextDefault;
  return settleEffectiveRuleChange(task, assignments, { ...captured, ctx }, rule);
}

function writeHourMeasure(task: Task, totalMinutes: number, remainingMinutes: number): void {
  const t = task.time;
  t.durationUnit = 'hours';
  t.durationMinutes = totalMinutes;
  if (t.remainingTime !== undefined || t.completion > 0 || t.actualStart) {
    t.remainingMinutes = remainingMinutes;
    t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
  } else delete t.remainingMinutes;
}

export function settleFixedWorkMeasure(task: Task, deps: WorkRuleDeps): boolean {
  if (task.time.durationUnit === 'hours') return false;
  if (effectiveWorkRule(task, deps.project.defaultWorkRule) !== 'FIXED_WORK' || !workRuleApplies(task)) return false;
  const ctx = workRuleContextOf(task, deps);
  writeHourMeasure(task, totalMinutesOf(task, ctx), remainingMinutesOf(task, ctx));
  return true;
}

function settleEffectiveRuleChange(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle,
  effectiveRule: WorkRule,
): RuleChangeWriteBack {
  const durationUnitChanged = effectiveRule === 'FIXED_WORK' && task.time.durationUnit !== 'hours';
  if (durationUnitChanged) writeHourMeasure(task, captured.totalMinutes, captured.state.remainingMinutes);
  const result = applyRuleChange(captured.state, effectiveRule);
  const written = result.ok
    ? applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork })
    : NO_CHANGE;
  return { ...written, durationUnitChanged };
}

export function routeFixedWorkDurationToHours(
  task: Task,
  before: TaskTime,
  after: TaskTime,
  defaultWorkRule: WorkRule | undefined,
  hoursPerDay: number,
): boolean {
  if (effectiveWorkRule(task, defaultWorkRule) !== 'FIXED_WORK') return false;
  if (!workRuleApplies({ ...task, time: after })) return false;
  const daysInput = after.durationUnit === 'days'
    ? before.durationUnit !== 'days' || after.scheduleDuration !== before.scheduleDuration
    : after.durationMinutes === before.durationMinutes && after.scheduleDuration !== before.scheduleDuration;
  if (!daysInput) return false;
  return writeDaysAsHours(after, hoursPerDay);
}

export function writeDaysAsHours(time: TaskTime, hoursPerDay: number): boolean {
  if (!(Number.isFinite(hoursPerDay) && hoursPerDay > 0)) return false;
  if (!Number.isFinite(time.scheduleDuration) || time.scheduleDuration < 0) return false;
  const slot = hoursPerDay * 60;
  time.durationUnit = 'hours';
  time.durationMinutes = time.scheduleDuration * slot;
  time.scheduleDuration = time.durationMinutes / slot;
  return true;
}

export function hourSourceOf(time: TaskTime): Pick<TaskTime, 'durationUnit' | 'durationMinutes' | 'scheduleDuration'> {
  return { durationUnit: time.durationUnit, durationMinutes: time.durationMinutes, scheduleDuration: time.scheduleDuration };
}

export function settleDurationAftermath(
  task: Task,
  deps: WorkRuleDeps,
  oldWorkMinutes: number,
  finishBasis: HourInputFinishBasis,
): boolean {
  const hpd = workRuleContextOf(task, deps).hoursPerDay;
  const lost = applyDurationChangeRules(task, oldWorkMinutes, hpd, {
    keepWork: contourKeepsWork(task, deps.project.defaultWorkRule),
  });
  reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar));
  return lost;
}

export interface CalendarCapture {
  triangle: CapturedTriangle | null;
  oldWorkMinutes: number;
  finishBasis: HourInputFinishBasis;
}

export function captureCalendarChange(task: Task, assignments: readonly ResourceAssignment[], deps: WorkRuleDeps): CalendarCapture {
  return {
    triangle: captureTriangle(task, assignments, deps),
    oldWorkMinutes: totalMinutesOf(task, workRuleContextOf(task, deps)),
    finishBasis: hourInputFinishBasis(task),
  };
}

export interface CalendarSettle {
  durationChanged: boolean;
  timephasedLost: boolean;
}

const NO_CALENDAR_CHANGE: CalendarSettle = { durationChanged: false, timephasedLost: false };

export function settleCalendarChange(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CalendarCapture,
  deps: WorkRuleDeps,
): CalendarSettle {
  const { triangle } = captured;
  if (isHourTask(task.time)) {
    if (task.childIds.length === 0 && !task.isHammock) {
      task.time.scheduleDuration = hourTaskScheduleDuration(task.time.durationMinutes,
        resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar));
      if (task.time.remainingTime !== undefined && task.time.remainingMinutes !== undefined) {
        task.time.remainingTime = hourRemainingDays(task.time, task.time.remainingMinutes);
      }
    }
    return NO_CALENDAR_CHANGE;
  }
  if (!triangle) return NO_CALENDAR_CHANGE;
  const ctx = workRuleContextOf(task, deps);
  const newSlot = slotMinutesOf(ctx);
  if (newSlot === triangle.state.slotMinutes) return NO_CALENDAR_CHANGE;
  const remainingDays = triangle.state.remainingMinutes / triangle.state.slotMinutes;
  const newRemaining = remainingDays * newSlot;
  const result = applySlotChange(triangle.state, newSlot, newRemaining);
  rescaleTaskContours(task, captured.oldWorkMinutes, ctx.hoursPerDay, false);
  const slotWorkMinutes = totalMinutesOf(task, ctx);
  let durationChanged = false;
  let timephasedLost = false;
  if (result.ok) {
    const beforeInNewSlot: TriangleState = { ...triangle.state, slotMinutes: newSlot, remainingMinutes: newRemaining };
    const written = applyTriangleResult(task, assignments, beforeInNewSlot, result.state, ctx, { actualWork: triangle.actualWork });
    if (written.durationChanged) {
      durationChanged = true;
      timephasedLost = settleDurationAftermath(task, deps, slotWorkMinutes, captured.finishBasis);
    }
  }
  reconcileContourWork(task, assignments, assignments.filter((a) => a.taskId === task.id).map((a) => a.id), ctx);
  return { durationChanged, timephasedLost };
}

export type DurationEditProgress =
  | { refused: true; done: number; unit: 'days' | 'hours' }
  | { refused: false; completion: number; remainingTime: number; remainingMinutes?: number };

export function durationEditProgress(
  task: Pick<Task, 'childIds' | 'isHammock'>,
  before: TaskTime,
  after: TaskTime,
  workHoursPerDay: number,
): DurationEditProgress | null {
  if (task.childIds.length > 0 || task.isHammock === true) return null;
  if (!Number.isFinite(workHoursPerDay) || workHoursPerDay <= 0) return null;
  const hoursPerDay = durationHoursPerDay({ time: after }, workHoursPerDay);
  const running = (before.completion > 0 || !!before.actualStart) && before.completion < 1 && !before.actualFinish;
  if (!running) return null;
  const progressTouched = after.completion !== before.completion
    || after.remainingTime !== before.remainingTime || after.remainingMinutes !== before.remainingMinutes
    || after.actualStart !== before.actualStart || after.actualFinish !== before.actualFinish;
  if (progressTouched) return null;
  const unitBefore = timeUnit(before);
  const unitAfter = timeUnit(after);
  const oldWork = taskWorkMinutes(before, hoursPerDay);
  const newWork = taskWorkMinutes(after, hoursPerDay);
  if (unitBefore === unitAfter && Math.abs(newWork - oldWork) < 1e-9) return null;
  const c = before.completion;
  const doneDays = c * before.scheduleDuration;
  const doneMinutes = c * (before.durationMinutes ?? 0);
  const refusal: DurationEditProgress = unitBefore === 'hours'
    ? { refused: true, done: doneMinutes / 60, unit: 'hours' }
    : { refused: true, done: doneDays, unit: 'days' };
  if (newWork < c * oldWork - 1e-6) return refusal;
  const cap = (value: number) => (value >= 1 - 1e-12 ? 1 : value);

  if (unitBefore === 'days' && unitAfter === 'days') {
    const remaining = (before.remainingTime ?? before.scheduleDuration * (1 - c))
      + (after.scheduleDuration - before.scheduleDuration);
    if (remaining < -1e-9) return refusal;
    const completion = after.scheduleDuration > 0 ? cap(doneDays / after.scheduleDuration) : c;
    return { refused: false, completion, remainingTime: Math.max(0, remaining) };
  }
  if (unitBefore === 'hours' && unitAfter === 'hours') {
    const oldMinutes = before.durationMinutes ?? 0;
    const newMinutes = after.durationMinutes ?? 0;
    const remainingMinutes = (before.remainingMinutes ?? oldMinutes * (1 - c)) + (newMinutes - oldMinutes);
    if (remainingMinutes < -1e-9) return refusal;
    const completion = newMinutes > 0 ? cap(doneMinutes / newMinutes) : c;
    const minutes = Math.max(0, remainingMinutes);
    return { refused: false, completion, remainingMinutes: minutes, remainingTime: hourRemainingDays(after, minutes) };
  }
  const completion = newWork > 0 ? cap((c * oldWork) / newWork) : c;
  const oldRemaining = unitBefore === 'hours'
    ? before.remainingMinutes ?? oldWork * (1 - c)
    : (before.remainingTime ?? before.scheduleDuration * (1 - c)) * hoursPerDay * 60;
  const remaining = oldRemaining + (newWork - oldWork);
  if (remaining < -1e-9) return refusal;
  const remainingMinutes = Math.max(0, remaining);
  if (unitAfter === 'hours') {
    return { refused: false, completion, remainingMinutes, remainingTime: hourRemainingDays(after, remainingMinutes) };
  }
  return { refused: false, completion, remainingTime: remainingMinutes / (hoursPerDay * 60) };
}

function timeUnit(time: TaskTime): 'days' | 'hours' {
  return taskDurationUnit({ time } as Task);
}

export function durationEditRefusal(
  task: Pick<Task, 'childIds' | 'isHammock' | 'time'>,
  after: TaskTime,
  workHoursPerDay: number,
): Extract<DurationEditProgress, { refused: true }> | null {
  const change = durationEditProgress(task, task.time, after, workHoursPerDay);
  return change?.refused ? change : null;
}

export function durationCompletionDates(
  task: Task, before: TaskTime, calendar: WorkCalendar | undefined, workdayDurationMeasure: boolean,
): PlannedProgressDates | undefined {
  if (!calendar || task.isMilestone || task.isHammock || task.childIds.length > 0
    || !(before.completion > 0 || before.actualStart) || before.completion >= 1 || before.actualFinish) return;
  const unit = timeUnit(task.time);
  if (unit === timeUnit(before) && (unit === 'hours'
    ? task.time.durationMinutes === before.durationMinutes
    : task.time.scheduleDuration === before.scheduleDuration)) return;
  const earlyStart = task.time.actualStart ?? defaultActualStart(task.time);
  const start = parseInstant(earlyStart);
  if (!Number.isFinite(start.getTime())) return undefined;
  const engine = new CalendarEngine(calendarForEngine(calendar));
  const workdays = workdayDurationMeasure && taskDurationUnit(task) === 'days';
  const finish = finishOfTaskDuration(task, engine, start, workdays);
  return { earlyStart, earlyFinish: formatInstant(finish, 'hour') };
}

export function finishDurationProgress(
  task: Task, before: TaskTime, statusDate: string | undefined, calendar: WorkCalendar | undefined,
  workdayDurationMeasure: boolean,
): void {
  applyProgressInvariants(task, statusDate, calendar, durationCompletionDates(task, before, calendar, workdayDurationMeasure));
}

export function settleEditedDuration(
  task: Task, before: TaskTime, workHoursPerDay: number,
  { statusDate, calendar, workdayDurationMeasure, keepWork, rescaleContours, deferCompletion }: {
    statusDate?: string; calendar?: WorkCalendar; workdayDurationMeasure: boolean;
    keepWork?: boolean; rescaleContours?: boolean; deferCompletion?: boolean;
  },
): { progress: DurationEditProgress | null; timephasedLost: boolean } {
  const change = durationEditProgress(task, before, task.time, workHoursPerDay);
  if (change?.refused) return { progress: change, timephasedLost: false };
  const progress = task.isMilestone ? null : change;
  if (progress) {
    task.time.completion = progress.completion;
    task.time.remainingTime = progress.remainingTime;
    if (progress.remainingMinutes !== undefined) task.time.remainingMinutes = progress.remainingMinutes;
    else delete task.time.remainingMinutes;
  }
  const timephasedLost = applyDurationChangeRules(task, taskAxisMinutes(before, workHoursPerDay), workHoursPerDay, {
    keepWork, rescaleContours,
  });
  if (progress && progress.completion >= 1 && !deferCompletion) {
    finishDurationProgress(task, before, statusDate, calendar, workdayDurationMeasure);
  }
  return { progress, timephasedLost };
}

export interface ProgressWorkCapture {
  restMinutes: number;
  totalMinutes: number;
  ctx: WorkRuleContext;
}

export function captureProgressWork(task: Task, deps: WorkRuleDeps): ProgressWorkCapture | null {
  if (task.childIds.length > 0) return null;
  const ctx = workRuleContextOf(task, deps);
  return { restMinutes: remainingMinutesOf(task, ctx), totalMinutes: totalMinutesOf(task, ctx), ctx };
}

export function settleProgressWork(task: Task, assignments: ResourceAssignment[], captured: ProgressWorkCapture | null): string[] {
  if (!captured) return [];
  const total = totalMinutesOf(task, captured.ctx);
  if (Math.abs(total - captured.totalMinutes) > 1e-6) return [];
  const restAfter = remainingMinutesOf(task, captured.ctx);
  const restBefore = captured.restMinutes;
  if (Math.abs(restAfter - restBefore) < 1e-6) return [];
  const changed: string[] = [];
  for (const a of assignments) {
    if (a.taskId !== task.id) continue;
    const w = a.remainingWorkMinutes;
    if (w === undefined || !Number.isFinite(w)) continue;
    const work = Math.max(0, w);
    const doneBefore = a.actualWorkMinutes !== undefined && Number.isFinite(a.actualWorkMinutes)
      ? Math.max(0, a.actualWorkMinutes)
      : Math.max(0, total - restBefore) * a.unitsPerDay;
    const nextRest = restBefore > 1e-6
      ? work * restAfter / restBefore
      : (total > 0 ? (doneBefore + work) * restAfter / total : 0);
    const nextDone = Math.max(0, doneBefore + work - nextRest);
    a.remainingWorkMinutes = nextRest;
    a.actualWorkMinutes = nextDone;
    changed.push(a.id);
  }
  return changed;
}

export function syncAssignmentWorkToContour(
  assignment: ResourceAssignment,
  periods: readonly { kind?: string; workMinutes: number }[] | null,
): boolean {
  if (periods === null) return false;
  let changed = false;
  const hasActualPeriods = periods.some((p) => p.kind === 'actual');
  if (!hasActualPeriods && assignment.actualWorkMinutes !== undefined && assignment.actualWorkMinutes > 0) {
    if (assignment.remainingWorkMinutes !== undefined) {
      const total = periods.reduce((acc, p) => acc + p.workMinutes, 0);
      const rest = Math.max(0, total - assignment.actualWorkMinutes);
      if (Math.abs(rest - assignment.remainingWorkMinutes) > 1e-6) { assignment.remainingWorkMinutes = rest; changed = true; }
    }
    return changed;
  }
  if (assignment.remainingWorkMinutes !== undefined) {
    const rest = periods.reduce((acc, p) => acc + (p.kind === 'actual' ? 0 : p.workMinutes), 0);
    if (Math.abs(rest - assignment.remainingWorkMinutes) > 1e-6) { assignment.remainingWorkMinutes = rest; changed = true; }
  }
  if (assignment.actualWorkMinutes !== undefined) {
    const done = periods.reduce((acc, p) => acc + (p.kind === 'actual' ? p.workMinutes : 0), 0);
    if (Math.abs(done - assignment.actualWorkMinutes) > 1e-6) { assignment.actualWorkMinutes = done; changed = true; }
  }
  return changed;
}

export type AssignmentSettleOp =
  | { kind: 'remove'; assignmentId: string }
  | { kind: 'update'; assignmentId: string; unitsPerDay: number }
  | { kind: 'add'; assignmentId: string; unitsPerDay: number; resourceId: string };

export function settleAssignmentPlan(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  ops: readonly AssignmentSettleOp[],
): TriangleWriteBack {
  if (!captured || ops.length === 0) return NO_CHANGE;
  let state = captured.state;
  const order = { remove: 0, update: 1, add: 2 } as const;
  const known = new Set(captured.state.assignments.map(a => a.id));
  for (const op of [...ops].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (op.kind !== 'add' && !known.has(op.assignmentId)) continue;
    let result;
    if (op.kind === 'remove') result = applyAssignmentRemoved(state, op.assignmentId);
    else if (op.kind === 'update') result = applyUnitsEdit(state, op.assignmentId, op.unitsPerDay);
    else {
      if (!inTriangle(op.resourceId, captured.ctx)) continue;
      const resource = captured.ctx.resourceById?.(op.resourceId);
      result = applyAssignmentAdded(state, {
        id: op.assignmentId, unitsPerDay: op.unitsPerDay, drivesDuration: resourceDrivesDuration(resource),
      });
    }
    if (!result.ok) return NO_CHANGE;
    state = result.state;
  }
  return applyTriangleResult(task, assignments, captured.state, state, captured.ctx, { actualWork: captured.actualWork });
}
