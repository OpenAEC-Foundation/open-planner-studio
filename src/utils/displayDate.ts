import type { DateNotation, TimeNotation } from '@/types/view';
import { displayIsoTime } from '@/utils/displayTime';
import { isExistingYmd } from '@/utils/dateUtils';

function existingIsoDate(year: number, month: number, day: number): string | null {
  if (year < 100 || year > 9999 || !isExistingYmd(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parsePersonalDate(raw: string, notation: DateNotation): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parts = value.split(/[-/.]/);
  if (parts.length !== 3 || parts.some(part => !/^\d{1,4}$/.test(part))) return null;
  const numbers = parts.map(Number);
  let year: number;
  let month: number;
  let day: number;
  if (parts[0].length === 4) {
    [year, month, day] = numbers;
  } else if (notation === 'mdy' && /^\d{2,4}$/.test(parts[2])) {
    [month, day, year] = numbers;
  } else if (notation === 'dmy' && /^\d{2,4}$/.test(parts[2])) {
    [day, month, year] = numbers;
  } else {
    return null;
  }
  if (year < 100) year += 2000;
  return existingIsoDate(year, month, day);
}

export function displayDate(iso: string | undefined, notation: DateNotation): string {
  if (!iso) return '';
  const datePart = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return iso;
  const [, y, mo, d] = m;
  switch (notation) {
    case 'mdy': return `${mo}-${d}-${y}`;
    case 'ymd': return `${y}-${mo}-${d}`;
    default:    return `${d}-${mo}-${y}`;
  }
}

export function displayDateTime(iso: string | undefined, notation: DateNotation, timeNotation: TimeNotation): string {
  if (!iso) return '';
  const date = displayDate(iso, notation);
  const time = displayIsoTime(iso, timeNotation);
  return time ? `${date} ${time}` : date;
}
