/**
 * Waar het begeleidingspaneel staat (`GuidePanel.tsx`): een pure beslissing, zodat hij zonder browser
 * te toetsen is (`tests/planning/check-guide-placement.ts`).
 *
 * Het paneel zweeft onderaan, aan de eindkant (`end`, rechts; in ar/fa links) of aan de beginkant
 * (`start`); welke rechthoek elke kant is, rekent het paneel zelf uit. Het mag twee dingen niet bedekken: het gemarkeerde anker van de stap en een open venster
 * (`role="dialog"`), want daarin staan de knoppen die de stap laat aanklikken (knownbugs 91: Toepassen
 * in het venster Kalenders). De beslissing kijkt elke keer opnieuw, dus het paneel keert terug naar de
 * eindkant zodra die weer vrij is (knownbugs 59).
 *
 * Past het uitgeklapte paneel aan geen van beide kanten naast een open venster (een breed venster op
 * een klein scherm, zoals Kalenders op 1366×768), dan klapt het vanzelf in tot een knopje met alleen
 * de stapteller; dat knopje past wel in de rand naast het venster. Zonder venster verandert een anker
 * dat beide kanten raakt (bijv. de hele Gantt-kaart) niets: het paneel blijft waar het staat.
 */

export type GuideSide = 'end' | 'start';

export interface PlacementRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GuidePlacementInput {
  /** Waar het paneel nu staat. */
  current: GuideSide;
  /** Het uitgeklapte paneel aan elke kant. */
  expanded: Record<GuideSide, PlacementRect>;
  /** Het ingeklapte knopje aan elke kant. */
  compact: Record<GuideSide, PlacementRect>;
  /** Het gemarkeerde anker van de stap, als dat in beeld is. */
  anchor: PlacementRect | null;
  /** De open vensters. */
  dialogs: readonly PlacementRect[];
}

export interface GuidePlacement {
  side: GuideSide;
  /** Vanzelf ingeklapt: het uitgeklapte paneel bedekt aan elke kant een open venster. */
  autoCompact: boolean;
}

export function rectsOverlap(a: PlacementRect, b: PlacementRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

const SIDES: readonly GuideSide[] = ['end', 'start'];

export function placeGuidePanel(input: GuidePlacementInput): GuidePlacement {
  const obstacles = input.anchor ? [input.anchor, ...input.dialogs] : [...input.dialogs];
  const free = (r: PlacementRect) => !obstacles.some(o => rectsOverlap(r, o));

  const expandedSide = SIDES.find(s => free(input.expanded[s]));
  if (expandedSide) return { side: expandedSide, autoCompact: false };

  const coversDialog = input.dialogs.some(d => SIDES.some(s => rectsOverlap(input.expanded[s], d)));
  if (!coversDialog) return { side: input.current, autoCompact: false };

  const compactSide = SIDES.find(s => free(input.compact[s]));
  return { side: compactSide ?? input.current, autoCompact: true };
}
