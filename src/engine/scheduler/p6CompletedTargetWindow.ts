import type { SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { parseInstant } from '@/utils/dateUtils';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import { isLeafTask } from '@/utils/taskHierarchy';

export type P6CompletedWindowReason =
  | 'eligible'
  | 'missingDataDate'
  | 'conventionOff'
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
 * De P6-herkomstvelden die de voltooid-poorten lezen, elk precies één keer (`verify:conventions`
 * telt elke lezing van een herkomst-datagate in de motor; B3 en C5 delen deze ene lezing).
 */
interface P6CompletedGateFields {
  projectId: string | undefined;
  taskId: string | undefined;
  explicitTargetWindow: boolean | undefined;
  completePctType: Task['p6CompletePctType'];
  durationType: Task['p6DurationType'];
  activityType: Task['p6ActivityType'];
  suspendResume: boolean | undefined;
}

function p6CompletedGateFields(task: Task): P6CompletedGateFields {
  return {
    projectId: task.p6ProjectId,
    taskId: task.p6TaskId,
    explicitTargetWindow: task.p6ExplicitTargetWindow,
    completePctType: task.p6CompletePctType,
    durationType: task.p6DurationType,
    activityType: task.p6ActivityType,
    suspendResume: task.p6SuspendResume,
  };
}

/** Gedeelde provenancepoort (blad, project-/taakherkomst, expliciet targetvenster), in de vaste
 *  volgorde van B3; `null` = doorgelaten. */
function provenanceRejection(task: Task, fields: P6CompletedGateFields): P6CompletedWindowReason | null {
  if (!isLeafTask(task)) return 'notLeafTask';
  if (fields.projectId === undefined || fields.projectId === '') return 'missingProjectProvenance';
  if (fields.taskId === undefined || fields.taskId === '') return 'missingTaskProvenance';
  if (fields.explicitTargetWindow !== true) return 'missingExplicitTargetWindow';
  return null;
}

function mayUseSuspendResumeCompletedWindow(
  task: Task,
  fields: P6CompletedGateFields,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): boolean {
  if (fields.suspendResume !== true) return false;
  if (task.time.completion < 1) return false;
  if (fields.activityType !== 'TT_Task') return false;
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
  // Rekenprofielen: de aanroeper geeft de opgeloste set (`solveOptionsFor(project)`); geen vertaling meer.
  return explainP6CompletedDataDateWindowResolved(task, dataDate, schedulingOptions);
}

/** Dezelfde diagnose (`CPMSolver`, `scheduleAnalysis`); leest alleen vlaggen. */
export function explainP6CompletedDataDateWindowResolved(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  // Conventie B3 `p6CompletedDataDateWindow` — staat exact op de plek van de vroegere bron-check.
  if (schedulingOptions?.p6CompletedDataDateWindow !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  const fields = p6CompletedGateFields(task);
  const provenance = provenanceRejection(task, fields);
  if (provenance !== null) return { eligible: false, reason: provenance };
  // CP_Phys is hier UITSLUITEND een diagnosetak, geen beslisroute (Fable-critreview PR #109
  // bevinding 5): een `CP_Phys`-taak wordt NOOIT `eligible` — ze eindigt altijd op een afwijzing
  // (onderaan `wrongCompletePctType`, of eerder `notCompleted`/`wrongActivityType`/…). De
  // tussenliggende uitzonderingen bestaan alleen zodat de GERAPPORTEERDE reden de eerste echte
  // blokkade is in plaats van altijd `wrongCompletePctType`; die redenen zijn gepind in
  // `tests/planning/check-xer-completed-cp-phys-window.ts`. Een CP_Phys-route openen is een
  // eigenaarsbesluit met eigen meting, geen kwestie van de laatste `return` weghalen. Het
  // CP_Phys-punt op de statusdatum (conventie C5) is een aparte tak, `explainP6CompletedPhysicalPoint`
  // hieronder — geen verbreding van dit venster.
  const isPhysicalCompletion = fields.completePctType === 'CP_Phys';
  if (fields.completePctType !== 'CP_Drtn' && !isPhysicalCompletion) {
    return { eligible: false, reason: 'wrongCompletePctType' };
  }
  if (fields.durationType !== 'DT_FixedDUR2') return { eligible: false, reason: 'wrongDurationType' };
  const validActivity = fields.activityType === 'TT_Task'
    || (!isPhysicalCompletion && fields.activityType === 'TT_Rsrc');
  if (!validActivity) {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (fields.suspendResume === true
    && (isPhysicalCompletion || !mayUseSuspendResumeCompletedWindow(task, fields, dataDate, schedulingOptions))) {
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

/**
 * Conventie C5 `p6CompletedPhysicalAtDataDate` (docblok + bron bij de sleutel in `types/project.ts`):
 * mag een VOLTOOIDE CP_Phys-activiteit als één punt op de statusdatum staan? Een aparte tak naast
 * B3 (niet een verbreding ervan): geen eis op het duurtype (DT_FixedDrtn doet mee) en naast TT_Task
 * ook TT_Mile/TT_FinMile; suspend/resume blijft fail-closed. Vaste guardvolgorde, de eerste
 * afwijzing is de enige reden (zelfde vorm als `explainP6CompletedDataDateWindowResolved`).
 */
export function explainP6CompletedPhysicalPoint(
  task: Task,
  dataDate: Date | null,
  schedulingOptions: SchedulingOptions | undefined,
): P6CompletedWindowDecision {
  if (dataDate === null) return { eligible: false, reason: 'missingDataDate' };
  if (schedulingOptions?.p6CompletedPhysicalAtDataDate !== true) {
    return { eligible: false, reason: 'conventionOff' };
  }
  if (schedulingOptions.p6UseRemainingStartForProgress !== true) {
    return { eligible: false, reason: 'remainingStartOff' };
  }
  const fields = p6CompletedGateFields(task);
  const provenance = provenanceRejection(task, fields);
  if (provenance !== null) return { eligible: false, reason: provenance };
  if (fields.completePctType !== 'CP_Phys') return { eligible: false, reason: 'wrongCompletePctType' };
  if (fields.activityType !== 'TT_Task' && fields.activityType !== 'TT_Mile'
    && fields.activityType !== 'TT_FinMile') {
    return { eligible: false, reason: 'wrongActivityType' };
  }
  if (fields.suspendResume === true) return { eligible: false, reason: 'hasSuspendResume' };
  if (task.time.completion < 1) return { eligible: false, reason: 'notCompleted' };
  const actualFinish = task.time.actualFinish ? parseInstant(task.time.actualFinish) : null;
  if (actualFinish === null || !Number.isFinite(actualFinish.getTime()) || actualFinish > dataDate) {
    return { eligible: false, reason: 'notCompleted' };
  }
  return { eligible: true, reason: 'eligible' };
}
