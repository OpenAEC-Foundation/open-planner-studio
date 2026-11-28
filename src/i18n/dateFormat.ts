import i18n from './config';
import { gregorianDateFormat } from '@/utils/monthLabel';

function uiLocale(locale?: string): string {
  return locale || i18n.language || 'nl';
}

export function formatDisplayDate(d: Date, locale?: string): string {
  return gregorianDateFormat(uiLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function monthNames(locale: string | undefined, month: 'long' | 'short'): string[] {
  const formatter = gregorianDateFormat(uiLocale(locale), { month });
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(Date.UTC(2000, i, 15))));
}

export function getLocalizedMonths(locale?: string): string[] {
  return monthNames(locale, 'long');
}

export function getLocalizedMonthsShort(locale?: string): string[] {
  return monthNames(locale, 'short');
}
