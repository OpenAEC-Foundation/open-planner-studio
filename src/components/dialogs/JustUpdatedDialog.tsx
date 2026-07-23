import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, PartyPopper, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { getInstallKind } from '@/services/updater/updaterService';
import { fetchReleaseComparison, type ReleaseComparison } from '@/services/updater/releaseInfo';
import { formatBytes } from '@/utils/formatBytes';

/**
 * "Je bent net geüpdatet"-dialoog. Toont de versiesprong plus drie weetjes over de update:
 * grootteverschil van de installer, dagen sinds de vorige release en de GitHub-release-beschrijving.
 * Verschijnt zodra `ui.justUpdated` gevuld is (gezet door de opstart-detectie in useUpdateCheck).
 * Elke weetjes-regel toont zich alléén als de bijbehorende data beschikbaar is — bij offline/fout
 * blijft enkel de versiesprong over. Desktop-only qua trigger; de fetch werkt overal.
 */
export function JustUpdatedDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const justUpdated = useAppStore((s) => s.ui.justUpdated);

  const [comparison, setComparison] = useState<ReleaseComparison | null>(null);
  const [loading, setLoading] = useState(true);

  const close = () => setUI({ justUpdated: null });

  useEffect(() => {
    if (!justUpdated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const installKind = await getInstallKind();
      const cmp = await fetchReleaseComparison(justUpdated.to, installKind);
      if (!cancelled) {
        setComparison(cmp);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [justUpdated]);

  if (!justUpdated) return null;

  const sizeDelta = comparison?.sizeDeltaBytes ?? null;
  const showSmaller = sizeDelta !== null && sizeDelta < 0;
  const showLarger = sizeDelta !== null && sizeDelta > 0;
  const showSame = sizeDelta !== null && sizeDelta === 0;
  const days = comparison?.daysBetween ?? null;
  const body = (comparison?.currentBody ?? '').trim();

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[90vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <PartyPopper size={16} className="text-accent" />
          {t('updates.justUpdated.title')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" title={t('close')}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Versiesprong */}
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-text-secondary">{justUpdated.from}</span>
          <span className="text-text-secondary">→</span>
          <span className="text-accent">{justUpdated.to}</span>
        </div>

        {/* Weetjes — alleen tonen wat we hebben */}
        {(showSmaller || showLarger || showSame || days !== null) && (
          <div className="flex flex-col gap-1.5">
            {showSmaller && sizeDelta !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <ArrowDown size={14} className="text-accent shrink-0" />
                <span>{t('updates.justUpdated.smaller', { size: formatBytes(Math.abs(sizeDelta)) })}</span>
              </div>
            )}
            {showLarger && sizeDelta !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <ArrowUp size={14} className="text-text-secondary shrink-0" />
                <span>{t('updates.justUpdated.larger', { size: formatBytes(Math.abs(sizeDelta)) })}</span>
              </div>
            )}
            {showSame && (
              <div className="flex items-center gap-2 text-text-secondary">
                <span>{t('updates.justUpdated.sameSize')}</span>
              </div>
            )}
            {days !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <Clock size={14} className="text-text-secondary shrink-0" />
                <span>{t('updates.justUpdated.daysSincePrevious', { count: days })}</span>
              </div>
            )}
          </div>
        )}

        {/* GitHub-release-beschrijving */}
        {body.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-text-secondary font-medium">{t('updates.releaseNotes')}</span>
            <pre className="whitespace-pre-wrap break-words bg-surface-hover border border-border rounded-[8px] p-3 text-text-primary max-h-[220px] overflow-y-auto font-sans">
              {body}
            </pre>
          </div>
        )}

        {/* Laad-hint (subtiel, niet-blokkerend) */}
        {loading && (
          <span className="text-text-secondary">…</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--primary">
          {t('close')}
        </button>
      </div>
    </Dialog>
  );
}
