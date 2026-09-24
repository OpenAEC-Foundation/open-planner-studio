// taskTypesVisibility.ts — taaktypes-etappe (spec 2026-09-04 §3.1-3/§7): wanneer zijn de
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

/** De ene selector voor de UI: instelling óf documentontsluiting. */
export function taskTypesUnlocked(state: { ui: { showTaskTypes: boolean }; taskTypesVisible: boolean }): boolean {
  return state.ui.showTaskTypes || state.taskTypesVisible;
}
