import type { Sequence } from '@/types/sequence';

/**
 * Korte lag-notatie voor weergave, in MS Project-stijl en symmetrisch met parseLagInput:
 * "+2d" (werkdagen), "-1d" (lead), "+3ed" (kalenderdagen), "+50%", "-25e%" (procent van
 * de voorgangerduur, e = elapsed). Lege string voor lag 0 zonder procent.
 */
export function formatLagShort(seq: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent'>): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (!seq.lagDays) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${seq.lagDays}${e}d`;
}

/**
 * Parse gebruikersinvoer naar lag-velden. Accepteert "2", "+2", "-1", "2d", "3ed",
 * "50%", "-25e%" (hoofdletterongevoelig, spaties genegeerd). Kale getallen = werkdagen.
 * Geeft null terug bij onparseerbare invoer; lege invoer = lag 0 (werkdagen).
 */
export function parseLagInput(input: string): Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent'> | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { lagDays: 0, lagUnit: undefined, lagPercent: undefined };
  const m = s.match(/^([+-]?\d+(?:[.,]\d+)?)(ed|e%|d|%)?$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  const suffix = m[2] || 'd';
  const elapsed = suffix === 'ed' || suffix === 'e%';
  if (suffix === '%' || suffix === 'e%') {
    return { lagDays: 0, lagUnit: elapsed ? 'ELAPSEDTIME' : undefined, lagPercent: num };
  }
  return { lagDays: Math.round(num), lagUnit: elapsed ? 'ELAPSEDTIME' : undefined, lagPercent: undefined };
}
