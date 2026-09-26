/**
 * Getallen in rapporten (tabelrapporten, het variance-rapport én de tabel van de Gantt-afdruk):
 * één notatie voor DOM, raster-PDF en vector-PDF — hoogstens twee decimalen, geen overbodige
 * nullen, geen duizendtalscheiding (het zijn dagen en eenheden, geen bedragen), en het
 * decimaalteken van de app-taal ("0,5" in nl/de/fr, "0.5" in en). Zonder `locale` (headless
 * tests, oude aanroepen) de neutrale punt-notatie. Eén functie, zodat twee rapporten in hetzelfde
 * paneel niet met een verschillende precisie of een verschillend decimaalteken kunnen uitkomen.
 *
 * Bewust altijd **Latijnse cijfers** (`-u-nu-latn`): datums, tellingen en percentages in dezelfde
 * rapporten zijn Latijns, en een tabel met "۱٫۵" naast "3" en "75%" is geen lokalisatie maar een
 * gemengd cijfersysteem (`fa` kiest anders `arabext`). De bidi-markering
 * U+200E die `Intl` in `ar`/`fa` vóór een teken zet blijft bewust STAAN: in een RTL-alinea is hij
 * de enige reden dat het minteken links van zijn cijfer blijft ("-2" wordt anders "2-", gemeten in
 * Chromium én in de `bidi-js`-levels van de vector-PDF). Dat Inter er in de PDF een tofu van maakte
 * is een emissieprobleem en is dáár opgelost (`bidiShape.stripBidiControls`), niet hier. Een waarde
 * die op twee decimalen tot nul afrondt heet "0", niet "-0". De `Intl`-formatters
 * zijn duur om te bouwen (~35 µs tegen ~0,7 µs hergebruik) en worden per taal gecachet.
 */
const NEGATIVE_ZERO = /^\u200E?[-\u2212]0$/;
const formatters = new Map<string, Intl.NumberFormat | null>();

function intlFormatter(locale: string, signed: boolean): Intl.NumberFormat | null {
  const key = `${locale}|${signed ? 's' : 'u'}`;
  const cached = formatters.get(key);
  if (cached !== undefined) return cached;
  let fmt: Intl.NumberFormat | null = null;
  try {
    // Onbekend-maar-welgevormd ("zz") gooit niet maar valt stil op de systeemtaal terug; dat is hier
    // óók een terugval naar de neutrale notatie, dus expliciet uitsluiten.
    if (Intl.NumberFormat.supportedLocalesOf([locale]).length > 0) {
      fmt = new Intl.NumberFormat(`${locale}-u-nu-latn`, {
        maximumFractionDigits: 2,
        useGrouping: false,
        ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
      });
    }
  } catch {
    fmt = null; // misvormde taalcode ⇒ de neutrale notatie
  }
  formatters.set(key, fmt);
  return fmt;
}

function neutral(n: number): string {
  return String(Math.round(n * 100) / 100 + 0);
}

export function formatReportNumber(n: number, locale?: string): string {
  if (!Number.isFinite(n)) return '';
  const fmt = locale ? intlFormatter(locale, false) : null;
  if (!fmt) return neutral(n);
  const text = fmt.format(n);
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
    const text = neutral(n);
    return text !== '0' && n > 0 ? `+${text}` : text;
  }
  const text = fmt.format(n);
  return NEGATIVE_ZERO.test(text) ? '0' : text;
}

const decimalSeparators = new Map<string, string>();

/**
 * Zet in een door de engine geleverde, taalneutrale tekst met ASCII-decimaalpunten (zoals de
 * lag-notatie "+1.5d" van `formatLagShort`) de punt om naar het decimaalteken van `locale`. Alleen
 * een punt tússen twee cijfers telt; zonder `locale` ongewijzigd. Voor weergave — bewerkbare cellen
 * (de relatiekolom van het taakgrid) blijven ASCII, want `parseLagInput` leest die terug.
 */
export function localizeDecimalPoint(text: string, locale?: string): string {
  if (!locale) return text;
  let sep = decimalSeparators.get(locale);
  if (sep === undefined) {
    sep = intlFormatter(locale, false)?.formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(locale, sep);
  }
  return sep === '.' ? text : text.replace(/(\d)\.(\d)/g, `$1${sep}$2`);
}
