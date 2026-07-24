import { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { parseDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';

/**
 * Lange-vrije-periode-detectie voor het eigenschappenpaneel (issue #21, user-wens): waarschuw
 * wanneer een taak over een aaneengesloten periode van niet-werkbare dagen heen loopt die te lang
 * is om "gewoon een weekend" te zijn (bv. een bouwvak of kerstsluiting). Puur/stateloos —
 * geen store-afhankelijkheid, zodat dit headless getest kan worden (zie tests/planning-achtig
 * scratchpad-patroon).
 */

/** Eén gevonden lange vrije periode die overlapt met de taakperiode. */
export interface FreePeriod {
  /** ISO-datum (YYYY-MM-DD) van de eerste niet-werkbare dag van de periode. */
  start: string;
  /** ISO-datum (YYYY-MM-DD) van de laatste niet-werkbare dag van de periode. */
  end: string;
  /** Aantal kalenderdagen in de periode (inclusief begin- en einddag). */
  days: number;
  /** Naam van de benoemde feestdag/vakantie uit de kalender, als die het GROOTSTE deel (≥50%)
   *  van de periode beslaat. Afwezig ⇒ de periode is een "kaal" samenraapsel van weekend(en)
   *  zonder dominante benoemde periode (bv. een weekend geknipt aan een losse enkele vrije dag). */
  name?: string;
}

/** Veiligheidsgrens tegen vastlopen bij het naar buiten uitbreiden van een gevonden vrije dag
 *  (analoog aan `CalendarEngine.MAX_SCAN`): geen enkele reële vakantie/bouwvak-periode is langer
 *  dan dit, dus een kalender die hier toch tegenaan loopt is degenererend (bv. 0 werkdagen) en
 *  wordt afgekapt i.p.v. de hele tijdlijn als "één periode" te markeren. */
const MAX_EXPAND_SCAN = 400;

/**
 * Vindt alle aaneengesloten periodes van niet-werkbare dagen (weekend + feestdagen/vakanties
 * samengevoegd via de effectieve kalender) die:
 *   (a) langer zijn dan `minDays - 1` kalenderdagen (default `minDays=8` ⇒ periodes van 8+ dagen
 *       triggeren, dus een gewoon weekend van 2 dagen nooit — ook niet een lang weekend van 3-4
 *       dagen door een aangesloten vrije dag),
 *   (b) overlappen met het bereik `[startIso, finishIso]` van de taak, ÉN
 *   (c) minstens één ECHTE kalender-uitzondering bevatten (een dag uit `calendar.holidays` —
 *       feestdag/vakantie), NIET uitsluitend het wekelijkse vrije-dagen-patroon (`workDays`).
 *       Dit is een BINDENDE aanscherping (issue #21): een periode die louter bestaat uit
 *       weekpatroon-dagen — hoe lang ook, bv. bij een exotische kalender met 1 werkdag/week —
 *       triggert NOOIT. De weekpatroon-dagen tellen wél mee voor de GETOONDE lengte van de
 *       periode (bv. de weekenden rond een bouwvak), maar zonder minstens één holiday-dag in de
 *       periode is er simpelweg geen uitzondering om voor te waarschuwen.
 *
 * De GEVONDEN periode is de VOLLEDIGE aaneengesloten vrije periode (kan buiten de taakgrenzen
 * uitsteken, bv. een bouwvak die vóór de taakstart begint) — niet geknipt tot het taakbereik: de
 * melding moet de echte vakantieperiode tonen, niet een fragment ervan.
 *
 * O(taakduur in kalenderdagen) hotpad: de buitenste scan loopt één keer over het taakbereik; het
 * naar buiten uitbreiden van een gevonden periode (buiten de taakgrenzen) is begrensd door
 * `MAX_EXPAND_SCAN` en gebeurt alleen bij de EERSTE dag van elke periode (latere dagen van
 * dezelfde periode worden via `lastPeriodEndIdx` overgeslagen, dus geen kwadratisch gedrag bij
 * meerdere periodes in één taak).
 */
export function findLongFreePeriods(
  calendar: WorkCalendar,
  startIso: string | undefined,
  finishIso: string | undefined,
  minDays = 8,
): FreePeriod[] {
  if (!startIso || !finishIso) return [];

  const start = parseDate(startIso);
  const finish = parseDate(finishIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return [];
  if (finish.getTime() < start.getTime()) return [];

  const engine = new CalendarEngine(calendar);
  // Degenererende kalender (geen werkdagen) zou de hele tijdlijn als "één vrije periode" opleveren
  // — geen zinvolle waarschuwing, en het uitbreiden hierboven zou meteen tegen MAX_EXPAND_SCAN
  // aanlopen. Bewust overslaan i.p.v. crashen of een absurde melding tonen.
  if (!engine.hasWorkingDays()) return [];

  const totalTaskDays = diffCalendarDays(start, finish) + 1;
  const results: FreePeriod[] = [];
  // Dagindex (UTC-dagen sinds epoch) van het einde van de laatst-gevonden periode: dagen tot en
  // met deze index zijn al verwerkt en worden overgeslagen (voorkomt dubbele/overlappende periodes
  // + voorkomt dat elke dag binnen een lange periode opnieuw naar buiten uitbreidt).
  let lastPeriodEndIdx = -Infinity;

  let cursor = new Date(start.getTime());
  for (let i = 0; i < totalTaskDays; i++) {
    const dayIdx = Math.floor(cursor.getTime() / 86_400_000);
    if (dayIdx <= lastPeriodEndIdx) {
      cursor = addCalendarDays(cursor, 1);
      continue;
    }
    if (!engine.isWorkDay(cursor)) {
      // Nieuwe niet-werkbare dag buiten een al-verwerkte periode: bepaal de volledige
      // aaneengesloten periode door zowel terug als vooruit uit te breiden.
      let periodStart = new Date(cursor.getTime());
      for (let scan = 0; scan < MAX_EXPAND_SCAN; scan++) {
        const prev = addCalendarDays(periodStart, -1);
        if (engine.isWorkDay(prev)) break;
        periodStart = prev;
      }
      let periodEnd = new Date(cursor.getTime());
      for (let scan = 0; scan < MAX_EXPAND_SCAN; scan++) {
        const next = addCalendarDays(periodEnd, 1);
        if (engine.isWorkDay(next)) break;
        periodEnd = next;
      }

      const days = diffCalendarDays(periodStart, periodEnd) + 1;
      if (days >= minDays) {
        const { hasHolidayException, name } = analyzeHolidayOverlap(calendar, periodStart, periodEnd, days);
        // (c) hierboven: zonder minstens één echte holiday-dag ⇒ louter weekpatroon ⇒ geen
        // waarschuwing, ook al is de periode lang genoeg (bv. 6+ dagen bij 1 werkdag/week).
        if (hasHolidayException) {
          results.push({ start: isoDate(periodStart), end: isoDate(periodEnd), days, name });
        }
      }
      lastPeriodEndIdx = Math.floor(periodEnd.getTime() / 86_400_000);
    }
    cursor = addCalendarDays(cursor, 1);
  }

  return results;
}

/** YYYY-MM-DD zonder de tijdcomponent-aannames van `formatDate` (die is identiek, maar lokaal
 *  gehouden zodat deze module geen extra afhankelijkheid nodig heeft dan wat hij al importeert). */
function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Analyseert hoe `calendar.holidays` overlapt met de gevonden vrije periode. Levert in één pass:
 *   - `hasHolidayException` — valt ÉÉN VAN de holidays (ook maar gedeeltelijk) in de periode? Dit
 *     is de BINDENDE poort (c) uit `findLongFreePeriods`: zonder dit is de periode puur
 *     weekpatroon en mag hij nooit triggeren, ongeacht lengte.
 *   - `name` — de naam van de holiday die het GROOTSTE deel van de periode overlapt, MAAR alleen
 *     teruggegeven als die overlap minstens de helft van de periode beslaat ("grotendeels
 *     samenvalt"); anders blijft `name` ongezet (de periode triggert dan nog steeds via
 *     `hasHolidayException`, alleen zonder specifieke naam in de melding).
 */
function analyzeHolidayOverlap(
  calendar: WorkCalendar,
  periodStart: Date,
  periodEnd: Date,
  periodDays: number,
): { hasHolidayException: boolean; name?: string } {
  let bestOverlapDays = 0;
  let bestName: string | undefined;
  let hasHolidayException = false;

  for (const holiday of calendar.holidays) {
    const hStart = parseDate(holiday.startDate);
    const hEnd = parseDate(holiday.endDate);
    const overlapStart = hStart.getTime() > periodStart.getTime() ? hStart : periodStart;
    const overlapEnd = hEnd.getTime() < periodEnd.getTime() ? hEnd : periodEnd;
    if (overlapEnd.getTime() < overlapStart.getTime()) continue; // geen overlap
    hasHolidayException = true;
    const overlapDays = diffCalendarDays(overlapStart, overlapEnd) + 1;
    if (overlapDays > bestOverlapDays) {
      bestOverlapDays = overlapDays;
      bestName = holiday.name;
    }
  }

  const name = bestName && bestOverlapDays / periodDays >= 0.5 ? bestName : undefined;
  return { hasHolidayException, name };
}
