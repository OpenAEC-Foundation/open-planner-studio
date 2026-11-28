import type { DateNotation } from '@/types/view';
import { displayDate } from '@/utils/displayDate';
import type { NotifyInput } from './slices/types';
import { BASELINES_PROGRESS_HELP_ARTICLE_ID } from './helpArticles';
import { refusalNotice } from './refusalNotice';

export function statusDateSetTodayNotice(date: string, notation: DateNotation): NotifyInput {
  return {
    severity: 'info',
    messageKey: 'notifications.statusDateSetToday',
    params: { date: displayDate(date, notation) },
    dedupeKey: 'status-date-set-today',
    helpArticleId: BASELINES_PROGRESS_HELP_ARTICLE_ID,
  };
}

export function durationBelowDoneWorkNotice(task: { id: string; name: string; time: { completion: number } }): NotifyInput {
  return refusalNotice({
    messageKey: 'notifications.durationBelowDoneWork',
    params: { name: task.name, percent: Math.round(task.time.completion * 100) },
    dedupeKey: `duration-below-done-work:${task.id}`,
    helpArticleId: BASELINES_PROGRESS_HELP_ARTICLE_ID,
  });
}
