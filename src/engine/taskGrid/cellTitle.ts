/**
 * Welke native `title` een gridcel toont (issue #89). Twee bronnen, met verschillende regels:
 *
 *  - `tooltip`: een uitleg die de kolom zelf meegeeft (bv. "geen baseline voor deze taak" bij een
 *    lege baselinecel). Die zegt iets wat de cel NIET laat zien en verschijnt daarom altijd.
 *  - `title`: de volledige celwaarde. Die is alleen zinvol wanneer de cel de waarde afknipt met
 *    een ellipsis; staat de waarde al volledig in beeld, dan is dezelfde tekst nog eens als
 *    tooltip enkel ruis (en botste hij met de taakkaart en de relatietooltips).
 */
export interface GridCellTitleInput {
  tooltip?: string;
  title?: string;
  truncated: boolean;
}

export function resolveGridCellTitle({ tooltip, title, truncated }: GridCellTitleInput): string | undefined {
  if (tooltip) return tooltip;
  return truncated && title ? title : undefined;
}

/** Een geknipte box (overflow hidden + nowrap) heeft meer inhoud dan hij laat zien. */
export function isClippedBoxTruncated(box: { scrollWidth: number; clientWidth: number }): boolean {
  return box.scrollWidth > box.clientWidth;
}
