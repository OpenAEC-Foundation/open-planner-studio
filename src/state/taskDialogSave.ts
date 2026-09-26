import { appStoreContext, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  applyActualDateEdit, applyCompletionEdit, applyProgressInvariants, isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { startAnchorAfterEdit } from '@/utils/taskDates';
import {
  constraintBlockingStart, predecessorDrivenTaskIds, startConstraintAfterEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit, type StartEditNotice } from '@/state/startConstraintNotice';
import { hasRecordedProgress } from '@/engine/progressEntry';
import { durationBelowDoneWorkNotice, statusDateSetTodayNotice } from '@/state/progressEntryNotice';
import { durationEditRefusal } from '@/engine/work/workRuleApply';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import { getPersonalTaskTypes } from '@/services/taskTypes/personalTaskTypes';
import type { Task } from '@/types/task';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { HistorySessionMark } from '@/state/slices/historySlice';

/**
 * "Taak bewerken" (`TaskDialog.tsx`): de voortgangsbewerkingen op de concepttaak en het Opslaan.
 *
 * Bewust in `src/state/` en niet in de component (naar het model van `taskBulkActions.ts`): de
 * dialoog en de headless batterij (`tests/planning/check-task-dialog-save.ts`) draaien zo letterlijk
 * dezelfde functies. DOM- en JSX-vrij.
 *
 * Afspraken die de dialoog met het eigenschappenpaneel deelt:
 *
 *  - VOORTGANGSREGELS. De voortgangsvelden op de concept volgen exact dezelfde functies als de
 *    paneelsetters (`setTaskProgress` → `applyCompletionEdit` + `applyProgressInvariants`,
 *    `setActualStart`/`setActualFinish` → `applyActualDateEdit`), dus de dialoog toont al tijdens het
 *    bewerken de status, het afgeleide einde bij 100% en de resterende duur zoals het paneel. Bij
 *    Opslaan draaien de invarianten nog één keer op de samengevoegde taak (de duur kan in dezelfde
 *    sessie gewijzigd zijn). Kaal wegschrijven van completion/actuals laat de status staan, en een
 *    eerder gezette `remainingTime` (die de solver voor een lopende taak voorrang geeft) laat de taak
 *    dan te laat eindigen.
 *    NIET in de generieke `updateTask`: die schrijft voortgangsvelden bewust rauw — het contract van
 *    de extensie-API (`extMappers.ts`, `fromExtTaskTimePatch`) en van imports met een eigen restduur.
 *    Daarom draaien de invarianten hier alleen als deze sessie een voortgangsveld wijzigde; alleen de
 *    naam wijzigen laat bv. een geïmporteerde resterende duur ongemoeid.
 *
 *  - ÉÉN UNDO-STAP. Opslaan kan tot drie storeacties doen (persoonlijk taaktype materialiseren, de
 *    taak bijwerken, de ouder wijzigen via `moveTask`); samen zijn ze één handeling. Zonder
 *    bewerksessie is dat één `withTransaction` — dezelfde batchsemantiek als de contextmenu-bulkacties.
 *    MET een bewerksessie (de dialoog op een bestaande taak opent er een via
 *    `historyMark`) is de sessie de undo-grens: de relationele secties (werkregel, toewijzingen,
 *    werk, relaties) committen al tijdens het bewerken op de store, en Opslaan maakt van die stappen
 *    plus de acties hieronder met `squashHistorySince` één stap "Taak bewerken". Een batch zou hier
 *    een eigen, sessieloze stap vormen die de squash in tweeën breekt.
 *
 *  - "OK ZONDER WIJZIGING DOET NIETS": de patch gaat altijd naar `updateTask`, en die weigert
 *    per saldo gelijke waarden zonder snapshot of `isDirty` (`sameValue`).
 *
 *  - DUUR ALLEEN BIJ EEN ECHTE DUURBEWERKING: de duur komt alleen uit de concept als
 *    de gebruiker hem in deze sessie wijzigde (`initialDuration`) — anders zou Opslaan een duur die de
 *    werkdriehoek intussen via de toewijzingssectie veranderde stil terugdraaien.
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
  // Zelfde weigering als de paneelsetters: actuals nooit ná de statusdatum.
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

/** De duur van de taak bij het openen van de dialoog. */
export interface TaskDialogInitialDuration {
  unit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
}

export interface TaskDialogSaveInput {
  /** De bewerkte taak; `null` (of een inmiddels verdwenen id) ⇒ de "nieuwe taak"-tak. */
  editingTaskId: string | null;
  draft: Task;
  /** De in de dialoog getoonde startdatum. */
  startDate: string;
  /** De duur bij het openen; afwezig ⇒ de duur uit de concept telt altijd als bewerkt. */
  initialDuration?: TaskDialogInitialDuration | null;
  /** De open bewerksessie van de dialoog (`historyMark`); afwezig ⇒ één `withTransaction`. */
  session?: HistorySessionMark | null;
  /** Vandaag (`localTodayIso`), meegegeven door de dialoog: de invoerregels van
   *  `engine/progressEntry.ts` gelden. Afwezig = vangnet zonder die regels. */
  today?: string;
}

const PROGRESS_KEYS = ['completion', 'actualStart', 'actualFinish'] as const;

/**
 * De tijd die Opslaan op een bestaande taak schrijft, vóór het startanker. Gedeeld door de
 * weigering vooraf (duur korter dan het gedane werk) en `save`.
 */
function savedTime(
  editingTask: Task,
  draft: Task,
  initialDuration: TaskDialogInitialDuration | null | undefined,
): Task['time'] {
  // Vers uit de store (niet de draft!): een CPM-herberekening tijdens het open staan van de
  // dialoog mag niet worden teruggedraaid. Voortgangsvelden (completion/actualStart/actualFinish)
  // komen WEL uit de draft — dat zijn de enige `time`-subvelden die deze sessie zelf muteert
  // buiten de hieronder berekende schedule-ankervelden.
  // De duur ALLEEN uit de concept wanneer de gebruiker hem in deze
  // sessie wijzigde — anders zou Opslaan een duur die de werkdriehoek intussen via de
  // toewijzingssectie veranderde stil terugdraaien.
  const durationTouched = !initialDuration
    || draft.time.durationUnit !== initialDuration.unit
    || draft.time.scheduleDuration !== initialDuration.scheduleDuration
    || draft.time.durationMinutes !== initialDuration.durationMinutes;
  const time = {
    ...editingTask.time,
    ...(durationTouched ? {
      durationUnit: draft.time.durationUnit,
      scheduleDuration: draft.time.scheduleDuration,
      durationMinutes: draft.time.durationUnit === 'hours' ? draft.time.durationMinutes : undefined,
    } : {}),
  };
  // De mijlpaaltransitie levert een VOLLEDIGE tijd (`...editingTask.time` uit de store) met duur
  // 0. Daarom eerst: de duur uit de transitie wint van de draftduur, maar de sessiebewerkingen
  // hieronder (voortgang, startdatum) mogen niet door de storewaarden worden overschreven —
  // anders verdwijnt "mijlpaal aan + voortgang/nieuwe start" in één sessie stil.
  const milestoneTransition = taskMilestoneTransition(editingTask, draft.isMilestone);
  if (milestoneTransition.time) Object.assign(time, milestoneTransition.time);
  // Een verzameltaak draagt geen eigen voortgang: haar waarden komen uit de rollup en de
  // velden zijn in de dialoog uitgeschakeld. De draft is een momentopname van bij het openen;
  // een herberekening tussendoor mag Opslaan niet met die verouderde waarde overschrijven.
  if (!isSummaryTask(editingTask)) {
    time.completion = draft.time.completion;
    time.actualStart = draft.time.actualStart;
    time.actualFinish = draft.time.actualFinish;
  } else {
    time.completion = editingTask.time.completion;
    time.actualStart = editingTask.time.actualStart;
    time.actualFinish = editingTask.time.actualFinish;
  }
  return time;
}

/** Bind het Opslaan van de dialoog aan precies één storecontext. */
export function createTaskDialogSave(context: AppStoreContext): (input: TaskDialogSaveInput) => boolean {
  const batch = createBatchTransactions(context);
  const S = () => context.store.getState();

  const save = (
    { editingTaskId, draft, startDate, initialDuration, today }: TaskDialogSaveInput,
    notices: StartEditNotice[],
  ): void => {
    if (draft.customTaskTypeId) {
      const definition = S().customTaskTypes.find(type => type.id === draft.customTaskTypeId)
        ?? getPersonalTaskTypes().find(type => type.id === draft.customTaskTypeId);
      if (definition) S().ensureProjectTaskType(definition);
    }

    const editingTask = editingTaskId ? S().tasks.find(task => task.id === editingTaskId) : undefined;
    if (editingTask) {
      const time = savedTime(editingTask, draft, initialDuration);
      // scheduleStart (het geplande anker) alléén bijwerken als de gebruiker de startdatum
      // daadwerkelijk wijzigde — anders zou opslaan de berekende start als nieuw anker vastleggen
      // en de drift na herberekenen herintroduceren.
      // Start is verplicht: het veld weigert leeg al (`required`), dit is het vangnet.
      const anchor = startDate ? startAnchorAfterEdit(editingTask, startDate) : undefined;
      // Een getypte start op een taak met voorganger wordt een beperking "Start niet eerder dan"
      // (dezelfde regel als Tabel, paneel en Gantt-sleep), in dezelfde `updateTask` en dus
      // dezelfde undo-stap. Houdt een andere constraint de start tegen, dan wordt de start niet
      // toegepast en volgt een melding. Koos de gebruiker in deze dialoog zelf een beperking, dan
      // wint die expliciete keuze en doet de startregel niets.
      const constraintEditedHere = JSON.stringify(draft.constraint) !== JSON.stringify(editingTask.constraint)
        || JSON.stringify(draft.constraint2) !== JSON.stringify(editingTask.constraint2);
      const driven = anchor !== undefined && !constraintEditedHere
        && predecessorDrivenTaskIds(S().tasks, S().sequences).has(editingTask.id);
      const prospective: Task = { ...editingTask, isHammock: draft.isHammock, time };
      const blocking = constraintBlockingStart(prospective, driven);
      const snet = anchor !== undefined && !blocking ? startConstraintAfterEdit(prospective, anchor, driven) : undefined;
      if (anchor !== undefined && !blocking) time.scheduleStart = anchor;
      if (blocking) notices.push({ kind: 'blocked', name: draft.name, constraint: blocking });
      else if (snet && anchor !== undefined) notices.push({ kind: 'snet', name: draft.name, date: anchor, change: snet.change });
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
        constraint: snet ? snet.constraint : draft.constraint,
        constraint2: draft.constraint2,
        deadline: draft.deadline,
        notes: draft.notes,
        time,
      };
      // Voortgang in deze sessie gewijzigd ⇒ dezelfde invarianten als het paneel, op de samengevoegde
      // taak (status, afgeleid einde, resterende duur op de eventueel gewijzigde duur).
      if (PROGRESS_KEYS.some(key => time[key] !== editingTask.time[key])) {
        const merged: Task = { ...editingTask, ...patch, time };
        // Invoerregel uit `engine/progressEntry.ts`: voortgang ingevuld zonder statusdatum ⇒ die
        // gaat op vandaag, in deze transactie (één undo-stap samen met de voortgang), met de
        // melding van het paneel. De concepttaak rekende al met vandaag (`progressEntryStatusDate`
        // in TaskDialog.tsx).
        let statusDate = S().project.statusDate;
        if (!statusDate && today && hasRecordedProgress(merged.time)) {
          S().setStatusDate(today);
          S().notify(statusDateSetTodayNotice(today, S().ui.dateNotation));
          statusDate = today;
        }
        applyProgressInvariants(merged, statusDate);
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
      // Een nieuwe taak houdt haar werkregel in de concept tot Opslaan (op een
      // bestaande taak commit de dialoog hem direct via `setTaskWorkRule`, binnen de sessie).
      workRule: draft.workRule,
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
  };

  return (input) => {
    // Een lopende taak houdt bij een duurwijziging haar gedane
    // werk; een duur korter dan dat werk wordt geweigerd. Vóór de transactie, zodat ook de naam, de
    // ouder en een nieuw taaktype uit deze sessie niet half worden opgeslagen (`updateTask` zou
    // alleen zijn eigen deel weigeren). `false` ⇒ niets opgeslagen, de dialoog blijft open.
    const current = input.editingTaskId ? S().tasks.find(task => task.id === input.editingTaskId) : undefined;
    if (current) {
      const hoursPerDay = taskCalendarHoursPerDay({ ...current, calendarId: input.draft.calendarId }, S().calendars, S().calendar);
      if (durationEditRefusal(current, savedTime(current, input.draft, input.initialDuration), hoursPerDay)) {
        S().notify(durationBelowDoneWorkNotice(current));
        return false;
      }
    }
    // Meldingen (startregel) pas ná de mutaties en de undo-stap, via het ene kanaal.
    const notices: StartEditNotice[] = [];
    if (input.session) {
      save(input, notices);
      S().squashHistorySince(input.session, 'Taak bewerken');
    } else {
      batch.withTransaction(() => save(input, notices));
    }
    notifyStartEdit(S().notify, notices, S().ui.dateNotation);
    return true;
  };
}

/** Expliciete compatibiliteitsadapter voor de ene gemounte productinterface. */
export const saveTaskDialog = createTaskDialogSave(appStoreContext);
