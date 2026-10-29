import { decimalSeparatorOf, formatReportNumber } from '@/utils/reportNumber';

/**
 * Invoer en weergave van een positief decimaal getal in een tekstveld (inzet en werk in het blok
 * *Toewijzingen*). Eén regel voor beide velden, zodat ze niet uiteenlopen.
 *
 * Invoer is strikt: cijfers met hooguit één decimaalteken, komma of punt ("2,5", "2.5", ",5").
 * Alles anders is ongeldig — ook "1.234,5", "1,234.5", "2x", "1e3" en een leeg veld. `parseFloat`
 * las daar stil een voorvoegsel uit ("1.234,5" ⇒ 1.234, "2x" ⇒ 2). Zelfde gedachte als de
 * tabelparser (`taskColumnRegistry.ts`, `Number(text.trim().replace(',', '.'))`), maar zonder de
 * vormen die `Number` daarnaast nog toelaat (exponent, hex).
 */
const DECIMAL = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/** Het getal als het een eindig positief decimaal getal is, anders `null`. */
export function parsePositiveDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const smallFormatters = new Map<string, Intl.NumberFormat | null>();

/**
 * De getalnotatie van de app (`formatReportNumber`: hooguit twee decimalen, decimaalteken van de
 * taal). Rondt een positieve waarde daarbij af tot "0", dan toont deze functie drie significante
 * cijfers ("0,004"): een geldige kleine inzet mag niet als "0" verschijnen.
 */
export function formatDecimalInput(n: number, locale: string): string {
  const text = formatReportNumber(n, locale);
  if (!(n > 0) || text !== '0') return text;
  let fmt = smallFormatters.get(locale);
  if (fmt === undefined) {
    try {
      fmt = Intl.NumberFormat.supportedLocalesOf([locale]).length > 0
        ? new Intl.NumberFormat(`${locale}-u-nu-latn`, { maximumSignificantDigits: 3, useGrouping: false })
        : null;
    } catch {
      fmt = null;
    }
    smallFormatters.set(locale, fmt);
  }
  return fmt ? fmt.format(n) : String(Number(n.toPrecision(3)));
}

/**
 * Dubbelzinnige invoer: een getal met een geheel deel > 0 ("1", "01", "15") en een punt of komma
 * gevolgd door precies drie cijfers, waarbij dat teken NIET het decimaalteken van de taal is. "1,500" in en of "1.500"
 * in nl/de/pt/tr bedoelt vaak 1500 (duizendtal), maar `parsePositiveDecimal` leest overal 1,5.
 * Zo'n invoer wordt geweigerd: geen stille gok. Met het decimaalteken van de taal ("1,500" in nl)
 * is hij eenduidig; "0,500" kan geen duizendtal zijn, "01.500" wel (voorloopnullen tellen niet).
 */
export function isAmbiguousThousands(text: string, locale: string): boolean {
  const m = /^0*[1-9]\d*([.,])\d{3}$/.exec(text.trim());
  return m !== null && m[1] !== decimalSeparatorOf(locale);
}
