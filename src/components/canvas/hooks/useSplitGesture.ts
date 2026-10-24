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

// Monotone teller, exact als `dragSeq` in `useBarDrag`: élk splitsgebaar krijgt een UNIEKE
// coalesce-key, zodat de reeks per-mousemove-commits één undo-stap is en twee opeenvolgende
// gebaren nooit samenvloeien.
let splitSeq = 0;

/** Wat de overlay moet tekenen — hover (`dragging: false`) én het lopende gebaar. */
export interface SplitGestureState {
  taskId: string;
  /** Canvas-x van de gesnapte klikdag (begin van de pauze) en van de dag onder de muis. */
  anchorX: number;
  currentX: number;
  /** Boven- en onderkant van de balk in canvascoördinaten; de geleidelijn loopt hierover. */
  top: number;
  bottom: number;
  /** De gesnapte datum onder de muis, als ISO-dag (dagzoom) of -instant (uurzoom) — het hoverlabel. */
  atIso: string;
  /** Pauzelengte in EENHEDEN (werkdagen, of uren bij een uur-taak). 0 zolang er niet gesleept is. */
  gapUnits: number;
  /** De eenheid van het label: uren (een urentaak bij uurzoom) of werkdagen. */
  hourMode: boolean;
  dragging: boolean;
}

/** Alles wat bij gebaar-START is bevroren; de mousemoves rekenen hier telkens vanaf. */
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
  /** Is er al iets gecommit? Bepaalt of Esc een undo-stap moet terugdraaien. */
  committed: boolean;
}

/**
 * Op welke as het gebaar meet (alleen uren §3.14, F3c; T24):
 *  - `'minutes'`: werkminuten — een urentaak, of een dagtaak onder een profiel zonder dagenmaat (P6, MSP);
 *  - `'dagslots'`: de dagenmaat — elke werkdag telt `werktijd per dag × 60` asminuten (`timelineSnap.ts`);
 *  - `'days'`: hele werkdagen — een taak met alleen datums (van vóór het minutenmodel).
 * Dezelfde maat als de Gantt-stukken (`taskSplitMeasure`), dus de pauze landt waar de balk hem tekent.
 */
type SplitAxisKind = 'minutes' | 'dagslots' | 'days';

/** De afstand van `from` naar `to` op de as van de taak (half-open; terug naar links geeft 0). */
function axisMinutesBetween(from: Date, to: Date, eng: CalendarEngine, axisKind: SplitAxisKind): number {
  return axisKind === 'dagslots'
    ? Math.max(0, dagslotMinutesBetween(from, to, eng))
    : workAxisMinutesBetween(from, to, eng, axisKind === 'minutes');
}

/** Het label van de pauzelengte: werkdagen, of uren bij een urentaak op uurzoom. */
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
  /** De EXACTE as waarmee de renderer getekend heeft (werkdagencompressie inbegrepen) — dezelfde
   *  die `useBarDrag` gebruikt. Pixel ↔ datum loopt nergens anders langs. */
  axis: GanttAxis;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  zoom: number;
  enableQuarterHourZoom: boolean;
  /** Telt het rekenprofiel een dagenmaat in werkdagen (conventie `workdayDurationMeasure`)? */
  workdayDurationMeasure: boolean;
  getTask: (id: string) => Task | undefined;
  setTaskSplits: (taskId: string, pieces: SplitPiece[] | null, opts?: { coalesceKey?: string }) => unknown;
  undo: () => void;
}

/**
 * Het splitsgebaar: in de splits-modus klikken op de dag waar de
 * onderbreking begint en naar rechts slepen voor de lengte.
 *
 * Naar het model van `useBarDrag`: eigen state, eigen window-listeners, en uitsluitend gestart door
 * `useGanttPointerCoordinator`. Twee regels die hier niet mogen verwateren:
 *  1. ALLE rekenwerk loopt via `splitEdit.ts` + `setTaskSplits`. Deze hook raakt `afterMinutes` of
 *     `gapMinutes` nooit zelf aan — hij levert een werk-as-positie en een pauzelengte aan.
 *  2. Pixel ↔ datum loopt uitsluitend via de gedeelde `GanttAxis` van de renderer, dezelfde as
 *     waarmee de balk getekend is; werkdagencompressie en uur-snap kloppen dan vanzelf.
 * Elke mousemove rekent vanaf de BEVROREN begintoestand (`pieces0`), niet vanaf de vorige move —
 * anders zou terugslepen de pauze niet weer korter maken.
 */
export function useSplitGesture({
  canvasRef, containerRef, overlayCanvasRef, rendererRef, axis, calendar, effectiveCalById,
  zoom, enableQuarterHourZoom, workdayDurationMeasure, getTask, setTaskSplits, undo,
}: UseSplitGestureOptions) {
  const [state, setState] = useState<SplitGestureState | null>(null);
  const frozenRef = useRef<FrozenGesture | null>(null);

  /** De uur-snap van de sleep is dezelfde als die van `useBarDrag`: de actieve minor-tier, met
   *  een kwartier alleen wanneer die zoom is aangezet. In dag-modus doet dit niets. */
  const hourSnapMinutes = hourSnapMinutesFor(zoom, enableQuarterHourZoom);

  /** Bij dagzoom (T24) valt de pointer op het begin van de werkdag onder de muis. */
  const dayZoom = hourSnapMinutes === 1440;

  /** Kalender, as en werkduur van een taak — één bron voor start, move en hover. */
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
      // Geen nieuwe afronding op de dagslot-as en bij dagzoom op de werkminuten-as (T24 stap 1): de
      // plek en de afstand komen uit de kalender.
      unitMinutes: axisKind === 'dagslots' || (axisKind === 'minutes' && dayZoom) ? 0 : splitUnitMinutes(task, hoursPerDay, hourSnapMinutes),
    };
  }, [calendar, effectiveCalById, hourSnapMinutes, dayZoom, workdayDurationMeasure]);

  const snapAt = useCallback(
    (x: number, axisKind: SplitAxisKind, eng: CalendarEngine, cal: WorkCalendar) => axisKind !== 'days' && dayZoom
      ? splitWorkdayStart(axis.xToDate(x), eng, cal)
      : snapTimelineDate(axis, x, axisKind !== 'days', hourSnapMinutes),
    [axis, hourSnapMinutes, dayZoom],
  );

  /** Het hoverlabel: bij uurzoom het moment, anders de dag. */
  const atIsoOf = useCallback(
    (at: Date, axisKind: SplitAxisKind) => (axisKind !== 'days' && !dayZoom ? formatInstant(at, 'hour') : formatDate(at)),
    [dayZoom],
  );

  const stop = useCallback(() => {
    frozenRef.current = null;
    setState(null);
  }, []);

  /** Hover in de modus: dezelfde geleidelijn, zonder te muteren. `null` = niets tonen. */
  const updateHover = useCallback((clientX: number, clientY: number) => {
    if (frozenRef.current) return; // een lopend gebaar bezit de overlay
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) { setState(null); return; }
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const hit = renderer.getTaskBarBounds(x, clientY - rect.top);
    const bar = hit ? renderer.getTaskBarRect(hit.task.id) : null;
    if (!hit || !bar) { setState(null); return; }
    const { axisKind, hoursUnit, eng, cal } = contextFor(hit.task);
    const at = snapAt(x, axisKind, eng, cal);
    if (!at) { setState(null); return; }
    setState({
      taskId: hit.task.id,
      anchorX: axis.dateToX(at),
      currentX: axis.dateToX(at),
      top: bar.top, bottom: bar.bottom,
      atIso: atIsoOf(at, axisKind),
      gapUnits: 0, hourMode: !dayZoom && axisKind === 'minutes' && hoursUnit, dragging: false,
    });
  }, [canvasRef, rendererRef, axis, contextFor, snapAt, atIsoOf, dayZoom]);

  const clearHover = useCallback(() => { if (!frozenRef.current) setState(null); }, []);

  /**
   * Gebaar starten. Geeft `false` terug wanneer er niets te splitsen valt op dit punt (klik in een
   * bestaande pauze, of een positie die `splitAt` sowieso zou weigeren) — de coördinator laat het
   * dan bij een selectie; de cursor heeft de gebruiker al verteld dat hier niets gebeurt.
   */
  const startSplitGesture = useCallback((input: { taskId: string; startClientX: number }): boolean => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const task = getTask(input.taskId);
    if (!canvas || !renderer || !task) return false;
    const bar = renderer.getTaskBarRect(task.id);
    if (!bar) return false;
    const { eng, cal, axisKind, hoursUnit, hoursPerDay, workMinutes, unitMinutes } = contextFor(task);
    const pieces0 = toSplitPieces(task.splitGaps, workMinutes);
    if (!pieces0) return false; // niet-wélgevormde importsplit: alleen-lezen
    const x = input.startClientX - canvas.getBoundingClientRect().left;
    const at = snapAt(x, axisKind, eng, cal);
    if (!at) return false;
    // De balk staat op de getoonde start (`shownStart`, `GanttRenderer.barGeometry`): een taak die
    // door een voorganger is opgeschoven houdt haar `scheduleStart`-anker op de projectstart. Vanaf
    // dat anker meten schuift de split precies die opschuiving op.
    const startIso = shownStart(task);
    const taskStart = startIso.includes('T') ? parseInstant(startIso) : parseDate(startIso);
    const { workMinutes: offsetMinutes, inGap } = axisKind === 'dagslots'
      ? workOffsetOnAxis(pieces0, dagslotMinutesBetween(taskStart, at, eng))
      : workOffsetAtDate(pieces0, taskStart, at, eng, axisKind === 'minutes');
    if (inGap) return false;
    const minOffsetMinutes = completedWorkMinutes(task, hoursPerDay);
    // T24 stap 2: een nieuwe pauze is ten minste één werkdag (bij dagzoom), anders één snapstap.
    const minimumGap = axisKind === 'dagslots'
      ? (dayZoom ? dagslotMinutes(eng) : Math.max(1e-6, dagslotMinutesBetween(at, eng.addWorkMinutes(at, hourSnapMinutes), eng)))
      : axisKind === 'minutes' && dayZoom ? splitWorkdayMinutes(at, eng, cal) : unitMinutes;
    // Proefsplits met de kleinste pauze: kan die niet, dan kan geen enkele lengte hier.
    if (!splitAt(pieces0, offsetMinutes, minimumGap, unitMinutes, minOffsetMinutes).ok) return false;
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
  }, [canvasRef, rendererRef, axis, getTask, contextFor, snapAt, atIsoOf, dayZoom, hourSnapMinutes]);

  // Automatisch berekenen wacht tot het gebaar af is (zie `useBarDrag`).
  const dragging = !!state?.dragging;
  useEffect(() => (dragging ? holdAutoCalc() : undefined), [dragging]);

  useEffect(() => {
    if (!state?.dragging) return;

    /** Commit de pauze van `gapMinutes` — altijd vanaf de bevroren begintoestand. */
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
      // Pauzelengte = de afstand tussen de klikdag en de dag onder de muis op de as van de taak,
      // minstens het minimum. Terugslepen naar links geeft 0 ⇒ weer de kleinst mogelijke pauze.
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
      // Losse klik zonder beweging: één commit met de kleinste pauze (klikken is
      // "onderbreek hier", slepen is "zo lang").
      if (g && !g.committed) commit(g.minimumGap);
      stop();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const g = frozenRef.current;
      // Esc midden in het gebaar draait de lopende coalesce-stap terug; is er nog niets gecommit,
      // dan valt er ook niets ongedaan te maken.
      if (g?.committed) undo();
      stop();
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onKeyDown: handleKeyDown });
  }, [state?.dragging, canvasRef, axis, snapAt, setTaskSplits, undo, stop, dayZoom]);

  // Geleidelijn op het gedeelde overlay-canvas — dezelfde laag waarop `useDependencyDraw` zijn
  // sleeplijn tekent. Dat kan omdat de twee modi elkaar uitsluiten (`setUI`), dus er staat nooit
  // een relatielijn tegelijk met deze overlay. Het LABEL is bewust DOM (zie `GanttCanvas`): zo
  // blijft alle zichtbare tekst binnen de zes tekstrollen.
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
