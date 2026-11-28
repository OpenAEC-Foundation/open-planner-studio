import type { StoreApi } from 'zustand';
import type { AppState } from './appStore';
import { DOCUMENT_FIELDS } from './documentContract';
import { selectUndoHistoryEvent } from './sessionHistory';
import type { Snapshot } from './snapshot';
import type { NotifyInput } from './slices/types';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';
import { isHourTask, workRuleApplies } from '@/engine/work/workRuleApply';
import { shownRemainingWorkMinutes, shownWorkHours } from '@/engine/work/shownWork';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { contourSiblings, costResourceIds, resourceDrivesDuration } from '@/types/resource';
import type { Task } from '@/types/task';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';

export const OTHER_WORK_NOTICE_KEY = 'other-work-changed';

export const OTHER_WORK_NOTICE_MS = 12000;

type WorkState = Pick<Snapshot, 'tasks' | 'assignments' | 'resources' | 'calendars' | 'calendar'>;
type NoticeStore = Pick<StoreApi<AppState>, 'getState' | 'subscribe'>;

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

export interface AssignmentEdit {
  sequence: number;
  taskId: string;
  assignmentId: string;
}

function noticeData(state: AppState): unknown[] {
  return DOCUMENT_FIELDS.filter((f) => f.snapshot === 'data' && f.key !== 'tasks').map((f) => f.get(state));
}

export function watchNotice(store: NoticeStore, eventId: string, holds: (state: AppState) => boolean = () => true): void {
  const data = noticeData(store.getState());
  const stop = store.subscribe((s) => {
    const notice = s.ui.notifications.find((n) => n.action?.kind === 'undoHistoryEvent' && n.action.eventId === eventId);
    if (!notice) { stop(); return; }
    if (selectUndoHistoryEvent(s.historyEvents, s.activeDocumentId)?.id === eventId
      && noticeData(s).every((value, i) => value === data[i]) && holds(s)) return;
    stop();
    s.dismissNotification(notice.id);
  });
}

export function notifyOtherWorkChanged(store: NoticeStore, edit: AssignmentEdit | null): void {
  if (!edit) return;
  const state = store.getState();
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  const delta = event?.deltas.find((d) => d.kind === 'document-data');
  if (!event || event.sequence !== edit.sequence || event.sessionKey || delta?.kind !== 'document-data') return;
  const { before, after } = delta;
  const was = before.tasks.find((t) => t.id === edit.taskId);
  const now = after.tasks.find((t) => t.id === edit.taskId);
  if (!was || !now) return;
  const resourceOf = (id: string) => (after.assignments.find((a) => a.id === id) ?? before.assignments.find((a) => a.id === id))?.resourceId;
  const editedResourceId = resourceOf(edit.assignmentId);
  const old = shownWorkOfTask(before, was);
  const lines = [...shownWorkOfTask(after, now)].flatMap(([id, minutes]) => {
    const oldMinutes = old.get(id);
    const resourceId = resourceOf(id);
    if (resourceId === editedResourceId || oldMinutes === undefined) return [];
    const from = shownWorkHours(oldMinutes);
    const to = shownWorkHours(minutes);
    if (from === to) return [];
    const name = after.resources.find((r) => r.id === resourceId)?.name || '?';
    return [{ messageKey: 'notifications.otherWork.line' as const, params: { name }, numberParams: { before: from, after: to } }];
  });
  if (lines.length === 0) return;
  const t = now.time;
  const durationChanged = t.scheduleDuration !== was.time.scheduleDuration || t.durationMinutes !== was.time.durationMinutes;
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
  watchNotice(store, event.id);
}
