import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { changedOnDiskShown } from '@/state/openDocumentFor';
import { buildImportLabels } from '@/i18n/importLabels';
import { isShortcutBlockedByDialog } from '@/hooks/keyboard/shortcutRegistry';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';
import { basename } from '@/utils/filePath';
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
      onAction={() => { void loadNewVersion(buildImportLabels(t), { blocked: isShortcutBlockedByDialog, leave: leaveBackstageGuarded }); }}
      role="status"
      stripProps={{ 'data-ops-changed-on-disk': '' }}
      actionProps={{ 'data-ops-changed-on-disk-load': '' }}
    />
  );
}
