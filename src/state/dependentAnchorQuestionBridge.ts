/**
 * Bedrading tussen de vraag vóór opslaan over te krappe ankers (`state/dependentAnchorQuestion.ts`) en
 * de dialoog (`DependentAnchorWarningDialog`). Zelfde opzet als `state/ifcSchemaQuestionBridge.ts`: de
 * store draagt alleen de vraag (`ui.pendingDependentAnchorWarning`), de resolver staat in module-state.
 * Er staat hooguit één vraag open; een tweede beantwoordt de eerste als geannuleerd.
 */
import { useAppStore } from '@/state/appStore';
import { setDependentAnchorAsker } from '@/state/dependentAnchorQuestion';

let resolveQuestion: ((saveAnyway: boolean) => void) | null = null;

/** Beantwoord de vraag (`true` = toch opslaan). Geen open vraag ⇒ no-op (dubbelklik). */
export function answerDependentAnchorWarning(saveAnyway: boolean): void {
  const resolve = resolveQuestion;
  if (!resolve) return;
  resolveQuestion = null;
  useAppStore.getState().setUI({ pendingDependentAnchorWarning: null });
  resolve(saveAnyway);
}

/** Registreer de dialoog als vrager. Eén keer aanroepen bij het opstarten. */
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
