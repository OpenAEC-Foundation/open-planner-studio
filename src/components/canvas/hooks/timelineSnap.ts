import { MAX_DAY_ZOOM, pickTiers, TIER_CONFIG } from '@/engine/renderer/timelineTiers';
import type { WorkCalendar } from '@/types/calendar';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { workdayOfInstant } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatInstant, parseDate, utcDayStart } from '@/utils/dateUtils';

// Gedeeld snappen van de balkgebaren (`useBarDrag`) en de splits-modus (`useSplitGesture`): beide
// moeten onder dezelfde canvas-x exact dezelfde datum vinden.

/**
 * Snap-quantum (minuten) van een uurgebaar: dezelfde actieve minor-tier als de tijdkop. Op
 * kwartierzoom is 15 minuten bereikbaar; zonder die opt-in blijft de ondergrens één uur.
 */
export function hourSnapMinutesFor(zoom: number, enableQuarterHourZoom: boolean): number {
  if (zoom < MAX_DAY_ZOOM) return 1440;
  const minorTier = pickTiers(zoom, enableQuarterHourZoom).minor;
  return Math.max(enableQuarterHourZoom ? 15 : 60, Math.round(TIER_CONFIG[minorTier].stepDays * 1440));
}

/**
 * De gesnapte datum onder een canvas-x: in dag-modus het begin van de dag, in uur-modus het
 * snap-quantum. De x loopt via de gedeelde as, dus werkdagencompressie zit er al in. `null` als de
 * as op die x geen datum heeft.
 */
export function snapTimelineDate(axis: GanttAxis, x: number, hourMode: boolean, hourSnapMinutes: number): Date | null {
  const raw = axis.xToDate(x);
  if (Number.isNaN(raw.getTime())) return null;
  if (!hourMode) return utcDayStart(raw);
  const q = Math.max(1, hourSnapMinutes) * 60_000;
  return new Date(Math.round(raw.getTime() / q) * q);
}

/** T24: werkdag onder de pointer; een nachtploeg hoort bij zijn begindatum. */
export function splitWorkdayStart(raw: Date, eng: CalendarEngine, calendar: WorkCalendar): Date {
  const day = workdayOfInstant({ kind: 'blocks', engine: eng, calendar }, formatInstant(raw, 'hour'), 'start');
  return firstWorkdayStartOnOrAfter(parseDate(day), eng);
}

/** Zoekt vanaf een werkdagdatum; wijs middernacht niet opnieuw toe aan een vorige nachtploeg. */
function firstWorkdayStartOnOrAfter(date: Date, eng: CalendarEngine): Date {
  for (let i = 0; i < 3660; i++, date = addCalendarDays(date, 1)) {
    const bands = eng.effectiveBandsOn(date);
    if (bands.length) return new Date(date.getTime() + bands[0].start * 60_000);
  }
  return new Date(Number.NaN);
}

/** Minimum voor een nieuwe pauze: alle blokken van de werkdag, ook over middernacht. */
export function splitWorkdayMinutes(at: Date, eng: CalendarEngine, calendar: WorkCalendar): number {
  const day = workdayOfInstant({ kind: 'blocks', engine: eng, calendar }, formatInstant(at, 'hour'), 'start');
  return eng.effectiveBandsOn(parseDate(day)).reduce((sum, band) => sum + band.end - band.start, 0);
}

/** Een werkstuk mag tot de volgende werkdaggrens worden ingekort, ook vanaf ma 13:00. */
export function splitWorkMinimum(start: Date, eng: CalendarEngine, calendar: WorkCalendar): number {
  const day = workdayOfInstant({ kind: 'blocks', engine: eng, calendar }, formatInstant(start, 'hour'), 'start');
  const next = firstWorkdayStartOnOrAfter(addCalendarDays(parseDate(day), 1), eng);
  return eng.workMinutesBetween(start, next);
}

/** Het label telt werkdagdelen langs dezelfde kalender als het gebaar. */
export function splitWorkdayUnits(start: Date, minutes: number, eng: CalendarEngine, calendar: WorkCalendar): number {
  let at = start;
  let rest = minutes;
  let days = 0;
  for (let i = 0; rest > 1e-6 && i < 3660; i++) {
    const capacity = splitWorkMinimum(at, eng, calendar);
    if (!(capacity > 0)) break;
    days += Math.min(1, rest / capacity);
    rest -= capacity;
    const day = workdayOfInstant({ kind: 'blocks', engine: eng, calendar }, formatInstant(at, 'hour'), 'start');
    at = firstWorkdayStartOnOrAfter(addCalendarDays(parseDate(day), 1), eng);
  }
  return Math.round(days * 100) / 100;
}

// ── De dagenmaat: de split-as in dagslots (F3c, alleen uren §3.14) ──────────────────────────────
//
// Een taak die in de dagenmaat telt, legt haar stukken en pauzes op een as van dagslots: elke werkdag
// telt `werktijd per dag × 60` asminuten, hoe lang hij ook is (een korte vrijdag van 6 u telt als 480 op
// een kalender van 8 u per dag). Zo lezen de solver, de gedeelde plaatsing en de Gantt de as al
// (`splitWalk.ts`, `'workdays'`). Het splitsgebaar en het stukslepen meten hier dezelfde afstand, met de
// dagenmaat-lopers van de kalender (`measuredWorkdaysBetween`, `addMeasuredWorkdays`). Een urentaak houdt
// werkminuten (`workAxisMinutesBetween` met `hourMode`), zoals F4a.

/** Asminuten per werkdag op de dagslot-as. */
export function dagslotMinutes(eng: CalendarEngine): number {
  return Math.max(1, eng.hoursPerDay * 60);
}

/** Zes decimalen, zoals de opslag van een dagenmaat: een breuk van een dag geeft geen floatruis. */
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** De getekende afstand van `from` naar `to` op de dagslot-as (negatief als `to` eerder ligt). */
export function dagslotMinutesBetween(from: Date, to: Date, eng: CalendarEngine): number {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return round6(eng.measuredWorkdaysBetween(from, to) * dagslotMinutes(eng));
}

/** Het startmoment `axisMinutes` dagslotminuten na `start`. Een stuk dat een werkdag afsluit, grenst aan
 *  het volgende blokbegin (vr 16:00 ⇒ ma 07:00), zoals de tussengrenzen in `splitWalk.ts`. */
export function dagslotMoment(start: Date, axisMinutes: number, eng: CalendarEngine): Date {
  if (!(axisMinutes > 0)) return eng.nextWorkInstant(start);
  return eng.nextWorkInstant(eng.addMeasuredWorkdays(eng.nextWorkInstant(start), axisMinutes / dagslotMinutes(eng)));
}

/**
 * De plek op de WERK-as (zonder pauzes) bij een afstand op de as van de taak (met pauzes): de
 * dagslot-tegenhanger van `workOffsetAtDate` (`splitEdit.ts`), die de afstand zelf in werkminuten of hele
 * dagen meet. `inGap`: de plek valt in een bestaande pauze. Voorbij het taakeinde klemt de uitkomst op het
 * werktotaal; `splitAt` weigert dat verderop met een bereikreden.
 */
export function workOffsetOnAxis(
  pieces: readonly { kind: 'work' | 'gap'; minutes: number }[],
  axisMinutes: number,
): { workMinutes: number; inGap: boolean } {
  const EPS = 1e-6;
  let work = 0;
  let rest = Math.max(0, axisMinutes);
  for (const p of pieces) {
    if (rest < p.minutes - EPS) {
      if (p.kind === 'gap') return { workMinutes: work, inGap: true };
      return { workMinutes: round6(work + rest), inGap: false };
    }
    rest -= p.minutes;
    if (p.kind === 'work') work += p.minutes;
  }
  return { workMinutes: work, inGap: false };
}

/** Een werkstuk in de dagenmaat loopt ten minste tot de volgende werkdaggrens: vanaf het begin van een
 *  werkdag één dag, vanaf ma 13:00 de rest van maandag (0,375 d = 180 asminuten op 8 u per dag). */
export function dagslotWorkMinimum(start: Date, eng: CalendarEngine, calendar: WorkCalendar): number {
  const day = workdayOfInstant({ kind: 'blocks', engine: eng, calendar }, formatInstant(start, 'hour'), 'start');
  const next = firstWorkdayStartOnOrAfter(addCalendarDays(parseDate(day), 1), eng);
  return dagslotMinutesBetween(start, next, eng);
}
