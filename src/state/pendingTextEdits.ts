export interface PendingTextEditEntry {
  commit?: () => void;
  release?: () => void;
}

export interface PendingTextEdits {
  register: (entry: PendingTextEditEntry) => () => void;
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

export const mountedPendingTextEdits = createPendingTextEdits();
