import { useTranslation } from 'react-i18next';
import { Scissors } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';

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
    <NoticeStrip
      icon={Scissors}
      text={t('view.splitModeHint')}
      actionLabel={t('view.splitModeStop')}
      onAction={() => setUI({ showSplitMode: false })}
      stripProps={{ 'data-ops-split-mode': true }}
      actionProps={{ 'data-ops-split-mode-stop': true }}
    />
  );
}
