import { addCalendarDays, addCalendarMonths, formatDate, parseDate } from '@/utils/dateUtils';

/**
 * De rapportageperiode (issue #120, manuvarkey): één gedeeld periodemodel voor alle rapporten die
 * op een tijdvenster werken — look-ahead, voortgang, resourcebelasting en resourcetoewijzingen.
 *
 * Een periode is een PRESET (relatief aan de referentiedag: statusdatum, anders vandaag) of een
 * vaste keuze: `project` (de hele projectspanne) of `custom` (twee ISO-dagen). Alleen `custom`
 * draagt eigen datums; een preset wordt bij elke berekening opnieuw opgelost, zodat een gewijzigde
 * statusdatum het venster automatisch mee verschuift (aanbeveling uit het issue).
 *
 * Vensterconventie — inclusief aan beide kanten, en byte-identiek aan de oude "N weken"-opties:
 * - `nextNWeeks`  = [ref, ref + 7N − 1]   (4 weken vanaf do 10 sep ⇒ t/m wo 7 okt, zoals het issue)
 * - `lastNWeeks`  = [ref − 7N + 1, ref]
 * - `nextMonth`   = [ref, ref + 1 maand − 1 dag]; `lastMonth` = [ref − 1 maand + 1 dag, ref]
 *   (maandrekenen klemt op de maandlengte: 31 jan → 28 feb, zie `addCalendarMonths`)
 *
 * Alles hier is puur: geen store, geen React, geen i18n. De UI labelt de presets via `t()`.
 */
export const REPORTING_PERIOD_PRESETS = [
  'nextWeek', 'next2Weeks', 'next4Weeks', 'next6Weeks', 'next8Weeks', 'next12Weeks', 'nextMonth',
  'lastWeek', 'last2Weeks', 'last4Weeks', 'last6Weeks', 'last8Weeks', 'last12Weeks', 'lastMonth',
  'project', 'custom',
] as const;
export type ReportingPeriodPreset = (typeof REPORTING_PERIOD_PRESETS)[number];

export interface ReportingPeriod {
  preset: ReportingPeriodPreset;
  /** Alleen betekenisvol bij `custom` (ISO-dag, inclusief). */
  from?: string;
  /** Alleen betekenisvol bij `custom` (ISO-dag, inclusief). */
  to?: string;
}

/** Een opgelost venster: twee ISO-dagen, `from ≤ to`. */
export interface ResolvedPeriod {
  from: string;
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Geldige ISO-dag (bestaand, `YYYY-MM-DD`) — `parseDate` accepteert ook 2026-02-31, deze niet. */
export function isIsoDay(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return false;
  const d = parseDate(raw);
  return !isNaN(d.getTime()) && formatDate(d) === raw;
}

/** Een `custom`-periode is compleet én geordend; presets zijn altijd geldig. */
export function isValidReportingPeriod(p: ReportingPeriod): boolean {
  if (p.preset !== 'custom') return true;
  return isIsoDay(p.from) && isIsoDay(p.to) && p.from <= p.to;
}

/** Aantal weken van een `next*Weeks`/`last*Weeks`-preset, anders undefined. */
function presetWeeks(preset: ReportingPeriodPreset): number | undefined {
  const m = /^(next|last)(\d*)Weeks?$/.exec(preset);
  if (!m) return undefined;
  return m[2] === '' ? 1 : Number(m[2]);
}

/** Vertaal een oude "N weken"-instelling naar de kleinste preset die die N dekt (1→1, 3→4, 9→12). */
export function weeksToPreset(weeks: number, direction: 'next' | 'last'): ReportingPeriodPreset {
  const steps = [1, 2, 4, 6, 8, 12];
  const n = steps.find(s => s >= weeks) ?? 12;
  return (n === 1 ? `${direction}Week` : `${direction}${n}Weeks`) as ReportingPeriodPreset;
}

/**
 * Los een periode op tegen de referentiedag. `projectSpan` is het venster voor `project` (en de
 * terugval voor een ongeldige `custom`); ontbreekt die (leeg project), dan valt het samen op de
 * referentiedag zelf — een leeg rapport, geen exception.
 */
export function resolveReportingPeriod(period: ReportingPeriod, refDay: string, projectSpan?: ResolvedPeriod): ResolvedPeriod {
  const ref = parseDate(refDay);
  const weeks = presetWeeks(period.preset);
  if (weeks !== undefined) {
    const days = weeks * 7;
    return period.preset.startsWith('next')
      ? { from: refDay, to: formatDate(addCalendarDays(ref, days - 1)) }
      : { from: formatDate(addCalendarDays(ref, -(days - 1))), to: refDay };
  }
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

/** Lengte van een venster in kalenderdagen (inclusief), minimaal 1. */
export function periodDays(p: ResolvedPeriod): number {
  const a = parseDate(p.from);
  const b = parseDate(p.to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}
