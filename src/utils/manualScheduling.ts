import type { Task } from '@/types/task';

/**
 * "Handmatig gepland" (`Task.manuallyScheduled`, MS Project-herkomst) als BEWERKSEMANTIEK: welke
 * cel alleen-lezen is, welk pad een nieuw Einde neemt en of de voortgang van een fase wordt afgeleid.
 *
 * Integratie groep B × rekenprofielen (`verify:conventions`): `manuallyScheduled` is een gepinde
 * datagate — elke lezing in `src/engine/` telt, en de telling mag niet omhoog. De lezingen die
 * groep B toevoegde (taakraster, taakbewerkplan, samenvattingsvoortgang) zijn geen solverinvoer maar
 * bewerk-/weergavesemantiek; ze wonen daarom hier, buiten de motor — zelfde afweging als
 * `contourKeepsWork` in `utils/taskDefaults.ts` (E6, PR #101). De solver leest het veld zelf nog
 * steeds op zijn eigen, gepinde plekken.
 */
export function isManuallyScheduled(task: Pick<Task, 'manuallyScheduled'>): boolean {
  return task.manuallyScheduled === true;
}
