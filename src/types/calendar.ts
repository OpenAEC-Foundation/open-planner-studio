import type { HolidayCountry } from '@/engine/calendar/holidays';
import { generateHolidays, NL_SET } from '@/engine/calendar/holidays';

export interface WorkCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[]; // 1=Monday ... 7=Sunday (ISO 8601 day of week)
  workStartHour: number; // e.g., 7
  workEndHour: number;   // e.g., 16
  hoursPerDay: number;   // net working hours (e.g., 8)
  holidays: Holiday[];   // GEMATERIALISEERDE exception-ranges (bron van waarheid voor de engine)
  /** OPTIONEEL — generatie-herkomst (fase 2.8a). Aanwezig ⇒ de feestdagen in `holidays` zijn door de
   *  engine gegenereerd en kunnen opnieuw worden gematerialiseerd bij projectperiode-wijziging.
   *  Afwezig ⇒ letterlijke/handmatige kalender (bestaande bestanden); nooit stil hergenereren. */
  generation?: CalendarGeneration;
}

/** Herkomst-metadata van een gegenereerde kalender (§2.1). Puur informatief — solver/renderer/IFC
 *  lezen alleen `holidays`. */
export interface CalendarGeneration {
  ruleSetId: HolidayCountry;                 // welke landenset de datums voortbracht
  region?: string;                           // Bundesland/landsdeel/kanton; undefined = landelijk
  breakChoice?: 'noord' | 'midden' | 'zuid'; // NL-bouwvak; undefined = geen (default)
  winterStop?: boolean;                      // vaste collectieve winterstop meegenomen
  generatedFromYear: number;                 // gematerialiseerde spanne (incl.)
  generatedToYear: number;
}

export interface Holiday {
  name: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
}

/**
 * Standaard bouwkalender (NL, ma-vr). Jaar-onafhankelijk (fase 2.8a, §3.4): de feestdagen worden
 * regelgebaseerd gegenereerd voor `anchorYear-1 t/m anchorYear+2` — GEEN bouwvak (harde eis), MÉT
 * Kerst (die de oude hardgecodeerde 2026-lijst miste).
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
