/**
 * Welke native `title` een gridcel toont (issue #89). Drie bronnen, met verschillende regels:
 *
 *  - `tooltip`: een uitleg die de kolom zelf meegeeft (bv. "geen baseline voor deze taak" bij een
 *    lege baselinecel). Die zegt iets wat de cel NIET laat zien en verschijnt daarom altijd.
 *  - `title` ≠ `text`: de volledige waarde draagt méér dan de weergave — de canonieke ISO-instant
 *    achter een datum in persoonlijke notatie, of de technische JSON achter "3 toewijzingen". Ook
 *    die verschijnt altijd; zonder hem is die informatie nergens anders bereikbaar.
 *  - `title` = `text`: dezelfde tekst nog eens is alleen zinvol wanneer de cel hem afknipt met een
 *    ellipsis; staat de waarde al volledig in beeld, dan is de tooltip enkel ruis (en botste hij
 *    met de taakkaart en de relatietooltips).
 */
export interface GridCellTitleInput {
  tooltip?: string;
  title?: string;
  text?: string;
  truncated: boolean;
}

export function resolveGridCellTitle({ tooltip, title, text, truncated }: GridCellTitleInput): string | undefined {
  if (tooltip) return tooltip;
  if (!title) return undefined;
  if (text !== undefined && title !== text) return title;
  return truncated ? title : undefined;
}

/** Een geknipte box (overflow hidden + nowrap) heeft meer inhoud dan hij laat zien. */
export function isClippedBoxTruncated(box: { scrollWidth: number; clientWidth: number }): boolean {
  return box.scrollWidth > box.clientWidth;
}

/** Elke box in de cel die zelf afknipt (overflow hidden + ellipsis) draagt dit attribuut; de
 * naamcel knipt bijvoorbeeld niet op de contentspan maar op het geneste tekstlabel. */
export const GRID_CLIP_ATTRIBUTE = 'data-grid-clip';

/** Een cel is afgeknipt zodra één van zijn clipboxen afknipt. */
export function isGridCellTruncated(cell: {
  querySelectorAll: (selector: string) => ArrayLike<{ scrollWidth: number; clientWidth: number }>;
}): boolean {
  const boxes = cell.querySelectorAll(`[${GRID_CLIP_ATTRIBUTE}]`);
  for (let index = 0; index < boxes.length; index++) {
    if (isClippedBoxTruncated(boxes[index])) return true;
  }
  return false;
}
