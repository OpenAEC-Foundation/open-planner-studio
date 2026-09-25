import { formatDate, formatInstant, parseInstant } from '@/utils/dateUtils';

/**
 * Gedeelde datum-parse voor de import-readers (F5-a). Externe planningsbestanden dragen datums als
 * een ISO-achtige datetime (`2026-03-09T08:00:00`); wij bewaren in DAG-modus alleen de datum-prefix.
 * Lege invoer valt terug op vandaag (de bestaande reader-conventie — nooit een lege datum verzinnen).
 *
 * MSPDI (`parseMSPDate`) en P6 (`parseP6Date`) waren byte-identiek en importeren dit rechtstreeks.
 * CSV heeft een extra `DD-MM-YYYY`/`DD/MM/YYYY`-tak (`csvDateOrToday`). De IFC-reader deelt dit
 * BEWUST niet: die moet eerst de STEP-quoting én de `$`-null-conventie afhandelen en heeft afwijkende
 * lege-invoer-semantiek — zie de noot bij `parseDateFromIFC` in ifcReader. De statusdatum
 * (`importStatusDate`) deelt de IFC-reader wél: die krijgt de waarde al ontdaan van de STEP-typering.
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

/** Statusdatum uit een bestand → `project.statusDate`, voor élke lezer die hem kent (IFC, MSPDI, P6).
 *  Zonder tijd ⇒ `YYYY-MM-DD`; mét tijd ⇒ de store-vorm van een uur-instant (`YYYY-MM-DDTHH:mm`),
 *  ongeacht de modus van de taken: de tijd staat in het bestand en de engine gebruikt hem op een
 *  uur-projectkalender. Een onleesbare tijd ⇒ de datum. Het XML-dag-anker (een datum zonder tijd die
 *  MSPDI/P6 als `T08:00:00` moeten schrijven) vangt `statusDateFromXml` vóór deze functie af. */
export function importStatusDate(v: string): string {
  const day = v.substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return day;
  const instant = parseInstant(v);
  return Number.isNaN(instant.getTime()) ? day : formatInstant(instant, 'hour');
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
