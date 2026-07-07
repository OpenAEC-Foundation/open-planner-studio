import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/utils/displayDate';

/**
 * CPM-resultaat (readonly: ES/EF/LS/LF/TF/FF/interfering float/kritiek) — sectie 8 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful (spec-classificatie): puur
 * lezend, geen `onChange`-contract nodig — identiek in paneel én dialoog.
 */
export function TaskCpmResultSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  const task = useAppStore(s => s.tasks.find(t => t.id === taskId));
  if (!task || task.time.isCritical === undefined) return null;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.cpmResult')}</span>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <span className="text-text-secondary">{t('properties.earlyStart')}</span>
        <span>{dd.date(task.time.earlyStart)}</span>
        <span className="text-text-secondary">{t('properties.earlyFinish')}</span>
        <span>{dd.date(task.time.earlyFinish)}</span>
        <span className="text-text-secondary">{t('properties.lateStart')}</span>
        <span>{dd.date(task.time.lateStart)}</span>
        <span className="text-text-secondary">{t('properties.lateFinish')}</span>
        <span>{dd.date(task.time.lateFinish)}</span>
        <span className="text-text-secondary">{t('properties.totalFloat')}</span>
        <span>{task.time.totalFloat} {tCommon('daysLong')}</span>
        <span className="text-text-secondary">{t('properties.freeFloat')}</span>
        <span>{task.time.freeFloat} {tCommon('daysLong')}</span>
        {task.time.interferingFloat !== undefined && (
          <>
            <span className="text-text-secondary">{t('properties.interferingFloat')}</span>
            <span>{task.time.interferingFloat} {tCommon('daysLong')}</span>
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
