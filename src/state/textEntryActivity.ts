const listeners = new Set<() => void>();

export function noteTextEntry(): void {
  for (const listener of listeners) listener();
}

export function onTextEntry(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
