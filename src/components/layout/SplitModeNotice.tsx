import { useTranslation } from 'react-i18next';
import { Scissors } from 'lucide-react';
import { useAppStore } from '@/state/appStore';

/**
 * Modus-strook voor de splits-modus (issue #146, etappe 2).
 *
 * Zelfde vorm en zelfde reden als `DependencyModeNotice`: het is een MODUS (hij verandert wat een
 * sleep vanaf een balk doet), dus hij mag niet onzichtbaar aan staan. Hier staat ook de ENIGE
 * uitleg van het gebaar — losse bijschriften bij de knop of onder de Gantt zijn bewust weggelaten.
 */
export function SplitModeNotice() {
  const { t } = useTranslation('common');
  const active = useAppStore((s) => s.ui.showSplitMode);
  const setUI = useAppStore((s) => s.setUI);

  if (!active) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-small leading-4 border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      data-ops-split-mode
    >
      <Scissors size={14} className="shrink-0 text-accent" />
      <span className="flex-1">{t('view.splitModeHint')}</span>
      <button
        onClick={() => setUI({ showSplitMode: false })}
        className="btn btn--sm btn--primary"
        data-ops-split-mode-stop
      >
        {t('view.splitModeStop')}
      </button>
    </div>
  );
}
