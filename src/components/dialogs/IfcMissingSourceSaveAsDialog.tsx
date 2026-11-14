import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { answerIfcMissingSourceSaveAs } from '@/state/ifcMissingSourceQuestionBridge';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

/** Alleen een bewuste keuze mag planning zonder het ontbrekende gebouwmodel schrijven. */
export function IfcMissingSourceSaveAsDialog() {
  const pending = useAppStore(s => s.ui.pendingIfcMissingSourceSaveAs);
  const { t } = useTranslation('common');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const focusCancel = useCallback(() => cancelRef.current, []);
  if (!pending) return null;
  const cancel = () => answerIfcMissingSourceSaveAs(false);
  return (
    <Dialog
      onCancel={cancel}
      onConfirm={cancel}
      focusedButtonOwnsEnter
      initialFocus={focusCancel}
      overlayClassName="bg-black/60 z-[90]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-w-[90vw] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-ifc-missing-source-save-as': true, 'aria-labelledby': 'ifc-missing-source-title' }}
    >
      <DialogHeader title={<span id="ifc-missing-source-title">{t('ifcMissingSourceSaveAs.title')}</span>} onClose={cancel} />
      <div className="p-4 text-body leading-5"><p>{t('ifcMissingSourceSaveAs.body')}</p></div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => answerIfcMissingSourceSaveAs(true)}>
          {t('ifcMissingSourceSaveAs.continue')}
        </button>
        <button ref={cancelRef} type="button" className="btn btn--sm btn--primary" onClick={cancel}>
          {t('ifcMissingSourceSaveAs.cancel')}
        </button>
      </div>
    </Dialog>
  );
}
