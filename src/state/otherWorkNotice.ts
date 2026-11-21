// De melding als een bewerking aan één toewijzing de uren van de ANDERE resources op die taak
// verandert (#954, besluit eigenaar 2026-11-21). Voorbeeld onder Vaste inzet: Bram van 100 % naar
// 50 % maakt de taak 20 dagen, en Anna gaat van 80 naar 160 uur. De melding zegt dat, met een knop
// Ongedaan maken die precies die ene stap uit de geschiedenis terugzet (ook de duur). Verandert er
// bij de anderen niets, dan meldt niemand iets: `otherWorkChanges` geeft dan een lege lijst.
import type { AppState } from './appStore';
import { selectUndoHistoryEvent } from './sessionHistory';
import type { NotificationAction, NotifyInput } from './slices/types';
import type { OtherWorkOutcome } from './assignmentMutations';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';
import { isHourTask } from '@/engine/work/workRuleApply';

export const OTHER_WORK_NOTICE_KEY = 'other-work-changed';

/** Lang genoeg om de regels te lezen en op Ongedaan maken te klikken. */
const OTHER_WORK_NOTICE_MS = 12000;

const hours = (minutes: number): number => minutes / 60;

/**
 * De melding voor `outcome`, met de knop voor het event `eventId`. `null` zonder verandering of
 * zonder event (dan is er niets terug te zetten en blijft de melding weg: zonder knop zou hij
 * een andere belofte doen dan het besluit). Een tweede bewerking vervangt de melding.
 */
export function otherWorkNotice(
  state: Pick<AppState, 'tasks' | 'resources' | 'assignments'>,
  outcome: OtherWorkOutcome | undefined,
  eventId: string | null,
): NotifyInput | null {
  if (!outcome || outcome.changes.length === 0 || eventId === null) return null;
  const task = state.tasks.find((t) => t.id === outcome.taskId);
  if (!task) return null;
  // `count` kiest de meervoudsvorm; het getal zelf staat in `numberParams` (notatie van de app-taal).
  const head: Pick<NotifyInput, 'messageKey' | 'params' | 'numberParams'> = !outcome.durationChanged
    ? { messageKey: 'notifications.otherWork.durationSame' }
    : isHourTask(task.time)
      ? { messageKey: 'notifications.otherWork.durationHours', params: { count: hours(task.time.durationMinutes) }, numberParams: { hours: hours(task.time.durationMinutes) } }
      : { messageKey: 'notifications.otherWork.durationDays', params: { count: task.time.scheduleDuration }, numberParams: { days: task.time.scheduleDuration } };
  return {
    severity: 'info',
    ...head,
    detailLines: outcome.changes.map((c) => {
      const a = state.assignments.find((x) => x.id === c.assignmentId);
      const name = state.resources.find((r) => r.id === a?.resourceId)?.name || '?';
      return {
        messageKey: 'notifications.otherWork.line' as const,
        params: { name },
        numberParams: { before: hours(c.beforeMinutes), after: hours(c.afterMinutes) },
      };
    }),
    action: { kind: 'undoHistoryEvent', eventId, labelKey: 'notifications.actions.undo' },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
    dedupeKey: OTHER_WORK_NOTICE_KEY,
    replaceOnDedupe: true,
    durationMs: OTHER_WORK_NOTICE_MS,
  };
}

/** Het event dat Ctrl+Z nu zou terugzetten, of `null`. */
export function latestUndoEventId(state: Pick<AppState, 'historyEvents' | 'activeDocumentId'>): string | null {
  return selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId)?.id ?? null;
}

/** Mag de knop Ongedaan maken van een melding nu? Alleen zolang haar stap de laatste is: dan zet hij
 *  precies die bewerking terug en nooit iets wat daarna kwam. */
export function canRunNotificationUndo(
  state: Pick<AppState, 'historyEvents' | 'activeDocumentId'>,
  action: NotificationAction,
): boolean {
  return action.kind === 'undoHistoryEvent' && latestUndoEventId(state) === action.eventId;
}

/** Na een bewerking aan één toewijzing: meld de uren van de anderen als die veranderden.
 *  `sequenceBefore` = `nextHistorySequence` vlak vóór de bewerking: de knop hoort alleen bij het
 *  event dat DEZE bewerking vastlegde. Legt een omvattende transactie (batch, extensie) het event
 *  pas later vast, dan is er geen eigen event en dus geen melding: de nieuwste stap is dan een
 *  andere bewerking, en die mag de knop nooit terugzetten. */
export function notifyOtherWorkChanged(state: AppState, outcome: OtherWorkOutcome | undefined, sequenceBefore: number): void {
  const own = state.historyEvents.find((e) => e.sequence === sequenceBefore && e.state === 'applied');
  const eventId = own && own.id === latestUndoEventId(state) ? own.id : null;
  const notice = otherWorkNotice(state, outcome, eventId);
  if (notice) state.notify(notice);
}
