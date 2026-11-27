import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatDate, formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import { durationMinutesOf, taskDurationUnit } from '@/engine/scheduler/duration';
import {
  completedWorkMinutes, splitAt, splitUnitMinutes, toSplitPieces, workAxisMinutesBetween,
  workOffsetAtDate, type SplitPiece,
} from '@/engine/scheduler/splitEdit';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { readAccentColor, sizeCanvasToContainer } from './useCanvasLayer';
import {
  dagslotMinutes, dagslotMinutesBetween, hourSnapMinutesFor, snapTimelineDate, splitWorkdayStart, splitWorkdayMinutes,
  splitWorkdayUnits, workOffsetOnAxis,
} from './timelineSnap';
import { taskSplitMeasure } from '@/engine/renderer/splitBarGeometry';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';
import { shownStart } from '@/utils/taskDates';

let splitSeq = 0;

export interface SplitGestureState {
  taskId: string;
  anchorX: number;
  currentX: number;
  top: number;
  bottom: number;
  atIso: string;
  gapUnits: number;
  hourMode: boolean;
  dragging: boolean;
}

interface FrozenGesture {
  taskId: string;
  pieces0: SplitPiece[];
  offsetMinutes: number;
  minOffsetMinutes: number;
  unitMinutes: number;
  minimumGap: number;
  anchorDate: Date;
  eng: CalendarEngine;
  cal: WorkCalendar;
  axisKind: SplitAxisKind;
  undoKey: string;
  committed: boolean;
}

type SplitAxisKind = 'minutes' | 'dagslots' | 'days';

function axisMinutesBetween(from: Date, to: Date, eng: CalendarEngine, axisKind: SplitAxisKind): number {
  return axisKind === 'dagslots'
    ? Math.max(0, dagslotMinutesBetween(from, to, eng))
    : workAxisMinutesBetween(from, to, eng, axisKind === 'minutes');
}

function gapUnitsOf(g: FrozenGesture, gapMinutes: number, dayZoom: boolean): number {
  if (g.axisKind === 'dagslots') return Math.round((gapMinutes / dagslotMinutes(g.eng)) * 100) / 100;
  if (g.axisKind === 'minutes' && dayZoom) return splitWorkdayUnits(g.anchorDate, gapMinutes, g.eng, g.cal);
  return g.unitMinutes > 0 ? Math.round(gapMinutes / g.unitMinutes) : 0;
}

interface UseSplitGestureOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<GanttRenderer | null>;
  axis: GanttAxis;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  zoom: number;
  enableQuarterHourZoom: boolean;
  workdayDurationMeasure: boolean;
  getTask: (id: string) => Task | undefined;
  setTaskSplits: (taskId: string, pieces: SplitPiece[] | null, opts?: { coalesceKey?: string }) => unknown;
  undo: () => void;
}

export function useSplitGesture({
  canvasRef, containerRef, overlayCanvasRef, rendererRef, axis, calendar, effectiveCalById,
  zoom, enableQuarterHourZoom, workdayDurationMeasure, getTask, setTaskSplits, undo,
}: UseSplitGestureOptions) {
  const [state, setState] = useState<SplitGestureState | null>(null);
  const frozenRef = useRef<FrozenGesture | null>(null);

  const hourSnapMinutes = hourSnapMinutesFor(zoom, enableQuarterHourZoom);

  const dayZoom = hourSnapMinutes === 1440;

  const contextFor = useCallback((task: Task) => {
    const cal = effectiveCalById.get(task.id) ?? calendar;
    const instants = shownStart(task).includes('T');
    const axisKind: SplitAxisKind = !instants ? 'days'
      : taskSplitMeasure(task, workdayDurationMeasure) === 'workdays' ? 'dagslots' : 'minutes';
    const eng = new CalendarEngine(axisKind === 'days' ? cal : calendarForEngine(cal));
    const hoursUnit = taskDurationUnit(task) === 'hours';
    const hoursPerDay = eng.hoursPerDay;
    return {
      eng, cal, axisKind, hoursUnit, hoursPerDay,
      workMinutes: durationMinutesOf(task, { isHourMode: hoursUnit, hoursPerDay }),
      unitMinutes: axisKind === 'dagslots' || (axisKind === 'minutes' && dayZoom) ? 0 : splitUnitMinutes(task, hoursPerDay, hourSnapMinutes),
    };
  }, [calendar, effectiveCalById, hourSnapMinutes, dayZoom, workdayDurationMeasure]);

  const snapAt = useCallback(
    (x: number, axisKind: SplitAxisKind, eng: CalendarEngine, cal: WorkCalendar) => axisKind !== 'days' && dayZoom
      ? splitWorkdayStart(axis.xToDate(x), eng, cal)
      : snapTimelineDate(axis, x, axisKind !== 'days', hourSnapMinutes),
    [axis, hourSnapMinutes, dayZoom],
  );

  const atIsoOf = useCallback(
    (at: Date, axisKind: SplitAxisKind) => (axisKind !== 'days' && !dayZoom ? formatInstant(at, 'hour') : formatDate(at)),
    [dayZoom],
  );

  const stop = useCallback(() => {
    frozenRef.current = null;
    setState(null);
  }, []);

  const splitPositionFor = useCallback((task: Task, x: number) => {
    const { eng, cal, axisKind, hoursUnit, hoursPerDay, workMinutes, unitMinutes } = contextFor(task);
    const pieces0 = toSplitPieces(task.splitGaps, workMinutes);
    if (!pieces0) return null;
    const at = snapAt(x, axisKind, eng, cal);
    if (!at) return null;
    const startIso = shownStart(task);
    const taskStart = startIso.includes('T') ? parseInstant(startIso) : parseDate(startIso);
    const { workMinutes: offsetMinutes, inGap } = axisKind === 'dagslots'
      ? workOffsetOnAxis(pieces0, dagslotMinutesBetween(taskStart, at, eng))
      : workOffsetAtDate(pieces0, taskStart, at, eng, axisKind === 'minutes');
    if (inGap) return null;
    const minOffsetMinutes = completedWorkMinutes(task, hoursPerDay);
    const minimumGap = axisKind === 'dagslots'
      ? (dayZoom ? dagslotMinutes(eng) : Math.max(1e-6, dagslotMinutesBetween(at, eng.addWorkMinutes(at, hourSnapMinutes), eng)))
      : axisKind === 'minutes' && dayZoom ? splitWorkdayMinutes(at, eng, cal) : unitMinutes;
    if (!splitAt(pieces0, offsetMinutes, minimumGap, unitMinutes, minOffsetMinutes).ok) return null;
    return { eng, cal, axisKind, hoursUnit, pieces0, offsetMinutes, minOffsetMinutes, unitMinutes, minimumGap, at };
  }, [contextFor, snapAt, dayZoom, hourSnapMinutes]);

  const updateHover = useCallback((clientX: number, clientY: number): boolean => {
    if (frozenRef.current) return false;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) { setState(null); return false; }
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const hit = renderer.getTaskBarBounds(x, clientY - rect.top);
    const bar = hit ? renderer.getTaskBarRect(hit.task.id) : null;
    if (!hit || !bar) { setState(null); return false; }
    const position = splitPositionFor(hit.task, x);
    if (!position) { setState(null); return false; }
    const { axisKind, hoursUnit, at } = position;
    setState({
      taskId: hit.task.id,
      anchorX: axis.dateToX(at),
      currentX: axis.dateToX(at),
      top: bar.top, bottom: bar.bottom,
      atIso: atIsoOf(at, axisKind),
      gapUnits: 0, hourMode: !dayZoom && axisKind === 'minutes' && hoursUnit, dragging: false,
    });
    return true;
  }, [canvasRef, rendererRef, axis, splitPositionFor, atIsoOf, dayZoom]);

  const clearHover = useCallback(() => { if (!frozenRef.current) setState(null); }, []);

  const startSplitGesture = useCallback((input: { taskId: string; startClientX: number }): boolean => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const task = getTask(input.taskId);
    if (!canvas || !renderer || !task) return false;
    const bar = renderer.getTaskBarRect(task.id);
    if (!bar) return false;
    const position = splitPositionFor(task, input.startClientX - canvas.getBoundingClientRect().left);
    if (!position) return false;
    const { eng, cal, axisKind, hoursUnit, pieces0, offsetMinutes, minOffsetMinutes, unitMinutes, minimumGap, at } = position;
    frozenRef.current = {
      taskId: task.id, pieces0, offsetMinutes, minOffsetMinutes, unitMinutes, minimumGap,
      anchorDate: at, eng, cal, axisKind, undoKey: `split:${task.id}:${++splitSeq}`, committed: false,
    };
    setState({
      taskId: task.id,
      anchorX: axis.dateToX(at), currentX: axis.dateToX(at),
      top: bar.top, bottom: bar.bottom,
      atIso: atIsoOf(at, axisKind),
      gapUnits: 0, hourMode: !dayZoom && axisKind === 'minutes' && hoursUnit, dragging: true,
    });
    return true;
  }, [canvasRef, rendererRef, axis, getTask, splitPositionFor, atIsoOf, dayZoom]);

  const dragging = !!state?.dragging;
  useEffect(() => (dragging ? holdAutoCalc() : undefined), [dragging]);

  useEffect(() => {
    if (!state?.dragging) return;

    const commit = (gapMinutes: number): boolean => {
      const g = frozenRef.current;
      if (!g) return false;
      const result = splitAt(g.pieces0, g.offsetMinutes, gapMinutes, g.unitMinutes, g.minOffsetMinutes);
      if (!result.ok) return false;
      setTaskSplits(g.taskId, result.pieces, { coalesceKey: g.undoKey });
      g.committed = true;
      return true;
    };

    const handleMouseMove = (event: MouseEvent) => {
      const g = frozenRef.current;
      const canvas = canvasRef.current;
      if (!g || !canvas) return;
      const x = event.clientX - canvas.getBoundingClientRect().left;
      const at = snapAt(x, g.axisKind, g.eng, g.cal);
      if (!at) return;
      const measured = axisMinutesBetween(g.anchorDate, at, g.eng, g.axisKind);
      const gapMinutes = Math.max(g.minimumGap, measured);
      commit(gapMinutes);
      setState(prev => (prev ? {
        ...prev,
        currentX: axis.dateToX(at),
        gapUnits: gapUnitsOf(g, gapMinutes, dayZoom),
      } : prev));
    };

    const handleMouseUp = () => {
      const g = frozenRef.current;
      if (g && !g.committed) commit(g.minimumGap);
      stop();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const g = frozenRef.current;
      if (g?.committed) undo();
      stop();
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown, onDocumentSwitch: stop });
  }, [state?.dragging, canvasRef, axis, snapAt, setTaskSplits, undo, stop, dayZoom]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!overlay || !container) return;
    const layer = sizeCanvasToContainer(overlay, container);
    if (!layer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, layer.width, layer.height);
    if (!state) return;

    const accent = readAccentColor();
    const top = state.top - 4;
    const bottom = state.bottom + 4;
    if (state.dragging && state.currentX > state.anchorX) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(state.anchorX, state.top, state.currentX - state.anchorX, state.bottom - state.top);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(state.anchorX, top);
    ctx.lineTo(state.anchorX, bottom);
    if (state.dragging) {
      ctx.moveTo(state.currentX, top);
      ctx.lineTo(state.currentX, bottom);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, [state, containerRef, overlayCanvasRef]);

  return { gestureState: state, startSplitGesture, updateHover, clearHover, active: !!state?.dragging };
}
