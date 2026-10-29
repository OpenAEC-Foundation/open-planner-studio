// Open tekstinvoer afronden — één plek voor elke route die het document verlaat.
//
// Een veld met een draft (`UnitsInput` met `commitOnBlur`) commit pas bij Enter, blur of unmount, en
// de container houdt zolang Automatisch berekenen vast (`useTextEntryAutoCalcHold` → `editHold`).
// Routes die niet met een klik beginnen, sturen geen blur: een MCP-documentwissel, herladen of
// sluiten van de browsertab, desktopafsluiten. Zonder afronden ging de invoer verloren, belandde hij
// in het verkeerde document, of bleef de rekenblokkade hangen (review #401).
//
// `finish()` rondt alles af in twee fasen: eerst committen alle velden hun draft (de store is dan
// bijgewerkt en `isDirty`), daarna geven de tekstbewerkingen hun EIGEN rekenblokkade vrij. Geen
// globale reset van `editHold`: een sleepgebaar dat toevallig loopt, houdt zijn blokkade.
//
// Aanroepers: elke documentactie die de actieve payload vastlegt of vervangt (via
// `StoreRuntime.finishPendingTextEdits`), `beforeunload` (`useAutoSave`) en desktopafsluiten
// (`appQuitDependencies`).
//
// Per storecontext een eigen register: de gemounte app gebruikt `mountedPendingTextEdits`, een
// andere context (scratch, tests) krijgt een leeg register en raakt de zichtbare velden dus niet.

export interface PendingTextEditEntry {
  /** Commit de openstaande draft naar het NU actieve document (fase 1). */
  commit?: () => void;
  /** Geef de eigen rekenblokkade van deze tekstbewerking vrij (fase 2). */
  release?: () => void;
}

export interface PendingTextEdits {
  /** Meld een veld of bewerking aan. Geeft de afmelding terug. */
  register: (entry: PendingTextEditEntry) => () => void;
  /** Rond alle open invoer af: eerst alle commits, dan alle vrijgaven. */
  finish: () => void;
}

export function createPendingTextEdits(): PendingTextEdits {
  const entries = new Set<PendingTextEditEntry>();
  return {
    register: (entry) => {
      entries.add(entry);
      return () => { entries.delete(entry); };
    },
    finish: () => {
      const all = [...entries];
      for (const e of all) e.commit?.();
      for (const e of all) e.release?.();
    },
  };
}

/** Het register van de gemounte app (`appStoreContext` in appStore.ts gebruikt dit exemplaar). */
export const mountedPendingTextEdits = createPendingTextEdits();
