import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { appStoreContext, type AppState, type AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  applyProgressInvariants, rememberProgressBeforeRecalculation,
} from '@/engine/taskMutationRules';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { startAnchorAfterEdit, startIsActual } from '@/utils/taskDates';
import {
  constraintBlockingStart, predecessorDrivenTaskIds, startConstraintAfterEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit, type StartEditNotice } from '@/state/startConstraintNotice';
import {
  hasRecordedProgress, planProgressEntry, type ProgressEdit, type ProgressEntryContext, type ProgressEntryPlan,
} from '@/engine/progressEntry';
import { progressPlannedDatesAfterEdit } from '@/state/progressPlannedDates';
import { durationBelowDoneWorkNotice, statusDateSetTodayNotice } from '@/state/progressEntryNotice';
import { durationEditRefusal } from '@/engine/work/workRuleApply';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import { getPersonalTaskTypes } from '@/services/taskTypes/personalTaskTypes';
import type { Task } from '@/types/task';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { HistorySessionMark } from '@/state/slices/historySlice';
import type { PhaseAssignmentChoice } from '@/state/structuralTransition';

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

/** De duur van de taak bij het openen van de dialoog. */
export interface TaskDialogInitialDuration {
  unit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
}

/** De voortgang op het moment dat het bewerkbare startveld werd ingevuld. */
export interface TaskDialogStartEdit {
  date: string;
  completion: number;
}

/** Afgeleide conceptdatums worden bij Opslaan opnieuw bepaald met de definitieve invoer. */
export type TaskDialogDraft = Task & {
  inferredActualStart?: true;
  inferredActualFinish?: true;
};

type TaskDialogProgressPlan = Extract<ProgressEntryPlan, { ok: false }>
  | { ok: true; change: { task: TaskDialogDraft; statusDateToday?: string } | null };

export interface TaskDialogSaveInput {
  /** De bewerkte taak; `null` (of een inmiddels verdwenen id) ⇒ de "nieuwe taak"-tak. */
  editingTaskId: string | null;
  draft: TaskDialogDraft;
  /** Een expliciet gewijzigde startdatum. Zonder waarde blijft het anker van een bestaande taak staan. */
  startDate?: string | TaskDialogStartEdit;
  /** De duur bij het openen; afwezig ⇒ de duur uit de concept telt altijd als bewerkt. */
  initialDuration?: TaskDialogInitialDuration | null;
  /** De open bewerksessie van de dialoog (`historyMark`); afwezig ⇒ één `withTransaction`. */
  session?: HistorySessionMark | null;
  /** Vandaag (`localTodayIso`), meegegeven door de dialoog: de invoerregels van
   *  `engine/progressEntry.ts` gelden. Afwezig = vangnet zonder die regels. */
  today?: string;
  /** Het antwoord op "Taak wordt een samenvattingstaak", als de dialoog het vóór het opslaan vroeg (de nieuwe
   *  ouder draagt toewijzingen). Afwezig ⇒ de store vraagt zelf (`PhaseAssignmentOptions`). */
  phaseAssignments?: PhaseAssignmentChoice;
}

const PROGRESS_KEYS = ['completion', 'actualStart', 'actualFinish'] as const;

/** De geplande start zoals de dialoog haar vóór de nieuwe voortgang verwerkt. */
function planTaskDialogStart(
  state: Pick<AppState, 'tasks' | 'sequences'>, editingTask: Task, draft: Task,
  startDate: TaskDialogSaveInput['startDate'],
): { anchor?: string; constraint: Task['constraint']; notice?: StartEditNotice } {
  const unchanged = { constraint: draft.constraint };
  if (!startDate) return unchanged;
  const entered = typeof startDate === 'object' ? startDate : undefined;
  const date = typeof startDate === 'string' ? startDate : startDate.date;
  const timeBeforeProgress = entered
    ? { ...editingTask.time, completion: entered.completion, actualStart: undefined }
    : startIsActual(draft) ? editingTask.time : draft.time;
  const hasActualStart = !entered && startIsActual({ ...editingTask, time: timeBeforeProgress });
  const anchor = date && !hasActualStart ? startAnchorAfterEdit(editingTask, date) : undefined;
  if (anchor === undefined) return unchanged;
  // Een expliciet gekozen beperking wint van de SNET die typen van een start anders toevoegt.
  const explicitConstraint = JSON.stringify(draft.constraint) !== JSON.stringify(editingTask.constraint)
    || JSON.stringify(draft.constraint2) !== JSON.stringify(editingTask.constraint2);
  const driven = !explicitConstraint && predecessorDrivenTaskIds(state.tasks, state.sequences).has(editingTask.id);
  // De getypte start hoort bij de taak vóór de conceptvoortgang. Een werkelijke start die de
  // schuif daarna afleidt of vraagt, mag het eerder getypte anker of de SNET niet wissen.
  const prospective = { ...editingTask, isHammock: draft.isHammock, time: timeBeforeProgress };
  const blocked = constraintBlockingStart(prospective, driven);
  if (blocked) return {
    ...unchanged, notice: { kind: 'blocked', name: draft.name, constraint: blocked, taskId: editingTask.id },
  };
  const snet = startConstraintAfterEdit(prospective, anchor, driven);
  return {
    anchor,
    constraint: snet?.constraint ?? draft.constraint,
    notice: snet ? { kind: 'snet', name: draft.name, date: anchor, change: snet.change } : undefined,
  };
}

/** Toets conceptvoortgang met de actuele planning en dezelfde startregel als Opslaan. */
export function planTaskDialogProgress(
  state: AppState, draft: TaskDialogDraft, startDate: TaskDialogSaveInput['startDate'], edit: ProgressEdit,
  { initialDuration, ...context }: Pick<ProgressEntryContext, 'today' | 'actualStart'>
    & Pick<TaskDialogSaveInput, 'initialDuration'>,
): TaskDialogProgressPlan {
  const live = state.tasks.find(task => task.id === draft.id);
  const start = live ? planTaskDialogStart(state, live, draft, startDate) : undefined;
  const time = live ? savedTime(live, draft, initialDuration) : { ...draft.time };
  const task = { ...draft, constraint: live ? start?.constraint : draft.constraint, time };
  if (start?.anchor !== undefined) time.scheduleStart = start.anchor;
  if (edit.field === 'completion') {
    if (edit.value > 0 && draft.inferredActualStart) time.actualStart = undefined;
  }
  // Een automatisch einde is nog geen feit. Een gewijzigde werkelijke start wordt getoetst
  // tegen het opnieuw afgeleide einde, met die start als ondergrens.
  if (edit.field !== 'actualFinish' && draft.inferredActualFinish) time.actualFinish = undefined;
  const plan = planProgressEntry(task, edit, {
    ...context,
    statusDate: state.project.statusDate,
    calendar: resolveCalendar(task.calendarId, state.calendars, state.calendar),
    plannedDates: live ? () => progressPlannedDatesAfterEdit(state, live, {
      ...task, status: live.status, time: { ...time, completion: live.time.completion },
    }) : undefined,
  });
  if (!plan.ok) return plan;
  const next = plan.change?.task ?? task;
  const { completion, actualStart, actualFinish, remainingTime, remainingMinutes } = next.time;
  // Ook het expliciet aanvaarden van dezelfde datum verandert haar herkomst.
  const inferredActualStart = actualStart && edit.field !== 'actualStart' && !context.actualStart
    && (draft.inferredActualStart || (edit.field === 'completion' && !time.actualStart)) ? true : undefined;
  const inferredActualFinish = actualFinish && edit.field !== 'actualFinish'
    && (draft.inferredActualFinish || (edit.field === 'completion' && !time.actualFinish)) ? true : undefined;
  if (!plan.change && draft.inferredActualStart === inferredActualStart
    && draft.inferredActualFinish === inferredActualFinish) return { ok: true, change: null };
  // Alleen de voortgang gaat terug naar het concept. De actuele duur en de afgeleide SNET
  // zijn invoer voor de berekening, geen door de gebruiker gewijzigde conceptvelden.
  return {
    ok: true,
    change: {
      ...plan.change,
      task: {
        ...draft, status: next.status, inferredActualStart, inferredActualFinish,
        time: { ...draft.time, completion, actualStart, actualFinish, remainingTime, remainingMinutes },
      },
    },
  };
}

/** Dezelfde afleiding voor de schuif en voor Opslaan, na de laatste plaatsingsbewerking. */
export function prepareTaskDialogSaveProgress(
  state: AppState,
  { draft, startDate, today, initialDuration }: Pick<TaskDialogSaveInput, 'draft' | 'startDate' | 'today' | 'initialDuration'>,
  actualStart?: string,
): TaskDialogProgressPlan {
  if (!draft.inferredActualFinish && (!draft.inferredActualStart || draft.time.completion <= 0)) {
    return { ok: true, change: null };
  }
  const plan = planTaskDialogProgress(state, draft, startDate, { field: 'completion', value: draft.time.completion },
    { today, initialDuration, actualStart });
  if (!plan.ok) return plan;
  const ready = plan.change?.task ?? draft;
  return { ok: true, change: {
    ...plan.change,
    task: { ...ready, inferredActualStart: undefined, inferredActualFinish: undefined },
  } };
}

/**
 * De samengevoegde tijd vóór het startanker. Voortgang, de duurtoets en Opslaan rekenen met
 * dezelfde actuele taak en dezelfde bewust gewijzigde conceptvelden.
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
    { editingTaskId, draft, startDate, initialDuration, today, phaseAssignments }: TaskDialogSaveInput,
    notices: StartEditNotice[],
  ): void => {
    const phaseOpts = phaseAssignments ? { phaseAssignments, answered: true } : undefined;
    if (draft.customTaskTypeId) {
      const definition = S().customTaskTypes.find(type => type.id === draft.customTaskTypeId)
        ?? getPersonalTaskTypes().find(type => type.id === draft.customTaskTypeId);
      if (definition) S().ensureProjectTaskType(definition);
    }

    const editingTask = editingTaskId ? S().tasks.find(task => task.id === editingTaskId) : undefined;
    if (editingTask) {
      const time = savedTime(editingTask, draft, initialDuration);
      const start = planTaskDialogStart(S(), editingTask, draft, startDate);
      if (start.anchor !== undefined) time.scheduleStart = start.anchor;
      if (start.notice) notices.push(start.notice);
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
        constraint: start.constraint,
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
        // Met de kalender van de taak: het afgeleide einde wordt eerst een moment (D6), en pas dan
        // vergeleken met de werkelijke start (zoals bij `settleEditedDuration`).
        applyProgressInvariants(merged, statusDate, resolveCalendar(merged.calendarId, S().calendars, S().calendar));
        rememberProgressBeforeRecalculation(editingTask, merged);
        patch.status = merged.status;
      }
      S().updateTask(editingTask.id, patch);
      // Een gewijzigde ouder gaat via `moveTask`: die synchroniseert childIds op ZOWEL de oude als
      // de nieuwe ouder en weigert cykels. `updateTask` is een kale Object.assign zonder die sync —
      // parentId meepatchen zou de boom stil corrumperen. Bij een geweigerde move doet `moveTask`
      // niets: parentId blijft dan ook ongewijzigd.
      if (draft.parentId !== editingTask.parentId) S().moveTask(editingTask.id, draft.parentId, undefined, phaseOpts);
      return;
    }

    const newStart = (typeof startDate === 'object' ? startDate.date : startDate) ?? draft.time.scheduleStart;
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
        scheduleStart: newStart,
        scheduleFinish: newStart,
        earlyStart: newStart,
        earlyFinish: newStart,
        lateStart: newStart,
        lateFinish: newStart,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        completion: 0,
      },
    }, phaseOpts);
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
    if (current) {
      const progress = prepareTaskDialogSaveProgress(S(), input);
      if (!progress.ok) return false;
      if (progress.change) input = { ...input, draft: progress.change.task };
    }
    // Meldingen (startregel) pas ná de mutaties en de undo-stap, via het ene kanaal.
    const notices: StartEditNotice[] = [];
    if (input.session) {
      save(input, notices);
      S().squashHistorySince(input.session, 'Taak bewerken');
    } else {
      batch.withTransaction(() => save(input, notices));
    }
    notifyStartEdit(S().notify, notices, S().ui.dateNotation, S().ui.timeNotation);
    return true;
  };
}

/** Expliciete compatibiliteitsadapter voor de ene gemounte productinterface. */
export const saveTaskDialog = createTaskDialogSave(appStoreContext);
