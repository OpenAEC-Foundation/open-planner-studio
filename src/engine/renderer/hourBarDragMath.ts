import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';

export interface HourBarDragInput {
  calendar: CalendarEngine;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  originalDurationMinutes: number;
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

  if (edge === 'body') {
    const candidate = new Date(originalStart.getTime() + deltaMs);
    const start = calendar.nextWorkInstant(candidate);
    return {
      start,
      finish: calendar.addWorkMinutes(start, durationMinutes),
      durationMinutes,
    };
  }

  if (edge === 'right') {
    const candidate = calendar.nextWorkInstant(new Date(originalFinish.getTime() + deltaMs));
    const nextDuration = Math.max(
      minimumResizeMinutes,
      Math.round(calendar.workMinutesBetween(originalStart, candidate)),
    );
    return {
      start: new Date(originalStart.getTime()),
      finish: calendar.addWorkMinutes(originalStart, nextDuration),
      durationMinutes: nextDuration,
    };
  }

  const candidate = calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
  const nextDuration = Math.max(
    minimumResizeMinutes,
    Math.round(calendar.workMinutesBetween(candidate, originalFinish)),
  );
  return {
    start: calendar.subtractWorkMinutes(originalFinish, nextDuration),
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
 * Minimum: bij dagzoom één werkdag (of de duur zelf als die korter was), bij uurzoom één snapstap van een
 * werkdag van `hoursPerDay` uur.
 */
export function resolveDayMeasureBarDrag(input: DayMeasureBarDragInput): DayMeasureBarDragResult {
  const { calendar, edge, originalStart, originalFinish, originalDays, workdaySteps, pointerStart, pointerCurrent, snapMinutes } = input;
  const dayZoom = workdaySteps !== undefined;
  const steps = workdaySteps ?? 0;
  const deltaMs = dayZoom ? 0 : snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  const days0 = Math.max(0, originalDays);
  const dayMinutes = Math.max(1, calendar.hoursPerDay * 60);
  const minimumDays = dayZoom ? Math.min(1, days0) : (snapMinutes <= 15 ? 15 : 60) / dayMinutes;

  if (edge === 'body') {
    const start = dayZoom
      ? shiftByWorkdays(calendar, originalStart, steps)
      : calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
    return { start, finish: calendar.addMeasuredWorkdays(start, days0), days: days0 };
  }

  if (edge === 'right') {
    const start = calendar.nextWorkInstant(originalStart);
    const raw = dayZoom
      ? days0 + steps
      : calendar.measuredWorkdaysBetween(start, new Date(originalFinish.getTime() + deltaMs));
    const days = round6(Math.max(minimumDays, raw));
    return { start: new Date(originalStart.getTime()), finish: calendar.addMeasuredWorkdays(start, days), days };
  }

  const raw = dayZoom
    ? days0 - steps
    : calendar.measuredWorkdaysBetween(calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs)), originalFinish);
  const days = round6(Math.max(minimumDays, raw));
  return { start: calendar.subtractMeasuredWorkdays(originalFinish, days), finish: new Date(originalFinish.getTime()), days };
}
