export function projectOverviewCloseButtonId(documentId: string): string {
  return `ops-overview-close-${documentId}`;
}

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

export function documentTabFocusTargetOutsideOverview(
  projectOverviewOpen: boolean,
  documentId: string | null,
): string | null {
  return projectOverviewOpen ? null : documentId;
}
