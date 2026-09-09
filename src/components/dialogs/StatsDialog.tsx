import { useTranslation } from 'react-i18next';
import { X, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { DownloadStatsSection } from '@/components/settings/DownloadStatsSection';
import '@/components/dialogs/SettingsDialog.css';
import '@/components/settings/SettingsPanelContent.css';

/**
 * Statistieken-dialoog: hoe vaak Open Planner Studio is gedownload, per OS en per release.
 * Bereikbaar via Instellingen → Toepassing → **Statistieken…** (dus vanuit alle drie de
 * instellingen-ingangen), bewust NIET als eigen tabblad: de gemiddelde gebruiker heeft er niets
 * aan, dus hij staat achter een knop naast Benchmark. Zelfde opzet als BenchmarkDialog; de inhoud
 * is de gedeelde `DownloadStatsSection`, die de `.settings-*`-stijlen hergebruikt.
 */
export function StatsDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const close = () => setUI({ showStatsDialog: false });

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-stats-dialog': true }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <BarChart3 size={16} />
          {t('settings.statsTitle')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('close')}>
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <DownloadStatsSection />
      </div>
    </Dialog>
  );
}
