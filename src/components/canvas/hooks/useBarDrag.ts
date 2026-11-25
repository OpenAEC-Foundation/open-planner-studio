import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, parseInstant, formatDate, formatInstant } from '@/utils/dateUtils';
import { isCompressedEffective } from '@/engine/renderer/workdayAxis';
import { shiftByDisplayedColumns } from '@/engine/renderer/barDragMath';
import {
  ELAPSED_DRAG_CLOCK, milestoneDragLanding, milestoneSitsAtFinish, resolveDayMeasureBarDrag, resolveHourBarDrag, resolveMilestoneDayDrag,
  resolveMilestoneHourDrag,
} from '@/engine/renderer/hourBarDragMath';
import { taskSplitMeasure } from '@/engine/renderer/splitBarGeometry';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { durationMinutesOf, isElapsedTask, isZeroDurationMilestone, taskDurationUnit } from '@/engine/scheduler/duration';
import { taskCountsInWorkdays } from '@/engine/scheduler/conventions/durationMeasure';
import {
  canSplitTask, setGapLength, setWorkLength, splitUnitMinutes, toSplitPieces, workAxisMinutesBetween,
  type SplitPiece,
} from '@/engine/scheduler/splitEdit';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { Task, TaskConstraint } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { DateNotation, TimeNotation } from '@/types/view';
import type { NotifyInput } from '@/state/slices/types';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import {
  constraintBlockingStart,
  constraintForDraggedStart,
  type StartConstraintEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit, type StartEditNotice } from '@/state/startConstraintNotice';
import { ROW_DRAG_THRESHOLD } from './constants';
import {
  dagslotMinutes, dagslotMinutesBetween, dagslotMoment, dagslotWorkMinimum, dragWorkdaySteps, hourSnapMinutesFor, snapTimelineDate,
  splitWorkdayStart, splitWorkdayMinutes, splitWorkMinimum, splitWorkdayUnits,
} from './timelineSnap';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';
import { finishIsActual, startIsActual, shownFinish, shownStart } from '@/utils/taskDates';
import { BASELINES_PROGRESS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { refusalNotice } from '@/state/refusalNotice';

let dragSeq = 0;
let splitDragSeq = 0;

export interface SplitDragContext {
  kind: 'gap' | 'work';
  index: number;
  pieces0: SplitPiece[];
  baseMinutes: number;
  unitMinutes: number;
  minimumMinutes: number;
  pieceStart: Date;
  dayZoom: boolean;
  anchorDate: Date;
  eng: CalendarEngine;
  cal: WorkCalendar;
  axisKind: 'minutes' | 'dagslots' | 'days';
  hoursUnit: boolean;
  coalesceKey: string;
}

interface StartRuleGesture {
  original: Task;
  driven: boolean;
  blocking?: TaskConstraint;
  blockedTried: boolean;
  snet?: StartConstraintEdit;
}

interface ActualDatesLock {
  taskId: string;
  name: string;
  kind: 'start' | 'finish';
  tried: boolean;
}

export interface SplitDragLabel {
  x: number;
  top: number;
  kind: 'gap' | 'work';
  units: number;
  hourMode: boolean;
}

export function editableSplitPieces(task: Task, calendar: WorkCalendar, segmentCount: number): SplitPiece[] | null {
  if (segmentCount <= 1) return null;
  const hourMode = taskDurationUnit(task) === 'hours';
  const hoursPerDay = new CalendarEngine(hourMode ? calendarForEngine(calendar) : calendar).hoursPerDay;
  if (canSplitTask(task, hoursPerDay, task.childIds.length > 0) !== null) return null;
  const pieces = toSplitPieces(task.splitGaps, durationMinutesOf(task, { isHourMode: hourMode, hoursPerDay }));
  if (!pieces || pieces.filter(p => p.kind === 'work').length !== segmentCount) return null;
  return pieces;
}

export interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'body';
  startX: number;
  startY: number;
  originalStart: string;
  originalFinish: string;
  originalDuration: number;
  originalDurationMinutes?: number;
  pointerStart?: Date;
  segmentIndex?: number;
  segmentCount?: number;
  split?: SplitDragContext;
  companionIds?: readonly string[];
}

interface MilestoneMember {
  taskId: string;
  originalStart: string;
  finishSide: boolean;
  loose: boolean;
  time: Task['time'];
  rule: StartRuleGesture | null;
}

interface UseBarDragOptions {
  zoom: number;
  enableQuarterHourZoom: boolean;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  compressNonWorkdays: boolean;
  getTask: (id: string) => Task | undefined;
  updateTask: (id: string, updates: Partial<Task>, opts?: { coalesceKey?: string }) => void;
  onVerticalBodyDrag?: (candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => void;
  axis: GanttAxis;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  historyMark: () => HistorySessionMark;
  revertHistorySince: (mark: HistorySessionMark) => void;
  endHistorySession: (mark: HistorySessionMark) => void;
  suppressClickRef: RefObject<boolean>;
  setTaskSplits?: (taskId: string, pieces: SplitPiece[] | null, opts?: { coalesceKey?: string }) => unknown;
  barTopOf?: (taskId: string) => number | null;
  isStartDrivenByPredecessor?: (taskId: string) => boolean;
  looseDayEndMilestone?: (taskId: string) => boolean;
  notify?: (notification: NotifyInput) => void;
  dateNotation?: DateNotation;
  timeNotation?: TimeNotation;
  workdayDurationMeasure?: boolean;
}

export function useBarDrag({
  zoom, enableQuarterHourZoom, calendar, effectiveCalById, compressNonWorkdays, getTask,
  updateTask, historyMark, revertHistorySince, endHistorySession, suppressClickRef, onVerticalBodyDrag, axis, canvasRef, setTaskSplits, barTopOf, isStartDrivenByPredecessor, looseDayEndMilestone,
  notify, dateNotation = 'dmy', timeNotation = '24h', workdayDurationMeasure = true,
}: UseBarDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [splitLabel, setSplitLabel] = useState<SplitDragLabel | null>(null);
  const undoKeyRef = useRef<string | null>(null);
  const directionRef = useRef<'undecided' | 'horizontal'>('undecided');
  const lastAppliedDeltaRef = useRef(0);
  const startRuleRef = useRef<StartRuleGesture | null>(null);
  const actualLockRef = useRef<ActualDatesLock | null>(null);
  const milestoneGestureRef = useRef<{ finishSide: boolean; loose: boolean; time: Task['time'] } | null>(null);
  const companionsRef = useRef<MilestoneMember[]>([]);
  const gestureMarkRef = useRef<HistorySessionMark | null>(null);
  const hourSnapMinutes = hourSnapMinutesFor(zoom, enableQuarterHourZoom);
  const snapAt = useCallback(
    (x: number, hourMode: boolean) => snapTimelineDate(axis, x, hourMode, hourSnapMinutes),
    [axis, hourSnapMinutes],
  );

  const prepareSplitDrag = useCallback((next: DragState, canvasX: number | null): SplitDragContext | undefined => {
    const { edge, segmentIndex = 0, segmentCount = 1 } = next;
    if (!setTaskSplits || canvasX === null || segmentCount <= 1) return undefined;
    const kind = edge === 'body' && segmentIndex > 0 ? 'gap' : edge === 'right' ? 'work' : null;
    if (!kind) return undefined;
    const task = getTask(next.taskId);
    if (!task) return undefined;
    const cal = effectiveCalById.get(task.id) ?? calendar;
    const pieces0 = editableSplitPieces(task, cal, segmentCount);
    if (!pieces0) return undefined;
    const startIso = shownStart(task);
    const instants = startIso.includes('T');
    const axisKind = !instants ? 'days' : taskSplitMeasure(task, workdayDurationMeasure) === 'workdays' ? 'dagslots' : 'minutes';
    const eng = new CalendarEngine(axisKind === 'days' ? cal : calendarForEngine(cal));
    const hoursUnit = taskDurationUnit(task) === 'hours';
    const dayZoom = axisKind !== 'days' && hourSnapMinutes === 1440;
    const anchorDate = dayZoom ? splitWorkdayStart(axis.xToDate(canvasX), eng, cal) : snapAt(canvasX, axisKind !== 'days');
    if (!anchorDate) return undefined;
    const index = kind === 'gap' ? segmentIndex - 1 : segmentIndex;
    const base = pieces0.filter(p => p.kind === kind)[index];
    if (!base) return undefined;
    const taskStart = instants ? parseInstant(startIso) : parseDate(startIso);
    const arrayIndex = pieces0.indexOf(base);
    const before = pieces0.slice(0, arrayIndex).reduce((sum, p) => sum + p.minutes, 0);
    const pieceStart = axisKind === 'dagslots' ? dagslotMoment(taskStart, before, eng)
      : axisKind === 'minutes' ? eng.nextWorkInstant(eng.addWorkMinutes(taskStart, before))
        : eng.addWorkingDaysSigned(taskStart, before / (eng.hoursPerDay * 60));
    const unitMinutes = axisKind === 'dagslots' || dayZoom ? 0 : splitUnitMinutes(task, eng.hoursPerDay, hourSnapMinutes);
    const minimumMinutes = axisKind === 'dagslots'
      ? (dayZoom
        ? (kind === 'gap' ? dagslotMinutes(eng) : dagslotWorkMinimum(pieceStart, eng, cal))
        : Math.max(1e-6, dagslotMinutesBetween(pieceStart, eng.addWorkMinutes(pieceStart, hourSnapMinutes), eng)))
      : dayZoom
        ? (kind === 'gap' ? splitWorkdayMinutes(anchorDate, eng, cal) : splitWorkMinimum(pieceStart, eng, cal))
        : splitUnitMinutes(task, eng.hoursPerDay, hourSnapMinutes);
    return {
      kind, index, pieces0, baseMinutes: base.minutes,
      dayZoom, pieceStart, minimumMinutes, unitMinutes,
      anchorDate, eng, cal, axisKind, hoursUnit,
      coalesceKey: `splitdrag:${task.id}:${++splitDragSeq}`,
    };
  }, [setTaskSplits, getTask, effectiveCalById, calendar, snapAt, hourSnapMinutes, axis, workdayDurationMeasure]);

  const startBarDrag = useCallback((next: DragState) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const pointerStart = rect ? axis.xToDate(next.startX - rect.left) : undefined;
    const original = getTask(next.taskId);
    const completed = !!original && finishIsActual(original);
    const split = completed ? undefined : prepareSplitDrag(next, rect ? next.startX - rect.left : null);
    actualLockRef.current = original && (completed || (!split && next.edge !== 'right' && startIsActual(original)))
      ? { taskId: original.id, name: original.name, kind: completed ? 'finish' : 'start', tried: false }
      : null;
    undoKeyRef.current = split ? split.coalesceKey : `bardrag:${next.taskId}:${++dragSeq}`;
    const driven = !split && next.edge !== 'right' && !!original && !actualLockRef.current
      && (isStartDrivenByPredecessor?.(next.taskId) ?? false);
    startRuleRef.current = original && driven
      ? { original, driven, blocking: constraintBlockingStart(original, driven), blockedTried: false }
      : null;
    directionRef.current = 'undecided';
    lastAppliedDeltaRef.current = 0;
    setSplitLabel(null);
    const loose = !!original && isZeroDurationMilestone(original) && (looseDayEndMilestone?.(original.id) ?? false);
    milestoneGestureRef.current = original && isZeroDurationMilestone(original)
      ? {
        finishSide: milestoneSitsAtFinish(
          new CalendarEngine(calendarForEngine(effectiveCalById.get(original.id) ?? calendar)),
          parseInstant(next.originalStart), original.milestoneKind, driven, loose,
        ),
        loose,
        time: original.time,
      }
      : null;
    companionsRef.current = [];
    if (milestoneGestureRef.current && next.edge === 'body' && !split && next.originalStart.includes('T')) {
      for (const id of next.companionIds ?? []) {
        const task = getTask(id);
        const at = task && (shownStart(task) || shownFinish(task));
        if (!task || !at?.includes('T') || !isZeroDurationMilestone(task)) continue;
        if (!actualLockRef.current && (finishIsActual(task) || startIsActual(task))) {
          actualLockRef.current = { taskId: task.id, name: task.name, kind: finishIsActual(task) ? 'finish' : 'start', tried: false };
        }
        const memberDriven = isStartDrivenByPredecessor?.(id) ?? false;
        const memberLoose = looseDayEndMilestone?.(id) ?? false;
        companionsRef.current.push({
          taskId: id,
          originalStart: at,
          finishSide: milestoneSitsAtFinish(new CalendarEngine(calendarForEngine(effectiveCalById.get(id) ?? calendar)),
            parseInstant(at), task.milestoneKind, memberDriven, memberLoose),
          loose: memberLoose,
          time: task.time,
          rule: memberDriven
            ? { original: task, driven: true, blocking: constraintBlockingStart(task, true), blockedTried: false }
            : null,
        });
      }
    }
    setDragState({ ...next, pointerStart, split });
  }, [axis, canvasRef, prepareSplitDrag, getTask, isStartDrivenByPredecessor, looseDayEndMilestone, effectiveCalById, calendar]);

  const dragging = dragState !== null;
  useEffect(() => (dragging ? holdAutoCalc() : undefined), [dragging]);

  useEffect(() => () => {
    if (gestureMarkRef.current) endHistorySession(gestureMarkRef.current);
    gestureMarkRef.current = null;
  }, [endHistorySession]);


  useEffect(() => {
    if (!dragState) return;

    const undoKey = undoKeyRef.current;
    if (!undoKey) return;

    const openGestureSession = () => {
      gestureMarkRef.current ??= historyMark();
    };
    const writeTask = (id: string, updates: Partial<Task>, opts: { coalesceKey: string }) => {
      openGestureSession();
      updateTask(id, updates, opts);
    };

    const draggedTask = getTask(dragState.taskId);
    if (!draggedTask) return;
    const hasInstants = dragState.originalStart.includes('T') && dragState.originalFinish.includes('T');
    const dragKind: 'hours' | 'dayMeasure' | 'daysAsHours' | 'days' = taskDurationUnit(draggedTask) === 'hours' ? 'hours'
      : !hasInstants ? 'days'
        : taskCountsInWorkdays(draggedTask, { workdayDurationMeasure }) ? 'dayMeasure' : 'daysAsHours';
    const elapsed = isElapsedTask(draggedTask);
    const splitGaps = elapsed ? undefined : draggedTask.splitGaps?.filter(g => g.source !== 'leveling');

    const resizeCalEngine = new CalendarEngine(effectiveCalById.get(dragState.taskId) ?? calendar);
    const axisCalEngine = new CalendarEngine(calendar);
    const compressed = isCompressedEffective(axisCalEngine, compressNonWorkdays);
    const quantumMin = hourSnapMinutesFor(zoom, enableQuarterHourZoom);

    const constraintFor = (rule: StartRuleGesture | null, start: string): Partial<Task> => {
      if (!rule) return {};
      const hadSnet = rule.snet !== undefined;
      rule.snet = constraintForDraggedStart(rule.original, start, rule.driven);
      if (rule.snet) return { constraint: rule.snet.constraint };
      return hadSnet ? { constraint: rule.original.constraint } : {};
    };
    const constraintForStart = (start: string): Partial<Task> => constraintFor(startRuleRef.current, start);
    const startBlocked = (moved: boolean): boolean => {
      const blocking = [startRuleRef.current, ...companionsRef.current.map(member => member.rule)]
        .filter((rule): rule is StartRuleGesture => !!rule?.blocking);
      if (blocking.length === 0) return false;
      if (moved) for (const rule of blocking) rule.blockedTried = true;
      return true;
    };

    const milestone = isZeroDurationMilestone(draggedTask) && hasInstants;
    const milestoneTarget = (member: MilestoneMember, pixelDelta: number): string | null => {
      const cal = effectiveCalById.get(member.taskId) ?? calendar;
      const engine = new CalendarEngine(calendarForEngine(cal));
      const original = parseInstant(member.originalStart);
      const { finishSide } = member;
      const dayAnchor = compressed && !axisCalEngine.isWorkDay(original)
        ? (finishSide ? engine.prevWorkInstant(original) : engine.nextWorkInstant(original))
        : original;
      const workdaySteps = quantumMin === 1440
        ? dragWorkdaySteps(dayAnchor, finishSide ? 'end' : 'start', Math.round(pixelDelta / zoom), axisCalEngine, compressed, engine, cal)
        : 0;
      const at = quantumMin === 1440
        ? (workdaySteps === 0 ? original : resolveMilestoneDayDrag({ calendar: engine, original: dayAnchor, finishSide, workdaySteps }))
        : pixelDelta === 0 ? original : resolveMilestoneHourDrag({
          calendar: engine,
          original,
          finishSide,
          candidate: axis.xToDate(axis.dateToX(original) + pixelDelta),
          snapMinutes: quantumMin,
        });
      if (at.getTime() === original.getTime()) return null;
      return formatInstant(milestoneDragLanding(engine, at, member.loose, quantumMin === 1440 ? 60 : quantumMin), 'hour');
    };
    const applyMilestoneTarget = (member: MilestoneMember, next: string | null) => {
      const baseTime = getTask(member.taskId)?.time;
      if (!baseTime) return;
      if (next === null) {
        if (baseTime === member.time) return;
        writeTask(member.taskId, { time: member.time, ...constraintFor(member.rule, member.originalStart) }, { coalesceKey: undoKey });
        return;
      }
      if (baseTime.scheduleStart === next && baseTime.scheduleFinish === next
        && baseTime.earlyStart === next && baseTime.earlyFinish === next) return;
      writeTask(member.taskId, {
        time: {
          ...baseTime,
          scheduleStart: next,
          scheduleFinish: next,
          earlyStart: next,
          earlyFinish: next,
        },
        ...constraintFor(member.rule, next),
      }, { coalesceKey: undoKey });
    };
    const handleMilestoneDrag = (event: MouseEvent) => {
      const gesture = milestoneGestureRef.current;
      if (!gesture) return;
      const pixelDelta = event.clientX - dragState.startX;
      const members: MilestoneMember[] = [
        { taskId: dragState.taskId, originalStart: dragState.originalStart, finishSide: gesture.finishSide,
          loose: gesture.loose, time: gesture.time, rule: startRuleRef.current },
        ...companionsRef.current,
      ];
      const targets = members.map(member => milestoneTarget(member, pixelDelta));
      if (startBlocked(targets.some((next, k) => next !== null && next !== members[k].originalStart))) return;
      members.forEach((member, k) => applyMilestoneTarget(member, targets[k]));
    };

    const handleHourDrag = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || !dragState.pointerStart) return;
      const pointerCurrent = axis.xToDate(event.clientX - rect.left);
      const origStart = parseInstant(dragState.originalStart);
      const origFinish = parseInstant(dragState.originalFinish);
      const baseTime = getTask(dragState.taskId)?.time;
      if (!baseTime) return;
      const hourEngine = new CalendarEngine(calendarForEngine(effectiveCalById.get(dragState.taskId) ?? calendar));
      const daysAsHours = dragKind === 'daysAsHours';
      const dayMinutes = elapsed ? 24 * 60 : Math.max(1, hourEngine.hoursPerDay * 60);
      const origMinutes = daysAsHours
        ? Math.max(1, Math.round(dragState.originalDuration * dayMinutes))
        : dragState.originalDurationMinutes
          ?? Math.max(1, Math.round((origFinish.getTime() - origStart.getTime()) / 60000));
      const result = resolveHourBarDrag({
        calendar: elapsed ? ELAPSED_DRAG_CLOCK : hourEngine,
        edge: dragState.edge,
        originalStart: origStart,
        originalFinish: origFinish,
        originalDurationMinutes: origMinutes,
        splitGaps,
        pointerStart: dragState.pointerStart,
        pointerCurrent,
        snapMinutes: quantumMin,
      });
      const nextStart = formatInstant(result.start, 'hour');
      const nextFinish = formatInstant(result.finish, 'hour');
      const duration = daysAsHours
        ? { scheduleDuration: Math.round((result.durationMinutes / dayMinutes) * 1e6) / 1e6 }
        : { durationMinutes: result.durationMinutes };
      if (dragState.edge !== 'right' && startBlocked(nextStart !== dragState.originalStart)) return;
      if (baseTime.scheduleStart === nextStart && baseTime.scheduleFinish === nextFinish
        && (daysAsHours ? baseTime.scheduleDuration === duration.scheduleDuration : baseTime.durationMinutes === result.durationMinutes)) return;
      writeTask(dragState.taskId, {
        time: {
          ...baseTime,
          scheduleStart: dragState.edge === 'right' ? baseTime.scheduleStart : nextStart,
          scheduleFinish: nextFinish,
          earlyStart: nextStart,
          earlyFinish: nextFinish,
          ...duration,
        },
        ...(dragState.edge !== 'right' ? constraintForStart(nextStart) : {}),
      }, { coalesceKey: undoKey });
    };

    const handleDayMeasureDrag = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || !dragState.pointerStart) return;
      const pointerCurrent = axis.xToDate(event.clientX - rect.left);
      const baseTime = getTask(dragState.taskId)?.time;
      if (!baseTime) return;
      const cal = effectiveCalById.get(dragState.taskId) ?? calendar;
      const engine = new CalendarEngine(calendarForEngine(cal));
      const right = dragState.edge === 'right';
      const workdaySteps = quantumMin === 1440
        ? dragWorkdaySteps(parseInstant(right ? dragState.originalFinish : dragState.originalStart), right ? 'end' : 'start',
          Math.round((event.clientX - dragState.startX) / zoom), axisCalEngine, compressed, engine, cal)
        : undefined;
      const result = resolveDayMeasureBarDrag({
        calendar: engine,
        edge: dragState.edge,
        originalStart: parseInstant(dragState.originalStart),
        originalFinish: parseInstant(dragState.originalFinish),
        originalDays: dragState.originalDuration,
        splitGaps,
        workdaySteps,
        pointerStart: dragState.pointerStart,
        pointerCurrent,
        snapMinutes: quantumMin,
      });
      const nextStart = formatInstant(result.start, 'hour');
      const nextFinish = formatInstant(result.finish, 'hour');
      if (dragState.edge !== 'right' && startBlocked(nextStart !== dragState.originalStart)) return;
      if (baseTime.scheduleStart === nextStart && baseTime.scheduleFinish === nextFinish
        && baseTime.scheduleDuration === result.days) return;
      writeTask(dragState.taskId, {
        time: {
          ...baseTime,
          scheduleStart: dragState.edge === 'right' ? baseTime.scheduleStart : nextStart,
          scheduleFinish: nextFinish,
          earlyStart: nextStart,
          earlyFinish: nextFinish,
          scheduleDuration: result.days,
        },
        ...(dragState.edge !== 'right' ? constraintForStart(nextStart) : {}),
      }, { coalesceKey: undoKey });
    };

    const handleSplitDrag = (e: MouseEvent, split: SplitDragContext) => {
      const canvas = canvasRef.current;
      if (!canvas || !setTaskSplits) return;
      const x = e.clientX - canvas.getBoundingClientRect().left;
      const at = split.dayZoom ? splitWorkdayStart(axis.xToDate(x), split.eng, split.cal) : snapAt(x, split.axisKind !== 'days');
      if (!at) return;
      const minutesAxis = split.axisKind === 'minutes';
      const delta = split.axisKind === 'dagslots'
        ? dagslotMinutesBetween(split.anchorDate, at, split.eng)
        : at.getTime() >= split.anchorDate.getTime()
          ? workAxisMinutesBetween(split.anchorDate, at, split.eng, minutesAxis)
          : -workAxisMinutesBetween(at, split.anchorDate, split.eng, minutesAxis);
      const top = barTopOf?.(dragState.taskId) ?? null;
      if (delta === lastAppliedDeltaRef.current) return;
      lastAppliedDeltaRef.current = delta;
      const rawMinutes = split.baseMinutes + delta;
      const gapMinutes = rawMinutes <= 0 ? 0 : Math.max(split.minimumMinutes, rawMinutes);
      const result = split.kind === 'gap'
        ? setGapLength(split.pieces0, split.index, gapMinutes, split.unitMinutes)
        : setWorkLength(split.pieces0, split.index, rawMinutes, split.unitMinutes, split.minimumMinutes);
      if (!result.ok) return;
      openGestureSession();
      setTaskSplits(dragState.taskId, result.pieces, { coalesceKey: undoKey });
      const edited = split.kind === 'gap'
        ? (result.pieces.length === split.pieces0.length ? result.pieces.filter(p => p.kind === 'gap')[split.index]?.minutes ?? 0 : 0)
        : result.pieces.filter(p => p.kind === 'work')[split.index]?.minutes ?? 0;
      if (top !== null) {
        setSplitLabel({
          x, top, kind: split.kind, hourMode: !split.dayZoom && split.axisKind === 'minutes' && split.hoursUnit,
          units: split.axisKind === 'dagslots' ? Math.round((edited / dagslotMinutes(split.eng)) * 100) / 100
            : split.dayZoom ? splitWorkdayUnits(split.pieceStart, edited, split.eng, split.cal)
              : split.unitMinutes > 0 ? Math.round(edited / split.unitMinutes) : 0,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.split) {
        handleSplitDrag(e, dragState.split);
        return;
      }
      if (dragState.edge === 'body' && directionRef.current === 'undecided') {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < ROW_DRAG_THRESHOLD) return;
        if (Math.abs(deltaY) > Math.abs(deltaX) && onVerticalBodyDrag) {
          onVerticalBodyDrag({
            taskId: dragState.taskId,
            startClientX: dragState.startX,
            startClientY: dragState.startY,
          });
          undoKeyRef.current = null;
          startRuleRef.current = null;
          companionsRef.current = [];
          actualLockRef.current = null;
          setDragState(null);
          return;
        }
        directionRef.current = 'horizontal';
      }
      const pixelDelta = e.clientX - dragState.startX;
      const lock = actualLockRef.current;
      if (lock) {
        if (Math.abs(pixelDelta) >= ROW_DRAG_THRESHOLD) lock.tried = true;
        return;
      }
      if (milestone) {
        handleMilestoneDrag(e);
        return;
      }
      if (dragKind === 'hours' || dragKind === 'daysAsHours') {
        handleHourDrag(e);
        return;
      }
      if (dragKind === 'dayMeasure') {
        handleDayMeasureDrag(e);
        return;
      }
      const daysDelta = Math.round(pixelDelta / zoom);
      if (daysDelta === lastAppliedDeltaRef.current) return;
      lastAppliedDeltaRef.current = daysDelta;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);
      const currentTime = getTask(dragState.taskId)?.time;
      if (!currentTime) return;

      if (dragState.edge !== 'right' && startBlocked(daysDelta !== 0)) return;

      if (dragState.edge === 'body') {
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        const start = `${formatDate(newStart)}${dragState.originalStart.slice(10)}`;
        const finish = `${formatDate(newFinish)}${dragState.originalFinish.slice(10)}`;
        writeTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleStart: start,
            scheduleFinish: finish,
            earlyStart: start,
            earlyFinish: finish,
          },
          ...constraintForStart(start),
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'right') {
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(origStart, newFinish));
        const canonFinish = resizeCalEngine.addWorkDays(origStart, newDuration);
        writeTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleFinish: formatDate(canonFinish),
            earlyFinish: formatDate(canonFinish),
            scheduleDuration: newDuration,
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'left') {
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(newStart, origFinish));
        const canonStart = resizeCalEngine.subtractWorkDays(origFinish, newDuration);
        writeTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleStart: formatDate(canonStart),
            earlyStart: formatDate(canonStart),
            scheduleDuration: newDuration,
          },
          ...constraintForStart(formatDate(canonStart)),
        }, { coalesceKey: undoKey });
      }
    };

    const handleMouseUp = () => {
      if (gestureMarkRef.current) endHistorySession(gestureMarkRef.current);
      gestureMarkRef.current = null;
      undoKeyRef.current = null;
      const lock = actualLockRef.current;
      actualLockRef.current = null;
      if (lock?.tried && notify) {
        notify(refusalNotice({
          messageKey: lock.kind === 'finish' ? 'notifications.dragDatesAreActual' : 'notifications.dragStartIsActual',
          params: { name: lock.name },
          dedupeKey: `drag-actual:${lock.kind}:${lock.taskId}`,
          helpArticleId: BASELINES_PROGRESS_HELP_ARTICLE_ID,
        }));
      }
      const rules = [startRuleRef.current, ...companionsRef.current.map(member => member.rule)]
        .filter((rule): rule is StartRuleGesture => !!rule);
      startRuleRef.current = null;
      companionsRef.current = [];
      if (rules.length > 0 && notify) {
        const notices: StartEditNotice[] = rules.flatMap((rule): StartEditNotice[] => rule.blocking
          ? (rule.blockedTried ? [{ kind: 'blocked', name: rule.original.name, constraint: rule.blocking, taskId: rule.original.id }] : [])
          : rule.snet?.constraint.date
            ? [{ kind: 'snet', name: rule.original.name, date: rule.snet.constraint.date, change: rule.snet.change }]
            : []);
        notifyStartEdit(notify, notices, dateNotation, timeNotation);
      }
      setSplitLabel(null);
      setDragState(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (gestureMarkRef.current) revertHistorySince(gestureMarkRef.current);
      gestureMarkRef.current = null;
      undoKeyRef.current = null;
      startRuleRef.current = null;
      companionsRef.current = [];
      actualLockRef.current = null;
      suppressClickRef.current = true;
      setSplitLabel(null);
      setDragState(null);
    };

    const handleDocumentSwitch = () => {
      if (gestureMarkRef.current) endHistorySession(gestureMarkRef.current);
      gestureMarkRef.current = null;
      undoKeyRef.current = null;
      startRuleRef.current = null;
      companionsRef.current = [];
      actualLockRef.current = null;
      setSplitLabel(null);
      setDragState(null);
    };

    return listenWindowDrag({
      onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown, keyCapture: true,
      onDocumentSwitch: handleDocumentSwitch,
    });
  }, [
    dragState,
    zoom,
    enableQuarterHourZoom,

    calendar,
    effectiveCalById,
    compressNonWorkdays,
    getTask,
    updateTask,
    historyMark,
    revertHistorySince,
    endHistorySession,
    suppressClickRef,
    onVerticalBodyDrag,
    axis,
    canvasRef,
    setTaskSplits,
    barTopOf,
    snapAt,
    notify,
    dateNotation,
    timeNotation,
    workdayDurationMeasure,
  ]);

  return { dragState, startBarDrag, splitLabel, active: !!dragState };
}
