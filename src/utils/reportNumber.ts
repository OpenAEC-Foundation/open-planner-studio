/**
 * Getallen in rapporten (tabelrapporten, het variance-rapport én de tabel van de Gantt-afdruk):
 * één notatie voor DOM, raster-PDF en vector-PDF — hoogstens twee decimalen, geen overbodige
 * nullen, geen duizendtalscheiding (het zijn dagen en eenheden, geen bedragen), en het
 * decimaalteken van de app-taal ("0,5" in nl/de/fr, "0.5" in en). Zonder `locale` (headless
 * tests, oude aanroepen) de neutrale punt-notatie. Eén functie, zodat twee rapporten in hetzelfde
 * paneel niet met een verschillende precisie of een verschillend decimaalteken kunnen uitkomen
 * (review #138).
 *
 * Bewust altijd **Latijnse cijfers** (`-u-nu-latn`): datums, tellingen en percentages in dezelfde
 * rapporten zijn Latijns, en een tabel met "۱٫۵" naast "3" en "75%" is geen lokalisatie maar een
 * gemengd cijfersysteem (review #139, bevinding 5 — `fa` kiest anders `arabext`). De bidi-markering
 * (U+200E) die `Intl` in `ar`/`fa` vóór een teken zet gaat eruit: in de DOM is hij onzichtbaar,
 * maar in de vector-PDF legt Inter hem als een spatie van 0,28 em (bevinding 6). En een waarde die
 * op twee decimalen tot nul afrondt heet "0", niet "-0" (bevinding 7).
 */
const BIDI_MARKS = /[\u200E\u200F]/g;
const NEGATIVE_ZERO = /^[-\u2212]0$/;

function intlFormatter(locale: string, signed: boolean): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(`${locale}-u-nu-latn`, {
      maximumFractionDigits: 2,
      useGrouping: false,
      ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    });
  } catch {
    return null; // onbekende taalcode ⇒ de neutrale notatie hieronder
  }
}

export function formatReportNumber(n: number, locale?: string): string {
  if (!Number.isFinite(n)) return '';
  const fmt = locale ? intlFormatter(locale, false) : null;
  if (!fmt) return String(Math.round(n * 100) / 100 + 0);
  const text = fmt.format(n).replace(BIDI_MARKS, '');
  return NEGATIVE_ZERO.test(text) ? '0' : text;
}

/**
 * Zoals `formatReportNumber`, met een expliciete plus voor een positief getal (afwijkingen). Plus
 * én min komen uit dezelfde `Intl`-aanroep (`signDisplay: 'exceptZero'`), dus nooit een ASCII-plus
 * naast een typografische min; nul — ook een negatieve nul — krijgt geen teken.
 */
export function formatSignedReportNumber(n: number, locale?: string): string {
  if (!Number.isFinite(n)) return '';
  const fmt = locale ? intlFormatter(locale, true) : null;
  if (!fmt) {
    const text = formatReportNumber(n);
    return text !== '0' && n > 0 ? `+${text}` : text;
  }
  return fmt.format(n).replace(BIDI_MARKS, '');
}

/**
 * Zet in een door de engine geleverde, taalneutrale tekst met ASCII-decimaalpunten (zoals de
 * lag-notatie "+1.5d" van `formatLagShort`) de punt om naar het decimaalteken van `locale`. Alleen
 * een punt tússen twee cijfers telt; zonder `locale` ongewijzigd.
 */
export function localizeDecimalPoint(text: string, locale?: string): string {
  if (!locale) return text;
  const fmt = intlFormatter(locale, false);
  const sep = fmt?.formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
  return sep === '.' ? text : text.replace(/(\d)\.(\d)/g, `$1${sep}$2`);
}
