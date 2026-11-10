/**
 * Waar de waarde van een `IfcLagTime` staat. De lezer (`extractSequences` in `ifcReader.ts`) en de verliesbewaking van
 * de merge (`durationTexts` in `foreign/lossCheck.ts`) kiezen het slot met deze ene functie (#804 fase 1b, fixronde 6):
 *  - `ratio`: `LagValue` (argument 4) is `IFCRATIOMEASURE(…)`, een procent van de voorganger; `text` is het getal;
 *  - `duur`: `LagValue` is `IFCDURATION('…')`; `text` is de tekst met aanhalingstekens;
 *  - `tekst`: `LagValue` is een ongetypte duur (`'P2D'`, van een ander programma); `text` idem;
 *  - `oud`: de oude indeling van OPS (tot `b1a8cb52c`, 2 juli 2026): `.WORKTIME.` in argument 4 en de duur als tekst in
 *    argument 5, `IFCLAGTIME('Lag',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D')`. De lezer neemt elke andere `LagValue` ook zo.
 * `arg` is de index van het argument met de waarde. Bladmodule: geen imports, zodat lezer en merge hem zonder cyclus delen.
 */
export type LagValueSlot =
  | { readonly kind: 'ratio' | 'duur' | 'tekst'; readonly arg: 3; readonly text: string }
  | { readonly kind: 'oud'; readonly arg: 4; readonly text: string };

/** De soorten van `LagValueSlot` als constanten. De lezer vergelijkt hiermee, niet met een losse tekst: de controle op het
 *  register (`check-ifc-pset-register.ts`, regel B) ziet elke tekst in een vergelijking van de lezer als een mogelijke
 *  propertynaam. */
export const LAG_SLOT = { ratio: 'ratio', duur: 'duur', tekst: 'tekst', oud: 'oud' } as const satisfies Record<LagValueSlot['kind'], LagValueSlot['kind']>;

/** Het slot met de waarde van een `IfcLagTime` met deze argumenten (zie `LagValueSlot`). */
export function lagValueSlot(args: readonly string[]): LagValueSlot {
  const lagValue = (args[3] || '').trim();
  // Een STEP-REAL mag een exponent dragen (`5.E-1`). De writer schrijft altijd een decimale punt (`1.` voor 100 %).
  const ratio = lagValue.match(/^IFCRATIOMEASURE\s*\(\s*(-?[\d.]+(?:E[+-]?\d+)?)\s*\)$/i);
  if (ratio) return { kind: 'ratio', arg: 3, text: ratio[1] };
  const duration = lagValue.match(/^IFCDURATION\s*\(\s*(.+?)\s*\)$/i);
  if (duration) return { kind: 'duur', arg: 3, text: duration[1] };
  if (lagValue.startsWith("'")) return { kind: 'tekst', arg: 3, text: lagValue };
  return { kind: 'oud', arg: 4, text: args[4] || '' };
}
