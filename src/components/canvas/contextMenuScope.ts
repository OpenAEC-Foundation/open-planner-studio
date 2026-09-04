import { useAppStore } from '@/state/appStore';
import { appTaskBulkActions } from '@/state/taskBulkActions';
import { addTaskNearSelection, insertTaskRelativeToScope } from '@/state/taskInsertActions';
import type { Task } from '@/types/task';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';

/**
 * Reikwijdte en uitvoering van de taak-contextmenu-acties (issue #42, issue #45).
 *
 * DOM-vrij en JSX-vrij met opzet: `GanttCanvas.tsx` is een canvas-component die zich headless niet
 * laat draaien, terwijl juist déze laag — welke taken raakt een menuklik, en hoeveel undo-stappen
 * kost dat — de regressiegevoelige helft is. Zie `tests/planning/check-context-menu-scope.ts`.
 */

/**
 * De AANGEKLIKTE taak is de handgreep, de SELECTIE is de reikwijdte: zit de aangeklikte taak in de
 * huidige selectie, dan geldt de actie voor de hele selectie; zit hij er niet in, dan alleen voor
 * die ene taak. Dat is precies de conventie die dit project al hanteert bij verticaal slepen
 * ("slepen verplaatst de hele selectie", issue #26) — draai hem niet om.
 *
 * De selectie wordt LIVE uit de store gelezen en niet uit een render-closure, zodat de
 * selectiecorrectie die `handleContextMenu` bij het openen doet (rechtsklik buiten de selectie ⇒
 * die ene taak wordt de selectie) hoe dan ook is meegenomen op het moment dat je het item aanklikt.
 */
export function contextMenuOutlineScope(taskId: string): string[] {
  const selected = useAppStore.getState().selectedTaskIds;
  return selected.includes(taskId) ? selected : [taskId];
}

/**
 * De ankerregel voor "Invoegen boven/onder" en de weergave-poort eromheen wonen sinds issue #49 in
 * `src/state/taskInsertActions.ts` — de lintknoppen en de Mijlpaal-dropdown gebruiken ze nu ook, en
 * die horen niet uit `components/canvas/` te importeren.
 */

/**
 * De één-handeling-is-één-undo-stap-machinerie (`appTaskBulkActions`) woont sinds de gelijktrekking
 * van lintknop/Delete/Backspace in `src/state/taskBulkActions.ts` — de lint en de sneltoetsen
 * horen niet uit `components/canvas/` te importeren (zelfde afweging als bij issue #49 hierboven).
 */

/**
 * De muterende contextmenu-acties, elk over de hele reikwijdte en elk goed voor precies één
 * undo-stap. Bewust hier en niet als inline-closures in `GanttCanvas.tsx`: zo draait de
 * regressiebatterij letterlijk dezelfde functies als de UI.
 */
export const contextMenuBulk = {
  /** `indentTasks`/`outdentTasks` nemen zelf al een lijst en pushen zelf al één (lazy) snapshot. */
  indent(taskId: string): void {
    useAppStore.getState().indentTasks(contextMenuOutlineScope(taskId));
  },

  outdent(taskId: string): void {
    useAppStore.getState().outdentTasks(contextMenuOutlineScope(taskId));
  },

  /**
   * "Invoegen boven/onder": ÉÉN nieuwe taak voor de hele reikwijdte — niet één per geselecteerde
   * taak. Het anker is de uiterste taak van de reikwijdte in schermvolgorde (zie
   * `insertAnchorForScope`); `addTask` regelt daarna zelf de ouder, de `childIds`-volgorde en de
   * ene undo-stap. Rechtsklik buiten de selectie ⇒ alleen die taak, net als bij de rest van het
   * menu (`contextMenuOutlineScope`). Buiten pure boommodus geweigerd met de structuurmelding
   * (issue #49) — zie `insertTaskRelativeToScope`.
   */
  insert(taskId: string, where: 'above' | 'below', name: string): void {
    insertTaskRelativeToScope(contextMenuOutlineScope(taskId), where, { name });
  },

  /**
   * Contextmenu-item "Taak toevoegen" (issue #49): dezelfde regel als de lintknop **+ Taak** —
   * onder de selectie, of achteraan zonder selectie. BEWUST selectie-gestuurd en niet
   * anker-gestuurd: dit item verschijnt óók bij een rechtsklik op lege ruimte, waar er geen
   * aangeklikte taak is. Wie wél op een taak richt heeft "Invoegen boven/onder" ernaast staan.
   */
  addNearSelection(name: string): void {
    addTaskNearSelection({ name });
  },

  /**
   * Mijlpaal aan/uit met de AANGEKLIKTE taak als anker: de nieuwe waarde wordt uit die ene taak
   * afgeleid en op de hele reikwijdte gezet. Een per-taak-toggle zou bij een gemengde selectie
   * nooit een voorspelbare uitkomst geven — dezelfde afweging waarom het contextmenu bewust
   * aparte Inklappen/Uitklappen-items heeft in plaats van één toggle (issue #42).
   */
  toggleMilestone(task: Task): void {
    const isMilestone = !task.isMilestone;
    appTaskBulkActions.applyToTaskIds(
      contextMenuOutlineScope(task.id),
      (state, id) => {
        const current = state.tasks.find(candidate => candidate.id === id);
        if (current) state.updateTask(id, taskMilestoneTransition(current, isMilestone));
      },
    );
  },

  setCalendar(taskId: string, calendarId: string | undefined): void {
    // Voorfilteren op taken die écht wijzigen, zodat de no-op-guard van `setTaskCalendar` ook in
    // de bulkroute overeind blijft: een selectie die al volledig op deze kalender staat mag geen
    // (lege) undo-stap opleveren.
    const { tasks } = useAppStore.getState();
    const ids = contextMenuOutlineScope(taskId)
      .filter((id) => tasks.find((t) => t.id === id)?.calendarId !== calendarId);
    appTaskBulkActions.applyToTaskIds(ids, (state, id) => state.setTaskCalendar(id, calendarId));
  },

  setProgress(taskId: string, completion: number): void {
    appTaskBulkActions.applyToTaskIds(
      contextMenuOutlineScope(taskId),
      (state, id) => state.setTaskProgress(id, completion),
    );
  },

  setPriority(taskId: string, priority: number): void {
    appTaskBulkActions.applyToTaskIds(
      contextMenuOutlineScope(taskId),
      (state, id) => state.updateTask(id, { priority }),
    );
  },

  /**
   * Verwijderen doet mee met de reikwijdte: wie vijf taken selecteert en Verwijderen kiest, verwacht
   * dat er vijf verdwijnen — er één weghalen is misleidend. Er is geen bevestigingsdialoog (die
   * bestaat nergens in de app voor taken; ook de lintknop en Delete verwijderen de hele selectie
   * ongevraagd); de terugweg is Ctrl+Z, en dat is nu precies één stap voor de hele bulk.
   *
   * De uitvoering zelf (`appTaskBulkActions.deleteTasksBulk`) is de GEDEELDE route met de lintknop
   * Verwijderen en Delete/Backspace — zie `src/state/taskBulkActions.ts` voor de subboom- en
   * ouder+kind-semantiek.
   */
  remove(taskId: string): void {
    appTaskBulkActions.deleteTasksBulk(contextMenuOutlineScope(taskId));
  },
};
