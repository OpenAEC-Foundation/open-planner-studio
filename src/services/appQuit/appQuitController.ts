// App sluiten (desktop): de sluitknop, Alt+F4 of het OS-menu vuurt `CloseRequested`. Zonder deze
// controller ging het venster direct dicht — geen vraag over niet-opgeslagen wijzigingen, tot 10 s
// aan bewerkingen weg (de crashherstel-throttle), en omdat niemand `clearRecovery()` aanriep meldde
// de volgende start altijd "niet normaal afgesloten", ook als alles netjes was opgeslagen.
//
// De controller is store- en Tauri-vrij (alle randen geïnjecteerd, headless testbaar in
// `tests/planning/check-app-quit.ts`). Hij hergebruikt de bestaande sluit-bevestiging per document
// (`ui.pendingCloseDocId` → `CloseDocumentDialog`): Opslaan/Niet opslaan sluiten dat document en de
// ronde gaat door naar het volgende; Annuleren (of een mislukte opslag) laat het document open en
// breekt het afsluiten af. Is er niets (meer) ongeopgeslagen, dan: crashherstel stoppen, de
// herstelsnapshots opruimen (schone exit) en het venster echt sluiten.

export interface AppQuitDocument {
  id: string;
  isDirty: boolean;
}

export interface AppQuitDependencies {
  /** Alle open documenten, in tabvolgorde. */
  listDocuments: () => AppQuitDocument[];
  getPendingCloseDocId: () => string | null;
  setPendingCloseDocId: (id: string) => void;
  setQuitPending: (pending: boolean) => void;
  /** Crashherstel stilzetten (geen nieuwe snapshot meer ná de opruimactie). */
  stopRecovery: () => void;
  clearRecovery: () => Promise<void>;
  /** Sluit het venster definitief (Tauri `destroy`, geen nieuw `CloseRequested`). */
  destroyWindow: () => Promise<void>;
}

export interface AppQuitController {
  /** `CloseRequested`: true = de controller neemt het over (event tegenhouden). */
  requestQuit: () => boolean;
  /** Na elke store-wijziging aanroepen zolang het afsluiten loopt. */
  step: () => void;
  readonly active: boolean;
}

export function createAppQuitController(deps: AppQuitDependencies): AppQuitController {
  let active = false;
  let finishing = false;
  /** Het document waarvoor we nu de bevestiging tonen. */
  let prompting: string | null = null;

  const abort = () => {
    active = false;
    prompting = null;
    deps.setQuitPending(false);
  };

  const finish = async () => {
    if (finishing) return;
    finishing = true;
    deps.stopRecovery();
    try {
      await deps.clearRecovery();
    } catch (error) {
      // Opruimen is een nette-exit-optimalisatie: mislukt het, dan biedt de volgende start
      // hoogstens een overbodig herstel aan. Nooit het afsluiten tegenhouden.
      console.warn('Herstelsnapshots opruimen bij afsluiten mislukt:', error);
    }
    await deps.destroyWindow();
  };

  const step = () => {
    if (!active || finishing) return;
    if (deps.getPendingCloseDocId() !== null) return; // de bevestiging staat nog open
    const docs = deps.listDocuments();
    if (prompting !== null) {
      const stillDirty = docs.some((doc) => doc.id === prompting && doc.isDirty);
      prompting = null;
      if (stillDirty) {
        // Annuleren of een mislukte opslag: de gebruiker wil (nog) niet weg.
        abort();
        return;
      }
    }
    const next = docs.find((doc) => doc.isDirty);
    if (next) {
      prompting = next.id;
      deps.setPendingCloseDocId(next.id);
      return;
    }
    void finish();
  };

  return {
    requestQuit: () => {
      if (finishing) return false;
      if (!active) {
        active = true;
        prompting = null;
        deps.setQuitPending(true);
      }
      step();
      return true;
    },
    step,
    get active() { return active; },
  };
}
