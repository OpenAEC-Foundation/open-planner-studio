import type { StartConstraintChange } from '@/engine/startEditConstraint';
import type { TaskConstraint } from '@/types/task';
import type { DateNotation, TimeNotation } from '@/types/view';
import { displayDateTime } from '@/utils/displayDate';
import type { NotifyInput } from './slices/types';
import { CONSTRAINTS_HELP_ARTICLE_ID } from './helpArticles';
import { refusalNotice, refusedNamesLine, refusedSetKey } from './refusalNotice';

export type StartEditNotice =
  | { kind: 'snet'; name: string; date: string; change: StartConstraintChange; dateLabel?: string }
  | {
    kind: 'blocked'; name: string; constraint: TaskConstraint;
    taskId: string;
    dateLabel?: string;
  };

const HELP_ARTICLE_ID = CONSTRAINTS_HELP_ARTICLE_ID;

export function startEditNotifications(
  notices: readonly StartEditNotice[],
  notation: DateNotation,
  timeNotation: TimeNotation,
): NotifyInput[] {
  const out: NotifyInput[] = [];
  const snet = notices.filter((notice): notice is Extract<StartEditNotice, { kind: 'snet' }> => notice.kind === 'snet');
  const blocked = notices.filter((notice): notice is Extract<StartEditNotice, { kind: 'blocked' }> => notice.kind === 'blocked');
  if (snet.length === 1) {
    const [notice] = snet;
    out.push({
      severity: 'info',
      messageKey: notice.change === 'created' ? 'notifications.startSnetCreated' : 'notifications.startSnetUpdated',
      params: { name: notice.name, date: displayDateTime(notice.dateLabel ?? notice.date, notation, timeNotation) },
      helpArticleId: HELP_ARTICLE_ID,
    });
  } else if (snet.length > 1) {
    out.push({
      severity: 'info',
      messageKey: 'notifications.startSnetMany',
      params: { count: snet.length },
      helpArticleId: HELP_ARTICLE_ID,
    });
  }
  if (blocked.length === 1) {
    const [{ name, constraint, taskId, dateLabel }] = blocked;
    out.push(refusalNotice({
      messageKey: constraint.date ? 'notifications.startBlockedByConstraint' : 'notifications.startBlockedByConstraintNoDate',
      params: constraint.date
        ? { name, type: constraint.type, date: displayDateTime(dateLabel ?? constraint.date, notation, timeNotation) }
        : { name, type: constraint.type },
      dedupeKey: `start-blocked:${taskId}`,
      helpArticleId: HELP_ARTICLE_ID,
    }));
  } else if (blocked.length > 1) {
    out.push(refusalNotice({
      messageKey: 'notifications.startBlockedByConstraintMany',
      params: { count: blocked.length },
      detailLines: refusedNamesLine(blocked.map(b => b.name), 'notApplied'),
      dedupeKey: refusedSetKey('start-blocked-many', blocked.map(b => b.taskId)),
      helpArticleId: HELP_ARTICLE_ID,
    }));
  }
  return out;
}

export function notifyStartEdit(
  notify: (notification: NotifyInput) => void,
  notices: readonly StartEditNotice[],
  notation: DateNotation,
  timeNotation: TimeNotation,
): void {
  for (const notification of startEditNotifications(notices, notation, timeNotation)) notify(notification);
}
