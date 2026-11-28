export function gregorianDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const base = locale.split('-u-')[0] || 'en';
  const utc = { ...options, timeZone: 'UTC' };
  try {
    const supported = Intl.DateTimeFormat.supportedLocalesOf(base).length > 0 ? base : 'en';
    return new Intl.DateTimeFormat(`${supported}-u-ca-gregory-nu-latn`, utc);
  } catch {
    return new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', utc);
  }
}

export function makeMonthLabeler(locale: string): (isoMonthStart: string) => string {
  const fmt = gregorianDateFormat(locale, { month: 'short', year: 'numeric' });
  return (iso) => {
    const [y, m] = iso.split('-').map(Number);
    return fmt.format(new Date(Date.UTC(y, m - 1, 1)));
  };
}
