import type { HolidayCountry } from '@/engine/calendar/holidays';
import type { LibraryOrigin } from '@/types/library';

/** Diagnose van de P6/XER-penalty-pset na IFC-inlezen. `REJECTED` en `ABSENT` maken expliciet
 * dat P6-kalendersemantiek NIET is geactiveerd; alleen de twee geldige staten dragen `p6Source`. */
export type P6NonWorkPenaltyDatesState = 'ABSENT' | 'VALID_EMPTY' | 'VALID_VALUES' | 'REJECTED';

export interface WorkCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[]; // 1=Monday ... 7=Sunday (ISO 8601 day of week)
  workStartHour: number; // e.g., 7
  workEndHour: number;   // e.g., 16
  hoursPerDay: number;   // net working hours (e.g., 8)
  /**
   * Optioneel eenvoudig pauzepatroon voor scalaire kalenders. De begintijd is minuten vanaf
   * middernacht en de duur is minuten. Alleen wanneer er géén expliciete `workTime`-banden zijn,
   * leidt `effectiveWorkTime` hieruit de netto werkbanden af. Afwezig ⇒ het verschil tussen
   * klokspanne en `hoursPerDay` wordt rond 12:00 gelegd.
   */
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
  holidays: Holiday[];   // GEMATERIALISEERDE exception-ranges (bron van waarheid voor de engine)
  /** Generatieherkomst. Aanwezig ⇒ de feestdagen in `holidays` zijn door de engine gegenereerd en
   *  kunnen opnieuw worden gematerialiseerd bij een wijziging van de projectperiode. Afwezig ⇒
   *  letterlijke/handmatige kalender; nooit stil hergenereren. */
  generation?: CalendarGeneration;
  /** Werktijdbanden per weekdag. Aanwezig ⇒ UUR-kalender (minuut-native scheduling). Afwezig ⇒
   *  DAG-kalender. */
  workTime?: WorkTimeBands;
  /** Ploegclassificatie voor IFC-`PredefinedType`. Afwezig ⇒ `.FIRSTSHIFT.`. */
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
  /** Herkomststempel wanneer deze kalender een kopie uit een resourcebibliotheek is. Afwezig ⇒
   *  handmatige/gegenereerde kalender. */
  libraryOrigin?: LibraryOrigin;
  /** Dag-uitzonderingen die een dag WERKEND maken (MS Project: "werkende uitzondering"). INVARIANT
   *  (afgedwongen door de parser, niet hier): een datum staat nooit tegelijk in `holidays` én in
   *  `workingExceptions`. */
  workingExceptions?: WorkingException[];
  /**
   * Expliciete herkomst van de P6-projectielaag. Alleen de XER-reader zet `XER`; IFC mag dit
   * uitsluitend als round-tripmetadata van zo'n import bewaren. Zonder deze stempel zijn alle
   * kalenderprimitieven en solverpaden gewone OPS-/formaatneutrale kalendersemantiek.
   */
  p6Source?: 'XER';
  /**
   * BRONDIAGNOSE, GEEN REKENINVOER. De XER-lezer noteert hier de redundante vrije-dagrecords die hij
   * NIET heeft kunnen verklaren: een vrije uitzondering op een al niet-werkende weekdag, of een direct
   * aangrenzende herhaling van dezelfde vrije datum. Geen solverpad leest dit: meewegen als extra
   * niet-werkdag verklaarde in het corpus geen enkele cel (waar het wél iets deed, reconstrueert
   * `weekendClampTarget` in `xerCalendarData.ts` de bedoelde vrije dag). Round-tript door IFC zodat de
   * diagnose bewaard blijft.
   */
  p6NonWorkPenaltyDates?: string[];
  /** IFC-round-tripdiagnose voor de complete penaltylijst. Afwezig = geen P6-penaltypset gezien. */
  p6NonWorkPenaltyDatesState?: P6NonWorkPenaltyDatesState;
}

/** Dag-uitzondering die werktijd TOEVOEGT/AANPAST op een anders niet-werkende dag (MS Project:
 *  "werkende uitzondering"). De parser lost de precedentie t.o.v. `holidays` op; de engine leest deze
 *  lijst alleen en gaat uit van per datum unieke invoer. */
export interface WorkingException {
  name: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
  /** Banden in minuten-vanaf-middernacht, zelfde canonieke vorm als `WorkTimeBands` (`end > start`,
   *  een wrap-band mag `end ∈ (1440, 2880]`). Leeg/afwezig ⇒ FALLBACK-KETEN (MPXJ levert nooit
   *  band-loos; dit geldt voor ons eigen model):
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
 * Werktijd-banden per ISO-weekdag (1=ma..7=zo). Een weekdag zonder banden = niet-werkend. Een band
 * is `[start, end)` in MINUTEN-VANAF-MIDDERNACHT van de STARTdag.
 *
 * CANONIEK: `end > start`. Een wrap-band (over middernacht) heeft
 * `end ∈ (1440, 2880]` en telt bij de STARTdag (P6/Asta-conventie: een shift begint op zijn
 * weekdag en mag 24u overspannen). De alternatieve encoding met een niet-oplopende grens is
 * ONGELDIG en wordt bij inlezen genormaliseerd (`end += 1440`), zodat er precies één
 * representatie in omloop is. Banden per dag zijn gesorteerd, niet-overlappend en canoniek.
 */
export interface WorkTimeBands {
  byWeekday: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>;
}

/** Herkomst-metadata van een gegenereerde kalender. Puur informatief: solver en renderer lezen
 *  alleen `holidays`; IFC bewaart dit als metadata in het `OPS_Calendar`-pset. */
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

/** Een lege einddatum uit de kalenderdialoog is een eendaagse feestdag. */
export function holidayEndDate(holiday: Pick<Holiday, 'startDate' | 'endDate'>): string {
  return holiday.endDate || holiday.startDate;
}
