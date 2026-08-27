import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';

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
  /** OPTIONEEL — herkomststempel wanneer deze kalender een kopie uit een bedrijfsbibliotheek is
   *  (spec B1, §2). Afwezig ⇒ handmatige/gegenereerde kalender. */
  libraryOrigin?: LibraryOrigin;
  /** OPTIONEEL — dag-uitzonderingen die een dag WERKEND maken (fase 3.8, MSP-pariteit T2; MS Project:
   *  "werkende uitzondering"). Afwezig ⇒ byte-identiek gedrag met vóór deze taak: geen enkele bestaande
   *  dag- of uur-lus raakt dit veld. INVARIANT (afgedwongen door de parser, T3/T4, niet hier): een datum
   *  komt nooit tegelijk in `holidays` én in `workingExceptions` voor. */
  workingExceptions?: WorkingException[];
}

/** Dag-uitzondering die werktijd TOEVOEGT/AANPAST op een anders niet-werkende dag (fase 3.8, T2;
 *  MS Project: "werkende uitzondering"). Precedentie t.o.v. `holidays` wordt door de parser opgelost
 *  (T3/T4) — de engine leest deze lijst alleen en gaat uit van een reeds per-datum-unieke invoer. */
export interface WorkingException {
  name: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
  /** Banden in minuten-vanaf-middernacht, zelfde canonieke vorm als `WorkTimeBands` (§3.2: `end > start`,
   *  een wrap-band mag `end ∈ (1440, 2880]`). Leeg/afwezig ⇒ FALLBACK-KETEN (fase 3.8, T2-review
   *  MIDDEN-2 — orkestratorbesluit, raakt alleen ons eigen model: MPXJ produceert nooit band-loos):
   *  (1) de eigen weekdag-banden van de kalender op díé weekdag (`workTime.byWeekday[dow]`), als die
   *  niet leeg zijn; anders (2) de STANDAARD-werkdagbanden van de kalender — de banden van de eerste
   *  `workDays`-weekdag die wél banden heeft (`CalendarEngine.computeStandardWorkdayBands`). Zónder deze
   *  fallback zou een band-loze uitzondering op een dag zonder eigen weekdagbanden (bv. een werkende
   *  zaterdag in een ma-vr-uurkalender) `isWorkDay`=true maar `workMinutesBetween`=0 opleveren — dag- en
   *  uurmodus zouden elkaar tegenspreken en ResourceLoad/workdayAxis een werkdag zonder capaciteit zien.
   *  In dag-modus telt de dag simpelweg als werkend zonder banden-detail (banden zijn daar irrelevant). */
  bands?: { start: number; end: number }[];
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
