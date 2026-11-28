import type { RecomputedRemainingWork } from '@/engine/work/workRuleApply';
import type { NotifyInput } from './slices/types';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';

const READ_TIME_MS = 10_000;

export function remainingWorkRecomputedNotice(
  items: readonly RecomputedRemainingWork[],
  opts?: { dedupeKey?: string },
): NotifyInput | null {
  if (items.length === 0) return null;
  const dedupe = opts?.dedupeKey ? { dedupeKey: opts.dedupeKey, replaceOnDedupe: true } : {};
  const byTask = new Map<string, { name: string; before: number; after: number }>();
  for (const item of items) {
    const sum = byTask.get(item.taskId) ?? { name: item.taskName, before: 0, after: 0 };
    sum.before += item.beforeMinutes;
    sum.after += item.afterMinutes;
    byTask.set(item.taskId, sum);
  }
  if (byTask.size === 1) {
    const [only] = byTask.values();
    return {
      severity: 'info',
      messageKey: 'notifications.remainingWorkRecomputed',
      params: { name: only.name },
      numberParams: { before: only.before / 60, after: only.after / 60 },
      helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
      durationMs: READ_TIME_MS,
      ...dedupe,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.remainingWorkRecomputedMany',
    params: { count: byTask.size },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
    durationMs: READ_TIME_MS,
    ...dedupe,
  };
}

export function mergeStepRecomputedWork(
  carried: readonly RecomputedRemainingWork[],
  fresh: readonly RecomputedRemainingWork[],
  currentWork: (assignmentId: string) => number | undefined,
): { items: RecomputedRemainingWork[]; notify: RecomputedRemainingWork[] } {
  let changed = fresh.length > 0;
  const items = carried.map((item) => {
    const now = currentWork(item.assignmentId);
    if (now === undefined || Math.abs(now - item.afterMinutes) <= 1e-6) return item;
    changed = true;
    return { ...item, afterMinutes: now };
  });
  for (const f of fresh) {
    const i = items.findIndex((x) => x.assignmentId === f.assignmentId);
    if (i >= 0) items[i] = { ...items[i], afterMinutes: f.afterMinutes };
    else items.push(f);
  }
  const notify = changed ? items.filter((x) => Math.abs(x.afterMinutes - x.beforeMinutes) > 1e-6) : [];
  return { items, notify };
}
