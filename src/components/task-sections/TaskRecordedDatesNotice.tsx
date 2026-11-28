import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { recordedNoticeState, recordedTaskWillShift, unrecordedAxes } from '@/state/recordedDatesSelectors';
import { recordedDatesTaskMissingKey, recordedDatesTaskShownKey } from '@/components/layout/recordedDatesNoticeText';
import { RECORDED_DATES_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { RecordedTaskAxis } from '@/types/taskGrid';

const AXIS_COLUMN_KEY: Record<RecordedTaskAxis, 'taskGrid.columns.lateStart' | 'taskGrid.columns.lateFinish' | 'taskGrid.columns.totalFloat' | 'taskGrid.columns.freeFloat'> = {
  ls: 'taskGrid.columns.lateStart',
  lf: 'taskGrid.columns.lateFinish',
  tf: 'taskGrid.columns.totalFloat',
  ff: 'taskGrid.columns.freeFloat',
};

export function TaskRecordedDatesNotice({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const recordedDates = useAppStore(s => s.recordedDates);
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  const openHelpArticle = useAppStore(s => s.openHelpArticle);

  if (!task) return null;
  const state = recordedNoticeState(recordedDates, datesAsRecorded, task);
  if (!state) return null;
  const origin = recordedDates?.origin;

  const sentences: string[] = [t(recordedDatesTaskShownKey(origin))];
  const willShift = recordedTaskWillShift(recordedDates, datesAsRecorded, task.id);
  if (willShift !== undefined) {
    sentences.push(willShift ? t('properties.recordedDatesWillShift') : t('properties.recordedDatesWillStay'));
  }
  const missing = state === 'partly-unrecorded';
  if (missing) {
    const fields = unrecordedAxes(recordedDates?.times[task.id]).map(axis => t(AXIS_COLUMN_KEY[axis])).join(', ');
    sentences.push(t(recordedDatesTaskMissingKey(origin), { fields }));
  }

  return (
    <div
      className="alert alert--info flex flex-col items-start gap-1 break-words"
      data-ops-task-recorded-dates="active"
      data-ops-task-recorded-dates-missing={missing ? '' : undefined}
    >
      {sentences.map((sentence, i) => <span key={i} data-ops-task-recorded-dates-sentence={i}>{sentence}</span>)}
      <button
        type="button"
        className="ops-textlink !text-body"
        onClick={() => openHelpArticle(RECORDED_DATES_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
