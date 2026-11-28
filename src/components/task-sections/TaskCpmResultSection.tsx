import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useTaskDateText } from '@/hooks/displayDate';
import { formatWorkDaysText } from '@/utils/taskDuration';
import { formatReportNumber } from '@/utils/reportNumber';

export function TaskCpmResultSection({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const taskDate = useTaskDateText();
  const task = useAppStore(s => s.tasks.find(t => t.id === taskId));
  if (!task || task.time.isCritical === undefined) return null;
  const days = (value: number) => formatWorkDaysText(value, {
    locale: i18n.language,
    suffixes: { day: ` ${tCommon('dayUnitLong', { count: Number(formatReportNumber(value, 'en')) })}`, hour: 'h', minute: 'm' },
  });

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.cpmResult')}</span>
      <div className="grid grid-cols-2 gap-1 !text-small">
        <span className="text-text-secondary">{t('properties.earlyStart')}</span>
        <span>{taskDate(task, task.time.earlyStart, 'start')}</span>
        <span className="text-text-secondary">{t('properties.earlyFinish')}</span>
        <span>{taskDate(task, task.time.earlyFinish, 'end')}</span>
        <span className="text-text-secondary">{t('properties.lateStart')}</span>
        <span>{taskDate(task, task.time.lateStart, 'start')}</span>
        <span className="text-text-secondary">{t('properties.lateFinish')}</span>
        <span>{taskDate(task, task.time.lateFinish, 'end')}</span>
        <span className="text-text-secondary">{t('properties.totalFloat')}</span>
        <span>{days(task.time.totalFloat)}</span>
        <span className="text-text-secondary">{t('properties.freeFloat')}</span>
        <span>{days(task.time.freeFloat)}</span>
        {task.time.interferingFloat !== undefined && (
          <>
            <span className="text-text-secondary">{t('properties.interferingFloat')}</span>
            <span>{days(task.time.interferingFloat)}</span>
          </>
        )}
        <span className="text-text-secondary">{t('properties.criticalPath')}</span>
        <span className={task.time.isCritical ? 'text-critical font-bold' : ''}>
          {task.time.isCritical ? tCommon('yes') : tCommon('no')}
        </span>
      </div>
    </>
  );
}
