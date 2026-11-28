import { useAppStore } from '@/state/appStore';
import { setIfcSchemaAsker, type IfcSchemaAnswer } from '@/services/ifc/ifcSchemaQuestion';

let resolveQuestion: ((answer: IfcSchemaAnswer) => void) | null = null;

export function answerIfcSchemaQuestion(answer: IfcSchemaAnswer): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingIfcSchemaQuestion: null });
  resolve(answer);
}

export function installIfcSchemaAsker(): void {
  setIfcSchemaAsker((question) => new Promise<IfcSchemaAnswer>((resolve) => {
    if (resolveQuestion) {
      const previous = resolveQuestion;
      resolveQuestion = null;
      previous(null);
    }
    resolveQuestion = resolve;
    useAppStore.getState().setUI({ pendingIfcSchemaQuestion: question });
  }));
}
