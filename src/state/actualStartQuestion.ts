/**
 * De vraag naar de werkelijke start (Z1b, besluit eigenaar — zie `engine/progressEntry.ts`) tussen
 * de UI-routes en de ene dialoog die hem stelt (`components/dialogs/ActualStartDialog.tsx`).
 *
 * Zelfde opzet als de toestemmingsvraag bij extensies (`extensions/consentBridge.ts`): de store
 * draagt alleen de VRAAG (`ui.pendingActualStartQuestion`, zodat de dialoog er reactief op rendert
 * en `hasBlockingDialogOpen` de rest van de app stil legt); de RESOLVER staat in module-state — een
 * promise-resolver is geen documentdata en hoort niet in een snapshot.
 *
 * Er staat hooguit één vraag open. Komt er toch een tweede binnen, dan wordt de eerste als
 * geannuleerd beantwoord (er verandert dan niets) in plaats van eeuwig te blijven hangen.
 */
import { useAppStore } from '@/state/appStore';
import type { ActualStartQuestionItem } from './slices/types';

/** Per taak-id de door de gebruiker bevestigde werkelijke start. */
export type ActualStartAnswers = Record<string, string>;

let resolvePending: ((answers: ActualStartAnswers | null) => void) | null = null;

/** Stel de vraag; `null` = geannuleerd (er hoort dan niets te veranderen). */
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

/** Beantwoord de openstaande vraag (`null` = annuleren). Geen open vraag ⇒ no-op (dubbelklik). */
export function answerActualStartQuestion(answers: ActualStartAnswers | null): void {
  resolvePending?.(answers);
}
