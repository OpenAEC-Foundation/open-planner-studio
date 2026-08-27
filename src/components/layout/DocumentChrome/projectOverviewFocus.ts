/** Stabiele DOM-id voor een sluitknop in het zichtbare projectenoverzicht. */
export function projectOverviewCloseButtonId(documentId: string): string {
  return `ops-overview-close-${documentId}`;
}

/**
 * Bepaal de volgende zichtbare overzichtskaart na een gecommitteerde sluiting.
 * De kaart op dezelfde index wint; verdween de laatste kaart, dan wordt het de vorige.
 * Bij vervanging van het laatste document staat het verse document op diezelfde index nul.
 */
export function projectOverviewCloseFocusTarget(
  previousDocumentIds: readonly string[],
  currentDocumentIds: readonly string[],
  requestedDocumentId: string | null,
): string | null {
  if (!requestedDocumentId) return null;
  const removedIndex = previousDocumentIds.indexOf(requestedDocumentId);
  if (removedIndex < 0 || currentDocumentIds.includes(requestedDocumentId)) return null;
  if (currentDocumentIds.length === 0) return null;
  return currentDocumentIds[Math.min(removedIndex, currentDocumentIds.length - 1)] ?? null;
}

/** Een tab achter het open projectenoverzicht mag nooit closefocus claimen. */
export function documentTabFocusTargetOutsideOverview(
  projectOverviewOpen: boolean,
  documentId: string | null,
): string | null {
  return projectOverviewOpen ? null : documentId;
}
