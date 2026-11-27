import { countedForeignChanges } from '@/services/ifc/foreign/changeList';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import type { NotifyInput } from './slices/types';

export function writtenForeignChangeCount(prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined): number {
  return countedForeignChanges(prepared?.foreignChanges);
}

export function notifyForeignChangesWritten(
  notify: (input: NotifyInput) => void,
  prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined,
  file: () => string,
  downloaded = false,
): void {
  const count = writtenForeignChangeCount(prepared);
  if (count === 0) return;
  notify({
    severity: 'info',
    sticky: true,
    messageKey: downloaded ? 'notifications.foreignChangesDownloaded' : 'notifications.foreignChangesWritten',
    params: { file: file(), count },
  });
}
