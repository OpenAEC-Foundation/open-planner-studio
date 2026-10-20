import type { XerWriteLoss } from '@/services/xerWriteTypes';
import type { XerExportLossCategory } from '@/services/xerExportLoss';
import type { NotificationDetailLine, NotifyInput } from './slices/types';
import { XER_EXPORT_HELP_ARTICLE_ID } from './helpArticles';

/** Verliessoorten zonder aantal: één regel zonder `{{count}}`. */
const UNCOUNTED = new Set<string>(['schedulingRules', 'projectDetails']);

/** XER-broninformatie die geen writer terugschrijft; de XER-export noemt die als één regel. */
const SOURCE_ONLY: ReadonlySet<XerExportLossCategory> = new Set<XerExportLossCategory>([
  'exact-source-bytes', 'unknown-tables-and-fields', 'typed-diagnostics', 'raw-curves-and-assignment-quantities',
]);

/**
 * De melding na een geslaagde XER-export: wat niet, of niet precies, mee kon. Eén detailregel per
 * soort, in de vaste volgorde van de writer (`LOSS_ORDER`), plus één regel voor XER-broninformatie
 * die geen writer terugschrijft. Niets verloren ⇒ geen melding. Altijd `info` (de export zelf is
 * geslaagd), en lang genoeg zichtbaar om de lijst te lezen.
 */
export function exportXerLossNotice(
  loss: readonly XerWriteLoss[],
  sourceCategories: readonly XerExportLossCategory[] = [],
): NotifyInput | null {
  const detailLines: NotificationDetailLine[] = loss.map(({ code, count }) => (UNCOUNTED.has(code)
    ? { messageKey: `notifications.exportXerLossItem.${code}` }
    : { messageKey: `notifications.exportXerLossItem.${code}`, params: { count } }));
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
