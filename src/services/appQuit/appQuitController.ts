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
//
// #804 stap 3 (besluit eigenaar 17 november 2026: "Wachten, dan sluiten"). Loopt of wacht er een projectopslag (ook
// een ronde van Automatisch opslaan), dan doet de controller niets anders dan wachten tot de schrijfrij leeg is, met
// "Wordt nog opgeslagen…"; geen vraag en geen knop om het wachten af te breken. Daarna begint de ronde opnieuw: kwam
// er tijdens het wachten een foutmelding (een mislukte of geweigerde opslag), dan breekt het afsluiten af zoals een
// mislukte opslag uit de sluitvraag; een document dat nog gewijzigd is, krijgt de gewone sluitvraag. Het herstel wordt
// pas gestopt en gewist als er niets meer geschreven wordt. Zonder lopende opslag is de volgorde die van vóór stap 3.

export interface AppQuitDocument {
  id: string;
  isDirty: boolean;
}

export interface AppQuitDependencies {
  /** Rond open veldinvoer af vóór de eerste dirty-controle (`pendingTextEdits.ts`, review #401):
   *  een getypte waarde zonder blur maakt het document pas daarna gewijzigd. */
  finishPendingInput: () => void;
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
  /** `null` als er geen projectopslag loopt of wacht; anders klaar als de schrijfrij leeg is. Toont intussen
   *  "Wordt nog opgeslagen…". */
  waitForSaves: () => Promise<void> | null;
  /** Begint te kijken; de teruggegeven functie zegt of er sindsdien een foutmelding kwam. */
  watchFailures: () => () => boolean;
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
  /** Wacht de ronde op de schrijfrij? */
  let waiting = false;
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

  const waitThenStep = async (saving: Promise<void>) => {
    waiting = true;
    const failed = deps.watchFailures();
    try {
      await saving;
    } finally {
      waiting = false;
    }
    if (!active) return;
    if (failed()) {
      abort();
      return;
    }
    step();
  };

  const step = () => {
    if (!active || finishing || waiting) return;
    if (deps.getPendingCloseDocId() !== null) return; // de bevestiging staat nog open
    const saving = deps.waitForSaves();
    if (saving) {
      void waitThenStep(saving);
      return;
    }
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
      deps.finishPendingInput();
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
