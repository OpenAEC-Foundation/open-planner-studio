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
  /** In de app `closeDocumentAfterSaves`: sluit pas als er geen opslag meer loopt of wacht (#804 stap 3). Met
   *  `onlyIfClean` alleen een document dat vlak vóór het sluiten schoon is; `false` = niet gesloten. */
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

/**
 * De drie sluitkeuzes als uitvoerbare productieacties. Alleen een succesvolle Save die de actieve
 * state schoon achterlaat mag sluiten; annuleren of falen sluit wel de dialoog en herstelt focus.
 * Ook na een geslaagde opslag kijkt het sluiten vlak vóór het feitelijke sluiten nog eens of het document schoon is
 * (`onlyIfClean`, fixronde 1 van #1008): een bewerking na de broncommit (de opslag loopt dan nog, bijvoorbeeld het
 * wissen van het herstelrecord) houdt het tabblad open, zoals een opslag die het document gewijzigd liet. Dit is de
 * ene plek voor het tabblad en de app (die dezelfde sluitvraag gebruikt).
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
