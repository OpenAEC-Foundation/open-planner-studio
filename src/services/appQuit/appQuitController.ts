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
//
// Fixronde 1: een lege rij alleen is geen garantie. Is er niets meer ongeopgeslagen, dan begint de laatste fase met
// `closeWrites`: vanaf dat moment start er geen projectopslag meer (Ctrl+S, Opslaan als, een export naar het eigen bestand,
// een ronde van Automatisch opslaan, site, MCP) en staat de schil stil, tot het venster weg is. Opslaan vanuit de
// sluitvraag gebeurt daarvóór en blijft dus mogelijk; afbreken (annuleren, een rode melding) gebeurt ook daarvóór.
// Na `destroyWindow` gaat de poort weer open (in de echte app bestaat het venster dan niet meer). Gaat het venster niet
// dicht (`destroyWindow` mislukt), dan is het afsluiten afgebroken: ook crashherstel weer aan, en de app werkt verder
// zoals voorheen.
//
// Fixronde 2: de controller bezit de afsluitfase (`claimShutdown`, `shutdownPhase.ts`) van de eerste sluitpoging tot hij
// afbreekt of het venster weg is. Heeft de updater hem (een installatie loopt), dan vangt de controller de sluitpoging op
// zonder vraag: Opslaan zou daar niets kunnen schrijven, en de app herstart zo. En vlak vóór `destroyWindow` kijkt hij
// nog één keer: is er toch een gewijzigd document (een dialoog die al openstond, of een andere weg), dan gaat het venster
// niet dicht, komen poort, schil en herstel terug en begint de gewone ronde opnieuw, met de sluitvraag.

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
  /** De laatste fase: geen nieuwe projectopslag meer en de schil stil, tot het venster weg is. Klaar als een al
   *  toegelaten opslag afgerond is (`closeProjectFileWrites`); de teruggegeven functie zet beide weer open. */
  closeWrites: () => Promise<() => void>;
  /** Crashherstel stilzetten (geen nieuwe snapshot meer ná de opruimactie); de teruggegeven functie zet het terug. */
  stopRecovery: () => () => void;
  clearRecovery: () => Promise<void>;
  /** Sluit het venster definitief (Tauri `destroy`, geen nieuw `CloseRequested`). */
  destroyWindow: () => Promise<void>;
  /** `null` als er geen projectopslag loopt of wacht; anders klaar als de schrijfrij leeg is. Toont intussen
   *  "Wordt nog opgeslagen…". */
  waitForSaves: () => Promise<void> | null;
  /** Begint te kijken; de teruggegeven functie zegt of er sindsdien een foutmelding kwam. */
  watchFailures: () => () => boolean;
  /** Neemt de afsluitfase (`claimShutdown('quit')`); `null` als de updater hem heeft. */
  claimShutdown: () => (() => void) | null;
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
  /** Geeft de afsluitfase terug; gezet zolang de controller hem bezit. */
  let releaseShutdown: (() => void) | null = null;

  const abort = () => {
    active = false;
    prompting = null;
    deps.setQuitPending(false);
    releaseShutdown?.();
    releaseShutdown = null;
  };

  const finish = async () => {
    if (finishing) return;
    finishing = true;
    const reopenWrites = await deps.closeWrites();
    const resumeRecovery = deps.stopRecovery();
    try {
      await deps.clearRecovery();
    } catch (error) {
      // Opruimen is een nette-exit-optimalisatie: mislukt het, dan biedt de volgende start
      // hoogstens een overbodig herstel aan. Nooit het afsluiten tegenhouden.
      console.warn('Herstelsnapshots opruimen bij afsluiten mislukt:', error);
    }
    const reopen = () => {
      resumeRecovery();
      reopenWrites();
      finishing = false;
    };
    // Het vangnet: met een gewijzigd document gaat het venster nooit dicht nadat het herstel gewist is.
    if (deps.listDocuments().some((doc) => doc.isDirty)) {
      reopen();
      step();
      return;
    }
    try {
      await deps.destroyWindow();
    } catch (error) {
      // Het venster ging niet dicht: het afsluiten is afgebroken en de app blijft bruikbaar, met opslaan en
      // crashherstel. Een nieuwe sluitpoging begint opnieuw.
      console.error('Venster sluiten bij afsluiten mislukt:', error);
      reopen();
      abort();
      return;
    }
    reopenWrites();
    releaseShutdown?.();
    releaseShutdown = null;
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
      if (!active) {
        // De updater heeft de fase: het venster blijft open, zonder vraag (zie de kop van dit bestand).
        releaseShutdown = deps.claimShutdown();
        // MUTATIE (b): ook met de updater als eigenaar de gewone afsluitronde, met sluitvraag.
      }
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
