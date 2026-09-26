import type { FieldRef } from '@/types/view';

/**
 * Een `FieldRef` als stringwaarde van een keuzelijst en terug. Eén codering voor lint, filter-,
 * groepeer-/sorteer- en rapportkeuzes, zodat een waarde uit de ene lijst in de andere klopt.
 */
export function encodeFieldRef(f: FieldRef): string {
  return JSON.stringify(f);
}

export function decodeFieldRef(s: string): FieldRef {
  return JSON.parse(s) as FieldRef;
}
