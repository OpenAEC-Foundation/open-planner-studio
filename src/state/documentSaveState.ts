// #804 stap 5 (besluit eigenaar 17 november 2026, "bij alle bestanden"): de opslagstand van een document in de
// statusbalk. "Opslaan…" zolang een gevraagde opslag van dat document loopt of wacht, daarna "Opgeslagen 14:32", en
// "Niet opgeslagen" zodra het document weer gewijzigd is. Een fout blijft een gewone melding; hier is geen foutstand.
//
// De stand leeft op de documentregistratie (`DocumentEntry.saveState`), zoals `pendingWorkRuleSettle`: sessie-UI, geen
// documentdata. Dus niet in `DOCUMENT_FIELDS`, niet in undo, herstel of het bestand; hij hoort bij het document (een
// tabbladwissel toont de stand van het tabblad dat je ziet) en verdwijnt met het document, of met de inhoud als een
// nieuwe inhoud hetzelfde tabblad hergebruikt (`forgetSaveState`).

export interface DocumentSaveState {
  /** Hoeveel gevraagde opslagen van dit document nog lopen of op hun beurt wachten (Ctrl+S, Opslaan als, de sluitvraag). */
  readonly saving: number;
  /** Wanneer een opslag dit document het laatst vastlegde (`commitSavedDocument`), in ms sinds 1970; `null`: nog niet. */
  readonly savedAt: number | null;
}

type Registry = { documents: Array<{ id: string; saveState?: DocumentSaveState }> };

function update(s: Registry, documentId: string, change: (state: DocumentSaveState) => DocumentSaveState): void {
  const entry = s.documents.find(document => document.id === documentId);
  if (!entry) return;
  const next = change(entry.saveState ?? { saving: 0, savedAt: null });
  if (next.saving === 0 && next.savedAt === null) delete entry.saveState;
  else entry.saveState = next;
}

/** Een gevraagde opslag begint (`+1`) of is helemaal klaar (`-1`), ook na annuleren, een weigering of een fout. */
export function changeSaving(s: Registry, documentId: string, delta: 1 | -1): void {
  update(s, documentId, state => ({ ...state, saving: Math.max(0, state.saving + delta) }));
}

/** Een opslag legde dit document vast (`commitSavedDocument`). */
export function stampSaved(s: Registry, documentId: string, at: number): void {
  update(s, documentId, state => ({ ...state, savedAt: at }));
}

/** Een nieuwe inhoud in hetzelfde tabblad (nieuw project, openen in een leeg tabblad, laden): de stand hoort er niet bij. */
export function forgetSaveState(s: Registry, documentId: string): void {
  update(s, documentId, () => ({ saving: 0, savedAt: null }));
}

export type SaveStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'unsaved' }
  | { readonly kind: 'saved'; readonly at: number }
  | null;

/** Wat de statusbalk toont voor het document met deze stand. Een lopende opslag gaat voor: ook als de planner intussen
 *  doortypt, staat er "Opslaan…" tot de hele werkgang klaar is. */
export function saveStatusOf(saveState: DocumentSaveState | undefined, isDirty: boolean): SaveStatus {
  if (saveState && saveState.saving > 0) return { kind: 'saving' };
  if (isDirty) return { kind: 'unsaved' };
  return saveState?.savedAt != null ? { kind: 'saved', at: saveState.savedAt } : null;
}
