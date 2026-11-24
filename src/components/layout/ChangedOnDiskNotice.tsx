import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { changedOnDiskShown } from '@/state/openDocumentFor';
import { basename } from '@/utils/filePath';
import { NoticeStrip } from './NoticeStrip';

export function ChangedOnDiskNotice() {
  const { t } = useTranslation('common');
  const visible = useAppStore(changedOnDiskShown);
  const name = useAppStore(s => (s.filePath ? basename(s.filePath) : ''));
  if (!visible) return null;
  return (
    <NoticeStrip
      icon="status.update-available"
      text={t('documents.changedOnDisk', { name })}
      role="status"
      stripProps={{ 'data-ops-changed-on-disk': '' }}
    />
  );
}
