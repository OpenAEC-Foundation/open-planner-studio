/**
 * `Intl.DateTimeFormat` in de UI-taal, maar met een GEFORCEERDE Gregoriaanse kalender en Latijnse
 * cijfers, altijd in UTC. Zonder die twee unicode-extensies formatteert `Intl` in het Perzisch (`fa`)
 * op de Solar-Hijri-kalender: "شهریور ۱۴۰۵" naast een ondertitel die "2026" zegt, in hetzelfde
 * rapport (reviewbevinding ronde 3). Alle overige datums in de app lopen via `displayDate`
 * (numeriek, Gregoriaans, ASCII-cijfers); maand- en datumlabels horen op dezelfde kalender en
 * hetzelfde cijferschrift te staan, alleen de maandnáám is vertaald. Een onbruikbare taalcode valt
 * terug op Engels.
 */
export function gregorianDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const base = locale.split('-u-')[0] || 'en';
  const utc = { ...options, timeZone: 'UTC' };
  try {
    return new Intl.DateTimeFormat(`${base}-u-ca-gregory-nu-latn`, utc);
  } catch {
    return new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', utc);
  }
}

/** Maandlabel voor een maandbucket ("sep 2026") in de UI-taal, via {@link gregorianDateFormat}. */
export function makeMonthLabeler(locale: string): (isoMonthStart: string) => string {
  const fmt = gregorianDateFormat(locale, { month: 'short', year: 'numeric' });
  return (iso) => {
    const [y, m] = iso.split('-').map(Number);
    return fmt.format(new Date(Date.UTC(y, m - 1, 1)));
  };
}
