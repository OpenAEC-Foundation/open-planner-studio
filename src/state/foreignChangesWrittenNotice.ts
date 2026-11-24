import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import type { NotifyInput } from './slices/types';

export const FOREIGN_CHANGES_WRITTEN_NOTICE_KEY = 'foreign-changes-written';

export function writtenForeignChangeCount(prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined): number {
  return prepared?.foreignChanges?.length ?? 0;
}

export function notifyForeignChangesWritten(notify: (input: NotifyInput) => void, prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined): void {
  const count = writtenForeignChangeCount(prepared);
  if (count === 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.foreignChangesWritten',
    params: { count },
    dedupeKey: FOREIGN_CHANGES_WRITTEN_NOTICE_KEY,
    replaceOnDedupe: true,
    sticky: true,
  });
}
