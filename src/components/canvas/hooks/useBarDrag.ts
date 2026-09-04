import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, parseInstant, formatDate, formatInstant } from '@/utils/dateUtils';
import { pickTiers, TIER_CONFIG } from '@/engine/renderer/timelineTiers';
import { isCompressedEffective } from '@/engine/renderer/workdayAxis';
import { shiftByDisplayedColumns } from '@/engine/renderer/barDragMath';
import { resolveHourBarDrag } from '@/engine/renderer/hourBarDragMath';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { ROW_DRAG_THRESHOLD } from './constants';

// Monotone teller: geeft élk sleep-gebaar een UNIEKE coalesce-key (`bardrag:<taskId>:<n>`). Zo vloeit
// een reeks per-mousemove `updateTask`-commits samen tot ÉÉN undo-stap, terwijl twee opeenvolgende
// sleeps nooit samenvloeien — ook niet binnen dezelfde milliseconde (de teller loopt altijd door).
let dragSeq = 0;

export interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'body';
  startX: number;
  startY: number;
  originalStart: string;
  originalFinish: string;
  originalDuration: number;
  /** Fase 2.8b (§6.3): originele `durationMinutes` bij drag-start (uur-taken); undefined = dag-taak. */
  originalDurationMinutes?: number;
  /** Gantt-aspositie bij pointer-down; de volgende muisbewegingen worden hiertegen afgezet. */
  pointerStart?: Date;
}

interface UseBarDragOptions {
  zoom: number;
  enableQuarterHourZoom: boolean;
  enableHourPlanning: boolean;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  /** Issue #21 punt 5 (review §10.3): dezelfde vlag als `GanttCanvas`/`resolveGanttAxis` — bepaalt
   *  of een getoonde kolom een KALENDERdag (uit) of een WERKDAG (aan) voorstelt tijdens het slepen.
   *  Effectieve compressie wordt, net als de as zelf, ook gegate op `hasWorkingDays()` van de
   *  PROJECTkalender (`calendar`, niet de per-taak-kalender) — zie `isCompressedEffective`. */
  compressNonWorkdays: boolean;
  /** Actuele taaklezing tijdens native mousemove-events; de coördinator bindt deze aan zijn context. */
  getTask: (id: string) => Task | undefined;
  updateTask: (id: string, updates: Partial<Task>, opts?: { coalesceKey?: string }) => void;
  /** Een overwegend verticale sleep op een balkbody wordt door de coördinator aan de bestaande
   * rijsleep overgedragen. Randen blijven uitsluitend duur-grepen. */
  onVerticalBodyDrag?: (candidate: {
    taskId: string;
    startClientX: number;
    startClientY: number;
  }) => void;
  /** De exacte as waarmee de renderer de balk heeft getekend, inclusief werkdagencompressie. */
  axis: GanttAxis;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

// Balk-sleep (resize links/rechts + verplaatsen), dag- én uur-taken. Bezit zijn eigen `dragState`
// en window-listeners; het centrale mousedown-hittest roept `startBarDrag(...)` aan. Bevat de drie
// verse resize-fixes (commits fa0c73d + 5c9f178) ONGEWIJZIGD:
//   1. duur = INCLUSIEVE werkdagen-telling via de taakkalender (workDaysBetween), zoals CPMSolver;
//   2. de mousemove-guard skipt alleen als `daysDelta` ONgewijzigd is sinds de vorige commit
//      (lastAppliedDelta, init 0) — niet zodra 'ie 0 is — zodat terug-naar-Δ0 de begin-duur herstelt;
//   3. het balk-anker wordt gecanonaliseerd naar een werkdag (addWorkDays/subtractWorkDays) zodat
//      earlyStart/earlyFinish nooit op een weekend landen en niet verschuiven bij de volgende runCPM.
// Issue #21 punt 5 (review §10.3): onder werkdagen-as-compressie (`compressNonWorkdays`) stelt een
// GETOONDE kolom een WERKDAG voor i.p.v. een kalenderdag — de dag-modus-branches (body/left/right,
// hieronder) vertalen `daysDelta` daarom via `shiftByDisplayedColumns` (`addWorkingDaysSigned` i.p.v.
// `addCalendarDays`). Toggle uit ⇒ ongewijzigd. De UUR-tak leest de gedeelde Gantt-as terug en laat
// daarna CalendarEngine de werkminuten/werkbanden bepalen, dus een naad onder werkdagencompressie
// volgt precies wat de gebruiker op de as zag.
export function useBarDrag({ zoom, enableQuarterHourZoom, enableHourPlanning, calendar, effectiveCalById, compressNonWorkdays, getTask, updateTask, onVerticalBodyDrag, axis, canvasRef }: UseBarDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // De kaart met effectieve taakkalenders verandert ook wanneer een live drag de taak muteert. Het
  // effect wordt dan terecht met actuele kalenderinvoer herstart, maar dat mag geen nieuw
  // coalesce-venster openen: één pointergesture blijft exact één undoable handeling.
  const undoKeyRef = useRef<string | null>(null);
  const startBarDrag = useCallback((next: DragState) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const pointerStart = rect ? axis.xToDate(next.startX - rect.left) : undefined;
    undoKeyRef.current = `bardrag:${next.taskId}:${++dragSeq}`;
    setDragState({ ...next, pointerStart });
  }, [axis, canvasRef]);

  // Drag and drop: mousemove (via native event for performance)
  useEffect(() => {
    if (!dragState) return;

    // De key is bij pointer-down geleased en blijft ook bij een effectherstart dezelfde. `++dragSeq`
    // in `startBarDrag` garandeert dat een volgende sleep nooit met deze kan samenvloeien.
    const undoKey = undoKeyRef.current;
    if (!undoKey) return;

    // Een UUR-taak (datumstring met tijdcomponent) behoudt zijn minutenbron. Dag-taken houden het
    // bestaande dag-pad hieronder letterlijk gescheiden.
    const isHourDrag = dragState.originalStart.includes('T');

    // Dag-resize: de nieuwe duur is de INCLUSIEVE werkdagen-telling via de taakkalender — exact
    // zoals CPM zelf rekent (CPMSolver: `scheduleDuration = cal.workDaysBetween(es, ef)`). Zo blijft
    // een resize-sleep staan ná de eerstvolgende runCPM en tellen weekend/feestdagen niet als duur
    // mee. (De vorige `diffCalendarDays` was exclusief én kalender-gebaseerd → één werkdag te weinig,
    // en bij slepen over een weekend werden za/zo ten onrechte meegeteld.)
    const resizeCalEngine = new CalendarEngine(effectiveCalById.get(dragState.taskId) ?? calendar);
    // Issue #21 punt 5 (review §10.3): de kolom→datum-vertaling voor het SLEEP-gebaar zelf moet de
    // PROJECTkalender volgen — dat is dezelfde kalender waarmee `GanttCanvas` de gedeelde
    // (mogelijk gecomprimeerde) as bouwt (`resolveGanttAxis({ calendar, ... })`), dus 1 getoonde
    // kolom = 1 werkdag van DIE kalender, ongeacht of deze taak een eigen kalender heeft. Duur-
    // berekening (workDaysBetween/addWorkDays/subtractWorkDays hieronder) blijft op de
    // taak-specifieke `resizeCalEngine` leunen — dat is een apart vraagstuk (hoeveel werkdagen
    // past de taak-kalender in het gesleepte bereik) en verandert hier niet.
    const axisCalEngine = new CalendarEngine(calendar);
    const compressed = isCompressedEffective(axisCalEngine, compressNonWorkdays);
    // Laatst toegepaste dag-verschuiving. Init op 0 = de begintoestand (geen no-op-update bij het
    // grijpen), maar terugkeren naar Δ0 ná een beweging herstelt de originele duur weer (zie fix
    // bij de guard hieronder).
    let lastAppliedDelta = 0;
    // De balkbody heeft twee betekenisvolle richtingen. Kies pas na dezelfde korte drempel als de
    // rijsleep één as, zodat een natuurlijke diagonale beweging nooit zowel datum als structuur
    // verandert. Randen zijn bewust altijd horizontale duur-grepen.
    let direction: 'undecided' | 'horizontal' = 'undecided';

    // Snap-quantum is dezelfde actieve minor-tier als de tijdkop. Op kwartierzoom is 15 minuten
    // werkelijk bereikbaar; zonder die opt-in blijft de ondergrens één uur. Met urenplanning uit
    // blijft de as voor nieuwe gebaren dag-granulair, maar bestaande urentaken behouden hun eigen
    // werkminuten en worden nooit naar dagen omgezet.
    const minorTier = pickTiers(zoom, enableQuarterHourZoom, enableHourPlanning).minor;
    const quantumMin = Math.max(enableQuarterHourZoom ? 15 : 60, Math.round(TIER_CONFIG[minorTier].stepDays * 1440));

    const handleHourDrag = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || !dragState.pointerStart) return;
      // Lees de actuele pointerposities terug via DEZELFDE GanttAxis als de renderer. Daardoor
      // betekent één getoonde kolom onder werkdagencompressie ook voor een uurtaak precies de
      // kolom die de gebruiker zag, in plaats van een lineaire kalenderdag-aanname.
      const pointerCurrent = axis.xToDate(event.clientX - rect.left);
      const origStart = parseInstant(dragState.originalStart);
      const origFinish = parseInstant(dragState.originalFinish);
      const baseTime = getTask(dragState.taskId)?.time;
      if (!baseTime) return;
      // Volg dezelfde K2-fabriek als de scheduler en resourceberekeningen: expliciete banden
      // (inclusief pauzes) winnen, maar een oudere/zuiver dag-granulaire kalender blijft bruikbaar.
      const effectiveHourCalendar = calendarForEngine(effectiveCalById.get(dragState.taskId) ?? calendar);
      const origMinutes = dragState.originalDurationMinutes
        ?? Math.max(1, Math.round((origFinish.getTime() - origStart.getTime()) / 60000));
      const result = resolveHourBarDrag({
        calendar: new CalendarEngine(effectiveHourCalendar),
        edge: dragState.edge,
        originalStart: origStart,
        originalFinish: origFinish,
        originalDurationMinutes: origMinutes,
        pointerStart: dragState.pointerStart,
        pointerCurrent,
        snapMinutes: quantumMin,
      });
      const nextStart = formatInstant(result.start, 'hour');
      const nextFinish = formatInstant(result.finish, 'hour');
      if (baseTime.scheduleStart === nextStart && baseTime.scheduleFinish === nextFinish
        && baseTime.durationMinutes === result.durationMinutes) return;
      updateTask(dragState.taskId, {
        time: {
          ...baseTime,
          scheduleStart: nextStart,
          scheduleFinish: nextFinish,
          earlyStart: nextStart,
          earlyFinish: nextFinish,
          durationMinutes: result.durationMinutes,
        },
      }, { coalesceKey: undoKey });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.edge === 'body' && direction === 'undecided') {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < ROW_DRAG_THRESHOLD) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Delegatie vóór elke updateTask-aanroep: verticale verplaatsing verandert nooit datums
          // en blijft één undo-stap via useRowDrag → moveTaskTo/moveTasksTo.
          onVerticalBodyDrag?.({
            taskId: dragState.taskId,
            startClientX: dragState.startX,
            startClientY: dragState.startY,
          });
          undoKeyRef.current = null;
          setDragState(null);
          return;
        }
        direction = 'horizontal';
      }
      const pixelDelta = e.clientX - dragState.startX;
      if (isHourDrag) {
        handleHourDrag(e);
        return;
      }
      const daysDelta = Math.round(pixelDelta / zoom);
      // Skip alleen als de dag-verschuiving NIET veranderd is sinds de vorige commit — niet zodra ze
      // toevallig 0 is. De oude `=== 0`-guard maakte de START-duur onbereikbaar: na een beweging
      // terug naar Δ0 werd niets gecommit, dus de balk bleef op de buur-waarde hangen en "flipte"
      // tussen de duren links/rechts van de begin-duur (bug: "ik kan 'm niet op 4 krijgen, hij
      // springt tussen 3 en 5"). Nu herstelt Δ0 netjes de originele duur.
      if (daysDelta === lastAppliedDelta) return;
      lastAppliedDelta = daysDelta;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);
      const currentTime = getTask(dragState.taskId)?.time;
      if (!currentTime) return;

      if (dragState.edge === 'body') {
        // Move entire task. Issue #21 punt 5 (review §10.3): onder compressie stelt `daysDelta`
        // GETOONDE kolommen = WERKdagen voor, niet kalenderdagen — `shiftByDisplayedColumns` schuift
        // dan via `addWorkingDaysSigned` (dezelfde werkdag-telling voor start én finish behoudt de
        // duur exact). Toggle uit ⇒ ONGEWIJZIGD `addCalendarDays`-pad (byte-identiek).
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        updateTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleStart: formatDate(newStart),
            scheduleFinish: formatDate(newFinish),
            earlyStart: formatDate(newStart),
            earlyFinish: formatDate(newFinish),
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'right') {
        // Resize from right (change duration/finish). Bereken de duur uit de rauwe sleep-datum,
        // maar schrijf een WERKDAG-anker weg (addWorkDays) i.p.v. de rauwe kalenderdag. Zo is de
        // balk tijdens het slepen al identiek aan wat runCPM produceert; earlyFinish belandt nooit
        // op een weekend/feestdag (een niet-canoniek anker verschuift bij de eerstvolgende runCPM —
        // o.a. bij bestand openen — waardoor dezelfde sleep vóór/ná een ander resultaat gaf, plus
        // een "plateau" rond een weekend-anker). Het weekend-DUURgedrag verandert niet: newDuration
        // komt nog steeds uit workDaysBetween. Issue #21 punt 5 (review §10.3): onder compressie is
        // `daysDelta` een WERKDAG-aantal getoonde kolommen — `shiftByDisplayedColumns` schuift dan
        // via `addWorkingDaysSigned` i.p.v. de rauwe kalenderdag-optelling (toggle uit: ongewijzigd).
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(origStart, newFinish));
        const canonFinish = resizeCalEngine.addWorkDays(origStart, newDuration);
        updateTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleFinish: formatDate(canonFinish),
            earlyFinish: formatDate(canonFinish),
            scheduleDuration: newDuration,
          },
        }, { coalesceKey: undoKey });
      } else if (dragState.edge === 'left') {
        // Resize from left (change start/duration). Idem als de rechterrand: schrijf een WERKDAG-
        // start weg (subtractWorkDays vanaf de vaste finish) i.p.v. de rauwe kalenderdag, zodat het
        // anker canoniek blijft (geen weekend-start, geen verschuiving bij runCPM). Issue #21 punt 5
        // (review §10.3): onder compressie is `daysDelta` een WERKDAG-aantal getoonde kolommen —
        // `shiftByDisplayedColumns` schuift dan via `addWorkingDaysSigned` (toggle uit: ongewijzigd).
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newDuration = Math.max(1, resizeCalEngine.workDaysBetween(newStart, origFinish));
        const canonStart = resizeCalEngine.subtractWorkDays(origFinish, newDuration);
        updateTask(dragState.taskId, {
          time: {
            ...currentTime,
            scheduleStart: formatDate(canonStart),
            earlyStart: formatDate(canonStart),
            scheduleDuration: newDuration,
          },
        }, { coalesceKey: undoKey });
      }
    };

    const handleMouseUp = () => {
      undoKeyRef.current = null;
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState,
    zoom,
    enableQuarterHourZoom,
    enableHourPlanning,
    calendar,
    effectiveCalById,
    compressNonWorkdays,
    getTask,
    updateTask,
    onVerticalBodyDrag,
    axis,
    canvasRef,
  ]);

  return { dragState, startBarDrag, active: !!dragState };
}
