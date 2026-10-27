// Wissel van de projectstandaard voor het taaktype (`Project.defaultWorkRule`). Een taak zonder eigen
// regel erft die standaard (`effectiveWorkRule`), dus voor haar is de wissel een typewissel. Die gaat
// door dezelfde werkregelbrug als een wissel op de taak zelf (`settleDefaultRuleChange`): onder een
// werkbeschermende regel legt hij het restwerk vast, en vast werk maakt van een dagenmaat-taak een
// urenmaat-taak (B1a, spec §3.2). Zo'n maatwijziging is planning (geval 11c, §5.2): de aanroeper zet de
// modus "datums zoals opgeslagen" uit en de planning verouderd, in dezelfde undo-stap.
//
// Gedeeld door de store (`projectSlice.setProject`) en de MCP-draft (`draft.setProject`), via
// `applyProjectPatch` (`projectPatch.ts`).
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { settleDefaultRuleChange, type WorkRuleDeps } from '@/engine/work/workRuleApply';
import { assignmentsByTask } from './calendarTasks';

export interface DefaultWorkRuleSwitchState {
  project: Project;
  tasks: Task[];
  assignments: ResourceAssignment[];
  resources: Resource[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
}

/**
 * Zet elke taak zonder eigen regel om naar de nieuwe projectstandaard. `s.project.defaultWorkRule` is
 * al de NIEUWE standaard; `previousDefault` is die van vóór de wissel. Muteert in-place en geeft de
 * taken terug die daarbij de urenmaat kregen (leeg ⇒ de wissel is datumneutraal).
 */
export function settleDefaultWorkRuleSwitch(
  s: DefaultWorkRuleSwitchState,
  previousDefault: WorkRule | undefined,
): string[] {
  const nextDefault = s.project.defaultWorkRule;
  if ((previousDefault ?? DEFAULT_WORK_RULE) === (nextDefault ?? DEFAULT_WORK_RULE)) return [];
  // De momentopname per taak hoort bij de OUDE standaard.
  const deps: WorkRuleDeps = {
    calendars: s.calendars, calendar: s.calendar, resources: s.resources,
    project: previousDefault !== undefined ? { defaultWorkRule: previousDefault } : {},
  };
  // Eén index: per taak alleen haar eigen toewijzingen (dezelfde objecten, dus de brug schrijft ze).
  const byTask = assignmentsByTask(s.assignments);
  const toHours: string[] = [];
  for (const task of s.tasks) {
    // Een taak met een eigen regel slaat de brug zelf over.
    if (settleDefaultRuleChange(task, byTask.get(task.id) ?? [], deps, nextDefault).durationUnitChanged) {
      toHours.push(task.id);
    }
  }
  return toHours;
}
