import type { Sequence } from '@/types/sequence';
import { trimNumber } from '@/utils/durationFormat';
import { isFiniteNumber } from '@/utils/guards';

type LagFields = Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;

export function formatLagShort(seq: LagFields, hourSuffix: 'u' | 'h' = 'u'): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (isFiniteNumber(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (isFiniteNumber(seq.lagMinutes) && seq.lagMinutes !== 0) {
    const hours = seq.lagMinutes / 60;
    return `${hours >= 0 ? '+' : ''}${trimNumber(hours, 2)}${e}${hourSuffix}`;
  }
  if (!seq.lagDays) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${trimNumber(seq.lagDays, 6)}${e}d`;
}

export function localizeLagHourSuffix(lag: string, hourSuffix: 'u' | 'h'): string {
  return lag.replace(/^([+-]?\d+(?:[.,]\d+)?e?)u$/, `$1${hourSuffix}`);
}

export const LAG_UNIT_SUFFIXES = 'ed|eu|eh|e%|d|u|h|%';
const LAG_INPUT = new RegExp(`^([+-]?\\d+(?:[.,]\\d+)?)(${LAG_UNIT_SUFFIXES})?$`);

export function parseLagInput(input: string): LagFields | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { lagDays: 0, lagUnit: undefined, lagPercent: undefined, lagMinutes: undefined };
  const m = s.match(LAG_INPUT);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  const suffix = m[2] || 'd';
  const elapsed = suffix === 'ed' || suffix === 'eu' || suffix === 'eh' || suffix === 'e%';
  const lagUnit = elapsed ? 'ELAPSEDTIME' : undefined;
  if (suffix === '%' || suffix === 'e%') {
    return { lagDays: 0, lagUnit, lagPercent: num, lagMinutes: undefined };
  }
  if (suffix === 'u' || suffix === 'h' || suffix === 'eu' || suffix === 'eh') {
    return { lagDays: 0, lagUnit, lagPercent: undefined, lagMinutes: Math.round(num * 60) };
  }
  const days = Number(num.toFixed(6));
  return { lagDays: days || 0, lagUnit, lagPercent: undefined, lagMinutes: undefined };
}
