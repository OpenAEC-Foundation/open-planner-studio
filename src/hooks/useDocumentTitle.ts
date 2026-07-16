import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

// Documenttitel-sync: houdt de venster-/tabtitel gelijk aan het actieve document
// (dirty-markering, projectnaam, bestandsnaam).
export function useDocumentTitle(): void {
  const projectName = useAppStore(s => s.project.name);
  const isDirty = useAppStore(s => s.isDirty);
  const filePath = useAppStore(s => s.filePath);
  useEffect(() => {
    const dirtyMark = isDirty ? '* ' : '';
    const fileInfo = filePath ? ` — ${filePath.split(/[/\\]/).pop()}` : '';
    document.title = `${dirtyMark}${projectName}${fileInfo} — Open Planner Studio`;
  }, [projectName, isDirty, filePath]);
}
