import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'lucide-react';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { useDisplayDate } from '@/utils/displayDate';

export function StatusBar() {
  const { t } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const view = useAppStore(s => s.view);
  const isDirty = useAppStore(s => s.isDirty);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const setUI = useAppStore(s => s.setUI);
  const dd = useDisplayDate();

  const leafTasks = tasks.filter(t => t.childIds.length === 0);
  const milestones = tasks.filter(t => t.isMilestone);
  const criticalCount = cpmResult?.criticalPath.length || 0;

  return (
    <div
      className="flex items-center bg-surface-alt border-t border-border px-3 text-[11px] text-text-secondary select-none gap-4"
      style={{ height: 'var(--statusbar-height)' }}
    >
      <span>{t('status.tasks')} {leafTasks.length}</span>
      <span>{t('status.milestones')} {milestones.length}</span>
      {cpmResult && (
        <>
          <span style={{ color: 'var(--theme-critical-text)' }}>{t('status.criticalPath', { count: criticalCount, duration: cpmResult.projectDuration })}</span>
          <span>{t('status.end')} {dd.date(cpmResult.projectEnd)}</span>
          {(cpmResult.missedDeadlineTaskIds?.length ?? 0) > 0 && (
            <span style={{ color: 'var(--theme-warning-text)' }}>
              ⚠ {tCommon('statusWarnings.missedDeadlines', { count: cpmResult.missedDeadlineTaskIds.length })}
            </span>
          )}
          {(cpmResult.violatedConstraintTaskIds?.length ?? 0) > 0 && (
            <span style={{ color: 'var(--theme-warning-text)' }}>
              ⚠ {tCommon('statusWarnings.violatedConstraints', { count: cpmResult.violatedConstraintTaskIds.length })}
            </span>
          )}
          {(cpmResult.outOfSequenceSequenceIds?.length ?? 0) > 0 && (
            <span
              style={{ color: 'var(--theme-warning-text)' }}
              title={tCommon('statusWarnings.outOfSequence', { count: cpmResult.outOfSequenceSequenceIds.length })}
            >
              ⚠ {tCommon('statusWarnings.outOfSequence', { count: cpmResult.outOfSequenceSequenceIds.length })}
            </span>
          )}
        </>
      )}
      {scheduleStale && (
        <span style={{ color: 'var(--theme-warning-text)' }} title={tCommon('resource.histogram.staleHint')}>
          ⚠ {t('status.scheduleStale')}
        </span>
      )}
      {selectedTaskIds.length > 0 && (
        <span>{t('status.selection', { count: selectedTaskIds.length })}</span>
      )}
      <div className="flex-1" />
      {/* Afgeleid uit zoom (fase 2.7, §3.5) — kan niet desyncen van de getekende as. */}
      <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.scale')} {t(`ribbon.${scaleFromZoom(view.zoom)}`)}</span>
      <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.zoom', { level: Math.round(view.zoom) })}</span>
      {isDirty && <span style={{ color: 'var(--theme-warning-text)' }}>{t('status.unsaved')}</span>}
      {debugTerminalEnabled && (
        <button
          onClick={() => setUI({ debugTerminalOpen: !debugTerminalOpen })}
          title={debugTerminalOpen ? tCommon('debugTerminal.hide') : tCommon('debugTerminal.show')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover ${debugTerminalOpen ? 'text-text-primary' : 'text-text-secondary'}`}
        >
          <Terminal size={12} />
        </button>
      )}
    </div>
  );
}
