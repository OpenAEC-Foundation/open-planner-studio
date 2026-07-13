import type { HolidayCountry } from '@/engine/calendar/holidays';

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
  /** OPTIONEEL — per-weekdag werktijd-banden (fase 2.8b, §3.2). Aanwezig ⇒ UUR-kalender
   *  (minuut-native scheduling). Afwezig ⇒ DAG-kalender (bevroren dag-lussen, byte-identiek). */
  workTime?: WorkTimeBands;
  /** OPTIONEEL — ploeg-classificatie voor IFC-`PredefinedType` (fase 2.8b, §7.1). Afwezig ⇒
   *  `.FIRSTSHIFT.` (byte-identiek met bestaande bestanden). */
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
}

/**
 * Werktijd-banden per ISO-weekdag (1=ma..7=zo), fase 2.8b §3.2. Een weekdag zonder banden =
 * niet-werkend. Een band is `[start, end)` in MINUTEN-VANAF-MIDDERNACHT van de STARTdag.
 *
 * CANONIEK: `end > start` (Bevinding 7). Een wrap-band (over middernacht) heeft
 * `end ∈ (1440, 2880]` en telt bij de STARTdag (P6/Asta-conventie: een shift begint op zijn
 * weekdag en mag 24u overspannen). De alternatieve encoding met een niet-oplopende grens is
 * ONGELDIG en wordt bij inlezen genormaliseerd (`end += 1440`), zodat er precies één
 * representatie in omloop is. Banden per dag zijn gesorteerd, niet-overlappend en canoniek.
 */
export interface WorkTimeBands {
  byWeekday: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>;
}

/** Herkomst-metadata van een gegenereerde kalender (§2.1). Puur informatief — solver/renderer/IFC
 *  lezen alleen `holidays`. */
export interface CalendarGeneration {
  ruleSetId: HolidayCountry;                 // welke landenset de datums voortbracht
  region?: string;                           // Bundesland/landsdeel/kanton; undefined = landelijk
  breakChoice?: 'noord' | 'midden' | 'zuid'; // NL-bouwvak; undefined = geen (default)
  generatedFromYear: number;                 // gematerialiseerde spanne (incl.)
  generatedToYear: number;
}

export interface Holiday {
  name: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
}
