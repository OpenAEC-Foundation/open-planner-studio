import type { Sequence } from '@/types/sequence';
import { trimNumber } from '@/utils/durationFormat';
import { isFiniteNumber } from '@/utils/guards';

/** De velden die de lag-notatie samen dragen: dagen, procent en uren. */
type LagFields = Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;

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
 *
 * `hourSuffix` (eigenaarsbesluit 2026-10-20): de schermen geven de uur-afkorting van de app-taal door
 * (`parseableHourSuffix`: "+2u" in nl, "+2h" in en). Zonder argument blijft het `u`: de taalneutrale
 * vorm voor bestanden (CSV) en de engine-rapporten.
 */
export function formatLagShort(seq: LagFields, hourSuffix: 'u' | 'h' = 'u'): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (isFiniteNumber(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (isFiniteNumber(seq.lagMinutes) && seq.lagMinutes !== 0) {
    const hours = seq.lagMinutes / 60;
    return `${hours >= 0 ? '+' : ''}${trimNumber(hours, 2)}${e}${hourSuffix}`;
  }
  if (!seq.lagDays) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${trimNumber(seq.lagDays, 6)}${e}d`;
}

/**
 * Zet de uur-eenheid van een taalneutrale lagtekst ("+2u", "+3eu" uit `formatLagShort` zonder
 * argument, bijv. in het gezondheidsrapport) om naar de afkorting van de app-taal. Andere lagteksten
 * ("+2d", "+50%") blijven gelijk.
 */
export function localizeLagHourSuffix(lag: string, hourSuffix: 'u' | 'h'): string {
  return lag.replace(/^([+-]?\d+(?:[.,]\d+)?e?)u$/, `$1${hourSuffix}`);
}

/**
 * De eenheden die `parseLagInput` achter het getal accepteert, als regex-alternatie. Eén bron: de
 * CSV-voorgangerkolom (`csvReader`, "1.1FS+2u") bouwt zijn token-regex hieruit, zodat een CSV
 * precies de notatie leest die `formatLagShort` schrijft en de app overal toont.
 */
export const LAG_UNIT_SUFFIXES = 'ed|eu|eh|e%|d|u|h|%';
const LAG_INPUT = new RegExp(`^([+-]?\\d+(?:[.,]\\d+)?)(${LAG_UNIT_SUFFIXES})?$`);

/**
 * Parse gebruikersinvoer naar lag-velden. Accepteert "2", "+2", "-1", "2d", "3ed", "50%",
 * "-25e%" (hoofdletterongevoelig, spaties genegeerd), én uren: "2u"/"2h" (werktijd-uren,
 * minuut-precies) en "3eu"/"3eh" (elapsed uren — kalonderuren, 24/7). De weergave volgt de app-taal
 * (`u` in nl, `h` in en, zie `formatLagShort`); de invoer blijft taalonafhankelijk d/u/h/m, symmetrisch
 * met `parseDuration` in `durationFormat.ts`.
 *
 * Kale getallen = werkdagen. Een breuk blijft staan, met punt of komma: "1,5d" is anderhalve werkdag
 * en "0,5" een halve (spec "alleen uren" §3.3, I12; tot zes decimalen, zoals de opslag in IFC). In het
 * OPS-profiel telt zo'n lag in de dagenmaat, onder P6/MSP als uren (de motor, `lagCountsInWorkdays`).
 * Geeft null terug bij onparseerbare invoer; lege invoer = lag 0
 * (werkdagen). Elke branche zet de NIET-gebruikte lag-velden expliciet op `undefined`/0 —
 * anders overleeft een eerder gezette `lagMinutes` een omzetting naar dagen/procent stilletjes
 * (dezelfde valkuil als de MCP-bridge in `sequenceFields.ts` documenteert: de solver leest
 * `lagPercent` → `lagMinutes` → `lagDays`, dus een achtergebleven minuut-lag overrulet de
 * zojuist ingevoerde dag-/procent-lag).
 */
export function parseLagInput(input: string): LagFields | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { lagDays: 0, lagUnit: undefined, lagPercent: undefined, lagMinutes: undefined };
  const m = s.match(LAG_INPUT);
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
    // lagDays: 0 — zelfde conventie als mspdiReader: een minuut-lag is de bron van
    // waarheid, lagDays blijft de (niet-misleidende) 0-fallback voor lezers die lagMinutes niet
    // kennen.
    return { lagDays: 0, lagUnit, lagPercent: undefined, lagMinutes: Math.round(num * 60) };
  }
  // Geen afronding meer op hele dagen (I12): de lag houdt de getypte breuk.
  const days = Number(num.toFixed(6));
  return { lagDays: days || 0, lagUnit, lagPercent: undefined, lagMinutes: undefined };
}
