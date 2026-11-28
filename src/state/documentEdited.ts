export function markDocumentEdited(state: { isDirty: boolean; importPristine: boolean }): void {
  markDocumentUnsaved(state);
  state.importPristine = false;
}

export function markDocumentUnsaved(state: { isDirty: boolean }): void {
  state.isDirty = true;
}
