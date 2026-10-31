import { useTranslation } from 'react-i18next';
import type { ExportFormat } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { exportProfileAdvice } from '@/state/exportProfileAdvice';

/** Korte hint bij een exportkeuze (Backstage-kaart en lintlijst), zie `exportProfileAdvice`. */
export function ExportProfileHint({ format }: { format: ExportFormat }) {
  const { t } = useTranslation(['menu', 'common']);
  const advice = exportProfileAdvice(format, useAppStore(s => s.project.schedulingProfile));
  if (!advice) return null;
  const { current, target } = advice;
  const brand = current.kind === 'builtIn' ? t(`common:profiles.builtIn.${current.baseId}`) : current.name;
  const name = current.kind === 'builtIn' && current.modified ? t('common:profiles.modified', { name: brand }) : brand;
  return (
    <span className="ops-export-profile-hint" data-ops-export-profile-hint>
      {t('menu:export.profileHint', { name, target: t(`common:profiles.builtIn.${target}`) })}
    </span>
  );
}
