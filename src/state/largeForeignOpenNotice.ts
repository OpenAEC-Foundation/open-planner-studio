import type { OpenedImport } from '@/services/importTypes';
import { IFC_FOREIGN_OPEN_WARN_MIB, opensLargeForeignSource } from '@/services/ifc/foreignOpenSize';
import type { NotificationDetailLine, NotifyInput } from './slices/types';

export function withLargeForeignOpenNotice(notice: NotifyInput | undefined, parsed: OpenedImport): NotifyInput | undefined {
  if (!opensLargeForeignSource(parsed)) return notice;
  const line: NotificationDetailLine = { messageKey: 'notifications.ifcForeignOpenLarge', params: { limit: IFC_FOREIGN_OPEN_WARN_MIB } };
  if (notice) return { ...notice, detailLines: [...(notice.detailLines ?? []), line] };
  return { severity: 'info', ...line };
}
