/** Toetsen die de actieve documenttab in de zichtbare tabstrip verplaatsen. */
export type DocumentTabNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';
export type DocumentTabDirection = 'ltr' | 'rtl';

/** Eén stabiele relatie tussen de documenttablist en de actieve documentwerkruimte. */
export const DOCUMENT_TABPANEL_ID = 'ops-document-tabpanel';

/** Stabiele DOM-id voor een documenttab; document-id's zijn uniek binnen de sessie. */
export function documentTabId(documentId: string): string {
  return `ops-document-tab-${documentId}`;
}

/**
 * Bepaal de volgende documenttab zonder een verborgen limiet van negen documenten.
 * `null` betekent dat de toets geen tabnavigatie is, of dat de huidige tab niet meer bestaat.
 */
export function documentTabKeyDestination(
  documentIds: readonly string[],
  activeDocumentId: string,
  key: string,
  direction: DocumentTabDirection,
): string | null {
  const current = documentIds.indexOf(activeDocumentId);
  if (current < 0 || documentIds.length === 0) return null;

  switch (key as DocumentTabNavigationKey) {
    case 'ArrowLeft': {
      const delta = direction === 'rtl' ? 1 : -1;
      return documentIds[(current + delta + documentIds.length) % documentIds.length] ?? null;
    }
    case 'ArrowRight': {
      const delta = direction === 'rtl' ? -1 : 1;
      return documentIds[(current + delta + documentIds.length) % documentIds.length] ?? null;
    }
    case 'Home': return documentIds[0] ?? null;
    case 'End': return documentIds[documentIds.length - 1] ?? null;
    default: return null;
  }
}

export interface DocumentTabKeyEvent {
  key: string;
  target: unknown;
  currentTarget: unknown;
  preventDefault(): void;
}

export interface DocumentTabKeyActions {
  switchTo(documentId: string): void;
  focusTab(documentId: string): void;
}

/** Volledige key-eventbeslissing die de tabcomponent zonder eigen indexguard gebruikt. */
export function handleDocumentTabKeyDown(
  event: DocumentTabKeyEvent,
  documentIds: readonly string[],
  activeDocumentId: string,
  direction: DocumentTabDirection,
  actions: DocumentTabKeyActions,
): string | null {
  if (event.target !== event.currentTarget) return null;
  const nextId = documentTabKeyDestination(documentIds, activeDocumentId, event.key, direction);
  if (!nextId) return null;
  event.preventDefault();
  actions.switchTo(nextId);
  actions.focusTab(nextId);
  return nextId;
}

export interface DocumentTabFocusState {
  id: string;
  isActive: boolean;
}

/**
 * Bepaal het close-focusdoel uit twee gecommitteerde kaartenlijsten.
 *
 * Een bestaande document-id in de nieuwe lijst betekent dat de closebevestiging is geannuleerd
 * of dat de sluitactie nog niet effectief is; in beide gevallen mag focus niet verschuiven. Alleen
 * het verdwijnen van het aangevraagde document levert het nieuwe actieve document op.
 */
export function documentTabCloseFocusTarget(
  previousDocumentIds: readonly string[],
  currentDocuments: readonly DocumentTabFocusState[],
  requestedDocumentId: string | null,
): string | null {
  if (!requestedDocumentId || !previousDocumentIds.includes(requestedDocumentId)) return null;
  if (currentDocuments.some(document => document.id === requestedDocumentId)) return null;
  return currentDocuments.find(document => document.isActive)?.id ?? null;
}

/** Klein DOM-contract zodat de navigatie ook zonder DOM-testframework gericht toetsbaar blijft. */
export interface RevealableDocumentTab {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

/** Houd de geactiveerde tab zichtbaar, zonder de verticale pagina-positie te verplaatsen. */
export function revealDocumentTab(tab: RevealableDocumentTab): void {
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
