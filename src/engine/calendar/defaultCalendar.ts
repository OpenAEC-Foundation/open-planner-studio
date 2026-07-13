import { generateHolidays, NL_SET } from '@/engine/calendar/holidays';
import type { WorkCalendar } from '@/types/calendar';
import { loadConstructionMode } from '@/utils/settingsStore';

/**
 * Standaard bouwkalender (NL, ma-vr). Jaar-onafhankelijk (fase 2.8a, §3.4): de feestdagen worden
 * regelgebaseerd gegenereerd voor `anchorYear-1 t/m anchorYear+2` — GEEN bouwvak (harde eis), MÉT
 * Kerst (die de oude hardgecodeerde 2026-lijst miste).
 *
 * Bouwmodus (2026-07-13): in bouw-agnostische modus (bouwmodus UIT) levert de fabriek een NEUTRALE
 * kalender op — naam "Standaardkalender", GEEN NL-feestdagen (equivalent aan `country: 'none'`, dus
 * `generation: undefined`). In bouwmodus (default AAN) exact ongewijzigd: "Bouwkalender NL" + NL-
 * feestdagen. De vlag is app-niveau localStorage; deze synchrone fabriek leest 'm rechtstreeks
 * (`loadConstructionMode`). De kalendernamen blijven bewust hardcoded (geen t()).
 *
 * Deze fabrieksfunctie leeft in de engine-laag (niet in `src/types/`) omdat ze `generateHolidays`
 * als WAARDE nodig heeft; anders ontstaat er een runtime-module-cyclus met `holidays.ts`.
 */
export function createDefaultCalendar(anchorYear: number = new Date().getFullYear()): WorkCalendar {
  const from = anchorYear - 1;
  const to = anchorYear + 2;
  const construction = loadConstructionMode();
  return {
    id: 'cal-default',
    name: construction ? 'Bouwkalender NL' : 'Standaardkalender',
    description: construction
      ? 'Standaard bouwkalender: ma-vr 07:00-16:00'
      : 'Standaardkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: construction ? generateHolidays(NL_SET, undefined, from, to) : [],
    generation: construction ? { ruleSetId: 'NL', generatedFromYear: from, generatedToYear: to } : undefined,
  };
}
