import { useTranslation } from 'react-i18next';
import { X, Clock } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { saveEnableHourPlanning } from '@/utils/settingsStore';

/**
 * Niet-blokkerende melding (fase 2.8b, §6.8): een geladen bestand bevat urenplanning-data
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
  const dismiss = () => setUI({ hourDataNotice: false });

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      data-ops-hour-data-notice
    >
      <Clock size={14} className="shrink-0 text-accent" />
      <span className="flex-1">{t('hourData.notice')}</span>
      <button onClick={enable} className="btn btn--sm btn--primary" data-ops-hour-data-enable>
        {t('hourData.enable')}
      </button>
      <button
        onClick={dismiss}
        className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
        title={t('close')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
