import { isMultiDocumentImport, type ImportResult, type OpenedImport } from '@/services/importTypes';
import { hasBuildingModel, hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import type { NotificationDetailLine, NotifyInput } from './slices/types';
import { withOpenNoticeSticky } from './openNoticeSticky';
import { withTaskTypesUnlockedNotice } from './taskTypesNotice';
import { withLargeForeignOpenNotice } from './largeForeignOpenNotice';

function foreignContentLines(result: ImportResult): NotificationDetailLine[] {
  const source = result.ifcSource;
  if (!source || !hasForeignContent(source)) return [];
  const objects = source.foreignObjectCount;
  const lines: NotificationDetailLine[] = [{
    messageKey: hasBuildingModel(source) ? 'notifications.ifcForeignOpenedWithModel' : 'notifications.ifcForeignOpenedOtherData',
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
  parsed: OpenedImport,
): NotifyInput | undefined {
  const results = isMultiDocumentImport(parsed) ? parsed.results : [parsed];
  const established = withLargeForeignOpenNotice(withTaskTypesUnlockedNotice(fileNotice, taskTypesUnlocked), parsed);
  return withOpenNoticeSticky(withIfcForeignOpenNotice(established, results));
}
