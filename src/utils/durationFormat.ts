export type DurationUnit = 'days' | 'hours' | 'auto';

export interface DurationSuffixes {
  day: string;
  hour: string;
  minute: string;
}

export const DEFAULT_DURATION_SUFFIXES: DurationSuffixes = { day: 'd', hour: 'h', minute: 'm' };

export function parseableHourSuffix(suffix: string | undefined, fallback: 'u' | 'h' = 'u'): 'u' | 'h' {
  return suffix === 'u' || suffix === 'h' ? suffix : fallback;
}

export function parseDuration(input: string, effHoursPerDay: number): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (s === '') return null;
  const num = (text: string) => Number(text.replace(',', '.'));
  const result = (minutes: number): number | null => {
    const rounded = Math.round(minutes);
    return Number.isSafeInteger(rounded) && rounded >= 0 ? rounded : null;
  };

  if (/^\d+(?:[.,]\d+)?$/.test(s)) return result(num(s) * effHoursPerDay * 60);

  const m = s.match(/^(?:(\d+(?:[.,]\d+)?)d)?\s*(?:(\d+(?:[.,]\d+)?)[uh])?\s*(?:(\d+)m)?$/);
  if (!m) return null;

  const [, dStr, hStr, mStr] = m;
  if (dStr === undefined && hStr === undefined && mStr === undefined) return null;

  const days = dStr ? num(dStr) : 0;
  const hours = hStr ? num(hStr) : 0;
  const mins = mStr ? parseInt(mStr, 10) : 0;

  return result(days * effHoursPerDay * 60 + hours * 60 + mins);
}

export function formatDuration(
  minutes: number,
  effHoursPerDay: number,
  unit: DurationUnit = 'auto',
  suffixes: DurationSuffixes = DEFAULT_DURATION_SUFFIXES,
): string {
  const minPerDay = effHoursPerDay * 60;

  if (unit === 'days') {
    const days = minPerDay > 0 ? minutes / minPerDay : 0;
    return `${trimNumber(days, 4)}${suffixes.day}`;
  }

  if (unit === 'hours') {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}${suffixes.hour}`;
    if (h === 0) return `${m}${suffixes.minute}`;
    return `${h}${suffixes.hour} ${m}${suffixes.minute}`;
  }

  const days = minutes / minPerDay;
  const wholeDays = Math.round(days);
  if (minPerDay > 0 && Number.isFinite(minPerDay) && Number.isFinite(days)
    && (wholeDays !== 0 || minutes === 0)
    && Math.abs(days - wholeDays) <= 4 * Number.EPSILON * Math.max(1, Math.abs(days))) {
    return `${wholeDays}${suffixes.day}`;
  }
  return formatDuration(minutes, effHoursPerDay, 'hours', suffixes);
}

export function trimNumber(n: number, maxDecimals: number): string {
  return String(Number(n.toFixed(maxDecimals)));
}
