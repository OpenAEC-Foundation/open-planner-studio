import { addCalendarDays, getMonthStart, getWeekStartFor, utcDayStart } from '@/utils/dateUtils';
import type { TimeScale } from '@/types/view';

export const TIMESCALE_ZOOM: Record<TimeScale, number> = {
  year: 3,
  quarter: 8,
  month: 18,
  week: 45,
  day: 100,
  hour: 1000,
};

export const MAX_DAY_ZOOM = 400;
export const MAX_HOUR_ZOOM = 1000;
export const MAX_QUARTER_HOUR_ZOOM = 4000;

export function maxGanttZoom(enableQuarterHourZoom: boolean): number {
  return enableQuarterHourZoom ? MAX_QUARTER_HOUR_ZOOM : MAX_HOUR_ZOOM;
}

export function scaleFromZoom(zoom: number): TimeScale {
  if (zoom < 4) return 'year';
  if (zoom < 10) return 'quarter';
  if (zoom < 25) return 'month';
  if (zoom < 80) return 'week';
  return zoom < MAX_DAY_ZOOM ? 'day' : 'hour';
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
  minLabelWidth: number;
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

export function pickTiers(
  zoom: number,
  enableQuarterHour: boolean
): { major: TimelineTier; mid?: TimelineTier; minor: TimelineTier } {
  if (zoom < 4) return { major: 'year', minor: 'quarter' };
  if (zoom < 10) return { major: 'month', minor: 'week' };
  if (zoom < 25) return { major: 'month', minor: 'week' };
  if (zoom < 80) return { major: 'month', mid: 'week', minor: 'day' };
  if (zoom < MAX_DAY_ZOOM) return { major: 'month', mid: 'week', minor: 'day' };
  if (zoom < MAX_HOUR_ZOOM || !enableQuarterHour) return { major: 'day', minor: 'hour' };
  return { major: 'hour', minor: 'quarterHour' };
}

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

export function snapToTickStart(date: Date, tier: TimelineTier, weekStartDay: 'monday' | 'sunday' = 'monday'): Date {
  switch (tier) {
    case 'year':
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    case 'quarter': {
      const m = date.getUTCMonth();
      return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(m / 3) * 3, 1));
    }
    case 'month':
      return getMonthStart(date);
    case 'week':
      return utcDayStart(getWeekStartFor(date, weekStartDay));
    case 'day':
      return utcDayStart(date);
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
