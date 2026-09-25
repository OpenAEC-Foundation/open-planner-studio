/**
 * Structurele gelijkheid voor de no-op-guards van de store en de gevolgregel-poorten van een
 * taakbewerking (`taskTriggerChanges` in taskDefaults.ts). Eén definitie, zodat "is dit per saldo
 * een wijziging?" overal hetzelfde betekent:
 *
 *  - scalars via `===` (plus `NaN` ≡ `NaN`);
 *  - objecten sleutelvolgorde-ONafhankelijk, en een sleutel met waarde `undefined` is gelijk aan een
 *    afwezige sleutel — een aanroeper die een heel object terugstuurt met `veld: undefined` erin
 *    (zoals `TaskDialog.handleSave` met `durationMinutes` bij een dagtaak) verandert daarmee niets;
 *  - arrays positioneel;
 *  - identieke referenties worden niet doorlopen: een samengevoegde taak deelt haar ongewijzigde
 *    velden met het origineel, dus de vergelijking kost alleen iets voor wat de aanroeper meestuurde.
 *
 * Leest Immer-drafts gewoon door (dat maakt ze niet gewijzigd). Bedoeld voor JSON-achtige
 * domeindata; `Date`/`Map`/`Set` komen in de store niet voor en worden hier niet ondersteund.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  for (const key of Object.keys(left)) {
    if (!sameValue(left[key], right[key])) return false;
  }
  // Sleutels die alleen rechts voorkomen: gelijk zolang ze `undefined` zijn (≡ afwezig links).
  for (const key of Object.keys(right)) {
    if (left[key] === undefined && right[key] !== undefined) return false;
  }
  return true;
}
