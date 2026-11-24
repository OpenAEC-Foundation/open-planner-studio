import type { OpenedImport } from '@/services/importTypes';
import { foreignOpenWarnMiB, opensLargeForeignSource } from '@/services/ifc/foreignOpenSize';
import type { NotificationDetailLine, NotifyInput } from './slices/types';

export function withLargeForeignOpenNotice(notice: NotifyInput | undefined, parsed: OpenedImport): NotifyInput | undefined {
  if (!opensLargeForeignSource(parsed)) return notice;
  const line: NotificationDetailLine = { messageKey: 'notifications.ifcForeignOpenLarge', params: { limit: foreignOpenWarnMiB() } };
  if (notice) return { ...notice, detailLines: [...(notice.detailLines ?? []), line] };
  return { severity: 'info', ...line };
}
