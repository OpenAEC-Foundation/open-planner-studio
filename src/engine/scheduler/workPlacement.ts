// De plaatsingskern van belasting en nivelleerder (alleen uren, spec §3.11, F3c).
//
// Eén vraag, één antwoord: op welke werkdagen werkt een taak, en welk deel van een dag is dat?
// Histogram (`ResourceLoad.ts`) en nivelleerder (`ResourceLeveler.ts`) vragen het hier, met dezelfde
// plaatsing, dezelfde maat en dezelfde splits. Zo boekt de nivelleerder precies wat het histogram
// daarna toont.
import type { Task, TaskSplitGap, TaskTimephasedContour } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import type { EffectiveSchedulingOptions } from '@/types/project';
import type { CalendarEngine } from './CalendarEngine';
import { taskCountsInWorkdays } from './conventions/durationMeasure';
import { durationMinutesOf, isPinnedComplete, isPinnedInProgress } from './duration';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatDate, parseInstant, utcDayStart } from '@/utils/dateUtils';

/** De aanroeper lost het profiel op. `durationUnit` is geen maatbeleid. */
export type PlacementMeasure = 'minutes' | 'workdays';

/** Wat de plaatsing van het profiel leest: alleen de maatconventie (§3.14). */
export type PlacementOptions = Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>;

export interface PlacementRange {
  /** Fysieke werkminuten vanaf de start, inclusief de gaten op de cumulatieve split-as. */
  afterMinutes: number;
  minutes: number;
  /** Aandeel van een nominale werkdag, volgens de aangeleverde effectieve maat. */
  share: number;
}

export interface PlacementDay {
  /** Een nachtblok hoort bij de dag waarop het begint. */
  iso: string;
  minutes: number;
  share: number;
  ranges: PlacementRange[];
}

export type WorkPlacement = {
  start: Date;
  measure: PlacementMeasure;
  gaps?: readonly TaskSplitGap[];
} & ({ finish: Date; duration?: never } | {
  /** Minuten bij urenmaat, werkdagen bij dagenmaat; uitsluitend het werk, zonder gaten. */
  duration: number;
  finish?: never;
});

export interface PlacementResult {
  days: PlacementDay[];
  finish: Date;
}

/**
 * Eén wandeling voor een concrete plaatsing: effectieve blokken, deeldagen en splits.
 * Een expliciet einde is exclusief. Bij een kandidaat stopt de wandeling zodra haar hoeveelheid
 * verbruikt is. De split-as blijft fysiek in werkminuten, ook bij de dagenmaat.
 * Het deel van een dag: urenmaat = werkminuten ÷ (werktijd per dag × 60); dagenmaat = werkminuten ÷
 * de werkminuten van die dag zelf (wo 11:00–16:00 op een dag van 8 u = 0,5).
 * De bestaande dagslotfuncties in splitWalk blijven ongewijzigd voor de renderer.
 */
export function workPlacement(engine: CalendarEngine, placement: WorkPlacement): PlacementResult {
  const { start, measure } = placement;
  const endMs = placement.finish?.getTime() ?? Infinity;
  let remaining = placement.duration ?? Infinity;
  const days: PlacementDay[] = [];
  if (!Number.isFinite(start.getTime()) || Number.isNaN(endMs) || endMs <= start.getTime()
    || !(remaining > 0) || !engine.isHourMode || !engine.hasWorkingDays()) return { days, finish: start };
  const gaps = (placement.gaps ?? []).filter(g => Number.isFinite(g.afterMinutes)
    && Number.isFinite(g.gapMinutes) && g.gapMinutes > 0)
    .slice().sort((a, b) => a.afterMinutes - b.afterMinutes);
  let gapIndex = 0;
  let axis = 0;
  let finish = start;
  // Ook de staart van een nachtblok van een eerdere dag kan de start bevatten.
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && remaining > 1e-12; scanned++) {
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
    const denominator = measure === 'workdays' ? dayMinutes : engine.hoursPerDay * 60;
    const ranges: PlacementRange[] = [];
    for (const band of bands) {
      let cursor = Math.max(start.getTime(), day.getTime() + band.start * 60_000);
      const end = Math.min(endMs, day.getTime() + band.end * 60_000);
      while (cursor < end && remaining > 1e-12) {
        // Overlappende en aaneensluitende gaten delen dezelfde cumulatieve as.
        while (gapIndex < gaps.length && gaps[gapIndex].afterMinutes + gaps[gapIndex].gapMinutes <= axis) gapIndex++;
        const gap = gaps[gapIndex];
        const inGap = gap && gap.afterMinutes <= axis;
        const boundary = gap ? (inGap ? gap.afterMinutes + gap.gapMinutes : gap.afterMinutes) : Infinity;
        const available = Math.min((end - cursor) / 60_000, boundary - axis);
        const wanted = measure === 'workdays' ? Math.round(remaining * denominator) : remaining;
        const minutes = inGap ? available : Math.min(available, wanted);
        if (!(minutes > 0)) { remaining = 0; break; }
        if (!inGap) {
          const share = minutes / denominator;
          ranges.push({ afterMinutes: axis, minutes, share });
          remaining -= measure === 'workdays' ? share : minutes;
        }
        axis += minutes;
        cursor += minutes * 60_000;
        finish = new Date(cursor);
      }
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
    });
    day = addCalendarDays(day, 1);
  }
  return { days, finish };
}

/**
 * Staat de plaatsing van deze taak vast in haar berekende spanne (`earlyStart`..`earlyFinish`)?
 *  - kalendertijd: de duur is klokminuten, niet het werk op de taakkalender;
 *  - voltooid: de actuals zijn gezaghebbend;
 *  - lopend: de solver plant de rest vanaf de actuals; één gezaghebbende plaatsing voor boeking én
 *    histogram (acceptatie-eis 4 van F3b), geen nieuwe wandeling van de totale duur;
 *  - handmatig gepland en hamer: de solver leest hun duur niet als invoer.
 * Anders telt de ACTUELE duur vanaf de start, ook als `earlyFinish` verouderd is (acceptatie-eis 3).
 */
export function placementFollowsSpan(task: Task): boolean {
  const t = task.time;
  return t.durationType === 'ELAPSEDTIME' || isPinnedComplete(t) || isPinnedInProgress(t)
    || task.manuallyScheduled === true || task.isHammock === true;
}

/**
 * De gezaghebbende plaatsing van een taak, voor het histogram én voor elke kandidaat van de
 * nivelleerder (spec §3.11). `start` is een kandidaatmoment; afwezig ⇒ `earlyStart`.
 *
 * De maat komt uit de hulpfunctie van de basis (`taskCountsInWorkdays`), nooit uit `durationUnit`
 * of een tijdstip in de datum. Dagenmaat: `scheduleDuration` werkdagen (een breuk mag); urenmaat:
 * `durationMinutesOf` (bij een dagtaak onder P6/MSP: dagen × werktijd per dag × 60).
 *
 * Bij een spanne (zie `placementFollowsSpan`) schuift het einde mee met de kandidaat. Kalendertijd en
 * een voltooide taak krijgen hun bewaarde splits NIET opnieuw: de spanne bevat ze al (acceptatie-eis
 * 5 van F3b, dezelfde uitzondering als `taskWorkDayIsos`). Een einde zonder tijd hoort bij die werkdag
 * zelf (D2, zie `spanFinish`).
 */
export function taskWorkPlacement(
  task: Task,
  engine: Pick<CalendarEngine, 'hoursPerDay' | 'isHourMode' | 'effectiveBandsOn' | 'typicalWorkdayBands'>,
  options: PlacementOptions,
  start?: Date,
): WorkPlacement | null {
  const t = task.time;
  const anchor = parseInstant(t.earlyStart ?? '');
  const from = start ?? anchor;
  if (!Number.isFinite(from.getTime())) return null;
  const measure: PlacementMeasure = taskCountsInWorkdays(task, options) ? 'workdays' : 'minutes';
  if (placementFollowsSpan(task)) {
    const finish = spanFinish(t.earlyFinish ?? '', engine, t.durationType === 'ELAPSEDTIME');
    if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(finish.getTime())) return null;
    const keepsGaps = t.durationType !== 'ELAPSEDTIME' && !isPinnedComplete(t);
    return {
      start: from, finish: new Date(finish.getTime() + from.getTime() - anchor.getTime()), measure,
      ...(keepsGaps && task.splitGaps ? { gaps: task.splitGaps } : {}),
    };
  }
  const duration = measure === 'workdays' ? t.scheduleDuration : durationMinutesOf(task, engine);
  return { start: from, duration, measure, ...(task.splitGaps ? { gaps: task.splitGaps } : {}) };
}

/**
 * Het exclusieve einde van een spanne. Een moment blijft zoals het is. Een datum zonder tijd is
 * eindachtig en hoort bij die werkdag zelf (D2, `workdayRules.ts`): het einde van het laatste werkblok
 * dat op die datum begint, zonder werkblok dat van de typische werkdag (D4). Kalendertijd: 24:00.
 * Zonder D2 zou middernacht als exclusief einde de laatste dag weglaten.
 */
function spanFinish(
  value: string,
  engine: Pick<CalendarEngine, 'effectiveBandsOn' | 'typicalWorkdayBands'>,
  elapsed: boolean,
): Date {
  const parsed = parseInstant(value);
  if (!isDateOnly(value) || !Number.isFinite(parsed.getTime())) return parsed;
  if (elapsed) return addCalendarDays(parsed, 1);
  const own = engine.effectiveBandsOn(parsed);
  const bands = own.length > 0 ? own : engine.typicalWorkdayBands();
  return bands.length > 0
    ? new Date(parsed.getTime() + bands[bands.length - 1].end * 60_000)
    : addCalendarDays(parsed, 1);
}

/**
 * Verdeelt het werk van één toewijzing over de dagen van een plaatsing; `units[i]` hoort bij
 * `days[i]`. Bron, in deze volgorde:
 *  1. een contour (`contour`): de periodes liggen op de fysieke split-as en worden met de werkblokken
 *     gesneden. `contour` is VERPLICHT door de aanroeper opgelost, via `contourLookup` over ALLE
 *     toewijzingen van de taak (ook `null`). Een koppeling met alleen de eigen toewijzing kan één
 *     contour twee keer gebruiken (knownbugs 233).
 *  2. een curve, een exacte importcurve of opgeslagen werk: de bestaande dagslotverdeling
 *     (`slots`, in de praktijk `assignmentDayUnits` zonder contour) wordt naar rato van overlap op
 *     de bezette dagdelen gelegd; zo weegt het deel van de eerste en de laatste dag mee. Zonder
 *     opgeslagen werk volgt het totaal de plaatsing (inzet × som van de delen); met opgeslagen werk
 *     blijft het opgeslagen totaal staan.
 *  3. anders uniform: inzet × deel van de dag.
 * `mpd`: werkminuten van een nominale werkdag van de taakkalender (`hoursPerDay × 60`).
 */
export function assignmentPlacementLoad(
  assignment: ResourceAssignment,
  days: readonly PlacementDay[],
  mpd: number,
  contour: TaskTimephasedContour | null,
  slots: () => readonly number[],
): number[] {
  if (contour && contour.periods.length > 0) {
    const units = days.map(() => 0);
    const ranges = days.flatMap((d, day) => d.ranges.map(r => ({ ...r, day })));
    for (const p of contour.periods) {
      if (!Number.isFinite(p.afterMinutes) || !Number.isFinite(p.minutes) || !Number.isFinite(p.workMinutes)
        || p.afterMinutes < 0 || p.minutes <= 0 || p.workMinutes <= 0) continue;
      // Werk in een split schuift, net als bij de bestaande contour-engine, naar het volgende
      // werkblok. Ook een rest voorbij het laatste blok blijft behouden op de laatste werkdag.
      let cursor = p.afterMinutes;
      const end = cursor + p.minutes;
      let lo = 0;
      let hi = ranges.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ranges[mid].afterMinutes + ranges[mid].minutes <= cursor) lo = mid + 1; else hi = mid;
      }
      for (let i = lo; i < ranges.length; i++) {
        const r = ranges[i];
        const stop = Math.min(end, r.afterMinutes + r.minutes);
        if (stop > cursor) {
          units[r.day] += p.workMinutes * (stop - cursor) / p.minutes / mpd;
          cursor = stop;
        }
        if (cursor >= end) break;
      }
      if (cursor < end && days.length > 0) units[days.length - 1] += p.workMinutes * (end - cursor) / p.minutes / mpd;
    }
    return units;
  }
  const totalShare = days.reduce((sum, d) => sum + d.share, 0);
  if (!(totalShare > 0)) return days.map(() => 0);
  const uniform = (): number[] => days.map(d => d.share * assignment.unitsPerDay);
  if (!assignment.curveValues && assignment.remainingWorkMinutes === undefined
    && (!assignment.curve || assignment.curve === 'UNIFORM')) {
    return uniform();
  }
  const source = slots();
  const storedWork = assignment.remainingWorkMinutes !== undefined && Number.isFinite(assignment.remainingWorkMinutes);
  const sourceTotal = source.reduce((sum, u) => sum + u, 0);
  // Zonder opgeslagen werk volgt het totaal de plaatsing. De oude formule rondt haar slots op hele
  // eenheden (of honderdsten); rondt een kleine inzet daardoor volledig naar nul, dan blijft het
  // werk toch staan, uniform over de plaatsing (review F3b r2, punt 2).
  if (!storedWork && !(sourceTotal > 0)) return uniform();
  const scale = storedWork ? 1 : assignment.unitsPerDay * totalShare / sourceTotal;
  let position = 0;
  return days.map(d => {
    const end = position + d.share / totalShare * source.length;
    let load = 0;
    for (let i = Math.floor(position); i < Math.min(source.length, Math.ceil(end)); i++) {
      load += source[i] * Math.max(0, Math.min(end, i + 1) - Math.max(position, i));
    }
    position = end;
    return load * scale;
  });
}
