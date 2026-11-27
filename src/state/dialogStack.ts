import { isBlockingDialogOpen } from './blockingDialogs';
import type { UIState } from './slices/types';

const dialogs: symbol[] = [];
const listeners = new Set<() => void>();

export function subscribeDialogStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function registerDialog(id: symbol): () => void {
  dialogs.push(id);
  for (const listener of listeners) listener();
  return () => {
    const index = dialogs.indexOf(id);
    if (index < 0) return;
    dialogs.splice(index, 1);
    for (const listener of listeners) listener();
  };
}

export function isTopDialog(id: symbol): boolean {
  return dialogs.at(-1) === id;
}

export function isAnyDialogOpen(): boolean {
  return dialogs.length > 0;
}

export function isBlockedByDialog(ui: UIState): boolean {
  return isBlockingDialogOpen(ui) || isAnyDialogOpen();
}
