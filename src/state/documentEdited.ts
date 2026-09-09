/**
 * Het ENE punt waar een document "bewerkt" wordt (heropen-beleid optie B, eigenaarsbesluit
 * 2026-09-09). `isDirty` zegt "er is iets te bewaren"; `importPristine` zegt "sinds de import is
 * er niets bewerkt" en stuurt of een heropend eigen IFC automatisch in "datums zoals opgeslagen"
 * mag. Beide horen bij elkaar: elke mutator die het eerste zet, wist het tweede. Opslaan raakt
 * geen van beide hier (dat zet `isDirty` terug op `false` en laat `importPristine` staan — opslaan
 * is geen bewerking). Bladmodule: geen imports, zodat elke slice en runtime hem kan gebruiken.
 * Een broncodescan in `check-recorded-dates.ts` bewaakt dat `isDirty = true` nergens anders staat.
 */
export function markDocumentEdited(state: { isDirty: boolean; importPristine: boolean }): void {
  state.isDirty = true;
  state.importPristine = false;
}
