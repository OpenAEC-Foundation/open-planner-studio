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
import { durationMinutesOf, isPinnedComplete, isPinnedInProgress, splitTotalSpanMinutes } from './duration';
import { isDateOnly } from '@/engine/calendar/workdayRules';
import { addCalendarDays, formatDate, parseInstant, utcDayStart } from '@/utils/dateUtils';

/** De aanroeper lost het profiel op. `durationUnit` is geen maatbeleid. */
export type PlacementMeasure = 'minutes' | 'workdays';

/** Wat de plaatsing van het profiel leest: alleen de maatconventie (§3.14). */
export type PlacementOptions = Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>;

export interface PlacementRange {
  /** Positie op de cumulatieve split-as aan het begin van dit stuk, inclusief de gaten ervoor. De as
   *  telt in de maat van de taak: urenmaat in werkminuten, dagenmaat in dagslots (zie `workPlacement`). */
  afterMinutes: number;
  /** Lengte van dit stuk op de split-as; bij de urenmaat gelijk aan `minutes`. */
  axisMinutes: number;
  /** Werkminuten van dit stuk op de kalender. */
  minutes: number;
  /** Aandeel van een nominale werkdag, volgens de aangeleverde effectieve maat. */
  share: number;
}

export interface PlacementDay {
  /** Een nachtblok hoort bij de dag waarop het begint. */
  iso: string;
  minutes: number;
  share: number;
  /** Een hele werkdag op de split-as: urenmaat de werkminuten van deze dag, dagenmaat één dagslot. Een
   *  pauze van precies deze lengte slaat deze dag over (de nivelleerder pauzeert er een werkdag mee). */
  dayAxisMinutes: number;
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

/** Ondergrens voor een rest op de split-as (dagslotminuten); kleiner telt als op. */
const AXIS_EPS = 1e-9;

/**
 * Eén wandeling voor een concrete plaatsing: effectieve blokken, deeldagen en splits.
 * Een expliciet einde is exclusief. Bij een kandidaat stopt de wandeling zodra haar hoeveelheid
 * verbruikt is.
 *
 * De split-as (`splitGaps`, en een contour) telt in de maat van de taak, net als de solver
 * (`splitTotalSpanMinutes`/`splitTotalSpanDays` in `duration.ts`) en de Gantt (`computeSplitSegments`):
 *  - urenmaat: werkminuten op de kalender; het deel van een dag = werkminuten ÷ (werktijd per dag × 60);
 *  - dagenmaat (§3.14): dagslots van `werktijd per dag × 60`. Elke werkdag is één dagslot, hoe lang ook;
 *    binnen een dag telt het deel van de werktijd van die dag (wo 11:00–16:00 op een dag van 8 u = 0,5).
 *    Een gat van 480 min (bij 8 u per dag) is dus één werkdag, ook op een korte vrijdag. Zo leest ook de
 *    splitsbewerking de as van een dagtaak (het dagslotcontract).
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
  if (measure === 'workdays') {
    // Bij een duur ligt het einde vast zoals bij de solver (`addDurationChecked`): het werk plus de gaten
    // in werkdagen (`splitTotalSpanDays`), met de dagenmaat-lopers vanaf de start. De wandeling boekt
    // nooit voorbij dat einde; een afrondingsrest van minder dan een minuut valt weg.
    const spanEnd = placement.duration !== undefined
      ? engine.addMeasuredWorkdays(start, measuredSpanDays(placement.duration, gaps, engine)).getTime()
      : undefined;
    return measuredWorkdayWalk(engine, start, Math.min(endMs, spanEnd ?? Infinity), remaining, gaps, spanEnd);
  }
  let gapIndex = 0;
  let axis = 0;
  let finish = start;
  const denominator = engine.hoursPerDay * 60;
  // Ook de staart van een nachtblok van een eerdere dag kan de start bevatten.
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && remaining > 1e-12; scanned++) {
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
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
        const minutes = inGap ? available : Math.min(available, remaining);
        if (!(minutes > 0)) { remaining = 0; break; }
        if (!inGap) {
          ranges.push({ afterMinutes: axis, axisMinutes: minutes, minutes, share: minutes / denominator });
          remaining -= minutes;
        }
        axis += minutes;
        cursor += minutes * 60_000;
        finish = new Date(cursor);
      }
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges, dayAxisMinutes: dayMinutes,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
    });
    day = addCalendarDays(day, 1);
  }
  return { days, finish };
}

/**
 * De dagenmaat-tak van `workPlacement`: werk en gaten lopen samen over de split-as in dagslots, dag voor
 * dag. Op elke werkdag is een dagslot `werktijd per dag × 60 ÷ werkminuten van die dag` as-minuten per
 * werkminuut waard. De plek binnen een dag blijft exact; alleen de werkminuten van een moment worden
 * afgerond op hele minuten, zoals de dagenmaat-lopers (`CalendarEngine.addMeasuredWorkdays`). Zo valt het
 * einde op hetzelfde moment als bij de solver: het werk plus de gaten in werkdagen vanaf de start.
 */
function measuredWorkdayWalk(
  engine: CalendarEngine,
  start: Date,
  endMs: number,
  durationDays: number,
  gaps: readonly TaskSplitGap[],
  spanEnd: number | undefined,
): PlacementResult {
  const mpd = Math.max(1, engine.hoursPerDay * 60);
  const startMs = start.getTime();
  const days: PlacementDay[] = [];
  let remaining = durationDays * mpd;
  let gapIndex = 0;
  let axis = 0;
  let finish = start;
  // Ook de staart van een nachtblok van een eerdere dag kan de start bevatten.
  let day = addCalendarDays(utcDayStart(start), -2);
  for (let scanned = 0; scanned < 200_000 && day.getTime() < endMs && remaining > AXIS_EPS; scanned++) {
    const dayMs = day.getTime();
    const bands = engine.effectiveBandsOn(day);
    const dayMinutes = bands.reduce((sum, b) => sum + b.end - b.start, 0);
    const ranges: PlacementRange[] = [];
    // Werkminuten van deze dag vóór de start en vóór het (exclusieve) einde.
    let at = workOffset(bands, dayMs, startMs);
    const to = workOffset(bands, dayMs, endMs);
    const scale = dayMinutes > 0 ? mpd / dayMinutes : 0;
    while (at < to && remaining > AXIS_EPS) {
      // Overlappende en aaneensluitende gaten delen dezelfde cumulatieve as.
      while (gapIndex < gaps.length && gaps[gapIndex].afterMinutes + gaps[gapIndex].gapMinutes <= axis + AXIS_EPS) gapIndex++;
      const gap = gaps[gapIndex];
      const inGap = gap !== undefined && gap.afterMinutes <= axis + AXIS_EPS;
      const boundary = gap ? (inGap ? gap.afterMinutes + gap.gapMinutes : gap.afterMinutes) : Infinity;
      const toBoundary = boundary - axis;
      const room = Math.min((to - at) * scale, toBoundary);
      const step = inGap ? room : Math.min(room, remaining);
      if (!(step > AXIS_EPS)) break;
      const next = at + step / scale;
      if (!inGap) {
        ranges.push({
          afterMinutes: axis, axisMinutes: step, share: step / mpd,
          minutes: Math.round(next) - Math.round(at),
        });
        remaining -= step;
      }
      // Een gatgrens bereikt: de as staat precies op die grens, zonder drift uit de omrekening.
      axis = step === toBoundary ? boundary : axis + step;
      at = next;
      finish = momentAtOffset(engine, bands, dayMs, Math.round(at));
    }
    if (ranges.length > 0) days.push({
      iso: formatDate(day), ranges, dayAxisMinutes: mpd,
      minutes: ranges.reduce((sum, r) => sum + r.minutes, 0),
      share: ranges.reduce((sum, r) => sum + r.share, 0),
    });
    day = addCalendarDays(day, 1);
  }
  // Rondt de wandeling op een halve minuut net anders af dan de lopers, dan geldt het einde van de solver.
  if (spanEnd !== undefined && days.length > 0) finish = new Date(spanEnd);
  return { days, finish };
}

/** Werk plus gaten in werkdagen, precies zoals de solver (`splitTotalSpanDays` in `duration.ts`): de duur
 *  plus de gaten die vóór het einde van het werk vallen, omgerekend met `werktijd per dag × 60`. */
function measuredSpanDays(durationDays: number, gaps: readonly TaskSplitGap[], engine: CalendarEngine): number {
  if (gaps.length === 0) return durationDays;
  const workMinutes = durationDays * engine.hoursPerDay * 60;
  return durationDays + (splitTotalSpanMinutes(gaps, workMinutes) - workMinutes) / (engine.hoursPerDay * 60);
}

/** Werkminuten in de blokken van dag `dayMs` vóór het moment `tMs` (`Infinity` ⇒ de hele dag). */
function workOffset(bands: ReadonlyArray<{ start: number; end: number }>, dayMs: number, tMs: number): number {
  let offset = 0;
  for (const b of bands) {
    const from = dayMs + b.start * 60_000;
    if (tMs <= from) break;
    offset += (Math.min(dayMs + b.end * 60_000, tMs) - from) / 60_000;
  }
  return offset;
}

/** Het EINDmoment `offset` werkminuten na het begin van dag `dayMs`: een grens tussen twee blokken is het
 *  blokeinde. Valt het deel van de dag weg in de afronding, dan is het einde het einde van de werkdag
 *  ervoor, zoals `addMeasuredWorkdays`. */
function momentAtOffset(
  engine: CalendarEngine,
  bands: ReadonlyArray<{ start: number; end: number }>,
  dayMs: number,
  offset: number,
): Date {
  if (offset <= 0) return engine.prevWorkInstant(new Date(dayMs + bands[0].start * 60_000));
  let left = offset;
  for (const b of bands) {
    const len = b.end - b.start;
    if (left <= len) return new Date(dayMs + (b.start + left) * 60_000);
    left -= len;
  }
  return new Date(dayMs + bands[bands.length - 1].end * 60_000);
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
 * Bij een spanne (zie `placementFollowsSpan`) schuift de kandidaat de spanne mee. Kalendertijd schuift
 * in kalendertijd, zoals de solver een vertraging in klokminuten toepast. Werktijd (handmatig gepland,
 * hamer) houdt bij een andere start dezelfde hoeveelheid werk: een verschuiving in kalendertijd zou een
 * weekend in of uit de spanne schuiven en werk winnen of verliezen. Kalendertijd en een voltooide taak
 * krijgen hun bewaarde splits NIET opnieuw: de spanne bevat ze al (acceptatie-eis 5 van F3b, dezelfde
 * uitzondering als `taskWorkDayIsos`). Een einde zonder tijd hoort bij die werkdag zelf (D2, zie
 * `spanFinish`).
 */
export function taskWorkPlacement(
  task: Task,
  engine: CalendarEngine,
  options: PlacementOptions,
  start?: Date,
): WorkPlacement | null {
  const t = task.time;
  const anchor = parseInstant(t.earlyStart ?? '');
  const from = start ?? anchor;
  if (!Number.isFinite(from.getTime())) return null;
  const measure: PlacementMeasure = taskCountsInWorkdays(task, options) ? 'workdays' : 'minutes';
  if (placementFollowsSpan(task)) {
    const elapsed = t.durationType === 'ELAPSEDTIME';
    const finish = spanFinish(t.earlyFinish ?? '', engine, elapsed);
    if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(finish.getTime())) return null;
    const keepsGaps = !elapsed && !isPinnedComplete(t);
    const gaps = keepsGaps && task.splitGaps ? { gaps: task.splitGaps } : {};
    const shift = from.getTime() - anchor.getTime();
    if (shift === 0 || elapsed) return { start: from, finish: new Date(finish.getTime() + shift), measure, ...gaps };
    const span = workPlacement(engine, { start: anchor, finish, measure, ...gaps });
    const amount = span.days.reduce((sum, d) => sum + (measure === 'workdays' ? d.share : d.minutes), 0);
    return { start: from, duration: amount, measure, ...gaps };
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
 *  1. een contour (`contour`): de periodes liggen op de split-as (in de maat van de taak, zie
 *     `workPlacement`) en worden met de stukken van de plaatsing gesneden. `contour` is VERPLICHT door de aanroeper opgelost, via `contourLookup` over ALLE
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
        if (ranges[mid].afterMinutes + ranges[mid].axisMinutes <= cursor) lo = mid + 1; else hi = mid;
      }
      for (let i = lo; i < ranges.length; i++) {
        const r = ranges[i];
        const stop = Math.min(end, r.afterMinutes + r.axisMinutes);
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
