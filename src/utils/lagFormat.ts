import type { Sequence } from '@/types/sequence';

/** De velden die de lag-notatie samen dragen (fase F1: uren erbij naast dagen/procent). */
type LagFields = Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;

/** Compacte getal-weergave: tot 2 decimalen, trailing nullen weg (2 → "2", 1.5 → "1.5"). */
function trimNumber(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * Korte lag-notatie voor weergave, in MS Project-stijl en symmetrisch met parseLagInput:
 * "+2d" (werkdagen), "-1d" (lead), "+3ed" (kalenderdagen), "+2u" (uren, minuut-precies —
 * `lagMinutes` is de bron zodra gezet, zie `Sequence.lagMinutes`), "+50%", "-25e%" (procent
 * van de voorgangerduur, e = elapsed). Lege string voor lag 0 zonder procent/minuten.
 *
 * Precedentie spiegelt `CPMSolver.resolveLagMinutes`/`resolveElapsedMinutes`: lagPercent →
 * lagMinutes → lagDays. Een relatie met een gezette `lagMinutes` toont dus de UREN-vorm, nooit
 * een van `lagDays` afgeleide dag-vorm (die voor een minuut-lag toch altijd 0 is, zie
 * `parseLagInput`/`mspdiReader`).
 */
export function formatLagShort(seq: LagFields): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes) && seq.lagMinutes !== 0) {
    const hours = seq.lagMinutes / 60;
    return `${hours >= 0 ? '+' : ''}${trimNumber(hours)}${e}u`;
  }
  if (!seq.lagDays) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${seq.lagDays}${e}d`;
}

/**
 * Parse gebruikersinvoer naar lag-velden. Accepteert "2", "+2", "-1", "2d", "3ed", "50%",
 * "-25e%" (hoofdletterongevoelig, spaties genegeerd), én uren: "2u"/"2h" (werktijd-uren,
 * minuut-precies) en "3eu"/"3eh" (elapsed uren — kalonderuren, 24/7). `u` is de weergave-vorm
 * (taalonafhankelijk, net als `d`); `h` wordt ALLEEN als invoer geaccepteerd, symmetrisch met
 * `parseDuration` in `durationFormat.ts` (§6.4: "invoer blijft taalonafhankelijk d/u/h/m").
 *
 * Kale getallen = werkdagen. Geeft null terug bij onparseerbare invoer; lege invoer = lag 0
 * (werkdagen). Elke branche zet de NIET-gebruikte lag-velden expliciet op `undefined`/0 —
 * anders overleeft een eerder gezette `lagMinutes` een omzetting naar dagen/procent stilletjes
 * (dezelfde valkuil als de MCP-bridge in `sequenceFields.ts` documenteert: de solver leest
 * `lagPercent` → `lagMinutes` → `lagDays`, dus een achtergebleven minuut-lag overrulet de
 * zojuist ingevoerde dag-/procent-lag).
 */
export function parseLagInput(input: string): LagFields | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { lagDays: 0, lagUnit: undefined, lagPercent: undefined, lagMinutes: undefined };
  const m = s.match(/^([+-]?\d+(?:[.,]\d+)?)(ed|eu|eh|e%|d|u|h|%)?$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  const suffix = m[2] || 'd';
  const elapsed = suffix === 'ed' || suffix === 'eu' || suffix === 'eh' || suffix === 'e%';
  const lagUnit = elapsed ? 'ELAPSEDTIME' : undefined;
  if (suffix === '%' || suffix === 'e%') {
    return { lagDays: 0, lagUnit, lagPercent: num, lagMinutes: undefined };
  }
  if (suffix === 'u' || suffix === 'h' || suffix === 'eu' || suffix === 'eh') {
    // lagDays: 0 — zelfde conventie als mspdiReader (§7.3): een minuut-lag is de bron van
    // waarheid, lagDays blijft de (niet-misleidende) 0-fallback voor lezers die lagMinutes niet
    // kennen.
    return { lagDays: 0, lagUnit, lagPercent: undefined, lagMinutes: Math.round(num * 60) };
  }
  return { lagDays: Math.round(num), lagUnit, lagPercent: undefined, lagMinutes: undefined };
}
