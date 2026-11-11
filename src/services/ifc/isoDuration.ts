import { IfcParseError } from './ifcErrors';

/** Exacte duurcomponenten. Dagen worden pas met de kalender van het slot omgerekend.
 * Oude OPS-dagen met exponent of teken bij het getal blijven leesbaar.
 * Jaren, maanden en weken hebben zonder extra kalendercontract geen betekenis in OPS.
 */
export function parseIfcDuration(text: string): { days: number; timeMinutes: number | null } {
  const legacy = /^(-?)P(?:0Y0M)?(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)D$/.exec(text);
  if (legacy) {
    const days = Number(legacy[2]);
    const internalSign = legacy[2].startsWith('-');
    if (Number.isFinite(days) && !(legacy[1] && internalSign) && (!internalSign || text.startsWith('P0Y0M'))) {
      return { days: (legacy[1] ? -1 : 1) * days, timeMinutes: null };
    }
  }
  const m = /^(-)?P(?:0Y)?(?:0M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/.exec(text);
  const fail = (): never => { throw new IfcParseError('duration', `Unsupported IFC duration: ${text}`); };
  if (!m || !m.slice(2).some(v => v !== undefined)) return fail();
  const hasTime = text.includes('T');
  if (hasTime && !m.slice(3).some(v => v !== undefined)) return fail();
  // Een breuk mag alleen in de kleinste aanwezige component staan.
  const parts = m.slice(2);
  if (parts.some((v, i) => v && /[.,]/.test(v) && parts.slice(i + 1).some(p => p !== undefined))) return fail();
  const n = (v: string | undefined) => v === undefined ? 0 : Number(v.replace(',', '.'));
  const sign = m[1] ? -1 : 1;
  const days = sign * n(m[2]);
  const minutes = sign * (n(m[3]) * 60 + n(m[4]) + n(m[5]) / 60);
  if (!Number.isFinite(days) || !Number.isFinite(minutes)) return fail();
  return { days, timeMinutes: hasTime ? minutes : null };
}
