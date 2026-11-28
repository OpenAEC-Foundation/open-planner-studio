import { formatClock } from '@/utils/displayTime';
import { parseDate, parseInstant } from '@/utils/dateUtils';

export function statusDateMinutes(statusDate: string | undefined): number | undefined {
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(statusDate ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

export function statusDateAsUsed(statusDate: string, usesTime: boolean): string {
  return usesTime ? statusDate : statusDate.slice(0, 10);
}

export function withStatusTime(statusDate: string | undefined, minutes: number | undefined): string | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(statusDate ?? '');
  if (!m) return undefined;
  return minutes === undefined ? m[1] : `${m[1]}T${formatClock(minutes, '24h')}`;
}

export function statusDateInstant(statusDate: string, usesTime: boolean): Date {
  return usesTime ? parseInstant(statusDate) : parseDate(statusDate);
}
