import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';

/**
 * Gedeelde datum-parse voor de import-readers (F5-a). Externe planningsbestanden dragen datums als
 * een ISO-achtige datetime (`2026-03-09T08:00:00`); wij bewaren in DAG-modus alleen de datum-prefix.
 * Lege invoer valt terug op vandaag (de bestaande reader-conventie — nooit een lege datum verzinnen).
 *
 * MSPDI (`parseMSPDate`) en P6 (`parseP6Date`) waren byte-identiek en importeren dit rechtstreeks.
 * CSV heeft een extra `DD-MM-YYYY`/`DD/MM/YYYY`-tak (`csvDateOrToday`). De IFC-reader deelt dit
 * BEWUST niet: die moet eerst de STEP-quoting én de `$`-null-conventie afhandelen en heeft afwijkende
 * lege-invoer-semantiek — zie de noot bij `parseDateFromIFC` in ifcReader.
 */

/** ISO-datum-prefix (`YYYY-MM-DD`) uit een datetime-string; lege invoer ⇒ vandaag. */
export function isoDatePrefixOrToday(s: string): string {
  if (!s) return formatDate(new Date());
  return s.substring(0, 10);
}

/** Een datetime uit MSPDI/P6 in de modus van de taak: UUR ⇒ de echte tijd-van-de-dag
 *  (`YYYY-MM-DDTHH:mm`, §7.3), DAG ⇒ de datum-prefix. Lege invoer ⇒ vandaag, zoals hierboven. */
export function importDateTime(s: string, hour: boolean): string {
  if (!s) return formatDate(new Date());
  return hour ? formatInstant(parseInstant(s), 'hour') : s.substring(0, 10);
}

/** CSV-variant: accepteert naast ISO ook `DD-MM-YYYY` / `DD/MM/YYYY`; onherkenbaar ⇒ vandaag. */
export function csvDateOrToday(s: string): string {
  if (!s) return formatDate(new Date());
  // Eerst ISO proberen.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Dan DD-MM-YYYY of DD/MM/YYYY.
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return formatDate(new Date());
}

/**
 * Strikte CSV-variant voor de VASTLEGGING ("datums zoals opgeslagen", bak 4): dezelfde twee
 * herkende vormen als `csvDateOrToday`, maar een cel die niets herkenbaars bevat — of een datum die
 * niet bestaat (maand 13, 31 februari) — geeft `undefined` in plaats van "vandaag". Een verzonnen
 * vandaag-datum als "zo stond het in het bestand" liet het document anders in de modus openen met
 * alle taken op vandaag (critreview op ded4d8c3, bevinding 1). `task.time` blijft de gewone,
 * vergevende lezing via `csvDateOrToday`.
 */
export function csvDateOrUndefined(s: string): string | undefined {
  const trimmed = s.trim();
  let y: number, m: number, d: number;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = iso ? null : trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (dmy) { y = Number(dmy[3]); m = Number(dmy[2]); d = Number(dmy[1]); }
  else return undefined;
  if (m < 1 || m > 12 || d < 1) return undefined;
  // Dagen in de maand via UTC — geen lokale tijdzone in het spel.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
