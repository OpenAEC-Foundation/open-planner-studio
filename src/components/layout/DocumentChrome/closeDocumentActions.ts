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
  closeDocument: (id: string, options?: { onlyIfClean?: boolean }) => void | boolean | Promise<void | boolean>;
  saveFile: () => Promise<boolean>;
  clearPending: () => void;
  restoreOpenerFocus: () => void;
  onSavePendingChange: (pending: boolean) => void;
}

export interface CloseDocumentDialogActions {
  cancel: () => void;
  discard: () => Promise<void>;
  save: () => Promise<void>;
}

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
    discard: async () => {
      if (!claimAction()) return;
      await closeDocument(pendingId);
      clearPending();
    },
    save: async () => {
      if (!claimAction()) return;
      let closed = false;
      if (pendingId !== getActiveDocumentId()) switchDocument(pendingId);
      onSavePendingChange(true);
      try {
        const saved = await saveFile();
        if (saved) closed = (await closeDocument(pendingId, { onlyIfClean: true })) !== false;
      } catch {
      } finally {
        clearPending();
        if (!closed) restoreOpenerFocus();
        onSavePendingChange(false);
      }
    },
  };
}
