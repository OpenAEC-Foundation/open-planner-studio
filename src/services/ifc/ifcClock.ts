import type { WorkCalendar } from '@/types/calendar';

/** De klokwaarde én of de bron meer informatie draagt dan een millisecondegetal.
 * Bewaar die informatie vóór de omzetting naar een JS-number (ook bij onderloop). */
export function parseIfcClock(text: string): { minutes: number; preserve: boolean; hasSeconds: boolean; legacyBand: boolean } | null {
  // Ook de oude bandenschrijver: MM was String(minuten % 60), dus '07:30.5:00'.
  const match = /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?):(\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?::(\d{2}(?:\.\d+)?))?(Z|[+-]\d{2}:\d{2})?$/i.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (!Number.isFinite(hour * 60) || minute >= 60 || second >= 60) return null;
  // Oude OPS-writers schreven String(uur), ook uurfracties en scalar-eindes na 24 uur.
  let legacyPrecision = hour > 24;
  if (/[.e]/i.test(match[1])) {
    const [decimal, exponent = '0'] = match[1].toLowerCase().split('e');
    const digits = decimal.replace('.', '');
    const power = Number(exponent) - (decimal.split('.')[1]?.length ?? 0);
    // De oude uurfractie exact toetsen, voordat Number fijnere cijfers verliest.
    legacyPrecision ||= digits.length > 32 || Math.abs(power) > 32
      || (power < 0 && BigInt(digits) * 3_600_000n % (10n ** BigInt(-power)) !== 0n);
  }
  const fraction = (match[3]?.split('.')[1] ?? '').replace(/0+$/, '');
  const legacyBand = /[.e]/i.test(match[2]);
  return {
    minutes: hour * 60 + minute + second / 60,
    preserve: legacyPrecision || legacyBand || !!match[4] || fraction.length > 3,
    hasSeconds: second !== 0 || fraction.length > 0 || legacyBand,
    legacyBand,
  };
}

/** Alleen de bewerkbare indeling, zonder scalars of bronvelden. Een gewijzigde
 * indeling maakt de koppeling op bandpositie onbetrouwbaar. Bewaar dit eenmaal
 * bij import; vergelijken tijdens schrijven voorkomt ook verlies bij kopiëren. */
export function ifcCalendarBandLayout(cal: WorkCalendar): string {
  const bands = (list: readonly { start: number; end: number }[] | undefined) => list?.map(b => [b.start, b.end]) ?? null;
  return JSON.stringify([
    cal.workDays,
    cal.workTime ? ([1, 2, 3, 4, 5, 6, 7] as const).map(day => bands(cal.workTime!.byWeekday[day])) : null,
    (cal.workingExceptions ?? []).map(e => [e.name, e.startDate, e.endDate, bands(e.bands)]),
  ]);
}
