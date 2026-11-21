// #804, knownbug 1762: de vraag om toegang tot een map (`services/fileAccess/replaceFolderAccess.ts`) aan de dialoog
// `FolderAccessQuestionDialog`. Zelfde bedrading als de vraag "alleen de planning": alleen de open vraag (de map) staat in
// UI-state; de resolver blijft erbuiten. Komt er toch een tweede vraag, dan telt de eerste als geannuleerd.
import { useAppStore } from '@/state/appStore';
import { setFolderAccessAsker } from '@/services/fileAccess/replaceFolderAccess';

let resolveQuestion: ((answer: boolean) => void) | null = null;

/** `true` = de mapkiezer openen; `false` = annuleren. Geen open vraag ⇒ niets (dubbelklik). */
export function answerFolderAccessQuestion(answer: boolean): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingFolderAccessQuestion: null });
  resolve(answer);
}

export function installFolderAccessAsker(): void {
  setFolderAccessAsker(folder => new Promise<boolean>(resolve => {
    resolveQuestion?.(false);
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingFolderAccessQuestion: folder });
  }));
}
