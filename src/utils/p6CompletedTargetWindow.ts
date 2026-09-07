import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { parseInstant } from '@/utils/dateUtils';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
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

function mayUseSuspendResumeCompletedWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  if (task.p6SuspendResume !== true) return false;
  if (task.time.completion < 1) return false;
  if (task.p6ActivityType !== 'TT_Task') return false;
  if (dataDate === null) return false;
  if (schedulingOptions?.preserveActualDatesInBackwardPass !== true) return false;
  if (!task.time.actualFinish) return false;
  const actualFinishTime = parseInstant(task.time.actualFinish).getTime();
  if (!Number.isFinite(actualFinishTime)) return false;
  const targetFinishTime = parseInstant(task.time.scheduleFinish).getTime();
  if (!Number.isFinite(targetFinishTime)) return false;
  if (actualFinishTime < targetFinishTime) return false;
  if (actualFinishTime > dataDate.getTime()) return false;
  if (!hasValidP6SuspendResume(task)) return false;
  if (!task.time.resume) return false;
  const resumeTime = parseInstant(task.time.resume).getTime();
  return Number.isFinite(resumeTime) && resumeTime <= actualFinishTime;
}

/**
 * Alleen een bewezen XER-bladactiviteit mag voor een voltooide taak de P6-statusdatum als
 * bronsemantiek gebruiken. Dit is bewust géén datumoverride en leest géén opgeslagen P6
 * early/late/float-uitkomst: de datuminvoer is uitsluitend de al toegestane projectstatusdatum.
 *
 * De onafhankelijke guards maken de representatie fail-closed na IFC, undo en extensie-
 * round-trips: project-, taak-, voortgangstype- en activiteitstypeprovenance moeten tegelijk
 * bestaan. De vastgelegde `CP_Drtn`/`DT_FixedDUR2`-vorm is de enige bronvorm waarvoor de
 * corpusprobes een bron-alleen, consistente completed statusdatum-route bevestigen. `CP_Phys`
 * wordt wel volledig bewaard, maar blijft hier fail-closed: tien gelijkvormige corpusactiviteiten
 * leverden acht P6-statuspunten en twee ontbrekende early/late-orakels op. Omdat de lezer de
 * opgeslagen P6-uitkomst nooit als invoer mag gebruiken en er geen toegestane invoerveld-deler is,
 * zou toelaten een semantische gok zijn. Een P6 suspend/resume-paar
 * blijft standaard fail-closed en mag uitsluitend door de bestaande CP_Drtn-poort wanneer de taak zelf al
 * aantoonbaar voltooid is, haar actual-finish parseerbaar binnen het expliciete targetvenster en
 * de projectstatusdatum valt (`target_end_date <= actualFinish <= dataDate`), de backward-actual-
 * preserve-vlag aan staat, de resume niet ná de actual-finish valt en het interne stop/resume-paar
 * geldig is. Actieve, halve, omgekeerde of stale suspend/resume-vormen houden dus expliciet de
 * bestaande `hasSuspendResume`-reden. Nulduurmijlpalen blijven buiten dit eerste causaliteitspakket.
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
  const isPhysicalCompletion = task.p6CompletePctType === 'CP_Phys';
  if (task.p6CompletePctType !== 'CP_Drtn' && !isPhysicalCompletion) {
    return { eligible: false, reason: 'wrongCompletePctType' };
  }
  if (task.p6DurationType !== 'DT_FixedDUR2') return { eligible: false, reason: 'wrongDurationType' };
  const validActivity = task.p6ActivityType === 'TT_Task'
    || (!isPhysicalCompletion && task.p6ActivityType === 'TT_Rsrc');
  if (!validActivity) {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (task.p6SuspendResume === true
    && (isPhysicalCompletion || !mayUseSuspendResumeCompletedWindow(task, dataDate, schedulingOptions))) {
    return { eligible: false, reason: 'hasSuspendResume' };
  }
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  if (isZeroDurationMilestone(task)) return { eligible: false, reason: 'zeroDurationMilestone' };
  if (isPhysicalCompletion) {
    const actualFinish = task.time.actualFinish ? parseInstant(task.time.actualFinish) : null;
    // CP_Phys heeft voor een toekomstige bewezen route een echt geregistreerd eindfeit nodig:
    // leeg, syntactisch ongeldig en ná de P6-statusdatum zijn alle drie fail-closed. Deze check
    // staat bewust vóór de definitieve CP_Phys-afwijzing zodat een latere route-opening haar
    // grens niet stil kan omzeilen.
    if (actualFinish === null || !Number.isFinite(actualFinish.getTime()) || actualFinish > dataDate) {
      return { eligible: false, reason: 'notCompleted' };
    }
    return { eligible: false, reason: 'wrongCompletePctType' };
  }
  return { eligible: true, reason: 'eligible' };
}

export function usesP6CompletedDataDateWindow(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  return explainP6CompletedDataDateWindow(task, dataDate, schedulingOptions).eligible;
}
