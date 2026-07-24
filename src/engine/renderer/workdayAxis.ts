// WorkdayAxis — de gecomprimeerde werkdagen-as (issue #21 punt 5, fase 1).
// Ontwerp: docs/superpowers/werkdagen-as-ontwerp.md §2 (WorkdayAxis-laag), met de BINDENDE
// correctie uit §10.5: `CalendarEngine`'s interne structuren (workDayMask, holidayDaySet, …)
// zijn PRIVATE. Deze laag bouwt daarom uitsluitend op de PUBLIEKE CalendarEngine-API
// (`isWorkDay`, `nextWorkDay`/`prevWorkDay`, `workDaysBetween`, `addWorkDays`,
// `hasWorkingDays`) — geen toegang tot interne velden.
//
// Headless, nog NIET aangesloten op de renderer/UI (geen toggle, geen renderer-bedrading —
// dat is fase 2/3). Dit bestand levert twee `GanttAxis`-implementaties:
//   - `buildCalendarAxis`  — dunne wrapper om de bestaande fase-0-`dateToX`/`xToDate`
//     (lineaire kalender-as, byte-identiek aan vandaag).
//   - `buildWorkdayAxis`   — de nieuwe prefix-som-mapping die niet-werkdagen comprimeert.
// Fase 2 hoeft dan alleen nog één van de twee te kiezen (`opts.compressNonWorkdays`).

import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { MS_PER_DAY, dateToX as calendarDateToX, xToDate as calendarXToDate, GanttAxis } from './timeAxis';

// ── Kalender-as (variant A van §2.1): dunne wrapper om de fase-0-functies ────────────────────

export interface CalendarAxisOptions {
  /** Datum die op `dateToX(origin) === taskTableWidth - scrollX` landt. */
  origin: Date;
  taskTableWidth: number;
  zoom: number;
  scrollX: number;
}

/**
 * Bouwt de lineaire kalender-as als `GanttAxis` — een letterlijke, ongewijzigde doorverwijzing
 * naar de fase-0-`dateToX`/`xToDate` uit `timeAxis.ts`. Bestaat zodat fase 2/3 kunnen kiezen
 * tussen `CalendarAxis` en `WorkdayAxis` zonder de call-sites te hoeven vertakken op een
 * boolean — beide implementeren dezelfde `GanttAxis`-vorm. Geen enkele bestaande call-site
 * wijzigt hierdoor; dit is een NIEUW, optioneel aanroep-pad.
 */
export function buildCalendarAxis(options: CalendarAxisOptions): GanttAxis {
  const { origin, taskTableWidth, zoom, scrollX } = options;
  return {
    dateToX: (date: Date) => calendarDateToX(date, origin, taskTableWidth, zoom, scrollX),
    xToDate: (x: number) => calendarXToDate(x, origin, taskTableWidth, zoom, scrollX),
    daySpan: (from: Date, to: Date) => (to.getTime() - from.getTime()) / MS_PER_DAY,
    dayIndexOf: (date: Date) => (date.getTime() - origin.getTime()) / MS_PER_DAY,
    dateAtIndex: (index: number) => new Date(origin.getTime() + index * MS_PER_DAY),
  };
}

// ── Werkdagen-as (§2.2-§2.4) ─────────────────────────────────────────────────────────────────

/** UTC-dagindex — `floor(ms/MS_PER_DAY)`. Bewust IDENTIEK aan `CalendarEngine.isWorkDay`'s eigen
 *  dagindexering (epoch op UTC-middernacht, geen DST-drift), zodat de twee lagen nooit uiteenlopen
 *  over "welke dag hoort bij welke ms". */
function utcDayIndex(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

function dateFromUtcDayIndex(dayIdx: number): Date {
  return new Date(dayIdx * MS_PER_DAY);
}

/** Willekeurig maar VAST rekenkundig anker voor de absolute werkdag-telling (§2.2): de UNIX-epoch.
 *  Puur een referentiepunt — geen domeinbetekenis. Nodig zodat `dayIndexOf`/`dateAtIndex` een
 *  stabiele waarde teruggeven die niet verschuift wanneer het venster later (lazy) groeit
 *  (`ensureContains`); groei bouwt het venster opnieuw op, maar de absolute index-telling
 *  (afstand tot de epoch) blijft ongewijzigd. */
const EPOCH = new Date(0);

export interface WorkdayAxisOptions {
  /** Kalender waarop de as werkdagen bepaalt (uitsluitend via de publieke CalendarEngine-API). */
  calendar: CalendarEngine;
  /** Datum die op `dateToX(origin) === taskTableWidth - scrollX` landt (meestal `viewStart`). */
  origin: Date;
  taskTableWidth: number;
  zoom: number;
  scrollX: number;
  /** Initiële venster-padding (in KALENDERdagen) rond `origin`, elke kant. Klein houden — het
   *  venster groeit lazy (on-demand) mee met wat er daadwerkelijk wordt opgevraagd (§2.5). */
  initialPaddingDays?: number;
}

const DEFAULT_INITIAL_PADDING_DAYS = 30;
/** Elke groei-stap breidt het venster met dit aantal kalenderdagen uit (zowel bij "net iets
 *  erbuiten" als bij het zoeken naar een werkdag-index ver weg — §2.2 lazy-groei). */
const GROWTH_CHUNK_DAYS = 400;
/** Hard plafond op de venstergrootte (kalenderdagen, ≈ 137 jaar) — voorkomt dat een extreem
 *  ver-weg-liggende query (bug, corrupt bestand, …) een steeds groter array alloceert. Voorbij dit
 *  plafond valt de as terug op de altijd-correcte `CalendarEngine`-rekenkunde (§2.2
 *  out-of-range-fallback): O(n) i.p.v. O(1), maar zeldzaam op het hot path (§2.2). */
const MAX_WINDOW_DAYS = 50_000;

/**
 * Bouwt een `WorkdayAxis` (§2.2) vanaf een `CalendarEngine` + origin-datum. Elke aanroep is een
 * verse instantie — GEEN globale singleton, geen impliciete cache tussen calls (§2.5): wil de
 * aanroeper de as herbouwen na een kalendermutatie, dan roept hij deze factory gewoon opnieuw aan.
 *
 * Gooit een fout als de kalender geen enkele werkdag heeft (`hasWorkingDays()===false`,
 * randgeval §9.4) — een lege werkweek kan geen zinvolle werkdagen-as opleveren ("de as stort in").
 * De aanroeper (fase 2/3-bedrading) hoort dit af te vangen en op `CalendarAxis` terug te vallen +
 * een console-warning te geven; dat is UI-beleid en hoort niet in deze headless laag.
 */
export function buildWorkdayAxis(options: WorkdayAxisOptions): GanttAxis {
  const { calendar, origin, taskTableWidth, zoom, scrollX } = options;
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
  let workDayList: number[] = []; // oplopende UTC-dagindices van werkdagen in het venster (§2.2)
  let preWindowCount = 0;

  /**
   * (Her)bouwt het venster van dagindex `start` t/m `end` (inclusief). O(lengte).
   *
   * BELANGRIJK (gevonden tijdens het schrijven van de check-batterij, §9.5-clamp): dagen vóór de
   * EPOCH (`dIdx < 0`) tellen NERGENS mee als werkdag voor de absolute telling — dat is dezelfde
   * clamp die `preWindowCount` hieronder al toepast (`start<=0` ⇒ 0). Als deze lus dagen vóór de
   * epoch WEL zou meetellen (ze zijn qua weekdag/feestdag heus "werkdagen"), dan raakt de telling
   * uit de pas zodra het venster ooit terug groeit tot voorbij de epoch (`dateAtIndex` met een
   * sterk negatieve index, §9.5) — de rest van de as zou daarna stilzwijgend té hoog tellen. Vandaar
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
    // clamp: er "bestaan" geen werkdagen vóór de epoch in deze telling — §9.5).
    preWindowCount = start > 0 ? calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(start - 1)) : 0;
  }

  buildWindow(utcDayIndex(origin) - initialPadding, utcDayIndex(origin) + initialPadding);

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
   *  (na eventuele groei), anders O(log n) via `CalendarEngine.workDaysBetween` (§2.2 fallback —
   *  altijd correct, alleen niet altijd O(1)). */
  function countThroughDay(dayIdx: number): number {
    if (ensureContainsDay(dayIdx)) {
      return preWindowCount + prefix[dayIdx - windowStart];
    }
    return calendar.workDaysBetween(EPOCH, dateFromUtcDayIndex(dayIdx));
  }

  /** 0-based werkdag-index van `date` (§2.2/§2.4). Werkdag `d` → index van `d` in de globale
   *  werkdagenrij. Niet-werkdag `d` → KLEEF-RECHTS (§2.4): dezelfde index als de eerstvolgende
   *  werkdag (de "naad"). Dit volgt rechtstreeks uit de prefix-telling: `countThroughDay(d)` telt
   *  werkdagen tot-en-met `d`; op een niet-werkdag is dat gelijk aan het 0-based indexnummer van de
   *  eerstvolgende werkdag (die immers de `countThroughDay(d)+1`-ste werkdag zal zijn). */
  function workdayIndexOfDay(dayIdx: number): number {
    const isWork = calendar.isWorkDay(dateFromUtcDayIndex(dayIdx));
    return countThroughDay(dayIdx) - (isWork ? 1 : 0);
  }

  /** Sub-dag-fractie binnen een werkdag-kolom (§2.3): `[0,1)` op een werkdag, anders 0 (een
   *  niet-werkdag heeft geen eigen kolom om binnen te interpoleren — kleeft naadloos op de naad). */
  function intraDayFraction(date: Date, dayIdx: number): number {
    if (!calendar.isWorkDay(date)) return 0;
    const dayStartMs = dayIdx * MS_PER_DAY;
    return (date.getTime() - dayStartMs) / MS_PER_DAY;
  }

  /** Fractionele werkdag-index (as-eenheden) van een datum, MET sub-dag-interpolatie. */
  function fractionalIndexOf(date: Date): number {
    const dIdx = utcDayIndex(date);
    return workdayIndexOfDay(dIdx) + intraDayFraction(date, dIdx);
  }

  // `origin` kan zelf op een niet-werkdag vallen (§9.3: bv. import zet `viewStart` op zaterdag) —
  // dan is `originIndex` de kleef-rechts-index van de eerstvolgende werkdag. Eén keer berekend
  // (de as is per-instantie immutable in zijn origin), gebruikt als nulpunt voor `dateToX`.
  const originIndex = fractionalIndexOf(origin);

  /** Inverse van `workdayIndexOfDay`: de UTC-dagindex van de `index`-ste (0-based) werkdag.
   *  Fast path: binnen het (eventueel gegroeide) venster via `workDayList` — O(1)/O(groei).
   *  Fallback (voorbij `MAX_WINDOW_DAYS`, zeldzaam): `CalendarEngine.addWorkDays` vanaf de epoch —
   *  O(index) maar altijd correct. `workDays<=0` clamt daar op de epoch zelf (bestaande
   *  CalendarEngine-semantiek) — dat is de gedocumenteerde "vóór origin/epoch"-clamp (§9.3/§9.5)
   *  voor een negatieve `index`. */
  function dayAtWorkdayIndex(index: number): number {
    // Groei het venster net zolang tot `index` binnen het gedekte bereik valt, of tot het
    // groei-plafond bereikt is (dan: fallback).
    while (index < preWindowCount || index >= preWindowCount + workDayList.length) {
      const needForward = index >= preWindowCount + workDayList.length;
      const newStart = needForward ? windowStart : windowStart - GROWTH_CHUNK_DAYS;
      const newEnd = needForward ? windowEnd + GROWTH_CHUNK_DAYS : windowEnd;
      if (newEnd - newStart + 1 > MAX_WINDOW_DAYS) {
        return utcDayIndex(calendar.addWorkDays(EPOCH, index + 1));
      }
      buildWindow(newStart, newEnd);
    }
    return workDayList[index - preWindowCount];
  }

  const axis: GanttAxis = {
    dateToX(date: Date): number {
      const idx = fractionalIndexOf(date);
      return taskTableWidth + (idx - originIndex) * zoom - scrollX;
    },
    xToDate(x: number): Date {
      const floatIdx = (x - taskTableWidth + scrollX) / zoom + originIndex;
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

// ── Fase 2 — instelling + bedrading (issue #21 punt 5, `werkdagen-as-ontwerp.md` §8 fase 2) ──────
//
// `resolveGanttAxis`/`isCompressedEffective` zijn de ÉÉN gedeelde chokepoint-helpers die GanttRenderer,
// HistogramRenderer én GanttCanvas allemaal identiek aanroepen om de vlag naar een concrete as om te
// zetten — zodat de "kies CalendarAxis vs WorkdayAxis"-beslissing (inclusief de §9.4-randgeval-guard:
// een kalender zonder werkdagen mag de as niet laten "instorten") maar op ÉÉN plek staat, niet in elke
// aanroeper apart gedupliceerd.

export interface ResolveGanttAxisOptions {
  /** Kalender waarop de as werkdagen bepaalt (uitsluitend via de publieke CalendarEngine-API). */
  calendar: CalendarEngine;
  /** De instelling (`ui.compressNonWorkdays`). Zie `isCompressedEffective` voor de effectieve waarde. */
  compressNonWorkdays: boolean;
  origin: Date;
  taskTableWidth: number;
  zoom: number;
  scrollX: number;
}

/**
 * Is de as, gegeven de instelling én de kalender, DAADWERKELIJK gecomprimeerd? Randgeval §9.4:
 * een kalender zonder één enkele werkdag (`hasWorkingDays()===false`) kan geen werkdagen-as leveren
 * ("de as stort in") — dan blijft het effectief UIT, ongeacht de instelling. Aparte export zodat
 * bedrading (bv. de grid-arcering-keuze in `GanttRenderer`) dezelfde beslissing kan lezen zonder de
 * as zelf te hoeven bouwen.
 */
export function isCompressedEffective(calendar: CalendarEngine, compressNonWorkdays: boolean): boolean {
  return compressNonWorkdays && calendar.hasWorkingDays();
}

/**
 * Kiest `CalendarAxis` vs `WorkdayAxis` op de vlag (§8 fase 2), met de §9.4-guard: vlag AAN maar
 * geen enkele werkdag ⇒ terugvallen op `CalendarAxis` + console-warning, GEEN crash/throw. Toggle
 * UIT (of de guard triggert) levert exact `buildCalendarAxis(...)` op — byte-identiek aan vandaag.
 */
export function resolveGanttAxis(options: ResolveGanttAxisOptions): GanttAxis {
  const { calendar, compressNonWorkdays, origin, taskTableWidth, zoom, scrollX } = options;
  if (compressNonWorkdays) {
    if (calendar.hasWorkingDays()) {
      return buildWorkdayAxis({ calendar, origin, taskTableWidth, zoom, scrollX });
    }
    console.warn(
      'compressNonWorkdays: de kalender heeft geen enkele werkdag — val terug op de kalender-as ' +
        '(issue #21 punt 5, randgeval §9.4).',
    );
  }
  return buildCalendarAxis({ origin, taskTableWidth, zoom, scrollX });
}
