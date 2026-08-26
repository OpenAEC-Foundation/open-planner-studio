/** Toetsen die de actieve documenttab in de zichtbare tabstrip verplaatsen. */
export type DocumentTabNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Bepaal de volgende documenttab zonder een verborgen limiet van negen documenten.
 * `null` betekent dat de toets geen tabnavigatie is, of dat de huidige tab niet meer bestaat.
 */
export function documentTabKeyDestination(
  documentIds: readonly string[],
  activeDocumentId: string,
  key: string,
): string | null {
  const current = documentIds.indexOf(activeDocumentId);
  if (current < 0 || documentIds.length === 0) return null;

  switch (key as DocumentTabNavigationKey) {
    case 'ArrowLeft': return documentIds[(current - 1 + documentIds.length) % documentIds.length] ?? null;
    case 'ArrowRight': return documentIds[(current + 1) % documentIds.length] ?? null;
    case 'Home': return documentIds[0] ?? null;
    case 'End': return documentIds[documentIds.length - 1] ?? null;
    default: return null;
  }
}

/** Klein DOM-contract zodat de navigatie ook zonder DOM-testframework gericht toetsbaar blijft. */
export interface RevealableDocumentTab {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

/** Houd de geactiveerde tab zichtbaar, zonder de verticale pagina-positie te verplaatsen. */
export function revealDocumentTab(tab: RevealableDocumentTab): void {
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
