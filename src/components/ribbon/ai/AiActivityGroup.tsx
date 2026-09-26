import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { RibbonButton } from '@/components/layout/Ribbon/ribbonPrimitives';

/**
 * AI-ribbontab — groep **Activiteit**. Eén toggle-knop die het AI-activiteitenpaneel
 * toont/verbergt (`ui.aiActivityOpen`, hetzelfde ui-state-patroon als de debug-terminal-knop). Het
 * paneel zelf (`AIActivityPanel`) mount conditioneel in de rechter-rail (App.tsx).
 */
export function AiActivityGroup() {
  const { t } = useTranslation('common');
  const open = useAppStore((s) => s.ui.aiActivityOpen);
  const setUI = useAppStore((s) => s.setUI);

  return (
    <RibbonButton
      icon={<Activity size={20} />}
      label={t('aiActivity.panelButton')}
      active={open}
      onClick={() => setUI({ aiActivityOpen: !open })}
    />
  );
}
