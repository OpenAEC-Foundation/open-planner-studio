import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { RibbonButton } from '@/components/layout/Ribbon/ribbonPrimitives';

export function AiActivityGroup() {
  const { t } = useTranslation('common');
  const open = useAppStore((s) => s.ui.aiActivityOpen);
  const setUI = useAppStore((s) => s.setUI);

  return (
    <RibbonButton
      icon={<Icon id="panel.ai-activity" size={24} />}
      label={t('aiActivity.panelButton')}
      active={open}
      onClick={() => setUI({ aiActivityOpen: !open })}
    />
  );
}
