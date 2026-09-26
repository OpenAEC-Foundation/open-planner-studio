/**
 * Eén antwoord op de vraag "wat doe je met een getal dat buiten de toegestane keuzelijst valt?".
 *
 * Deze module is het enige antwoord: snappen naar de dichtstbijzijnde toegestane waarde — gedeeld
 * door de settings-loader, de rapport-loader en de render-engine, zodat die niet elk een eigen regel
 * (snappen/verwerpen/klemmen) hanteren.
 *
 * Waarom snappen en niet verwerpen: een waarde buiten de lijst is meestal een handmatig bewerkte of
 * half-gemigreerde voorkeur, geen rommel. Snappen behoudt de bedoeling van de gebruiker ("iets
 * groter dan normaal") terwijl verwerpen 'm terugzet op de default. En snappen — anders dan klemmen
 * op het bereik — garandeert dat de uitkomst ook echt aanwijsbaar is in de bijbehorende UI.
 */

/**
 * Snap `raw` naar de dichtstbijzijnde waarde uit `allowed`.
 *
 * @returns de dichtstbijzijnde toegestane waarde, of `undefined` als `raw` geen bruikbaar getal is
 *          (de aanroeper valt dan terug op zijn eigen default). Bij een gelijke afstand wint de
 *          waarde die het eerst in `allowed` staat.
 */
export function snapToChoice(allowed: readonly number[], raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  if (allowed.length === 0) return undefined;
  return allowed.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), allowed[0]);
}
