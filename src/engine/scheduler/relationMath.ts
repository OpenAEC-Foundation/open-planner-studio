import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import { elapsedMilliseconds, isElapsedTask, isZeroDurationMilestone } from './duration';

export const MS_PER_MIN = 60_000;

export interface RelationBoundaryFlags {
  predEndsBeginOfDay: boolean;
  predStartsNextDay: boolean;
  succIsFinishMs: boolean;
  succIsStartMs: boolean;
}

export function relationBoundaryFlags(
  predTask: Task,
  succTask: Task,
  p6ZeroDurationSuccessorAtFinish = false,
): RelationBoundaryFlags {
  const predIsMilestone = predTask.time.scheduleDuration <= 0;
  const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
  const p6FinishBoundary = p6ZeroDurationSuccessorAtFinish && isZeroDurationMilestone(succTask);
  return {
    predEndsBeginOfDay: predIsMilestone && predKind !== 'FINISH',
    predStartsNextDay: predIsMilestone && predKind === 'FINISH',
    succIsFinishMs: p6FinishBoundary
      || (succTask.isMilestone && succTask.milestoneKind === 'FINISH'),
    succIsStartMs: !p6FinishBoundary
      && succTask.isMilestone && succTask.milestoneKind === 'START',
  };
}

export function calendarsAgreeOnSharedWorkdayBands(
  a: CalendarEngine, b: CalendarEngine, onDate: Date,
): boolean {
  const sortedBands = (
    bands: ReadonlyArray<Readonly<{ start: number; end: number }>>,
  ): ReadonlyArray<Readonly<{ start: number; end: number }>> => [...bands].sort((x, y) => x.start - y.start);
  const aBands = sortedBands(a.effectiveBandsOn(onDate));
  const bBands = sortedBands(b.effectiveBandsOn(onDate));
  if (aBands.length === 0 && bBands.length === 0) return true;
  if (aBands.length === 0 || bBands.length === 0) return false;
  if (aBands.length !== bBands.length) return false;
  for (let i = 0; i < aBands.length; i++) {
    if (aBands[i].start !== bBands[i].start || aBands[i].end !== bBands[i].end) return false;
  }
  return true;
}

export interface RelationDeps {
  lagEngine(predEng: CalendarEngine, succEng: CalendarEngine): CalendarEngine;
  resolveEffectiveLagDays(seq: Sequence, predTask: Task, predEng: CalendarEngine): number;
  resolveElapsedMinutes(seq: Sequence, predTask: Task): number;
  shiftLagPred(predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1): Date;
  startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date;
  finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date;
  snapOnOrAfter(eng: CalendarEngine, d: Date): Date;
  snapOnOrBefore(eng: CalendarEngine, d: Date): Date;
  snapStrictAfter(eng: CalendarEngine, d: Date): Date;
  snapStrictBefore(eng: CalendarEngine, d: Date): Date;
  countsInWorkdays(task: Task): boolean;
}

export function forwardConstraint(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
  finishFinishAtStartMilestoneLateFinish = false,
): Date {
  const boundaryFlags = relationBoundaryFlags(predTask, successor, p6ZeroDurationSuccessorAtFinish);
  const flags = finishFinishAtStartMilestoneLateFinish && seq.type === 'FINISH_FINISH'
    ? { ...boundaryFlags, succIsStartMs: false }
    : boundaryFlags;
  return forwardHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

export function forwardFinishFloor(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
): Date | null {
  if (seq.type !== 'START_FINISH') return null;
  const flags = relationBoundaryFlags(predTask, successor, p6ZeroDurationSuccessorAtFinish);
  return sfReqFinishHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

export function backwardConstraint(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  succTask: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
  finishFinishAtStartMilestoneLateFinish = false,
): Date {
  const boundaryFlags = relationBoundaryFlags(predTask, succTask, p6ZeroDurationSuccessorAtFinish);
  const flags = finishFinishAtStartMilestoneLateFinish && seq.type === 'FINISH_FINISH'
    ? { ...boundaryFlags, succIsStartMs: false }
    : boundaryFlags;
  return backwardHour(deps, succResult, seq, predTask, predEng, succEng, flags);
}

function isInsideBlock(eng: CalendarEngine, d: Date): boolean {
  const t = d.getTime();
  return eng.prevWorkInstant(d).getTime() === t && eng.nextWorkInstant(d).getTime() === t;
}

function isDayTaskOnBands(deps: RelationDeps, task: Task): boolean {
  return !isZeroDurationMilestone(task) && !isElapsedTask(task) && deps.countsInWorkdays(task);
}

export function previousBlockEndIfSame(
  deps: RelationDeps,
  lagEng: CalendarEngine,
  readerEng: CalendarEngine,
  moment: Date,
  floor?: Date,
): Date {
  const back = deps.snapOnOrBefore(lagEng, moment);
  if (back.getTime() === moment.getTime()) return moment;
  if (floor && moment.getTime() >= floor.getTime() && back.getTime() < floor.getTime()) return moment;
  if (readerEng.prevWorkInstant(back).getTime() !== back.getTime()) return moment;
  if (readerEng.workMinutesBetween(back, moment) !== 0) return moment;
  return back;
}

function workdayFinishNotBefore(se: CalendarEngine, reqFinish: Date, rawRequired: Date): Date {
  if (se.prevWorkInstant(reqFinish).getTime() >= rawRequired.getTime()) return reqFinish;
  return se.measuredWorkdayEnd(se.nextWorkInstant(reqFinish));
}

export function dayTaskRequiredFinish(
  deps: RelationDeps, lagEng: CalendarEngine, se: CalendarEngine, lagged: Date, floor: Date,
): Date {
  const reqFinish = previousBlockEndIfSame(deps, lagEng, se, lagged, floor);
  return workdayFinishNotBefore(se, reqFinish, lagEng.prevWorkInstant(lagged));
}

export function finishFinishRequirement(
  deps: RelationDeps, anchor: Date, predTask: Task, seq: Sequence, successor: Task,
  lagEng: CalendarEngine, se: CalendarEngine, flags: RelationBoundaryFlags,
): { finish: Date; raw: Date } {
  const succElapsed = isElapsedTask(successor);
  const dayTask = isDayTaskOnBands(deps, successor);
  if (seq.lagUnit === 'ELAPSEDTIME') {
    const raw = new Date(anchor.getTime() + elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask)));
    const keepRaw = succElapsed || (dayTask && deps.snapOnOrBefore(se, raw).getTime() === raw.getTime());
    return { finish: keepRaw ? raw : deps.snapOnOrAfter(se, raw), raw };
  }
  const lagged = deps.shiftLagPred(lagEng, anchor, seq, predTask, 1);
  const zeroLag = lagged.getTime() === deps.snapOnOrAfter(lagEng, anchor).getTime();
  const raw = zeroLag ? anchor : lagEng.prevWorkInstant(lagged);
  const isFinishMs = flags.succIsFinishMs || (isZeroDurationMilestone(successor) && !successor.milestoneKind);
  if (zeroLag && (isFinishMs || (flags.succIsStartMs && isDayTaskOnBands(deps, predTask)) || succElapsed)) {
    return { finish: anchor, raw };
  }
  return {
    finish: !flags.predEndsBeginOfDay && dayTask ? previousBlockEndIfSame(deps, lagEng, se, lagged, anchor) : lagged,
    raw,
  };
}

function forwardHour(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predEndsBeginOfDay, predStartsNextDay, succIsStartMs } = flags;
  const succIsFinishMs = flags.succIsFinishMs || (isZeroDurationMilestone(successor)
    && !successor.milestoneKind && (seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH'));
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  const succElapsed = isElapsedTask(successor);

  switch (seq.type) {
    case 'START_START': {
      const base = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      if (elapsed) {
        const raw = new Date(base.getTime() + elapsedMin());
        return succElapsed ? raw : deps.snapOnOrAfter(se, raw);
      }
      if (succElapsed && deps.resolveEffectiveLagDays(seq, predTask, lagEng) === 0) return base;
      const lagged = deps.shiftLagPred(lagEng, base, seq, predTask, 1);
      return succElapsed ? lagged : deps.snapOnOrAfter(se, lagged);
    }
    case 'FINISH_FINISH': {
      const { finish, raw } = finishFinishRequirement(deps, predResult.ef, predTask, seq, successor, lagEng, se, flags);
      const reqFinish = isDayTaskOnBands(deps, successor) ? workdayFinishNotBefore(se, finish, raw) : finish;
      if (succIsStartMs && !predEndsBeginOfDay) {
        if (!elapsed && isDayTaskOnBands(deps, predTask) && isInsideBlock(se, reqFinish)) return reqFinish;
        return deps.snapStrictAfter(se, reqFinish);
      }
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      const reqFinish = sfReqFinishHour(deps, predResult, predTask, seq, successor, pe, se, flags);
      const durationFinish = isDayTaskOnBands(deps, successor) ? se.prevWorkInstant(reqFinish) : reqFinish;
      return deps.startFromFinish(se, durationFinish, successor);
    }
    case 'FINISH_START':
    default: {
      if (elapsed) {
        const target = new Date(predResult.ef.getTime() + elapsedMin());
        if (succIsFinishMs && elapsedMin() === 0) return target;
        if (succIsFinishMs) {
          const back = deps.snapOnOrBefore(se, target);
          if (back.getTime() === target.getTime()) return back;
        }
        return se.nextWorkInstant(target);
      }
      if (seq.p6StartAtPredecessorFinishBoundary) return predResult.ef;
      const predDone = predResult.ef;
      const lagged = deps.shiftLagPred(lagEng, predDone, seq, predTask, 1);
      const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, predDone).getTime();
      if (!succIsFinishMs && !predEndsBeginOfDay && !succIsStartMs && !succElapsed
        && lagIsZero
        && calendarsAgreeOnSharedWorkdayBands(pe, se, predDone)) {
        return se.nextWorkInstant(predDone);
      }
      if (succIsFinishMs && lagIsZero) return predDone;
      return finishStartLaggedStart(deps, lagEng, se, lagged, succIsFinishMs);
    }
  }
}

export function finishStartLaggedStart(
  deps: RelationDeps, lagEng: CalendarEngine, se: CalendarEngine, lagged: Date, succIsFinishMs: boolean,
): Date {
  if (succIsFinishMs) {
    const back = deps.snapOnOrBefore(se, lagged);
    if (back.getTime() === lagged.getTime()
      || (se.nextWorkInstant(back).getTime() === lagged.getTime()
        && lagEng.workMinutesBetween(back, lagged) === 0)) return back;
  }
  return se.nextWorkInstant(lagged);
}

function sfReqFinishHour(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predStartsNextDay, succIsFinishMs } = flags;
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  const succElapsed = isElapsedTask(successor);

  const daySuccessor = isDayTaskOnBands(deps, successor);
  const startMoment = predStartsNextDay && !daySuccessor ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
  if (elapsed) {
    return succElapsed
      ? new Date(startMoment.getTime() + elapsedMin())
      : deps.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()));
  }
  const lagged = deps.shiftLagPred(lagEng, startMoment, seq, predTask, 1);
  if ((succIsFinishMs || succElapsed || daySuccessor)
    && lagged.getTime() === deps.snapOnOrAfter(lagEng, startMoment).getTime()) {
    return startMoment;
  }
  return lagged;
}

function backwardHour(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  const predElapsed = isElapsedTask(predTask);

  switch (seq.type) {
    case 'START_START': {
      const shifted = elapsed
        ? new Date(succResult.ls.getTime() - elapsedMin())
        : deps.shiftLagPred(lagEng, succResult.ls, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_FINISH': {
      const succLf = !(succIsStartMs && !predEndsBeginOfDay) ? succResult.lf
        : !elapsed && isDayTaskOnBands(deps, predTask) && isInsideBlock(se, succResult.lf) ? succResult.lf
          : deps.snapStrictBefore(se, succResult.lf);
      if (elapsed) {
        return deps.snapOnOrBefore(pe, new Date(succLf.getTime() - elapsedMin()));
      }
      const predLf = deps.shiftLagPred(lagEng, succLf, seq, predTask, -1);
      if (isDayTaskOnBands(deps, predTask)) {
        return previousBlockEndIfSame(deps, lagEng, pe, predLf);
      }
      return predLf;
    }
    case 'START_FINISH': {
      const shifted = elapsed
        ? new Date(succResult.lf.getTime() - elapsedMin())
        : deps.shiftLagPred(lagEng, succResult.lf, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_START':
    default: {
      if (elapsed) {
        return deps.snapOnOrBefore(pe, new Date(succResult.ls.getTime() - elapsedMin()));
      }
      const lagged = deps.shiftLagPred(lagEng, succResult.ls, seq, predTask, -1);
      const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, succResult.ls).getTime();
      const target = (predEndsBeginOfDay || succIsFinishMs) && lagIsZero
        ? succResult.ls
        : lagged;
      if (predEndsBeginOfDay) return target;
      if (predElapsed) return target;
      return pe.prevWorkInstant(target);
    }
  }
}
