import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { CloseDocumentDialogControl } from './CloseDocumentDialogControl';

export function ReloadVersionDialog() {
  const { t } = useTranslation('common');
  const pendingId = useAppStore((s) => s.ui.pendingReloadDocId);
  const confirmReload = useAppStore((s) => s.confirmReload);
  const cancelReload = useAppStore((s) => s.cancelReload);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (pendingId) cancelButtonRef.current?.focus();
  }, [pendingId]);

  if (!pendingId) return null;
  return (
    <CloseDocumentDialogControl
      title={t('documents.closeTitle')}
      body={t('documents.changedOnDiskQuestion')}
      cancelLabel={t('cancel')}
      discardLabel={t('documents.changedOnDiskDiscard')}
      busy={false}
      cancelButtonRef={cancelButtonRef}
      onCancel={cancelReload}
      onDiscard={() => { confirmReload(); }}
      dialogProps={{ 'data-ops-reload-dialog': '' }}
    />
  );
}
