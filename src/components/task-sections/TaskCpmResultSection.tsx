import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { formatWorkDaysText } from '@/utils/taskDuration';

/**
 * CPM-resultaat (readonly: ES/EF/LS/LF/TF/FF/interfering float/kritiek) — sectie 8 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful (spec-classificatie): puur
 * lezend, geen `onChange`-contract nodig — identiek in paneel én dialoog.
 */
export function TaskCpmResultSection({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  const task = useAppStore(s => s.tasks.find(t => t.id === taskId));
  if (!task || task.time.isCritical === undefined) return null;
  // Speling in werkdagen, fractioneel in urenmodus: één opmaak voor totale, vrije en interfererende
  // speling (twee decimalen, decimaalteken van de taal) — dezelfde als raster en tooltip. Hier stond
  // TS onafgerond ("1.6666666666666667") naast een afgeronde VS ("2").
  const days = (value: number) => formatWorkDaysText(value, {
    locale: i18n.language,
    suffixes: { day: ` ${tCommon('daysLong')}`, hour: 'h', minute: 'm' },
  });

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.cpmResult')}</span>
      <div className="grid grid-cols-2 gap-1 !text-small">
        <span className="text-text-secondary">{t('properties.earlyStart')}</span>
        <span>{dd.date(task.time.earlyStart)}</span>
        <span className="text-text-secondary">{t('properties.earlyFinish')}</span>
        <span>{dd.date(task.time.earlyFinish)}</span>
        <span className="text-text-secondary">{t('properties.lateStart')}</span>
        <span>{dd.date(task.time.lateStart)}</span>
        <span className="text-text-secondary">{t('properties.lateFinish')}</span>
        <span>{dd.date(task.time.lateFinish)}</span>
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
