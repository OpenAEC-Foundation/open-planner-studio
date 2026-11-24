import type { ImportResult } from '@/services/importTypes';
import { hasBuildingModel, hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import type { AppNotification, NotificationDetailLine, NotifyInput } from './slices/types';

export const IFC_FOREIGN_OPEN_NOTICE_KEY = 'ifc-foreign-opened';

function foreignContentLines(result: ImportResult): NotificationDetailLine[] {
  const source = result.ifcSource;
  if (!source || !hasForeignContent(source)) return [];
  const objects = source.foreignObjectCount;
  const lines: NotificationDetailLine[] = [{
    messageKey: hasBuildingModel(source) && !result.ifcBuildingModelUncertain ? 'notifications.ifcForeignOpenedWithModel' : 'notifications.ifcForeignOpenedOtherData',
    params: { count: objects },
    numberParams: { objects },
  }];
  const workPlans = result.ifcWorkPlanCount ?? 0;
  if (workPlans > 1) lines.push({ messageKey: 'notifications.ifcForeignWorkPlansMerged', numberParams: { plans: workPlans } });
  return lines;
}

export function ifcForeignOpenLines(results: readonly ImportResult[]): NotificationDetailLine[] {
  return results.flatMap(foreignContentLines);
}

export function noticesTouched(before: readonly AppNotification[], after: readonly AppNotification[]): string[] {
  return after.filter(notice => !before.includes(notice)).map(notice => notice.id);
}

export type IfcForeignOpenPlacement =
  | { kind: 'under'; id: string; lines: NotificationDetailLine[] }
  | { kind: 'own'; notice: NotifyInput };

export function ifcForeignOpenPlacement(
  shown: readonly AppNotification[],
  openingNoticeIds: readonly string[],
  lines: NotificationDetailLine[],
  maxShown: number,
): IfcForeignOpenPlacement | null {
  if (lines.length === 0) return null;
  const target = openingNoticeIds.find(id => shown.some(notice => notice.id === id));
  if (target) return { kind: 'under', id: target, lines };
  if (shown.length >= maxShown && !shown.some(notice => notice.dedupeKey === IFC_FOREIGN_OPEN_NOTICE_KEY)) return null;
  const [head, ...rest] = lines;
  return {
    kind: 'own',
    notice: {
      severity: 'info', ...head, detailLines: rest,
      dedupeKey: IFC_FOREIGN_OPEN_NOTICE_KEY, replaceOnDedupe: true, sticky: false, yieldsPlace: true,
    },
  };
}
