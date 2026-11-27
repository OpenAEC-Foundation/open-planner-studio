import { countedForeignChanges } from '@/services/ifc/foreign/changeList';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import type { ForeignChangesQuestion } from '@/services/ifc/foreignChangesQuestion';
import type { NotifyInput } from './slices/types';

export function writtenForeignChangeCount(prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined): number {
  return countedForeignChanges(prepared?.foreignChanges);
}

export function foreignChangesQuestionFor(prepared: PreparedIfcWrite, enabled: boolean, file: string | null): ForeignChangesQuestion | null {
  const count = enabled ? writtenForeignChangeCount(prepared) : 0;
  return count > 0 ? { count, file } : null;
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
