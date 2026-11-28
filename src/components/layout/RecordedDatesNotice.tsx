import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { NoticeStrip } from './NoticeStrip';
import { recordedDatesActiveKey } from './recordedDatesNoticeText';

export function RecordedDatesNotice() {
  const { t } = useTranslation('common');
  const recordedDates = useAppStore((s) => s.recordedDates);
  const datesAsRecorded = useAppStore((s) => s.datesAsRecorded);
  const recalculate = useAppStore((s) => s.recalculate);

  if (!datesAsRecorded) return null;

  return (
    <NoticeStrip
      icon="status.recorded-dates"
      text={recordedDates && recordedDates.shifted !== undefined
        ? t(recordedDatesActiveKey(recordedDates.origin), { count: recordedDates.shifted })
        : t('recordedDates.active')}
      actionLabel={t('recordedDates.recalculate')}
      onAction={() => recalculate()}
      role="status"
      stripProps={{ 'data-ops-recorded-dates-active': true }}
      actionProps={{ 'data-ops-recorded-dates-recalculate': true }}
    />
  );
}
