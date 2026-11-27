import { decimalSeparatorOf, formatReportNumber } from '@/utils/reportNumber';

const DECIMAL = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

export function parsePositiveDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseNonNegativeDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const smallFormatters = new Map<string, Intl.NumberFormat | null>();

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

export function isAmbiguousThousands(text: string, locale: string): boolean {
  const m = /^0*[1-9]\d*([.,])\d{3}$/.exec(text.trim());
  return m !== null && m[1] !== decimalSeparatorOf(locale);
}
