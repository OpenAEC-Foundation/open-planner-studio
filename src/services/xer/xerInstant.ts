import { formatInstant, parseInstant } from '@/utils/dateUtils';

/** Een datum zonder tijd, dezelfde vorm als `isDateOnly` in `workdayRules.ts`. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parseer een rauwe XER-datum-/tijdcel naar dezelfde canonieke instant-representatie als de rest
 * van de motor: `YYYY-MM-DD` in dagmodus, `YYYY-MM-DDTHH:mm` in uurmodus. Een lege of onparseerbare
 * cel levert `undefined` — nooit een verzonnen datum.
 *
 * Een eigen, afhankelijkheidsloze module zodat zowel de hoofdlezer als `xerRecordedTimes.ts` (de zes
 * P6-rekenuitvoerkolommen, uitsluitend weergave/meetlat) exact dezelfde functie gebruiken:
 * `xerRecordedTimes.ts` importeren uit `xerReader.ts`, dat hem aanroept, zou een cyclus zijn
 * (`npm run verify:cycles`).
 *
 * Een cel ZONDER tijd blijft ook in uurmodus een datum: hij draagt geen moment. De normalisatie op de
 * laadgrens zet hem per veld en kalender om (T17, D1–D7; `payloadFromImport`). Als middernacht gelezen
 * werd een werkelijk einde het begin van die dag, zodra een andere taak de kalender een urenkalender
 * maakte (review ronde 2 van PR #559, deel B). Een expliciete `00:00` blijft een moment. De test staat
 * hier lokaal, zodat deze module zonder afhankelijkheden blijft.
 */
export function sourceInstant(raw: string, hourMode: boolean): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const normalized = value.replace(' ', 'T');
  const parsed = parseInstant(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInstant(parsed, hourMode && !DATE_ONLY.test(value) ? 'hour' : 'day');
}
