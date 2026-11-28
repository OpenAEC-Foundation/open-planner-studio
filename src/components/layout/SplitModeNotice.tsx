import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';

export function SplitModeNotice() {
  const { t } = useTranslation('common');
  const active = useAppStore((s) => s.ui.showSplitMode);
  const setUI = useAppStore((s) => s.setUI);

  if (!active) return null;

  return (
    <NoticeStrip
      icon="task.split-mode"
      text={t('view.splitModeHint')}
      actionLabel={t('view.splitModeStop')}
      onAction={() => setUI({ showSplitMode: false })}
      stripProps={{ 'data-ops-split-mode': true }}
      actionProps={{ 'data-ops-split-mode-stop': true }}
    />
  );
}
