import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate, parseInstant, formatDate, formatInstant } from '@/utils/dateUtils';
import { isCompressedEffective } from '@/engine/renderer/workdayAxis';
import { shiftByDisplayedColumns } from '@/engine/renderer/barDragMath';
import {
  ELAPSED_DRAG_CLOCK, milestoneSitsAtFinish, resolveDayMeasureBarDrag, resolveHourBarDrag, resolveMilestoneDayDrag,
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
import { finishIsActual, startIsActual, shownStart } from '@/utils/taskDates';
import { BASELINES_PROGRESS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { refusalNotice } from '@/state/refusalNotice';

// Monotone teller: geeft élk sleep-gebaar een UNIEKE coalesce-key (`bardrag:<taskId>:<n>`). Zo vloeit
// een reeks per-mousemove `updateTask`-commits samen tot ÉÉN undo-stap, terwijl twee opeenvolgende
// sleeps nooit samenvloeien — ook niet binnen dezelfde milliseconde (de teller loopt altijd door).
let dragSeq = 0;
// Idem voor een stuk-/stukrandsleep op een gesplitste balk (`splitdrag:<taskId>:<n>`).
let splitDragSeq = 0;

/** Wat bij de START van een stuk-/stukrandsleep bevroren wordt. Elke mousemove
 *  rekent vanaf `pieces0`, niet vanaf de vorige move — anders maakt terugslepen niets ongedaan. */
export interface SplitDragContext {
  /** `gap` = de body van stuk i>0 verslepen (de pauze ervóór), `work` = de rechterrand van stuk i. */
  kind: 'gap' | 'work';
  /** Pauze-index (`gap`) of werkstuk-index (`work`) in de stukkenlijst. */
  index: number;
  pieces0: SplitPiece[];
  /** De lengte van het bewerkte stuk in `pieces0`, in werkminuten. */
  baseMinutes: number;
  unitMinutes: number;
  minimumMinutes: number;
  pieceStart: Date;
  dayZoom: boolean;
  /** Gesnapte pointerdatum bij de start. */
  anchorDate: Date;
  eng: CalendarEngine;
  cal: WorkCalendar;
  /** De as van de taak: werkminuten, dagslots (de dagenmaat) of hele werkdagen (alleen datums). Zie
   *  `SplitAxisKind` in `useSplitGesture.ts`; dezelfde keuze als de Gantt-stukken (`taskSplitMeasure`). */
  axisKind: 'minutes' | 'dagslots' | 'days';
  /** Een urentaak: het label telt bij uurzoom uren. */
  hoursUnit: boolean;
  coalesceKey: string;
}

/**
 * Gantt-slepen volgt dezelfde startregel als typen: wat bij de START van een
 * gebaar dat de start verzet (body verschuiven, linkerrand) over de startregel vastligt. Elke
 * muisbeweging rekent vanaf `original`, zodat terugslepen de oorspronkelijke constraint herstelt en
 * de melding na loslaten over het netto-resultaat gaat.
 */
interface StartRuleGesture {
  original: Task;
  /** Bepaalt een voorganger de start (en geldt de startregel dus)? */
  driven: boolean;
  /** Houdt een andere constraint de start tegen? Dan verschuift er niets. */
  blocking?: TaskConstraint;
  /** Ooit geprobeerd de tegengehouden start te verzetten (voor de melding na loslaten). */
  blockedTried: boolean;
  /** De SNET die de laatst toegepaste beweging zette, of niets. */
  snet?: StartConstraintEdit;
}

/**
 * Werkelijke datums verschuiven niet (eigenaarsbesluit 2026-10-12): van een VOLTOOIDE taak staan
 * begin en einde vast, van een GESTARTE taak de start (`finishIsActual`/`startIsActual`). De
 * coördinator maakt van zo'n rand al body (`dragHit`); een horizontale sleep van die body doet dan
 * niets — geen datum, geen anker, geen constraint — en na het loslaten volgt één melding. Verticaal
 * blijft de rijsleep gewoon werken.
 */
interface ActualDatesLock {
  taskId: string;
  name: string;
  kind: 'start' | 'finish';
  /** Ooit horizontaal geprobeerd (voor de melding na loslaten). */
  tried: boolean;
}

/** Het sleeplabel van een stuk-/stukrandsleep (DOM, zie `GanttCanvas`), in canvascoördinaten. */
export interface SplitDragLabel {
  x: number;
  top: number;
  kind: 'gap' | 'work';
  /** Nieuwe lengte in EENHEDEN (werkdagen, of uren bij een uur-taak). 0 = pauze opgeheven. */
  units: number;
  hourMode: boolean;
}

/**
 * De stukkenlijst waarop een stuk-sleep mag rekenen, of `null` wanneer de gesplitste balk als ÉÉN
 * balk moet slepen: de taak is niet splitsbaar (`canSplitTask`, o.a. een niet-wélgevormde
 * importsplit — alleen-lezen), of de renderer tekende een ander aantal stukken dan de
 * stukkenlijst telt (een pauze korter dan een halve werkdag is in dag-modus onzichtbaar; een
 * stuk-index zou dan naar het verkeerde werkstuk wijzen). Eén bron voor coördinator en sleep.
 */
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
  /** Originele `durationMinutes` bij drag-start (uur-taken); undefined = dag-taak. */
  originalDurationMinutes?: number;
  /** Gantt-aspositie bij pointer-down; de volgende muisbewegingen worden hiertegen afgezet. */
  pointerStart?: Date;
  /** Op welk stuk van een gesplitste balk het gebaar begon (0 van 1 = een
   *  ongesplitste balk, of een gesplitste die als geheel sleept). */
  segmentIndex?: number;
  segmentCount?: number;
  /** Gezet door `startBarDrag` wanneer dit een stuk- of stukrandsleep is; anders ongedefinieerd en
   *  loopt het gebaar over de gewone body/rand-takken. */
  split?: SplitDragContext;
}

interface UseBarDragOptions {
  zoom: number;
  enableQuarterHourZoom: boolean;
  calendar: WorkCalendar;
  effectiveCalById: Map<string, WorkCalendar>;
  /** Dezelfde vlag als `GanttCanvas`/`resolveGanttAxis` — bepaalt
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
  /** De ENE schrijfweg voor gebruikerssplits. Zonder deze naad (tests) sleept een gesplitste
   *  balk als geheel. */
  setTaskSplits?: (taskId: string, pieces: SplitPiece[] | null, opts?: { coalesceKey?: string }) => unknown;
  /** Bovenkant van de getekende balk in canvascoördinaten, voor het sleeplabel. */
  barTopOf?: (taskId: string) => number | null;
  /** Bepaalt een voorganger de start van deze taak (`predecessorDrivenTaskIds`)? Dan volgt
   *  een gesleepte start dezelfde regel als een getypte (`constraintForDraggedStart`,
   *  `constraintBlockingStart`). Afwezig ⇒ nooit. */
  isStartDrivenByPredecessor?: (taskId: string) => boolean;
  /** Zet de motor deze mijlpaal op het dageinde (B6, `isLooseDayEndMilestone`)? Afwezig ⇒ nooit. */
  isLooseDayEndMilestone?: (taskId: string) => boolean;
  /** Het ene meldkanaal en de datumnotatie voor de startmelding na het loslaten. */
  notify?: (notification: NotifyInput) => void;
  dateNotation?: DateNotation;
  timeNotation?: TimeNotation;
  /** Telt het rekenprofiel een dagenmaat in werkdagen (conventie `workdayDurationMeasure`)? Kiest de as van
   *  een stuksleep en de rekenwijze van een dagtaak (dagenmaat of uren). Afwezig ⇒ aan (OPS-profiel). */
  workdayDurationMeasure?: boolean;
}

// Balk-sleep (resize links/rechts + verplaatsen), dag- én uur-taken. Bezit zijn eigen `dragState`
// en window-listeners; het centrale mousedown-hittest roept `startBarDrag(...)` aan. Drie regels:
//   1. duur = INCLUSIEVE werkdagen-telling via de taakkalender (workDaysBetween), zoals CPMSolver;
//   2. de mousemove-guard skipt alleen als `daysDelta` ONgewijzigd is sinds de vorige commit
//      (lastAppliedDelta, init 0) — niet zodra 'ie 0 is — zodat terug-naar-Δ0 de begin-duur herstelt;
//   3. het balk-anker wordt gecanonaliseerd naar een werkdag (addWorkDays/subtractWorkDays) zodat
//      earlyStart/earlyFinish nooit op een weekend landen en niet verschuiven bij de volgende runCPM.
// Onder werkdagen-as-compressie (`compressNonWorkdays`) stelt een
// GETOONDE kolom een WERKDAG voor i.p.v. een kalenderdag — de dag-modus-branches (body/left/right,
// hieronder) vertalen `daysDelta` daarom via `shiftByDisplayedColumns` (`addWorkingDaysSigned` i.p.v.
// `addCalendarDays`). Toggle uit ⇒ ongewijzigd. De UUR-tak leest de gedeelde Gantt-as terug en laat
// daarna CalendarEngine de werkminuten/werkbanden bepalen, dus een naad onder werkdagencompressie
// volgt precies wat de gebruiker op de as zag.
//
// Op een GESPLITSTE balk zijn er twee extra takken, vóór de gewone. De body
// van stuk i>0 verslepen stelt de pauze ervóór bij (`setGapLength`; tegen het vorige stuk aan =
// samenvoegen), de rechterrand van stuk i zet de lengte van dát stuk (`setWorkLength`, ook voor het
// laatste stuk: de duur verandert mee). Beide rekenen via `splitEdit.ts` vanaf een bevroren
// `pieces0` en committen per mousemove via `setTaskSplits` met één coalesce-key per gebaar. Stuk 0
// (body en linkerrand) en elke ongesplitste balk lopen over de gewone code hieronder.
export function useBarDrag({
  zoom, enableQuarterHourZoom, calendar, effectiveCalById, compressNonWorkdays, getTask,
  updateTask, onVerticalBodyDrag, axis, canvasRef, setTaskSplits, barTopOf, isStartDrivenByPredecessor, isLooseDayEndMilestone,
  notify, dateNotation = 'dmy', timeNotation = '24h', workdayDurationMeasure = true,
}: UseBarDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [splitLabel, setSplitLabel] = useState<SplitDragLabel | null>(null);
  // De kaart met effectieve taakkalenders verandert ook wanneer een live drag de taak muteert. Het
  // effect wordt dan terecht met actuele kalenderinvoer herstart, maar dat mag geen nieuw
  // coalesce-venster openen: één pointergesture blijft exact één undoable handeling.
  const undoKeyRef = useRef<string | null>(null);
  // Deze twee horen bij het GEBAAR, niet bij de effect-instantie (dus refs, geen `let` in de
  // effect-body), om dezelfde reden als `undoKeyRef` hierboven: het effect herstart tijdens een
  // lopende sleep (o.a. omdat `effectiveCalById` na elke gecommitte `updateTask` een nieuwe
  // identiteit krijgt). Een closure-variabele zou dan terugvallen op zijn beginwaarde; voor
  // `direction` betekent dat een tweede richtingskeuze halverwege het gebaar — een diagonale sleep
  // verzet dan éérst datums en dáárna de structuur, twee mutaties en twee undo-stappen.
  const directionRef = useRef<'undecided' | 'horizontal'>('undecided');
  // Laatst toegepaste dag-verschuiving. Init op 0 = de begintoestand (geen no-op-update bij het
  // grijpen), maar terugkeren naar Δ0 ná een beweging herstelt de originele duur weer (zie de guard
  // in `handleMouseMove`). Ook deze mag een effectherstart niet resetten, anders wordt dezelfde
  // verschuiving na de herstart nog een keer gecommit.
  const lastAppliedDeltaRef = useRef(0);
  // De startregel van dit gebaar (zie `StartRuleGesture`). Net als de refs hierboven hoort hij bij
  // het GEBAAR: een effectherstart halverwege mag hem niet resetten.
  const startRuleRef = useRef<StartRuleGesture | null>(null);
  // Werkelijke datums van dit gebaar (zie `ActualDatesLock`); hoort net zo bij het GEBAAR.
  const actualLockRef = useRef<ActualDatesLock | null>(null);
  /** De landingskant van een gesleepte nulduurmijlpaal (`milestoneSitsAtFinish`), bij pointer-down vastgelegd:
   *  hij wisselt niet midden in het gebaar en overleeft een effectherstart. `null` ⇒ geen mijlpaal. */
  const milestoneFinishSideRef = useRef<boolean | null>(null);
  const hourSnapMinutes = hourSnapMinutesFor(zoom, enableQuarterHourZoom);
  const snapAt = useCallback(
    (x: number, hourMode: boolean) => snapTimelineDate(axis, x, hourMode, hourSnapMinutes),
    [axis, hourSnapMinutes],
  );

  /** Bouwt de bevroren stuk-sleepcontext, of `undefined` = bestaande sleep. */
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
    // T24: bij dagzoom valt de pointer op het begin van de werkdag onder de muis, voor elke taak met
    // momenten (een urentaak sinds F4a, een dagtaak sinds F4b).
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
    // T24 stap 2: een pauze is ten minste één werkdag, een werkstuk loopt ten minste tot de volgende
    // werkdaggrens; bij uurzoom één snapstap.
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
    // Een voltooide balk heeft geen stukgrepen: zijn pauzes liggen in het verleden.
    const split = completed ? undefined : prepareSplitDrag(next, rect ? next.startX - rect.left : null);
    actualLockRef.current = original && (completed || (!split && next.edge !== 'right' && startIsActual(original)))
      ? { taskId: original.id, name: original.name, kind: completed ? 'finish' : 'start', tried: false }
      : null;
    undoKeyRef.current = split ? split.coalesceKey : `bardrag:${next.taskId}:${++dragSeq}`;
    // Alleen body en linkerrand verzetten de start; een stuksleep en de rechterrand niet.
    const driven = !split && next.edge !== 'right' && !!original && !actualLockRef.current
      && (isStartDrivenByPredecessor?.(next.taskId) ?? false);
    startRuleRef.current = original && driven
      ? { original, driven, blocking: constraintBlockingStart(original, driven), blockedTried: false }
      : null;
    // Eén gebaar = één richtingskeuze. Alleen hier resetten.
    directionRef.current = 'undecided';
    lastAppliedDeltaRef.current = 0;
    setSplitLabel(null);
    milestoneFinishSideRef.current = original && isZeroDurationMilestone(original)
      ? milestoneSitsAtFinish(
        new CalendarEngine(calendarForEngine(effectiveCalById.get(original.id) ?? calendar)),
        parseInstant(next.originalStart), original.milestoneKind, driven,
        isLooseDayEndMilestone?.(original.id) ?? false,
      )
      : null;
    setDragState({ ...next, pointerStart, split });
  }, [axis, canvasRef, prepareSplitDrag, getTask, isStartDrivenByPredecessor, isLooseDayEndMilestone, effectiveCalById, calendar]);

  // Automatisch berekenen wacht tot de sleep af is: elke mousemove commit, en een CPM-run midden in
  // het gebaar laat de balk onder de muis verspringen. Het effect laat ook los bij een afgebroken
  // gebaar of unmount.
  const dragging = dragState !== null;
  useEffect(() => (dragging ? holdAutoCalc() : undefined), [dragging]);

  // Drag and drop: mousemove (via native event for performance)
  useEffect(() => {
    if (!dragState) return;

    // De key is bij pointer-down geleased en blijft ook bij een effectherstart dezelfde. `++dragSeq`
    // in `startBarDrag` garandeert dat een volgende sleep nooit met deze kan samenvloeien.
    const undoKey = undoKeyRef.current;
    if (!undoKey) return;

    // Sinds F2 heeft ook een dagtaak momenten. De maat van de taak bepaalt hoe een sleep rekent:
    //  - `hours`: een urentaak, in werkminuten (`resolveHourBarDrag`, F4a);
    //  - `dayMeasure`: een dagtaak in een profiel met de dagenmaat, in werkdagen met een breuk
    //    (`resolveDayMeasureBarDrag`, F4b; T24: bij dagzoom per werkdag, bij uurzoom per uur);
    //  - `daysAsHours`: een dagtaak onder P6/MSP, waar "d" de urenmaat is: dezelfde sleep als een
    //    urentaak, en de duur gaat terug als dagen × werktijd per dag;
    //  - `days`: een taak met alleen datums (van vóór het minutenmodel), in hele werkdagen.
    // Kalendertijd (ELAPSEDTIME) telt nooit in de dagenmaat (`taskCountsInWorkdays`) en loopt dus via de
    // uursleep, maar dan op de klok (`ELAPSED_DRAG_CLOCK`, 1440 minuten per dag), zoals de motor.
    const draggedTask = getTask(dragState.taskId);
    if (!draggedTask) return;
    const hasInstants = dragState.originalStart.includes('T') && dragState.originalFinish.includes('T');
    const dragKind: 'hours' | 'dayMeasure' | 'daysAsHours' | 'days' = taskDurationUnit(draggedTask) === 'hours' ? 'hours'
      : !hasInstants ? 'days'
        : taskCountsInWorkdays(draggedTask, { workdayDurationMeasure }) ? 'dayMeasure' : 'daysAsHours';
    const elapsed = isElapsedTask(draggedTask);
    // De pauzes van een gesplitste balk die als geheel sleept (stuk 0: body en linkerrand): het einde komt uit
    // de splitsom, zoals in de motor. Elke sleepcommit wist nivelleerpauzes (`clearLevelingGaps` via
    // `taskTriggerChanges`), dus die tellen niet mee; kalendertijd kent geen pauzes.
    const splitGaps = elapsed ? undefined : draggedTask.splitGaps?.filter(g => g.source !== 'leveling');

    // Dag-resize: de nieuwe duur is de INCLUSIEVE werkdagen-telling via de taakkalender — exact
    // zoals CPM zelf rekent (CPMSolver: `scheduleDuration = cal.workDaysBetween(es, ef)`). Zo blijft
    // een resize-sleep staan ná de eerstvolgende runCPM en tellen weekend/feestdagen niet als duur
    // mee (een exclusieve kalenderdagtelling geeft één werkdag te weinig en telt za/zo mee).
    const resizeCalEngine = new CalendarEngine(effectiveCalById.get(dragState.taskId) ?? calendar);
    // De kolom→datum-vertaling voor het SLEEP-gebaar zelf moet de
    // PROJECTkalender volgen — dat is dezelfde kalender waarmee `GanttCanvas` de gedeelde
    // (mogelijk gecomprimeerde) as bouwt (`resolveGanttAxis({ calendar, ... })`), dus 1 getoonde
    // kolom = 1 werkdag van DIE kalender, ongeacht of deze taak een eigen kalender heeft. Duur-
    // berekening (workDaysBetween/addWorkDays/subtractWorkDays hieronder) blijft op de
    // taak-specifieke `resizeCalEngine` leunen — dat is een apart vraagstuk (hoeveel werkdagen
    // past de taak-kalender in het gesleepte bereik).
    const axisCalEngine = new CalendarEngine(calendar);
    const compressed = isCompressedEffective(axisCalEngine, compressNonWorkdays);
    // De zoom bepaalt de kloksnap: hele dagen onder 400, daarna uren of kwartieren.
    // De taak behoudt haar eigen werkminuten.
    const quantumMin = hourSnapMinutesFor(zoom, enableQuarterHourZoom);

    // De constraint bij een gesleepte start `start` (dezelfde regel als typen): een SNET, of — terug
    // op de oorspronkelijke start — weer de oorspronkelijke constraint. Leeg zonder startregel: dan
    // raakt de sleep de constraint niet.
    const constraintForStart = (start: string): Partial<Task> => {
      const rule = startRuleRef.current;
      if (!rule) return {};
      const hadSnet = rule.snet !== undefined;
      rule.snet = constraintForDraggedStart(rule.original, start, rule.driven);
      if (rule.snet) return { constraint: rule.snet.constraint };
      return hadSnet ? { constraint: rule.original.constraint } : {};
    };
    // Houdt een andere constraint de start tegen? Dan past deze beweging niets toe (ook geen dood
    // anker); na het loslaten volgt één melding.
    const startBlocked = (moved: boolean): boolean => {
      const rule = startRuleRef.current;
      if (!rule?.blocking) return false;
      if (moved) rule.blockedTried = true;
      return true;
    };

    // Een nulduurmijlpaal (ruit) heeft alleen een body (`getTaskBarBounds`, issue #691): hij verschuift en
    // houdt duur 0. Met momenten rekent hij op zijn eigen moment (`resolveMilestone…Drag`); een mijlpaal met
    // alleen datums loopt via de dagsleep hieronder, die begin en einde gelijk verschuift.
    const milestone = isZeroDurationMilestone(draggedTask) && hasInstants;
    const handleMilestoneDrag = (event: MouseEvent) => {
      const baseTime = getTask(dragState.taskId)?.time;
      if (!baseTime) return;
      const cal = effectiveCalById.get(dragState.taskId) ?? calendar;
      const engine = new CalendarEngine(calendarForEngine(cal));
      const original = parseInstant(dragState.originalStart);
      const finishSide = milestoneFinishSideRef.current === true;
      const pixelDelta = event.clientX - dragState.startX;
      // Onder compressie staat een mijlpaal op een verborgen vrije dag op de naad: het einde van de werkdag
      // ervoor of het begin van die erna, naar zijn kant. Daar begint het tellen van de kolommen.
      const dayAnchor = compressed && !axisCalEngine.isWorkDay(original)
        ? (finishSide ? engine.prevWorkInstant(original) : engine.nextWorkInstant(original))
        : original;
      const workdaySteps = quantumMin === 1440
        ? dragWorkdaySteps(dayAnchor, finishSide ? 'end' : 'start', Math.round(pixelDelta / zoom), axisCalEngine, compressed, engine, cal)
        : 0;
      const at = quantumMin === 1440
        ? (workdaySteps === 0 ? original : resolveMilestoneDayDrag({ calendar: engine, original: dayAnchor, finishSide, workdaySteps }))
        // De plek op de getekende as: het anker plus de pixelverschuiving. Zo telt ook een mijlpaal op een
        // verborgen vrije dag (compressie) vanaf de naad waar hij staat.
        : pixelDelta === 0 ? original : resolveMilestoneHourDrag({
          calendar: engine,
          original,
          finishSide,
          candidate: axis.xToDate(axis.dateToX(original) + pixelDelta),
          snapMinutes: quantumMin,
        });
      const next = formatInstant(at, 'hour');
      if (startBlocked(next !== dragState.originalStart)) return;
      if (baseTime.scheduleStart === next && baseTime.scheduleFinish === next
        && baseTime.earlyStart === next && baseTime.earlyFinish === next) return;
      updateTask(dragState.taskId, {
        time: {
          ...baseTime,
          scheduleStart: next,
          scheduleFinish: next,
          earlyStart: next,
          earlyFinish: next,
        },
        ...constraintForStart(next),
      }, { coalesceKey: undoKey });
    };

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
      // Volg dezelfde kalenderfabriek (`calendarForEngine`) als de scheduler en resourceberekeningen: expliciete banden
      // (inclusief pauzes) winnen, maar een oudere/zuiver dag-granulaire kalender blijft bruikbaar. Kalendertijd
      // rekent op de klok: klokverschillen, een dag van 1440 minuten, geen snap naar een werkmoment.
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
      // Onder P6/MSP is "d" de urenmaat: de werkminuten gaan terug als dagen × werktijd per dag, met zes
      // decimalen zoals de opslag. Een kalendertijdtaak in dagen: klokminuten ÷ 1440.
      const duration = daysAsHours
        ? { scheduleDuration: Math.round((result.durationMinutes / dayMinutes) * 1e6) / 1e6 }
        : { durationMinutes: result.durationMinutes };
      if (dragState.edge !== 'right' && startBlocked(nextStart !== dragState.originalStart)) return;
      if (baseTime.scheduleStart === nextStart && baseTime.scheduleFinish === nextFinish
        && (daysAsHours ? baseTime.scheduleDuration === duration.scheduleDuration : baseTime.durationMinutes === result.durationMinutes)) return;
      updateTask(dragState.taskId, {
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

    /** Een dagtaak in de dagenmaat (F4b, T24): bij dagzoom per hele werkdag van de taakkalender, bij uurzoom
     *  per uur of kwartier; de duur blijft een aantal werkdagen, met een breuk. */
    const handleDayMeasureDrag = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect || !dragState.pointerStart) return;
      const pointerCurrent = axis.xToDate(event.clientX - rect.left);
      const baseTime = getTask(dragState.taskId)?.time;
      if (!baseTime) return;
      const cal = effectiveCalById.get(dragState.taskId) ?? calendar;
      const engine = new CalendarEngine(calendarForEngine(cal));
      // Bij dagzoom per getoonde kolom: de kolommen tellen op de getekende as (projectkalender, ook onder
      // compressie), daarna de hele werkdagen van de taakkalender vanaf de werkdag van de gegrepen rand, met
      // een vrije doeldag als de eerstvolgende werkdag in de sleeprichting (`dragWorkdaySteps`).
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
      updateTask(dragState.taskId, {
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

    /** Stuk- of stukrandsleep. Geen richtingskeuze: alleen stuk 0 draagt de
     *  verticale rijsleep, zoals een ongesplitste balk. */
    const handleSplitDrag = (e: MouseEvent, split: SplitDragContext) => {
      const canvas = canvasRef.current;
      if (!canvas || !setTaskSplits) return;
      const x = e.clientX - canvas.getBoundingClientRect().left;
      const at = split.dayZoom ? splitWorkdayStart(axis.xToDate(x), split.eng, split.cal) : snapAt(x, split.axisKind !== 'days');
      if (!at) return;
      // Getekende afstand tussen het grijppunt en de dag onder de muis op de as van de taak, met teken:
      // naar links negatief. `workAxisMinutesBetween` is half-open en telt alleen vooruit.
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
      setTaskSplits(dragState.taskId, result.pieces, { coalesceKey: undoKey });
      // Het label leest de nieuwe lengte terug uit de UITKOMST (dus gesnapt en geklemd), niet uit de
      // ruwe muisafstand. Een samengevoegde pauze bestaat niet meer ⇒ 0.
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
      // De balkbody heeft twee betekenisvolle richtingen. Kies ÉÉNMAAL per gebaar, na dezelfde korte
      // drempel als de rijsleep, zodat een diagonale beweging nooit zowel datum als structuur
      // verandert. Randen zijn bewust altijd horizontale duur-grepen. De keuze staat in een ref
      // (zie `directionRef`) en overleeft daarom een effectherstart midden in de sleep.
      if (dragState.edge === 'body' && directionRef.current === 'undecided') {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < ROW_DRAG_THRESHOLD) return;
        if (Math.abs(deltaY) > Math.abs(deltaX) && onVerticalBodyDrag) {
          // Delegatie vóór elke updateTask-aanroep: verticale verplaatsing verandert nooit datums
          // en blijft één undo-stap via de rijsleep → moveTaskTo/moveTasksTo. De ontvanger beslist
          // zelf of de structuur bewerkbaar is (`useTableRowDrag`'s `enabled`/`onBlocked`).
          onVerticalBodyDrag({
            taskId: dragState.taskId,
            startClientX: dragState.startX,
            startClientY: dragState.startY,
          });
          undoKeyRef.current = null;
          startRuleRef.current = null;
          actualLockRef.current = null;
          setDragState(null);
          return;
        }
        // Zonder ontvanger (geen ingebedde taakgrid) bestaat het verticale gebaar niet en blijft de
        // body een gewone datumsleep. Het gebaar hier afbreken zou de balk
        // stil doodleggen tot mouseup.
        directionRef.current = 'horizontal';
      }
      const pixelDelta = e.clientX - dragState.startX;
      // Werkelijke datums: horizontaal verschuift er niets (zie `ActualDatesLock`).
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
      // Skip alleen als de dag-verschuiving NIET veranderd is sinds de vorige commit — niet zodra ze
      // toevallig 0 is: een `=== 0`-guard maakt de START-duur onbereikbaar (na een beweging terug
      // naar Δ0 wordt niets gecommit en blijft de balk op de buur-waarde hangen). Zo herstelt Δ0 de
      // originele duur.
      if (daysDelta === lastAppliedDeltaRef.current) return;
      lastAppliedDeltaRef.current = daysDelta;

      const origStart = parseDate(dragState.originalStart);
      const origFinish = parseDate(dragState.originalFinish);
      const currentTime = getTask(dragState.taskId)?.time;
      if (!currentTime) return;

      if (dragState.edge !== 'right' && startBlocked(daysDelta !== 0)) return;

      if (dragState.edge === 'body') {
        // Move entire task. Onder compressie stelt `daysDelta`
        // GETOONDE kolommen = WERKdagen voor, niet kalenderdagen — `shiftByDisplayedColumns` schuift
        // dan via `addWorkingDaysSigned` (dezelfde werkdag-telling voor start én finish behoudt de
        // duur exact). Toggle uit ⇒ `addCalendarDays`.
        const newStart = shiftByDisplayedColumns(axisCalEngine, origStart, daysDelta, compressed);
        const newFinish = shiftByDisplayedColumns(axisCalEngine, origFinish, daysDelta, compressed);
        // Een dagsleep bewaart een bestaand moment binnen de werkdag (N0).
        const start = `${formatDate(newStart)}${dragState.originalStart.slice(10)}`;
        const finish = `${formatDate(newFinish)}${dragState.originalFinish.slice(10)}`;
        updateTask(dragState.taskId, {
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
        // Resize from right (change duration/finish). Bereken de duur uit de rauwe sleep-datum,
        // maar schrijf een WERKDAG-anker weg (addWorkDays) i.p.v. de rauwe kalenderdag. Zo is de
        // balk tijdens het slepen al identiek aan wat runCPM produceert; earlyFinish belandt nooit
        // op een weekend/feestdag (een niet-canoniek anker verschuift bij de eerstvolgende runCPM —
        // o.a. bij bestand openen — en geeft een "plateau" rond een weekend-anker). newDuration
        // komt uit workDaysBetween. Onder compressie is
        // `daysDelta` een WERKDAG-aantal getoonde kolommen — `shiftByDisplayedColumns` schuift dan
        // via `addWorkingDaysSigned` i.p.v. de rauwe kalenderdag-optelling (toggle uit: kalenderdagen).
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
        // anker canoniek blijft (geen weekend-start, geen verschuiving bij runCPM). Onder compressie
        // is `daysDelta` een WERKDAG-aantal getoonde kolommen — `shiftByDisplayedColumns` schuift dan
        // via `addWorkingDaysSigned` (toggle uit: kalenderdagen).
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
          ...constraintForStart(formatDate(canonStart)),
        }, { coalesceKey: undoKey });
      }
    };

    const handleMouseUp = () => {
      undoKeyRef.current = null;
      const lock = actualLockRef.current;
      actualLockRef.current = null;
      if (lock?.tried && notify) {
        notify(refusalNotice({
          messageKey: lock.kind === 'finish' ? 'notifications.dragDatesAreActual' : 'notifications.dragStartIsActual',
          params: { name: lock.name },
          // Tien keer slepen aan dezelfde balk = één regel met een teller.
          dedupeKey: `drag-actual:${lock.kind}:${lock.taskId}`,
          helpArticleId: BASELINES_PROGRESS_HELP_ARTICLE_ID,
        }));
      }
      // Eén melding per gebaar, over het netto-resultaat: de gezette SNET, of de constraint die de
      // start tegenhield. Dezelfde meldingen als bij typen (`startEditNotifications`).
      const rule = startRuleRef.current;
      startRuleRef.current = null;
      if (rule && notify) {
        const notices: StartEditNotice[] = rule.blocking
          ? (rule.blockedTried ? [{ kind: 'blocked', name: rule.original.name, constraint: rule.blocking, taskId: rule.original.id }] : [])
          : rule.snet?.constraint.date
            ? [{ kind: 'snet', name: rule.original.name, date: rule.snet.constraint.date, change: rule.snet.change }]
            : [];
        notifyStartEdit(notify, notices, dateNotation, timeNotation);
      }
      setSplitLabel(null);
      setDragState(null);
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp });
  }, [
    dragState,
    zoom,
    enableQuarterHourZoom,

    calendar,
    effectiveCalById,
    compressNonWorkdays,
    getTask,
    updateTask,
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
