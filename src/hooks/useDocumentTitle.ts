import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { basename } from '@/utils/filePath';

// Documenttitel-sync: houdt de venster-/tabtitel gelijk aan het actieve document
// (dirty-markering, projectnaam, bestandsnaam).
//
// Een naamloos project blijft in de DATA naamloos; hier valt de weergave terug op de vertaalde
// tekst. `t` staat in de deps zodat de tabtitel meewisselt bij een taalwissel — react-i18next
// levert bij `languageChanged` een nieuwe `t`-referentie.
export function useDocumentTitle(): void {
  const { t } = useTranslation('common');
  const projectName = useAppStore(s => s.project.name);
  const isDirty = useAppStore(s => s.isDirty);
  const filePath = useAppStore(s => s.filePath);
  useEffect(() => {
    const dirtyMark = isDirty ? '* ' : '';
    const fileInfo = filePath ? ` — ${basename(filePath)}` : '';
    const shownName = projectName || t('project.untitled');
    document.title = `${dirtyMark}${shownName}${fileInfo} — Open Planner Studio`;
  }, [projectName, isDirty, filePath, t]);
}
