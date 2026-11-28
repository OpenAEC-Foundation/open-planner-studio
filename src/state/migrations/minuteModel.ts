import type { DocumentPayload } from '@/state/documentContract';
import { MINUTE_MODEL_TIME_MODEL } from '@/services/ifc/ifcConstants';
import type { WorkCalendar } from '@/types/calendar';
import type { MilestoneKind, Task, TaskTime } from '@/types/task';
import type { Baseline, BaselineTask } from '@/types/baseline';
import { isElapsedTask, isPinnedComplete, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { settleFixedWorkMeasure, type WorkRuleDeps } from '@/engine/work/workRuleApply';
import { scalarBreakIssue } from '@/utils/effectiveWorkTime';
import {
  blocksClock, dayEndInstant, dayStartInstant, ELAPSED_CLOCK, isDateOnly, isInstant,
  type DayClock, type InstantSide,
} from '@/engine/calendar/workdayRules';

export { MINUTE_MODEL_TIME_MODEL };

export type TaskDateField =
  | 'scheduleStart' | 'earlyStart' | 'lateStart' | 'actualStart' | 'resume'
  | 'scheduleFinish' | 'earlyFinish' | 'lateFinish' | 'actualFinish' | 'stop'
  | 'deadline' | 'constraintStart' | 'constraintFinish'
  | 'externalAnchorStart' | 'externalAnchorFinish'
  | 'baselineStart'
  | 'baselineFinish'
  | 'baselineFinishCompleted';

interface FieldRule {
  side: InstantSide;
  elapsedEnd?: 'exclusive' | 'inclusive';
  milestoneOwn: boolean;
}

const FIELD_RULES: Record<TaskDateField, FieldRule> = {
  scheduleStart: { side: 'start', milestoneOwn: true },
  earlyStart: { side: 'start', milestoneOwn: true },
  lateStart: { side: 'start', milestoneOwn: true },
  actualStart: { side: 'start', milestoneOwn: true },
  resume: { side: 'start', milestoneOwn: false },
  scheduleFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  earlyFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  lateFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
  actualFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
  stop: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  deadline: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  constraintStart: { side: 'start', milestoneOwn: false },
  constraintFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  externalAnchorStart: { side: 'start', milestoneOwn: false },
  externalAnchorFinish: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: false },
  baselineStart: { side: 'start', milestoneOwn: true },
  baselineFinish: { side: 'end', elapsedEnd: 'exclusive', milestoneOwn: true },
  baselineFinishCompleted: { side: 'end', elapsedEnd: 'inclusive', milestoneOwn: true },
};

export function taskDateFieldSide(field: TaskDateField): InstantSide {
  return FIELD_RULES[field].side;
}

export interface TaskDateContext {
  clock: DayClock;
  milestoneKind: MilestoneKind | null;
}

export class DayClockCache {
  private readonly byCalendar = new Map<WorkCalendar, DayClock>();

  constructor(
    readonly projectCalendar: WorkCalendar,
    readonly calendars: readonly WorkCalendar[],
  ) {}

  calendarClock(calendarId: string | undefined): DayClock {
    const cal = resolveCalendar(calendarId, this.calendars as WorkCalendar[], this.projectCalendar);
    let clock = this.byCalendar.get(cal);
    if (!clock) {
      clock = blocksClock(cal);
      this.byCalendar.set(cal, clock);
    }
    return clock;
  }
}

export function taskDateContext(
  task: Task,
  clocks: DayClockCache,
  milestonesAtDayEnd?: ReadonlySet<string>,
): TaskDateContext {
  const clock = isElapsedTask(task) ? ELAPSED_CLOCK : clocks.calendarClock(task.calendarId);
  const milestoneKind = isZeroDurationMilestone(task)
    ? (task.milestoneKind ?? (milestonesAtDayEnd?.has(task.id) ? 'FINISH' : 'START'))
    : null;
  return { clock, milestoneKind };
}

export function normalizeTaskDate(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!isDateOnly(value)) return value;
  const rule = FIELD_RULES[field];
  if (rule.milestoneOwn && ctx.milestoneKind !== null) {
    return ctx.milestoneKind === 'FINISH' ? dayEndInstant(ctx.clock, value) : dayStartInstant(ctx.clock, value);
  }
  if (rule.side === 'start') return dayStartInstant(ctx.clock, value);
  if (ctx.clock.kind === 'elapsed' && rule.elapsedEnd === 'exclusive') return dayStartInstant(ctx.clock, value);
  return dayEndInstant(ctx.clock, value);
}

export function normalizeTaskDateInput(value: string, field: TaskDateField, ctx: TaskDateContext): string | null {
  if (!isDateOnly(value)) return value;
  const rule = FIELD_RULES[field];
  const milestone = rule.milestoneOwn && ctx.milestoneKind !== null;
  if (!milestone && rule.side === 'end' && ctx.clock.kind === 'elapsed') return dayEndInstant(ctx.clock, value);
  return normalizeTaskDate(value, field, ctx);
}

export function constraintDateField(type: string): TaskDateField | null {
  if (type === 'SNET' || type === 'SNLT' || type === 'MSO') return 'constraintStart';
  if (type === 'FNET' || type === 'FNLT' || type === 'MFO') return 'constraintFinish';
  return null;
}

export function externalAnchorField(direction: 'predecessor' | 'successor', relType: string): TaskDateField {
  const letter = direction === 'predecessor' ? relType.charAt(0) : relType.charAt(1);
  return letter === 'F' ? 'externalAnchorFinish' : 'externalAnchorStart';
}

export interface CalendarRepair {
  calendarId: string;
  calendarName: string;
  kind: 'dropBreak' | 'extendEnd';
  before: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
  after: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
}

export interface UnresolvedDate {
  where: 'task' | 'baseline' | 'calendar';
  id: string;
  field: TaskDateField | 'projectEnd' | 'workEndHour';
  value: string;
  reason: 'notADate' | 'noWorkTime' | 'endPastMidnight';
}

export interface MinuteModelReport {
  legacyFile: boolean;
  conversionPending: boolean;
  normalizedCount: number;
  normalizedByField: Partial<Record<TaskDateField | 'projectEnd', number>>;
  calendarRepairs: CalendarRepair[];
  unresolved: UnresolvedDate[];
  fixedWorkToHours: string[];
}

export interface MinuteModelOptions {
  timeModel?: string | null;
  milestonesAtDayEnd?: ReadonlySet<string>;
}

export type MinuteModelPayload = Pick<DocumentPayload, 'project' | 'calendar' | 'calendars' | 'tasks' | 'baselines' | 'resources'>;

export interface MinuteModelMigration<P extends MinuteModelPayload = DocumentPayload> {
  payload: P;
  report: MinuteModelReport;
}

type ScalarFields = CalendarRepair['before'];

function scalarFields(cal: WorkCalendar): ScalarFields {
  return {
    workStartHour: cal.workStartHour,
    workEndHour: cal.workEndHour,
    hoursPerDay: cal.hoursPerDay,
    simpleBreakStartMinute: cal.simpleBreakStartMinute,
    simpleBreakDurationMinutes: cal.simpleBreakDurationMinutes,
  };
}

function repairCalendar(cal: WorkCalendar, repairs: CalendarRepair[], unresolved: UnresolvedDate[]): WorkCalendar {
  if (cal.workTime) return cal;
  let next = cal;
  const startMin = cal.workStartHour * 60;
  const endMin = cal.workEndHour * 60;
  const hasBreak = cal.simpleBreakStartMinute !== undefined || cal.simpleBreakDurationMinutes !== undefined;
  if (hasBreak && scalarBreakIssue(startMin, endMin, cal.simpleBreakStartMinute, cal.simpleBreakDurationMinutes)) {
    const { simpleBreakStartMinute: _s, simpleBreakDurationMinutes: _d, ...rest } = next;
    void _s; void _d;
    const dropped: WorkCalendar = rest;
    repairs.push({ calendarId: cal.id, calendarName: cal.name, kind: 'dropBreak', before: scalarFields(next), after: scalarFields(dropped) });
    next = dropped;
  }
  const noBreak = next.simpleBreakStartMinute === undefined && next.simpleBreakDurationMinutes === undefined;
  const target = Math.round(next.hoursPerDay * 60);
  if (noBreak && Number.isFinite(target) && endMin > startMin && target > endMin - startMin) {
    const newEnd = startMin + target;
    if (newEnd <= 1440) {
      const workEndHour = newEnd / 60;
      const extended: WorkCalendar = { ...next, workEndHour,
        ...(next.ifcTimePeriods ? { ifcTimePeriods: next.ifcTimePeriods.map(period =>
          period.binding === 'scalar' && period.scalarEnd === next.workEndHour
            ? { ...period, scalarEnd: workEndHour } : period) } : {}),
      };
      repairs.push({ calendarId: cal.id, calendarName: cal.name, kind: 'extendEnd', before: scalarFields(next), after: scalarFields(extended) });
      next = extended;
    } else {
      unresolved.push({ where: 'calendar', id: cal.id, field: 'workEndHour', value: String(newEnd / 60), reason: 'endPastMidnight' });
    }
  }
  return next;
}

export const TIME_FIELDS = [
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish',
  'actualStart', 'actualFinish', 'resume', 'stop',
] as const satisfies readonly (keyof TaskTime & TaskDateField)[];

class Normalizer {
  readonly report: MinuteModelReport;

  constructor(report: MinuteModelReport) {
    this.report = report;
  }

  value(value: string, field: TaskDateField, ctx: TaskDateContext, where: UnresolvedDate['where'], id: string): string {
    if (value === '' || isInstant(value)) return value;
    if (!isDateOnly(value)) {
      this.report.unresolved.push({ where, id, field, value, reason: 'notADate' });
      return value;
    }
    const out = normalizeTaskDate(value, field, ctx);
    if (out === null) {
      this.report.unresolved.push({ where, id, field, value, reason: 'noWorkTime' });
      return value;
    }
    this.report.normalizedCount++;
    this.report.normalizedByField[field] = (this.report.normalizedByField[field] ?? 0) + 1;
    return out;
  }
}

export function mapTaskDates(task: Task, valueOf: (value: string, field: TaskDateField) => string): Task {
  let time: TaskTime | null = null;
  for (const field of TIME_FIELDS) {
    const v = task.time[field];
    if (typeof v !== 'string') continue;
    const out = valueOf(v, field);
    if (out !== v) {
      time ??= { ...task.time };
      time[field] = out;
    }
  }
  let deadline = task.deadline;
  if (typeof deadline === 'string') deadline = valueOf(deadline, 'deadline');
  const constraintOf = (c: Task['constraint']) => {
    if (!c || typeof c.date !== 'string') return c;
    const field = constraintDateField(c.type);
    if (!field) return c;
    const date = valueOf(c.date, field);
    return date === c.date ? c : { ...c, date };
  };
  const constraint = constraintOf(task.constraint);
  const constraint2 = constraintOf(task.constraint2);
  let externalLinks = task.externalLinks;
  if (externalLinks) {
    const mapped = externalLinks.map((e) => {
      if (typeof e.anchorDate !== 'string') return e;
      const anchorDate = valueOf(e.anchorDate, externalAnchorField(e.direction, e.relType));
      return anchorDate === e.anchorDate ? e : { ...e, anchorDate };
    });
    if (mapped.some((e, i) => e !== externalLinks![i])) externalLinks = mapped;
  }
  if (!time && deadline === task.deadline && constraint === task.constraint && constraint2 === task.constraint2
    && externalLinks === task.externalLinks) {
    return task;
  }
  return {
    ...task,
    ...(time ? { time } : {}),
    ...(deadline !== task.deadline ? { deadline } : {}),
    ...(constraint !== task.constraint ? { constraint } : {}),
    ...(constraint2 !== task.constraint2 ? { constraint2 } : {}),
    ...(externalLinks !== task.externalLinks ? { externalLinks } : {}),
  };
}


function migrateTask(task: Task, ctx: TaskDateContext, n: Normalizer): Task {
  return mapTaskDates(task, (value, field) => n.value(value, field, ctx, 'task', task.id));
}

export function normalizeTaskDates(task: Task, calendars: Pick<DocumentPayload, 'calendar' | 'calendars'>): Task {
  let ctx: TaskDateContext | undefined;
  return mapTaskDates(task, (value, field) => {
    if (!isDateOnly(value)) return value;
    ctx ??= taskDateContext(task, new DayClockCache(calendars.calendar, calendars.calendars));
    return normalizeTaskDate(value, field, ctx) ?? value;
  });
}

export function normalizeTaskPatch(updates: Partial<Task>, next: Task): Partial<Task> {
  let out: Partial<Task> | null = null;
  for (const key of Object.keys(updates) as (keyof Task)[]) {
    if (key === 'time' || next[key] === updates[key]) continue;
    out ??= { ...updates };
    (out as Record<string, unknown>)[key] = next[key];
  }
  const time = updates.time;
  if (time) {
    let normalizedTime: TaskTime | null = null;
    for (const field of TIME_FIELDS) {
      const raw = time[field];
      if (typeof raw !== 'string' || next.time[field] === raw) continue;
      normalizedTime ??= { ...time };
      (normalizedTime as unknown as Record<string, unknown>)[field] = next.time[field];
    }
    if (normalizedTime) (out ??= { ...updates }).time = normalizedTime;
  }
  return out ?? updates;
}

function migrateBaseline(
  baseline: Baseline,
  taskById: ReadonlyMap<string, Task>,
  clocks: DayClockCache,
  n: Normalizer,
  milestonesAtDayEnd: ReadonlySet<string> | undefined,
): Baseline {
  const projectClock = clocks.calendarClock(undefined);
  let changed = false;
  const tasks = baseline.tasks.map((bt): BaselineTask => {
    const task = taskById.get(bt.taskId);
    const clock = task ? taskDateContext(task, clocks, milestonesAtDayEnd).clock : projectClock;
    const milestoneKind: MilestoneKind | null = bt.isMilestone && bt.duration === 0
      ? (bt.milestoneKind ?? (milestonesAtDayEnd?.has(bt.taskId) ? 'FINISH' : 'START'))
      : null;
    const ctx: TaskDateContext = { clock, milestoneKind };
    const finishField: TaskDateField = task && isPinnedComplete(task.time) ? 'baselineFinishCompleted' : 'baselineFinish';
    const start = n.value(bt.start, 'baselineStart', ctx, 'baseline', baseline.id);
    const finish = n.value(bt.finish, finishField, ctx, 'baseline', baseline.id);
    if (start === bt.start && finish === bt.finish) return bt;
    changed = true;
    return { ...bt, start, finish };
  });
  let projectEnd = baseline.projectEnd;
  if (typeof projectEnd === 'string' && isDateOnly(projectEnd)) {
    const out = dayEndInstant(projectClock, projectEnd);
    if (out === null) {
      n.report.unresolved.push({ where: 'baseline', id: baseline.id, field: 'projectEnd', value: projectEnd, reason: 'noWorkTime' });
    } else {
      n.report.normalizedCount++;
      n.report.normalizedByField.projectEnd = (n.report.normalizedByField.projectEnd ?? 0) + 1;
      projectEnd = out;
    }
  }
  if (!changed && projectEnd === baseline.projectEnd) return baseline;
  return { ...baseline, tasks, projectEnd };
}

export function migrateToMinuteModel<P extends MinuteModelPayload>(payload: P, options: MinuteModelOptions = {}): MinuteModelMigration<P> {
  const legacyFile = options.timeModel !== MINUTE_MODEL_TIME_MODEL;
  const report: MinuteModelReport = {
    legacyFile,
    conversionPending: legacyFile,
    normalizedCount: 0,
    normalizedByField: {},
    calendarRepairs: [],
    unresolved: [],
    fixedWorkToHours: [],
  };

  let calendar = payload.calendar;
  let calendars = payload.calendars;
  if (legacyFile) {
    const seen = new Set<string>();
    const repairOnce = (cal: WorkCalendar): WorkCalendar => {
      const repairs: CalendarRepair[] = [];
      const unresolved: UnresolvedDate[] = [];
      const out = repairCalendar(cal, repairs, unresolved);
      if (!seen.has(cal.id)) {
        seen.add(cal.id);
        report.calendarRepairs.push(...repairs);
        report.unresolved.push(...unresolved);
      }
      return out;
    };
    calendar = repairOnce(calendar);
    const mapped = calendars.map(repairOnce);
    if (mapped.some((c, i) => c !== calendars[i])) calendars = mapped;
  }

  const clocks = new DayClockCache(calendar, calendars);
  const n = new Normalizer(report);
  const normalized = payload.tasks.map((t) => migrateTask(t, taskDateContext(t, clocks, options.milestonesAtDayEnd), n));

  const deps: WorkRuleDeps = { calendar, calendars, project: payload.project, resources: payload.resources };
  const tasks = normalized.map((t) => {
    if (!Array.isArray(t.childIds)) return t;
    const copy: Task = { ...t, time: { ...t.time } };
    if (!settleFixedWorkMeasure(copy, deps)) return t;
    report.fixedWorkToHours.push(t.id);
    return copy;
  });
  if (report.fixedWorkToHours.length > 0) report.conversionPending = true;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const baselines = payload.baselines.map((b) => migrateBaseline(b, taskById, clocks, n, options.milestonesAtDayEnd));

  const same = calendar === payload.calendar && calendars === payload.calendars
    && tasks.every((t, i) => t === payload.tasks[i]) && baselines.every((b, i) => b === payload.baselines[i]);
  return {
    payload: same ? payload : { ...payload, calendar, calendars, tasks, baselines },
    report,
  };
}

export function assertMinuteModelTaskDates(tasks: readonly Task[]): void {
  for (const task of tasks) mapTaskDates(task, (value, field) => {
    if (isDateOnly(value)) throw new Error(`Taak ${task.id}: ${field} mist een tijd na normalisatie`);
    return value;
  });
}
