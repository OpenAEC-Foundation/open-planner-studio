import { useMemo, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Terminal, Circle, Ellipsis } from 'lucide-react';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { useDisplayDate } from '@/hooks/displayDate';
import { AI_STATUS_COLOR } from '@/components/ribbon/ai/AiServerGroup';
import { isLeafTask } from '@/utils/taskHierarchy';
import { BaselineLegend, useBaselineLegendLayers } from '@/components/canvas/BaselineLegend';
import { calendarClock, momentLabel } from '@/utils/taskDateLabel';
import { useStatusFold } from './useStatusFold';

// De balk is altijd één rij. Past niet alles, dan valt dit samen, in deze volgorde: eerst wat de
// planner elders ook ziet, als laatste wat om actie vraagt. Wat weg is, staat in de tooltip van de
// ⋯-knop; de waarschuwingen staan onder hun kopje, dat altijd blijft.
const FOLD_ORDER = [
  'view', // Schaal en Zoom: staan ook op de tijdas.
  'baselineNames', // De kleuren blijven; de namen staan in hun tooltip.
  'warnings', // Eén kopje dat het Waarschuwingenpaneel opent.
  'counts', // Taken en Mijlpalen.
  'critical',
  'selection', // Ook zichtbaar in de Gantt en de tabel.
  'end',
  'unsaved', // Staat ook in de titelbalk en op het tabblad.
  'stale',
] as const;

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

  const barRef = useRef<HTMLDivElement>(null);
  const baselineLayers = useBaselineLegendLayers();

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
  const warnings = cpmResult ? [
    { key: 'missedDeadlines', count: cpmResult.missedDeadlineTaskIds?.length ?? 0 },
    { key: 'violatedConstraints', count: cpmResult.violatedConstraintTaskIds?.length ?? 0 },
    { key: 'outOfSequence', count: cpmResult.outOfSequenceSequenceIds?.length ?? 0 },
    { key: 'overallocated', count: overallocatedCount },
  ] as const : [];
  const activeWarnings = warnings.filter(w => w.count > 0).map(w => ({
    ...w,
    label: tCommon(`statusWarnings.${w.key}`, { count: w.count }),
  }));
  const warningTotal = activeWarnings.reduce((sum, w) => sum + w.count, 0);
  const warningButton = (key: string, label: string, title: string) => (
    <button
      key={key}
      onClick={openWarnings}
      title={title}
      className="px-1 rounded hover:bg-surface-hover"
      style={{ color: 'var(--theme-warning-text)' }}
      data-ops-status-warning={key}
    >
      ⚠ {label}
    </button>
  );

  const tasksText = `${t('status.tasks')} ${leafCount}`;
  const milestonesText = `${t('status.milestones')} ${milestoneCount}`;
  const criticalText = cpmResult ? t('status.criticalPath', { count: criticalCount, duration: cpmResult.projectDuration }) : '';
  // Een leeg project heeft geen projecteinde (solver geeft dan ''); toon dan geen kale "Einde:"-label
  // zonder waarde. B4: een tijd alleen als het einde midden op de werkdag van de projectkalender valt.
  const endText = cpmResult?.projectEnd ? `${t('status.end')} ${dd.dateTime(momentLabel(calendarClock(projectCalendar), cpmResult.projectEnd, 'end'))}` : '';
  // Bij auto-calc is een verse stale-vlag alleen de korte wachttijd tot de geplande solve.
  // Een fout houdt de vlag juist vast en blijft daarom zichtbaar.
  const staleText = scheduleStale && (!autoCalcCPM || !!cpmResult?.error) ? `⚠ ${t('status.scheduleStale')}` : '';
  const selectionText = selectedTaskIds.length > 0 ? t('status.selection', { count: selectedTaskIds.length }) : '';
  // Afgeleid uit zoom — kan niet desyncen van de getekende as.
  const scaleText = `${t('status.scale')} ${t(`ribbon.${scaleFromZoom(zoom)}`)}`;
  const zoomText = t('status.zoom', { level: Math.round(zoom) });
  const unsavedText = isDirty ? t('status.unsaved') : '';
  const baselineNames = baselineLayers.map(l => l.name);

  // De zoomtekst telt hier niet mee: die tikt mee met elk wieltje. Groeit hij, dan vangt de
  // overloopmeting dat op.
  const level = useStatusFold(barRef, FOLD_ORDER.length, [
    tasksText, milestonesText, criticalText, endText, staleText, selectionText, scaleText, unsavedText,
    ...baselineNames, ...activeWarnings.map(w => w.label), aiMode, debugTerminalEnabled,
  ].join('|'));
  const folded = (part: typeof FOLD_ORDER[number]) => FOLD_ORDER.indexOf(part) < level;

  const hiddenTexts = [
    ...(folded('counts') ? [tasksText, milestonesText] : []),
    ...(folded('critical') ? [criticalText] : []),
    ...(folded('end') ? [endText] : []),
    ...(folded('stale') ? [staleText] : []),
    ...(folded('selection') ? [selectionText] : []),
    ...(folded('baselineNames') ? baselineNames : []),
    ...(folded('view') ? [scaleText, zoomText] : []),
    ...(folded('unsaved') ? [unsavedText] : []),
  ].filter(text => text !== '');

  return (
    <div
      ref={barRef}
      className="flex items-center overflow-hidden whitespace-nowrap bg-surface-alt border-t border-border px-3 !text-body text-text-secondary select-none gap-4"
      style={{ height: 'var(--statusbar-height)' }}
      data-tour-anchor="status-bar"
    >
      {!folded('counts') && <span>{tasksText}</span>}
      {!folded('counts') && <span>{milestonesText}</span>}
      {criticalText && !folded('critical') && <span style={{ color: 'var(--theme-critical-text)' }}>{criticalText}</span>}
      {endText && !folded('end') && <span>{endText}</span>}
      {folded('warnings') && warningTotal > 0
        ? warningButton(
          'summary',
          tCommon('statusWarnings.summary', { count: warningTotal }),
          [...activeWarnings.map(w => w.label), tCommon('warnings.openPanel')].join('\n'),
        )
        : activeWarnings.map(w => warningButton(w.key, w.label, tCommon('warnings.openPanel')))}
      {staleText && !folded('stale') && (
        <span style={{ color: 'var(--theme-warning-text)' }} title={tCommon('resource.histogram.staleHint')}>{staleText}</span>
      )}
      {selectionText && !folded('selection') && <span>{selectionText}</span>}
      <div className="flex-1" />
      <BaselineLegend layers={baselineLayers} namesHidden={folded('baselineNames')} />
      {!folded('view') && <span style={{ color: 'var(--theme-text-muted)' }}>{scaleText}</span>}
      {!folded('view') && <span style={{ color: 'var(--theme-text-muted)' }}>{zoomText}</span>}
      {unsavedText && !folded('unsaved') && <span style={{ color: 'var(--theme-warning-text)' }}>{unsavedText}</span>}
      {hiddenTexts.length > 0 && (
        <button
          type="button"
          aria-label={hiddenTexts.join(', ')}
          title={hiddenTexts.join('\n')}
          data-tooltip-instant="true"
          data-ops-status-more
          className="flex items-center px-1.5 py-0.5 rounded hover:bg-surface-hover"
        >
          <Ellipsis size={14} aria-hidden="true" />
        </button>
      )}
      {aiMode && (
        <button
          onClick={() => setUI({ activeRibbonTab: 'ai' })}
          title={tCommon('ai.statusDot', { status: tCommon(`ai.status${aiServerStatus.state === 'live' ? 'Live' : aiServerStatus.state === 'port-busy' ? 'PortBusy' : aiServerStatus.state === 'error' ? 'Error' : 'Off'}`, { port: aiServerStatus.port }) })}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover text-text-secondary"
        >
          <Circle size={10} fill={AI_STATUS_COLOR[aiServerStatus.state]} color={AI_STATUS_COLOR[aiServerStatus.state]} />
          <span>MCP</span>
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
