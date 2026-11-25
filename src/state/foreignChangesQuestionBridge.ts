import { useAppStore } from '@/state/appStore';
import {
  CANCEL_FOREIGN_CHANGES, setForeignChangesAsker, type ForeignChangesAnswer,
} from '@/services/ifc/foreignChangesQuestion';

let resolveQuestion: ((answer: ForeignChangesAnswer) => void) | null = null;

export function answerForeignChangesQuestion(answer: ForeignChangesAnswer): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingForeignChangesQuestion: null });
  resolve(answer);
}

export function installForeignChangesAsker(): void {
  setForeignChangesAsker(question => new Promise<ForeignChangesAnswer>(resolve => {
    resolveQuestion?.(CANCEL_FOREIGN_CHANGES);
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingForeignChangesQuestion: question });
  }));
}
