// taskTypesVisibility.ts — wanneer zijn de
// werkregel-bedieningselementen zichtbaar? Twee bronnen, één antwoord:
//   1. de app-instelling "Toon taaktypes" (`ui.showTaskTypes`, `ops-showTaskTypes`, standaard uit);
//   2. het DOCUMENT zelf: draagt het al taaktypedata (een taak met `workRule`, `mspTaskType` of
//      `p6DurationType`, een projectstandaard, of een toewijzing met een werkveld), dan is de
//      weergave voor dát document ontsloten ongeacht de instelling — `taskTypesVisible` in
//      `DOCUMENT_FIELDS` (niet gepersisteerd; bij elk laden opnieuw afgeleid), plus één
//      informatieve melding per document (`taskTypesNotice.ts`).
// Puur; geen store-import.
import type { Project } from '@/types/project';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { workRuleFromMsp, workRuleFromXerDurationType } from '@/engine/work/workRuleMapping';

/** Draagt dit document taaktypedata die de gebruiker hoort te kunnen zien? */
export function hasTaskTypeData(
  tasks: readonly Pick<Task, 'workRule' | 'mspTaskType' | 'p6DurationType'>[],
  assignments: readonly Pick<ResourceAssignment, 'plannedWorkMinutes' | 'actualWorkMinutes' | 'remainingWorkMinutes'>[],
  project?: Pick<Project, 'defaultWorkRule'>,
): boolean {
  if (project?.defaultWorkRule !== undefined) return true;
  if (tasks.some((t) => t.workRule !== undefined || t.mspTaskType !== undefined || t.p6DurationType !== undefined)) return true;
  return assignments.some((a) =>
    a.plannedWorkMinutes !== undefined || a.actualWorkMinutes !== undefined || a.remainingWorkMinutes !== undefined);
}

/**
 * Moet het ontsluiten GEMELD worden? Alleen
 * wanneer het bestand iets draagt dat de gebruiker moet weten — opgeslagen werk op een toewijzing,
 * een projectstandaard, of een eigen werkregel (een regel die níét uit het importveld van de taak
 * volgt, zoals een in OPS gekozen regel in een IFC). Een regel die `deriveImportedWorkRules` alleen
 * uit `mspTaskType`/`p6DurationType` afleidde, ontsluit STIL: elke `.mpp`/XER draagt die, en een
 * melding erover zegt niets wat de gebruiker in het paneel niet al ziet.
 */
export function taskTypesNeedNotice(
  tasks: readonly Pick<Task, 'workRule' | 'mspTaskType' | 'effortDriven' | 'p6DurationType'>[],
  assignments: readonly Pick<ResourceAssignment, 'plannedWorkMinutes' | 'actualWorkMinutes' | 'remainingWorkMinutes'>[],
  project?: Pick<Project, 'defaultWorkRule'>,
): boolean {
  if (project?.defaultWorkRule !== undefined) return true;
  if (assignments.some((a) =>
    a.plannedWorkMinutes !== undefined || a.actualWorkMinutes !== undefined || a.remainingWorkMinutes !== undefined)) return true;
  return tasks.some((t) => {
    if (t.workRule === undefined) return false;
    const derived = t.mspTaskType
      ? workRuleFromMsp(t.mspTaskType, t.effortDriven)
      : workRuleFromXerDurationType(t.p6DurationType);
    return derived !== t.workRule;
  });
}

/** De ene selector voor de UI: instelling óf documentontsluiting. */
export function taskTypesUnlocked(state: { ui: { showTaskTypes: boolean }; taskTypesVisible: boolean }): boolean {
  return state.ui.showTaskTypes || state.taskTypesVisible;
}
