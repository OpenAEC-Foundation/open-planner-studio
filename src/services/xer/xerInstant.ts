import { formatInstant, parseInstant } from '@/utils/dateUtils';

/**
 * Parseer een rauwe XER-datum-/tijdcel naar dezelfde canonieke instant-representatie als de rest
 * van de motor: `YYYY-MM-DD` in dagmodus, `YYYY-MM-DDTHH:mm` in uurmodus. Een lege of onparseerbare
 * cel levert `undefined` — nooit een verzonnen datum.
 *
 * Een eigen, afhankelijkheidsloze module zodat zowel de hoofdlezer als `xerRecordedTimes.ts` (de zes
 * P6-rekenuitvoerkolommen, uitsluitend weergave/meetlat) exact dezelfde functie gebruiken:
 * `xerRecordedTimes.ts` importeren uit `xerReader.ts`, dat hem aanroept, zou een cyclus zijn
 * (`npm run verify:cycles`).
 */
export function sourceInstant(raw: string, hourMode: boolean): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const normalized = value.replace(' ', 'T');
  const parsed = parseInstant(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInstant(parsed, hourMode ? 'hour' : 'day');
}
