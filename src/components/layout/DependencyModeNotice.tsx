import { useTranslation } from 'react-i18next';
import { Link } from 'lucide-react';
import { useAppStore } from '@/state/appStore';

/**
 * Modus-strook voor de relatiemodus (issue #40).
 *
 * De gemelde bug was niet alleen dat de Relatie-knop niets déed — hij gaf ook geen enkel signaal
 * terug. Deze strook is de zichtbare kant van `ui.showDependencyMode`: zolang de modus aan staat,
 * staat er onder het lint wat de modus doet en hoe je hem stopt. Bewust een blijvende strook en
 * geen toast: het is een MODUS (hij verandert wat slepen doet), en die mag niet onzichtbaar worden
 * terwijl hij nog aan staat.
 *
 * Naar het model van `StructureLockedNotice`, maar zonder timer — hij verdwijnt precies wanneer de
 * modus uit gaat (knop, Escape of de knop hieronder).
 */
export function DependencyModeNotice() {
  const { t } = useTranslation('common');
  const active = useAppStore((s) => s.ui.showDependencyMode);
  const setUI = useAppStore((s) => s.setUI);

  if (!active) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-small leading-4 border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      data-ops-dependency-mode
    >
      <Link size={14} className="shrink-0 text-accent" />
      <span className="flex-1">{t('view.dependencyModeHint')}</span>
      <button
        onClick={() => setUI({ showDependencyMode: false })}
        className="btn btn--sm btn--primary"
        data-ops-dependency-mode-stop
      >
        {t('view.dependencyModeStop')}
      </button>
    </div>
  );
}
