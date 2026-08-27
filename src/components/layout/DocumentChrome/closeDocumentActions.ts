export interface CloseDocumentActionGate {
  started: boolean;
}

export function createCloseDocumentActionGate(): CloseDocumentActionGate {
  return { started: false };
}

export interface CloseDocumentDialogActionDependencies {
  gate?: CloseDocumentActionGate;
  pendingId: string;
  getActiveDocumentId: () => string;
  switchDocument: (id: string) => void;
  closeDocument: (id: string) => void;
  saveFile: () => Promise<boolean>;
  clearPending: () => void;
  restoreOpenerFocus: () => void;
  onSavePendingChange: (pending: boolean) => void;
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
    gate = createCloseDocumentActionGate(),
    pendingId,
    getActiveDocumentId,
    switchDocument,
    closeDocument,
    saveFile,
    clearPending,
    restoreOpenerFocus,
    onSavePendingChange,
  } = dependencies;

  const claimAction = () => {
    if (gate.started) return false;
    gate.started = true;
    return true;
  };

  return {
    cancel: () => {
      if (!claimAction()) return;
      clearPending();
      restoreOpenerFocus();
    },
    discard: () => {
      if (!claimAction()) return;
      closeDocument(pendingId);
      clearPending();
    },
    save: async () => {
      if (!claimAction()) return;
      let closed = false;
      if (pendingId !== getActiveDocumentId()) switchDocument(pendingId);
      onSavePendingChange(true);
      try {
        const saved = await saveFile();
        if (saved) {
          closeDocument(pendingId);
          closed = true;
        }
      } catch {
        // `saveFile` vangt normale opslagfouten zelf; ook een onverwachte reject mag geen document
        // sluiten of de bevestiging boven de app laten hangen.
      } finally {
        clearPending();
        if (!closed) restoreOpenerFocus();
        onSavePendingChange(false);
      }
    },
  };
}
