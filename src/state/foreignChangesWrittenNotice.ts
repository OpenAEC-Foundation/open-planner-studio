import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import type { AppState } from './appStore';
import type { NotificationDetailLine } from './slices/types';

export const FOREIGN_CHANGES_WRITTEN_NOTICE_KEY = 'foreign-changes-written';

export function writtenForeignChangeCount(prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined): number {
  return prepared?.foreignChanges?.length ?? 0;
}

export function writeReportOpen(state: Pick<AppState, 'ui'>): boolean {
  return state.ui.notifications.some(n => n.dedupeKey === FOREIGN_CHANGES_WRITTEN_NOTICE_KEY);
}

export function notifyForeignChangesWritten(
  get: () => Pick<AppState, 'ui' | 'notify'>,
  prepared: Pick<PreparedIfcWrite, 'foreignChanges'> | undefined,
  file: string,
): void {
  const count = writtenForeignChangeCount(prepared);
  if (count === 0) return;
  const line: NotificationDetailLine = { messageKey: 'notifications.foreignChangesWritten', params: { file, count } };
  const open = get().ui.notifications.find(n => n.dedupeKey === FOREIGN_CHANGES_WRITTEN_NOTICE_KEY);
  get().notify({
    severity: 'info',
    messageKey: line.messageKey,
    params: open?.params ?? line.params,
    detailLines: open ? [...(open.detailLines ?? []), line] : [],
    dedupeKey: FOREIGN_CHANGES_WRITTEN_NOTICE_KEY,
    replaceOnDedupe: true,
    sticky: true,
    keepInStack: true,
  });
}
