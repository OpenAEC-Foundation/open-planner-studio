import { useAppStore } from '@/state/appStore';
import { setFolderAccessAsker } from '@/services/fileAccess/replaceFolderAccess';

let resolveQuestion: ((answer: boolean) => void) | null = null;

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
