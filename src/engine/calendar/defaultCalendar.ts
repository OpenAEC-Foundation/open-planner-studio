import { generateHolidays, NL_SET } from '@/engine/calendar/holidays';
import type { WorkCalendar } from '@/types/calendar';

/**
 * Standaard bouwkalender (NL, ma-vr). Jaar-onafhankelijk (fase 2.8a, §3.4): de feestdagen worden
 * regelgebaseerd gegenereerd voor `anchorYear-1 t/m anchorYear+2` — GEEN bouwvak (harde eis), MÉT
 * Kerst (die de oude hardgecodeerde 2026-lijst miste).
 *
 * Deze fabrieksfunctie leeft in de engine-laag (niet in `src/types/`) omdat ze `generateHolidays`
 * als WAARDE nodig heeft; anders ontstaat er een runtime-module-cyclus met `holidays.ts`.
 */
export function createDefaultCalendar(anchorYear: number = new Date().getFullYear()): WorkCalendar {
  const from = anchorYear - 1;
  const to = anchorYear + 2;
  return {
    id: 'cal-default',
    name: 'Bouwkalender NL',
    description: 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: generateHolidays(NL_SET, undefined, from, to),
    generation: { ruleSetId: 'NL', generatedFromYear: from, generatedToYear: to },
  };
}
