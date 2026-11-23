import { requestReplaceFolderAccess } from '@/services/fileAccess';
import { replaceFolder } from '@/services/fileAccess/replaceFolderAccess';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

export const folderAccessMissingNotice = (path: string): NotifyInput => refusalNotice({
  messageKey: 'notifications.ifcForeignFolderAccessMissing', params: { folder: replaceFolder(path) },
  dedupeKey: 'ifc-foreign-folder-access-missing',
});

export async function refusedReplaceFolderAccess(
  flags: Readonly<FeatureFlagValues>, path: string, notify: (notice: NotifyInput) => void,
): Promise<boolean> {
  if (!ifcForeignContentEnabled(flags)) return false;
  if (await requestReplaceFolderAccess(path)) return false;
  notify(folderAccessMissingNotice(path));
  return true;
}
