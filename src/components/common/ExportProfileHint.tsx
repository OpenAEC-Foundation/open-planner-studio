import { useTranslation } from 'react-i18next';
import type { ExportFormat } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { exportProfileAdvice, exportProfileAdviceParams } from '@/state/exportProfileAdvice';

/** Korte hint bij een exportkeuze (Backstage-kaart en lintlijst), zie `exportProfileAdvice`. */
export function ExportProfileHint({ format }: { format: ExportFormat }) {
  const { t } = useTranslation(['menu', 'common']);
  const advice = exportProfileAdvice(format, useAppStore(s => s.project.schedulingProfile));
  if (!advice) return null;
  return (
    <span className="ops-export-profile-hint" data-ops-export-profile-hint>
      {t('menu:export.profileHint', exportProfileAdviceParams(advice, name => t('common:profiles.modified', { name })))}
    </span>
  );
}
