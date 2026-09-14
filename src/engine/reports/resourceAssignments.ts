import type { Resource } from '@/types/resource';
import {
  type ReportContext, type ProgressState, activityTasks, dayOf, overlapsWindow, progressState,
  remainingDays, resolvePeriodFor, taskFinish, taskStart,
} from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

/**
 * Resourcetoewijzingen (discussie #31, rapport 9): per resource welke activiteiten eraan hangen —
 * "wat doet deze ploeg/kraan/onderaannemer?". Met een rapportageperiode (issue #120; standaard de
 * hele projectspanne) wordt het meteen de "Resource Look-Ahead"-variant uit het voorstel. Rijen
 * zijn gesorteerd op resource en dan op start; de UI groepeert per resource.
 */
export interface ResourceAssignmentRow {
  assignmentId: string;
  resourceId: string;
  resourceName: string;
  resourceType: Resource['type'];
  taskId: string;
  wbs: string;
  name: string;
  start: string;
  finish: string;
  remainingDays: number;
  unitsPerDay: number;
  completion: number;
  isCritical: boolean;
  state: ProgressState;
}

export interface ResourceAssignmentOptions {
  /** Rapportageperiode; `project` = alle toewijzingen. */
  period: ReportingPeriod;
  includeCompleted: boolean;
}

export interface ResourceAssignmentResult {
  from: string;
  to: string;
  /** Alleen relevant als de periode relatief aan de referentiedag is (geen `project`/`custom`). */
  statusDateMissing: boolean;
  rows: ResourceAssignmentRow[];
  counts: { resources: number; assignments: number; unassignedTasks: number };
}

export function computeResourceAssignments(ctx: ReportContext, opts: ResourceAssignmentOptions): ResourceAssignmentResult {
  const { from, to, refDay, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  const windowed = opts.period.preset !== 'project';
  const taskById = new Map(ctx.tasks.map(t => [t.id, t]));
  const resById = new Map(ctx.resources.map(r => [r.id, r]));
  const rows: ResourceAssignmentRow[] = [];
  const assignedTaskIds = new Set<string>();

  for (const a of ctx.assignments) {
    const t = taskById.get(a.taskId);
    const r = resById.get(a.resourceId);
    // Ook een hammock (LOE, bv. toezicht) boekt inzet — dezelfde set als `computeHistogramReport`,
    // zodat een overbelaste week in het belastingsrapport hier altijd terug te vinden is.
    if (!t || !r || t.childIds.length > 0) continue;
    assignedTaskIds.add(t.id);
    const state = progressState(t);
    if (!opts.includeCompleted && state === 'complete') continue;
    // Venster: overlap, plus achterstallig werk van vóór de referentiedag (net als het look-ahead-
    // rapport). `project` is bewust geen venster: dan telt élke toewijzing, ook buiten de taakdatums.
    if (windowed && !overlapsWindow(t, from, to) && !(state !== 'complete' && dayOf(taskFinish(t)) < refDay)) continue;
    rows.push({
      assignmentId: a.id,
      resourceId: r.id,
      resourceName: r.name,
      resourceType: r.type,
      taskId: t.id,
      wbs: t.wbsCode,
      name: t.name,
      start: taskStart(t),
      finish: taskFinish(t),
      remainingDays: remainingDays(ctx, t),
      unitsPerDay: a.unitsPerDay,
      completion: t.time.completion,
      isCritical: t.time.isCritical,
      state,
    });
  }
  const resourceOrder = new Map(ctx.resources.map((r, i) => [r.id, i]));
  rows.sort((a, b) =>
    (resourceOrder.get(a.resourceId) ?? 0) - (resourceOrder.get(b.resourceId) ?? 0)
    || a.start.localeCompare(b.start)
    || a.wbs.localeCompare(b.wbs));
  const unassignedTasks = activityTasks(ctx.tasks).filter(t => !t.isMilestone && !assignedTaskIds.has(t.id)).length;
  return {
    // De referentiedag stuurt bij élk venster (ook `custom`) de insluiting van achterstallig werk,
    // dus zonder statusdatum hoort de melding er dan bij.
    from, to, statusDateMissing: windowed && statusDateMissing, rows,
    counts: {
      resources: new Set(rows.map(r => r.resourceId)).size,
      assignments: rows.length,
      unassignedTasks,
    },
  };
}
