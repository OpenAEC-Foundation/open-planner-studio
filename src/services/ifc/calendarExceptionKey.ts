import type { WorkingException } from '@/types/calendar';
import { minutesToClock } from '@/services/subdayIo';

/** Inhoudssleutel voor een OPS-werkende uitzondering, onafhankelijk van STEP-nummers.
 * Dezelfde klokprojectie als de writer: middernacht/wrap en bandvolgorde veranderen de sleutel niet.
 * Alleen expliciete OPS-metadata mag deze sleutel als discriminator gebruiken. */
export function calendarExceptionKey(exception: WorkingException): string {
  const bands = (exception.bands ?? []).map(b => [
    minutesToClock(b.start), minutesToClock(b.end, true),
  ]).map(b => JSON.stringify(b)).sort();
  return JSON.stringify([exception.name, exception.startDate, exception.endDate, bands]);
}
