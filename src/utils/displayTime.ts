import type { TimeNotation } from '@/types/view';

const MIN_PER_DAY = 1440;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatClock(minutes: number, notation: TimeNotation, opts: { endOfDay?: boolean } = {}): string {
  const total = Math.round(minutes);
  if (opts.endOfDay && total === MIN_PER_DAY) return notation === '12h' ? '12:00 AM' : '24:00';
  const m = ((total % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (notation === '12h') {
    const suffix = h < 12 ? 'AM' : 'PM';
    return `${h % 12 === 0 ? 12 : h % 12}:${pad2(mm)} ${suffix}`;
  }
  return `${pad2(h)}:${pad2(mm)}`;
}

export function formatAxisClock(
  minutes: number, notation: TimeNotation, tier: 'hour' | 'quarterHour', compact = false,
): string {
  if (notation === '24h') return formatClock(minutes, '24h');
  const m = ((Math.round(minutes) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (tier === 'hour') return compact ? `${h12}${h < 12 ? 'a' : 'p'}` : `${h12} ${h < 12 ? 'AM' : 'PM'}`;
  return `${h12}:${pad2(m % 60)}`;
}

export function formatLocalDateTime(date: Date, locale: string, notation: TimeNotation): string {
  const base = locale.split('-u-')[0] || 'en';
  let dateFormat: Intl.DateTimeFormat;
  try {
    dateFormat = new Intl.DateTimeFormat(`${base}-u-ca-gregory-nu-latn`, { dateStyle: 'medium' });
  } catch {
    dateFormat = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', { dateStyle: 'medium' });
  }
  return `${dateFormat.format(date)} ${formatClock(date.getHours() * 60 + date.getMinutes(), notation)}`;
}

export function clockPlaceholder(notation: TimeNotation): string {
  return formatClock(13 * 60 + 30, notation);
}

const CLOCK_INPUT = /^(\d{1,2})(?:[:.]?(\d{2}))?\s*(?:(a|p)\.?(?:m\.?)?)?$/;

export function parseClock(raw: string, opts: { endOfDay?: boolean } = {}): number | undefined {
  const match = CLOCK_INPUT.exec(raw.trim().toLowerCase());
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = match[2] === undefined ? 0 : Number(match[2]);
  if (m > 59) return undefined;
  const period = match[3];
  if (period) {
    if (h < 1 || h > 12) return undefined;
    const minutes = ((h % 12) + (period === 'p' ? 12 : 0)) * 60 + m;
    return opts.endOfDay && minutes === 0 ? MIN_PER_DAY : minutes;
  }
  if (h === 24 && m === 0 && opts.endOfDay) return MIN_PER_DAY;
  if (h > 23) return undefined;
  return h * 60 + m;
}

export function displayIsoTime(iso: string | undefined, notation: TimeNotation): string {
  if (!iso) return '';
  const tIdx = iso.indexOf('T');
  if (tIdx < 0) return '';
  const time = /^(\d{2}):(\d{2})/.exec(iso.slice(tIdx + 1));
  if (!time) return '';
  return formatClock(Number(time[1]) * 60 + Number(time[2]), notation);
}
