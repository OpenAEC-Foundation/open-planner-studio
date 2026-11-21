import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { saveQuestionOpen } from '@/state/blockingDialogs';
import { Dialog } from '@/components/common/Dialog';

/**
 * "Wordt nog opgeslagen…" (#804 stap 3, besluit eigenaar 17 november 2026: wachten, dan sluiten). Staat er zolang
 * afsluiten, een document sluiten of een keuze van de sluitvraag op een lopende opslag wacht (`ui.savingBeforeClose`).
 * Geen knop, geen Escape: het verdwijnt vanzelf en het sluiten gaat door. Het ligt boven de sluitvraag; wacht de opslag
 * op een vraag aan de planner (site, IFC-schema, alleen de planning, afhankelijke projecten), dan staat die vraag
 * zichtbaar en dit niet, anders wacht het afsluiten stil achter een vraag die niemand ziet.
 */
export function SavingBeforeCloseNotice() {
  const { t } = useTranslation('common');
  const shown = useAppStore((s) => s.ui.savingBeforeClose && !saveQuestionOpen(s.ui));
  if (!shown) return null;
  return (
    <Dialog
      overlayClassName="bg-black/40 z-[95]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] max-w-[90vw] px-5 py-4"
      panelProps={{ 'data-ops-saving-before-close': '', 'aria-busy': true, 'aria-label': t('documents.stillSaving') }}
    >
      <p role="status" className="text-body">{t('documents.stillSaving')}</p>
    </Dialog>
  );
}
