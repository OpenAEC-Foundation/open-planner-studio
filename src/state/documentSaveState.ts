// #804 stap 5 (besluit eigenaar 17 november 2026, "bij alle bestanden"): de opslagstand van een document in de
// statusbalk. "Opslaan…" zolang een gevraagde opslag van dat document loopt of wacht, daarna "Opgeslagen 14:32", en
// "Niet opgeslagen" zodra het document weer gewijzigd is. Een fout blijft een gewone melding; hier is geen foutstand.
//
// Fixronde 1 van #1020: de inhoud van een tabblad heeft een eigen identiteit (`DocumentEntry.content`). Een opslag
// hoort bij de inhoud waarvoor ze gevraagd werd (`DocumentContentRef`), niet bij het tabblad: laadt iets een ander
// project in hetzelfde tabblad (`api.data.loadProject` met een ander project-id, de IFC-editor niet), begint een nieuw
// project of opent een bestand in het lege tabblad, dan krijgt de inhoud een nieuwe identiteit (`replaceDocumentContent`,
// de enige plek waar ze wisselt). De opslag toetst haar vlak vóór elke schrijfactie (`refuseChangedDocumentWrite`) en
// bij de commit (`commitSavedDocument`); de wachtende opslag en de opslagstand volgen dezelfde identiteit. Doorwerken
// binnen dezelfde inhoud (typen, een lees-wijzig-laad van hetzelfde project) houdt de identiteit; daar blijft de
// bestaande inhoudsvergelijking (`sameIFCSource`) beslissen of het document schoon is.
//
// Beide leven op de documentregistratie (`DocumentEntry`), zoals `pendingWorkRuleSettle`: sessiegegevens, geen
// documentdata. Dus niet in `DOCUMENT_FIELDS`, niet in undo, herstel of het bestand; ze horen bij het document (een
// tabbladwissel toont de stand van het tabblad dat je ziet) en verdwijnen met het document.

export interface DocumentSaveState {
  /** Hoeveel gevraagde opslagen van dit document nog lopen of op hun beurt wachten (Ctrl+S, Opslaan als, de sluitvraag). */
  readonly saving: number;
  /** Wanneer een opslag dit document het laatst vastlegde (`commitSavedDocument`), in ms sinds 1970; `null`: nog niet. */
  readonly savedAt: number | null;
}

type Registry = { documents: Array<{ id: string; content?: number; saveState?: DocumentSaveState }> };

/** De inhoud van een document op één moment: het document en de identiteit van zijn inhoud. */
export interface DocumentContentRef {
  readonly id: string;
  readonly content: number;
}

/** De inhoud die dit document nu heeft; `null` als het document niet (meer) open is. */
export function documentContentOf(s: Readonly<Registry>, documentId: string): DocumentContentRef | null {
  const entry = s.documents.find(document => document.id === documentId);
  return entry ? { id: documentId, content: entry.content ?? 0 } : null;
}

/** Heeft het document nog precies deze inhoud (bestaat het nog, en is zijn inhoud niet vervangen)? */
export function sameDocumentContent(s: Readonly<Registry>, ref: DocumentContentRef): boolean {
  return documentContentOf(s, ref.id)?.content === ref.content;
}

/** De inhoud van het tabblad wordt vervangen door een andere: een nieuwe identiteit, en de opslagstand van de vorige
 *  inhoud verdwijnt. Een lopende opslag van de vorige inhoud schrijft daarna niets meer en legt niets vast. */
export function replaceDocumentContent(s: Registry, documentId: string): void {
  const entry = s.documents.find(document => document.id === documentId);
  if (!entry) return;
  entry.content = (entry.content ?? 0) + 1;
  delete entry.saveState;
}

function update(s: Registry, ref: DocumentContentRef, change: (state: DocumentSaveState) => DocumentSaveState): void {
  const entry = s.documents.find(document => document.id === ref.id);
  // Een opslag van een vervangen inhoud raakt de stand van de nieuwe inhoud niet.
  if (!entry || (entry.content ?? 0) !== ref.content) return;
  const next = change(entry.saveState ?? { saving: 0, savedAt: null });
  if (next.saving === 0 && next.savedAt === null) delete entry.saveState;
  else entry.saveState = next;
}

/** Een gevraagde opslag van deze inhoud begint (`+1`) of is helemaal klaar (`-1`), ook na annuleren, een weigering of
 *  een fout. */
export function changeSaving(s: Registry, ref: DocumentContentRef, delta: 1 | -1): void {
  update(s, ref, state => ({ ...state, saving: Math.max(0, state.saving + delta) }));
}

/** Een opslag legde deze inhoud vast (`commitSavedDocument`). */
export function stampSaved(s: Registry, ref: DocumentContentRef, at: number): void {
  update(s, ref, state => ({ ...state, savedAt: at }));
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
