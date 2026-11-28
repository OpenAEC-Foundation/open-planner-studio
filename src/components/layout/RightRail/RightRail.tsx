import { Suspense, lazy, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { inlineDirectionOf, panelWidthAtPointer, useSplitter } from '@/hooks/useSplitter';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { ResourcePanelCompact } from '@/components/panels/ResourcePanelCompact';
import { WarningsPanel } from '@/components/panels/WarningsPanel';
import { ScheduleShiftPanel } from '@/components/panels/ScheduleShiftPanel';
import { HelpButton } from '@/components/common/HelpButton';
import {
  RESOURCE_PANEL_HELP_ARTICLE_ID, SCHEDULE_SHIFT_HELP_ARTICLE_ID, TASK_PROPERTIES_HELP_ARTICLE_ID,
  WARNINGS_HELP_ARTICLE_ID,
} from '@/state/helpArticles';
import {
  RIGHT_PANEL_MIN_WIDTH,
  RAIL_SECTION_MIN_HEIGHT,
  saveRightPanelWidth,
  saveRailPropertiesHeight,
  saveRailWarningsHeight,
} from '@/utils/settingsStore';

const DebugTerminal = lazy(() => import('@/components/panels/DebugTerminal').then(m => ({ default: m.DebugTerminal })));
const AIActivityPanel = lazy(() => import('@/components/panels/AIActivityPanel').then(m => ({ default: m.AIActivityPanel })));

export function RightRail() {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const showPropertiesPanel = useAppStore(s => s.ui.showPropertiesPanel);
  const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
  const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
  const propsHeight = useAppStore(s => s.ui.railPropertiesHeight);
  const showWarningsPanel = useAppStore(s => s.ui.showWarningsPanel);
  const showScheduleShiftPanel = useAppStore(s => s.ui.showScheduleShiftPanel);
  const warningsHeight = useAppStore(s => s.ui.railWarningsHeight);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiActivityOpen = useAppStore(s => s.ui.aiActivityOpen);

  const dockOn = showResourcePanel && resourcePanelDocked;
  const bothOn = showPropertiesPanel && dockOn;
  const bottomOn = showWarningsPanel || showScheduleShiftPanel;
  const stackOn = showPropertiesPanel || dockOn;
  const stackCount = (showPropertiesPanel ? 1 : 0) + (dockOn ? 1 : 0);

  const stackRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const widthSplitter = useSplitter({
    min: RIGHT_PANEL_MIN_WIDTH,
    max: () => Math.round(window.innerWidth * 0.6),
    computeSize: e => Math.round(panelWidthAtPointer(
      e.clientX,
      { left: 0, right: window.innerWidth },
      'inline-end',
      inlineDirectionOf(document.documentElement),
    )),
    onResize: w => useAppStore.getState().setUI({ rightPanelWidth: w }),
    onCommit: () => { void saveRightPanelWidth(useAppStore.getState().ui.rightPanelWidth); },
  });

  const heightSplitter = useSplitter({
    min: RAIL_SECTION_MIN_HEIGHT,
    max: () => {
      const h = stackRef.current?.getBoundingClientRect().height ?? 0;
      return Math.max(RAIL_SECTION_MIN_HEIGHT, Math.round(h - RAIL_SECTION_MIN_HEIGHT));
    },
    computeSize: e => {
      const top = stackRef.current?.getBoundingClientRect().top ?? 0;
      return Math.round(e.clientY - top);
    },
    onResize: h => useAppStore.getState().setUI({ railPropertiesHeight: h }),
    onCommit: () => { void saveRailPropertiesHeight(useAppStore.getState().ui.railPropertiesHeight); },
  });

  const warningsSplitter = useSplitter({
    min: RAIL_SECTION_MIN_HEIGHT,
    max: () => {
      const h = bodyRef.current?.getBoundingClientRect().height ?? 0;
      return Math.max(RAIL_SECTION_MIN_HEIGHT, Math.round(h - RAIL_SECTION_MIN_HEIGHT * Math.max(1, stackCount)));
    },
    computeSize: e => {
      const bottom = bodyRef.current?.getBoundingClientRect().bottom ?? 0;
      return Math.round(bottom - e.clientY);
    },
    onResize: h => useAppStore.getState().setUI({ railWarningsHeight: h }),
    onCommit: () => { void saveRailWarningsHeight(useAppStore.getState().ui.railWarningsHeight); },
  });

  if (rightPanelCollapsed) {
    const onCount = [showPropertiesPanel, dockOn, showWarningsPanel, showScheduleShiftPanel].filter(Boolean).length;
    const label = onCount > 1
      ? tMenu('ribbon.panels')
      : dockOn
        ? t('resource.compact.title')
        : showWarningsPanel ? t('warnings.title') : showScheduleShiftPanel ? t('scheduleShift.title') : t('properties');
    return (
      <button
        onClick={() => setUI({ rightPanelCollapsed: false })}
        title={t('sidebar.expandRail')}
        className="ui-card flex flex-col items-center justify-center gap-2 py-4 hover:bg-surface-hover overflow-hidden"
        style={{ width: 28 }}
        data-ops-rail-strip
      >
        <Icon id="panel.right" size={14} className="text-text-secondary ops-icon-inline-flip" />
        <span
          className="!text-small font-semibold text-text-secondary uppercase tracking-wider"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <div
      className="ui-card flex flex-col overflow-visible"
      style={{ width: rightPanelWidth, minWidth: RIGHT_PANEL_MIN_WIDTH, position: 'relative' }}
      data-tour-anchor="properties-panel"
      data-ops-rail
    >
      <div
        onMouseDown={e => { e.preventDefault(); widthSplitter.start(); }}
        style={{ position: 'absolute', insetInlineStart: -8, top: 0, bottom: 0, width: 16, cursor: 'col-resize', zIndex: 10 }}
        data-ops-right-panel-resize
      />

      <div ref={bodyRef} className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {stackOn && (
      <div ref={stackRef} className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: bottomOn ? `${stackCount * 2}rem` : 0 }}>
        {showPropertiesPanel && (
          <RailPanel
            id="properties"
            title={t('properties')}
            onCollapseRail={() => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            fixedHeight={bothOn ? propsHeight : undefined}
            grow={!bothOn}
            actions={
              <>
              <HelpButton articleId={TASK_PROPERTIES_HELP_ARTICLE_ID} size={14} />
              <button
                onClick={() => setUI({ showPropertiesPanel: false })}
                title={t('sidebar.closeProperties')}
                className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
              >
                <Icon id="ui.close" size={14} />
              </button>
              </>
            }
          >
            <TaskPropertiesPanel />
          </RailPanel>
        )}

        {bothOn && (
          <div
            onMouseDown={e => { e.preventDefault(); heightSplitter.start(); }}
            style={{ height: 0, position: 'relative', zIndex: 10, flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', insetInline: 0, top: -4, height: 8, cursor: 'row-resize' }} data-ops-rail-resize />
          </div>
        )}

        {dockOn && (
          <RailPanel
            id="resources"
            title={t('resource.compact.title')}
            withTopBorder={showPropertiesPanel}
            grow
            onCollapseRail={showPropertiesPanel ? undefined : () => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            actions={
              <>
                <HelpButton articleId={RESOURCE_PANEL_HELP_ARTICLE_ID} size={14} />
                <button
                  onClick={() => setUI({ resourcePanelDocked: false })}
                  title={t('resource.compact.expandFull')}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <Icon id="panel.expand-full" size={13} />
                </button>
                <button
                  onClick={() => setUI({ showResourcePanel: false, resourcePanelDocked: false })}
                  title={t('resource.compact.closeDock')}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <Icon id="ui.close" size={14} />
                </button>
              </>
            }
          >
            <ResourcePanelCompact />
          </RailPanel>
        )}
      </div>
      )}

        {stackOn && bottomOn && (
          <div
            onMouseDown={e => { e.preventDefault(); warningsSplitter.start(); }}
            style={{ height: 0, position: 'relative', zIndex: 10, flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', insetInline: 0, top: -4, height: 8, cursor: 'row-resize' }} data-ops-rail-warnings-resize />
          </div>
        )}

        {bottomOn && (
          <div
            className="flex flex-col overflow-hidden"
            style={stackOn
              ? { flex: '0 1 auto', height: warningsHeight, minHeight: '2rem' }
              : { flex: '1 1 0', minHeight: '2rem' }}
            data-ops-rail-bottom
          >
        {showWarningsPanel && (
          <RailPanel
            id="warnings"
            title={t('warnings.title')}
            withTopBorder={stackOn}
            grow
            onCollapseRail={stackOn ? undefined : () => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            actions={
              <>
              <HelpButton articleId={WARNINGS_HELP_ARTICLE_ID} size={14} />
              <button
                onClick={() => setUI({ showWarningsPanel: false })}
                title={t('warnings.close')}
                className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                data-ops-warnings-close
              >
                <Icon id="ui.close" size={14} />
              </button>
              </>
            }
          >
            <WarningsPanel />
          </RailPanel>
        )}
        {showScheduleShiftPanel && (
          <RailPanel
            id="schedule-shift"
            title={t('scheduleShift.title')}
            withTopBorder={stackOn || showWarningsPanel}
            grow
            onCollapseRail={stackOn || showWarningsPanel ? undefined : () => setUI({ rightPanelCollapsed: true })}
            collapseRailTitle={t('sidebar.collapseRail')}
            actions={
              <>
              <HelpButton articleId={SCHEDULE_SHIFT_HELP_ARTICLE_ID} size={14} />
              <button
                onClick={() => setUI({ showScheduleShiftPanel: false })}
                title={t('scheduleShift.close')}
                className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                data-ops-shift-close
              >
                <Icon id="ui.close" size={14} />
              </button>
              </>
            }
          >
            <ScheduleShiftPanel />
          </RailPanel>
        )}
          </div>
        )}
      </div>

      {debugTerminalEnabled && debugTerminalOpen && (
        <Suspense fallback={null}><DebugTerminal /></Suspense>
      )}
      {aiMode && aiActivityOpen && (
        <Suspense fallback={null}><AIActivityPanel /></Suspense>
      )}
    </div>
  );
}

interface RailPanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onCollapseRail?: () => void;
  collapseRailTitle?: string;
  fixedHeight?: number;
  grow?: boolean;
  withTopBorder?: boolean;
}

function RailPanel({
  id, title, children, actions, onCollapseRail, collapseRailTitle,
  fixedHeight, grow, withTopBorder,
}: RailPanelProps) {
  const HEADER = '2rem';
  const style: React.CSSProperties = grow
    ? { flex: '1 1 0', minHeight: HEADER }
    : { flex: '0 1 auto', height: fixedHeight, minHeight: HEADER };

  return (
    <div
      className={`flex flex-col overflow-hidden${withTopBorder ? ' border-t border-border' : ''}`}
      style={style}
      data-ops-rail-panel={id}
      data-tour-anchor={`rail:${id}`}
    >
      <div className="flex items-center h-8 px-3 border-b border-border flex-shrink-0">
        <span className="flex-1 min-w-0 !text-small font-bold uppercase tracking-wider text-text-secondary truncate">
          {title}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {actions}
          {onCollapseRail && (
            <button
              onClick={onCollapseRail}
              title={collapseRailTitle}
              className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
            >
              <Icon id="panel.right" size={14} className="ops-icon-inline-flip" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
