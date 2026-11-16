// Zelfde bedrading als de schemavraag: alleen de open vraag (met haar reden) staat in UI-state; de resolver blijft erbuiten.
import { useAppStore } from '@/state/appStore';
import { setPlanOnlyAsker } from '@/services/ifc/planOnlyQuestion';

let resolveQuestion: ((answer: boolean) => void) | null = null;

export function answerPlanOnlyQuestion(answer: boolean): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingPlanOnlyQuestion: null });
  resolve(answer);
}

export function installPlanOnlyAsker(): void {
  setPlanOnlyAsker(reason => new Promise<boolean>(resolve => {
    resolveQuestion?.(false);
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingPlanOnlyQuestion: reason });
  }));
}
