/**
 * Toetsenbordnavigatie in tabelvormige editors — de PURE kern voor de LIVE rasters (issue #48): de
 * resourcetabel (`ResourcePanel`) en de fasentabel van `ContourDialog`, allebei via `useLiveGridNav`.
 *
 * De app heeft bewust twee verschillende raster-*mechanieken*, en die zijn niet samen te voegen:
 *
 * - Het **taakraster** (`FullTaskGrid`/`GanttTaskGrid`, kern in `src/engine/taskGrid/`) is een
 *   spreadsheet: er is precies ÉÉN editor tegelijk, de cursor is React-state (`selection`/`editing`
 *   in `TaskGridSurface`) en de overige cellen zijn platte `GridCell`s.
 * - De **resourcetabel** (`ResourcePanel`) is een formulierraster: ELKE cel is altijd een echt
 *   invoerveld/`<select>`. De cursor is daar dus geen state maar de DOM-focus.
 *
 * Het taakraster heeft een eigen puur toetsbeleid (`resolveTaskGridCommand` in
 * `engine/taskGrid/navigation.ts`, aangeroepen vanuit `DataGridCore`) en deelt met dit bestand
 * alleen het type `GridKeyEventLike`. Wat hier staat — de rekensom "welke cel ligt in richting X"
 * en het beleid "welke toets is een navigatie" in een live raster — is headless, zonder React en
 * zonder DOM, zodat `tests/planning/check-grid-nav.ts` het kan afdwingen. `useLiveGridNav`
 * (`components/panels/hooks/`) gebruikt het om de DOM-focus te verzetten.
 */

export type GridDirection = 'up' | 'down' | 'left' | 'right';

export interface GridCellRef<F extends string = string> {
  rowId: string;
  field: F;
}

/**
 * Buurcel over (rijen × velden). `null` = geen buur: je staat aan de rand, of de rij/het veld komt
 * niet (meer) in de lijst voor. De aanroeper beslist wat "geen buur" betekent — `useLiveGridNav`
 * maakt er met een `onAppendRow` (de resourcetabel) "Enter/↓ op de laatste rij ⇒ nieuwe rij" van.
 */
export function neighbourGridCell<F extends string>(
  rowIds: readonly string[],
  fields: readonly F[],
  cell: GridCellRef<F>,
  direction: GridDirection,
): GridCellRef<F> | null {
  const rowIndex = rowIds.indexOf(cell.rowId);
  const colIndex = fields.indexOf(cell.field);
  if (rowIndex === -1 || colIndex === -1) return null;

  let newRow = rowIndex;
  let newCol = colIndex;
  if (direction === 'up') newRow = rowIndex - 1;
  else if (direction === 'down') newRow = rowIndex + 1;
  else if (direction === 'left') newCol = colIndex - 1;
  else newCol = colIndex + 1;

  if (newRow < 0 || newRow >= rowIds.length) return null;
  if (newCol < 0 || newCol >= fields.length) return null;
  return { rowId: rowIds[newRow], field: fields[newCol] };
}

/** Is dit de laatste rij van het raster? (Bepaalt of "geen buur naar beneden" een nieuwe rij wordt.) */
export function isLastGridRow(rowIds: readonly string[], rowId: string): boolean {
  return rowIds.length > 0 && rowIds[rowIds.length - 1] === rowId;
}

/**
 * Soort besturingselement onder de cursor. Bewust op een structureel type (geen `Element`), zodat
 * het beleid hieronder zonder DOM te testen is.
 */
export type GridControlKind = 'text' | 'number' | 'select' | 'other';

export function controlKindOf(el: { tagName: string; type?: string } | null | undefined): GridControlKind {
  if (!el) return 'other';
  const tag = el.tagName.toUpperCase();
  if (tag === 'SELECT') return 'select';
  if (tag === 'TEXTAREA') return 'text';
  if (tag !== 'INPUT') return 'other';
  const type = (el.type ?? 'text').toLowerCase();
  if (type === 'number' || type === 'range') return 'number';
  if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return 'other';
  return 'text';
}

/** Verticale uitsnede van een element/scroller — genoeg om zichtbaarheid mee te rekenen. */
export interface GridBox {
  top: number;
  bottom: number;
}

/**
 * Hoeveel moet `scrollTop` van de scroller verschuiven om `row` volledig zichtbaar te maken?
 * `0` = hij staat al goed. Positief = naar beneden scrollen, negatief = naar boven.
 *
 * Waarom dit expliciet gerekend wordt in plaats van op `el.focus()` te leunen (issue #48, tweede
 * ronde): de browser scrolt alleen mee wanneer de focus DAADWERKELIJK verspringt. Bij doorlopend
 * invoeren met Enter houdt hetzelfde naamveld de focus (de concept-rij blijft dezelfde
 * DOM-node, alleen de rij erboven is aangegroeid), dus `focus()` is een no-op — inclusief het
 * scrollen. Gemeten bij 40 resources in een venster van 900 px: de rij zakte naar y 865 terwijl de
 * scroller op 863 eindigde, en bleef daar bij elke volgende Enter. De gebruiker typte blind.
 *
 * `stickyHeaderHeight` is niet optioneel gedrag maar noodzaak: de kolomkoppen van beide tabellen
 * zijn `sticky top-0`. Zonder die marge zou "in beeld scrollen" bij de bovenrand een rij precies
 * ONDER de kopregel parkeren — technisch binnen de scroller, visueel onzichtbaar.
 */
export function scrollDeltaToReveal(viewport: GridBox, row: GridBox, stickyHeaderHeight = 0): number {
  const topLimit = viewport.top + stickyHeaderHeight;
  // Past de rij helemaal niet? Dan de BOVENkant laten winnen — daar staat de tekst waar je op mikt.
  if (row.top < topLimit) return row.top - topLimit;
  if (row.bottom > viewport.bottom) {
    const delta = row.bottom - viewport.bottom;
    // Nooit zó ver doorschieten dat de bovenkant onder de kopregel verdwijnt.
    return Math.min(delta, row.top - topLimit);
  }
  return 0;
}

export interface GridKeyEventLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Beleid voor een LIVE raster (elke cel is al een echt invoerveld): welke richting hoort bij deze
 * toets?
 *
 * - **Enter** navigeert altijd omlaag, **Shift+Enter** omhoog — op élk besturingselement. Enter
 *   heeft in een los invoerveld/`<select>` geen eigen betekenis (er is geen formulier om te
 *   versturen), dus die toets is vrij. Dit is ook precies wat de melder van #48 vroeg.
 * - **↑/↓** navigeren ALLEEN in een tekstveld. In een `<select>` kiezen ze de volgende optie en in
 *   een `<input type=number>` stappen ze de waarde — dat native gedrag afpakken zou de kalender-,
 *   type- en ploegkolom en de max.eenheden-spinner onbruikbaar maken. Het taakraster gebruikt dit
 *   beleid niet; zijn toetsbeleid is `resolveTaskGridCommand`.
 * - Alt/Ctrl/⌘ erbij ⇒ nooit: dat zijn de globale sneltoetsen (in-/uitspringen, zoom).
 */
export function liveGridNavDirection(e: GridKeyEventLike, control: GridControlKind): 'up' | 'down' | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === 'Enter') return e.shiftKey ? 'up' : 'down';
  if (e.shiftKey) return null;
  if (control !== 'text') return null;
  if (e.key === 'ArrowDown') return 'down';
  if (e.key === 'ArrowUp') return 'up';
  return null;
}
