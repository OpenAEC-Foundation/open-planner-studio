import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addElapsedMinutes, splitTotalSpanMinutes, subtractElapsedMinutes } from '@/engine/scheduler/duration';
import { toSplitPieces } from '@/engine/scheduler/splitEdit';
import type { MilestoneKind, TaskSplitGap } from '@/types/task';
import { addCalendarDays } from '@/utils/dateUtils';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';

/** De vier lopers van een uursleep: de werkblokken van de taakkalender (`CalendarEngine`), of de klok van een
 *  kalendertijdtaak (`ELAPSED_DRAG_CLOCK`). */
export type DragClock = Pick<CalendarEngine, 'nextWorkInstant' | 'addWorkMinutes' | 'subtractWorkMinutes' | 'workMinutesBetween'>;

/** Kalendertijd (ELAPSEDTIME) loopt 24/7 op de klok, net als in de motor (`addElapsedMinutes`): elke minuut
 *  telt, een dag is 1440 minuten en er is geen werkmoment om op te snappen. */
export const ELAPSED_DRAG_CLOCK: DragClock = {
  nextWorkInstant: t => new Date(t.getTime()),
  addWorkMinutes: addElapsedMinutes,
  subtractWorkMinutes: subtractElapsedMinutes,
  workMinutesBetween: (a, b) => (b.getTime() - a.getTime()) / 60_000,
};

/**
 * De splitsom van de motor (`splitTotalSpanMinutes`, F3c): `work` werk plus elke pauze die ervoor valt, in de
 * eenheid van de aanroeper (`unit` asminuten per eenheid: 1 voor werkminuten, `werktijd per dag × 60` voor
 * de dagenmaat, zoals `splitTotalSpanDays`). Zonder pauzes `work` zelf.
 */
function splitSpan(work: number, gaps: readonly TaskSplitGap[] | undefined, unit: number): number {
  if (!gaps || gaps.length === 0) return work;
  const minutes = work * unit;
  return work + (splitTotalSpanMinutes(gaps, minutes) - minutes) / unit;
}

/** Het laatste werkstuk van een gesplitste taak, in de eenheid van de aanroeper. Een randsleep maakt alleen dat
 *  stuk korter of langer: de pauzes liggen vast ten opzichte van de start (`afterMinutes`). Zonder (wélgevormde)
 *  pauzes is dat de hele duur. */
function lastWorkPiece(work: number, gaps: readonly TaskSplitGap[] | undefined, unit: number): number {
  const pieces = gaps && gaps.length > 0 ? toSplitPieces(gaps, work * unit) : null;
  return pieces ? pieces[pieces.length - 1].minutes / unit : work;
}

export interface HourBarDragInput {
  calendar: DragClock;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  originalDurationMinutes: number;
  /** De pauzes van een gesplitste taak (werkminuten op de as van de taak). Het einde komt dan uit de
   *  splitsom, zoals in de motor; een rand verandert alleen het laatste werkstuk. */
  splitGaps?: readonly TaskSplitGap[];
  /** De aspositie bij pointer-down en de actuele positie. Beide komen uit dezelfde GanttAxis. */
  pointerStart: Date;
  pointerCurrent: Date;
  /** De actieve minor-tier: dag, uur of kwartier. */
  snapMinutes: number;
}

export interface HourBarDragResult {
  start: Date;
  finish: Date;
  durationMinutes: number;
}

function snappedDeltaMs(from: Date, to: Date, snapMinutes: number): number {
  const quantumMs = Math.max(1, snapMinutes) * 60_000;
  return Math.round((to.getTime() - from.getTime()) / quantumMs) * quantumMs;
}

/**
 * Reken de nieuwe positie of omvang van een urentaak uit vanuit één gedeelde CalendarEngine.
 *
 * De Gantt-as levert uitsluitend de visuele verplaatsing. Alle domeinsemantiek — pauzes, nachten,
 * weekenden, feestdagen en uitzonderingen — blijft vervolgens bij CalendarEngine. Zo kan een
 * drag nooit een klokspan als gewerkte duur wegschrijven die CPM later anders zou interpreteren.
 */
export function resolveHourBarDrag(input: HourBarDragInput): HourBarDragResult {
  const {
    calendar,
    edge,
    originalStart,
    originalFinish,
    originalDurationMinutes,
    splitGaps,
    pointerStart,
    pointerCurrent,
    snapMinutes,
  } = input;
  const deltaMs = snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  // Verplaatsen verandert de duur nooit, ook niet als een bestaand/importbestand een taak van
  // minder dan een uur draagt. Resizen klemt wel op de fijnste beschikbare editorstap: 15 min op
  // kwartierzoom, anders het bestaande minimum van één uur.
  const durationMinutes = Math.max(1, Math.round(originalDurationMinutes));
  const minimumResizeMinutes = snapMinutes <= 15 ? 15 : 60;
  // Een gesplitste taak: de balk spant werk plus pauzes (de splitsom van de motor). Een rand verandert alleen
  // het laatste werkstuk, dat ten minste de editorstap houdt; zo blijven alle pauzes binnen de taak.
  const span = (minutes: number) => splitSpan(minutes, splitGaps, 1);
  const gapMinutes = span(durationMinutes) - durationMinutes;
  const minimumMinutes = durationMinutes - lastWorkPiece(durationMinutes, splitGaps, 1) + minimumResizeMinutes;

  if (edge === 'body') {
    const candidate = new Date(originalStart.getTime() + deltaMs);
    const start = calendar.nextWorkInstant(candidate);
    return {
      start,
      finish: calendar.addWorkMinutes(start, span(durationMinutes)),
      durationMinutes,
    };
  }

  if (edge === 'right') {
    const candidate = calendar.nextWorkInstant(new Date(originalFinish.getTime() + deltaMs));
    const nextDuration = Math.max(
      minimumMinutes,
      Math.round(calendar.workMinutesBetween(originalStart, candidate) - gapMinutes),
    );
    return {
      start: new Date(originalStart.getTime()),
      finish: calendar.addWorkMinutes(originalStart, span(nextDuration)),
      durationMinutes: nextDuration,
    };
  }

  const candidate = calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
  const nextDuration = Math.max(
    minimumMinutes,
    Math.round(calendar.workMinutesBetween(candidate, originalFinish) - gapMinutes),
  );
  return {
    start: calendar.subtractWorkMinutes(originalFinish, span(nextDuration)),
    finish: new Date(originalFinish.getTime()),
    durationMinutes: nextDuration,
  };
}

// ── De dagenmaat (alleen uren §3.12, T24; F4b) ────────────────────────────────────────────────────

export interface DayMeasureBarDragInput {
  /** De engine van de taakkalender met werkblokken (`calendarForEngine`), zoals de motor. */
  calendar: CalendarEngine;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  /** De duur in de dagenmaat bij het grijpen (`scheduleDuration`, mag een breuk zijn). */
  originalDays: number;
  /** De pauzes van een gesplitste taak (dagslots op de as van de taak, F3c). Het einde komt dan uit de
   *  splitsom, zoals in de motor (`splitTotalSpanDays`); een rand verandert alleen het laatste werkstuk. */
  splitGaps?: readonly TaskSplitGap[];
  /** Bij dagzoom: het getekende aantal werkdagen van de werkdag onder de pointer bij het grijpen naar de
   *  werkdag onder de pointer nu. Afwezig ⇒ uurzoom: dan gelden de pointerposities en de snap. */
  workdaySteps?: number;
  pointerStart: Date;
  pointerCurrent: Date;
  /** De actieve minor-tier bij uurzoom: uur of kwartier. */
  snapMinutes: number;
}

export interface DayMeasureBarDragResult {
  start: Date;
  finish: Date;
  /** De nieuwe duur in de dagenmaat (zes decimalen). */
  days: number;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Een startmoment `steps` hele werkdagen verder of eerder, op dezelfde plek in de werkdag (het deel van
 *  de werktijd van die dag, de regel van de dagenmaat). */
function shiftByWorkdays(calendar: CalendarEngine, start: Date, steps: number): Date {
  const from = calendar.nextWorkInstant(start);
  if (steps > 0) return calendar.nextWorkInstant(calendar.addMeasuredWorkdays(from, steps));
  if (steps < 0) return calendar.subtractMeasuredWorkdays(from, -steps);
  return from;
}

/**
 * De nieuwe positie of omvang van een taak in de dagenmaat (T24). Bij dagzoom per hele werkdag: de balk
 * verschuift per werkdag en houdt zijn plek in de dag; een rand maakt de taak een hele werkdag langer of
 * korter en houdt een breuk ("2,5 d" ⇒ "3,5 d"). Bij uurzoom per uur of kwartier: de rand landt op het
 * gesnapte moment en de duur wordt het aantal werkdagen met het deel van de dag ertussen
 * (`measuredWorkdaysBetween`). Het einde komt altijd uit de dagenmaat-lopers van de kalender, net als in de
 * motor (`addMeasuredWorkdays`), zodat de volgende berekening de balk niet verplaatst.
 *
 * Een gesplitste taak spant werk plus pauzes (de splitsom van de motor, `splitTotalSpanDays`): de balk houdt
 * zijn pauzes, en een rand verandert alleen het laatste werkstuk. Zo blijft de linkerrand één werkdag per
 * kolom volgen en blijft het einde staan waar het was.
 *
 * Minimum van het laatste werkstuk: bij dagzoom één werkdag (of het stuk zelf als dat korter was), bij uurzoom
 * één snapstap van een werkdag van `hoursPerDay` uur.
 */
export function resolveDayMeasureBarDrag(input: DayMeasureBarDragInput): DayMeasureBarDragResult {
  const { calendar, edge, originalStart, originalFinish, originalDays, splitGaps, workdaySteps, pointerStart, pointerCurrent, snapMinutes } = input;
  const dayZoom = workdaySteps !== undefined;
  const steps = workdaySteps ?? 0;
  const deltaMs = dayZoom ? 0 : snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  const days0 = Math.max(0, originalDays);
  const dayMinutes = Math.max(1, calendar.hoursPerDay * 60);
  const span = (days: number) => splitSpan(days, splitGaps, dayMinutes);
  const gapDays = span(days0) - days0;
  const lastPiece = lastWorkPiece(days0, splitGaps, dayMinutes);
  const minimumDays = round6(days0 - lastPiece + (dayZoom ? Math.min(1, lastPiece) : (snapMinutes <= 15 ? 15 : 60) / dayMinutes));

  if (edge === 'body') {
    const start = dayZoom
      ? shiftByWorkdays(calendar, originalStart, steps)
      : calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
    return { start, finish: calendar.addMeasuredWorkdays(start, span(days0)), days: days0 };
  }

  if (edge === 'right') {
    const start = calendar.nextWorkInstant(originalStart);
    const raw = dayZoom
      ? days0 + steps
      : calendar.measuredWorkdaysBetween(start, new Date(originalFinish.getTime() + deltaMs)) - gapDays;
    const days = round6(Math.max(minimumDays, raw));
    return { start: new Date(originalStart.getTime()), finish: calendar.addMeasuredWorkdays(start, span(days)), days };
  }

  const raw = dayZoom
    ? days0 - steps
    : calendar.measuredWorkdaysBetween(calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs)), originalFinish) - gapDays;
  const days = round6(Math.max(minimumDays, raw));
  return { start: calendar.subtractMeasuredWorkdays(originalFinish, span(days)), finish: new Date(originalFinish.getTime()), days };
}

// ── Een nulduurmijlpaal verplaatsen (issue #691) ─────────────────────────────────────────────────────

/** Werkt de taakkalender op deze kalenderdag? Met werkblokken: begint er een blok; zonder (dagmodus): de
 *  werkdagregel van de kalender. */
function worksOn(calendar: CalendarEngine, day: Date): boolean {
  return calendar.isHourMode ? calendar.effectiveBandsOn(day).length > 0 : calendar.isWorkDay(day);
}

/**
 * Landt deze mijlpaal na het slepen aan de EINDkant van een werkblok (een blokeinde), of aan de beginkant (een
 * blokbegin)? Dezelfde keuze als de motor bij F5, zodat het neergezette moment blijft staan:
 *  - soort Einde: eindkant (`snapSuccessorEarlyStart` houdt hem op een blokeinde);
 *  - een voorganger stuurt de start: beginkant, want de sleep zet een SNET, en die bewaart de motor alleen op
 *    een werkmoment;
 *  - `looseAtDayEnd` (B6, `milestoneWithoutPredecessorAtDayEnd`, zie `isLooseDayEndMilestone`): eindkant, want
 *    op een dagbegin zou de motor hem naar het dageinde zetten;
 *  - anders de kant waar hij nu staat: precies op een blokeinde (ook van een blok dat de dag ervoor begon,
 *    zoals een nachtploeg) is de eindkant.
 */
export function milestoneSitsAtFinish(
  calendar: CalendarEngine,
  original: Date,
  milestoneKind: MilestoneKind | undefined,
  drivenByPredecessor: boolean,
  looseAtDayEnd: boolean,
): boolean {
  if (milestoneKind === 'FINISH') return true;
  if (drivenByPredecessor) return false;
  if (looseAtDayEnd) return true;
  return !calendar.isWorkInstant(original) && calendar.prevWorkInstant(original).getTime() === original.getTime();
}

/** Een moment op de werktijd van de eigen kant: een blokeinde (`prevWorkInstant`, `(begin, einde]`) of een
 *  blokbegin (`nextWorkInstant`, `[begin, einde)`). */
const landOn = (calendar: CalendarEngine, t: Date, finishSide: boolean): Date =>
  finishSide ? calendar.prevWorkInstant(t) : calendar.nextWorkInstant(t);

/**
 * Een ruit verschuift bij uurzoom per snapstap, net als een balkbody (`resolveHourBarDrag`). `candidate` is de
 * datum op de getekende as waar de ruit nu zou staan (anker plus de pointerverschuiving in pixels). Zo telt een
 * mijlpaal op een verborgen vrije dag vanaf zijn getekende plek, niet vanaf het verborgen moment. Er komt nooit
 * een duur bij: begin en einde blijven hetzelfde moment.
 */
export function resolveMilestoneHourDrag(input: {
  calendar: CalendarEngine;
  original: Date;
  finishSide: boolean;
  candidate: Date;
  snapMinutes: number;
}): Date {
  const { calendar, original, finishSide, candidate, snapMinutes } = input;
  const deltaMs = snappedDeltaMs(original, candidate, snapMinutes);
  if (deltaMs === 0) return new Date(original.getTime());
  return landOn(calendar, new Date(original.getTime() + deltaMs), finishSide);
}

/**
 * Een ruit verschuift bij dagzoom per werkdag, net als een balkbody (`resolveDayMeasureBarDrag`). `workdaySteps`
 * telt de werkdagen van de taakkalender vanaf de werkdag van de mijlpaal (`dragWorkdaySteps`, ook onder
 * compressie en met een vrije doeldag naar de eerstvolgende werkdag in de sleeprichting). De werkdag van de
 * mijlpaal is die van zijn kant (`workdayDateOfInstant`): een eindmoment om 06:00 na een nachtploeg hoort bij
 * de dag ervoor.
 *
 * De plek in de werkdag: stond de mijlpaal op een blokgrens, dan op het einde of het begin van de nieuwe werkdag
 * (de eigen kant, ook op een kortere dag). Anders houdt hij zijn afstand tot het begin van de werkdag.
 */
export function resolveMilestoneDayDrag(input: {
  calendar: CalendarEngine;
  original: Date;
  finishSide: boolean;
  workdaySteps: number;
}): Date {
  const { calendar, original, finishSide, workdaySteps } = input;
  if (workdaySteps === 0) return new Date(original.getTime());
  const from = workdayDateOfInstant(calendar, original, finishSide ? 'end' : 'start');
  const direction = Math.sign(workdaySteps);
  let day = from;
  for (let left = Math.abs(workdaySteps), i = 0; left > 0 && i < 3660; i++) {
    day = addCalendarDays(day, direction);
    if (worksOn(calendar, day)) left--;
  }
  const offset = (original.getTime() - from.getTime()) / 60_000;
  const bands = calendar.effectiveBandsOn(day);
  if (bands.length === 0) return new Date(day.getTime() + offset * 60_000);
  const fromBands = calendar.effectiveBandsOn(from);
  const onBoundary = fromBands.length === 0 || fromBands.some(band => band.start === offset || band.end === offset);
  const target = onBoundary ? (finishSide ? bands[bands.length - 1].end : bands[0].start) : offset;
  return landOn(calendar, new Date(day.getTime() + target * 60_000), finishSide);
}

/**
 * Het moment dat de sleep wegschrijft (begin, einde en anker). Meestal `at` zelf.
 *
 * Eén uitzondering: een losse mijlpaal onder B6 (`isLooseDayEndMilestone`) op een dageinde dat ook een blokbegin
 * is (24/7: middernacht). Als anker leest de motor dat als dagbegin, en B6 zet hem dan een dag verder. Zo'n
 * moment kan de motor voor deze mijlpaal niet bewaren; de ruit landt daarom één snapstap later, of op het
 * einde van het blok als dat korter is. Dat moment ligt ná elke ondergrens die vóór het doel lag, dus F5
 * laat het staan.
 */
export function milestoneDragLanding(calendar: CalendarEngine, at: Date, looseAtDayEnd: boolean, stepMinutes: number): Date {
  if (!looseAtDayEnd || !calendar.isWorkInstant(at)) return at;
  const workday = workdayDateOfInstant(calendar, at, 'end');
  const bands = calendar.effectiveBandsOn(workday);
  if (bands.length === 0 || workday.getTime() + bands[bands.length - 1].end * 60_000 !== at.getTime()) return at;
  const later = new Date(at.getTime() + stepMinutes * 60_000);
  return calendar.isWorkInstant(later) ? later : calendar.prevWorkInstant(later);
}
