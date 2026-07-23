import { addCalendarDays } from '@/utils/dateUtils';
import type { TimeScale } from '@/types/view';

/**
 * Tijdschaal-presets (fase 2.7, §3.3): een dropdown-keuze mapt naar een zoom (px/dag). De presets
 * landen midden in de bijbehorende `pickTiers`-band, zodat `scaleFromZoom` round-trip-stabiel de
 * gekozen schaal teruggeeft. `view.timeScale` is GEEN bron van waarheid meer — `pickTiers`/`zoom`
 * blijven dat; de getoonde schaal wordt afgeleid via `scaleFromZoom`.
 */
export const TIMESCALE_ZOOM: Record<TimeScale, number> = {
  year: 3,
  quarter: 8,
  month: 18,
  week: 45,
  day: 100,
  // Fase 2.8b (§6.2): uur-preset, midden in de 'hour'-band (zoom≥300 in `scaleFromZoom`), zodat
  // de keuze round-trip-stabiel 'hour' teruggeeft. Ligt onder de dag-max (400) ⇒ altijd bereikbaar,
  // ook zonder kwartier-zoom.
  hour: 350,
};

/**
 * Leidt de getoonde tijdschaal af uit de zoom (§3.2). Leest dezelfde banden als `pickTiers`.
 * Fase 2.8b (§6.2): de 'hour'-schaal verschijnt ALLEEN als `hourPlanningEnabled` (de hoofdschakelaar
 * Urenplanning) aan staat; anders blijft de reeks dag-granulair zoals vóór 2.8b (label 'day' bij
 * ver inzoomen). De uur/kwartier-tiers zelf worden nog steeds door `pickTiers` getekend — dit raakt
 * alleen het schaal-LABEL (dropdown + statusbalk).
 */
export function scaleFromZoom(zoom: number, hourPlanningEnabled = false): TimeScale {
  if (zoom < 4) return 'year';
  if (zoom < 10) return 'quarter';
  if (zoom < 25) return 'month';
  if (zoom < 80) return 'week';
  if (hourPlanningEnabled && zoom >= 300) return 'hour';
  return 'day'; // >=80: dag/uur-tiers; label 'day' tenzij urenplanning aan én ver ingezoomd
}

export type TimelineTier =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'quarterHour';

export interface TierConfig {
  tier: TimelineTier;
  /** Minimum pixel width a label of this tier needs to be readable. Used as a defensive skip-rule. */
  minLabelWidth: number;
  /**
   * Step from one tick to the next, in fractional days.
   * For tiers larger than a day this is approximate (months/years vary); the renderer
   * uses the date-based "next boundary" function instead. For sub-day tiers it's exact.
   */
  stepDays: number;
}

export const TIER_CONFIG: Record<TimelineTier, TierConfig> = {
  year:        { tier: 'year',        minLabelWidth: 60, stepDays: 365 },
  quarter:     { tier: 'quarter',     minLabelWidth: 40, stepDays: 90 },
  month:       { tier: 'month',       minLabelWidth: 50, stepDays: 30 },
  week:        { tier: 'week',        minLabelWidth: 28, stepDays: 7 },
  day:         { tier: 'day',         minLabelWidth: 18, stepDays: 1 },
  hour:        { tier: 'hour',        minLabelWidth: 28, stepDays: 1 / 24 },
  quarterHour: { tier: 'quarterHour', minLabelWidth: 28, stepDays: 1 / 96 },
};

/**
 * Kiest de tier-combinatie voor de gegeven zoom (px/dag). De QH-tier wordt alleen gebruikt
 * als enableQuarterHour aan staat.
 * issue #21 punt 2: in de dagweergave-band (25≤zoom<80) wordt optioneel een `mid`-tier
 * ('week') meegegeven, zodat weeknummers als extra middenrij tussen maand en dag getekend
 * worden. Alle andere banden blijven zonder `mid` (byte-identiek ten opzichte van vóór #21).
 */
export function pickTiers(
  zoom: number,
  enableQuarterHour: boolean
): { major: TimelineTier; mid?: TimelineTier; minor: TimelineTier } {
  if (zoom < 4) return { major: 'year', minor: 'quarter' };
  // issue #21 pt. 2: was year/month — het maandlabel bevat het jaartal al ('Jul 2026'), dus de
  // jaar-rij was grotendeels leeg en bij uitzoomen versprong het maandfont van major (bold) naar
  // minor. Met month als major blijft de maand de bold rij én blijven weeknummers zichtbaar tot
  // zoom 4 (7·4=28px = precies minLabelWidth van de week-tier; drawTierLabels vangt de krapste af).
  if (zoom < 10) return { major: 'month', minor: 'week' };
  if (zoom < 25) return { major: 'month', minor: 'week' };
  // issue #21 punt 2: dagweergave — voeg de weeknummer-middenrij toe (mid:'week').
  if (zoom < 80) return { major: 'month', mid: 'week', minor: 'day' };
  if (zoom < 400 || !enableQuarterHour) return { major: 'day', minor: 'hour' };
  return { major: 'hour', minor: 'quarterHour' };
}

/**
 * Given a starting date and a tier, return the date of the next tick boundary
 * (e.g. for 'month', the first of next month). For sub-day tiers, returns
 * `from + stepDays`.
 */
export function nextTickBoundary(from: Date, tier: TimelineTier): Date {
  switch (tier) {
    case 'year':
      return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
    case 'quarter': {
      const m = from.getUTCMonth();
      const nextQ = Math.floor(m / 3) * 3 + 3;
      if (nextQ >= 12) return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
      return new Date(Date.UTC(from.getUTCFullYear(), nextQ, 1));
    }
    case 'month': {
      const m = from.getUTCMonth();
      if (m === 11) return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
      return new Date(Date.UTC(from.getUTCFullYear(), m + 1, 1));
    }
    case 'week':
      return addCalendarDays(from, 7);
    case 'day':
      return addCalendarDays(from, 1);
    case 'hour': {
      const r = new Date(from.getTime());
      r.setUTCHours(r.getUTCHours() + 1, 0, 0, 0);
      return r;
    }
    case 'quarterHour': {
      const r = new Date(from.getTime());
      r.setUTCMinutes(r.getUTCMinutes() + 15, 0, 0);
      return r;
    }
  }
}

/** Snap a date back to the start of its current tick (e.g. start of month). */
export function snapToTickStart(date: Date, tier: TimelineTier, weekStartDay: 'monday' | 'sunday' = 'monday'): Date {
  switch (tier) {
    case 'year':
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    case 'quarter': {
      const m = date.getUTCMonth();
      return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(m / 3) * 3, 1));
    }
    case 'month':
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    case 'week': {
      const r = new Date(date.getTime());
      const dow = r.getUTCDay();           // 0=Sun..6=Sat
      const offset = weekStartDay === 'sunday' ? dow : (dow === 0 ? 6 : dow - 1);
      r.setUTCDate(r.getUTCDate() - offset);
      r.setUTCHours(0, 0, 0, 0);
      return r;
    }
    case 'day': {
      const r = new Date(date.getTime());
      r.setUTCHours(0, 0, 0, 0);
      return r;
    }
    case 'hour': {
      const r = new Date(date.getTime());
      r.setUTCMinutes(0, 0, 0);
      return r;
    }
    case 'quarterHour': {
      const r = new Date(date.getTime());
      r.setUTCMinutes(Math.floor(r.getUTCMinutes() / 15) * 15, 0, 0);
      return r;
    }
  }
}
