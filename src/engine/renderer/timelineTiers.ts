import { addCalendarDays } from '@/utils/dateUtils';

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
 * Pick the {major, minor} tier pair for the given zoom (pixels per day).
 * QH-tier is only used when enableQuarterHour is true.
 */
export function pickTiers(
  zoom: number,
  enableQuarterHour: boolean
): { major: TimelineTier; minor: TimelineTier } {
  if (zoom < 4) return { major: 'year', minor: 'quarter' };
  if (zoom < 10) return { major: 'year', minor: 'month' };
  if (zoom < 25) return { major: 'month', minor: 'week' };
  if (zoom < 80) return { major: 'month', minor: 'day' };
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
