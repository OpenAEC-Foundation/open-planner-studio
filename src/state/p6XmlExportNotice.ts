import type { NotificationDetailLine, NotifyInput } from './slices/types';
import type { XerExportLossCategory } from '@/services/xerExportLoss';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { DEFAULT_WORK_RULE } from '@/types/workRule';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { exportProfileAdvice } from './exportProfileAdvice';
import { FORMAT_NOTICE_P6XML_HELP_ARTICLE_ID } from './helpArticles';

export interface P6XmlLossInput {
  readonly project: Partial<Pick<Project, 'schedulingProfile' | 'defaultWorkRule' | 'author' | 'company'>>;
  readonly calendars: readonly WorkCalendar[];
  readonly tasks: readonly Task[];
  readonly sequences: readonly Sequence[];
  readonly resources: readonly Resource[];
  readonly assignments: readonly ResourceAssignment[];
  readonly baselineCount: number;
}

/** XER-broninformatie die geen writer terugschrijft: één regel, net als bij de XER-export. */
const SOURCE_ONLY: ReadonlySet<XerExportLossCategory> = new Set<XerExportLossCategory>([
  'exact-source-bytes', 'unknown-tables-and-fields', 'typed-diagnostics', 'raw-curves-and-assignment-quantities',
]);

/**
 * De melding na een geslaagde P6 XML-export: wat niet, of niet precies, mee kon, gemeten tegen
 * `p6xmlWriter.ts`. Dezelfde vorm als de XER-melding (`exportXerLossNotice`), met de regels van dit formaat.
 * Onderbrekingen, ingekorte namen en ongeldige tekens hebben hun eigen melding in `exportAs`. Niets verloren ⇒
 * geen melding.
 */
export function exportP6XmlLossNotice(
  input: P6XmlLossInput,
  categories: readonly XerExportLossCategory[] = [],
): NotifyInput | null {
  const { project, tasks, sequences, resources } = input;
  const lines: NotificationDetailLine[] = [];
  const item = (messageKey: NotificationDetailLine['messageKey'], count: number) => {
    if (count > 0) lines.push({ messageKey, params: { count } });
  };
  const fact = (messageKey: NotificationDetailLine['messageKey'], applies: boolean) => {
    if (applies) lines.push({ messageKey });
  };
  const count = (test: (task: Task) => boolean) => tasks.filter(test).length;
  const summaryIds = new Set(tasks.filter(isSummaryTask).map(task => task.id));

  const advised = exportProfileAdvice('p6', project.schedulingProfile) !== null;
  fact('notifications.exportXerLossItem.schedulingRules', advised);
  fact('notifications.exportP6XmlLossItem.schedulingOptions', !advised && categories.includes('schedule-options-and-provenance'));
  fact('notifications.exportP6XmlLossItem.defaultWorkRule', !!project.defaultWorkRule && project.defaultWorkRule !== DEFAULT_WORK_RULE);
  item('notifications.exportP6XmlLossItem.baselines', input.baselineCount);
  item('notifications.exportP6XmlLossItem.summaryRelations',
    sequences.filter(seq => summaryIds.has(seq.predecessorId) || summaryIds.has(seq.successorId)).length);
  item('notifications.exportXerLossItem.summaryAssignments', input.assignments.filter(a => summaryIds.has(a.taskId)).length);
  item('notifications.exportXerLossItem.summaryConstraints', tasks.filter(isSummaryTask).reduce((n, task) =>
    n + (task.constraint && task.constraint.type !== 'ASAP' ? 1 : 0) + (task.constraint2 ? 1 : 0), 0));
  item('notifications.exportXerLossItem.percentLags', sequences.filter(seq =>
    typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)).length);
  item('notifications.exportXerLossItem.elapsedLags', sequences.filter(seq =>
    seq.lagUnit === 'ELAPSEDTIME' && !(typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent))).length);
  item('notifications.exportXerLossItem.elapsedDurations', count(t => t.time.durationType === 'ELAPSEDTIME'));
  item('notifications.exportXerLossItem.manualTasks', count(t => !!t.manuallyScheduled));
  item('notifications.exportP6XmlLossItem.hammocks', count(t => !!t.isHammock));
  item('notifications.exportXerLossItem.durationMilestones', count(t => t.isMilestone && !isZeroDurationMilestone(t)));
  item('notifications.exportXerLossItem.mandatoryMilestones', count(t => t.isMilestone && !!t.mandatory));
  item('notifications.exportXerLossItem.levelingDelays', count(t => (t.levelingDelay ?? 0) !== 0 || (t.levelingDelayMinutes ?? 0) !== 0));
  item('notifications.exportP6XmlLossItem.suspendResume', count(t => !!(t.time.resume || t.time.stop)));
  item('notifications.exportXerLossItem.deadlines', count(t => !!t.deadline));
  item('notifications.exportXerLossItem.externalLinks', tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0));
  item('notifications.exportXerLossItem.activityCodes', count(t => Object.values(t.activityCodes ?? {}).some(Boolean)));
  item('notifications.exportXerLossItem.customFields', count(t =>
    Object.values(t.customFields ?? {}).some(value => value !== undefined && value !== '')));
  fact('notifications.exportXerLossItem.activityCodeDefinitions', categories.includes('activity-codes'));
  fact('notifications.exportXerLossItem.customFieldDefinitions', categories.includes('udfs'));
  item('notifications.exportXerLossItem.taskCategories', count(t => !!t.taskType && t.taskType !== 'CONSTRUCTION' && !t.customTaskTypeId));
  item('notifications.exportP6XmlLossItem.priorities', count(t => t.priority !== 500));
  item('notifications.exportXerLossItem.taskDescriptions', count(t => isSummaryTask(t) && !!t.description?.trim()));
  item('notifications.exportP6XmlLossItem.notes', tasks.reduce((n, t) => n + (t.notes?.length ?? 0), 0));
  item('notifications.exportP6XmlLossItem.resourceTypes', resources.filter(r => r.type === 'CREW' || r.type === 'SUBCONTRACTOR').length);
  item('notifications.exportP6XmlLossItem.capacitySteps', resources.filter(r => (r.availabilitySteps?.length ?? 0) > 0).length);
  item('notifications.exportXerLossItem.libraryLinks', resources.filter(r => r.libraryOrigin).length);
  item('notifications.exportXerLossItem.holidayNames', input.calendars.reduce((n, cal) =>
    n + cal.holidays.filter(h => h.name.trim()).length + (cal.workingExceptions ?? []).filter(w => w.name.trim()).length, 0));
  fact('notifications.exportP6XmlLossItem.projectDetails', !!(project.author?.trim() || project.company?.trim()));
  fact('notifications.exportXerLossItem.sourceDetails', categories.some(category => SOURCE_ONLY.has(category)));
  if (lines.length === 0) return null;
  return {
    severity: 'info',
    messageKey: 'notifications.exportP6XmlLoss',
    detailLines: lines,
    helpArticleId: FORMAT_NOTICE_P6XML_HELP_ARTICLE_ID,
    durationMs: 15000,
  };
}
