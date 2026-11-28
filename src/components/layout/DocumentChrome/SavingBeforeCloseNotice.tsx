import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { saveQuestionOpen } from '@/state/blockingDialogs';
import { Dialog } from '@/components/common/Dialog';

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
