import { Icon } from '@/components/icons';
import { ribbonAccentIcon, RIBBON_ACCENT_FLAG, type RibbonAccentIconId } from '@/components/icons/ribbonAccentIcons';
import { useAppStore } from '@/state/appStore';
import { isFeatureEnabled } from '@/utils/featureFlags';

/** Lintknop-icoon dat met de flag `lint-iconen-accent` de nieuwe tekening toont (tijdelijk; zie `ribbonAccentIcons.ts`). */
export function RibbonAccentIcon({ id, size }: { id: RibbonAccentIconId; size: number }) {
  const enabled = useAppStore(s => isFeatureEnabled(s.ui.featureFlags, RIBBON_ACCENT_FLAG));
  const shown = ribbonAccentIcon(id, enabled);
  return <Icon id={shown.id} size={size} drawing={shown.drawing} />;
}
