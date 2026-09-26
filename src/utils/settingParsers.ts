/**
 * Validators voor opgeslagen voorkeuren (localStorage), gedeeld door de settings-registry en de
 * rapportvoorkeuren. Elke parser geeft `undefined` terug bij een waarde die hij niet vertrouwt; de
 * aanroeper valt dan PER VELD terug op zijn default — een handmatig geprutste of half-gemigreerde
 * sleutel reset hooguit dát ene veld. Voor een getal uit een vaste keuzelijst: `snapToChoice`.
 */

/** Alleen een echte boolean wordt overgenomen. */
export function parseBoolean(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

/** Alleen een waarde uit `allowed` wordt overgenomen. */
export function parseEnum<T extends string>(allowed: readonly T[], raw: unknown): T | undefined {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/** Vrij instelbaar getal: afronden + klemmen op [min,max], zodat een rare waarde de UI niet onbruikbaar maakt. */
export function parseClampedInt(raw: unknown, min: number, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.min(max, Math.max(min, Math.round(raw)));
}
