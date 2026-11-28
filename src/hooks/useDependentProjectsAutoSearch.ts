import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { autoSearchDependentProjects } from '@/state/dependentProjectsSearch';

const OPEN_DELAY_MS = 500;

export function useDependentProjectsAutoSearch(): void {
  const { t } = useTranslation('common');
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const projectId = useAppStore(s => s.project.id);

  useEffect(() => {
    const timer = window.setTimeout(() => { void autoSearchDependentProjects(buildImportLabels(t)); }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeDocumentId, projectId, t]);
}
