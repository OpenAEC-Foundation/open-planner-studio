import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { autoSearchDependentProjects } from '@/state/dependentProjectsSearch';

/** Wachttijd na het openen of wisselen van een document, zodat het laden eerst klaar is. */
const OPEN_DELAY_MS = 500;

/**
 * Stap 1.11 (keuze 7): bij het openen van een document met een onthouden map zoekt de app vanzelf de
 * afhankelijke projecten, op de achtergrond en zonder vraag (desktop: `Project.dependentProjectsFolder`;
 * Chromium: een onthouden maphandvat met toestemming `granted`). Eén keer per document en project-id per
 * sessie (`autoSearchDependentProjects`); de knop zoekt opnieuw.
 */
export function useDependentProjectsAutoSearch(): void {
  const { t } = useTranslation('common');
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  // Een geopend bestand kan het lege tabblad hergebruiken; dan verandert het project-id.
  const projectId = useAppStore(s => s.project.id);

  useEffect(() => {
    const timer = window.setTimeout(() => { void autoSearchDependentProjects(buildImportLabels(t)); }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeDocumentId, projectId, t]);
}
