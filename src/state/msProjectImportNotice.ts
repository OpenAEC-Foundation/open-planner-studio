// De openingsmelding van een verse MS Project-import (MSPDI `.xml` en `.mpp`): wat niet is
// overgenomen (issue #391, "exchange without silent loss"). Zelfde vorm als `p6xmlImportNotice`: één
// melding per bestand, één detailregel per categorie met iets erin, geen melding als er niets
// verloren ging. Puur: de store roept hem aan in `applyOpenedImport`.
//
// De melding over onderbroken, genivelleerde of resource-gedreven taken (`mppSourceScheduleNotes`)
// blijft los: die zegt dat zulke taken WEL zijn overgenomen.
import { hasMsProjectImportLoss, type ImportResult, type MsProjectImportReport } from '@/services/importTypes';
import type { NotificationDetailLine, NotifyInput } from '@/state/slices/types';
import { MS_PROJECT_IMPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';

type LineKey = NotificationDetailLine['messageKey'];

/** Volgorde van de regels: eerst de planning zelf, dan de bijgegevens. */
function lines(report: MsProjectImportReport): [number, LineKey][] {
  return [
    [report.subprojects, 'notifications.msProjectLostSubprojects'],
    [report.externalTasks, 'notifications.msProjectLostExternalTasks'],
    [report.inactiveTasks, 'notifications.msProjectLostInactiveTasks'],
    [report.manualTasks, 'notifications.msProjectLostManualTasks'],
    [report.levelingDelays, 'notifications.msProjectLostLevelingDelays'],
    [report.baselines, report.format === 'mspdi'
      ? 'notifications.msProjectLostExtraBaselines'
      : 'notifications.msProjectLostBaselines'],
    [report.baselineWorkCost, 'notifications.msProjectLostBaselineWorkCost'],
    [report.assignmentBaselineDates, 'notifications.msProjectLostAssignmentBaselineDates'],
    [report.customFields, 'notifications.msProjectLostCustomFields'],
    [report.notes, 'notifications.msProjectLostNotes'],
    [report.hyperlinks, 'notifications.msProjectLostHyperlinks'],
    [report.fixedCosts, 'notifications.msProjectLostFixedCosts'],
    [report.resourceRates, 'notifications.msProjectLostResourceRates'],
  ];
}

export function msProjectImportNotice(results: readonly ImportResult[]): NotifyInput | undefined {
  const report = results.find(result => result.msProjectReport)?.msProjectReport;
  if (!report || !hasMsProjectImportLoss(report)) return undefined;
  const detailLines: NotificationDetailLine[] = lines(report)
    .filter(([count]) => count > 0)
    .map(([count, messageKey]) => ({ messageKey, params: { count } }));
  return {
    severity: 'info',
    messageKey: 'notifications.msProjectImportLoss',
    detailLines,
    helpArticleId: MS_PROJECT_IMPORT_HELP_ARTICLE_ID,
  };
}
