// Zelfde bedrading als de schemavraag: alleen de open vraag staat in UI-state; de resolver blijft erbuiten.
import { useAppStore } from '@/state/appStore';
import { setIfcMissingSourceAsker } from '@/services/ifc/ifcMissingSourceQuestion';

let resolveQuestion: ((answer: boolean) => void) | null = null;

export function answerIfcMissingSourceSaveAs(answer: boolean): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingIfcMissingSourceSaveAs: false });
  resolve(answer);
}

export function installIfcMissingSourceAsker(): void {
  setIfcMissingSourceAsker(() => new Promise<boolean>(resolve => {
    resolveQuestion?.(false);
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingIfcMissingSourceSaveAs: true });
  }));
}
