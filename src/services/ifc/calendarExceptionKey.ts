import type { WorkingException } from '@/types/calendar';
import { minutesToClock } from '@/services/subdayIo';

/** Inhoudssleutel voor een OPS-werkende uitzondering, onafhankelijk van STEP-nummers.
 * Dezelfde klokprojectie als de writer: middernacht/wrap en bandvolgorde veranderen de sleutel niet.
 * Alleen expliciete OPS-metadata mag deze sleutel als discriminator gebruiken. */
export function calendarExceptionKey(exception: WorkingException): string {
  return calendarExceptionKeyFromClocks(exception, (exception.bands ?? []).map(b => [
    minutesToClock(b.start), minutesToClock(b.end, true),
  ]));
}

/** Dezelfde expliciete inhoudssleutel met de werkelijk gelezen klokteksten.
 * Oudere writers maakten sleutel én periode met bijvoorbeeld '08:30.5:00'.
 * Daardoor blijft die markering geldig als de huidige klokformatter verandert. */
export function calendarExceptionKeyFromClocks(
  exception: Pick<WorkingException, 'name' | 'startDate' | 'endDate'>,
  clocks: readonly (readonly [string, string])[],
): string {
  const bands = clocks.map(pair => JSON.stringify(pair)).sort();
  return JSON.stringify([exception.name, exception.startDate, exception.endDate, bands]);
}
