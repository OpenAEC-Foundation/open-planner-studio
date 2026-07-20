import { formatDate } from '@/utils/dateUtils';

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
