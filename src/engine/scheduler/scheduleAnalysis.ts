import type { Task, TaskConstraint } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import type { CpmBackwardFloatTrace, CpmFreeFloatSource, CPMResult, CPMTaskResult } from './CPMSolver';
import { formatInstant } from '@/utils/dateUtils';
import { drivingPredecessorWalker } from './graphWalk';
import { projectDurationOf } from './projectDuration';
import { isElapsedTask, isZeroDurationMilestone } from './duration';
import { deadlineBound } from './deadlineBound';
import { isLeafTask } from '@/utils/taskHierarchy';
import { explainP6CompletedDataDateWindowResolved } from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainDisplayActualLateEligibility,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
} from './p6CompletedRouteTrace';

export interface ScheduleAnalysisInput {
  order: string[];
  earlyDates: Map<string, { es: Date; ef: Date }>;
  lateDates: Map<string, { ls: Date; lf: Date }>;
  outOfSequenceSequenceIds: string[];
  tasks: Map<string, Task>;
  sequences: Sequence[];
  successors: Map<string, Sequence[]>;
  seqConstraint: Map<string, Date>;
  schedulingOptions: SchedulingOptions | undefined;
  dataDate: Date | null;
  truncatedLeadIds: string[];
  hardPinViolatedIds: string[];
  hammockNoFinishDriverIds: string[];
  projectEngine: CalendarEngine;
  calendarFor: (task: Task) => CalendarEngine;
  progressCalendarFor: (task: Task) => CalendarEngine;
  completedOutOfSequenceEs?: ReadonlyMap<string, Date>;
  completedPhysicalPoints?: ReadonlyMap<string, Date>;
  signedFloat: (a: Date, b: Date, eng: CalendarEngine, task?: Task) => number;
  signedFloatMinutes: (a: Date, b: Date, eng: CalendarEngine, task?: Task) => number;
  countsInWorkdays: (task: Task) => boolean;
  constraintInstant: (c: TaskConstraint | undefined, eng: CalendarEngine) => Date | null;
  snapOnOrAfter: (eng: CalendarEngine, d: Date) => Date;
  snapOnOrBefore: (eng: CalendarEngine, d: Date) => Date;
  milestoneLateMoment: (task: Task, c: TaskConstraint | undefined, eng: CalendarEngine) => Date | null;
  backwardFloatTrace?: CpmBackwardFloatTrace;
}

export function computeScheduleResults(input: ScheduleAnalysisInput): CPMResult {
  const {
    order, earlyDates, lateDates, outOfSequenceSequenceIds,
    tasks, sequences, successors, seqConstraint,
    schedulingOptions, dataDate,
    truncatedLeadIds, hardPinViolatedIds, hammockNoFinishDriverIds,
    projectEngine,
    calendarFor, progressCalendarFor, signedFloat, signedFloatMinutes, countsInWorkdays,
    constraintInstant, snapOnOrAfter, snapOnOrBefore, milestoneLateMoment,
    backwardFloatTrace, completedPhysicalPoints,
  } = input;

  const taskResults = new Map<string, CPMTaskResult>();
  const criticalPath: string[] = [];

  const sequenceFreeFloat: Record<string, number> = {};
  const sequenceFreeFloatMinutes: Record<string, number> = {};
  const drivingSequenceIds: string[] = [];
  const violatedConstraintTaskIds: string[] = [];
  const missedDeadlineTaskIds: string[] = [];
  const nearCriticalTaskIds: string[] = [];
  for (const seq of sequences) {
    const cRaw = seqConstraint.get(seq.id);
    const succEarly = earlyDates.get(seq.successorId);
    const succTask = tasks.get(seq.successorId);
    if (!cRaw || !succEarly || !succTask) continue;
    const succCal = calendarFor(succTask);
    const reqStart = snapOnOrAfter(succCal, cRaw);
    const predTask = tasks.get(seq.predecessorId);
    const relMinutes = succCal.workMinutesBetween(reqStart, succEarly.es);
    const relFloat = predTask && countsInWorkdays(predTask)
      ? succCal.measuredWorkdaysBetween(reqStart, succEarly.es)
      : relMinutes / (succCal.hoursPerDay * 60);
    sequenceFreeFloat[seq.id] = relFloat;
    sequenceFreeFloatMinutes[seq.id] = relMinutes;
    if (relFloat === 0) drivingSequenceIds.push(seq.id);
  }

  const so = schedulingOptions;
  const tfMode = so?.totalFloatMode;
  const makeOpenEndedCritical = so?.makeOpenEndedCritical === true;
  const nearCriticalThreshold = so?.nearCriticalThreshold;
  const critDef = so?.criticalDefinition;
  const critThreshold = critDef?.threshold ?? 0;
  const critThresholdHours = critDef?.thresholdHours;
  const useLongestPath = critDef?.mode === 'longestPath';
  const longestPathCritical = new Set<string>();
  const tasksWithPredecessor = new Set(sequences.map(sequence => sequence.successorId));
  let scheduleProjectEnd = new Date(0);
  for (const { ef } of earlyDates.values()) {
    if (ef > scheduleProjectEnd) scheduleProjectEnd = ef;
  }
  if (useLongestPath) {
    let maxEf = -Infinity;
    for (const { ef } of earlyDates.values()) {
      if (ef.getTime() > maxEf) maxEf = ef.getTime();
    }
    const drivingPredecessorsOf = drivingPredecessorWalker(sequences, new Set(drivingSequenceIds));
    for (const [id, { ef }] of earlyDates) {
      if (ef.getTime() !== maxEf) continue;
      if (tasks.get(id)?.isHammock === true) continue;
      longestPathCritical.add(id);
      for (const p of drivingPredecessorsOf(id)) {
        longestPathCritical.add(p);
      }
    }
  }

  let projectEnd = new Date(0);

  for (const taskId of order) {
    const early = earlyDates.get(taskId)!;
    const late = lateDates.get(taskId)!;
    const taskObj = tasks.get(taskId)!;
    const cal = calendarFor(taskObj);

    let freeFloat = Infinity;
    let freeFloatMinutes = Infinity;
    let freeFloatSource: CpmFreeFloatSource = 'derivedFromSuccessor';
    const succs = successors.get(taskId) || [];
    const inWorkdays = countsInWorkdays(taskObj);
    const ownCalendarSpan = (a: Date, b: Date): { days: number; minutes: number } => {
      const minutes = cal.workMinutesBetween(a, b);
      return { minutes, days: inWorkdays ? cal.measuredWorkdaysBetween(a, b) : minutes / (cal.hoursPerDay * 60) };
    };
    if (succs.length === 0) {
      freeFloat = signedFloat(early.ef, late.lf, cal, taskObj);
      freeFloatMinutes = signedFloatMinutes(early.ef, late.lf, cal, taskObj);
    } else {
      const ownCalendarFreeFloat = so?.p6FreeFloatOnOwnCalendar === true
        && cal.hasOwnWorkBlocks && taskObj.time.completion < 1;
      const lagOnOwnCalendar = so?.lagCalendar === undefined || so.lagCalendar === 'predecessor';
      const ownCalendarStarted = !!taskObj.time.actualStart || taskObj.time.completion > 0;
      for (const seq of succs) {
        let ff = sequenceFreeFloat[seq.id];
        let ffMinutes = sequenceFreeFloatMinutes[seq.id];
        if (ownCalendarFreeFloat && ff !== undefined && seq.lagPercent === undefined) {
          const lagMinutes = typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)
            ? seq.lagMinutes
            : (Number.isFinite(seq.lagDays) ? seq.lagDays : 0) * cal.hoursPerDay * 60;
          const succEarly = earlyDates.get(seq.successorId);
          const inScope = ownCalendarStarted
            ? seq.type === 'FINISH_START' && (seq.lagMinutes ?? 0) === 0 && seq.lagDays === 0
            : seq.type !== 'START_FINISH' && seq.lagUnit !== 'ELAPSEDTIME' && (lagMinutes === 0 || lagOnOwnCalendar);
          if (inScope && succEarly && tasks.has(seq.successorId)) {
            const fromStart = seq.type === 'START_START';
            const toFinish = seq.type === 'FINISH_FINISH';
            const anchor = fromStart ? early.es : early.ef;
            const bound = lagMinutes > 0 ? cal.addWorkMinutes(anchor, lagMinutes)
              : lagMinutes < 0 ? cal.subtractWorkMinutes(anchor, -lagMinutes) : anchor;
            ({ days: ff, minutes: ffMinutes } = ownCalendarSpan(bound, toFinish ? succEarly.ef : succEarly.es));
          }
        }
        if (so?.p6FinishNotBeforeFinishFinishBound === true && ff !== undefined && cal.hasOwnWorkBlocks
          && taskObj.time.completion < 1 && seq.type === 'FINISH_FINISH'
          && seq.lagPercent === undefined && (seq.lagMinutes ?? 0) === 0 && seq.lagDays === 0) {
          const succEarly = earlyDates.get(seq.successorId);
          if (succEarly) ({ days: ff, minutes: ffMinutes } = ownCalendarSpan(early.ef, succEarly.ef));
        }
        if (ff === undefined
          && seq.type === 'FINISH_START'
          && seq.lagPercent === undefined && (seq.lagMinutes ?? 0) === 0 && seq.lagDays === 0) {
          const point = completedPhysicalPoints?.get(seq.successorId);
          if (point) ({ days: ff, minutes: ffMinutes } = ownCalendarSpan(early.ef, point));
        }
        if (ff !== undefined && ff < freeFloat) freeFloat = ff;
        if (ff !== undefined && ffMinutes !== undefined && ffMinutes < freeFloatMinutes) freeFloatMinutes = ffMinutes;
      }
    }
    if (freeFloat === Infinity) freeFloat = 0;
    if (freeFloatMinutes === Infinity) freeFloatMinutes = 0;
    if (so?.p6FinishMilestoneBoundaryWindow === true
      && so.useProjectEndDateForFloat !== true && succs.length === 0
      && tasksWithPredecessor.has(taskId)
      && taskObj.milestoneKind === 'FINISH' && isZeroDurationMilestone(taskObj)) {
      freeFloat = signedFloat(early.ef, scheduleProjectEnd, cal, taskObj);
      freeFloatMinutes = signedFloatMinutes(early.ef, scheduleProjectEnd, cal, taskObj);
      freeFloatSource = 'projectEndFinishMilestoneBoundary';
    }
    if (so?.useProjectEndDateForFloat === true && succs.length === 0
      && tasksWithPredecessor.has(taskId)
      && taskObj.milestoneKind === 'FINISH' && isZeroDurationMilestone(taskObj)) {
      freeFloat = 0;
      freeFloatMinutes = 0;
      freeFloatSource = 'clampedZero';
    }

    const tt = taskObj.time;
    const completed = !!dataDate && tt.completion >= 1;
    const completedWindowDecision = explainP6CompletedDataDateWindowResolved(taskObj, dataDate, so);
    const completedDisplayWindow = completedWindowDecision.eligible
      ? (() => {
        const progressCal = progressCalendarFor(taskObj);
        const es = input.completedOutOfSequenceEs?.get(taskId) ?? snapOnOrAfter(progressCal, dataDate!);
        return {
          es,
          ef: progressCal.prevWorkInstant(es),
        };
      })()
      : null;
    const useCompletedRemainingWindow = explainP6CompletedLateRemainingWindowEligibilityResolved(
      taskObj, dataDate, so,
    ).eligible;
    const floatEarlyEs = useCompletedRemainingWindow ? completedDisplayWindow!.es : early.es;
    const floatEarlyEf = useCompletedRemainingWindow ? completedDisplayWindow!.ef : early.ef;
    const finishFloat = signedFloat(floatEarlyEf, late.lf, cal, taskObj);
    const startFloat = signedFloat(floatEarlyEs, late.ls, cal, taskObj);
    const finishFloatMinutes = signedFloatMinutes(floatEarlyEf, late.lf, cal, taskObj);
    const startFloatMinutes = signedFloatMinutes(floatEarlyEs, late.ls, cal, taskObj);
    const tfSide = tfMode === 'finish'
      ? 'finish'
      : tfMode === 'start'
        ? 'start'
        : tfMode === 'smallest'
          ? 'smallest'
          : (!!dataDate && (!!tt.actualStart || tt.completion > 0))
            ? 'finish'
            : 'smallest';
    let tf = tfSide === 'finish' ? finishFloat : tfSide === 'start' ? startFloat : Math.min(finishFloat, startFloat);
    let tfMinutes = tfSide === 'finish'
      ? finishFloatMinutes
      : tfSide === 'start' ? startFloatMinutes : Math.min(finishFloatMinutes, startFloatMinutes);
    if (makeOpenEndedCritical && succs.length === 0 && !completed) {
      tf = 0;
      freeFloat = 0;
      tfMinutes = 0;
      freeFloatMinutes = 0;
    }
    const isHammock = taskObj.isHammock === true;
    if (isHammock) {
      tf = 0;
      freeFloat = 0;
      tfMinutes = 0;
      freeFloatMinutes = 0;
    }
    if (taskObj.manuallyScheduled) {
      tf = 0;
      freeFloat = 0;
      tfMinutes = 0;
      freeFloatMinutes = 0;
    }
    if (completed && so?.preserveActualDatesInBackwardPass === true) {
      freeFloat = 0;
      freeFloatMinutes = 0;
      freeFloatSource = 'clampedZero';
    }
    if (so?.clampNegativeFreeFloat === true && freeFloat < 0) {
      freeFloat = 0;
      freeFloatSource = 'clampedZero';
    }
    if (so?.clampNegativeFreeFloat === true && freeFloatMinutes < 0) freeFloatMinutes = 0;
    const isCritical = isHammock
      ? false
      : completed
      ? false
      : useLongestPath
        ? longestPathCritical.has(taskId)
        : critThresholdHours !== undefined
          ? tfMinutes <= critThresholdHours * 60
          : tf <= critThreshold;

    if (isCritical) criticalPath.push(taskId);
    const interferingFloat = tf - freeFloat;
    const isNear = nearCriticalThreshold !== undefined && nearCriticalThreshold !== null
      ? tf > 0 && tf <= nearCriticalThreshold
      : undefined;
    if (isNear) nearCriticalTaskIds.push(taskId);
    if (early.ef > projectEnd) projectEnd = early.ef;

    const task = taskObj;
    {
      for (const cc of [task.constraint, task.constraint2]) {
        if (!cc) continue;
        if (cc.hard && (cc.type === 'MSO' || cc.type === 'MFO')) continue;
        const cd = constraintInstant(cc, cal);
        if (!cd) continue;
        const moment = milestoneLateMoment(task, cc, cal);
        const dW = moment ?? snapOnOrBefore(cal, cd);
        const dS = moment ?? (!isElapsedTask(task) && !isZeroDurationMilestone(task)
          ? snapOnOrAfter(cal, cd)
          : dW);
        const ct = cc.type;
        if (((ct === 'SNLT' || ct === 'MSO') && early.es > dS)
          || ((ct === 'FNLT' || ct === 'MFO') && early.ef > dW)) {
          if (!violatedConstraintTaskIds.includes(taskId)) violatedConstraintTaskIds.push(taskId);
        }
      }
      const dlW = deadlineBound(task.deadline, cal);
      if (dlW && early.ef > dlW) missedDeadlineTaskIds.push(taskId);
    }

    const displayActualLateDecision = explainDisplayActualLateEligibility(taskObj, dataDate, so);
    const displayActualLate = displayActualLateDecision.eligible;
    const pinLateToActualWindow = displayActualLate && !useCompletedRemainingWindow
      && input.completedPhysicalPoints?.has(taskId) !== true;
    if (backwardFloatTrace) {
      const prior = backwardFloatTrace.byTaskId[taskId] ?? {
        lateFinishSource: 'projectEnd' as const,
        lateStartSource: 'subDuration' as const,
        freeFloatSource: 'derivedFromSuccessor' as const,
        displayActualLate: false,
        completedWindow: completedWindowDecision,
        backwardActualPin: { eligible: false, reason: 'missingDataDate' } as const,
        displayActualLateDecision: { eligible: false, reason: 'missingDataDate' } as const,
      };
      backwardFloatTrace.byTaskId[taskId] = {
        ...prior,
        freeFloatSource,
        displayActualLate,
        displayActualLateDecision,
      };
    }
    taskResults.set(taskId, {
      earlyStart: formatInstant(completedDisplayWindow?.es ?? early.es, 'hour'),
      earlyFinish: formatInstant(completedDisplayWindow?.ef ?? early.ef, 'hour'),
      lateStart: formatInstant(pinLateToActualWindow ? early.es : late.ls, 'hour'),
      lateFinish: formatInstant(pinLateToActualWindow ? early.ef : late.lf, 'hour'),
      totalFloat: tf,
      freeFloat,
      totalFloatMinutes: tfMinutes,
      freeFloatMinutes,
      isCritical,
      interferingFloat,
      ...(isNear !== undefined ? { isNearCritical: isNear } : {}),
    });
  }

  for (const id of hardPinViolatedIds) {
    if (!violatedConstraintTaskIds.includes(id)) violatedConstraintTaskIds.push(id);
  }

  const hasSchedule = earlyDates.size > 0;

  let projStart: Date | null = null;
  for (const { es } of earlyDates.values()) {
    if (!projStart || es < projStart) projStart = es;
  }
  const projectDuration = projectDurationOf(projectEngine, projStart, projectEnd, tasks.values());

  let criticalPaths: string[][] = [criticalPath];
  const floatPathByTask: Record<string, number> = {};
  const fpOpt = so?.floatPaths;
  if (fpOpt?.enabled) {
    const maxPaths = Math.max(0, Math.floor(fpOpt.maxPaths));
    const isHammock = (id: string) => tasks.get(id)?.isHammock === true;
    const candidates = new Set<string>();
    for (const id of order) if (!isHammock(id)) candidates.add(id);

    if (fpOpt.method === 'TOTAL_FLOAT') {
      const tfOf = (id: string) => taskResults.get(id)!.totalFloat;
      const distinct = [...new Set([...candidates].map(tfOf))].sort((a, b) => a - b);
      const rankOf = new Map<number, number>();
      distinct.forEach((tf, i) => rankOf.set(tf, i + 1));
      for (const id of candidates) {
        const rank = rankOf.get(tfOf(id))!;
        if (rank <= maxPaths) floatPathByTask[id] = rank;
      }
    } else {
      const drivingSet = new Set(drivingSequenceIds);
      const drivingPredecessorsOf = drivingPredecessorWalker(sequences, drivingSet);
      const orderIndex = new Map<string, number>();
      order.forEach((id, i) => { if (!orderIndex.has(id)) orderIndex.set(id, i); });
      const indexInOrder = (id: string) => orderIndex.get(id) ?? -1;
      const efMs = (id: string) => earlyDates.get(id)!.ef.getTime();
      const peeled: { ids: string[]; critical: boolean }[] = [];
      let p = 0;
      while (candidates.size > 0 && p < maxPaths) {
        let end: string | null = null;
        let bestEf = -Infinity;
        for (const id of order) {
          if (!candidates.has(id)) continue;
          const e = efMs(id);
          if (e > bestEf) { bestEf = e; end = id; }
        }
        if (end === null) break;
        p += 1;
        const chain = new Set<string>([end]);
        for (const q of drivingPredecessorsOf(end)) {
          if (!isHammock(q)) chain.add(q);
        }
        for (const id of chain) {
          if (floatPathByTask[id] === undefined && candidates.has(id)) floatPathByTask[id] = p;
        }
        for (const id of chain) candidates.delete(id);
        const ids = [...chain].sort((a, b) => indexInOrder(a) - indexInOrder(b));
        const openIds = ids.filter(id => !dataDate || (tasks.get(id)?.time.completion ?? 0) < 1);
        peeled.push({ ids: openIds, critical: openIds.length > 0
          && openIds.every((id) => taskResults.get(id)?.isCritical === true) });
      }
      for (let i = 1; i < peeled.length; i++) {
        if (peeled[i].critical) criticalPaths.push(peeled[i].ids);
      }
    }

    for (const [id, r] of taskResults) {
      if (floatPathByTask[id] !== undefined) r.floatPath = floatPathByTask[id];
    }
  }

  return {
    tasks: taskResults,
    criticalPath,
    drivingSequenceIds,
    sequenceFreeFloat,
    truncatedLeadSequenceIds: [...truncatedLeadIds],
    violatedConstraintTaskIds,
    missedDeadlineTaskIds,
    outOfSequenceSequenceIds,
    nearCriticalTaskIds,
    criticalPaths,
    floatPathByTask,
    hammockNoFinishDriverTaskIds: [...hammockNoFinishDriverIds],
    projectEnd: hasSchedule ? formatInstant(projectEnd, 'hour') : '',
    projectDuration,
  };
}

export function countCriticalActivities(tasks: readonly Task[]): number {
  let n = 0;
  for (const t of tasks) if (t.time.isCritical && isLeafTask(t)) n++;
  return n;
}
