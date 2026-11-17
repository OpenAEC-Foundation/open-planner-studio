import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { answerPlanOnlyQuestion } from '@/state/planOnlyQuestionBridge';
import type { PlanOnlyReason } from '@/services/ifc/planOnlyQuestion';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

/** De teksten per reden. Opslaan als bij een ontbrekend gebouwmodel houdt de teksten van PR 9e. */
const TEXTS = {
  missingSourceSaveAs: {
    title: 'ifcMissingSourceSaveAs.title', body: 'ifcMissingSourceSaveAs.body',
    continue: 'ifcMissingSourceSaveAs.continue', cancel: 'ifcMissingSourceSaveAs.cancel',
  },
  export: {
    title: 'ifcExportWithoutModel.title', body: 'ifcExportWithoutModel.body',
    continue: 'ifcExportWithoutModel.continue', cancel: 'ifcExportWithoutModel.cancel',
  },
  exportWithPool: {
    title: 'ifcExportWithoutModel.title', body: 'ifcExportWithoutModel.bodyWithPool',
    continue: 'ifcExportWithoutModel.continue', cancel: 'ifcExportWithoutModel.cancel',
  },
} as const satisfies Record<PlanOnlyReason, Record<'title' | 'body' | 'continue' | 'cancel', string>>;

/** Alleen een bewuste keuze mag een IFC-bestand met alleen de planning schrijven. Annuleren is de standaardknop. */
export function PlanOnlyQuestionDialog() {
  const reason = useAppStore(s => s.ui.pendingPlanOnlyQuestion);
  const { t } = useTranslation('common');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const focusCancel = useCallback(() => cancelRef.current, []);
  if (!reason) return null;
  const texts = TEXTS[reason];
  const cancel = () => answerPlanOnlyQuestion(false);
  return (
    <Dialog
      onCancel={cancel}
      onConfirm={cancel}
      focusedButtonOwnsEnter
      initialFocus={focusCancel}
      overlayClassName="bg-black/60 z-[90]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-w-[90vw] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-plan-only-question': reason, 'aria-labelledby': 'plan-only-question-title' }}
    >
      <DialogHeader title={<span id="plan-only-question-title">{t(texts.title)}</span>} onClose={cancel} />
      <div className="p-4 text-body leading-5"><p>{t(texts.body)}</p></div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => answerPlanOnlyQuestion(true)}>
          {t(texts.continue)}
        </button>
        <button ref={cancelRef} type="button" className="btn btn--sm btn--primary" onClick={cancel}>
          {t(texts.cancel)}
        </button>
      </div>
    </Dialog>
  );
}
