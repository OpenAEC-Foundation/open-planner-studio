import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { saveEnableHourPlanning } from '@/utils/settingsStore';
import { NoticeStrip } from './NoticeStrip';

/**
 * Niet-blokkerende melding: een geladen bestand bevat urenplanning-data
 * (`workTime`/`durationMinutes`) terwijl de hoofdschakelaar Urenplanning uit staat. De engine
 * rekent sowieso correct; deze strook biedt alleen aan de UI-schakelaar aan te zetten. Nooit stil
 * wegronden — de gebruiker sluit de melding zelf (kruisje) of zet de instelling aan.
 */
export function HourDataNotice() {
  const { t } = useTranslation('common');
  const visible = useAppStore((s) => s.ui.hourDataNotice);
  const setUI = useAppStore((s) => s.setUI);

  if (!visible) return null;

  const enable = () => {
    setUI({ enableHourPlanning: true, hourDataNotice: false });
    void saveEnableHourPlanning(true);
  };

  return (
    <NoticeStrip
      icon={Clock}
      text={t('hourData.notice')}
      actionLabel={t('hourData.enable')}
      onAction={enable}
      onDismiss={() => setUI({ hourDataNotice: false })}
      stripProps={{ 'data-ops-hour-data-notice': true }}
      actionProps={{ 'data-ops-hour-data-enable': true }}
    />
  );
}
