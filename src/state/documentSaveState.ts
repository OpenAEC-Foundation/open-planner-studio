export interface DocumentSaveState {
  readonly saving: number;
  readonly savedAt: number | null;
  readonly ifcxSaveRevision?: number;
}

type Registry = { documents: Array<{ id: string; content?: number; saveState?: DocumentSaveState; changedOnDisk?: true }> };

export interface DocumentContentRef {
  readonly id: string;
  readonly content: number;
}

export function documentContentOf(s: Readonly<Registry>, documentId: string): DocumentContentRef | null {
  const entry = s.documents.find(document => document.id === documentId);
  return entry ? { id: documentId, content: entry.content ?? 0 } : null;
}

export function sameDocumentContent(s: Readonly<Registry>, ref: DocumentContentRef): boolean {
  return documentContentOf(s, ref.id)?.content === ref.content;
}

export function replaceDocumentContent(s: Registry, documentId: string): void {
  const entry = s.documents.find(document => document.id === documentId);
  if (!entry) return;
  entry.content = (entry.content ?? 0) + 1;
  delete entry.saveState;
  delete entry.changedOnDisk;
}

function update(s: Registry, ref: DocumentContentRef, change: (state: DocumentSaveState) => DocumentSaveState): void {
  const entry = s.documents.find(document => document.id === ref.id);
  if (!entry || (entry.content ?? 0) !== ref.content) return;
  const next = change(entry.saveState ?? { saving: 0, savedAt: null });
  if (next.saving === 0 && next.savedAt === null) delete entry.saveState;
  else entry.saveState = next;
}

export function changeSaving(s: Registry, ref: DocumentContentRef, delta: 1 | -1): void {
  update(s, ref, state => ({ ...state, saving: Math.max(0, state.saving + delta) }));
}

export function stampSaved(s: Registry, ref: DocumentContentRef, at: number, ifcxSaveRevision?: number): void {
  update(s, ref, state => ({ ...state, savedAt: at, ...(ifcxSaveRevision !== undefined ? { ifcxSaveRevision } : {}) }));
  const entry = s.documents.find(document => document.id === ref.id);
  if (entry && (entry.content ?? 0) === ref.content) delete entry.changedOnDisk;
}

export function ifcxSaveRevisionOf(s: Readonly<Registry>, documentId: string): number {
  return s.documents.find(entry => entry.id === documentId)?.saveState?.ifcxSaveRevision ?? 0;
}

export function markChangedOnDisk(s: Registry, documentId: string): void {
  const entry = s.documents.find(document => document.id === documentId);
  if (entry) entry.changedOnDisk = true;
}

export function clearChangedOnDisk(s: Registry, documentId: string): void {
  const entry = s.documents.find(document => document.id === documentId);
  if (entry) delete entry.changedOnDisk;
}

export function hasChangedOnDisk(s: Readonly<Registry>, documentId: string): boolean {
  return s.documents.find(document => document.id === documentId)?.changedOnDisk === true;
}

export type SaveStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'unsaved' }
  | { readonly kind: 'saved'; readonly at: number }
  | null;

export function saveStatusOf(saveState: DocumentSaveState | undefined, isDirty: boolean): SaveStatus {
  if (saveState && saveState.saving > 0) return { kind: 'saving' };
  if (isDirty) return { kind: 'unsaved' };
  return saveState?.savedAt != null ? { kind: 'saved', at: saveState.savedAt } : null;
}
