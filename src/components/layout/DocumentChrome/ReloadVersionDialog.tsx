import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

export function ReloadVersionDialog() {
  const { t } = useTranslation('common');
  const phase = useAppStore((s) => s.ui.reloadVersion?.phase ?? null);
  const confirmReload = useAppStore((s) => s.confirmReload);
  const cancelReload = useAppStore((s) => s.cancelReload);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const initialFocus = useCallback(() => cancelRef.current, []);
  if (!phase) return null;
  const question = phase === 'question';
  return (
    <Dialog
      initialFocus={initialFocus}
      onCancel={cancelReload}
      focusedButtonOwnsEnter
      overlayClassName="bg-black/60 z-[80]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[440px] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-reload-dialog': phase }}
    >
      <DialogHeader title={question ? t('documents.closeTitle') : t('documents.changedOnDiskLoad')} onClose={cancelReload} />
      <div className="p-4 flex flex-col gap-4 text-small leading-4">
        <p className="text-text-secondary">{question ? t('documents.changedOnDiskQuestion') : t('documents.changedOnDiskReading')}</p>
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn btn--sm btn--secondary" data-ops-close-choice="cancel" onClick={cancelReload}>
            {t('cancel')}
          </button>
          {question && (
            <button type="button" className="btn btn--sm btn--danger" data-ops-close-choice="discard" onClick={() => { confirmReload(); }}>
              {t('documents.changedOnDiskDiscard')}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
