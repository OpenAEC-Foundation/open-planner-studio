export const MIN_READABLE_SERIAL_1900 = 61;

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 1440;

const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function isoHasClock(iso: string): boolean {
  const m = ISO_RE.exec(iso.trim());
  return m !== null && m[4] !== undefined;
}

export function isoToSerial(iso: string, epoch1904 = false): number | undefined {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mi, ss] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  if (hh > 23 || mi > 59 || ss > 59) return undefined;
  const ms = Date.UTC(y, mo - 1, d, hh, mi, ss);
  if (!Number.isFinite(ms)) return undefined;
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return undefined;
  }
  const serial = (ms - (epoch1904 ? EPOCH_1904 : EPOCH_1900)) / MS_PER_DAY;
  if (epoch1904) {
    if (serial < 0) return undefined;
  } else if (serial < MIN_READABLE_SERIAL_1900) {
    return undefined;
  }
  return serial;
}

export function serialToIso(serial: number, epoch1904 = false, withClock = false): string | undefined {
  if (!Number.isFinite(serial)) return undefined;
  if (epoch1904 ? serial < 0 : serial < MIN_READABLE_SERIAL_1900) return undefined;
  const days = Math.floor(serial);
  let minutes = Math.round((serial - days) * MINUTES_PER_DAY);
  let dayOffset = days;
  if (minutes >= MINUTES_PER_DAY) {
    minutes -= MINUTES_PER_DAY;
    dayOffset += 1;
  }
  const ms = (epoch1904 ? EPOCH_1904 : EPOCH_1900) + dayOffset * MS_PER_DAY;
  const dt = new Date(ms);
  if (!Number.isFinite(dt.getTime())) return undefined;
  const date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  if (minutes === 0 && !withClock) return date;
  return `${date}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}
