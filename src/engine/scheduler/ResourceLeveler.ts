import type { Task, TaskSplitGap } from '@/types/task';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import type { Sequence } from '@/types/sequence';
import { costResourceIds, contourSiblings, resourceIsLevelable, type Resource, type ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { LevelingQueue } from './levelingQueue';
import { resolveCalendar } from './resolveCalendar';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
import { applyCpmResult } from './applyCpmResult';
import { cloneTasksForSolve } from './solveProject';
import { hasLevelingOutput } from '@/utils/taskDefaults';
import {
  assignmentLoadOnPlacement, computeResourceLoad, contourLookup, dayslotLoad, maxUnitsOn, taskLoadPlacement, type DailyLoad,
} from './ResourceLoad';
import { hasManualPlacement, placementFollowsSpan, type PlacementResult } from './workPlacement';
import { createTaskEngineCache } from './taskEngineCache';
import { isPinnedComplete, isPinnedInProgress } from './duration';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import { parseDate, parseInstant, formatDate, formatInstant, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { maxOf } from '@/utils/collections';

export interface LevelingPoolLedger {
  poolItemOf(resourceId: string): string | null;
  residualOn(poolItemId: string, iso: string): number;
  book(poolItemId: string, iso: string, units: number): void;
  horizonIso: string | null;
}

export interface LevelingOptions {
  constrainToFloat: boolean;
  resourceIds?: string[];
  scopeTaskIds?: string[];
  preserveExistingLeveling?: boolean;
  overrunCeilingDays?: number;
  poolLedger?: LevelingPoolLedger;
  allowSplits?: boolean;
}

export type LevelingReason =
  | 'CALENDAR_MISMATCH' | 'INSUFFICIENT_CAPACITY' | 'INTRINSIC_OVERRUN'
  | 'CEILING_TOO_TIGHT'
  | 'CEILING_UNREACHABLE'
  | 'NO_WINDOW_IN_HORIZON'
  | 'RESIDUAL_FULL';

export interface LevelingShift {
  oldStart: string;
  newStart: string;
  delta: number;
}

export interface LevelingIntrinsicOverrun {
  resourceId: string;
  peak: number;
  capacity: number;
}

export interface LevelingResult {
  delays: Record<string, number>;
  delayMinutes?: Record<string, number>;
  unresolved: Record<string, string[]>;
  unresolvedReasons: Record<string, LevelingReason>;
  intrinsicOverruns?: Record<string, LevelingIntrinsicOverrun>;
  shifts: Record<string, LevelingShift>;
  projectEndBefore: string;
  projectEndAfter: string;
  gaps: Record<string, TaskSplitGap[]>;
}

const HARD_SCAN_CAP = 200_000;

export const LEVELER_TEST_HOOKS = { incremental: true };

export type LevelingInput = Parameters<typeof levelResources>;

export function levelResources(
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  cpmResult: CPMResult,
  options: LevelingOptions,
  cpmOptions: CPMOptions,
): LevelingResult {
  tasks = tasks.filter(isLeafTask);

  const renewable = resources.filter(resourceIsLevelable);
  const selectedResources = options.resourceIds
    ? renewable.filter(r => options.resourceIds!.includes(r.id))
    : renewable;
  const selectedIds = new Set(selectedResources.map(r => r.id));

  const resById = new Map(resources.map(r => [r.id, r]));
  const engineByRes = new Map<string, CalendarEngine>();
  for (const r of selectedResources) {
    engineByRes.set(r.id, new CalendarEngine(calendarForEngine(
      resolveCalendar(r.calendarId, resourceCalendars, projectCalendar),
    )));
  }

  const { forTask: engineForTask } = createTaskEngineCache(resourceCalendars, projectCalendar);

  const nextCandidateFor = (task: Task, d: Date): Date => {
    if (task.time.durationType === 'ELAPSEDTIME') return d;
    const eng = engineForTask(task);
    return eng.isHourMode ? eng.nextWorkInstant(d) : eng.nextWorkDay(parseDate(formatDate(d)));
  };
  const candidateAxis = (task: Task, pf: Date): { at: (k: number) => Date; minutes: (k: number) => number } => {
    const eng = engineForTask(task);
    const elapsed = task.time.durationType === 'ELAPSEDTIME';
    const first = nextCandidateFor(task, pf);
    const starts: Date[] = [first];
    const sums: number[] = [0];
    let skip = !elapsed && eng.isHourMode ? workdayDateOfInstant(eng, first, 'start') : null;
    const fill = (k: number): void => {
      while (starts.length <= k) {
        const prev = starts[starts.length - 1];
        if (elapsed) {
          starts.push(addCalendarDays(prev, 1));
          sums.push(sums[sums.length - 1] + 1440);
        } else if (skip === null) {
          starts.push(eng.nextWorkDayAfter(prev));
          sums.push(Number.NaN);
        } else {
          const day = eng.effectiveBandsOn(skip).reduce((acc, b) => acc + b.end - b.start, 0);
          skip = eng.nextWorkDayAfter(skip);
          sums.push(sums[sums.length - 1] + day);
          starts.push(eng.nextWorkInstant(eng.addWorkingMinutesSigned(prev, day)));
        }
      }
    };
    return {
      at: k => { fill(k); return starts[k]; },
      minutes: k => { fill(k); return sums[k]; },
    };
  };

  const capacityOf = (resId: string, iso: string): number => {
    const r = resById.get(resId);
    const eng = engineByRes.get(resId);
    if (!r || !eng) return 0;
    return eng.isWorkDay(parseDate(iso)) ? maxUnitsOn(r, iso) : 0;
  };
  const isResWorkDay = (resId: string, iso: string): boolean => {
    const eng = engineByRes.get(resId);
    return !!eng && eng.isWorkDay(parseDate(iso));
  };
  const maxCapacityOf = (resId: string): number => {
    const r = resById.get(resId);
    if (!r) return 0;
    let m = r.maxUnits;
    for (const s of r.availabilitySteps ?? []) m = Math.max(m, s.maxUnits);
    return m;
  };

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const leafSet = new Set(tasks.map(t => t.id));
  const creationIndex = new Map(tasks.map((t, i) => [t.id, i]));

  const scope = options.scopeTaskIds ? new Set(options.scopeTaskIds) : null;
  const inScope = (id: string): boolean => scope === null || scope.has(id);

  const ledger = options.poolLedger;

  const stripLevelingGaps = (gaps: TaskSplitGap[] | undefined): TaskSplitGap[] | undefined => {
    if (!gaps || gaps.length === 0) return gaps;
    const kept = gaps.filter(g => g.source !== 'leveling');
    return kept.length > 0 ? kept : undefined;
  };
  const workTasks: Task[] = tasks.map(t => inScope(t.id) && !options.preserveExistingLeveling
    ? {
        ...t,
        levelingDelay: undefined,
        levelingDelayMinutes: undefined,
        levelingDelayElapsed: undefined,
        splitGaps: stripLevelingGaps(t.splitGaps),
        time: { ...t.time },
      }
    : { ...t, time: { ...t.time } });
  const workById = new Map(workTasks.map(t => [t.id, t]));

  const statusFloorAnchors = cpmOptions.dataDate && !cpmOptions.schedulingOptions.unstartedIgnoresStatusDate
    ? new Map<string, Date>() : undefined;
  const placementSolver = () =>
    new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions, statusFloorAnchors);
  const baseline = placementSolver().solve();
  if (baseline.error) {
    const end = cpmResult.projectEnd;
    return {
      delays: {}, delayMinutes: {}, unresolved: {}, unresolvedReasons: {}, shifts: {},
      projectEndBefore: end, projectEndAfter: end, gaps: {},
    };
  }
  const baseEs = (id: string): string =>
    baseline.tasks.get(id)?.earlyStart ?? taskById.get(id)!.time.earlyStart;
  const baseLs = (id: string): string =>
    baseline.tasks.get(id)?.lateStart ?? taskById.get(id)!.time.lateStart;
  const baseLf = (id: string): string =>
    baseline.tasks.get(id)?.lateFinish ?? taskById.get(id)!.time.lateFinish;
  const baseFloat = (id: string): number =>
    baseline.tasks.get(id)?.totalFloat ?? taskById.get(id)!.time.totalFloat;

  const windowLimit = (id: string): Date | null => {
    const ls = parseInstant(baseLs(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? ls : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(ls, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(ls, ceilingDays);
    return options.constrainToFloat && ls < ceiling ? ls : ceiling;
  };

  const finishWindowLimit = (id: string): Date | null => {
    const lf = parseInstant(baseLf(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? lf : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(lf, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(lf, ceilingDays);
    return options.constrainToFloat && lf < ceiling ? lf : ceiling;
  };

  const isCompletedTask = (task: Task): boolean => isPinnedComplete(task.time);
  const isInProgressTask = (task: Task): boolean => isPinnedInProgress(task.time);
  const isImmovableTask = (task: Task): boolean => hasManualPlacement(task)
    || isCompletedTask(task) || isInProgressTask(task);

  const placementOptions = cpmOptions.schedulingOptions;
  const selectedAssignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!selectedIds.has(a.resourceId)) continue;
    const list = selectedAssignmentsByTask.get(a.taskId);
    if (list) list.push(a); else selectedAssignmentsByTask.set(a.taskId, [a]);
  }
  const contourOf = contourLookup(contourSiblings(assignments, costResourceIds(resources)));
  const spanView = (task: Task): Task => {
    if (!placementFollowsSpan(task)) return task;
    const base = baseline.tasks.get(task.id);
    if (!base) return task;
    return { ...task, time: { ...task.time, earlyStart: base.earlyStart, earlyFinish: base.earlyFinish } };
  };
  interface CandidateDemand {
    days: string[];
    byRes: Map<string, number[]>;
    placed: PlacementResult | null;
  }
  const computeDemand = (task: Task, startDate: Date): CandidateDemand => {
    const engine = engineForTask(task);
    const view = spanView(task);
    const byRes = new Map<string, number[]>();
    const list = selectedAssignmentsByTask.get(task.id) ?? [];
    const placed = taskLoadPlacement(view, engine, placementOptions, startDate);
    if (placed) {
      const days = placed.days.map(d => d.iso);
      for (const a of list) {
        const units = assignmentLoadOnPlacement(view, a, placed.days, engine, contourOf(view, a));
        const prev = byRes.get(a.resourceId);
        byRes.set(a.resourceId, prev ? units.map((u, i) => u + (prev[i] ?? 0)) : units);
      }
      return { days, byRes, placed };
    }
    const shift = diffCalendarDays(parseDate(view.time.earlyStart), parseDate(formatDate(startDate)));
    const shifted: Task = { ...view, time: {
      ...view.time, earlyStart: formatDate(startDate),
      earlyFinish: formatDate(addCalendarDays(parseDate(view.time.earlyFinish), shift)),
    } };
    let days: string[] = [];
    for (const a of list) {
      const slot = dayslotLoad(shifted, a, engine, contourOf(view, a));
      if (slot.isos.length > days.length) days = slot.isos;
      const prev = byRes.get(a.resourceId);
      byRes.set(a.resourceId, prev ? slot.units.map((u, i) => u + (prev[i] ?? 0)) : slot.units);
    }
    return { days, byRes, placed: null };
  };
  const demandCache = new Map<string, { startMs: number; demand: CandidateDemand }>();
  const demandAt = (task: Task, startDate: Date): CandidateDemand => {
    const startMs = startDate.getTime();
    if (isNaN(startMs)) return { days: [], byRes: new Map(), placed: null };
    const hit = demandCache.get(task.id);
    if (hit?.startMs === startMs) return hit.demand;
    const result = computeDemand(task, startDate);
    demandCache.set(task.id, { startMs, demand: result });
    return result;
  };
  const forgetDemand = (taskId: string): void => {
    demandCache.delete(taskId);
  };

  const demandTasks = new Set<string>();
  for (const [taskId] of selectedAssignmentsByTask) {
    const task = taskById.get(taskId);
    if (!task || task.isMilestone || isSummaryTask(task)) continue;
    if (task.time.scheduleDuration <= 0) continue;
    demandTasks.add(taskId);
  }

  const hasDemand = (id: string) => demandTasks.has(id);
  const movableIds: string[] = [];
  const pinnedIds: string[] = [];
  const fixedLoadIds: string[] = [];
  for (const t of tasks) {
    if (!hasDemand(t.id)) continue;
    if (!inScope(t.id) || options.preserveExistingLeveling) { fixedLoadIds.push(t.id); continue; }
    if (isImmovableTask(t)) { fixedLoadIds.push(t.id); continue; }
    if (t.priority === 1000) pinnedIds.push(t.id);
    else movableIds.push(t.id);
  }
  const pinnedSet = new Set(pinnedIds);

  const predsOf = new Map<string, string[]>();
  for (const t of tasks) predsOf.set(t.id, []);
  for (const seq of sequences) {
    if (leafSet.has(seq.predecessorId) && leafSet.has(seq.successorId)) {
      predsOf.get(seq.successorId)!.push(seq.predecessorId);
    }
  }

  const booked: Record<string, Record<string, number>> = {};
  const book = (resId: string, iso: string, amount: number) => {
    if (!booked[resId]) booked[resId] = {};
    booked[resId][iso] = (booked[resId][iso] ?? 0) + amount;
  };
  const bookedOn = (resId: string, iso: string) => booked[resId]?.[iso] ?? 0;

  let poolBlockedOnly = false;

  const placedStartIso = new Map<string, string>();
  const pinnedStartDate = new Map<string, Date>();
  const fixedPoolConflicts = new Map<string, string[]>();

  const bookDemandAt = (taskId: string, startDate: Date, toPoolLedger: boolean): string[] => {
    const task = workById.get(taskId)!;
    const { days: occ, byRes } = demandAt(task, startDate);
    for (const [resId, arr] of byRes) {
      const poolItem = ledger && toPoolLedger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        book(resId, occ[i], arr[i]);
        if (poolItem !== null) ledger!.book(poolItem, occ[i], arr[i]);
      }
    }
    return occ;
  };

  const totalWork = tasks.reduce((sum, t) => sum + (t.isMilestone ? 0 : Math.max(0, t.time.scheduleDuration)), 0);
  const scanLimit = Math.max(totalWork + 10, 30);

  const cmp = (a: string, b: string): number => {
    const ta = taskById.get(a)!, tb = taskById.get(b)!;
    if (tb.priority !== ta.priority) return tb.priority - ta.priority;
    const fa = baseFloat(a), fb = baseFloat(b);
    if (fa !== fb) return fa - fb;
    const ea = baseEs(a), eb = baseEs(b);
    if (ea !== eb) return ea < eb ? -1 : 1;
    return creationIndex.get(a)! - creationIndex.get(b)!;
  };
  const transitIds = tasks.filter(t => !options.preserveExistingLeveling && !hasDemand(t.id) && !isImmovableTask(t)
    && predsOf.get(t.id)!.length > 0).map(t => t.id);
  const active = new Set<string>([...pinnedIds, ...movableIds, ...transitIds]);
  const sortedActive = [...active].sort(cmp);

  const placed = new Set<string>();
  for (const t of tasks) if (!active.has(t.id)) placed.add(t.id);

  for (const id of fixedLoadIds) {
    const startIso = baseEs(id);
    const start = parseInstant(startIso);
    const demand = demandAt(workById.get(id)!, start);
    if (inScope(id)) fixedPoolConflicts.set(id, poolConflicts(demand.byRes, demand.days));
    bookDemandAt(id, start, true);
    forgetDemand(id);
    placedStartIso.set(id, startIso);
    pinnedStartDate.set(id, start);
  }

  const delays: Record<string, number> = {};
  const delayMinutes: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};
  const unresolvedReasons: Record<string, LevelingReason> = {};
  const intrinsicOverruns: Record<string, LevelingIntrinsicOverrun> = {};
  const gapsOut: Record<string, TaskSplitGap[]> = {};

  const allPredsPlaced = (id: string) => predsOf.get(id)!.every(p => placed.has(p));

  const rankOf = new Map(sortedActive.map((id, i) => [id, i]));
  const succsOf = new Map<string, string[]>();
  const pending = new Map<string, number>();
  for (const [succ, preds] of predsOf) {
    for (const pred of preds) (succsOf.get(pred) ?? succsOf.set(pred, []).get(pred)!).push(succ);
  }
  const readyHeap = new LevelingQueue();
  for (const id of sortedActive) {
    const count = predsOf.get(id)!.filter(p => !placed.has(p)).length;
    pending.set(id, count);
    if (count === 0) readyHeap.push(rankOf.get(id)!);
  }
  const markPlaced = (id: string) => {
    for (const succ of succsOf.get(id) ?? []) {
      const left = pending.get(succ);
      if (left === undefined) continue;
      pending.set(succ, left - 1);
      if (left - 1 === 0 && !placed.has(succ)) readyHeap.push(rankOf.get(succ)!);
    }
  };

  const globalDeps = workTasks.some(t => t.isHammock
    || t.constraint?.type === 'ALAP' || t.constraint2?.type === 'ALAP'
    || (t.time.completion >= 1 && !t.time.actualFinish));
  let forward: ReturnType<CPMSolver['createIncrementalForwardPass']> = null;
  let pfEarlyStart = new Map([...baseline.tasks].map(([id, r]) => [id, r.earlyStart]));
  let globallyStale = false;
  const markChanged = (id: string) => {
    if (forward) forward.markChanged(id);
    else globallyStale = true;
  };
  const pfFor = (id: string): Date => {
    if (!LEVELER_TEST_HOOKS.incremental) {
      const result = placementSolver().solve();
      return parseInstant(result.tasks.get(id)?.earlyStart ?? workById.get(id)!.time.earlyStart);
    }
    if (!forward && !globalDeps && globallyStale) {
      forward = placementSolver().createIncrementalForwardPass();
      if (forward) globallyStale = false;
    }
    if (forward) {
      return parseInstant(forward.earlyStart(id) ?? workById.get(id)!.time.earlyStart);
    }
    if (globallyStale) {
      pfEarlyStart = new Map([...placementSolver().solve().tasks].map(([taskId, r]) => [taskId, r.earlyStart]));
      globallyStale = false;
    }
    const es = pfEarlyStart.get(id);
    return parseInstant(es ?? workById.get(id)!.time.earlyStart);
  };

  let remaining = sortedActive.length;
  let safety = remaining + 1;
  while (remaining > 0 && safety-- > 0) {
    let pick: string | undefined;
    if (LEVELER_TEST_HOOKS.incremental) {
      for (let rank = readyHeap.pop(); rank !== undefined; rank = readyHeap.pop()) {
        const id = sortedActive[rank];
        if (!placed.has(id)) { pick = id; break; }
      }
    } else {
      pick = sortedActive.find(id => !placed.has(id) && allPredsPlaced(id));
    }
    if (!pick) break;

    if (!hasDemand(pick)) {
      placed.add(pick);
      markPlaced(pick);
      remaining--;
      continue;
    }

    const pf = pfFor(pick);
    const pickedTask = taskById.get(pick)!;

    let startDate: Date;
    let skipped = 0;
    let slotUnresolved: string[] = [];
    let slotReason: LevelingReason | undefined;
    if (pinnedSet.has(pick)) {
      startDate = nextCandidateFor(pickedTask, pf);
    } else {
      const limit = windowLimit(pick);
      const slot = findSlot(pick, pf, limit);
      startDate = slot.start;
      skipped = slot.skipped;
      slotUnresolved = slot.unresolved;
      slotReason = slot.reason;
      if (slot.scatterGaps) {
        workById.get(pick)!.splitGaps = slot.scatterGaps;
        gapsOut[pick] = slot.scatterGaps;
        markChanged(pick);
        forgetDemand(pick);
      }
    }

    if (pinnedSet.has(pick)) {
      const demand = demandAt(workById.get(pick)!, startDate);
      fixedPoolConflicts.set(pick, poolConflicts(demand.byRes, demand.days));
    }
    bookDemandAt(pick, startDate, slotUnresolved.length === 0);
    placedStartIso.set(pick, formatInstant(startDate, 'hour'));
    if (pinnedSet.has(pick)) pinnedStartDate.set(pick, startDate);
    const pickEngine = engineForTask(pickedTask);
    let delay = 0;
    let delayMin: number | undefined;
    if (pickedTask.time.durationType === 'ELAPSEDTIME') {
      delay = diffCalendarDays(pf, startDate);
      delayMin = delay > 0 ? Math.round((startDate.getTime() - pf.getTime()) / 60_000) : undefined;
    } else if (pickEngine.isHourMode) {
      if (skipped > 0) {
        delay = skipped;
        delayMin = Math.round(candidateAxis(pickedTask, pf).minutes(skipped));
      }
    } else {
      delay = pickEngine.workDaysBetween(parseDate(formatDate(pf)), parseDate(formatDate(startDate))) - 1;
    }
    if (delay > 0) {
      const beforeFloor = statusFloorAnchors?.get(pick);
      if (beforeFloor) {
        if (pickedTask.time.durationType === 'ELAPSEDTIME') {
          delay = diffCalendarDays(beforeFloor, startDate);
          delayMin = Math.round((startDate.getTime() - beforeFloor.getTime()) / 60_000);
        } else {
          const anchor = nextCandidateFor(pickedTask, beforeFloor);
          const anchorDay = workdayDateOfInstant(pickEngine, anchor, 'start');
          const targetDay = workdayDateOfInstant(pickEngine, startDate, 'start');
          delay = Math.max(delay, pickEngine.signedWorkDaysBetween(anchorDay, targetDay));
          if (pickEngine.isHourMode) delayMin = Math.round(pickEngine.workMinutesBetween(anchor, startDate));
        }
      }
      delays[pick] = delay;
      if (delayMin !== undefined && delayMin > 0) delayMinutes[pick] = delayMin;
    }
    if (slotUnresolved.length > 0) {
      unresolved[pick] = slotUnresolved;
      if (slotReason) unresolvedReasons[pick] = slotReason;
      if (slotReason === 'INTRINSIC_OVERRUN') {
        const detail = intrinsicOverrunFor(demandAt(workById.get(pick)!, startDate).byRes);
        if (detail) intrinsicOverruns[pick] = detail;
      }
    }
    const newDelay = delay > 0 ? delay : undefined;
    const newDelayMinutes = delay > 0 ? delayMinutes[pick] : undefined;
    const work = workById.get(pick)!;
    if (work.levelingDelay !== newDelay) markChanged(pick);
    work.levelingDelay = newDelay;
    work.levelingDelayMinutes = newDelayMinutes;
    if (!pinnedSet.has(pick)) forgetDemand(pick);

    placed.add(pick);
    markPlaced(pick);
    remaining--;
  }

  for (const taskId of [...pinnedIds, ...fixedLoadIds.filter(inScope)]) {
    const start = pinnedStartDate.get(taskId);
    if (!start) continue;
    const task = workById.get(taskId)!;
    const { days: occ, byRes } = demandAt(task, start);
    const days = new Set(fixedPoolConflicts.get(taskId) ?? []);
    if (pinnedSet.has(taskId) || hasManualPlacement(task) || options.preserveExistingLeveling) {
      for (const [resId, demand] of byRes) {
        for (let i = 0; i < demand.length && i < occ.length; i++) {
          if (demand[i] > 0 && exceedsCapacity(bookedOn(resId, occ[i]), capacityOf(resId, occ[i]))) {
            days.add(occ[i]);
          }
        }
      }
    }
    if (days.size > 0) unresolved[taskId] = [...days].sort();
  }

  demandCache.clear();

  const trial = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).solve();
  const projectEndAfter = trial.error ? cpmResult.projectEnd : trial.projectEnd;

  const resourcesWithFixedAssignments = new Set<string>();
  if (scope && !options.preserveExistingLeveling) {
    for (const assignment of assignments) {
      const task = taskById.get(assignment.taskId);
      if (task && !inScope(task.id) && selectedIds.has(assignment.resourceId)
        && !task.isMilestone && !isSummaryTask(task)) resourcesWithFixedAssignments.add(assignment.resourceId);
    }
  }
  if (!trial.error && resourcesWithFixedAssignments.size > 0
    && (Object.keys(delays).length > 0 || Object.keys(gapsOut).length > 0
      || tasks.some(task => inScope(task.id) && hasLevelingOutput(task)))) {
    const beforeTasks = cloneTasksForSolve(tasks);
    const before = new CPMSolver(beforeTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).solve();
    if (!before.error) {
      const calendars = { projectCalendar, calendars: resourceCalendars };
      applyCpmResult(beforeTasks, before, calendars);
      applyCpmResult(workTasks, trial, calendars);
      const loadChanges = new Map<string, Map<string, DailyLoad>>();
      const trackChange = (sign: -1 | 1) =>
        (assignment: ResourceAssignment, { isos, units }: { isos: readonly string[]; units: readonly number[] }) => {
          if (!resourcesWithFixedAssignments.has(assignment.resourceId)) return;
          const byResource = loadChanges.get(assignment.taskId) ?? new Map<string, DailyLoad>();
          loadChanges.set(assignment.taskId, byResource);
          const change = byResource.get(assignment.resourceId) ?? {};
          byResource.set(assignment.resourceId, change);
          for (let i = 0; i < units.length && i < isos.length; i++) {
            const day = isos[i];
            change[day] = (change[day] ?? 0) + sign * units[i];
          }
        };
      const beforeLoad = computeResourceLoad(
        resources, assignments, beforeTasks, projectCalendar, resourceCalendars, placementOptions, trackChange(-1),
      );
      const afterLoad = computeResourceLoad(
        resources, assignments, workTasks, projectCalendar, resourceCalendars, placementOptions, trackChange(1),
      );
      for (const [taskId, byResource] of loadChanges) {
        const worsenedDays = new Set(unresolved[taskId]);
        for (const [resourceId, change] of byResource) {
          for (const [day, units] of Object.entries(change)) {
            const limit = Math.max(beforeLoad.load[resourceId]?.[day] ?? 0, afterLoad.capacity[resourceId]?.[day] ?? 0);
            if (exceedsCapacity(units, 0) && exceedsCapacity(afterLoad.load[resourceId]?.[day] ?? 0, limit)) {
              worsenedDays.add(day);
            }
          }
        }
        if (worsenedDays.size > 0) unresolved[taskId] = [...worsenedDays].sort();
      }
    }
  }

  const shifts: Record<string, LevelingShift> = {};
  for (const t of tasks) {
    const cur = t.time.earlyStart;
    const tr = trial.tasks.get(t.id)?.earlyStart;
    if (!cur || !tr || cur === tr) continue;
    const from = parseDate(cur), to = parseDate(tr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) continue;
    const eng = engineForTask(t);
    const delta = t.time.durationType === 'ELAPSEDTIME'
      ? diffCalendarDays(from, to)
      : eng.signedWorkDaysBetween(from, to);
    if (delta === 0) continue;
    shifts[t.id] = { oldStart: cur, newStart: tr, delta };
  }

  return {
    delays,
    delayMinutes,
    unresolved,
    unresolvedReasons,
    ...(Object.keys(intrinsicOverruns).length > 0 ? { intrinsicOverruns } : {}),
    shifts,
    projectEndBefore: cpmResult.projectEnd,
    projectEndAfter,
    gaps: gapsOut,
  };

  function findSlot(
    taskId: string,
    pf: Date,
    limit: Date | null,
  ): { start: Date; skipped: number; unresolved: string[]; reason?: LevelingReason; scatterGaps?: TaskSplitGap[] } {
    const task = workById.get(taskId)!;

    poolBlockedOnly = ledger !== undefined;

    const axis = candidateAxis(task, pf);
    let k = 0;
    let cand = axis.at(0);

    const ceilingSet = options.overrunCeilingDays !== undefined;
    const ceilingUnreachable = ceilingSet && limit !== null && cand > limit;

    let calendarFeasibleSeen = false;
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    let guard = 0;
    let horizonExhausted = false;
    while (guard++ < HARD_SCAN_CAP) {
      const { days: occ, byRes } = demandAt(task, cand);
      if (!calendarFeasibleSeen && calendarOk(byRes, occ)) calendarFeasibleSeen = true;
      if (occ.length > 0 && fits(byRes, occ)) return { start: cand, skipped: k, unresolved: [] };
      const next = axis.at(k + 1);
      if (limit && next > limit) break;
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
      k++;
    }
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true;

    if (splitEligible(task) && engineForTask(task).isHourMode) {
      const scatter = scatterSlot(task, axis, finishWindowLimit(taskId));
      if (scatter.gaps && scatter.start) {
        return { start: scatter.start, skipped: scatter.skipped, unresolved: [], scatterGaps: scatter.gaps };
      }
      if (scatter.horizonExhausted) horizonExhausted = true;
    }

    const snappedPf = axis.at(0);
    const { days: occ, byRes } = demandAt(task, snappedPf);
    const conflicts: string[] = [];
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue;
        if (exceedsCapacity(bookedOn(resId, occ[i]) + arr[i], capacityOf(resId, occ[i]))) conflicts.push(occ[i]);
      }
    }
    conflicts.push(...poolConflicts(byRes, occ));
    return {
      start: snappedPf,
      skipped: 0,
      unresolved: [...new Set(conflicts)].sort(),
      reason: reasonFor(byRes, calendarFeasibleSeen, ceilingSet, ceilingUnreachable, horizonExhausted),
    };
  }

  function intrinsicOverrunFor(byRes: Map<string, number[]>): LevelingIntrinsicOverrun | undefined {
    for (const [resourceId, arr] of byRes) {
      const peak = arr.length > 0 ? maxOf(arr) : 0;
      const capacity = maxCapacityOf(resourceId);
      if (exceedsCapacity(peak, capacity)) return { resourceId, peak, capacity };
    }
    return undefined;
  }

  function reasonFor(
    byRes: Map<string, number[]>,
    calendarFeasibleSeen: boolean,
    ceilingSet: boolean,
    ceilingUnreachable: boolean,
    horizonExhausted: boolean,
  ): LevelingReason {
    if (intrinsicOverrunFor(byRes)) return 'INTRINSIC_OVERRUN';
    if (ceilingUnreachable) return 'CEILING_UNREACHABLE';
    if (!calendarFeasibleSeen) return 'CALENDAR_MISMATCH';
    if (poolBlockedOnly) return 'RESIDUAL_FULL';
    if (ceilingSet) return 'CEILING_TOO_TIGHT';
    if (horizonExhausted) return 'NO_WINDOW_IN_HORIZON';
    return 'INSUFFICIENT_CAPACITY';
  }

  function calendarOk(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] <= 0) continue;
        if (i >= occ.length) return false;
        if (!isResWorkDay(resId, occ[i])) return false;
      }
    }
    return true;
  }

  function fits(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue;
        if (exceedsCapacity(bookedOn(resId, occ[i]) + arr[i], capacityOf(resId, occ[i]))) { poolBlockedOnly = false; return false; }
      }
    }
    return !ledger || poolConflicts(byRes, occ).length === 0;
  }

  function demandByPool(byRes: Map<string, number[]>): Map<string, number[]> {
    const byPool = new Map<string, number[]>();
    if (!ledger) return byPool;
    for (const [resId, demand] of byRes) {
      const poolId = ledger.poolItemOf(resId);
      if (poolId === null) continue;
      const total = byPool.get(poolId) ?? [];
      for (let i = 0; i < demand.length; i++) total[i] = (total[i] ?? 0) + demand[i];
      byPool.set(poolId, total);
    }
    return byPool;
  }

  function poolConflicts(byRes: Map<string, number[]>, days: string[]): string[] {
    if (!ledger) return [];
    const conflicts = new Set<string>();
    for (const [poolId, demand] of demandByPool(byRes)) {
      for (let i = 0; i < demand.length && i < days.length; i++) {
        if (demand[i] > 0 && exceedsCapacity(demand[i], ledger!.residualOn(poolId, days[i]))) conflicts.add(days[i]);
      }
    }
    return [...conflicts];
  }

  function hasOwnGaps(task: Task): boolean {
    return (task.splitGaps ?? []).some(g => g.source === 'user');
  }

  function splitEligible(task: Task): boolean {
    return options.allowSplits === true
      && task.time.durationType === 'WORKTIME'
      && task.time.completion === 0
      && !hasOwnGaps(task);
  }

  function dayFits(byRes: Map<string, number[]>, byPool: Map<string, number[]>, i: number, iso: string): boolean {
    for (const [resId, arr] of byRes) {
      if (i >= arr.length) continue;
      const amt = arr[i];
      if (amt <= 0) continue;
      if (exceedsCapacity(bookedOn(resId, iso) + amt, capacityOf(resId, iso))) return false;
    }
    if (!ledger) return true;
    for (const [poolId, demand] of byPool) {
      const amount = demand[i] ?? 0;
      if (amount > 0 && exceedsCapacity(amount, ledger!.residualOn(poolId, iso))) return false;
    }
    return true;
  }

  function scatterSlot(
    task: Task, candidates: ReturnType<typeof candidateAxis>, finishLimit: Date | null,
  ): { gaps: TaskSplitGap[] | null; start?: Date; skipped: number; horizonExhausted: boolean } {
    let skipped = 0;
    let start = candidates.at(0);
    let gaps: TaskSplitGap[] = [...(task.splitGaps ?? [])];
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    for (let scan = 0; scan < HARD_SCAN_CAP; scan++) {
      const candidate = computeDemand({ ...task, splitGaps: gaps.length > 0 ? gaps : undefined }, start);
      const placedCandidate = candidate.placed;
      if (!placedCandidate || candidate.days.length === 0) return { gaps: null, skipped, horizonExhausted: false };
      const byPool = demandByPool(candidate.byRes);
      const index = candidate.days.findIndex((iso, i) => !dayFits(candidate.byRes, byPool, i, iso));
      if (index < 0) {
        if (finishLimit && placedCandidate.finish > finishLimit) return { gaps: null, skipped, horizonExhausted: false };
        return { gaps, start, skipped, horizonExhausted: false };
      }
      const day = placedCandidate.days[index];
      if (finishLimit && parseDate(day.iso) > finishLimit) return { gaps: null, skipped, horizonExhausted: false };
      const axis = day.ranges[0].afterMinutes;
      if (axis === 0) {
        start = candidates.at(++skipped);
      } else {
        const pause = day.dayAxisMinutes;
        const before = gaps.find(g => g.source === 'leveling' && g.afterMinutes + g.gapMinutes === axis);
        gaps = gaps.map(g => g.afterMinutes >= axis ? { ...g, afterMinutes: g.afterMinutes + pause }
          : g === before ? { ...g, gapMinutes: g.gapMinutes + pause } : g);
        if (!before) gaps.push({ afterMinutes: axis, gapMinutes: pause, source: 'leveling' });
        gaps.sort((a, b) => a.afterMinutes - b.afterMinutes);
      }
      if (scan + 1 >= scanLimit && !(horizonDate && parseDate(day.iso) <= horizonDate)) {
        return { gaps: null, skipped, horizonExhausted: true };
      }
    }
    return { gaps: null, skipped, horizonExhausted: true };
  }
}
