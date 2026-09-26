// WorkdayAxis — de gecomprimeerde werkdagen-as.
// `CalendarEngine`'s interne structuren (workDayMask, holidayDaySet, …) zijn PRIVATE. Deze laag
// bouwt daarom uitsluitend op de PUBLIEKE CalendarEngine-API (`isWorkDay`,
// `nextWorkDay`/`prevWorkDay`, `workDaysBetween`, `addWorkDays`, `hasWorkingDays`).
//
// Dit bestand levert twee `GanttAxis`-implementaties:
//   - `buildCalendarAxis`  — dunne wrapper om `dateToX`/`xToDate` uit `timeAxis.ts`
//     (lineaire kalender-as).
//   - `buildWorkdayAxis`   — de prefix-som-mapping die niet-werkdagen comprimeert.
// `resolveGanttAxis` (onderaan) kiest er één op `compressNonWorkdays`.

import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { MS_PER_DAY, utcDayIndex } from '@/utils/dateUtils';
import { dateToX as calendarDateToX, xToDate as calendarXToDate, GanttAxis } from './timeAxis';

// ── Kalender-as: dunne wrapper om de `timeAxis.ts`-functies ───────────────────────────────────

export interface CalendarAxisOptions {
  /** Datum die op `dateToX(origin) === chartOriginX - scrollX` landt. */
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

/**
 * Bouwt de lineaire kalender-as als `GanttAxis` — een letterlijke doorverwijzing naar
 * `dateToX`/`xToDate` uit `timeAxis.ts`. Zo kunnen de call-sites kiezen tussen `CalendarAxis` en
 * `WorkdayAxis` zonder te vertakken op een boolean — beide implementeren dezelfde `GanttAxis`-vorm.
 */
export function buildCalendarAxis(options: CalendarAxisOptions): GanttAxis {
  const { origin, chartOriginX, zoom, scrollX } = options;
  return {
    dateToX: (date: Date) => calendarDateToX(date, origin, chartOriginX, zoom, scrollX),
    xToDate: (x: number) => calendarXToDate(x, origin, chartOriginX, zoom, scrollX),
    daySpan: (from: Date, to: Date) => (to.getTime() - from.getTime()) / MS_PER_DAY,
    dayIndexOf: (date: Date) => (date.getTime() - origin.getTime()) / MS_PER_DAY,
    dateAtIndex: (index: number) => new Date(origin.getTime() + index * MS_PER_DAY),
  };
}

// ── Werkdagen-as ─────────────────────────────────────────────────────────────────────────────

// De dagindex is `utcDayIndex` uit dateUtils — dezelfde als `CalendarEngine.isWorkDay` gebruikt
// (epoch op UTC-middernacht, geen DST-drift), zodat de twee lagen nooit uiteenlopen over "welke dag
// hoort bij welke ms".
function dateFromUtcDayIndex(dayIdx: number): Date {
  return new Date(dayIdx * MS_PER_DAY);
}

/** Willekeurig maar VAST rekenkundig anker voor de absolute werkdag-telling: de UNIX-epoch.
 *  Puur een referentiepunt — geen domeinbetekenis. Nodig zodat `dayIndexOf`/`dateAtIndex` een
 *  stabiele waarde teruggeven die niet verschuift wanneer het venster later (lazy) groeit
 *  (`ensureContains`); groei bouwt het venster opnieuw op, maar de absolute index-telling
 *  (afstand tot de epoch) blijft ongewijzigd. */
const EPOCH = new Date(0);

export interface WorkdayAxisOptions {
  /** Kalender waarop de as werkdagen bepaalt (uitsluitend via de publieke CalendarEngine-API). */
  calendar: CalendarEngine;
  /** Datum die op `dateToX(origin) === chartOriginX - scrollX` landt (meestal `viewStart`). */
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
  /** Initiële venster-padding (in KALENDERdagen) rond `origin`, elke kant. Klein houden — het
   *  venster groeit lazy (on-demand) mee met wat er daadwerkelijk wordt opgevraagd. */
  initialPaddingDays?: number;
}

const DEFAULT_INITIAL_PADDING_DAYS = 30;
/** Elke groei-stap breidt het venster met dit aantal kalenderdagen uit (zowel bij "net iets
 *  erbuiten" als bij het zoeken naar een werkdag-index ver weg — lazy-groei). */
const GROWTH_CHUNK_DAYS = 400;
/** Hard plafond op de venstergrootte (kalenderdagen, ≈ 137 jaar) — voorkomt dat een extreem
 *  ver-weg-liggende query (bug, corrupt bestand, …) een steeds groter array alloceert. Voorbij dit
 *  plafond valt de as terug op de altijd-correcte `CalendarEngine`-rekenkunde
 *  (out-of-range-fallback): O(n) i.p.v. O(1), maar zeldzaam op het hot path. */
const MAX_WINDOW_DAYS = 50_000;

/**
 * Bouwt een `WorkdayAxis` vanaf een `CalendarEngine` + origin-datum. Elke aanroep is een
 * verse instantie — GEEN globale singleton, geen impliciete cache tussen calls: wil de
 * aanroeper de as herbouwen na een kalendermutatie, dan roept hij deze factory gewoon opnieuw aan.
 *
 * Gooit een fout als de kalender geen enkele werkdag heeft (`hasWorkingDays()===false`,
 * randgeval) — een lege werkweek kan geen zinvolle werkdagen-as opleveren ("de as stort in").
 * De aanroeper (`resolveGanttAxis`) hoort dit af te vangen en op `CalendarAxis` terug te vallen +
 * een console-warning te geven; dat is UI-beleid en hoort niet in deze headless laag.
 */
export function buildWorkdayAxis(options: WorkdayAxisOptions): GanttAxis {
  const { calendar, origin, chartOriginX, zoom, scrollX } = options;
  const initialPadding = options.initialPaddingDays ?? DEFAULT_INITIAL_PADDING_DAYS;

  if (!calendar.hasWorkingDays()) {
    throw new Error(
      'buildWorkdayAxis: kalender heeft geen enkele werkdag (hasWorkingDays()===false) — ' +
        'de werkdagen-as kan niet gebouwd worden. Val terug op buildCalendarAxis().',
    );
  }

  // ── Vensterstaat: een dichte prefix-array over [windowStart, windowEnd] (UTC-dagindices),
  //    plus `preWindowCount` = het aantal werkdagen in (EPOCH, windowStart) — de absolute
  //    offset die lokale prefix-waarden naar de globale (epoch-relatieve) telling optilt. ──
  let windowStart = 0;
  let windowEnd = -1; // leeg venster tot de eerste build
  let prefix: Uint32Array = new Uint32Array(0);
  let workDayList: number[] = []; // oplopende UTC-dagindices van werkdagen in het venster
  let preWindowCount = 0;

  /**
   * (Her)bouwt het venster van dagindex `start` t/m `end` (inclusief). O(lengte).
   *
   * BELANGRIJK (epoch-clamp): dagen vóór de
   * EPOCH (`dIdx < 0`) tellen NERGENS mee als werkdag voor de absolute telling — dat is dezelfde
   * clamp die `preWindowCount` hieronder al toepast (`start<=0` ⇒ 0). Als deze lus dagen vóór de
   * epoch WEL zou meetellen (ze zijn qua weekdag/feestdag heus "werkdagen"), dan raakt de telling
   * uit de pas zodra het venster ooit terug groeit tot voorbij de epoch (`dateAtIndex` met een
   * sterk negatieve index) — de rest van de as zou daarna stilzwijgend té hoog tellen. Vandaar
   * de expliciete `dIdx >= 0`-gate, symmetrisch met `preWindowCount`'s clamp.
   */
  function buildWindow(start: number, end: number): void {
    const len = end - start + 1;
    const nextPrefix = new Uint32Array(len);
    const nextWorkDayList: number[] = [];
    let count = 0;
    for (let k = 0; k < len; k++) {
      const dIdx = start + k;
      if (dIdx >= 0 && calendar.isWorkDay(dateFromUtcDayIndex(dIdx))) {
        count++;
        nextWorkDayList.push(dIdx);
      }
      nextPrefix[k] = count;
    }
    windowStart = start;
    windowEnd = end;
    prefix = nextPrefix;
    workDayList = nextWorkDayList;
    // Werkdagen in (EPOCH, start-1] — 0 als `start` op/vóór de epoch-dag ligt (workDaysBetween
    // levert dan 0 op via de endMs<startMs-kortsluiting, wat hier neerkomt op een gedocumenteerde
    // clamp: er "bestaan" geen werkdagen vóór de epoch in deze telling).
    preWindowCount = start > 0 ? calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(start - 1)) : 0;
  }

  buildWindow(utcDayIndex(origin.getTime()) - initialPadding, utcDayIndex(origin.getTime()) + initialPadding);

  /** Breidt het venster uit zodat `dayIdx` erin valt, MITS dat binnen `MAX_WINDOW_DAYS` blijft.
   *  Geeft terug of `dayIdx` na deze aanroep in het venster valt (false ⇒ caller valt terug op
   *  de CalendarEngine-rekenkunde). Geen groei nodig ⇒ meteen true. */
  function ensureContainsDay(dayIdx: number): boolean {
    if (dayIdx >= windowStart && dayIdx <= windowEnd) return true;
    let newStart = windowStart;
    let newEnd = windowEnd;
    if (dayIdx < newStart) newStart = dayIdx - GROWTH_CHUNK_DAYS;
    if (dayIdx > newEnd) newEnd = dayIdx + GROWTH_CHUNK_DAYS;
    if (newEnd - newStart + 1 > MAX_WINDOW_DAYS) return false;
    buildWindow(newStart, newEnd);
    return true;
  }

  /** Absoluut (epoch-relatief) aantal werkdagen in `(EPOCH, dayIdx]`. O(1) binnen het venster
   *  (na eventuele groei), anders O(log n) via `CalendarEngine.workDaysBetween` (fallback —
   *  altijd correct, alleen niet altijd O(1)). */
  function countThroughDay(dayIdx: number): number {
    if (ensureContainsDay(dayIdx)) {
      return preWindowCount + prefix[dayIdx - windowStart];
    }
    return calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(dayIdx));
  }

  /** 0-based werkdag-index van `date`. Werkdag `d` → index van `d` in de globale
   *  werkdagenrij. Niet-werkdag `d` → KLEEF-RECHTS: dezelfde index als de eerstvolgende
   *  werkdag (de "naad"). Dit volgt rechtstreeks uit de prefix-telling: `countThroughDay(d)` telt
   *  werkdagen tot-en-met `d`; op een niet-werkdag is dat gelijk aan het 0-based indexnummer van de
   *  eerstvolgende werkdag (die immers de `countThroughDay(d)+1`-ste werkdag zal zijn). */
  function workdayIndexOfDay(dayIdx: number): number {
    const isWork = calendar.isWorkDay(dateFromUtcDayIndex(dayIdx));
    return countThroughDay(dayIdx) - (isWork ? 1 : 0);
  }

  /** Sub-dag-fractie binnen een werkdag-kolom: `[0,1)` op een werkdag, anders 0 (een
   *  niet-werkdag heeft geen eigen kolom om binnen te interpoleren — kleeft naadloos op de naad). */
  function intraDayFraction(date: Date, dayIdx: number): number {
    if (!calendar.isWorkDay(date)) return 0;
    const dayStartMs = dayIdx * MS_PER_DAY;
    return (date.getTime() - dayStartMs) / MS_PER_DAY;
  }

  /** Fractionele werkdag-index (as-eenheden) van een datum, MET sub-dag-interpolatie. */
  function fractionalIndexOf(date: Date): number {
    const dIdx = utcDayIndex(date.getTime());
    return workdayIndexOfDay(dIdx) + intraDayFraction(date, dIdx);
  }

  // `origin` kan zelf op een niet-werkdag vallen (bv. import zet `viewStart` op zaterdag) —
  // dan is `originIndex` de kleef-rechts-index van de eerstvolgende werkdag. Eén keer berekend
  // (de as is per-instantie immutable in zijn origin), gebruikt als nulpunt voor `dateToX`.
  const originIndex = fractionalIndexOf(origin);

  /** Inverse van `workdayIndexOfDay`: de UTC-dagindex van de `index`-ste (0-based) werkdag.
   *  Fast path: binnen het (eventueel gegroeide) venster via `workDayList` — O(1)/O(groei).
   *  Fallback (voorbij `MAX_WINDOW_DAYS`, zeldzaam): `CalendarEngine.addWorkDays` vanaf de epoch —
   *  O(index) maar altijd correct. `workDays<=0` clamt daar op de epoch zelf (bestaande
   *  CalendarEngine-semantiek) — dat is de gedocumenteerde "vóór origin/epoch"-clamp
   *  voor een negatieve `index`. */
  function dayAtWorkdayIndex(index: number): number {
    // Groei het venster net zolang tot `index` binnen het gedekte bereik valt, of tot het
    // groei-plafond bereikt is (dan: fallback).
    while (index < preWindowCount || index >= preWindowCount + workDayList.length) {
      const needForward = index >= preWindowCount + workDayList.length;
      const newStart = needForward ? windowStart : windowStart - GROWTH_CHUNK_DAYS;
      const newEnd = needForward ? windowEnd + GROWTH_CHUNK_DAYS : windowEnd;
      if (newEnd - newStart + 1 > MAX_WINDOW_DAYS) {
        return utcDayIndex(calendar.addWorkDays(EPOCH, index + 1).getTime());
      }
      buildWindow(newStart, newEnd);
    }
    return workDayList[index - preWindowCount];
  }

  const axis: GanttAxis = {
    dateToX(date: Date): number {
      const idx = fractionalIndexOf(date);
      return chartOriginX + (idx - originIndex) * zoom - scrollX;
    },
    xToDate(x: number): Date {
      const floatIdx = (x - chartOriginX + scrollX) / zoom + originIndex;
      const wholeIdx = Math.floor(floatIdx);
      const frac = floatIdx - wholeIdx;
      const dayIdx = dayAtWorkdayIndex(wholeIdx);
      return new Date(dayIdx * MS_PER_DAY + frac * MS_PER_DAY);
    },
    daySpan(from: Date, to: Date): number {
      return fractionalIndexOf(to) - fractionalIndexOf(from);
    },
    dayIndexOf(date: Date): number {
      return fractionalIndexOf(date);
    },
    dateAtIndex(index: number): Date {
      const wholeIdx = Math.floor(index);
      const frac = index - wholeIdx;
      const dayIdx = dayAtWorkdayIndex(wholeIdx);
      return new Date(dayIdx * MS_PER_DAY + frac * MS_PER_DAY);
    },
  };
  return axis;
}

// ── Instelling + bedrading ────────────────────────────────────────────────────────────────────────
//
// `resolveGanttAxis`/`isCompressedEffective` zijn de ÉÉN gedeelde chokepoint-helpers die GanttRenderer,
// HistogramRenderer én GanttCanvas allemaal identiek aanroepen om de vlag naar een concrete as om te
// zetten — zodat de "kies CalendarAxis vs WorkdayAxis"-beslissing (inclusief de randgeval-guard:
// een kalender zonder werkdagen mag de as niet laten "instorten") maar op ÉÉN plek staat, niet in elke
// aanroeper apart gedupliceerd.

export interface ResolveGanttAxisOptions {
  /** Kalender waarop de as werkdagen bepaalt (uitsluitend via de publieke CalendarEngine-API). */
  calendar: CalendarEngine;
  /** De instelling (`ui.compressNonWorkdays`). Zie `isCompressedEffective` voor de effectieve waarde. */
  compressNonWorkdays: boolean;
  origin: Date;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

/**
 * Is de as, gegeven de instelling én de kalender, DAADWERKELIJK gecomprimeerd? Randgeval:
 * een kalender zonder één enkele werkdag (`hasWorkingDays()===false`) kan geen werkdagen-as leveren
 * ("de as stort in") — dan blijft het effectief UIT, ongeacht de instelling. Aparte export zodat
 * bedrading (bv. de grid-arcering-keuze in `GanttRenderer`) dezelfde beslissing kan lezen zonder de
 * as zelf te hoeven bouwen.
 */
export function isCompressedEffective(calendar: CalendarEngine, compressNonWorkdays: boolean): boolean {
  return compressNonWorkdays && calendar.hasWorkingDays();
}

/**
 * Kiest `CalendarAxis` vs `WorkdayAxis` op de vlag, met de guard: vlag AAN maar
 * geen enkele werkdag ⇒ terugvallen op `CalendarAxis` + console-warning, GEEN crash/throw. Toggle
 * UIT (of de guard triggert) levert exact `buildCalendarAxis(...)` op.
 */
export function resolveGanttAxis(options: ResolveGanttAxisOptions): GanttAxis {
  const { calendar, compressNonWorkdays, origin, chartOriginX, zoom, scrollX } = options;
  if (compressNonWorkdays) {
    if (calendar.hasWorkingDays()) {
      return buildWorkdayAxis({ calendar, origin, chartOriginX, zoom, scrollX });
    }
    console.warn(
      'compressNonWorkdays: de kalender heeft geen enkele werkdag — val terug op de kalender-as ' +
        '(issue #21 punt 5, randgeval §9.4).',
    );
  }
  return buildCalendarAxis({ origin, chartOriginX, zoom, scrollX });
}
