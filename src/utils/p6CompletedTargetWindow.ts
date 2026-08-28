import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';

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
 */
export function usesP6CompletedDataDateWindow(
  task: Task,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  return schedulingOptions?.p6Source === 'XER'
    && schedulingOptions.p6UseRemainingStartForProgress === true
    && task.p6ProjectId !== undefined && task.p6ProjectId !== ''
    && task.p6TaskId !== undefined && task.p6TaskId !== ''
    && task.p6ExplicitTargetWindow === true
    && task.p6CompletePctType === 'CP_Drtn'
    && task.p6DurationType === 'DT_FixedDUR2'
    && (task.p6ActivityType === 'TT_Task' || task.p6ActivityType === 'TT_Rsrc')
    && task.p6SuspendResume !== true
    && task.time.completion >= 1
    && !isZeroDurationMilestone(task);
}
