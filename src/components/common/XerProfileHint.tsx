import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { profileLabel } from '@/state/schedulingProfileDraft';

/**
 * Korte hint bij de exportkeuze Primavera P6 XER (Backstage-kaart en lintlijst): rekent het project
 * niet met het ongewijzigde profiel Primavera P6, dan noemt de hint het profiel en raadt P6 aan, zodat
 * de planner vóór het exporteren ziet wat P6 uitrekent (eigenaar, 2026-10-29). Bij P6 niets.
 */
export function XerProfileHint() {
  const { t } = useTranslation(['menu', 'common']);
  const profile = useAppStore(s => s.project.schedulingProfile);
  const label = profileLabel(profile);
  if (label.kind === 'builtIn' && label.baseId === 'p6' && !label.modified) return null;
  const brand = label.kind === 'builtIn' ? t(`common:profiles.builtIn.${label.baseId}`) : label.name;
  const name = label.kind === 'builtIn' && label.modified ? t('common:profiles.modified', { name: brand }) : brand;
  return (
    <span className="ops-export-profile-hint" data-ops-xer-profile-hint>
      {t('menu:export.xerProfileHint', { name })}
    </span>
  );
}
