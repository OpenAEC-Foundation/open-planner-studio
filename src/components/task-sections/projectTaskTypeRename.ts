import { useAppStore } from '@/state/appStore';

export interface ProjectTaskTypeRename {
  documentId: string;
  id: string;
  oldName: string;
  newName: string;
}

export interface DeferredProjectRenames {
  pending: readonly ProjectTaskTypeRename[];
  defer: (rename: ProjectTaskTypeRename) => void;
}

export function applyProjectTaskTypeRename(rename: ProjectTaskTypeRename): void {
  const store = useAppStore.getState();
  const outcome = store.renameProjectTaskType(rename.documentId, rename.id, rename.newName);
  if (outcome.status === 'unused') {
    store.renameUnusedProjectTaskType(rename.documentId, rename.id, rename.newName);
    return;
  }
  if (outcome.status !== 'nameTaken') return;
  store.notify({
    severity: 'info',
    messageKey: 'notifications.taskTypeRenameNameTaken',
    params: {
      oldName: store.customTaskTypes.find(type => type.id === rename.id)?.name ?? rename.oldName,
      takenName: outcome.takenName,
    },
  });
}
