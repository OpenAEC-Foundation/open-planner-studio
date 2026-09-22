/**
 * Maandlabel voor een maandbucket ("sep 2026") in de UI-taal — bewust met een GEFORCEERDE
 * Gregoriaanse kalender en Latijnse cijfers. Zonder die twee unicode-extensies formatteert `Intl`
 * in het Perzisch (`fa`) op de Solar-Hijri-kalender: "شهریور ۱۴۰۵" naast een ondertitel die
 * "2026" zegt, in hetzelfde rapport (reviewbevinding ronde 3). Alle overige datums in de app
 * lopen via `displayDate` (numeriek, Gregoriaans, ASCII-cijfers); dit label hoort op dezelfde
 * kalender en hetzelfde cijferschrift te staan, alleen de maandnáám is vertaald.
 */
export function makeMonthLabeler(locale: string): (isoMonthStart: string) => string {
  const base = locale.split('-u-')[0] || 'en';
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat(`${base}-u-ca-gregory-nu-latn`, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    fmt = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return (iso) => {
    const [y, m] = iso.split('-').map(Number);
    return fmt.format(new Date(Date.UTC(y, m - 1, 1)));
  };
}
