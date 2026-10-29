/**
 * Standaardmaat voor nieuwe taken (spec "alleen uren" §3.2, besluit B1a).
 *
 * - De projectinstelling `defaultTaskDurationUnit` heet in de UI "Standaardmaat voor nieuwe taken", met
 *   de keuzes dagenmaat en urenmaat. Standaard: dagenmaat (OPS-profiel).
 * - Telt het rekenprofiel een dagenmaat niet in werkdagen (conventie `workdayDurationMeasure` uit, zoals
 *   onder P6 en MS Project), dan staat de standaardmaat vast op urenmaat. Het veld zelf blijft dan
 *   staan: terug naar het OPS-profiel geldt de eigen keuze weer.
 * - Een bestand zonder het veld krijgt zo de standaard van zijn profiel.
 * - Een taak met vast werk is altijd urenmaat (B1a), welke standaard ook geldt.
 *
 * Lengte van een nieuwe taak zonder eigen duur: 5 werkdagen. Koos de planner zelf de urenmaat, dan 5 uur
 * (bestaand gedrag, `check-task-duration-unit.ts`). Moet een nieuwe taak urenmaat zijn zonder dat de
 * planner dat koos (vaste urenmaat van het profiel, vast werk), dan worden de 5 werkdagen omgezet naar
 * uren: 5 × de werktijd per dag.
 */
import type { Project } from '@/types/project';
import type { Task, TaskDurationUnit } from '@/types/task';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { effectiveWorkRule, workRuleApplies, writeDaysAsHours } from '@/engine/work/workRuleApply';

type ProfileFields = Pick<Project, 'schedulingProfile' | 'schedulingOptions'>;
type MeasureFields = ProfileFields & Pick<Project, 'defaultTaskDurationUnit'>;

/** Staat de standaardmaat vast op urenmaat? Ja als het rekenprofiel een dagenmaat niet in werkdagen
 *  telt (P6, MS Project, of een eigen profiel met die conventie uit). */
export function defaultTaskMeasureLocked(project: ProfileFields): boolean {
  return effectiveSchedulingOptions(project).workdayDurationMeasure !== true;
}

/** De standaardmaat voor nieuwe taken zoals de planner hem ziet. */
export function defaultTaskMeasure(project: MeasureFields): TaskDurationUnit {
  return defaultTaskMeasureLocked(project) ? 'hours' : (project.defaultTaskDurationUnit ?? 'days');
}

/** De maat waarin de standaardtijd van een nieuwe taak wordt gemaakt (`createDefaultTaskTime`): de
 *  urenmaat alleen als de planner die zelf koos (5 u); anders de dagenmaat (5 werkdagen), die
 *  {@link settleNewTaskMeasure} daarna zo nodig naar uren omzet. */
export function newTaskTimeUnit(project: MeasureFields): TaskDurationUnit {
  return !defaultTaskMeasureLocked(project) && project.defaultTaskDurationUnit === 'hours' ? 'hours' : 'days';
}

/**
 * Zet de dagenmaat van een nieuwe taak om naar de urenmaat waar dat moet. Muteert `task.time`.
 *  - Vast werk (eigen regel of projectstandaard): altijd, ook als de aanroeper zelf dagen gaf (B1a).
 *  - Vaste urenmaat van het profiel: alleen als de aanroeper geen maat gaf (`measureGiven` onwaar).
 *    Een geplakte of expliciet opgegeven dagenmaat-taak blijft dagenmaat; het profiel telt haar dan
 *    als uren (§3.2).
 * Een mijlpaal en kalendertijd blijven zoals ze zijn. Geeft `true` als de taak urenmaat werd.
 */
export function settleNewTaskMeasure(
  task: Task,
  project: MeasureFields & Pick<Project, 'defaultWorkRule'>,
  measureGiven: boolean,
  hoursPerDay: number,
): boolean {
  if (task.time.durationUnit !== 'days' || task.isMilestone || task.time.durationType === 'ELAPSEDTIME') return false;
  const fixedWork = workRuleApplies(task) && effectiveWorkRule(task, project.defaultWorkRule) === 'FIXED_WORK';
  if (!fixedWork && (measureGiven || !defaultTaskMeasureLocked(project))) return false;
  return writeDaysAsHours(task.time, hoursPerDay);
}
