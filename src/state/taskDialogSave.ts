import { appStoreContext, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  applyActualDateEdit, applyCompletionEdit, applyProgressInvariants, isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { getPersonalTaskTypes } from '@/services/taskTypes/personalTaskTypes';
import type { Task } from '@/types/task';

/**
 * "Taak bewerken" (`TaskDialog.tsx`): de voortgangsbewerkingen op de concepttaak en het Opslaan.
 *
 * Bewust in `src/state/` en niet in de component (naar het model van `taskBulkActions.ts`): de
 * dialoog en de headless batterij (`tests/planning/check-task-dialog-save.ts`) draaien zo letterlijk
 * dezelfde functies. DOM- en JSX-vrij.
 *
 * Twee afspraken die de dialoog met het eigenschappenpaneel deelt (taakmutaties-audit, bevindingen
 * 4 en 10):
 *
 *  - VOORTGANGSREGELS. De voortgangsvelden op de concept volgen exact dezelfde functies als de
 *    paneelsetters (`setTaskProgress` → `applyCompletionEdit` + `applyProgressInvariants`,
 *    `setActualStart`/`setActualFinish` → `applyActualDateEdit`), dus de dialoog toont al tijdens het
 *    bewerken de status, het afgeleide einde bij 100% en de resterende duur zoals het paneel. Bij
 *    Opslaan draaien de invarianten nog één keer op de samengevoegde taak (de duur kan in dezelfde
 *    sessie gewijzigd zijn). Vóór deze regel schreef de dialoog completion/actuals kaal weg: de status
 *    bleef staan en een eerder gezette `remainingTime` (die de solver voor een lopende taak voorrang
 *    geeft) liet de taak te laat eindigen.
 *    NIET in de generieke `updateTask`: die schrijft voortgangsvelden bewust rauw — het contract van
 *    de extensie-API (`extMappers.ts`, `fromExtTaskTimePatch`) en van imports met een eigen restduur.
 *    Daarom draaien de invarianten hier alleen als deze sessie een voortgangsveld wijzigde; alleen de
 *    naam wijzigen laat bv. een geïmporteerde resterende duur ongemoeid.
 *
 *  - ÉÉN UNDO-STAP. Opslaan kan tot drie storeacties doen (persoonlijk taaktype materialiseren, de
 *    taak bijwerken, de ouder wijzigen via `moveTask`); samen zijn ze één handeling, dus één
 *    `withTransaction` — dezelfde batchsemantiek als de contextmenu-bulkacties.
 */

const clampCompletion = (raw: number) => Math.max(0, Math.min(1, raw));

/** Schuif "% voltooid" op de concept: dezelfde regel als `setTaskProgress`. */
export function draftWithProgress(draft: Task, raw: number, statusDate: string | undefined): Task {
  const next: Task = { ...draft, time: { ...draft.time } };
  applyCompletionEdit(next.time, clampCompletion(raw), statusDate);
  applyProgressInvariants(next, statusDate);
  return next;
}

function draftWithActualDate(
  draft: Task,
  field: 'actualStart' | 'actualFinish',
  date: string | undefined,
  statusDate: string | undefined,
): Task | null {
  // Zelfde weigering als de paneelsetters: actuals nooit ná de statusdatum (§3.2).
  if (date && statusDate && isActualPastStatusDate(date, statusDate)) return null;
  const next: Task = { ...draft, time: { ...draft.time } };
  applyActualDateEdit(next, field, date, statusDate);
  return next;
}

/** Werkelijke start op de concept; `null` = geweigerd (ná de statusdatum), zoals `setActualStart`. */
export function draftWithActualStart(draft: Task, date: string | undefined, statusDate: string | undefined): Task | null {
  return draftWithActualDate(draft, 'actualStart', date, statusDate);
}

/** Werkelijk einde op de concept; `null` = geweigerd (ná de statusdatum), zoals `setActualFinish`. */
export function draftWithActualFinish(draft: Task, date: string | undefined, statusDate: string | undefined): Task | null {
  return draftWithActualDate(draft, 'actualFinish', date, statusDate);
}

export interface TaskDialogSaveInput {
  /** De bewerkte taak; `null` (of een inmiddels verdwenen id) ⇒ de "nieuwe taak"-tak. */
  editingTaskId: string | null;
  draft: Task;
  /** De in de dialoog getoonde startdatum. */
  startDate: string;
}

const PROGRESS_KEYS = ['completion', 'actualStart', 'actualFinish'] as const;

/** Bind het Opslaan van de dialoog aan precies één storecontext. */
export function createTaskDialogSave(context: AppStoreContext): (input: TaskDialogSaveInput) => void {
  const batch = createBatchTransactions(context);
  const S = () => context.store.getState();

  return ({ editingTaskId, draft, startDate }) => batch.withTransaction(() => {
    if (draft.customTaskTypeId) {
      const definition = S().customTaskTypes.find(type => type.id === draft.customTaskTypeId)
        ?? getPersonalTaskTypes().find(type => type.id === draft.customTaskTypeId);
      if (definition) S().ensureProjectTaskType(definition);
    }

    const editingTask = editingTaskId ? S().tasks.find(task => task.id === editingTaskId) : undefined;
    if (editingTask) {
      // Vers uit de store (niet de draft!): een CPM-herberekening tijdens het open staan van de
      // dialoog mag niet worden teruggedraaid. Voortgangsvelden (completion/actualStart/actualFinish)
      // komen WEL uit de draft — dat zijn de enige `time`-subvelden die deze sessie zelf muteert
      // buiten de hieronder berekende schedule-ankervelden.
      const time = {
        ...editingTask.time,
        durationUnit: draft.time.durationUnit,
        scheduleDuration: draft.time.scheduleDuration,
        durationMinutes: draft.time.durationUnit === 'hours' ? draft.time.durationMinutes : undefined,
      };
      // De mijlpaaltransitie levert een VOLLEDIGE tijd (`...editingTask.time` uit de store) met duur
      // 0. Daarom eerst: de duur uit de transitie wint van de draftduur, maar de sessiebewerkingen
      // hieronder (voortgang, startdatum) mogen niet door de storewaarden worden overschreven —
      // anders verdween "mijlpaal aan + voortgang/nieuwe start" in één sessie stil.
      const milestoneTransition = taskMilestoneTransition(editingTask, draft.isMilestone);
      if (milestoneTransition.time) Object.assign(time, milestoneTransition.time);
      time.completion = draft.time.completion;
      time.actualStart = draft.time.actualStart;
      time.actualFinish = draft.time.actualFinish;
      // scheduleStart (het geplande anker) alléén bijwerken als de gebruiker de startdatum
      // daadwerkelijk wijzigde — anders zou opslaan de berekende start als nieuw anker vastleggen
      // en de drift na herberekenen herintroduceren.
      const shownStart = editingTask.time.earlyStart || editingTask.time.scheduleStart;
      if (startDate !== shownStart) time.scheduleStart = startDate;
      const patch: Partial<Task> = {
        name: draft.name,
        description: draft.description,
        wbsCode: draft.wbsCode,
        taskType: draft.taskType,
        customTaskTypeId: draft.customTaskTypeId,
        calendarId: draft.calendarId,
        isMilestone: draft.isMilestone,
        milestoneKind: draft.milestoneKind,
        mandatory: draft.mandatory,
        isHammock: draft.isHammock,
        constraint: draft.constraint,
        constraint2: draft.constraint2,
        deadline: draft.deadline,
        notes: draft.notes,
        time,
      };
      // Voortgang in deze sessie gewijzigd ⇒ dezelfde invarianten als het paneel, op de samengevoegde
      // taak (status, afgeleid einde, resterende duur op de eventueel gewijzigde duur).
      if (PROGRESS_KEYS.some(key => time[key] !== editingTask.time[key])) {
        const merged: Task = { ...editingTask, ...patch, time };
        applyProgressInvariants(merged, S().project.statusDate);
        patch.status = merged.status;
      }
      S().updateTask(editingTask.id, patch);
      // Een gewijzigde ouder gaat via `moveTask`: die synchroniseert childIds op ZOWEL de oude als
      // de nieuwe ouder en weigert cykels. `updateTask` is een kale Object.assign zonder die sync —
      // parentId meepatchen zou de boom stil corrumperen. Bij een geweigerde move doet `moveTask`
      // niets: parentId blijft dan ook ongewijzigd.
      if (draft.parentId !== editingTask.parentId) S().moveTask(editingTask.id, draft.parentId);
      return;
    }

    S().addTask({
      name: draft.name,
      description: draft.description,
      wbsCode: draft.wbsCode,
      taskType: draft.taskType,
      customTaskTypeId: draft.customTaskTypeId,
      isMilestone: draft.isMilestone,
      parentId: draft.parentId || null,
      calendarId: draft.calendarId,
      time: {
        ...draft.time,
        durationUnit: draft.isMilestone ? 'days' : draft.time.durationUnit,
        scheduleDuration: draft.isMilestone ? 0 : draft.time.scheduleDuration,
        durationMinutes: draft.isMilestone || draft.time.durationUnit === 'days' ? undefined : draft.time.durationMinutes,
        scheduleStart: startDate,
        scheduleFinish: startDate,
        earlyStart: startDate,
        earlyFinish: startDate,
        lateStart: startDate,
        lateFinish: startDate,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        completion: 0,
      },
    });
  });
}

/** Expliciete compatibiliteitsadapter voor de ene gemounte productinterface. */
export const saveTaskDialog = createTaskDialogSave(appStoreContext);
