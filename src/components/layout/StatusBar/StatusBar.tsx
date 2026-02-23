import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';

export function StatusBar() {
  const { t } = useTranslation('menu');
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const view = useAppStore(s => s.view);
  const isDirty = useAppStore(s => s.isDirty);

  const leafTasks = tasks.filter(t => t.childIds.length === 0);
  const milestones = tasks.filter(t => t.isMilestone);
  const criticalCount = cpmResult?.criticalPath.length || 0;

  return (
    <div className="flex items-center h-7 bg-surface-alt border-t border-border px-3 text-[11px] text-text-secondary select-none gap-4">
      <span>{t('status.tasks')} {leafTasks.length}</span>
      <span>{t('status.milestones')} {milestones.length}</span>
      {cpmResult && (
        <>
          <span className="text-critical">{t('status.criticalPath', { count: criticalCount, duration: cpmResult.projectDuration })}</span>
          <span>{t('status.end')} {cpmResult.projectEnd}</span>
        </>
      )}
      {selectedTaskIds.length > 0 && (
        <span>{t('status.selection', { count: selectedTaskIds.length })}</span>
      )}
      <div className="flex-1" />
      <span>{t('status.scale')} {view.timeScale}</span>
      <span>{t('status.zoom', { level: Math.round(view.zoom) })}</span>
      {isDirty && <span className="text-yellow-500">{t('status.unsaved')}</span>}
    </div>
  );
}
