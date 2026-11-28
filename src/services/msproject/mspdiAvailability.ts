import type { AvailabilityStep, Resource } from '@/types/resource';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';

export const MSPDI_AVAILABILITY_NA_START = '1984-01-01';
export const MSPDI_AVAILABILITY_NA_END = '2049-12-31';
const MSPDI_LAST_DATE = '2149-12-31';
const OPEN_END = '9999-12-31';
const isEndSentinel = (to: string) => to === MSPDI_AVAILABILITY_NA_END || to === MSPDI_LAST_DATE;

export interface MspdiAvailabilityPeriod {
  from: string;
  to: string;
  units: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isUnits = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const shiftDay = (iso: string, days: number) => formatDate(addCalendarDays(parseDate(iso), days));

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

export function availabilityPeriodsOf(resource: Pick<Resource, 'maxUnits' | 'availabilitySteps'>): MspdiAvailabilityPeriod[] {
  const steps = normalizedSteps(resource.availabilitySteps ?? []);
  if (steps.length === 0) return [];
  const periods: MspdiAvailabilityPeriod[] = [];
  if (steps[0].from > MSPDI_AVAILABILITY_NA_START) {
    periods.push({ from: MSPDI_AVAILABILITY_NA_START, to: shiftDay(steps[0].from, -1), units: resource.maxUnits });
  }
  steps.forEach((step, i) => {
    const next = steps[i + 1];
    const openEnd = step.from > MSPDI_AVAILABILITY_NA_END ? MSPDI_LAST_DATE : MSPDI_AVAILABILITY_NA_END;
    periods.push({ from: step.from, to: next ? shiftDay(next.from, -1) : openEnd, units: step.maxUnits });
  });
  return periods;
}

export function availabilityFromPeriods(
  maxUnits: number,
  periods: readonly MspdiAvailabilityPeriod[],
): { maxUnits: number; availabilitySteps?: AvailabilityStep[] } {
  const lastFrom = periods.reduce((max, p) => (p.from > max ? p.from : max), '');
  const valid = periods
    .map(p => ({
      from: p.from || MSPDI_AVAILABILITY_NA_START,
      to: !p.to || (isEndSentinel(p.to) && lastFrom <= p.to) ? OPEN_END : p.to,
      units: p.units,
    }))
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
      const gapFrom = coveredTo === undefined ? MSPDI_AVAILABILITY_NA_START
        : coveredTo === OPEN_END ? undefined : shiftDay(coveredTo, 1);
      if (gapFrom !== undefined && gapFrom < period.from) raw.push({ from: gapFrom, maxUnits: 0 });
      raw.push({ from: period.from, maxUnits: period.units });
    }
    if (coveredTo === undefined || period.to > coveredTo) coveredTo = period.to;
  }
  if (coveredTo !== undefined && coveredTo !== OPEN_END) raw.push({ from: shiftDay(coveredTo, 1), maxUnits: 0 });
  const steps: AvailabilityStep[] = [];
  let current = flat;
  for (const step of raw) {
    if (step.maxUnits === current) continue;
    steps.push(step);
    current = step.maxUnits;
  }
  return steps.length > 0 ? { maxUnits: flat, availabilitySteps: steps } : { maxUnits: flat };
}
