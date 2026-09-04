import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Terminal, Circle } from 'lucide-react';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { useDisplayDate } from '@/hooks/displayDate';
import { AI_STATUS_COLOR } from '@/components/ribbon/ai/AiServerGroup';

export function StatusBar() {
  const { t } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const view = useAppStore(s => s.view);
  const isDirty = useAppStore(s => s.isDirty);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiServerStatus = useAppStore(s => s.ui.aiServerStatus);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const activeRibbonTab = useAppStore(s => s.ui.activeRibbonTab);
  const setUI = useAppStore(s => s.setUI);
  const dd = useDisplayDate();

  const leafTasks = tasks.filter(t => t.childIds.length === 0);
  const milestones = tasks.filter(t => t.isMilestone);
  const criticalCount = cpmResult?.criticalPath.length || 0;
  // Issue #53: elke teller is een ingang naar het Waarschuwingenpaneel met de details.
  const overallocatedCount = resourceLoadResult
    ? Object.values(resourceLoadResult.overallocatedDays).filter(days => days.length > 0).length
    : 0;
  // Op de IFC- en Rapport-werkruimte bestaat de rail niet (App.tsx rendert 'm daar niet), dus
  // alleen de vlag zetten zou een dode klik zijn; spring dan mee naar de Gantt-werkruimte.
  const openWarnings = () => setUI({
    showWarningsPanel: true,
    ...(activeRibbonTab === 'ifc' || activeRibbonTab === 'report' ? { activeRibbonTab: 'start' as const } : {}),
  });
  const warningButton = (key: string, label: string) => (
    <button
      key={key}
      onClick={openWarnings}
      title={tCommon('warnings.openPanel')}
      className="px-1 rounded hover:bg-surface-hover"
      style={{ color: 'var(--theme-warning-text)' }}
      data-ops-status-warning={key}
    >
      ⚠ {label}
    </button>
  );

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
          {/* Een leeg project heeft geen projecteinde (solver geeft dan ''); toon dan geen
              kale "Einde:"-label zonder waarde. */}
          {cpmResult.projectEnd && <span>{t('status.end')} {dd.date(cpmResult.projectEnd)}</span>}
          {(cpmResult.missedDeadlineTaskIds?.length ?? 0) > 0 && warningButton(
            'missedDeadlines',
            tCommon('statusWarnings.missedDeadlines', { count: cpmResult.missedDeadlineTaskIds.length }),
          )}
          {(cpmResult.violatedConstraintTaskIds?.length ?? 0) > 0 && warningButton(
            'violatedConstraints',
            tCommon('statusWarnings.violatedConstraints', { count: cpmResult.violatedConstraintTaskIds.length }),
          )}
          {(cpmResult.outOfSequenceSequenceIds?.length ?? 0) > 0 && warningButton(
            'outOfSequence',
            tCommon('statusWarnings.outOfSequence', { count: cpmResult.outOfSequenceSequenceIds.length }),
          )}
          {overallocatedCount > 0 && warningButton(
            'overallocated',
            tCommon('statusWarnings.overallocated', { count: overallocatedCount }),
          )}
        </>
      )}
      {/* Bij auto-calc is een verse stale-vlag alleen de korte wachttijd tot de geplande solve.
          Een fout houdt de vlag juist vast en blijft daarom zichtbaar. */}
      {scheduleStale && (!autoCalcCPM || !!cpmResult?.error) && (
        <span style={{ color: 'var(--theme-warning-text)' }} title={tCommon('resource.histogram.staleHint')}>
          ⚠ {t('status.scheduleStale')}
        </span>
      )}
      {selectedTaskIds.length > 0 && (
        <span>{t('status.selection', { count: selectedTaskIds.length })}</span>
      )}
      <div className="flex-1" />
      {/* Afgeleid uit zoom (fase 2.7, §3.5) — kan niet desyncen van de getekende as. */}
      <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.scale')} {t(`ribbon.${scaleFromZoom(view.zoom, enableHourPlanning)}`)}</span>
      <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.zoom', { level: Math.round(view.zoom) })}</span>
      {isDirty && <span style={{ color: 'var(--theme-warning-text)' }}>{t('status.unsaved')}</span>}
      {aiMode && (
        <button
          onClick={() => setUI({ activeRibbonTab: 'ai' })}
          title={tCommon('ai.statusDot', { status: tCommon(`ai.status${aiServerStatus.state === 'live' ? 'Live' : aiServerStatus.state === 'port-busy' ? 'PortBusy' : aiServerStatus.state === 'error' ? 'Error' : 'Off'}`, { port: aiServerStatus.port }) })}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover text-text-secondary"
        >
          <Circle size={10} fill={AI_STATUS_COLOR[aiServerStatus.state]} color={AI_STATUS_COLOR[aiServerStatus.state]} />
          <span>AI</span>
        </button>
      )}
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
