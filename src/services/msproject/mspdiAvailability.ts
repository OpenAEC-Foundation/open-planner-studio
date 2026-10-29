import type { AvailabilityStep, Resource } from '@/types/resource';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';

/**
 * Tijdsafhankelijke capaciteit ↔ MSPDI `<AvailabilityPeriods>` (#556).
 *
 * OPS: `maxUnits` geldt vóór de eerste stap; vanaf `from` geldt de stap tot de volgende (`maxUnitsOn`, gelijke
 * `from` ⇒ de laatste in de lijst wint). MSPDI: een lijst periodes met `AvailableFrom`/`AvailableTo`/
 * `AvailableUnits` (1 = 100 %, zoals `MaxUnits`). MS Project gebruikt 1984-01-01 en 2049-12-31 als "NA", het
 * open begin en einde van de tabel. De writer schrijft de periodes sluitend over die hele tijdlijn: de eerste
 * draagt de vlakke waarde, de laatste loopt tot het open einde, en elke grens is een hele dag (tot 23:59 van de
 * dag vóór de volgende stap).
 */
export const MSPDI_AVAILABILITY_NA_START = '1984-01-01';
export const MSPDI_AVAILABILITY_NA_END = '2049-12-31';

export interface MspdiAvailabilityPeriod {
  /** `YYYY-MM-DD`, inclusief; bij het lezen `''` als de grens ontbreekt (= NA). */
  from: string;
  /** `YYYY-MM-DD`, inclusief (de hele dag); bij het lezen `''` als de grens ontbreekt (= NA). */
  to: string;
  units: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isUnits = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const shiftDay = (iso: string, days: number) => formatDate(addCalendarDays(parseDate(iso), days));

/** De stappen zoals `maxUnitsOn` ze leest: op datum gesorteerd, per datum de laatste in de lijst (`Map.set`). */
function normalizedSteps(steps: readonly AvailabilityStep[]): AvailabilityStep[] {
  const byDay = new Map<string, number>();
  for (const step of steps) {
    const day = step.from?.slice(0, 10);
    if (!day || !ISO_DAY.test(day) || !isUnits(step.maxUnits)) continue;
    byDay.set(day, step.maxUnits);
  }
  return [...byDay].map(([from, maxUnits]) => ({ from, maxUnits }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** De periodes voor `<AvailabilityPeriods>`; leeg voor een vlakke resource (dan schrijft de writer niets). */
export function availabilityPeriodsOf(resource: Pick<Resource, 'maxUnits' | 'availabilitySteps'>): MspdiAvailabilityPeriod[] {
  const steps = normalizedSteps(resource.availabilitySteps ?? []);
  if (steps.length === 0) return [];
  const periods: MspdiAvailabilityPeriod[] = [];
  if (steps[0].from > MSPDI_AVAILABILITY_NA_START) {
    periods.push({ from: MSPDI_AVAILABILITY_NA_START, to: shiftDay(steps[0].from, -1), units: resource.maxUnits });
  }
  steps.forEach((step, i) => {
    const next = steps[i + 1];
    periods.push({ from: step.from, to: next ? shiftDay(next.from, -1) : MSPDI_AVAILABILITY_NA_END, units: step.maxUnits });
  });
  return periods;
}

/**
 * Periodes uit een bestand ⇒ de vlakke waarde en de stappen. Een ontbrekende grens is het open begin of einde
 * (NA), zoals in MS Project. Buiten elke periode is de resource in MS Project niet beschikbaar: vóór de eerste
 * periode, in een gat en na een periode die vóór NA stopt. Dat wordt een stap naar 0; vóór de eerste periode een
 * stap op NA zelf, omdat de vlakke waarde (`MaxUnits`) groter dan 0 moet blijven. Een periode vanaf NA met
 * capaciteit draagt de vlakke waarde. Een stap die de capaciteit niet verandert, valt weg, zodat een vlakke
 * tabel geen stappen geeft.
 */
export function availabilityFromPeriods(
  maxUnits: number,
  periods: readonly MspdiAvailabilityPeriod[],
): { maxUnits: number; availabilitySteps?: AvailabilityStep[] } {
  const valid = periods
    .map(p => ({ from: p.from || MSPDI_AVAILABILITY_NA_START, to: p.to || MSPDI_AVAILABILITY_NA_END, units: p.units }))
    .filter(p => ISO_DAY.test(p.from) && ISO_DAY.test(p.to) && p.to >= p.from && isUnits(p.units))
    .sort((a, b) => a.from.localeCompare(b.from));
  if (valid.length === 0) return { maxUnits };
  let flat = maxUnits;
  const raw: AvailabilityStep[] = [];
  let coveredTo: string | undefined;
  for (const period of valid) {
    if (period.from <= MSPDI_AVAILABILITY_NA_START) {
      if (period.units > 0) flat = period.units;
      else raw.push({ from: MSPDI_AVAILABILITY_NA_START, maxUnits: 0 });
    } else {
      const gapFrom = coveredTo === undefined ? MSPDI_AVAILABILITY_NA_START : shiftDay(coveredTo, 1);
      if (gapFrom < period.from) raw.push({ from: gapFrom, maxUnits: 0 });
      raw.push({ from: period.from, maxUnits: period.units });
    }
    if (coveredTo === undefined || period.to > coveredTo) coveredTo = period.to;
  }
  if (coveredTo !== undefined && coveredTo < MSPDI_AVAILABILITY_NA_END) raw.push({ from: shiftDay(coveredTo, 1), maxUnits: 0 });
  const steps: AvailabilityStep[] = [];
  let current = flat;
  for (const step of raw) {
    if (step.maxUnits === current) continue;
    steps.push(step);
    current = step.maxUnits;
  }
  return steps.length > 0 ? { maxUnits: flat, availabilitySteps: steps } : { maxUnits: flat };
}
