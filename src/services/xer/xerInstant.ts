import { formatInstant, parseInstant } from '@/utils/dateUtils';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function sourceInstant(raw: string, hourMode: boolean): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const normalized = value.replace(' ', 'T');
  const parsed = parseInstant(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInstant(parsed, hourMode && !DATE_ONLY.test(value) ? 'hour' : 'day');
}
