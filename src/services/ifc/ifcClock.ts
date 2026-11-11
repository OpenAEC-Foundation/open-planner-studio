/** De klokwaarde én of de bron meer informatie draagt dan een millisecondegetal.
 * Bewaar die informatie vóór de omzetting naar een JS-number (ook bij onderloop). */
export function parseIfcClock(text: string): { minutes: number; preserve: boolean; hasSeconds: boolean } | null {
  const match = /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?):(\d{2})(?::(\d{2}(?:\.\d+)?))?(Z|[+-]\d{2}:\d{2})?$/i.exec(text);
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
  return {
    minutes: hour * 60 + minute + second / 60,
    preserve: legacyPrecision || !!match[4] || fraction.length > 3,
    hasSeconds: second !== 0 || fraction.length > 0,
  };
}
