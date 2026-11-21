// De melding als een bewerking aan een toewijzing de uren van de ANDERE resources op die taak
// verandert (#954, besluit eigenaar 2026-11-21). Voorbeeld onder Vaste inzet: Bram van 100 % naar
// 50 % maakt de taak 20 dagen, en Anna gaat van 80 naar 160 uur. De melding zegt dat, met een knop
// Ongedaan maken die precies die ene stap uit de geschiedenis terugzet (ook de duur). Verandert er
// bij de anderen niets, dan meldt niemand iets.
//
// De melding hoort bij de geschiedenisstap van één losse bewerking: ze vergelijkt vóór en ná van die
// stap (`notifyOtherWorkChanged`), met het getal van *Werk (u)* (`shownWork.ts`), dus ook de som van een
// eigen urenverdeling. In Taak bewerken (een bewerksessie) meldt de app niets: die dialoog bundelt
// meerdere bewerkingen tot één stap en heeft Annuleren als weg terug (review #1120, knownbug 2054).
import type { AppState } from './appStore';
import { selectUndoHistoryEvent } from './sessionHistory';
import type { Snapshot } from './snapshot';
import type { AppNotification, NotificationAction, NotifyInput } from './slices/types';
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

type WorkState = Pick<Snapshot, 'tasks' | 'assignments' | 'resources' | 'calendars' | 'calendar'>;

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

/** Eén bewerking aan toewijzing `assignmentId` op taak `taskId`; `sequence` is `nextHistorySequence`
 *  vlak vóór de bewerking, dus het volgnummer van haar eigen stap. */
export interface AssignmentEdit {
  sequence: number;
  taskId: string;
  assignmentId: string;
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

/** Staat de melding nu op het scherm? (Rood bewijs ronde 4: nog het oude gedrag, altijd.) */
export function isNotificationCurrent(_n: AppNotification, _latestUndoId: string | null): boolean {
  return true;
}

/**
 * Na de `set` van een van de vier toewijzingsacties: meld de uren van de andere werkresources die vóór én
 * na de stap op de taak staan, als die zichtbaar veranderden. Alleen voor de eigen stap van de bewerking
 * zolang die de stap van Ctrl+Z is; geen eigen stap (batch, extensie, geweigerd) of een stap in een
 * bewerksessie (Taak bewerken) ⇒ geen melding. Een nieuwe melding vervangt de vorige.
 */
export function notifyOtherWorkChanged(state: AppState, edit: AssignmentEdit | null): void {
  if (!edit) return;
  const event = state.historyEvents.find((e) => e.sequence === edit.sequence && e.state === 'applied');
  const delta = event?.deltas.find((d) => d.kind === 'document-data');
  if (!event || event.sessionKey || !delta || delta.kind !== 'document-data' || event.id !== latestUndoEventId(state)) return;
  const { before, after } = delta;
  const was = before.tasks.find((t) => t.id === edit.taskId);
  const now = after.tasks.find((t) => t.id === edit.taskId);
  if (!was || !now) return;
  const old = shownWorkOfTask(before, was);
  const lines = [...shownWorkOfTask(after, now)].flatMap(([id, minutes]) => {
    const oldMinutes = old.get(id);
    if (id === edit.assignmentId || oldMinutes === undefined) return [];
    const from = shownWorkHours(oldMinutes);
    const to = shownWorkHours(minutes);
    if (from === to) return [];
    const resourceId = after.assignments.find((a) => a.id === id)?.resourceId;
    const name = after.resources.find((r) => r.id === resourceId)?.name || '?';
    return [{ messageKey: 'notifications.otherWork.line' as const, params: { name }, numberParams: { before: from, after: to } }];
  });
  if (lines.length === 0) return;
  const t = now.time;
  const durationChanged = t.scheduleDuration !== was.time.scheduleDuration || t.durationMinutes !== was.time.durationMinutes;
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
    action: { kind: 'undoHistoryEvent', eventId: event.id, labelKey: 'notifications.actions.undo' },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
    dedupeKey: OTHER_WORK_NOTICE_KEY,
    replaceOnDedupe: true,
    durationMs: OTHER_WORK_NOTICE_MS,
  });
}
