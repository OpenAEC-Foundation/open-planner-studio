import type { ImportResult } from '@/services/importTypes';
import { hasBuildingModel, hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import type { NotificationDetailLine, NotifyInput } from './slices/types';
import { withOpenNoticeSticky } from './openNoticeSticky';
import { withTaskTypesUnlockedNotice } from './taskTypesNotice';

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

export function withIfcForeignOpenNotice(
  notice: NotifyInput | undefined,
  results: readonly ImportResult[],
): NotifyInput | undefined {
  const lines = results.flatMap(foreignContentLines);
  if (lines.length === 0) return notice;
  if (notice) return { ...notice, detailLines: [...(notice.detailLines ?? []), ...lines] };
  const [head, ...rest] = lines;
  return { severity: 'info', ...head, ...(rest.length > 0 ? { detailLines: rest } : {}) };
}

export function openedFileNotice(
  fileNotice: NotifyInput | undefined,
  taskTypesUnlocked: boolean,
  results: readonly ImportResult[],
): NotifyInput | undefined {
  return withOpenNoticeSticky(withIfcForeignOpenNotice(withTaskTypesUnlockedNotice(fileNotice, taskTypesUnlocked), results));
}
