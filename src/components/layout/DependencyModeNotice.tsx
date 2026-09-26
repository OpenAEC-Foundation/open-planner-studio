import { useTranslation } from 'react-i18next';
import { Link } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';

/**
 * Modus-strook voor de relatiemodus.
 *
 * Deze strook is de zichtbare kant van `ui.showDependencyMode`: zolang de modus aan staat,
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
    <NoticeStrip
      icon={Link}
      text={t('view.dependencyModeHint')}
      actionLabel={t('view.dependencyModeStop')}
      onAction={() => setUI({ showDependencyMode: false })}
      stripProps={{ 'data-ops-dependency-mode': true }}
      actionProps={{ 'data-ops-dependency-mode-stop': true }}
    />
  );
}
