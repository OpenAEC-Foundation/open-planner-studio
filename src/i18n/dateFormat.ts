import i18n from './config';

export function formatDisplayDate(d: Date, locale?: string): string {
  const lng = locale || i18n.language || 'nl';
  return new Intl.DateTimeFormat(lng, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function getLocalizedMonths(locale?: string): string[] {
  const lng = locale || i18n.language || 'nl';
  const formatter = new Intl.DateTimeFormat(lng, { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2000, i, 15)))
  );
}

export function getLocalizedMonthsShort(locale?: string): string[] {
  const lng = locale || i18n.language || 'nl';
  const formatter = new Intl.DateTimeFormat(lng, { month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(Date.UTC(2000, i, 15)))
  );
}

export function formatLocalDate(d: Date, locale?: string): string {
  const lng = locale || i18n.language || 'nl';
  return new Intl.DateTimeFormat(lng, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}
