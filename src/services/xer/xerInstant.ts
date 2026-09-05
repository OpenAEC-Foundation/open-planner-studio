import { formatInstant, parseInstant } from '@/utils/dateUtils';

/**
 * Parseer een rauwe XER-datum-/tijdcel naar dezelfde canonieke instant-representatie als de rest
 * van de motor: `YYYY-MM-DD` in dagmodus, `YYYY-MM-DDTHH:mm` in uurmodus. Een lege of onparseerbare
 * cel levert `undefined` — nooit een verzonnen datum.
 *
 * Verhuisd uit `xerReader.ts` naar een eigen, afhankelijkheidsloze module zodat zowel de
 * hoofdlezer als `xerRecordedTimes.ts` (BAK 4 — de zes P6-rekenuitvoerkolommen, uitsluitend
 * weergave/meetlat, nooit solverinvoer, XER-etappeplan §4.1-bijstelling 2026-09-04) exact dezelfde
 * functie gebruiken zonder dat `xerRecordedTimes.ts` uit `xerReader.ts` — die op zijn beurt
 * `xerRecordedTimes.ts` aanroept — hoeft te importeren. Dat zou anders een cyclus tussen die twee
 * modules zijn (`npm run verify:cycles`).
 */
export function sourceInstant(raw: string, hourMode: boolean): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const normalized = value.replace(' ', 'T');
  const parsed = parseInstant(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInstant(parsed, hourMode ? 'hour' : 'day');
}
