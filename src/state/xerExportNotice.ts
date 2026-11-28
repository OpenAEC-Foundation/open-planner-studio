import type { XerWriteLoss } from '@/services/xerWriteTypes';
import type { XerExportLossCategory } from '@/services/xerExportLoss';
import type { NotificationDetailLine, NotifyInput } from './slices/types';
import { XER_EXPORT_HELP_ARTICLE_ID } from './helpArticles';

const UNCOUNTED = new Set<string>(['schedulingRules', 'projectDetails']);

const SOURCE_ONLY: ReadonlySet<XerExportLossCategory> = new Set<XerExportLossCategory>([
  'exact-source-bytes', 'unknown-tables-and-fields', 'typed-diagnostics', 'raw-curves-and-assignment-quantities',
]);

export function exportXerLossNotice(
  loss: readonly XerWriteLoss[],
  sourceCategories: readonly XerExportLossCategory[] = [],
): NotifyInput | null {
  const detailLines: NotificationDetailLine[] = loss.map(({ code, count }) => (UNCOUNTED.has(code)
    ? { messageKey: `notifications.exportXerLossItem.${code}` }
    : { messageKey: `notifications.exportXerLossItem.${code}`, params: { count } }));
  if (sourceCategories.includes('activity-codes')) {
    detailLines.push({ messageKey: 'notifications.exportXerLossItem.activityCodeDefinitions' });
  }
  if (sourceCategories.includes('udfs')) {
    detailLines.push({ messageKey: 'notifications.exportXerLossItem.customFieldDefinitions' });
  }
  if (sourceCategories.some(category => SOURCE_ONLY.has(category))) {
    detailLines.push({ messageKey: 'notifications.exportXerLossItem.sourceDetails' });
  }
  if (detailLines.length === 0) return null;
  return {
    severity: 'info',
    messageKey: 'notifications.exportXerLoss',
    detailLines,
    helpArticleId: XER_EXPORT_HELP_ARTICLE_ID,
    durationMs: 15000,
  };
}
