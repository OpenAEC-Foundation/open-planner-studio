import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { isLeafTask } from '@/utils/taskHierarchy';

export type P6CompletedWindowReason =
  | 'eligible'
  | 'missingDataDate'
  | 'notXerSource'
  | 'remainingStartOff'
  | 'notLeafTask'
  | 'missingProjectProvenance'
  | 'missingTaskProvenance'
  | 'missingExplicitTargetWindow'
  | 'wrongCompletePctType'
  | 'wrongDurationType'
  | 'wrongActivityType'
  | 'hasSuspendResume'
  | 'notCompleted'
  | 'zeroDurationMilestone';

export interface P6CompletedWindowDecision {
  eligible: boolean;
  reason: P6CompletedWindowReason;
}

/**
 * Alleen een bewezen XER-bladactiviteit mag voor een voltooide taak de P6-statusdatum als
 * bronsemantiek gebruiken. Dit is bewust géén datumoverride en leest géén opgeslagen P6
 * early/late/float-uitkomst: de datuminvoer is uitsluitend de al toegestane projectstatusdatum.
 *
 * De onafhankelijke guards maken de representatie fail-closed na IFC, undo en extensie-
 * round-trips: project-, taak-, voortgangstype- en activiteitstypeprovenance moeten tegelijk
 * bestaan. De vastgelegde `CP_Drtn`/`DT_FixedDUR2`-vorm is de kleinste onafhankelijke bronvorm
 * waarvoor de corpusprobe de completed statusdatum-inversie bevestigt. Suspend/resume en
 * nulduurmijlpalen blijven expliciet buiten dit eerste causaliteitspakket.
 *
 * Guardvolgorde is bewust vast en fail-closed: de eerste afwijzing is de ENIGE reden die we
 * rapporteren. Zo blijft de diagnose stabiel en deelt de boolean-wrapper exact dezelfde bron.
 */
export function explainP6CompletedDataDateWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (schedulingOptions?.p6Source !== 'XER') return { eligible: false, reason: 'notXerSource' };
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  if (!isLeafTask(task)) return { eligible: false, reason: 'notLeafTask' };
  if (task.p6ProjectId === undefined || task.p6ProjectId === '') {
    return { eligible: false, reason: 'missingProjectProvenance' };
  }
  if (task.p6TaskId === undefined || task.p6TaskId === '') {
    return { eligible: false, reason: 'missingTaskProvenance' };
  }
  if (task.p6ExplicitTargetWindow !== true) {
    return { eligible: false, reason: 'missingExplicitTargetWindow' };
  }
  if (task.p6CompletePctType !== 'CP_Drtn') return { eligible: false, reason: 'wrongCompletePctType' };
  if (task.p6DurationType !== 'DT_FixedDUR2') return { eligible: false, reason: 'wrongDurationType' };
  if (task.p6ActivityType !== 'TT_Task' && task.p6ActivityType !== 'TT_Rsrc') {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (task.p6SuspendResume === true) return { eligible: false, reason: 'hasSuspendResume' };
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  if (isZeroDurationMilestone(task)) return { eligible: false, reason: 'zeroDurationMilestone' };
  return { eligible: true, reason: 'eligible' };
}

export function usesP6CompletedDataDateWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  return explainP6CompletedDataDateWindow(task, dataDate, schedulingOptions).eligible;
}
