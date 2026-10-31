import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Terminal, Circle } from 'lucide-react';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { useDisplayDate } from '@/hooks/displayDate';
import { AI_STATUS_COLOR } from '@/components/ribbon/ai/AiServerGroup';
import { isLeafTask } from '@/utils/taskHierarchy';
import { BaselineLegend } from '@/components/canvas/BaselineLegend';
import { calendarClock, momentLabel } from '@/utils/taskDateLabel';

// Past een blok niet meer op de rij, dan schuift het als geheel naar de volgende; alleen een blok dat
// breder is dan de hele balk verdeelt zich over meer rijen.
const STATUS_GROUP = 'flex flex-wrap items-center gap-x-4 min-w-0 empty:hidden';

// Wat bij elke klik, bewerking of opslag komt en gaat, houdt zijn plek ook als het niet zichtbaar is.
// Zo wisselt de balk niet van rij en wordt de Gantt niet hoger of lager tijdens het werk. De plek is
// alleen CSS-inhoud: de tekst staat dan niet in de DOM, dus tutorials en tests zien hem ook niet.
function ReservedStatus({ shown, text, color, title }: { shown: boolean; text: string; color?: string; title?: string }) {
  return shown
    ? <span style={{ color }} title={title}>{text}</span>
    : <span aria-hidden className="invisible before:content-[attr(data-reserve)]" data-reserve={text} />;
}

export function StatusBar() {
  const { t } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  // Alleen de zoom: een abonnement op de hele `view` renderde de balk (en de tellers hieronder over
  // alle taken) opnieuw bij elke scroll.
  const zoom = useAppStore(s => s.view.zoom);
  const isDirty = useAppStore(s => s.isDirty);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiServerStatus = useAppStore(s => s.ui.aiServerStatus);

  const activeRibbonTab = useAppStore(s => s.ui.activeRibbonTab);
  const setUI = useAppStore(s => s.setUI);
  const dd = useDisplayDate();
  const projectCalendar = useAppStore(s => s.calendar);

  const leafCount = useMemo(() => tasks.filter(isLeafTask).length, [tasks]);
  const milestoneCount = useMemo(() => tasks.filter(t => t.isMilestone).length, [tasks]);
  const criticalCount = cpmResult?.criticalPath.length || 0;
  // Elke teller is een ingang naar het Waarschuwingenpaneel met de details.
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
      className="statusbar-button px-1 rounded hover:bg-surface-hover"
      style={{ color: 'var(--theme-warning-text)' }}
      data-ops-status-warning={key}
    >
      ⚠ {label}
    </button>
  );

  // De balk kan meer rijen krijgen; het begeleidingspaneel en de meldingen die erboven zweven rekenen
  // daarom met zijn gemeten hoogte. Zonder balk (presentatiemodus) geldt weer de waarde uit globals.css.
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--statusbar-height', `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--statusbar-height');
    };
  }, []);

  const showStale = scheduleStale && (!autoCalcCPM || !!cpmResult?.error);

  return (
    // Geen `nowrap`: een flex-item gaat eerst als geheel naar de volgende rij en breekt pas als het
    // breder is dan de hele balk. Dat houdt de tekst compleet, ook in een heel smal venster.
    <div
      ref={barRef}
      className="flex flex-wrap items-start bg-surface-alt border-t border-border px-3 !text-body text-text-secondary select-none gap-x-4"
      style={{ lineHeight: 'var(--statusbar-row-height)' }}
      data-tour-anchor="status-bar"
    >
      <div className={STATUS_GROUP}>
        <span>{t('status.tasks')} {leafCount}</span>
        <span>{t('status.milestones')} {milestoneCount}</span>
        {cpmResult && (
          <>
            <span style={{ color: 'var(--theme-critical-text)' }}>{t('status.criticalPath', { count: criticalCount, duration: cpmResult.projectDuration })}</span>
            {/* Een leeg project heeft geen projecteinde (solver geeft dan ''); toon dan geen
                kale "Einde:"-label zonder waarde. */}
            {/* B4: een tijd alleen als het einde midden op de werkdag van de projectkalender valt. */}
            {cpmResult.projectEnd && <span>{t('status.end')} {dd.dateTime(momentLabel(calendarClock(projectCalendar), cpmResult.projectEnd, 'end'))}</span>}
          </>
        )}
      </div>
      <div className={STATUS_GROUP}>
        {cpmResult && (
          <>
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
        {(showStale || !autoCalcCPM) && (
          <ReservedStatus shown={showStale} text={`⚠ ${t('status.scheduleStale')}`} color="var(--theme-warning-text)" title={tCommon('resource.histogram.staleHint')} />
        )}
      </div>
      <div className={`${STATUS_GROUP} justify-end ms-auto`}>
        <ReservedStatus shown={selectedTaskIds.length > 0} text={t('status.selection', { count: selectedTaskIds.length || 99 })} />
        <ReservedStatus shown={isDirty} text={t('status.unsaved')} color="var(--theme-warning-text)" />
        <BaselineLegend />
        {/* Afgeleid uit zoom — kan niet desyncen van de getekende as. */}
        <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.scale')} {t(`ribbon.${scaleFromZoom(zoom)}`)}</span>
        <span style={{ color: 'var(--theme-text-muted)' }}>{t('status.zoom', { level: Math.round(zoom) })}</span>
        {aiMode && (
          <button
            onClick={() => setUI({ activeRibbonTab: 'ai' })}
            title={tCommon('ai.statusDot', { status: tCommon(`ai.status${aiServerStatus.state === 'live' ? 'Live' : aiServerStatus.state === 'port-busy' ? 'PortBusy' : aiServerStatus.state === 'error' ? 'Error' : 'Off'}`, { port: aiServerStatus.port }) })}
            className="statusbar-button flex items-center gap-1 px-1.5 rounded hover:bg-surface-hover text-text-secondary"
          >
            <Circle size={10} fill={AI_STATUS_COLOR[aiServerStatus.state]} color={AI_STATUS_COLOR[aiServerStatus.state]} />
            <span>MCP</span>
          </button>
        )}
        {debugTerminalEnabled && (
          <button
            onClick={() => setUI({ debugTerminalOpen: !debugTerminalOpen })}
            title={debugTerminalOpen ? tCommon('debugTerminal.hide') : tCommon('debugTerminal.show')}
            className={`statusbar-button flex items-center gap-1 px-1.5 rounded hover:bg-surface-hover ${debugTerminalOpen ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            <Terminal size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
