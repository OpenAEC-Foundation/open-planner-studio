export interface CloseDocumentDialogActionDependencies {
  pendingId: string;
  getActiveDocumentId: () => string;
  getIsDirty: () => boolean;
  switchDocument: (id: string) => void;
  closeDocument: (id: string) => void;
  saveFile: () => Promise<void>;
  clearPending: () => void;
  restoreOpenerFocus: () => void;
}

export interface CloseDocumentDialogActions {
  cancel: () => void;
  discard: () => void;
  save: () => Promise<void>;
}

/**
 * De drie sluitkeuzes als uitvoerbare productieacties. Alleen een succesvolle Save die de actieve
 * state schoon achterlaat mag sluiten; annuleren of falen sluit wel de dialoog en herstelt focus.
 */
export function createCloseDocumentDialogActions(
  dependencies: CloseDocumentDialogActionDependencies,
): CloseDocumentDialogActions {
  const {
    pendingId,
    getActiveDocumentId,
    getIsDirty,
    switchDocument,
    closeDocument,
    saveFile,
    clearPending,
    restoreOpenerFocus,
  } = dependencies;

  return {
    cancel: () => {
      clearPending();
      restoreOpenerFocus();
    },
    discard: () => {
      closeDocument(pendingId);
      clearPending();
    },
    save: async () => {
      let closed = false;
      if (pendingId !== getActiveDocumentId()) switchDocument(pendingId);
      try {
        await saveFile();
        if (!getIsDirty()) {
          closeDocument(pendingId);
          closed = true;
        }
      } catch {
        // `saveFile` vangt normale opslagfouten zelf; ook een onverwachte reject mag geen document
        // sluiten of de bevestiging boven de app laten hangen.
      } finally {
        clearPending();
        if (!closed) restoreOpenerFocus();
      }
    },
  };
}
