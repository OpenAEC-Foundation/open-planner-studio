import { addCalendarDays, addCalendarMonths, diffDays, formatDate, parseDate } from '@/utils/dateUtils';

export const REPORTING_PERIOD_PRESETS = [
  'nextWeek', 'next2Weeks', 'next4Weeks', 'next6Weeks', 'next8Weeks', 'next12Weeks', 'nextMonth',
  'lastWeek', 'last2Weeks', 'last4Weeks', 'last6Weeks', 'last8Weeks', 'last12Weeks', 'lastMonth',
  'project', 'custom',
] as const;
export type ReportingPeriodPreset = (typeof REPORTING_PERIOD_PRESETS)[number];

export interface ReportingPeriod {
  preset: ReportingPeriodPreset;
  from?: string;
  to?: string;
}

export interface ResolvedPeriod {
  from: string;
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return false;
  const d = parseDate(raw);
  return !isNaN(d.getTime()) && formatDate(d) === raw;
}

export function isValidReportingPeriod(p: ReportingPeriod): boolean {
  if (p.preset !== 'custom') return true;
  return isIsoDay(p.from) && isIsoDay(p.to) && p.from <= p.to;
}

function presetWeeks(preset: ReportingPeriodPreset): number | undefined {
  const m = /^(next|last)(\d*)Weeks?$/.exec(preset);
  if (!m) return undefined;
  return m[2] === '' ? 1 : Number(m[2]);
}

export function weeksToPreset(weeks: number, direction: 'next' | 'last'): ReportingPeriodPreset {
  const steps = [1, 2, 4, 6, 8, 12];
  const n = steps.find(s => s >= weeks) ?? 12;
  return (n === 1 ? `${direction}Week` : `${direction}${n}Weeks`) as ReportingPeriodPreset;
}

export function resolveReportingPeriod(period: ReportingPeriod, refDay: string, projectSpan?: ResolvedPeriod): ResolvedPeriod {
  const weeks = presetWeeks(period.preset);
  if (weeks !== undefined) {
    return period.preset.startsWith('next')
      ? { from: refDay, to: windowEnd(refDay, weeks * 7) }
      : { from: windowStart(refDay, weeks * 7), to: refDay };
  }
  const ref = parseDate(refDay);
  switch (period.preset) {
    case 'nextMonth':
      return { from: refDay, to: formatDate(addCalendarDays(addCalendarMonths(ref, 1), -1)) };
    case 'lastMonth':
      return { from: formatDate(addCalendarDays(addCalendarMonths(ref, -1), 1)), to: refDay };
    case 'custom':
      if (isValidReportingPeriod(period)) return { from: period.from!, to: period.to! };
      return projectSpan ?? { from: refDay, to: refDay };
    case 'project':
    default:
      return projectSpan ?? { from: refDay, to: refDay };
  }
}

export function periodDays(p: ResolvedPeriod): number {
  return Math.max(1, diffDays(p.from, p.to) + 1);
}

export function windowEnd(fromDay: string, days: number): string {
  return formatDate(addCalendarDays(parseDate(fromDay), Math.max(0, days - 1)));
}

export function windowStart(toDay: string, days: number): string {
  return formatDate(addCalendarDays(parseDate(toDay), -Math.max(0, days - 1)));
}
