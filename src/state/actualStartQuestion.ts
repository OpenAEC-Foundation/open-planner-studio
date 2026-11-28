import { useAppStore } from '@/state/appStore';
import type { ActualStartQuestionItem } from './slices/types';

export type ActualStartAnswers = Record<string, string>;

let resolvePending: ((answers: ActualStartAnswers | null) => void) | null = null;

export function askActualStart(items: readonly ActualStartQuestionItem[]): Promise<ActualStartAnswers | null> {
  return new Promise((resolve) => {
    if (resolvePending) {
      const previous = resolvePending;
      resolvePending = null;
      previous(null);
    }
    resolvePending = (answers) => {
      resolvePending = null;
      useAppStore.getState().setUI({ pendingActualStartQuestion: null });
      resolve(answers);
    };
    useAppStore.getState().setUI({ pendingActualStartQuestion: { items: [...items] } });
  });
}

export function answerActualStartQuestion(answers: ActualStartAnswers | null): void {
  resolvePending?.(answers);
}
