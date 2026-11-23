import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { changedOnDiskShown } from '@/state/openDocumentFor';
import { basename } from '@/utils/filePath';
import { buildImportLabels } from '@/i18n/importLabels';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import { NoticeStrip } from './NoticeStrip';

export function ChangedOnDiskNotice() {
  const { t } = useTranslation('common');
  const visible = useAppStore(changedOnDiskShown);
  const name = useAppStore(s => (s.filePath ? basename(s.filePath) : ''));
  const loadNewVersion = useAppStore(s => s.loadNewVersion);
  if (!visible) return null;
  return (
    <NoticeStrip
      icon="status.update-available"
      text={t('documents.changedOnDisk', { name })}
      actionLabel={t('documents.changedOnDiskLoad')}
      onAction={() => { if (!isDocumentLeaveBlocked()) void loadNewVersion(buildImportLabels(t)); }}
      role="status"
      stripProps={{ 'data-ops-changed-on-disk': '' }}
      actionProps={{ 'data-ops-changed-on-disk-load': '' }}
    />
  );
}
