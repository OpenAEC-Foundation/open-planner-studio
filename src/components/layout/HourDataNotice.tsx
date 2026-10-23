import { useTranslation } from 'react-i18next';
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
  // De strook hoort bij het document met uur-data (zie `UIState.hourDataNotice`).
  const visible = useAppStore((s) => s.ui.hourDataNotice !== null && s.ui.hourDataNotice === s.activeDocumentId);
  const setUI = useAppStore((s) => s.setUI);

  if (!visible) return null;

  const enable = () => {
    setUI({ enableHourPlanning: true, hourDataNotice: null });
    void saveEnableHourPlanning(true);
  };

  return (
    <NoticeStrip
      icon="status.hour-data"
      text={t('hourData.notice')}
      actionLabel={t('hourData.enable')}
      onAction={enable}
      onDismiss={() => setUI({ hourDataNotice: null })}
      stripProps={{ 'data-ops-hour-data-notice': true }}
      actionProps={{ 'data-ops-hour-data-enable': true }}
    />
  );
}
