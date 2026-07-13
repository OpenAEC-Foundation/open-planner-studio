import type { DateNotation } from '@/types/view';

/**
 * Weergave-formatter voor datums (taak #53). Zet een INTERNE ISO-datum om naar de door de
 * gebruiker gekozen notatie. De opslag/serialisatie blijft altijd ISO — deze module raakt
 * uitsluitend wat op het scherm/print verschijnt.
 *
 * `iso` is `YYYY-MM-DD`, of een ISO-datetime (`YYYY-MM-DDTHH:mm…`) waarvan alleen het
 * datumdeel gebruikt wordt. Leeg (`''`) blijft leeg; een niet-ISO string wordt ongewijzigd
 * teruggegeven (zodat placeholders als `'—'` intact blijven wanneer een aanroeper ze meegeeft).
 */
export function displayDate(iso: string | undefined, notation: DateNotation): string {
  if (!iso) return '';
  const datePart = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return iso;
  const [, y, mo, d] = m;
  switch (notation) {
    case 'mdy': return `${mo}-${d}-${y}`;
    case 'ymd': return `${y}-${mo}-${d}`;
    default:    return `${d}-${mo}-${y}`; // 'dmy'
  }
}

/**
 * Datetime-variant (uur-modus komt in 2.8b): `YYYY-MM-DDTHH:mm` ⇒ datum-in-notatie + " HH:mm".
 * Een pure datum (geen `T`) valt terug op {@link displayDate}. Seconden/milliseconden/`Z` (bv.
 * een `createdAt`-timestamp) worden genegeerd behalve de minuut-precieze `HH:mm`.
 */
export function displayDateTime(iso: string | undefined, notation: DateNotation): string {
  if (!iso) return '';
  const date = displayDate(iso, notation);
  const tIdx = iso.indexOf('T');
  if (tIdx < 0) return date;
  const time = iso.slice(tIdx + 1, tIdx + 6); // HH:mm
  return /^\d{2}:\d{2}$/.test(time) ? `${date} ${time}` : date;
}
