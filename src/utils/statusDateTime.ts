import { formatClock } from '@/utils/displayTime';
import { parseDate, parseInstant } from '@/utils/dateUtils';

/**
 * De statusdatum met of zonder tijd (besluit eigenaar 2026-10-17).
 *
 * `project.statusDate` is `YYYY-MM-DD` of `YYYY-MM-DDTHH:mm`. MS Project bewaart de statusdatum op een
 * tijd (vaak 17:00) en die tijd telt mee voor het restwerk: 17:00 en 12:00 op dezelfde dag geven een
 * halve dag verschil. Daarom toont het lint de tijd, en laat hem wijzigen, zodra hij ertoe doet.
 */

/** Minuten-vanaf-middernacht van het tijddeel, of `undefined` als de statusdatum geen tijd draagt. */
export function statusDateMinutes(statusDate: string | undefined): number | undefined {
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(statusDate ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/**
 * Regel voor het tijdveld in het lint: zichtbaar als de statusdatum een tijd draagt, OF als de
 * hoofdschakelaar Urenplanning (`ui.enableHourPlanning`) aan staat. Zonder tijd en zonder
 * urenplanning blijft het veld alleen een datum.
 */
export function statusDateShowsTime(statusDate: string | undefined, enableHourPlanning: boolean): boolean {
  return enableHourPlanning || statusDateMinutes(statusDate) !== undefined;
}

/**
 * Zet het tijddeel van een statusdatum. `minutes === undefined` haalt de tijd weg (alleen de datum).
 * De uitkomst is altijd ISO met 24 uur (`YYYY-MM-DDTHH:mm`); de weergave volgt `ui.timeNotation`.
 * Zonder geldig datumdeel ⇒ `undefined` (een tijd zonder datum bestaat niet).
 */
export function withStatusTime(statusDate: string | undefined, minutes: number | undefined): string | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(statusDate ?? '');
  if (!m) return undefined;
  return minutes === undefined ? m[1] : `${m[1]}T${formatClock(minutes, '24h')}`;
}


/**
 * Het tijdstip van de statusdatum op de tijdas — de ene positieregel voor scherm (`GanttRenderer`) en
 * print (`printPreview`). Met een tijd: `parseInstant`, zoals een uurtaakbalk (kalendertijd; 17:00 =
 * 17/24 van de dag op de lineaire as). Zonder tijd: het begin van de dag (`parseDate`), zoals altijd.
 */
export function statusDateInstant(statusDate: string): Date {
  return statusDate.includes('T') ? parseInstant(statusDate) : parseDate(statusDate);
}
