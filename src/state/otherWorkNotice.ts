// De melding als een bewerking aan één toewijzing de uren van de ANDERE resources op die taak
// verandert (#954, besluit eigenaar 2026-11-21). Voorbeeld onder Vaste inzet: Bram van 100 % naar
// 50 % maakt de taak 20 dagen, en Anna gaat van 80 naar 160 uur. De melding zegt dat, met een knop
// Ongedaan maken die precies die ene stap uit de geschiedenis terugzet (ook de duur). Verandert er
// bij de anderen niets, dan meldt niemand iets.
//
// De store-actie neemt vóór haar bewerking een momentopname (`watchOtherWork`) en vergelijkt daarna
// (`notifyOtherWorkChanged`). Beide lezen het werk zoals *Werk (u)* het toont (`shownWork.ts`), dus ook
// de som van een eigen urenverdeling.
import type { AppState } from './appStore';
import { selectUndoHistoryEvent } from './sessionHistory';
import type { NotificationAction, NotifyInput } from './slices/types';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';
import { isHourTask, workRuleApplies } from '@/engine/work/workRuleApply';
import { shownRemainingWorkMinutes, shownWorkHours } from '@/engine/work/shownWork';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { contourSiblings, costResourceIds, resourceDrivesDuration } from '@/types/resource';
import type { Task } from '@/types/task';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';

export const OTHER_WORK_NOTICE_KEY = 'other-work-changed';

/** Lang genoeg om de regels te lezen en op Ongedaan maken te klikken. */
const OTHER_WORK_NOTICE_MS = 12000;

type WorkState = Pick<AppState, 'tasks' | 'assignments' | 'resources' | 'calendars' | 'calendar'>;

/** Wat *Werk (u)* per werkresource van de taak toont, in minuten. Materiaal en kosten tonen een
 *  streepje en tellen niet mee; zonder werkregel op de taak (fase, mijlpaal) is de lijst leeg. */
function shownWorkOfTask(state: WorkState, task: Task): Map<string, number> {
  const out = new Map<string, number>();
  if (!workRuleApplies(task)) return out;
  const own = state.assignments.filter((a) => a.taskId === task.id);
  const contourOf = matchContoursToAssignments(task.timephasedContours, contourSiblings(own, costResourceIds(state.resources)));
  const hoursPerDay = taskCalendarHoursPerDay(task, state.calendars, state.calendar);
  for (const a of own) {
    if (!resourceDrivesDuration(state.resources.find((r) => r.id === a.resourceId))) continue;
    out.set(a.id, shownRemainingWorkMinutes(task, a, contourOf.get(a.id), hoursPerDay));
  }
  return out;
}

/** De momentopname van vóór een bewerking aan toewijzing `editedId` (of een nieuwe) op taak `taskId`. */
export interface OtherWorkWatch {
  taskId: string;
  editedId: string | undefined;
  before: Map<string, number>;
  time: Task['time'];
  /** `nextHistorySequence` vlak vóór de bewerking: de knop hoort alleen bij het event van DEZE bewerking. */
  sequenceBefore: number;
}

export function watchOtherWork(state: AppState, taskId: string | undefined, editedId?: string): OtherWorkWatch | null {
  const task = taskId === undefined ? undefined : state.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return { taskId: task.id, editedId, before: shownWorkOfTask(state, task), time: task.time, sequenceBefore: state.nextHistorySequence };
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

/**
 * Na de bewerking: meld de uren van de andere werkresources die vóór én na op de taak staan, als die
 * zichtbaar veranderden. Geen melding zonder eigen event: legt een omvattende transactie (batch,
 * extensie) het event pas later vast, dan is de nieuwste stap een andere bewerking, en die mag de knop
 * nooit terugzetten. Een tweede bewerking vervangt de melding.
 */
export function notifyOtherWorkChanged(state: AppState, watch: OtherWorkWatch | null): void {
  if (!watch) return;
  const own = state.historyEvents.find((e) => e.sequence === watch.sequenceBefore && e.state === 'applied');
  if (!own || own.id !== latestUndoEventId(state)) return;
  const task = state.tasks.find((t) => t.id === watch.taskId);
  if (!task) return;
  const after = shownWorkOfTask(state, task);
  const lines = [...after].flatMap(([id, afterMinutes]) => {
    const beforeMinutes = watch.before.get(id);
    if (id === watch.editedId || beforeMinutes === undefined) return [];
    const before = shownWorkHours(beforeMinutes);
    const now = shownWorkHours(afterMinutes);
    if (before === now) return [];
    const resourceId = state.assignments.find((a) => a.id === id)?.resourceId;
    const name = state.resources.find((r) => r.id === resourceId)?.name || '?';
    return [{ messageKey: 'notifications.otherWork.line' as const, params: { name }, numberParams: { before, after: now } }];
  });
  if (lines.length === 0) return;
  const t = task.time;
  const durationChanged = t.scheduleDuration !== watch.time.scheduleDuration || t.durationMinutes !== watch.time.durationMinutes;
  // `count` kiest de meervoudsvorm; het getal zelf staat in `numberParams` (notatie van de app-taal).
  const head: Pick<NotifyInput, 'messageKey' | 'params' | 'numberParams'> = !durationChanged
    ? { messageKey: 'notifications.otherWork.durationSame' }
    : isHourTask(t)
      ? { messageKey: 'notifications.otherWork.durationHours', params: { count: t.durationMinutes / 60 }, numberParams: { hours: t.durationMinutes / 60 } }
      : { messageKey: 'notifications.otherWork.durationDays', params: { count: t.scheduleDuration }, numberParams: { days: t.scheduleDuration } };
  state.notify({
    severity: 'info',
    ...head,
    detailLines: lines,
    action: { kind: 'undoHistoryEvent', eventId: own.id, labelKey: 'notifications.actions.undo' },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
    dedupeKey: OTHER_WORK_NOTICE_KEY,
    replaceOnDedupe: true,
    durationMs: OTHER_WORK_NOTICE_MS,
  });
}
