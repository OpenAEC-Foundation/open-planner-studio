import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';

export function DependencyModeNotice() {
  const { t } = useTranslation('common');
  const active = useAppStore((s) => s.ui.showDependencyMode);
  const setUI = useAppStore((s) => s.setUI);

  if (!active) return null;

  return (
    <NoticeStrip
      icon="planning.dependency-draw-mode"
      text={t('view.dependencyModeHint')}
      actionLabel={t('view.dependencyModeStop')}
      onAction={() => setUI({ showDependencyMode: false })}
      stripProps={{ 'data-ops-dependency-mode': true }}
      actionProps={{ 'data-ops-dependency-mode-stop': true }}
    />
  );
}
