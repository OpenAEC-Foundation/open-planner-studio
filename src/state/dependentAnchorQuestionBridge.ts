import { useAppStore } from '@/state/appStore';
import { setDependentAnchorAsker } from '@/state/dependentAnchorQuestion';

let resolveQuestion: ((saveAnyway: boolean) => void) | null = null;

export function answerDependentAnchorWarning(saveAnyway: boolean): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingDependentAnchorWarning: null });
  resolve(saveAnyway);
}

export function installDependentAnchorAsker(): void {
  setDependentAnchorAsker((anchors) => new Promise<boolean>((resolve) => {
    if (resolveQuestion) {
      const previous = resolveQuestion;
      resolveQuestion = null;
      previous(false);
    }
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingDependentAnchorWarning: anchors });
  }));
}
