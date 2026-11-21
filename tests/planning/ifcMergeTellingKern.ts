// Alleen de meetlat: geen productroute. Vergelijk bekende weigeringen op soort én concrete bronvelden.
import type { MergePhase2Case } from '@/services/ifc/foreign/mergeWriter';

export interface ExpectedRefusal { readonly reason: string; readonly cases: readonly string[] }
/** De volgorde van meldingen is niet betekenisvol; dubbele meldingen blijven afzonderlijke voorkomens.
 * Bij een slotloos geval (bijvoorbeeld een deels gelezen klok) benoemt de detailtekst zelf het veld/de klok.
 */
export function refusalSignature(c: MergePhase2Case): string {
  if (!c.field) return `${c.kind} | ${c.sourceId ?? 'geen #id'} | ${c.detail}`;
  const f = c.field;
  return `${c.kind} | ${c.sourceId ?? 'geen #id'} | ${c.detail.split(':')[0]} | ${f.arg} | ${f.whole ?? ''} | ${f.slotless ?? ''} | ${f.outArg ?? ''} | ${f.ambiguous ?? false}`;
}
export function matchesRefusal(cases: readonly MergePhase2Case[], expected: ExpectedRefusal): boolean {
  const actual = cases.map(refusalSignature).sort(), wanted = [...expected.cases].sort();
  return actual.length === wanted.length && actual.every((value, i) => value === wanted[i]);
}

export const TALLY_GROUPS = ['eigen, schrijft zonder bewerking', 'eigen, weigert zonder bewerking', 'ander programma'] as const;
/** Deel in op de werkelijke uitkomst, ook als een weigering geen enkel niet-gedragen-geval heeft. */
export function tallyGroup(outcome: string | undefined): typeof TALLY_GROUPS[number] {
  return outcome === undefined ? TALLY_GROUPS[2] : outcome === 'schrijft' ? TALLY_GROUPS[0] : TALLY_GROUPS[1];
}
