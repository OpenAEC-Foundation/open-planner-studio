export type DocumentTabNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';
export type DocumentTabDirection = 'ltr' | 'rtl';

export const DOCUMENT_TABPANEL_ID = 'ops-document-tabpanel';

export function documentTabId(documentId: string): string {
  return `ops-document-tab-${documentId}`;
}

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

export function documentTabCloseFocusTarget(
  previousDocumentIds: readonly string[],
  currentDocuments: readonly DocumentTabFocusState[],
  requestedDocumentId: string | null,
): string | null {
  if (!requestedDocumentId || !previousDocumentIds.includes(requestedDocumentId)) return null;
  if (currentDocuments.some(document => document.id === requestedDocumentId)) return null;
  return currentDocuments.find(document => document.isActive)?.id ?? null;
}

export interface RevealableDocumentTab {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

export interface FocusableDocumentTab extends RevealableDocumentTab {
  focus(options?: FocusOptions): void;
}

export function focusDocumentTab(
  tabs: ReadonlyMap<string, FocusableDocumentTab>,
  documentId: string,
): boolean {
  const tab = tabs.get(documentId);
  if (!tab) return false;
  tab.focus({ preventScroll: true });
  revealDocumentTab(tab);
  return true;
}

export function revealDocumentTab(tab: RevealableDocumentTab): void {
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
