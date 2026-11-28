import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { basename } from '@/utils/filePath';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { documentProjectCode } from '@/utils/documentProjectCode';

export function useDocumentTitle(): void {
  const { t } = useTranslation('common');
  const projectName = useAppStore(s => s.project.name);
  const projectCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const isDirty = useAppStore(s => s.isDirty);
  const filePath = useAppStore(s => s.filePath);
  useEffect(() => {
    const dirtyMark = isDirty ? '* ' : '';
    const fileInfo = filePath ? ` — ${basename(filePath)}` : '';
    const shownName = nameWithProjectCode(projectName, projectCode) || t('project.untitled');
    document.title = `${dirtyMark}${shownName}${fileInfo} — Open Planner Studio`;
  }, [projectName, projectCode, isDirty, filePath, t]);
}
