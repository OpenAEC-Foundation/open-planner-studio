import { Task, type TaskConstraint, type ExternalLink } from '@/types/task';
import type { EffectiveSchedulingOptions } from '@/types/project';
import { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { dayEndInstant, dayStartInstant, blocksClock, workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { CalendarEngine } from './CalendarEngine';
import { LevelingQueue } from './levelingQueue';
import { resolveCalendar } from './resolveCalendar';
import {
  parseDate, formatDate, parseInstant, utcDayStart, MS_PER_DAY,
  formatInstant,
} from '@/utils/dateUtils';
import {
  durationMinutesOf, elapsedMinutesOf, elapsedMilliseconds, addElapsedMinutes, subtractElapsedMinutes,
  signedElapsedSpan, isZeroDurationMilestone, splitTotalSpanMinutes, splitTotalSpanDays,
  taskDurationUnit, writeDerivedSpan, isPinnedComplete, isPinnedInProgress, isElapsedTask, finishOfTaskDuration,
} from './duration';
import { computeScheduleResults } from './scheduleAnalysis';
import { deadlineBound } from './deadlineBound';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  explainP6CompletedDataDateWindowResolved,
  explainP6CompletedPhysicalPoint,
  type P6CompletedWindowDecision,
} from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainBackwardActualPinEligibility,
  explainCompletedXerLoeActualFinishEligibilityResolved,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
  type CpmBackwardActualPinDecision,
  type CpmDisplayActualLateDecision,
} from './p6CompletedRouteTrace';
import { explainOpenXerLoeTargetSpanEligibilityResolved } from './p6OpenLoeTargetSpanTrace';
import {
  forwardConstraint, forwardFinishFloor, backwardConstraint, MS_PER_MIN, type RelationDeps,
  dayTaskRequiredFinish, finishStartLaggedStart, previousBlockEndIfSame, keepsElapsedFsBoundary,
} from './relationMath';
import { taskCountsInWorkdays, lagCountsInWorkdays } from './conventions/durationMeasure';
import { isFiniteNumber } from '@/utils/guards';

const EXTERNAL_SEQUENCE_TYPE: Record<ExternalLink['relType'], Sequence['type']> = {
  FS: 'FINISH_START', SS: 'START_START', FF: 'FINISH_FINISH', SF: 'START_FINISH',
};

export interface CPMResult {
  tasks: Map<string, CPMTaskResult>;
  criticalPath: string[];
  backwardFloatTrace?: CpmBackwardFloatTrace;
  plannedFloorTraceByTaskId?: Readonly<Record<string, CPMPlannedFloorTrace>>;
  dateDriverByTaskId?: Record<string, TaskDateDriver>;
  drivingSequenceIds: string[];
  drivingUnknown?: true;
  sequenceFreeFloat: Record<string, number>;
  truncatedLeadSequenceIds: string[];
  violatedConstraintTaskIds: string[];
  missedDeadlineTaskIds: string[];
  outOfSequenceSequenceIds: string[];
  nearCriticalTaskIds: string[];
  criticalPaths: string[][];
  floatPathByTask: Record<string, number>;
  hammockNoFinishDriverTaskIds: string[];
  cappedTaskIds?: string[];
  externalSuccessorViolations?: { taskId: string; linkId: string }[];
  externalLagCalendarFallbackTaskIds?: string[];
  droppedSequenceIds?: string[];
  projectEnd: string;
  projectDuration: number;
  error?: string;
  errorInfo?: ScheduleErrorInfo;
  cycleTaskIds?: string[];
}

export type CpmProjectEndSource =
  | 'maxEarlyFinish'
  | 'completedDisplayWindow'
  | 'useProjectEndDateForFloat';

export type CpmLateFinishSource =
  | 'projectEnd'
  | 'successorConstraint'
  | 'completedRemainingWindow';

export type CpmLateStartSource =
  | 'subDuration'
  | 'subRemainingDuration'
  | 'completedRemainingWindow';

export type CpmFreeFloatSource =
  | 'derivedFromSuccessor'
  | 'projectEndFinishMilestoneBoundary'
  | 'clampedZero';

export interface CpmTaskBackwardFloatTrace {
  lateFinishSource: CpmLateFinishSource;
  lateStartSource: CpmLateStartSource;
  freeFloatSource: CpmFreeFloatSource;
  displayActualLate: boolean;
  completedWindow: P6CompletedWindowDecision;
  backwardActualPin: CpmBackwardActualPinDecision;
  displayActualLateDecision: CpmDisplayActualLateDecision;
}

export interface CpmBackwardFloatTrace {
  projectEndSource: CpmProjectEndSource;
  byTaskId: Record<string, CpmTaskBackwardFloatTrace>;
}

export interface CPMPlannedFloorTrace {
  preFloorEarlyStart: string;
  preFloorEarlyFinish: string;
  targetStart: string;
  targetFinish: string;
  plannedWindowIsLater: boolean;
  floorApplied: boolean;
  boundarySource: 'project-start' | 'relationship' | 'relationship:p6-predecessor-finish-boundary';
  boundarySequenceId?: string;
  boundaryPredecessorTaskCode?: string;
}

export type TaskDateDriver =
  | { kind: 'relation'; predecessorIds: string[] }
  | { kind: 'constraint' | 'ownStart' | 'plannedStart' | 'projectStart' | 'statusDate' | 'leveling'
    | 'progress' | 'manual' | 'hammock' | 'other' };

const DRIVER = {
  constraint: { kind: 'constraint' },
  ownStart: { kind: 'ownStart' },
  plannedStart: { kind: 'plannedStart' },
  projectStart: { kind: 'projectStart' },
  statusDate: { kind: 'statusDate' },
  leveling: { kind: 'leveling' },
  progress: { kind: 'progress' },
  manual: { kind: 'manual' },
  hammock: { kind: 'hammock' },
  other: { kind: 'other' },
} as const satisfies Record<string, TaskDateDriver>;

export interface CPMOptions {
  dataDate?: string;
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate?: string;
  projectEndDate?: string;
  traceDateDrivers?: boolean;
}

export function withEffectiveProjectEndAnchor(options: CPMOptions): CPMOptions {
  const so = options.schedulingOptions;
  if (so?.useProjectEndDateForFloat !== true) return options;
  if (!isNaN(parseInstant(options.projectEndDate ?? '').getTime())) return options;
  return { ...options, schedulingOptions: { ...so, useProjectEndDateForFloat: false } };
}

export function snapWorkInstantOnOrAfter(eng: CalendarEngine, from: Date): Date {
  return eng.isHourMode ? eng.nextWorkInstant(from) : eng.nextWorkDay(from);
}

export function engineForTaskCalendar(
  cache: Map<string, CalendarEngine>,
  cal: WorkCalendar,
): CalendarEngine {
  let e = cache.get(cal.id);
  if (!e) {
    e = new CalendarEngine(calendarForEngine(cal));
    cache.set(cal.id, e);
  }
  return e;
}

export function resolveEffectiveLagDays(seq: Sequence, predTask: Task, hoursPerDay?: number): number {
  if (isFiniteNumber(seq.lagPercent)) {
    const predDur = isZeroDurationMilestone(predTask) ? 0 : predTask.time.scheduleDuration;
    return (predDur * seq.lagPercent) / 100;
  }
  const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
  if (
    days === 0 && typeof hoursPerDay === 'number' && hoursPerDay > 0 &&
    isFiniteNumber(seq.lagMinutes) && seq.lagMinutes !== 0
  ) {
    const raw = seq.lagMinutes / (hoursPerDay * 60);
    return raw;
  }
  return days;
}

export interface CPMTaskResult {
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  totalFloatMinutes?: number;
  freeFloatMinutes?: number;
  isCritical: boolean;
  interferingFloat?: number;
  isNearCritical?: boolean;
  floatPath?: number;
}

type ProgressWork = { measure: 'workdays' | 'minutes' | 'elapsed'; total: number; remaining: number };

const TWENTY_FOUR_HOUR_LAG_CALENDAR: WorkCalendar = {
  id: 'ops-p6-24hour-lag',
  name: '24 uur',
  description: 'Interne P6-relatielagkalender',
  workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 0,
  workEndHour: 24,
  hoursPerDay: 24,
  holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 0, end: 1440 }],
      2: [{ start: 0, end: 1440 }],
      3: [{ start: 0, end: 1440 }],
      4: [{ start: 0, end: 1440 }],
      5: [{ start: 0, end: 1440 }],
      6: [{ start: 0, end: 1440 }],
      7: [{ start: 0, end: 1440 }],
    },
  },
};

export type ScheduleErrorCode =
  | 'cycle'
  | 'noWorkingDays'
  | 'invalidDayDuration'
  | 'invalidHourDuration'
  | 'hourTaskWithoutWorkHours'
  | 'taskWithoutWorkHours'
  | 'noWorkingHours'
  | 'invalidStartDate';

export interface ScheduleErrorInfo {
  code: ScheduleErrorCode;
  taskName?: string;
  cycleNames?: string[];
}

function scheduleErrorLegacyText(info: ScheduleErrorInfo): string {
  const name = info.taskName ?? '';
  switch (info.code) {
    case 'cycle': return `Circular dependency detected: ${(info.cycleNames ?? []).join(' -> ')}`;
    case 'noWorkingDays': return 'Calendar has no working days configured';
    case 'invalidDayDuration': return `Invalid day duration for task "${name}"`;
    case 'invalidHourDuration': return `Invalid hour duration for task "${name}"`;
    case 'hourTaskWithoutWorkHours': return `Hour-based task "${name}" has no valid working hours in its calendar`;
    case 'taskWithoutWorkHours': return `Task "${name}" has no valid working hours in its calendar`;
    case 'noWorkingHours': return 'Project calendar has no valid working hours';
    case 'invalidStartDate': return `Invalid start date for task "${name}"`;
  }
}

function emptyResult(errorInfo: ScheduleErrorInfo, cycleTaskIds?: string[]): CPMResult {
  return {
    tasks: new Map(),
    criticalPath: [],
    drivingSequenceIds: [],
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    criticalPaths: [[]],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd: '',
    projectDuration: 0,
    error: scheduleErrorLegacyText(errorInfo),
    errorInfo,
    ...(cycleTaskIds ? { cycleTaskIds } : {}),
  };
}

export class CPMSolver {
  private tasks: Map<string, Task>;
  private sequences: Sequence[];
  private projectCal: WorkCalendar;
  private registry: WorkCalendar[];
  private projectEngine: CalendarEngine;
  private readonly twentyFourHourLagEngine = new CalendarEngine(TWENTY_FOUR_HOUR_LAG_CALENDAR);
  private engineCache = new Map<string, CalendarEngine>();

  private successors: Map<string, Sequence[]>;
  private predecessors: Map<string, Sequence[]>;

  private seqConstraint: Map<string, Date> = new Map();
  private completedOutOfSequenceEs: Map<string, Date> = new Map();
  private completedOutOfSequenceRelation: Map<string, { at: Date; eng: CalendarEngine }> = new Map();
  private completedPhysicalPoints: Map<string, Date> = new Map();
  private truncatedLeadIds: string[] = [];
  private hardPinViolatedIds: string[] = [];
  private hammockNoFinishDriverIds: string[] = [];
  private cappedTaskIds: string[] = [];
  private externalLagCalendarFallbackIds = new Set<string>();
  private plannedFloorTraceByTaskId: Record<string, CPMPlannedFloorTrace> = {};
  private backwardFloatTrace: CpmBackwardFloatTrace | undefined;

  private options: CPMOptions;
  private dataDate: Date | null = null;
  private dateDrivers: Record<string, TaskDateDriver> | null = null;
  private rawDataDate: Date | null = null;
  private projectStartRaw: Date | null = null;
  private readonly droppedSequenceIds: string[];
  private readonly p6FinishBoundaryStartTaskIds: Set<string>;
  private static lastDroppedWarningSignature: string | null = null;

  constructor(
    tasks: Task[],
    sequences: Sequence[],
    projectCalendar: WorkCalendar,
    registry: WorkCalendar[] = [],
    options: CPMOptions,
  ) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));

    const kept: Sequence[] = [];
    const dropped: string[] = [];
    for (const seq of sequences) {
      if (this.tasks.has(seq.predecessorId) && this.tasks.has(seq.successorId)) {
        kept.push(seq);
      } else {
        dropped.push(seq.id);
      }
    }
    const schedulingOptions = options.schedulingOptions;
    this.sequences = schedulingOptions?.p6RelationFinishBoundary === true
      ? kept
      : kept.map(sequence => sequence.p6StartAtPredecessorFinishBoundary === true
        ? { ...sequence, p6StartAtPredecessorFinishBoundary: undefined }
        : sequence);
    this.droppedSequenceIds = dropped;
    this.p6FinishBoundaryStartTaskIds = new Set(
      this.sequences.filter(sequence => sequence.p6StartAtPredecessorFinishBoundary === true)
        .map(sequence => sequence.successorId),
    );
    if (dropped.length > 0) {
      const signature = [...dropped].sort().join(',');
      if (signature !== CPMSolver.lastDroppedWarningSignature) {
        CPMSolver.lastDroppedWarningSignature = signature;
        console.warn(
          `CPMSolver: ${dropped.length} relatie(s) genegeerd omdat voorganger of opvolger geen ` +
          'bladtaak is in de meegegeven set (verweesd/ongeldig taak-id, of een aanroeper die ' +
          `expandSummaryRelations niet gebruikt). Relatie-id's: ${dropped.join(', ')}.`,
        );
      }
    }

    this.projectCal = projectCalendar;
    this.registry = registry;
    this.projectEngine = new CalendarEngine(projectCalendar);
    this.engineCache.set(projectCalendar.id, this.projectEngine);
    this.options = withEffectiveProjectEndAnchor(options);
    this.successors = new Map();
    this.predecessors = new Map();

    for (const task of tasks) {
      this.successors.set(task.id, []);
      this.predecessors.set(task.id, []);
    }
    for (const seq of this.sequences) {
      this.successors.get(seq.predecessorId)?.push(seq);
      this.predecessors.get(seq.successorId)?.push(seq);
    }
  }

  private engineForCal(cal: WorkCalendar): CalendarEngine {
    return engineForTaskCalendar(this.engineCache, cal);
  }

  private calendarFor(task: Task): CalendarEngine {
    return this.engineForCal(resolveCalendar(task.calendarId, this.registry, this.projectCal));
  }

  private p6CompletedDataDateWindowDecision(task: Task): P6CompletedWindowDecision {
    return explainP6CompletedDataDateWindowResolved(task, this.dataDate, this.options.schedulingOptions);
  }

  private completedPredecessorRelationWindow(
    predTask: Task,
    window: { es: Date; ef: Date },
  ): { es: Date; ef: Date } {
    const outOfSequenceRelation = this.completedOutOfSequenceRelation.get(predTask.id);
    if (outOfSequenceRelation) return { es: outOfSequenceRelation.at, ef: outOfSequenceRelation.at };
    if (this.completedPhysicalPoints.has(predTask.id)) return window;
    if (this.options.schedulingOptions?.p6CompletedPredecessorAtDataDate !== true) return window;
    if (this.dataDate === null) return window;
    const t = predTask.time;
    if (!(t.actualFinish && t.completion >= 1)) return window;
    const progressCal = this.progressCalendarFor(predTask);
    if (!progressCal.hasOwnWorkBlocks) return window;
    const cap = progressCal.prevWorkInstant(this.snapOnOrAfter(progressCal, this.dataDate));
    if (Number.isNaN(cap.getTime()) || window.ef <= cap) return window;
    return { es: window.es, ef: cap };
  }

  private relationEngineFor(predTask: Task): CalendarEngine {
    return this.completedOutOfSequenceRelation.get(predTask.id)?.eng ?? this.calendarFor(predTask);
  }

  private completedOutOfSequenceRelationSeq(predTask: Task, seq: Sequence, succCal: CalendarEngine): Sequence {
    if (!this.completedOutOfSequenceEs.has(predTask.id) && !this.completedPhysicalPoints.has(predTask.id)) return seq;
    const lagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), succCal);
    return this.completedRemainingLagSeq(seq, predTask, lagEng);
  }

  private recordCompletedPhysicalPoint(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    progressCal: CalendarEngine,
  ): Date | null {
    if (this.dataDate === null || this.rawDataDate === null || !progressCal.hasOwnWorkBlocks) return null;
    if (!explainP6CompletedPhysicalPoint(task, this.rawDataDate, this.options.schedulingOptions).eligible) return null;
    let point = new Date(this.rawDataDate.getTime());
    for (const seq of preds) {
      const predTask = this.tasks.get(seq.predecessorId);
      const predResult = results.get(seq.predecessorId);
      if (!predTask || !predResult || predTask.isHammock) continue;
      const predPoint = this.completedPhysicalPoints.get(predTask.id);
      if (!predPoint && predTask.time.completion >= 1) continue;
      const predEng = this.calendarFor(predTask);
      const lagEng = this.relDeps.lagEngine(predEng, progressCal);
      const relSeq = predPoint
        ? this.completedRemainingLagSeq(seq, predTask, lagEng)
        : this.inProgressStartLagSeq(predTask, seq, lagEng);
      const fromStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
      const anchorResult = predPoint ? predResult : this.inProgressStartLagAnchor(predTask, seq, lagEng, predResult);
      const anchor = predPoint ?? (fromStart ? anchorResult.es : anchorResult.ef);
      const bound = this.physicalPointLag(anchor, relSeq, predTask, lagEng, 1);
      if (Number.isNaN(bound.getTime())) continue;
      if (bound > point) point = bound;
    }
    this.completedPhysicalPoints.set(task.id, point);
    return point;
  }

  private inProgressStartLagSeq(predTask: Task, seq: Sequence, lagEng: CalendarEngine): Sequence {
    const lag = this.inProgressStartLag(predTask, seq, lagEng);
    if (!lag || lag.remaining === lag.lagMinutes) return seq;
    const remaining = lag.remaining;
    return { ...seq, lagMinutes: remaining, lagDays: remaining / (lagEng.hoursPerDay * 60), lagPercent: undefined };
  }

  private inProgressStartLag(
    predTask: Task, seq: Sequence, lagEng: CalendarEngine,
  ): { lagMinutes: number; remaining: number } | null {
    const so = this.options.schedulingOptions;
    if (so?.p6InProgressStartLagElapsed !== true || so.p6UseRemainingStartForProgress !== true) return null;
    if (seq.type !== 'START_START' || this.dataDate === null || !lagEng.hasOwnWorkBlocks) return null;
    if (seq.lagUnit === 'ELAPSEDTIME') return null;
    const t = predTask.time;
    if (!t.actualStart || t.completion >= 1) return null;
    const lagMinutes = this.resolveLagMinutes(seq, predTask, lagEng);
    if (!(lagMinutes > 0)) return null;
    const actualStart = parseInstant(t.actualStart);
    if (Number.isNaN(actualStart.getTime()) || actualStart >= this.dataDate) return null;
    const remaining = Math.max(0, lagMinutes - lagEng.workMinutesBetween(actualStart, this.dataDate));
    return { lagMinutes, remaining };
  }

  private inProgressStartLagAnchor<T extends { es: Date }>(
    predTask: Task, seq: Sequence, lagEng: CalendarEngine, predResult: T,
  ): T {
    if (this.options.schedulingOptions?.startToStartLagFrom !== 'actualStart') return predResult;
    if (this.dataDate === null || !this.inProgressStartLag(predTask, seq, lagEng)) return predResult;
    return { ...predResult, es: new Date(this.dataDate.getTime()) };
  }

  private physicalPointLag(anchor: Date, seq: Sequence, predTask: Task, lagEng: CalendarEngine, sign: 1 | -1): Date {
    if (seq.lagUnit === 'ELAPSEDTIME') {
      const minutes = this.resolveElapsedMinutes(seq, predTask);
      return new Date(anchor.getTime() + sign * elapsedMilliseconds(minutes));
    }
    const minutes = sign * this.resolveLagMinutes(seq, predTask, lagEng);
    if (minutes > 0) return lagEng.addWorkMinutes(anchor, minutes);
    if (minutes < 0) return lagEng.subtractWorkMinutes(anchor, -minutes);
    return new Date(anchor.getTime());
  }

  private recordCompletedOutOfSequenceWindow(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    progressCal: CalendarEngine,
  ): void {
    if (this.options.schedulingOptions?.p6CompletedOutOfSequenceWindow !== true) return;
    if (this.options.progressMode === 'PROGRESS_OVERRIDE') return;
    if (this.dataDate === null || !progressCal.hasOwnWorkBlocks || preds.length === 0) return;
    if (!this.p6CompletedDataDateWindowDecision(task).eligible) return;
    const windowEs = this.snapOnOrAfter(progressCal, this.dataDate);
    let anchor = windowEs;
    let relation: { at: Date; eng: CalendarEngine } | null = null;
    for (const seq of preds) {
      if (seq.type !== 'FINISH_START' && seq.type !== 'START_START') continue;
      const predTask = this.tasks.get(seq.predecessorId);
      const rawPredResult = results.get(seq.predecessorId);
      if (!predTask || !rawPredResult || predTask.isHammock) continue;
      const predOnWindowRoute = this.p6CompletedDataDateWindowDecision(predTask).eligible;
      if (predOnWindowRoute) {
        if (!this.completedOutOfSequenceEs.has(predTask.id)) continue;
      } else if (predTask.time.completion >= 1) {
        continue;
      }
      const predResult = this.completedPredecessorRelationWindow(predTask, rawPredResult);
      const relSeq = this.completedOutOfSequenceRelationSeq(predTask, seq, progressCal);
      const predEng = this.relationEngineFor(predTask);
      const bound = forwardConstraint(this.relDeps, predResult, predTask, relSeq, task, predEng, predEng, false);
      if (Number.isNaN(bound.getTime())) continue;
      const es = this.snapOnOrAfter(progressCal, bound);
      if (es > anchor) anchor = es;
      if (relation === null || bound > relation.at) relation = { at: bound, eng: predEng };
    }
    if (anchor > windowEs && relation !== null) {
      this.completedOutOfSequenceEs.set(task.id, anchor);
      this.completedOutOfSequenceRelation.set(task.id, relation);
    }
  }

  private lateFinishOnOwnCalendar(eng: CalendarEngine, lateFinish: Date): Date {
    if (this.options.schedulingOptions?.p6LateFinishOnOwnCalendar !== true || !eng.hasOwnWorkBlocks) return lateFinish;
    const t = lateFinish.getTime();
    if (eng.nextWorkInstant(lateFinish).getTime() === t || eng.prevWorkInstant(lateFinish).getTime() === t) return lateFinish;
    const snapped = eng.prevWorkInstant(lateFinish);
    return Number.isNaN(snapped.getTime()) ? lateFinish : snapped;
  }

  private remainingDurationTaskForStartRelation(task: Task, eng: CalendarEngine): Task {
    if (this.options.schedulingOptions?.p6UseRemainingStartForProgress !== true || !eng.hasOwnWorkBlocks) return task;
    const t = task.time;
    if (t.actualStart === undefined || !(t.completion > 0 && t.completion < 1)) return task;
    if (t.durationType === 'ELAPSEDTIME' || (task.splitGaps?.length ?? 0) > 0) return task;
    const planned = durationMinutesOf(task, eng);
    const rest = t.remainingMinutes;
    if (rest === undefined || !(rest >= 0) || rest >= planned) return task;
    if (rest === 0) {
      return { ...task, isMilestone: true, milestoneKind: undefined, time: { ...t, scheduleDuration: 0, durationMinutes: 0 } };
    }
    return taskDurationUnit(task) === 'hours'
      ? { ...task, time: { ...t, durationMinutes: rest } }
      : { ...task, time: { ...t, scheduleDuration: rest / (eng.hoursPerDay * 60) } };
  }

  private progressOverrideIgnoresRelation(predTask: Task, succTask: Task): boolean {
    if (this.options.schedulingOptions?.p6ProgressOverrideIgnoresStartedSuccessor !== true) return false;
    if (this.options.progressMode !== 'PROGRESS_OVERRIDE') return false;
    const succStarted = !!succTask.time.actualStart || succTask.time.completion > 0;
    return succStarted && succTask.time.completion < 1 && predTask.time.completion < 1;
  }

  private finishNotBeforeFinishFinishBound(
    preds: Sequence[], results: Map<string, { es: Date; ef: Date }>, cal: CalendarEngine, earlyFinish: Date,
  ): Date {
    if (this.options.schedulingOptions?.p6FinishNotBeforeFinishFinishBound !== true || !cal.hasOwnWorkBlocks) return earlyFinish;
    let out = earlyFinish;
    for (const seq of preds) {
      if (seq.type !== 'FINISH_FINISH' || seq.lagUnit === 'ELAPSEDTIME') continue;
      const predTask = this.tasks.get(seq.predecessorId);
      const rawPredResult = results.get(seq.predecessorId);
      if (!predTask || !rawPredResult || predTask.isHammock) continue;
      const predResult = this.completedPredecessorRelationWindow(predTask, rawPredResult);
      const lagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), cal);
      if (!lagEng.hasOwnWorkBlocks) continue;
      let bound = this.shiftLagPred(lagEng, predResult.ef, seq, predTask, 1);
      const predIsStartMilestone = isZeroDurationMilestone(predTask) && predTask.milestoneKind !== 'FINISH'
        && predTask.time.completion < 1;
      if (!predIsStartMilestone) bound = lagEng.prevWorkInstant(bound);
      if (Number.isNaN(bound.getTime()) || bound <= out || cal.workMinutesBetween(out, bound) !== 0) continue;
      const snapped = this.snapOnOrAfter(cal, bound);
      if (!Number.isNaN(snapped.getTime()) && snapped > out) out = snapped;
    }
    return out;
  }

  private finishFinishAtStartMilestoneLateFinish(
    seq: Sequence, succTask: Task, predEng: CalendarEngine, succEng: CalendarEngine,
  ): boolean {
    return this.options.schedulingOptions?.p6FinishFinishStartMilestoneLateFinish === true
      && seq.type === 'FINISH_FINISH'
      && predEng.hasOwnWorkBlocks && succEng.hasOwnWorkBlocks
      && succTask.isMilestone && succTask.milestoneKind === 'START'
      && isZeroDurationMilestone(succTask);
  }

  private completedRemainingLagSeq(seq: Sequence, task: Task, lagEng: CalendarEngine): Sequence {
    if (this.options.schedulingOptions?.p6CompletedRemainingLag !== true) return seq;
    if (this.dataDate === null || !lagEng.hasOwnWorkBlocks || seq.lagUnit === 'ELAPSEDTIME') return seq;
    if (!task.time.actualFinish || task.time.completion < 1) return seq;
    const lagMinutes = this.resolveLagMinutes(seq, task, lagEng);
    if (!(lagMinutes > 0)) return seq;
    const actualFinish = parseInstant(task.time.actualFinish);
    if (Number.isNaN(actualFinish.getTime()) || actualFinish >= this.dataDate) return seq;
    const elapsed = lagEng.workMinutesBetween(actualFinish, this.dataDate);
    const remaining = Math.max(0, lagMinutes - elapsed);
    if (remaining === lagMinutes) return seq;
    return { ...seq, lagMinutes: remaining, lagDays: remaining / (lagEng.hoursPerDay * 60), lagPercent: undefined };
  }

  private recordBackwardFloatTrace(
    taskId: string,
    update: Partial<CpmTaskBackwardFloatTrace>,
  ): void {
    if (!this.backwardFloatTrace) return;
    const previous = this.backwardFloatTrace.byTaskId[taskId] ?? {
      lateFinishSource: 'projectEnd',
      lateStartSource: 'subDuration',
      freeFloatSource: 'derivedFromSuccessor',
      displayActualLate: false,
      completedWindow: { eligible: false, reason: 'conventionOff' } as const,
      backwardActualPin: { eligible: false, reason: 'missingDataDate' } as const,
      displayActualLateDecision: { eligible: false, reason: 'missingDataDate' } as const,
    };
    this.backwardFloatTrace.byTaskId[taskId] = { ...previous, ...update };
  }

  private progressCalendarFor(task: Task, fallback = this.calendarFor(task)): CalendarEngine {
    let progressCal = fallback;
    if (task.timephasedDurationWalks && task.timephasedDurationWalks.length === 1) {
      const candidate = this.engineForCal(
        resolveCalendar(task.timephasedDurationWalks[0].resourceCalendarId, this.registry, this.projectCal),
      );
      if (candidate.isHourMode) progressCal = candidate;
    }
    return progressCal;
  }

  private snapOnOrAfter(eng: CalendarEngine, d: Date): Date {
    return snapWorkInstantOnOrAfter(eng, d);
  }
  private snapActualForward(eng: CalendarEngine, d: Date): Date {
    const snapped = this.snapOnOrAfter(eng, d);
    return utcDayStart(snapped).getTime() === utcDayStart(d).getTime() ? snapped : d;
  }
  private snapOnOrBefore(eng: CalendarEngine, d: Date): Date {
    return eng.prevWorkInstant(d);
  }
  private snapStrictAfter(eng: CalendarEngine, d: Date): Date {
    return eng.nextWorkInstantAfter(d);
  }
  private snapStrictBefore(eng: CalendarEngine, d: Date): Date {
    return eng.prevWorkInstantBefore(d);
  }
  private snapSuccessorEarlyStart(
    eng: CalendarEngine,
    d: Date,
    task: Task,
    preserveP6FinishBoundary = false,
  ): Date {
    if (isElapsedTask(task)) return d;
    if ([task.constraint, task.constraint2].some(c =>
      this.milestoneConstraintMoment(task, c, eng)?.getTime() === d.getTime())) return d;
    if (isZeroDurationMilestone(task)
      && this.snapOnOrBefore(eng, d).getTime() === d.getTime()
      && [task.constraint, task.constraint2].some(c =>
        c?.type === 'FNET' && this.forwardBoundOf(task, c, eng)?.getTime() === d.getTime())) return d;
    if (preserveP6FinishBoundary
      && this.snapOnOrBefore(eng, d).getTime() === d.getTime()) return d;
    const p6FinishBoundary = this.p6ZeroDurationUsesFinishBoundary(task, eng);
    if (isZeroDurationMilestone(task)
      && (task.milestoneKind === 'FINISH' || p6FinishBoundary
        || (!task.milestoneKind && (this.predecessors.get(task.id) ?? []).some(seq =>
          (seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH')
          && this.seqConstraint.get(seq.id)?.getTime() === d.getTime()))
        || (!task.milestoneKind && [task.constraint, task.constraint2].some(c =>
          (c?.type === 'FNET' || c?.type === 'MFO')
          && this.constraintInstant(c, eng)?.getTime() === d.getTime())))) {
      if (this.snapOnOrBefore(eng, d).getTime() === d.getTime()) return d;
    }
    return this.snapOnOrAfter(eng, d);
  }

  private isFinishMilestone(task: Task, eng: CalendarEngine): boolean {
    return (this.p6ZeroDurationUsesFinishBoundary(task, eng) && isZeroDurationMilestone(task))
      || (task.isMilestone && task.milestoneKind === 'FINISH');
  }
  private p6ZeroDurationUsesFinishBoundary(task: Task, eng: CalendarEngine): boolean {
    if (this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary !== true
      || !eng.hasOwnWorkBlocks || !isZeroDurationMilestone(task)) return false;
    const planned = parseInstant(task.time.scheduleStart);
    if (Number.isNaN(planned.getTime())) return false;
    const minute = planned.getUTCHours() * 60 + planned.getUTCMinutes();
    return eng.effectiveBandsOn(planned).some(band => band.end === minute);
  }
  private p6ZeroDurationActivityUsesBoundaryPair(task: Task, eng: CalendarEngine): boolean {
    if (this.options.schedulingOptions?.p6ZeroDurationUsesPlannedBoundary !== true
      || !eng.hasOwnWorkBlocks || task.time.scheduleDuration !== 0
      || (task.p6ActivityType !== 'TT_Task' && task.p6ActivityType !== 'TT_Rsrc')) return false;
    const plannedStart = parseInstant(task.time.scheduleStart);
    const plannedFinish = parseInstant(task.time.scheduleFinish);
    return !Number.isNaN(plannedStart.getTime()) && !Number.isNaN(plannedFinish.getTime())
      && plannedFinish < plannedStart;
  }
  private p6PreviousCalendarFinishBoundary(task: Task, start: Date): Date {
    const plannedFinish = parseInstant(task.time.scheduleFinish);
    const clockMs = (plannedFinish.getUTCHours() * 60 + plannedFinish.getUTCMinutes()) * 60_000;
    return new Date(utcDayStart(start).getTime() - MS_PER_DAY + clockMs);
  }

  private rootFloor(eng: CalendarEngine, scheduleStart: string, elapsedTask: boolean): Date {
    const own = elapsedTask
      ? parseInstant(scheduleStart)
      : this.snapOnOrAfter(eng, parseInstant(scheduleStart));
    if (!this.projectStartRaw) return own;
    const floor = this.snapOnOrAfter(eng, this.projectStartRaw);
    return floor > own ? floor : own;
  }

  private ownAnchor(eng: CalendarEngine, scheduleStart: string, task: Task): Date {
    const raw = parseInstant(scheduleStart);
    if (isZeroDurationMilestone(task) && scheduleStart.includes('T')
      && (eng.hasOwnWorkBlocks || taskDurationUnit(task) === 'hours' || eng.isWorkDay(raw))) return raw;
    if (this.isExactBandEnd(eng, raw)) return raw;
    return this.snapOnOrAfter(eng, raw);
  }

  private isExactBandEnd(eng: CalendarEngine, d: Date): boolean {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return false;
    const lastBandEndMs = utcDayStart(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN;
    return d.getTime() === lastBandEndMs;
  }

  private dayFirstBandStart(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(utcDayStart(d).getTime() + bands[0].start * MS_PER_MIN);
  }

  private isAtDayFirstBandStart(eng: CalendarEngine, d: Date | undefined): boolean {
    return !!d && this.dayFirstBandStart(eng, d)?.getTime() === d.getTime();
  }

  private usesLastProjectDayStart(task: Task, taskId: string, earlyStart: Date | undefined): boolean {
    const eng = this.calendarFor(task);
    const preds = this.predecessors.get(taskId) ?? [];
    return isZeroDurationMilestone(task)
      && ((task.milestoneKind === 'START'
        && (!this.options.schedulingOptions.milestoneWithoutPredecessorAtDayEnd
          || preds.length > 0 || (this.successors.get(taskId)?.length ?? 0) > 0))
        || (!task.milestoneKind && preds.length > 0
          && !preds.some(seq => seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH')))
      && taskDurationUnit(task) !== 'hours' && !eng.hasOwnWorkBlocks
      && this.isAtDayFirstBandStart(eng, earlyStart);
  }

  private lastProjectDayStart(eng: CalendarEngine, projectEnd: Date, projectEndOpensDay: boolean): Date {
    if (projectEndOpensDay) return this.dayFirstBandStart(eng, projectEnd) ?? projectEnd;
    return this.dayFirstBandStart(eng, workdayDateOfInstant(eng, projectEnd, 'end')) ?? projectEnd;
  }

  private dayLastBandEnd(eng: CalendarEngine, d: Date): Date | null {
    const bands = eng.effectiveBandsOn(d);
    if (bands.length === 0) return null;
    return new Date(utcDayStart(d).getTime() + bands[bands.length - 1].end * MS_PER_MIN);
  }

  private readonly relDeps: RelationDeps = {
    lagEngine: (predEng, succEng) => {
      switch (this.options.schedulingOptions?.lagCalendar) {
        case 'successor': return succEng;
        case 'projectDefault': return this.projectEngine;
        case '24hour': return this.twentyFourHourLagEngine;
        case 'predecessor':
        default: return predEng;
      }
    },
    resolveEffectiveLagDays: (seq, predTask, predEng) =>
      resolveEffectiveLagDays(seq, predTask, predEng.hoursPerDay),
    resolveElapsedMinutes: (seq, predTask) => this.resolveElapsedMinutes(seq, predTask),
    shiftLagPred: (predEng, base, seq, predTask, sign) => this.shiftLagPred(predEng, base, seq, predTask, sign),
    startFromFinish: (eng, finish, task) => this.startFromFinish(eng, finish, task),
    finishFromStart: (eng, start, task) => this.finishFromStart(eng, start, task),
    snapOnOrAfter: (eng, d) => this.snapOnOrAfter(eng, d),
    snapOnOrBefore: (eng, d) => this.snapOnOrBefore(eng, d),
    snapStrictAfter: (eng, d) => this.snapStrictAfter(eng, d),
    snapStrictBefore: (eng, d) => this.snapStrictBefore(eng, d),
    countsInWorkdays: (task) => this.countsInWorkdays(task),
  };

  private addDuration(eng: CalendarEngine, start: Date, task: Task): Date {
    return this.addDurationChecked(eng, start, task).date;
  }
  private addDurationChecked(eng: CalendarEngine, start: Date, task: Task): { date: Date; capped: boolean } {
    if (isZeroDurationMilestone(task)) return { date: new Date(start.getTime()), capped: false };
    if (task.time.durationType === 'ELAPSEDTIME') {
      return { date: addElapsedMinutes(start, elapsedMinutesOf(task, eng)), capped: false };
    }
    if (this.countsInWorkdays(task)) {
      const totalDays = splitTotalSpanDays(task, eng);
      if (totalDays <= 0) return { date: new Date(start.getTime()), capped: false };
      return eng.addMeasuredWorkdaysChecked(start, totalDays);
    }
    const totalMinutes = splitTotalSpanMinutes(task.splitGaps, this.workMinutesOf(task, eng));
    const hasDuration = CalendarEngine.walkMs(totalMinutes) > 0;
    if (hasDuration && this.p6FinishBoundaryStartTaskIds.has(task.id)
      && this.isExactBandEnd(eng, start)) {
      return {
        date: eng.addWorkMinutes(eng.nextWorkInstantAfter(start), totalMinutes),
        capped: false,
      };
    }
    const walkStart = hasDuration && this.isExactBandEnd(eng, start)
      ? this.dayFirstBandStart(eng, start) ?? start
      : start;
    return { date: eng.addWorkMinutes(walkStart, totalMinutes), capped: false };
  }

  private countsInWorkdays(task: Task): boolean {
    return taskCountsInWorkdays(
      { time: { durationUnit: taskDurationUnit(task), durationType: task.time.durationType } },
      { workdayDurationMeasure: this.options.schedulingOptions?.workdayDurationMeasure },
    );
  }

  private workMinutesOf(task: Task, eng: CalendarEngine): number {
    const minutes = durationMinutesOf(task, eng);
    return taskDurationUnit(task) === 'hours' ? minutes : Math.round(minutes);
  }

  private static daysAsWorkMinutes(days: number, eng: CalendarEngine): number {
    return Math.round(days * eng.hoursPerDay * 60);
  }
  private subDuration(eng: CalendarEngine, end: Date, task: Task, actualEarlyStart: Date | null = null): Date {
    if (isZeroDurationMilestone(task)) return new Date(end.getTime());
    if (task.time.durationType === 'ELAPSEDTIME') {
      return subtractElapsedMinutes(end, elapsedMinutesOf(task, eng));
    }
    if (this.countsInWorkdays(task)) {
      const totalDays = splitTotalSpanDays(task, eng);
      if (totalDays <= 0) return new Date(end.getTime());
      return eng.subtractMeasuredWorkdays(end, totalDays);
    }
    const totalMinutes = splitTotalSpanMinutes(task.splitGaps, this.workMinutesOf(task, eng));
    const natural = eng.subtractWorkMinutes(end, totalMinutes);
    if (
      totalMinutes > 0
      && (this.predecessors.get(task.id) ?? []).length === 0
      && task.time.scheduleStart
      && actualEarlyStart
    ) {
      const rawOwn = parseInstant(task.time.scheduleStart);
      if (this.isExactBandEnd(eng, rawOwn) && actualEarlyStart.getTime() === rawOwn.getTime()) {
        const naturalDayStart = this.dayFirstBandStart(eng, natural);
        if (naturalDayStart && naturalDayStart.getTime() === natural.getTime()) {
          const mirrored = this.dayLastBandEnd(eng, natural);
          if (mirrored) return mirrored;
        }
      }
    }
    return natural;
  }

  private subRemainingDuration(eng: CalendarEngine, end: Date, task: Task): Date {
    const work = this.progressWork(task, eng);
    if (work.measure === 'elapsed') {
      return subtractElapsedMinutes(end, CPMSolver.elapsedWorkMinutes(work.remaining, task));
    }
    const remainingWithGaps = this.remainingWithSplitGaps(task, eng, work);
    if (work.measure === 'workdays') return eng.subtractMeasuredWorkdays(end, remainingWithGaps);
    return eng.subtractWorkMinutes(end, remainingWithGaps);
  }

  private progressWork(task: Task, eng: CalendarEngine): ProgressWork {
    const t = task.time;
    const inHours = taskDurationUnit(task) === 'hours';
    if (!isZeroDurationMilestone(task) && t.durationType === 'ELAPSEDTIME') {
      const total = inHours ? durationMinutesOf(task, eng) : t.scheduleDuration;
      const fromCompletion = inHours ? Math.round(total * (1 - t.completion)) : total * (1 - t.completion);
      return { measure: 'elapsed', total, remaining: Math.max(0, (inHours ? t.remainingMinutes : t.remainingTime) ?? fromCompletion) };
    }
    if (this.countsInWorkdays(task)) {
      const total = t.scheduleDuration;
      return { measure: 'workdays', total, remaining: Math.max(0, t.remainingTime ?? total * (1 - t.completion)) };
    }
    const total = this.workMinutesOf(task, eng);
    const rest = inHours
      ? t.remainingMinutes
      : t.remainingTime !== undefined ? CPMSolver.daysAsWorkMinutes(t.remainingTime, eng) : undefined;
    return { measure: 'minutes', total, remaining: Math.max(0, rest ?? Math.round(total * (1 - t.completion))) };
  }

  private static elapsedWorkMinutes(amount: number, task: Task): number {
    return taskDurationUnit(task) === 'hours' ? amount : Math.round(amount * 24 * 60);
  }

  private remainingWithSplitGaps(task: Task, eng: CalendarEngine, work: ProgressWork): number {
    if (work.measure === 'elapsed' || !task.splitGaps || task.splitGaps.length === 0) return work.remaining;
    const perUnit = work.measure === 'minutes' ? 1 : eng.hoursPerDay * 60;
    const totalSpanMinutes = work.total * perUnit;
    const remainingMinutes = work.remaining * perUnit;
    const completedSpanMinutes = Math.max(0, totalSpanMinutes - remainingMinutes);
    const totalAxisMinutes = splitTotalSpanMinutes(task.splitGaps, totalSpanMinutes);
    const completedAxisMinutes = splitTotalSpanMinutes(task.splitGaps, completedSpanMinutes);
    return Math.max(0, totalAxisMinutes - completedAxisMinutes) / perUnit;
  }

  private shiftByLevelingDelay(eng: CalendarEngine, task: Task, date: Date, sign: 1 | -1): Date {
    const taskElapsed = isElapsedTask(task);
    if (task.levelingDelayMinutes) {
      if (taskElapsed || task.levelingDelayElapsed) {
        return addElapsedMinutes(date, sign * task.levelingDelayMinutes);
      }
      return eng.addWorkingMinutesSigned(date, sign * task.levelingDelayMinutes);
    }
    if (task.levelingDelay) {
      return taskElapsed
        ? addElapsedMinutes(date, sign * task.levelingDelay * 24 * 60)
        : eng.addWorkingDaysSigned(date, sign * task.levelingDelay);
    }
    return date;
  }

  private resolveLagMinutes(seq: Sequence, predTask: Task, predEng: CalendarEngine): number {
    if (isFiniteNumber(seq.lagPercent)) {
      const predMin = isZeroDurationMilestone(predTask) ? 0 : durationMinutesOf(predTask, this.calendarFor(predTask));
      return Math.round((predMin * seq.lagPercent) / 100);
    }
    if (isFiniteNumber(seq.lagMinutes)) return seq.lagMinutes;
    const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    return CPMSolver.daysAsWorkMinutes(days, predEng);
  }
  private resolveElapsedMinutes(seq: Sequence, predTask: Task): number {
    if (isFiniteNumber(seq.lagMinutes)) return seq.lagMinutes;
    return resolveEffectiveLagDays(seq, predTask) * 24 * 60;
  }
  private shiftLagPred(
    predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1,
  ): Date {
    const lagDays = isFiniteNumber(seq.lagPercent)
      ? resolveEffectiveLagDays(seq, predTask)
      : Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    const measured = lagDays !== 0 && lagCountsInWorkdays(
      seq, { workdayDurationMeasure: this.options.schedulingOptions?.workdayDurationMeasure },
      { time: { durationUnit: taskDurationUnit(predTask), durationType: predTask.time.durationType } },
    );
    const minutes = measured ? 0 : this.resolveLagMinutes(seq, predTask, predEng);
    const amount = measured ? lagDays : minutes;
    if (measured && sign * lagDays > 0) {
      return predEng.addMeasuredWorkdays(predEng.nextWorkInstant(base), sign * lagDays);
    }
    if (sign < 0 && amount > 0) {
      const projected = measured
        ? predEng.subtractMeasuredWorkdays(base, lagDays)
        : predEng.subtractWorkMinutes(base, minutes);
      const projectedDayStart = this.dayFirstBandStart(predEng, projected);
      if (this.options.schedulingOptions?.p6BackwardLagFinishBoundary === true
        && this.isExactBandEnd(predEng, base)
        && projectedDayStart?.getTime() === projected.getTime()) {
        return predEng.prevWorkInstantBefore(projected);
      }
      return projected;
    }
    if (sign < 0 && amount === 0 && seq.type === 'FINISH_FINISH'
      && this.options.schedulingOptions?.p6BackwardLagFinishBoundary === true
      && this.isExactBandEnd(predEng, base)) {
      return new Date(base.getTime());
    }
    if (measured) return predEng.subtractMeasuredWorkdays(predEng.nextWorkInstant(base), Math.abs(lagDays));
    return predEng.addWorkingMinutesSigned(base, sign * minutes);
  }

  private startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date {
    if (isZeroDurationMilestone(task)) return new Date(finish.getTime());
    if (task.time.durationType === 'ELAPSEDTIME') {
      return subtractElapsedMinutes(finish, elapsedMinutesOf(task, eng));
    }
    if (this.countsInWorkdays(task)) {
      const totalDays = splitTotalSpanDays(task, eng);
      if (totalDays <= 0) return new Date(finish.getTime());
      return eng.subtractMeasuredWorkdays(finish, totalDays);
    }
    const totalMinutes = splitTotalSpanMinutes(task.splitGaps, this.workMinutesOf(task, eng));
    const natural = eng.subtractWorkMinutes(finish, totalMinutes);
    if (totalMinutes > 0 && this.p6FinishBoundaryStartTaskIds.has(task.id)) {
      const naturalDayStart = this.dayFirstBandStart(eng, natural);
      if (naturalDayStart?.getTime() === natural.getTime()) {
        return eng.prevWorkInstantBefore(natural);
      }
    }
    return natural;
  }
  private finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date {
    const workdays = this.countsInWorkdays(task);
    const walkStart = !workdays && !isZeroDurationMilestone(task) && !isElapsedTask(task)
      && this.p6FinishBoundaryStartTaskIds.has(task.id)
      && this.isExactBandEnd(eng, start)
      && splitTotalSpanMinutes(task.splitGaps, this.workMinutesOf(task, eng)) > 0
      ? eng.nextWorkInstantAfter(start)
      : start;
    return finishOfTaskDuration(task, eng, walkStart, workdays);
  }
  private signedFloat(a: Date, b: Date, eng: CalendarEngine, task?: Task): number {
    if (task?.time.durationType === 'ELAPSEDTIME') return signedElapsedSpan(a, b, eng);
    if (task && this.countsInWorkdays(task)) return eng.measuredWorkdaysBetween(a, b);
    return eng.workMinutesBetween(a, b) / (eng.hoursPerDay * 60);
  }

  private signedFloatMinutes(a: Date, b: Date, eng: CalendarEngine, task?: Task): number {
    if (task?.time.durationType === 'ELAPSEDTIME') return (b.getTime() - a.getTime()) / MS_PER_MIN;
    return eng.workMinutesBetween(a, b);
  }

  private prepareSolve(): CPMResult | null {
    this.seqConstraint.clear();
    this.completedOutOfSequenceEs.clear();
    this.completedOutOfSequenceRelation.clear();
    this.completedPhysicalPoints.clear();
    this.truncatedLeadIds = [];
    this.hardPinViolatedIds = [];
    this.hammockNoFinishDriverIds = [];
    this.cappedTaskIds = [];
    this.externalLagCalendarFallbackIds.clear();
    this.plannedFloorTraceByTaskId = {};
    this.backwardFloatTrace = this.options.schedulingOptions?.p6CompletedDataDateWindow === true
      ? { projectEndSource: 'maxEarlyFinish', byTaskId: {} }
      : undefined;
    this.dataDate = null;
    this.rawDataDate = null;
    this.projectStartRaw = null;

    const cycle = this.detectCycle();
    if (cycle) {
      const cycleNames = cycle.map(id => this.tasks.get(id)?.name || id);
      return emptyResult({ code: 'cycle', cycleNames }, [...new Set(cycle)]);
    }

    if (!this.projectEngine.hasWorkingDays()) {
      return emptyResult({ code: 'noWorkingDays' });
    }

    for (const task of this.tasks.values()) {
      const unit = taskDurationUnit(task);
      const source = unit === 'hours' ? task.time.durationMinutes : task.time.scheduleDuration;
      if (typeof source !== 'number' || !Number.isFinite(source) || source < 0) {
        const code = unit === 'hours' ? 'invalidHourDuration' : 'invalidDayDuration';
        return emptyResult({ code, taskName: task.name });
      }
    }

    for (const task of this.tasks.values()) {
      if (taskDurationUnit(task) === 'hours'
        && task.time.durationType === 'WORKTIME'
        && !this.calendarFor(task).isHourMode) {
        return emptyResult({ code: 'hourTaskWithoutWorkHours', taskName: task.name });
      }
    }

    for (const task of this.tasks.values()) {
      if (!this.calendarFor(task).isHourMode) {
        return emptyResult({ code: 'taskWithoutWorkHours', taskName: task.name });
      }
    }
    if (!this.projectEngine.isHourMode) {
      return emptyResult({ code: 'noWorkingHours' });
    }

    for (const task of this.tasks.values()) {
      if (isNaN(parseDate(task.time.scheduleStart).getTime())) {
        return emptyResult({ code: 'invalidStartDate', taskName: task.name });
      }
    }

    const projectClock = blocksClock(this.projectCal);
    const dd = this.options.dataDate ? parseInstant(dayStartInstant(projectClock, this.options.dataDate) ?? this.options.dataDate) : null;
    this.dataDate = dd && !isNaN(dd.getTime()) ? this.snapOnOrAfter(this.projectEngine, dd) : null;
    this.rawDataDate = this.dataDate === null ? null : dd;

    const psd = this.options.projectStartDate ? parseInstant(dayStartInstant(projectClock, this.options.projectStartDate) ?? this.options.projectStartDate) : null;
    this.projectStartRaw = psd && !isNaN(psd.getTime()) ? psd : null;

    return null;
  }

  solveEarlyStarts(): Map<string, string> | null {
    if (this.prepareSolve()) return null;
    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const out = new Map<string, string>();
    for (const [taskId, early] of earlyDates) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      out.set(taskId, formatInstant(early.es, 'hour'));
    }
    return out;
  }

  createIncrementalForwardPass(): {
    order: readonly string[];
    markChanged: (taskId: string) => void;
    earlyStart: (taskId: string) => string | undefined;
    earlyDates: (taskId: string) => Pick<CPMTaskResult, 'earlyStart' | 'earlyFinish'> | undefined;
  } | null {
    if ([...this.tasks.values()].some(t => t.isHammock
      || t.constraint?.type === 'ALAP' || t.constraint2?.type === 'ALAP'
      || (t.time.completion >= 1 && !t.time.actualFinish))) return null;
    if (this.prepareSolve()) return null;
    const order = this.topologicalSort();
    const rankOf = new Map(order.map((id, rank) => [id, rank]));
    const projectStart = this.forwardProjectStart();
    const results = this.forwardPass(order, new Map(), projectStart);
    const dirty = new Set<number>();
    const queue = new LevelingQueue();
    const markChanged = (taskId: string) => {
      const rank = rankOf.get(taskId);
      if (rank === undefined || dirty.has(rank)) return;
      dirty.add(rank);
      queue.push(rank);
    };
    const readEarly = (taskId: string) => {
      const target = rankOf.get(taskId);
      if (target === undefined) return undefined;
      for (let rank = queue.peek(); rank !== undefined && rank <= target; rank = queue.peek()) {
        queue.pop();
        dirty.delete(rank);
        const id = order[rank];
        // Deze voorganger-vensters zijn forward-invoer voor opvolgers. Wis alleen de opnieuw
        // berekende taak; de vensters van onaangeraakte voorgangers blijven geldig.
        this.completedOutOfSequenceEs.delete(id);
        this.completedOutOfSequenceRelation.delete(id);
        this.completedPhysicalPoints.delete(id);
        for (const seq of this.predecessors.get(id) ?? []) this.seqConstraint.delete(seq.id);
        this.forwardPass([id], results, projectStart);
        // Ook bij gelijke ES/EF doorgeven: een voltooid P6-venster kan veranderen zonder dat de
        // actuals veranderen. Dezelfde forward-logica bepaalt de relatiegrens voor de opvolger.
        for (const seq of this.successors.get(id) ?? []) markChanged(seq.successorId);
      }
      return results.get(taskId);
    };
    return {
      order,
      markChanged,
      earlyStart: taskId => {
        const early = readEarly(taskId);
        return early ? formatInstant(early.es, 'hour') : undefined;
      },
      earlyDates: taskId => {
        const early = readEarly(taskId);
        return early && {
          earlyStart: formatInstant(early.es, 'hour'),
          earlyFinish: formatInstant(early.ef, 'hour'),
        };
      },
    };
  }

  solve(): CPMResult {
    const guardResult = this.prepareSolve();
    if (guardResult) return guardResult;

    this.dateDrivers = this.options.traceDateDrivers ? {} : null;
    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const lateDates = this.backwardPass(order, earlyDates);
    this.applyAlap(order, earlyDates, lateDates);
    const outOfSequenceSequenceIds = this.detectOutOfSequence(earlyDates);
    const externalSuccessorViolations = this.detectExternalSuccessorViolations(earlyDates);
    const result = computeScheduleResults({
      order,
      earlyDates,
      lateDates,
      outOfSequenceSequenceIds,
      tasks: this.tasks,
      sequences: this.sequences,
      successors: this.successors,
      seqConstraint: this.seqConstraint,
      schedulingOptions: this.options.schedulingOptions,
      dataDate: this.dataDate,
      truncatedLeadIds: this.truncatedLeadIds,
      hardPinViolatedIds: this.hardPinViolatedIds,
      hammockNoFinishDriverIds: this.hammockNoFinishDriverIds,
      projectEngine: this.projectEngine,
      calendarFor: (t) => this.calendarFor(t),
      progressCalendarFor: (t) => this.progressCalendarFor(t),
      signedFloat: (a, b, eng, task) => this.signedFloat(a, b, eng, task),
      signedFloatMinutes: (a, b, eng, task) => this.signedFloatMinutes(a, b, eng, task),
      countsInWorkdays: (task) => this.countsInWorkdays(task),
      constraintInstant: (c, eng) => this.constraintInstant(c, eng),
      snapOnOrAfter: (eng, d) => this.snapOnOrAfter(eng, d),
      snapOnOrBefore: (eng, d) => this.snapOnOrBefore(eng, d),
      milestoneLateMoment: (t, c, eng) => this.milestoneLateMoment(t, c, eng),
      backwardFloatTrace: this.backwardFloatTrace,
      completedOutOfSequenceEs: this.completedOutOfSequenceEs,
      completedPhysicalPoints: this.completedPhysicalPoints,
    });
    if (this.cappedTaskIds.length > 0) result.cappedTaskIds = [...new Set(this.cappedTaskIds)];
    if (externalSuccessorViolations.length > 0) result.externalSuccessorViolations = externalSuccessorViolations;
    if (this.externalLagCalendarFallbackIds.size > 0) {
      result.externalLagCalendarFallbackTaskIds = [...this.externalLagCalendarFallbackIds];
    }
    if (Object.keys(this.plannedFloorTraceByTaskId).length > 0) {
      result.plannedFloorTraceByTaskId = { ...this.plannedFloorTraceByTaskId };
    }
    if (this.dateDrivers) result.dateDriverByTaskId = this.dateDrivers;
    if (this.backwardFloatTrace) {
      result.backwardFloatTrace = {
        projectEndSource: this.backwardFloatTrace.projectEndSource,
        byTaskId: { ...this.backwardFloatTrace.byTaskId },
      };
    }
    if (this.droppedSequenceIds.length > 0) result.droppedSequenceIds = [...this.droppedSequenceIds];
    return result;
  }

  private detectCycle(): string[] | null {
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of this.tasks.keys()) {
      color.set(id, 0);
    }

    for (const id of this.tasks.keys()) {
      if (color.get(id) === 0) {
        const cycle = this.dfsVisit(id, color, parent);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  private dfsVisit(
    start: string,
    color: Map<string, number>,
    parent: Map<string, string | null>,
  ): string[] | null {
    color.set(start, 1);
    const stack: Array<{ u: string; succ: Sequence[]; i: number }> = [
      { u: start, succ: this.successors.get(start) || [], i: 0 },
    ];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.i >= frame.succ.length) {
        color.set(frame.u, 2);
        stack.pop();
        continue;
      }
      const u = frame.u;
      const v = frame.succ[frame.i++].successorId;
      if (!this.tasks.has(v)) continue;

      if (color.get(v) === 1) {
        const cycle: string[] = [v, u];
        let current = u;
        while (current !== v) {
          const p = parent.get(current);
          if (p === null || p === undefined) break;
          cycle.push(p);
          current = p;
          if (current === v) break;
        }
        cycle.reverse();
        return cycle;
      }

      if (color.get(v) === 0) {
        parent.set(v, u);
        color.set(v, 1);
        stack.push({ u: v, succ: this.successors.get(v) || [], i: 0 });
      }
    }
    return null;
  }

  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
    }
    for (const seq of this.sequences) {
      inDegree.set(seq.successorId, (inDegree.get(seq.successorId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    const inResult = new Set<string>();
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head];
      result.push(id);
      inResult.add(id);
      for (const seq of this.successors.get(id) || []) {
        const newDeg = (inDegree.get(seq.successorId) || 1) - 1;
        inDegree.set(seq.successorId, newDeg);
        if (newDeg === 0) queue.push(seq.successorId);
      }
    }

    for (const id of this.tasks.keys()) {
      if (!inResult.has(id)) result.push(id);
    }

    return result;
  }

  private forwardProjectStart(): Date | null {
    let projectStart: Date | null = null;
    for (const t of this.tasks.values()) {
      if ((this.predecessors.get(t.id) || []).length > 0) continue;
      const eng = this.calendarFor(t);
      const anchor = isZeroDurationMilestone(t) && !eng.hasOwnWorkBlocks && taskDurationUnit(t) !== 'hours'
        ? this.dayFirstBandStart(eng, parseInstant(t.time.scheduleStart))?.toISOString().slice(0, 16) ?? t.time.scheduleStart
        : t.time.scheduleStart;
      const s = this.rootFloor(eng, anchor, isElapsedTask(t));
      if (!projectStart || s < projectStart) projectStart = s;
    }
    return projectStart;
  }

  private forwardPass(
    order: string[],
    results = new Map<string, { es: Date; ef: Date }>(),
    projectStart = this.forwardProjectStart(),
  ): Map<string, { es: Date; ef: Date }> {
    const drivers = this.dateDrivers;
    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const cal = this.calendarFor(task);
      const preds = this.predecessors.get(taskId) || [];
      const hardFinishPin = this.hardPinFinish(task, cal);

      const completedXerLoeActualFinish = explainCompletedXerLoeActualFinishEligibilityResolved(
        task,
        this.options.dataDate ? parseInstant(this.options.dataDate) : null,
        this.options.schedulingOptions,
        preds,
        this.successors.get(taskId) || [],
      );
      if (task.isHammock && !completedXerLoeActualFinish.eligible) {
        const relationalEarlyStart = this.hammockEarlyStart(task, preds, results, projectStart, cal);
        const targetWindowWorkMinutes = this.options.schedulingOptions?.p6OpenLoeTargetSpan === true
          && cal.hasOwnWorkBlocks
          ? cal.workMinutesBetween(
              parseInstant(task.time.scheduleStart),
              parseInstant(task.time.scheduleFinish),
            )
          : Number.NaN;
        const openXerLoeTargetSpan = explainOpenXerLoeTargetSpanEligibilityResolved(
          task,
          this.options.schedulingOptions,
          preds,
          this.successors.get(taskId) || [],
          relationalEarlyStart,
          targetWindowWorkMinutes,
          cal.hoursPerDay * 60,
        );
        const es = openXerLoeTargetSpan.eligible
          ? parseInstant(task.time.scheduleStart)
          : relationalEarlyStart;
        const { ef, hasFinishDriver } = openXerLoeTargetSpan.eligible
          ? { ef: parseInstant(task.time.scheduleFinish), hasFinishDriver: true }
          : this.hammockEarlyFinish(task, preds, results, es, cal);
        if (!hasFinishDriver) this.hammockNoFinishDriverIds.push(taskId);
        writeDerivedSpan(task, es, ef, cal);
        if (drivers) drivers[taskId] = DRIVER.hammock;
        results.set(taskId, { es, ef });
        continue;
      }

      if (task.manuallyScheduled) {
        let es = parseInstant(task.time.scheduleStart);
        const ef = parseInstant(task.time.scheduleFinish);
        if (ef < es) es = ef;
        if (drivers) drivers[taskId] = DRIVER.manual;
        results.set(taskId, { es, ef });
        continue;
      }

      let earlyStart: Date;
      let driver: TaskDateDriver = DRIVER.other;
      let sfFinishFloor: Date | null = null;
      let sfFinishFloorPredecessorId: string | null = null;
      let timephasedFinishFloorIsDegenerateResnap = false;

      const noPreds = preds.length === 0;
      if (noPreds) {
        const rootElapsed = isElapsedTask(task);
        const rawOwnAnchor = parseInstant(task.time.scheduleStart);
        const rootAnchorIsBandEnd = this.isExactBandEnd(cal, rawOwnAnchor);
        const timephasedAnchorIsDegenerateResnap = !!task.timephasedStartAnchor && rootAnchorIsBandEnd;
        const timephasedAnchor = timephasedAnchorIsDegenerateResnap ? undefined : task.timephasedStartAnchor;
        timephasedFinishFloorIsDegenerateResnap = !!task.timephasedFinishFloor && rootAnchorIsBandEnd;
        earlyStart = rootElapsed
          ? parseInstant(task.time.scheduleStart)
          : timephasedAnchor
            ? parseInstant(timephasedAnchor)
            : this.ownAnchor(cal, task.time.scheduleStart, task);
        driver = DRIVER.ownStart;
        if (this.dataDate && this.isUnstartedAlapPositionedFromSuccessors(task, cal)) {
          earlyStart = this.snapOnOrAfter(cal, this.dataDate);
          driver = DRIVER.statusDate;
        }
        const beforeConstraint = earlyStart;
        earlyStart = this.applyForwardConstraints(task, earlyStart, null, cal);
        const constraintMoved = earlyStart.getTime() !== beforeConstraint.getTime();
        if (drivers && (constraintMoved || this.hardPinStart(task, cal))) driver = this.constraintDriver(task);
        earlyStart = (rootElapsed || timephasedAnchor || !constraintMoved) ? earlyStart : this.snapSuccessorEarlyStart(cal, earlyStart, task);
      } else {
        earlyStart = projectStart ? new Date(projectStart.getTime()) : new Date(0);
        let rawMax: Date | null = null;
        const c6FloatBoundaries: Array<[string, Date, Date]> = [];
        for (const seq of preds) {
          const rawPredResult = results.get(seq.predecessorId);
          const predTask = this.tasks.get(seq.predecessorId);
          if (!rawPredResult || !predTask) continue;
          const c6LagEng = this.relDeps.lagEngine(this.relationEngineFor(predTask), cal);
          const oosSeq = this.completedOutOfSequenceRelationSeq(predTask, seq, cal);
          const relSeq = this.inProgressStartLagSeq(predTask, oosSeq, c6LagEng);
          const predResult = this.inProgressStartLagAnchor(
            predTask, oosSeq, c6LagEng, this.completedPredecessorRelationWindow(predTask, rawPredResult),
          );
          const constraintDate = forwardConstraint(
            this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          this.seqConstraint.set(seq.id, constraintDate);
          if (this.finishFinishAtStartMilestoneLateFinish(seq, task, this.relationEngineFor(predTask), cal)) {
            c6FloatBoundaries.push([seq.id, forwardConstraint(
              this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
              this.p6ZeroDurationUsesFinishBoundary(task, cal), true,
            ), constraintDate]);
          }
          if (!rawMax || constraintDate > rawMax) rawMax = constraintDate;
          if (constraintDate > earlyStart) {
            earlyStart = constraintDate;
          }
          const finishFloor = forwardFinishFloor(
            this.relDeps, predResult, predTask, relSeq, task, this.relationEngineFor(predTask), cal,
            this.p6ZeroDurationUsesFinishBoundary(task, cal),
          );
          if (finishFloor && (!sfFinishFloor || finishFloor > sfFinishFloor)) {
            sfFinishFloor = finishFloor;
            sfFinishFloorPredecessorId = seq.predecessorId;
          }
        }
        for (const [seqId, c6Boundary, normalBoundary] of c6FloatBoundaries) {
          if (rawMax && normalBoundary < rawMax) this.seqConstraint.set(seqId, c6Boundary);
        }
        const networkEarlyStart = earlyStart;
        if (this.options.schedulingOptions?.p6UseTaskPlannedStartFloor === true) {
          const plannedFloor = this.ownAnchor(cal, task.time.scheduleStart, task);
          const networkFinish = this.finishFromStart(cal, earlyStart, task);
          const plannedFinish = parseInstant(task.time.scheduleFinish);
          const p6InvertedFinishBoundary = isZeroDurationMilestone(task)
            && task.milestoneKind === 'FINISH' && plannedFinish < plannedFloor;
          const plannedWindowIsLater = p6InvertedFinishBoundary
            ? plannedFloor > earlyStart
            : plannedFloor.getTime() - earlyStart.getTime() > MS_PER_DAY
              && plannedFinish.getTime() - networkFinish.getTime() > MS_PER_DAY;
          const startedTaskSkipsFloor = this.options.schedulingOptions?.p6StartedTaskIgnoresPlannedStartFloor === true
            && !!task.time.actualStart && task.time.completion < 1;
          const alapSkipsFloor = this.isUnstartedAlapPositionedFromSuccessors(task, cal);
          if (
            task.p6ActivityType !== undefined
            && task.p6ExplicitTargetWindow === true
            && !Number.isNaN(plannedFloor.getTime())
            && !Number.isNaN(plannedFinish.getTime())
            && !Number.isNaN(networkFinish.getTime())
          ) {
            const drivingSequences = preds.filter(sequence =>
              this.seqConstraint.get(sequence.id)?.getTime() === earlyStart.getTime());
            const drivingSequence = drivingSequences.length === 1 ? drivingSequences[0] : undefined;
            const projectStartIsBoundary = drivingSequences.length === 0
              && projectStart?.getTime() === earlyStart.getTime();
            const drivingPredecessor = drivingSequence
              ? this.tasks.get(drivingSequence.predecessorId)
              : undefined;
            const boundarySource = drivingSequence
              ? drivingSequence.p6StartAtPredecessorFinishBoundary
                ? 'relationship:p6-predecessor-finish-boundary' as const
                : 'relationship' as const
              : 'project-start' as const;
            if (drivingSequence || projectStartIsBoundary) {
              this.plannedFloorTraceByTaskId[taskId] = {
                preFloorEarlyStart: earlyStart.toISOString().slice(0, 16),
                preFloorEarlyFinish: networkFinish.toISOString().slice(0, 16),
                targetStart: plannedFloor.toISOString().slice(0, 16),
                targetFinish: plannedFinish.toISOString().slice(0, 16),
                plannedWindowIsLater,
                floorApplied: plannedWindowIsLater && !startedTaskSkipsFloor && !alapSkipsFloor,
                boundarySource,
                ...(drivingSequence ? { boundarySequenceId: drivingSequence.id } : {}),
                ...(drivingPredecessor ? { boundaryPredecessorTaskCode: drivingPredecessor.wbsCode } : {}),
              };
            }
          }
          if (plannedWindowIsLater && !startedTaskSkipsFloor && !alapSkipsFloor) earlyStart = plannedFloor;
        }
        if (rawMax && projectStart && rawMax < projectStart) {
          for (const seq of preds) {
            const c = this.seqConstraint.get(seq.id);
            const predTask = this.tasks.get(seq.predecessorId);
            if (!c || !predTask) continue;
            const predLagDays = resolveEffectiveLagDays(
              seq, predTask, this.calendarFor(predTask).hoursPerDay,
            );
            if (formatDate(c) === formatDate(rawMax) && predLagDays < 0) {
              this.truncatedLeadIds.push(seq.id);
            }
          }
        }
        const beforeConstraints = earlyStart;
        earlyStart = this.applyForwardConstraints(task, earlyStart, rawMax, cal);
        if (drivers) {
          driver = this.networkDriver(task, cal, preds, rawMax, networkEarlyStart, beforeConstraints, earlyStart);
        }
        const preserveP6FinishBoundary = preds.some(sequence =>
          sequence.p6StartAtPredecessorFinishBoundary === true
          && this.seqConstraint.get(sequence.id)?.getTime() === earlyStart.getTime());
        earlyStart = this.snapSuccessorEarlyStart(
          cal,
          earlyStart,
          task,
          preserveP6FinishBoundary,
        );
      }

      const undelayedEarlyStart = earlyStart;
      if (task.levelingDelay) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
        if (!isElapsedTask(task)) {
          earlyStart = this.snapSuccessorEarlyStart(cal, earlyStart, task);
        }
      } else if (!noPreds && task.levelingDelayMinutes) {
        earlyStart = this.shiftByLevelingDelay(cal, task, earlyStart, 1);
        const taskElapsedForSnap = isElapsedTask(task);
        if (!taskElapsedForSnap && task.levelingDelayElapsed) {
          earlyStart = this.snapOnOrAfter(cal, earlyStart);
        } else if (!taskElapsedForSnap) {
          earlyStart = this.snapSuccessorEarlyStart(cal, earlyStart, task);
        }
      }
      if (earlyStart.getTime() !== undelayedEarlyStart.getTime()) driver = DRIVER.leveling;

      const dataDate = this.dataDate;
      const progressCal = this.progressCalendarFor(task, cal);
      this.recordCompletedOutOfSequenceWindow(task, preds, results, progressCal);
      const physicalPoint = this.recordCompletedPhysicalPoint(task, preds, results, progressCal);
      if (physicalPoint !== null) {
        if (this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true) {
          for (const seq of preds) this.seqConstraint.delete(seq.id);
        }
        if (drivers) drivers[taskId] = DRIVER.progress;
        results.set(taskId, { es: physicalPoint, ef: new Date(physicalPoint.getTime()) });
        continue;
      }
      {
        const t = task.time;
        if (isPinnedComplete(t)) {
          const preserveP6ActualInstants = task.p6ProjectId !== undefined
            && this.options.schedulingOptions?.p6PreserveActualInstants === true;
          const actualStart = parseInstant(t.actualStart ?? t.actualFinish);
          const preserveActualInstants = preserveP6ActualInstants || isElapsedTask(task) || isZeroDurationMilestone(task);
          let es = preserveActualInstants
            ? actualStart
            : this.snapActualForward(progressCal, actualStart);
          const actualFinish = parseInstant(t.actualFinish);
          let ef = preserveActualInstants ? actualFinish : this.snapOnOrBefore(progressCal, actualFinish);
          if (t.actualFinish.includes('T')
            && utcDayStart(ef).getTime() === utcDayStart(actualFinish).getTime()) ef = actualFinish;
          if (isZeroDurationMilestone(task)) es = ef;
          if (ef < es) es = ef;
          if (this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true) {
            for (const seq of preds) this.seqConstraint.delete(seq.id);
          }
          if (drivers) drivers[taskId] = DRIVER.progress;
          results.set(taskId, { es, ef });
          continue;
        }
        if (isPinnedInProgress(t)) {
          const actualES = t.actualStart
            ? task.p6ProjectId !== undefined
                && this.options.schedulingOptions?.p6PreserveActualInstants === true
              ? parseInstant(t.actualStart)
              : this.snapActualForward(progressCal, parseInstant(t.actualStart))
            : earlyStart;
          const work = this.progressWork(task, progressCal);
          const totalSpan = work.total;
          const remaining = work.remaining;
          const isElapsedTask = work.measure === 'elapsed';
          const remainingElapsedMinutes = isElapsedTask ? CPMSolver.elapsedWorkMinutes(remaining, task) : 0;
          let remStart = dataDate ?? actualES;
          let usedResumeOverride = false;
          for (const seq of preds) {
            const predTask = this.tasks.get(seq.predecessorId);
            if (predTask && this.progressOverrideIgnoresRelation(predTask, task)) this.seqConstraint.delete(seq.id);
          }
          if (this.options.progressMode !== 'PROGRESS_OVERRIDE') {
            const mayUseResume = task.p6ProjectId ? hasValidP6SuspendResume(task) : true;
            const resumeOverride = mayUseResume && t.resume && task.resourceIds.length <= 1
              ? parseInstant(t.resume)
              : null;
            if (resumeOverride && !isNaN(resumeOverride.getTime())) {
              remStart = resumeOverride;
              usedResumeOverride = true;
            } else {
            if (earlyStart > remStart) remStart = earlyStart;
            const elapsed = this.options.schedulingOptions?.resumeFromActualElapsed && remaining > 0
              ? Math.max(0, totalSpan - remaining)
              : 0;
            if (elapsed > 0) {
              const elapsedAnchor = isElapsedTask
                ? addElapsedMinutes(actualES, CPMSolver.elapsedWorkMinutes(elapsed, task))
                : work.measure === 'minutes'
                  ? this.snapOnOrAfter(progressCal, progressCal.addWorkMinutes(actualES, elapsed))
                  : this.snapOnOrAfter(progressCal, progressCal.addMeasuredWorkdays(actualES, elapsed));
              if (elapsedAnchor > remStart) remStart = elapsedAnchor;
            }
            }
          }
          const remainingWithGaps = this.remainingWithSplitGaps(task, progressCal, work);
          let ef: Date;
          if (isElapsedTask) {
            ef = addElapsedMinutes(remStart, remainingElapsedMinutes);
          } else if (work.measure === 'minutes') {
            ef = progressCal.addWorkMinutes(remStart, remainingWithGaps);
          } else {
            const r = progressCal.addMeasuredWorkdaysChecked(remStart, remainingWithGaps);
            ef = r.date;
            if (r.capped) this.cappedTaskIds.push(taskId);
          }
          if (usedResumeOverride && ef < actualES) ef = actualES;
          if (task.p6ProjectId && this.options.schedulingOptions?.useExpectedFinishDates === true
              && task.p6ExpectedFinish) {
            const parsedExpected = parseInstant(task.p6ExpectedFinish);
            const expected = !task.p6ExpectedFinish.includes('T')
              ? progressCal.prevWorkInstantOrNull(new Date(
                utcDayStart(parsedExpected).getTime() + MS_PER_DAY,
              ))
              : parsedExpected;
            if (expected && !isNaN(expected.getTime())) ef = expected;
          }
          const unboundedRemainingFinish = ef;
          ef = this.finishNotBeforeFinishFinishBound(preds, results, progressCal, ef);
          if (drivers) {
            const networkDrivesRest = !usedResumeOverride
              && this.options.progressMode !== 'PROGRESS_OVERRIDE'
              && remStart.getTime() === earlyStart.getTime()
              && earlyStart > (dataDate ?? actualES);
            if (ef.getTime() !== unboundedRemainingFinish.getTime()) driver = DRIVER.other;
            else if (!networkDrivesRest) {
              driver = !usedResumeOverride && dataDate && remStart.getTime() === dataDate.getTime()
                ? DRIVER.statusDate
                : DRIVER.progress;
            }
            drivers[taskId] = driver;
          }
          const displayedEarlyStart =
            this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
            ? remStart
            : actualES;
          results.set(taskId, { es: displayedEarlyStart, ef });
          continue;
        }
        if (
          dataDate && t.completion === 0 && earlyStart < dataDate
          && !this.options.schedulingOptions?.unstartedIgnoresStatusDate
        ) {
          earlyStart = dataDate;
          driver = DRIVER.statusDate;
        }
      }

      if (noPreds && isZeroDurationMilestone(task)
        && ![task.constraint, task.constraint2].some(c => this.milestoneConstraintMoment(task, c, cal))
        && (task.milestoneKind === 'FINISH' || (this.successors.get(taskId)?.length ?? 0) === 0)
        && this.options.schedulingOptions.milestoneWithoutPredecessorAtDayEnd
        && earlyStart.getTime() === this.dayFirstBandStart(cal, earlyStart)?.getTime()) {
        earlyStart = this.dayLastBandEnd(cal, earlyStart) ?? earlyStart;
      }

      const { date: earlyFinishRaw, capped } = this.addDurationChecked(cal, earlyStart, task);
      if (capped) this.cappedTaskIds.push(taskId);
      let earlyFinish = !hardFinishPin && sfFinishFloor && sfFinishFloor > earlyFinishRaw
        ? sfFinishFloor
        : earlyFinishRaw;
      if (drivers && earlyFinish !== earlyFinishRaw && sfFinishFloorPredecessorId) {
        driver = { kind: 'relation', predecessorIds: [sfFinishFloorPredecessorId] };
      }
      const tf = this.timephasedFinish(task, hardFinishPin, sfFinishFloor, timephasedFinishFloorIsDegenerateResnap);
      if (tf) {
        earlyFinish = tf;
        driver = DRIVER.other;
      }
      if (tf && earlyFinish < earlyStart) earlyFinish = earlyStart;
      if (!hardFinishPin) {
        const unboundedFinish = earlyFinish;
        earlyFinish = this.finishNotBeforeFinishFinishBound(preds, results, cal, earlyFinish);
        if (earlyFinish.getTime() !== unboundedFinish.getTime()) driver = DRIVER.other;
      }

      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && isZeroDurationMilestone(task) && task.milestoneKind === 'FINISH') {
        const plannedStart = parseInstant(task.time.scheduleStart);
        const plannedFinish = parseInstant(task.time.scheduleFinish);
        if (plannedFinish < plannedStart && earlyStart.getTime() === plannedStart.getTime()) {
          earlyFinish = plannedFinish;
        }
      } else if (this.p6ZeroDurationActivityUsesBoundaryPair(task, cal)) {
        earlyFinish = this.p6PreviousCalendarFinishBoundary(task, earlyStart);
      }

      if (drivers) drivers[taskId] = driver;
      results.set(taskId, { es: earlyStart, ef: earlyFinish });
    }

    return results;
  }

  private constraintDriver(task: Task): TaskDateDriver {
    return task.externalLinks?.length ? DRIVER.other : DRIVER.constraint;
  }

  private networkDriver(
    task: Task,
    cal: CalendarEngine,
    preds: Sequence[],
    rawMax: Date | null,
    networkEarlyStart: Date,
    beforeConstraints: Date,
    afterConstraints: Date,
  ): TaskDateDriver {
    if (this.hardPinStart(task, cal) || afterConstraints.getTime() !== beforeConstraints.getTime()) {
      return this.constraintDriver(task);
    }
    if (beforeConstraints.getTime() !== networkEarlyStart.getTime()) return DRIVER.plannedStart;
    if (!rawMax || rawMax.getTime() !== networkEarlyStart.getTime()) return DRIVER.projectStart;
    const predecessorIds = preds
      .filter(seq => this.seqConstraint.get(seq.id)?.getTime() === rawMax.getTime())
      .map(seq => seq.predecessorId);
    return { kind: 'relation', predecessorIds: [...new Set(predecessorIds)] };
  }

  private hammockEarlyStart(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    projectStart: Date | null,
    cal: CalendarEngine,
  ): Date {
    let es = projectStart ? new Date(projectStart.getTime()) : new Date(0);
    for (const seq of preds) {
      if (seq.type !== 'START_START' && seq.type !== 'FINISH_START') continue;
      const predResult = results.get(seq.predecessorId);
      const predTask = this.tasks.get(seq.predecessorId);
      if (!predResult || !predTask) continue;
      const c = forwardConstraint(
        this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
        this.p6ZeroDurationUsesFinishBoundary(task, cal),
      );
      if (c > es) es = c;
    }
    return this.snapOnOrAfter(cal, es);
  }

  private hammockEarlyFinish(
    task: Task,
    preds: Sequence[],
    results: Map<string, { es: Date; ef: Date }>,
    es: Date,
    cal: CalendarEngine,
  ): { ef: Date; hasFinishDriver: boolean } {
    let ef: Date | null = null;
    for (const seq of preds) {
      if (seq.type !== 'FINISH_FINISH' && seq.type !== 'START_FINISH') continue;
      const predResult = results.get(seq.predecessorId);
      const predTask = this.tasks.get(seq.predecessorId);
      if (!predResult || !predTask) continue;
      const startEquiv = forwardConstraint(
        this.relDeps, predResult, predTask, seq, task, this.calendarFor(predTask), cal,
        this.p6ZeroDurationUsesFinishBoundary(task, cal),
      );
      const finishBound = this.finishFromStart(cal, startEquiv, task);
      if (!ef || finishBound > ef) ef = finishBound;
    }
    const hasFinishDriver = ef !== null;
    let earlyFinish = ef ?? new Date(es.getTime());
    if (earlyFinish < es) earlyFinish = new Date(es.getTime());
    return { ef: earlyFinish, hasFinishDriver };
  }

  private detectOutOfSequence(earlyDates: Map<string, { es: Date; ef: Date }>): string[] {
    const out: string[] = [];
    for (const seq of this.sequences) {
      const pred = this.tasks.get(seq.predecessorId);
      const succ = this.tasks.get(seq.successorId);
      if (!pred || !succ) continue;
      const succAS = succ.time.actualStart ? parseInstant(succ.time.actualStart) : null;
      const succAF = succ.time.actualFinish ? parseInstant(succ.time.actualFinish) : null;
      const predAS = pred.time.actualStart ? parseInstant(pred.time.actualStart) : null;
      const predAF = pred.time.actualFinish ? parseInstant(pred.time.actualFinish) : null;
      const predEF = earlyDates.get(seq.predecessorId)?.ef ?? null;
      switch (seq.type) {
        case 'START_START': {
          if (succAS && predAS && succAS < predAS) out.push(seq.id);
          break;
        }
        case 'FINISH_FINISH':
        case 'START_FINISH': {
          if (succAF) {
            const predFin = predAF ?? predEF;
            if (!predAF || (predFin && succAF < predFin)) out.push(seq.id);
          }
          break;
        }
        case 'FINISH_START':
        default: {
          if (succAS) {
            const prefEF = predAF ?? predEF;
            if (!predAF || (prefEF && succAS < prefEF)) out.push(seq.id);
          }
          break;
        }
      }
    }
    return out;
  }

  private constraintInstant(c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const raw = c?.date;
    if (!raw) return null;
    if (c && ['FNET', 'FNLT', 'MFO'].includes(c.type) && !raw.includes('T')) {
      return deadlineBound(raw, eng);
    }
    const d = parseInstant(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private hardPinStart(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const milestoneMoment = this.milestoneConstraintMoment(task, c, eng);
    if (milestoneMoment) return milestoneMoment;
    const snapped = c.type === 'MFO'
      && this.snapOnOrBefore(eng, d).getTime() === d.getTime()
      ? d : this.snapOnOrAfter(eng, d);
    return c.type === 'MSO' ? snapped : this.startFromFinish(eng, snapped, task);
  }

  private hardPinFinish(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const milestoneMoment = this.milestoneConstraintMoment(task, c, eng);
    if (milestoneMoment) return milestoneMoment;
    const snapped = c.type === 'MFO'
      && this.snapOnOrBefore(eng, d).getTime() === d.getTime()
      ? d : this.snapOnOrAfter(eng, d);
    return c.type === 'MFO' ? snapped : this.addDuration(eng, snapped, task);
  }

  private timephasedFinish(
    task: Task, hardFinishPin: Date | null, sfFinishFloor: Date | null,
    finishFloorIsDegenerateResnap = false,
  ): Date | null {
    if (hardFinishPin) return null;
    let windowValue: Date | null = null;
    if (task.timephasedFinishFloor && !finishFloorIsDegenerateResnap) {
      windowValue = parseInstant(task.timephasedFinishFloor);
    } else if (task.timephasedDurationWalks && task.timephasedDurationWalks.length > 0) {
      const durMin = task.time.durationMinutes;
      if (durMin != null) {
        for (const walk of task.timephasedDurationWalks) {
          const resCal = resolveCalendar(walk.resourceCalendarId, this.registry, this.projectCal);
          const resEng = this.engineForCal(resCal);
          if (!resEng.isHourMode) continue;
          const walkMinutes = walk.workMinutes ?? durMin;
          const candidate = resEng.addWorkMinutes(parseInstant(walk.anchor), walkMinutes);
          if (!windowValue || candidate > windowValue) windowValue = candidate;
        }
      }
    }
    if (!windowValue) return null;
    return sfFinishFloor && sfFinishFloor > windowValue ? sfFinishFloor : windowValue;
  }

  private hardPinRespectedByActual(task: Task, eng: CalendarEngine): boolean {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return false;
    const t = task.time;
    if (c.type === 'MSO') {
      if (!t.actualStart) return false;
      const pin = this.hardPinStart(task, eng);
      if (!pin) return false;
      const actualES = this.snapOnOrAfter(eng, parseInstant(t.actualStart));
      return formatDate(actualES) === formatDate(pin);
    }
    if (!t.actualFinish) return false;
    const pinFinish = this.hardPinFinish(task, eng);
    if (!pinFinish) return false;
    const actualEF = this.snapOnOrAfter(eng, parseInstant(t.actualFinish));
    return formatDate(actualEF) === formatDate(pinFinish);
  }

  private forwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    const noSnap = isZeroDurationMilestone(task) && c.date?.includes('T');
    if (c.type === 'SNET' || c.type === 'MSO') return noSnap ? d : this.snapOnOrAfter(eng, d);
    if (c.type === 'FNET' || c.type === 'MFO') {
      const finish = this.snapOnOrBefore(eng, d).getTime() === d.getTime()
        ? d : noSnap ? d : this.snapOnOrAfter(eng, d);
      return this.startFromFinish(eng, finish, task);
    }
    return null;
  }

  private milestoneConstraintMoment(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    if (!isZeroDurationMilestone(task) || (c?.type !== 'MSO' && c?.type !== 'MFO')) return null;
    return this.forwardBoundOf(task, c, eng);
  }

  private milestoneLateMoment(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    if (c?.type === 'SNLT' && isZeroDurationMilestone(task)) {
      return this.forwardBoundOf(task, { ...c, type: 'SNET' }, eng);
    }
    return this.milestoneConstraintMoment(task, c, eng);
  }

  private backwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    const milestoneMoment = this.milestoneLateMoment(task, c, eng);
    if (milestoneMoment) return milestoneMoment;
    const preserveMilestoneInstant =
      this.options.schedulingOptions?.p6PreserveZeroDurationConstraintInstants === true
      && isZeroDurationMilestone(task) && eng.hasOwnWorkBlocks && c.date?.includes('T');
    const dW = preserveMilestoneInstant ? d : this.snapOnOrBefore(eng, d);
    if (c.type === 'FNLT' || c.type === 'MFO') return dW;
    if (c.type === 'SNLT' || c.type === 'MSO') {
      const start = !isElapsedTask(task) && !isZeroDurationMilestone(task)
        ? this.snapOnOrAfter(eng, dW) : dW;
      return this.finishFromStart(eng, start, task);
    }
    return null;
  }

  private externalLagMinutes(link: ExternalLink, eng: CalendarEngine): number {
    if (isFiniteNumber(link.lagMinutes)) return link.lagMinutes;
    const days = isFiniteNumber(link.lagDays) ? link.lagDays : 0;
    return days * eng.hoursPerDay * 60;
  }

  private externalLagEngine(link: ExternalLink, ownEng: CalendarEngine): { eng: CalendarEngine; fallback: boolean } {
    switch (this.options.schedulingOptions?.lagCalendar) {
      case '24hour': return { eng: this.twentyFourHourLagEngine, fallback: false };
      case 'projectDefault': return { eng: this.projectEngine, fallback: false };
      case 'successor': return { eng: ownEng, fallback: link.direction === 'successor' };
      case 'predecessor':
      default: return { eng: ownEng, fallback: link.direction === 'predecessor' };
    }
  }

  private externalLag(
    task: Task, link: ExternalLink, anchor: Date, eng: CalendarEngine, sign: 1 | -1,
  ): { at: Date; foreign: boolean; lagEng: CalendarEngine } {
    const { eng: lagEng, fallback } = this.externalLagEngine(link, eng);
    const minutes = this.externalLagMinutes(link, lagEng);
    if (minutes === 0) return { at: eng.addWorkingMinutesSigned(anchor, 0), foreign: false, lagEng: eng };
    if (fallback) this.externalLagCalendarFallbackIds.add(task.id);
    const seq: Sequence = {
      id: link.id, predecessorId: '', successorId: '', type: EXTERNAL_SEQUENCE_TYPE[link.relType],
      lagDays: isFiniteNumber(link.lagDays) ? link.lagDays : 0,
      ...(isFiniteNumber(link.lagMinutes) ? { lagMinutes: link.lagMinutes } : {}),
    };
    return { at: this.shiftLagPred(lagEng, anchor, seq, task, sign), foreign: true, lagEng };
  }

  private externalForwardBound(task: Task, link: ExternalLink, eng: CalendarEngine): Date | null {
    if (link.direction !== 'predecessor') return null;
    const anchor = parseInstant(link.anchorDate);
    if (isNaN(anchor.getTime())) return null;
    const rel = link.relType;
    const startSide = rel === 'FS' || rel === 'SS';
    const { at: shifted, foreign, lagEng } = this.externalLag(task, link, anchor, eng, 1);
    if (foreign) {
      if (startSide && isElapsedTask(task)) return shifted;
      if (rel === 'FS') return finishStartLaggedStart(this.relDeps, lagEng, eng, shifted, this.isFinishMilestone(task, eng));
      if (startSide) return eng.nextWorkInstant(shifted);
      const dayTask = !isZeroDurationMilestone(task) && !isElapsedTask(task) && this.countsInWorkdays(task);
      const finish = dayTask ? dayTaskRequiredFinish(this.relDeps, lagEng, eng, shifted, anchor) : shifted;
      return this.startFromFinish(eng, finish, task);
    }
    const finish = !startSide && taskDurationUnit(task) !== 'hours' && !isElapsedTask(task)
      && !isZeroDurationMilestone(task) ? eng.prevWorkInstant(shifted) : shifted;
    return startSide ? shifted : this.startFromFinish(eng, finish, task);
  }

  private externalSuccessorShift(
    task: Task, link: ExternalLink, eng: CalendarEngine,
  ): { at: Date; foreign: boolean; lagEng: CalendarEngine; finishSide: boolean } | null {
    if (link.direction !== 'successor') return null;
    const anchor = parseInstant(link.anchorDate);
    if (isNaN(anchor.getTime())) return null;
    const finishSide = link.relType === 'FS' || link.relType === 'FF';
    const shift = this.externalLag(task, link, anchor, eng, -1);
    if (!shift.foreign && isElapsedTask(task)) return { at: anchor, foreign: false, lagEng: eng, finishSide };
    return { ...shift, finishSide };
  }

  private externalBackwardBound(task: Task, link: ExternalLink, eng: CalendarEngine): Date | null {
    const shift = this.externalSuccessorShift(task, link, eng);
    if (!shift) return null;
    const { at: shifted, foreign, lagEng, finishSide } = shift;
    const rel = link.relType;
    if (foreign) {
      if (!finishSide) return this.finishFromStart(eng, shifted, task);
      if (isElapsedTask(task) || isZeroDurationMilestone(task)) return shifted;
      if (rel === 'FS') return eng.prevWorkInstant(shifted);
      return this.countsInWorkdays(task) ? previousBlockEndIfSame(this.relDeps, lagEng, eng, shifted) : shifted;
    }
    if (!finishSide) return this.finishFromStart(eng, shifted, task);
    if (isZeroDurationMilestone(task) || isElapsedTask(task)) return shifted;
    return this.snapOnOrBefore(eng, shifted);
  }

  private registerHardPinViolation(taskId: string): void {
    if (!this.hardPinViolatedIds.includes(taskId)) this.hardPinViolatedIds.push(taskId);
  }

  private detectExternalSuccessorViolations(
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): { taskId: string; linkId: string }[] {
    const out: { taskId: string; linkId: string }[] = [];
    for (const task of this.tasks.values()) {
      if (!task.externalLinks?.some(l => l.direction === 'successor')) continue;
      const early = earlyDates.get(task.id);
      if (!early) continue;
      const eng = this.calendarFor(task);
      for (const link of task.externalLinks) {
        if (link.direction !== 'successor') continue;
        const shift = this.externalSuccessorShift(task, link, eng);
        if (!shift) continue;
        const actualStart = !shift.finishSide && task.time.actualStart ? parseInstant(task.time.actualStart) : null;
        const own = actualStart && !isNaN(actualStart.getTime()) ? actualStart : shift.finishSide ? early.ef : early.es;
        if (own.getTime() <= shift.at.getTime()) continue;
        const late = isElapsedTask(task) || shift.lagEng.workMinutesBetween(shift.at, own) > 0;
        if (late) out.push({ taskId: task.id, linkId: link.id });
      }
    }
    return out;
  }


  private applyForwardConstraints(task: Task, earlyStart: Date, rawMax: Date | null, eng: CalendarEngine): Date {
    const pin = this.hardPinStart(task, eng);
    if (pin) {
      const internalLate = !!rawMax && rawMax > pin && !this.hardPinRespectedByActual(task, eng);
      let externalLate = false;
      for (const link of task.externalLinks ?? []) {
        const bound = this.externalForwardBound(task, link, eng);
        if (bound && bound > pin) externalLate = true;
      }
      if (internalLate || externalLate) this.registerHardPinViolation(task.id);
      return pin;
    }
    let es = earlyStart;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.forwardBoundOf(task, cc, eng);
      if (bound && bound > es) es = bound;
    }
    if (task.externalLinks && task.externalLinks.length > 0) {
      for (const link of task.externalLinks) {
        const bound = this.externalForwardBound(task, link, eng);
        if (bound && bound > es) es = bound;
      }
    }
    return es;
  }

  private applyBackwardBound(task: Task, lateFinish: Date, eng: CalendarEngine): Date {
    const pinFinish = this.hardPinFinish(task, eng);
    if (pinFinish) {
      const pinStart = this.hardPinStart(task, eng);
      let externalLate = false;
      for (const link of task.externalLinks ?? []) {
        const shift = this.externalSuccessorShift(task, link, eng);
        const pin = shift?.finishSide ? pinFinish : pinStart;
        if (shift && pin && shift.at < pin
          && (isElapsedTask(task) || shift.lagEng.workMinutesBetween(shift.at, pin) > 0)) externalLate = true;
      }
      if (externalLate) this.registerHardPinViolation(task.id);
      return pinFinish;
    }
    let lf = lateFinish;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.backwardBoundOf(task, cc, eng);
      if (bound && bound < lf) lf = bound;
    }
    if (task.externalLinks && task.externalLinks.length > 0) {
      for (const link of task.externalLinks) {
        const bound = this.externalBackwardBound(task, link, eng);
        if (bound && bound < lf) lf = bound;
      }
    }
    const dlW = deadlineBound(task.deadline, eng);
    if (dlW && dlW < lf) lf = dlW;
    return lf;
  }

  private applyAlap(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): void {
    const fromSuccessors = this.options.schedulingOptions?.p6AlapPositionedFromSuccessors === true;
    for (let i = order.length - 1; i >= 0; i--) {
      const taskId = order[i];
      const task = this.tasks.get(taskId);
      if (task?.constraint?.type !== 'ALAP') continue;
      if (task.manuallyScheduled) continue;
      if (fromSuccessors && this.isUnstartedAlapPositionedFromSuccessors(task, this.calendarFor(task))) {
        this.positionAlapFromSuccessors(taskId, earlyDates, lateDates);
        if (this.dateDrivers) this.dateDrivers[taskId] = DRIVER.constraint;
        continue;
      }
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) continue;

      const cal = this.calendarFor(task);
      const succs = this.successors.get(taskId) || [];
      if (!task.isHammock && !task.time.actualStart && task.time.completion === 0) {
        this.placeUnstartedAlap(taskId, task, cal, early, late, earlyDates);
        if (this.dateDrivers) this.dateDrivers[taskId] = DRIVER.constraint;
        continue;
      }
      let ff = Infinity;
      if (succs.length === 0) {
        ff = cal.signedWorkDaysBetween(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const cRaw = this.seqConstraint.get(seq.id);
          const succEarly = earlyDates.get(seq.successorId);
          const succTask = this.tasks.get(seq.successorId);
          if (!cRaw || !succEarly || !succTask) continue;
          const succCal = this.calendarFor(succTask);
          const f = succCal.workDaysBetween(succCal.nextWorkDay(cRaw), succEarly.es) - 1;
          if (f < ff) ff = f;
        }
      }
      if (!Number.isFinite(ff) || ff <= 0) continue;

      early.es = cal.addWorkingDaysSigned(early.es, ff);
      early.ef = cal.addWorkingDaysSigned(early.ef, ff);
      if (this.dateDrivers) this.dateDrivers[taskId] = DRIVER.constraint;
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask) continue;
        if (succTask.manuallyScheduled) continue;
        this.seqConstraint.set(
          seq.id,
          forwardConstraint(
            this.relDeps, early, task, seq, succTask, cal, this.calendarFor(succTask),
            this.p6ZeroDurationUsesFinishBoundary(succTask, this.calendarFor(succTask)),
          ),
        );
      }
    }
  }

  private alapLatestFinish(
    taskId: string,
    task: Task,
    cal: CalendarEngine,
    earlyDates: Map<string, { es: Date; ef: Date }>,
    late: { ls: Date; lf: Date },
  ): Date | null {
    const succs = this.successors.get(taskId) || [];
    let finish: Date | null = succs.length === 0 ? late.lf : null;
    for (const seq of succs) {
      const succTask = this.tasks.get(seq.successorId);
      const succEarly = earlyDates.get(seq.successorId);
      if (!succTask || !succEarly || !this.seqConstraint.has(seq.id)) continue;
      const succCal = this.calendarFor(succTask);
      const bound = backwardConstraint(
        this.relDeps, { ls: succEarly.es, lf: succEarly.ef }, seq, task, succTask, cal, succCal,
        this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
        this.finishFinishAtStartMilestoneLateFinish(seq, succTask, cal, succCal),
      );
      if (!finish || bound < finish) finish = bound;
    }
    return finish;
  }

  private placeUnstartedAlap(
    taskId: string,
    task: Task,
    cal: CalendarEngine,
    early: { es: Date; ef: Date },
    late: { ls: Date; lf: Date },
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): void {
    let finish = this.alapLatestFinish(taskId, task, cal, earlyDates, late);
    if (!finish) return;
    if (late.lf < finish) finish = late.lf;
    const elapsed = isElapsedTask(task);
    if (!elapsed && !isZeroDurationMilestone(task)) finish = this.snapOnOrBefore(cal, finish);
    const span = this.signedFloatMinutes(early.ef, finish, cal, task);
    if (!(span > 0)) return;
    const at = (ef: Date) => ({ es: this.startFromFinish(cal, ef, task), ef });
    let placed = at(finish);
    let updates = this.alapSuccessorBounds(taskId, task, cal, placed, earlyDates);
    if (!updates) {
      let lo = 0;
      let hi = Math.round(span);
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = at(elapsed
          ? new Date(early.ef.getTime() + mid * MS_PER_MIN)
          : cal.addWorkMinutes(early.ef, mid));
        const found = this.alapSuccessorBounds(taskId, task, cal, candidate, earlyDates);
        if (found) {
          lo = mid;
          placed = candidate;
          updates = found;
        } else {
          hi = mid;
        }
      }
    }
    if (!updates || placed.es <= early.es) return;
    early.es = placed.es;
    early.ef = placed.ef;
    for (const [seqId, bound] of updates) this.seqConstraint.set(seqId, bound);
  }

  private alapSuccessorBounds(
    taskId: string,
    task: Task,
    cal: CalendarEngine,
    placed: { es: Date; ef: Date },
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): Array<[string, Date]> | null {
    const updates: Array<[string, Date]> = [];
    for (const seq of this.successors.get(taskId) || []) {
      const succTask = this.tasks.get(seq.successorId);
      const before = this.seqConstraint.get(seq.id);
      if (!succTask || !before) continue;
      const succCal = this.calendarFor(succTask);
      const bound = forwardConstraint(
        this.relDeps, placed, task, seq, succTask, cal, succCal,
        this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
      );
      const succEarly = earlyDates.get(seq.successorId);
      if (succEarly && bound > before
        && this.signedFloatMinutes(succEarly.es, bound, succCal, succTask) > 0) return null;
      updates.push([seq.id, bound]);
    }
    return updates;
  }

  private isUnstartedAlapPositionedFromSuccessors(task: Task, cal: CalendarEngine): boolean {
    return this.options.schedulingOptions?.p6AlapPositionedFromSuccessors === true
      && task.constraint?.type === 'ALAP' && cal.hasOwnWorkBlocks
      && !task.time.actualStart && task.time.completion === 0;
  }

  private positionAlapFromSuccessors(
    taskId: string,
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): void {
    {
      const task = this.tasks.get(taskId);
      if (!task) return;
      const cal = this.calendarFor(task);
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) return;
      const succs = this.successors.get(taskId) || [];
      let finish = this.alapLatestFinish(taskId, task, cal, earlyDates, late);
      if (!finish) return;
      const upper = this.backwardBoundOf(task, task.constraint2, cal);
      if (upper && finish > upper) finish = upper;
      let start = this.startFromFinish(cal, finish, task);
      let floor: Date | null = this.dataDate;
      for (const seq of this.predecessors.get(taskId) || []) {
        const c = this.seqConstraint.get(seq.id);
        if (c && (!floor || c > floor)) floor = c;
      }
      const secondaryFloor = this.forwardBoundOf(task, task.constraint2, cal);
      if (secondaryFloor && (!floor || secondaryFloor > floor)) floor = secondaryFloor;
      if (floor && start < floor) {
        start = this.snapOnOrAfter(cal, floor);
        finish = this.finishFromStart(cal, start, task);
      }
      if (start.getTime() === early.es.getTime() && finish.getTime() === early.ef.getTime()) return;
      early.es = start;
      early.ef = finish;
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask || !this.seqConstraint.has(seq.id)) continue;
        this.seqConstraint.set(
          seq.id,
          forwardConstraint(
            this.relDeps, early, task, seq, succTask, cal, this.calendarFor(succTask),
            this.p6ZeroDurationUsesFinishBoundary(succTask, this.calendarFor(succTask)),
          ),
        );
      }
    }
  }

  private backwardPass(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): Map<string, { ls: Date; lf: Date }> {
    const results = new Map<string, { ls: Date; lf: Date }>();

    let projectEnd = new Date(0);
    for (const taskId of order) {
      const early = earlyDates.get(taskId);
      const task = this.tasks.get(taskId);
      if (!early || !task) continue;
      const completedWindow = this.p6CompletedDataDateWindowDecision(task);
      const usesCompletedDisplayWindow = completedWindow.eligible;
      let candidateEf = early.ef;
      if (usesCompletedDisplayWindow) {
        const progressCal = this.progressCalendarFor(task);
        const projectedEs = this.completedOutOfSequenceEs.get(taskId)
          ?? this.snapOnOrAfter(progressCal, this.dataDate!);
        candidateEf = progressCal.prevWorkInstant(projectedEs);
      }
      if (candidateEf > projectEnd) {
        projectEnd = candidateEf;
        if (this.backwardFloatTrace) {
          this.backwardFloatTrace.projectEndSource = usesCompletedDisplayWindow
            ? 'completedDisplayWindow'
            : 'maxEarlyFinish';
        }
      }
    }
    let projectEndOpensDay = order.some(taskId => {
      const task = this.tasks.get(taskId);
      const es = earlyDates.get(taskId)?.es;
      return !!task && es?.getTime() === projectEnd.getTime() && this.usesLastProjectDayStart(task, taskId, es);
    });
    if (this.options.schedulingOptions?.useProjectEndDateForFloat === true) {
      const configuredProjectEnd = parseInstant(dayEndInstant(blocksClock(this.projectCal), this.options.projectEndDate ?? '') ?? this.options.projectEndDate ?? '');
      if (!isNaN(configuredProjectEnd.getTime())) {
        projectEndOpensDay = false;
        projectEnd = this.snapOnOrBefore(this.projectEngine, configuredProjectEnd);
        if (this.backwardFloatTrace) this.backwardFloatTrace.projectEndSource = 'useProjectEndDateForFloat';
      }
    }

    const reversed = [...order].reverse();
    const preserveActualDates = this.dataDate !== null
      && this.options.schedulingOptions?.preserveActualDatesInBackwardPass === true;
    for (const taskId of reversed) {
      const task = this.tasks.get(taskId)!;
      const succs = this.successors.get(taskId) || [];
      const completedWindow = this.p6CompletedDataDateWindowDecision(task);
      const backwardActualPin = explainBackwardActualPinEligibility(
        task,
        this.dataDate,
        this.options.schedulingOptions,
      );
      this.recordBackwardFloatTrace(taskId, { completedWindow, backwardActualPin });

      const physicalPoint = this.completedPhysicalPoints.get(taskId);
      if (physicalPoint) {
        let latePoint: Date | null = null;
        const ownEng = this.calendarFor(task);
        for (const seq of succs) {
          const succResult = results.get(seq.successorId);
          const succTask = this.tasks.get(seq.successorId);
          if (!succResult || !succTask || succTask.isHammock) continue;
          const succCompleted = !!succTask.time.actualFinish && succTask.time.completion >= 1;
          if (succCompleted && !this.completedPhysicalPoints.has(succTask.id)
            && !explainP6CompletedLateRemainingWindowEligibilityResolved(
              succTask, this.dataDate, this.options.schedulingOptions,
            ).eligible) continue;
          const lagEng = this.relDeps.lagEngine(ownEng, this.calendarFor(succTask));
          const relSeq = this.completedRemainingLagSeq(seq, task, lagEng);
          const toStart = seq.type === 'FINISH_START' || seq.type === 'START_START';
          const bound = this.physicalPointLag(toStart ? succResult.ls : succResult.lf, relSeq, task, lagEng, -1);
          if (Number.isNaN(bound.getTime())) continue;
          if (latePoint === null || bound < latePoint) latePoint = bound;
        }
        const late = latePoint ?? new Date(projectEnd.getTime());
        this.recordBackwardFloatTrace(taskId, {
          lateFinishSource: latePoint === null ? 'projectEnd' : 'successorConstraint',
        });
        results.set(taskId, { ls: late, lf: new Date(late.getTime()) });
        continue;
      }

      if (backwardActualPin.eligible) {
        if (explainP6CompletedLateRemainingWindowEligibilityResolved(
          task, this.dataDate, this.options.schedulingOptions,
        ).eligible) {
          const progressCal = this.progressCalendarFor(task);
          const windowEs = this.snapOnOrAfter(progressCal, this.dataDate!);
          let candidateLs: Date | null = null;
          for (const seq of succs) {
            const succResult = results.get(seq.successorId);
            const succTask = this.tasks.get(seq.successorId);
            if (!succResult || !succTask) continue;
            if (succTask.isHammock) continue;
            const succCal = this.calendarFor(succTask);
            const succRawCompleted = !!succTask.time.actualFinish && succTask.time.completion >= 1;
            const succUsesRemainingWindow = explainP6CompletedLateRemainingWindowEligibilityResolved(
              succTask, this.dataDate, this.options.schedulingOptions,
            ).eligible;
            if (succRawCompleted && !succUsesRemainingWindow) continue;
            const hasPercentLag = typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent);
            const lagEng = this.relDeps.lagEngine(progressCal, succCal);
            const percentResolvedSeq: Sequence = !hasPercentLag
              ? seq
              : seq.lagUnit === 'ELAPSEDTIME'
                ? { ...seq, lagDays: resolveEffectiveLagDays(seq, task), lagPercent: undefined }
                : {
                  ...seq,
                  lagDays: resolveEffectiveLagDays(seq, task, lagEng.hoursPerDay),
                  lagMinutes: this.resolveLagMinutes(seq, task, lagEng),
                  lagPercent: undefined,
                };
            const effectiveSeq = succUsesRemainingWindow
              ? { ...seq, lagDays: 0, lagMinutes: 0, lagPercent: undefined }
              : this.completedRemainingLagSeq(percentResolvedSeq, task, lagEng);
            const delayShiftedSuccResult = {
              ls: this.shiftByLevelingDelay(succCal, succTask, succResult.ls, -1),
              lf: this.shiftByLevelingDelay(succCal, succTask, succResult.lf, -1),
            };
            const isStartSideRelation = seq.type === 'START_START' || seq.type === 'START_FINISH';
            const zeroRemainingPredTask: Task = isStartSideRelation
              ? {
                ...task,
                isMilestone: true,
                milestoneKind: undefined,
                time: { ...task.time, scheduleDuration: 0, durationMinutes: 0 },
              }
              : task;
            const constraintFinish = backwardConstraint(
              this.relDeps, delayShiftedSuccResult, effectiveSeq, zeroRemainingPredTask, succTask,
              progressCal, succCal, this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
            );
            const candidateLsFromSeq = isStartSideRelation
              ? constraintFinish
              : progressCal.nextWorkInstant(constraintFinish);
            if (candidateLs === null || candidateLsFromSeq < candidateLs) candidateLs = candidateLsFromSeq;
          }
          const ls = candidateLs === null || candidateLs < windowEs ? windowEs : candidateLs;
          const lf = progressCal.prevWorkInstant(ls);
          this.recordBackwardFloatTrace(taskId, {
            lateFinishSource: 'completedRemainingWindow',
            lateStartSource: 'completedRemainingWindow',
          });
          results.set(taskId, { ls, lf });
          continue;
        }
        const ed = earlyDates.get(taskId)!;
        this.recordBackwardFloatTrace(taskId, {
          lateStartSource: this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
            ? 'subRemainingDuration'
            : 'subDuration',
        });
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      if (task.isHammock) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      if (task.manuallyScheduled) {
        const ed = earlyDates.get(taskId)!;
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && this.options.schedulingOptions?.useProjectEndDateForFloat !== true
        && succs.length === 0
        && (this.predecessors.get(taskId)?.length ?? 0) > 0
        && task.milestoneKind === 'FINISH' && isZeroDurationMilestone(task)) {
        const ed = earlyDates.get(taskId)!;
        this.recordBackwardFloatTrace(taskId, { lateFinishSource: 'projectEnd', lateStartSource: 'subDuration' });
        results.set(taskId, { ls: new Date(ed.es.getTime()), lf: new Date(ed.ef.getTime()) });
        continue;
      }

      const predCal = this.calendarFor(task);
      let lateFinish = this.usesLastProjectDayStart(task, taskId, earlyDates.get(taskId)?.es)
        ? this.lastProjectDayStart(predCal, projectEnd, projectEndOpensDay) : projectEnd;
      let lateFinishSource: CpmLateFinishSource = 'projectEnd';
      let keepClockBoundary = false;
      for (const seq of succs) {
        const succResult = results.get(seq.successorId);
        const succTask = this.tasks.get(seq.successorId);
        if (!succResult || !succTask) continue;
        const succCompletedHistoric = preserveActualDates && !!succTask.time.actualFinish
          && succTask.time.completion >= 1;
        const succUsesRemainingWindow = explainP6CompletedLateRemainingWindowEligibilityResolved(
          succTask, this.dataDate, this.options.schedulingOptions,
        ).eligible;
        const succIsPhysicalPoint = this.completedPhysicalPoints.has(succTask.id);
        if (succCompletedHistoric && !succUsesRemainingWindow && !succIsPhysicalPoint) continue;
        if (this.progressOverrideIgnoresRelation(task, succTask)) continue;
        if (succTask.isHammock) continue;
        const succCal = this.calendarFor(succTask);
        const delayShiftedSuccResult = {
          ls: this.shiftByLevelingDelay(succCal, succTask, succResult.ls, -1),
          lf: this.shiftByLevelingDelay(succCal, succTask, succResult.lf, -1),
        };
        const lateLagEng = this.relDeps.lagEngine(predCal, succCal);
        if (this.options.schedulingOptions?.startToStartLagFrom === 'actualStart'
          && this.dataDate !== null && this.inProgressStartLag(task, seq, lateLagEng)) continue;
        const lateSeq = this.inProgressStartLagSeq(task, seq, lateLagEng);
        const remainingTask = seq.type === 'START_START'
          ? this.remainingDurationTaskForStartRelation(task, predCal) : task;
        const constraintDate = backwardConstraint(
          this.relDeps, delayShiftedSuccResult, lateSeq, remainingTask, succTask, predCal, succCal,
          this.p6ZeroDurationUsesFinishBoundary(succTask, succCal),
          this.finishFinishAtStartMilestoneLateFinish(seq, succTask, predCal, succCal),
        );
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
          lateFinishSource = 'successorConstraint';
          keepClockBoundary = keepsElapsedFsBoundary(this.relDeps, lateSeq, remainingTask, succTask);
        } else if (keepClockBoundary && constraintDate.getTime() === lateFinish.getTime()) {
          keepClockBoundary = keepsElapsedFsBoundary(this.relDeps, lateSeq, remainingTask, succTask);
        }
      }

      const successorBound = lateFinish;
      lateFinish = this.applyBackwardBound(task, lateFinish, predCal);
      if (!keepClockBoundary && lateFinishSource === 'successorConstraint' && lateFinish.getTime() === successorBound.getTime()) {
        lateFinish = this.lateFinishOnOwnCalendar(predCal, lateFinish);
      }
      if (this.p6ZeroDurationActivityUsesBoundaryPair(task, predCal)) {
        lateFinish = predCal.prevWorkInstant(lateFinish);
      }

      const useP6RemainingProgress = this.options.schedulingOptions?.p6UseRemainingStartForProgress === true
        && task.time.actualStart !== undefined && task.time.completion > 0 && task.time.completion < 1;

      const computedLateStart = useP6RemainingProgress
        ? this.subRemainingDuration(predCal, lateFinish, task)
        : this.subDuration(predCal, lateFinish, task, earlyDates.get(taskId)?.es ?? null);
      let lateStart = preserveActualDates && task.time.actualStart && task.time.completion < 1
          && this.options.schedulingOptions?.p6UseRemainingStartForProgress !== true
        ? new Date(earlyDates.get(taskId)!.es.getTime())
        : computedLateStart;
      if (this.options.schedulingOptions?.p6FinishMilestoneBoundaryWindow === true
        && isZeroDurationMilestone(task) && task.milestoneKind === 'FINISH') {
        const plannedStart = parseInstant(task.time.scheduleStart);
        const plannedFinish = parseInstant(task.time.scheduleFinish);
        if (plannedFinish < plannedStart && lateFinish.getTime() === plannedFinish.getTime()) {
          lateStart = plannedStart;
        }
      } else if (this.p6ZeroDurationActivityUsesBoundaryPair(task, predCal)) {
        lateStart = predCal.nextWorkInstant(lateFinish);
      }

      this.recordBackwardFloatTrace(taskId, {
        lateFinishSource,
        lateStartSource: useP6RemainingProgress ? 'subRemainingDuration' : 'subDuration',
      });
      results.set(taskId, { ls: lateStart, lf: lateFinish });
    }

    return results;
  }

}
