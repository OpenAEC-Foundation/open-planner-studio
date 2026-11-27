const NEGATIVE_ZERO = /^\u200E?[-\u2212]0$/;
const formatters = new Map<string, Intl.NumberFormat | null>();

function intlFormatter(locale: string, signed: boolean): Intl.NumberFormat | null {
  const key = `${locale}|${signed ? 's' : 'u'}`;
  const cached = formatters.get(key);
  if (cached !== undefined) return cached;
  let fmt: Intl.NumberFormat | null = null;
  try {
    if (Intl.NumberFormat.supportedLocalesOf([locale]).length > 0) {
      fmt = new Intl.NumberFormat(`${locale}-u-nu-latn`, {
        maximumFractionDigits: 2,
        useGrouping: false,
        ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
      });
    }
  } catch {
    fmt = null;
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

export function decimalSeparatorOf(locale: string): string {
  let sep = decimalSeparators.get(locale);
  if (sep === undefined) {
    sep = intlFormatter(locale, false)?.formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(locale, sep);
  }
  return sep;
}

export function localizeDecimalPoint(text: string, locale?: string): string {
  if (!locale) return text;
  const sep = decimalSeparatorOf(locale);
  return sep === '.' ? text : text.replace(/(\d)\.(\d)/g, `$1${sep}$2`);
}
