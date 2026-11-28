import type { NotificationDetailLine, NotifyInput } from './slices/types';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';

const notifiedDocIds = new Set<string>();

export function claimTaskTypesNotice(docId: string): boolean {
  if (notifiedDocIds.has(docId)) return false;
  notifiedDocIds.add(docId);
  return true;
}

export function clearTaskTypesNoticeForDoc(docId: string): void {
  notifiedDocIds.delete(docId);
}

export function __resetTaskTypesNoticeForTests(): void {
  notifiedDocIds.clear();
}

export function notifyWorkRuleDurationsChanged(notify: (n: NotifyInput) => void, count: number): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.workRuleDurationsChanged',
    params: { count },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
  });
}

export const TASK_TYPES_DETAIL_LINE: NotificationDetailLine = {
  messageKey: 'notifications.taskTypesUnlockedDetail',
  helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
  linkKey: 'notifications.workRulesReadMore',
};

export function notifyTaskTypesUnlocked(notify: (n: NotifyInput) => void, docId: string): void {
  if (!claimTaskTypesNotice(docId)) return;
  notifyTaskTypesUnlockedClaimed(notify);
}

export function notifyTaskTypesUnlockedClaimed(notify: (n: NotifyInput) => void): void {
  notify({
    severity: 'info',
    messageKey: 'notifications.taskTypesUnlocked',
    dedupeKey: 'task-types-unlocked',
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
  });
}
