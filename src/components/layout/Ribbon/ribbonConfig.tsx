import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { COMMANDS } from '@/state/commands';
import { useCommandBinding } from './useCommandBinding';
import { addTaskNearSelection } from '@/state/taskInsertActions';
import { isTreeMode } from '@/engine/view/visibleRows';
import { hasLevelingOutput } from '@/utils/taskDefaults';
import { isGanttWorkspaceVisible } from '@/state/ganttVisibility';
import type { RibbonTab, UIState } from '@/state/slices/types';
import { BaselineOverlaySplitButton } from './BaselineOverlaySplitButton';
import { applySetting } from '@/components/settings/applySetting';
import { saveShowBarDates } from '@/utils/settingsStore';
import {
  BaselinesProgressGroupContent, MilestoneDropdown, RelationDropdown, TemplatesDropdown, RecentFilesDropdown,
  ScreenColorsPopoverButton,
  ExportDropdown, ResourceAssignDropdown, LayoutGroupContent, PresentationGroupContent,
  TimeScaleGroupContent, DisplayGroupContent, OverallocationIndicator, IfcInfo,
  useColumnsButtonBinding,
} from './ribbonWidgets';
import { AiServerGroup } from '@/components/ribbon/ai/AiServerGroup';
import { AiConnectionGroup } from '@/components/ribbon/ai/AiConnectionGroup';
import { AiSafetyGroup } from '@/components/ribbon/ai/AiSafetyGroup';
import { AiActivityGroup } from '@/components/ribbon/ai/AiActivityGroup';

export type NsKey = `${'menu' | 'common' | 'task' | 'report'}:${string}`;

export interface RibbonButtonBinding {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
}

export interface RibbonButtonSpec {
  kind: 'button' | 'small';
  id: string;
  icon: ReactNode;
  labelKey: NsKey;
  primary?: boolean;
  danger?: boolean;
  form?: string;
  use?: () => RibbonButtonBinding;
}

export interface RibbonStackSpec {
  kind: 'stack';
  id: string;
  items: (RibbonButtonSpec | RibbonComponentSpec)[];
}

export interface RibbonComponentSpec {
  kind: 'component';
  id: string;
  Component: React.ComponentType;
}

export type RibbonItemSpec = RibbonButtonSpec | RibbonStackSpec | RibbonComponentSpec;

export interface RibbonGroupSpec {
  id: string;
  labelKey: NsKey;
  items: RibbonItemSpec[];
  useVisible?: () => boolean;
}

export type RibbonTabConfig = RibbonGroupSpec[];

function uiAction(patch: Partial<UIState>): () => RibbonButtonBinding {
  return function useUiAction() {
    const setUI = useAppStore(s => s.setUI);
    return { onClick: () => setUI({ ...patch }) };
  };
}

const calcButton: RibbonButtonSpec = {
  kind: 'button', id: 'calc', icon: <Icon id="solver.run" size={24} />, labelKey: 'menu:ribbon.calculate', primary: true,
  use: () => {
    const recalculate = useAppStore(s => s.recalculate);
    return { onClick: () => recalculate() };
  },
};

const addTaskButton: RibbonButtonSpec = {
  kind: 'button', id: 'addTask', icon: <Icon id="task.add" size={24} />, labelKey: 'menu:ribbon.task',
  use: () => {
    const { t } = useTranslation('task');
    const { t: tMenu } = useTranslation('menu');
    const hasSelection = useAppStore(s => s.selectedTaskIds.length > 0);
    const treeMode = useAppStore(s => isTreeMode(s.view));
    return {
      title: hasSelection && treeMode ? tMenu('ribbon.taskHintBelow') : tMenu('ribbon.taskHintAppend'),
      onClick: () => addTaskNearSelection({ name: t('defaultTask') }),
    };
  },
};

const relationDropdownItem: RibbonComponentSpec = {
  kind: 'component', id: 'relation', Component: RelationDropdown,
};

const splitTaskButton: RibbonButtonSpec = {
  kind: 'button', id: 'splitTask', icon: <Icon id="task.split-mode" size={24} />, labelKey: 'menu:ribbon.splitTask',
  use: () => {
    const { t } = useTranslation('menu');
    const splitMode = useAppStore(s => s.ui.showSplitMode);
    const ganttVisible = useAppStore(s => isGanttWorkspaceVisible(s.ui));
    const setUI = useAppStore(s => s.setUI);
    return {
      active: splitMode,
      disabled: !ganttVisible,
      title: !ganttVisible ? t('ribbon.ganttOnlyHint')
        : t(splitMode ? 'ribbon.splitTaskOffHint' : 'ribbon.splitTaskOnHint'),
      onClick: () => setUI({ showSplitMode: !splitMode }),
    };
  },
};

const calendarButton: RibbonButtonSpec = {
  kind: 'button', id: 'calendar', icon: <Icon id="calendar.manage" size={24} />, labelKey: 'menu:ribbon.calendar',
  use: uiAction({ showCalendarDialog: true }),
};

const tasksGroup: RibbonGroupSpec = {
  id: 'tasks', labelKey: 'menu:ribbon.tasks',
  items: [
    addTaskButton,
    { kind: 'component', id: 'milestone', Component: MilestoneDropdown },
    relationDropdownItem,
    splitTaskButton,
  ],
};

const traceGroup: RibbonGroupSpec = {
  id: 'trace', labelKey: 'menu:ribbon.trace',
  items: [
    {
      kind: 'button', id: 'tracePred', icon: <Icon id="planning.trace-predecessors" size={24} />, labelKey: 'menu:ribbon.tracePredecessors',
      use: () => {
        const traceMode = useAppStore(s => s.ui.traceMode);
        const setUI = useAppStore(s => s.setUI);
        return {
          active: traceMode === 'predecessors' || traceMode === 'both',
          onClick: () => setUI({
            traceMode:
              traceMode === 'off' ? 'predecessors'
              : traceMode === 'predecessors' ? 'off'
              : traceMode === 'successors' ? 'both'
              : 'successors',
          }),
        };
      },
    },
    {
      kind: 'button', id: 'traceSucc', icon: <Icon id="planning.trace-successors" size={24} />, labelKey: 'menu:ribbon.traceSuccessors',
      use: () => {
        const traceMode = useAppStore(s => s.ui.traceMode);
        const setUI = useAppStore(s => s.setUI);
        return {
          active: traceMode === 'successors' || traceMode === 'both',
          onClick: () => setUI({
            traceMode:
              traceMode === 'off' ? 'successors'
              : traceMode === 'successors' ? 'off'
              : traceMode === 'predecessors' ? 'both'
              : 'predecessors',
          }),
        };
      },
    },
  ],
};

const fileGroup: RibbonGroupSpec = {
  id: 'file', labelKey: 'menu:ribbon.file',
  items: [
    {
      kind: 'stack', id: 'fileStack1', items: [
        {
          kind: 'small', id: 'new', icon: <Icon id="file.new" size={16} />, labelKey: 'menu:ribbon.new',
          use: uiAction({ showNewProjectDialog: true }),
        },
        {
          kind: 'small', id: 'save', icon: <Icon id="file.save" size={16} />, labelKey: 'menu:ribbon.save',
          use: () => useCommandBinding(COMMANDS.save),
        },
        {
          kind: 'small', id: 'open', icon: <Icon id="file.open" size={16} />, labelKey: 'menu:ribbon.open',
          use: () => useCommandBinding(COMMANDS.open),
        },
      ],
    },
    {
      kind: 'stack', id: 'fileStack2', items: [
        {
          kind: 'small', id: 'saveAs', icon: <Icon id="file.save-as" size={16} />, labelKey: 'menu:backstage.saveAs',
          use: () => useCommandBinding(COMMANDS.saveAs),
        },
        { kind: 'component', id: 'recentFiles', Component: RecentFilesDropdown },
        { kind: 'component', id: 'export', Component: ExportDropdown },
      ],
    },
  ],
};

const editGroup: RibbonGroupSpec = {
  id: 'edit', labelKey: 'menu:ribbon.edit',
  items: [
    {
      kind: 'stack', id: 'editStack', items: [
        {
          kind: 'small', id: 'undo', icon: <Icon id="edit.undo" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.undo',
          use: () => useCommandBinding(COMMANDS.undo),
        },
        {
          kind: 'small', id: 'redo', icon: <Icon id="edit.redo" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.redo',
          use: () => useCommandBinding(COMMANDS.redo),
        },
        {
          kind: 'small', id: 'delete', icon: <Icon id="edit.delete" size={16} />, labelKey: 'menu:ribbon.delete', danger: true,
          use: () => useCommandBinding(COMMANDS.delete),
        },
      ],
    },
    {
      kind: 'stack', id: 'editStack2', items: [
        {
          kind: 'small', id: 'dissolve', icon: <Icon id="planning.relations-menu" size={16} />, labelKey: 'menu:ribbon.dissolve',
          use: () => {
            const { t } = useTranslation('menu');
            const hasSelection = useAppStore(s => s.selectedTaskIds.length > 0);
            return {
              title: t('ribbon.dissolveTitle'),
              disabled: !hasSelection,
              onClick: () => {
                const s = useAppStore.getState();
                s.dissolveTasksBulk(s.selectedTaskIds);
              },
            };
          },
        },
      ],
    },
  ],
};

const scheduleGroup: RibbonGroupSpec = {
  id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton],
};

const tableColumnsGroup: RibbonGroupSpec = {
  id: 'tableColumns', labelKey: 'common:view.columns.title',
  items: [{
    kind: 'button', id: 'tableColumns', icon: <Icon id="table.columns" size={24} />, labelKey: 'menu:ribbon.columns',
    use: useColumnsButtonBinding,
  }],
};

const startTab: RibbonTabConfig = [
  fileGroup,
  editGroup,
  tasksGroup,
  scheduleGroup,
  {
    id: 'zoom', labelKey: 'menu:ribbon.zoom',
    items: [
      {
        kind: 'stack', id: 'zoomStack', items: [
          {
            kind: 'small', id: 'zoomIn', icon: <Icon id="view.zoom-in" size={16} />, labelKey: 'menu:ribbon.zoomIn',
            use: () => useCommandBinding(COMMANDS.zoomIn),
          },
          {
            kind: 'small', id: 'zoomOut', icon: <Icon id="view.zoom-out" size={16} />, labelKey: 'menu:ribbon.zoomOut',
            use: () => useCommandBinding(COMMANDS.zoomOut),
          },
        ],
      },
    ],
  },
];

const moveProjectButton: RibbonButtonSpec = {
  kind: 'button', id: 'moveProject', icon: <Icon id="planning.move-date" size={24} />, labelKey: 'menu:ribbon.moveProject',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasStart = useAppStore(s => !!s.project.startDate);
    return { onClick: () => setUI({ showMoveProjectDialog: true }), disabled: !hasStart };
  },
};

const progressImportButton: RibbonButtonSpec = {
  kind: 'small', id: 'progressImport', icon: <Icon id="planning.progress-sheet-import" size={16} />, labelKey: 'menu:ribbon.progressImport',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasTasks = useAppStore(s => s.tasks.length > 0);
    return { onClick: () => setUI({ showProgressImportDialog: true }), disabled: !hasTasks };
  },
};

const progressExportButton: RibbonButtonSpec = {
  kind: 'small', id: 'progressExport', icon: <Icon id="planning.progress-sheet-export" size={16} />, labelKey: 'menu:ribbon.progressExport',
  use: () => {
    const exportAs = useAppStore(s => s.exportAs);
    const hasTasks = useAppStore(s => s.tasks.length > 0);
    return { onClick: () => { void exportAs('progress-xlsx'); }, disabled: !hasTasks };
  },
};

const progressGroup: RibbonGroupSpec = {
  id: 'progress', labelKey: 'menu:ribbon.progressGroup',
  items: [{ kind: 'stack', id: 'progressStack', items: [progressExportButton, progressImportButton] }],
};

const warningsPanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'warningsPanel', icon: <Icon id="panel.warnings" size={24} />, labelKey: 'menu:ribbon.warningsPanel',
  use: () => {
    const binding = useCommandBinding(COMMANDS.toggleWarningsPanel);
    const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
    const showWarningsPanel = useAppStore(s => s.ui.showWarningsPanel);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const railVisible = !rightPanelCollapsed && !(showResourcePanel && !resourcePanelDocked);
    return { ...binding, active: railVisible && showWarningsPanel };
  },
};

const scheduleShiftPanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'scheduleShiftPanel', icon: <Icon id="panel.schedule-shift" size={24} />, labelKey: 'menu:ribbon.scheduleShiftPanel',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
    const showScheduleShiftPanel = useAppStore(s => s.ui.showScheduleShiftPanel);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const railVisible = !rightPanelCollapsed && !(showResourcePanel && !resourcePanelDocked);
    return { onClick: () => setUI({ showScheduleShiftPanel: !showScheduleShiftPanel }), active: railVisible && showScheduleShiftPanel };
  },
};

const planningTab: RibbonTabConfig = [
  { id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton, moveProjectButton, warningsPanelButton, scheduleShiftPanelButton] },
  {
    id: 'relations', labelKey: 'menu:ribbon.relations',
    items: [relationDropdownItem, splitTaskButton],
  },
  traceGroup,
  {
    id: 'calendar', labelKey: 'menu:ribbon.calendar',
    items: [calendarButton],
  },
  {
    id: 'structure', labelKey: 'menu:ribbon.structure',
    items: [
      {
        kind: 'button', id: 'codesFields', icon: <Icon id="planning.structure" size={24} />, labelKey: 'menu:ribbon.codesFields',
        use: uiAction({ showStructureDialog: true }),
      },
      {
        kind: 'stack', id: 'structureStack1', items: [
          {
            kind: 'small', id: 'wbsAuto', icon: <Icon id="wbs.auto-number" size={16} />, labelKey: 'menu:ribbon.wbsAuto',
            use: () => {
              const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
              const setWbsAutoNumber = useAppStore(s => s.setWbsAutoNumber);
              return { onClick: () => setWbsAutoNumber(!wbsAutoNumber), active: wbsAutoNumber };
            },
          },
          {
            kind: 'small', id: 'renumberWbs', icon: <Icon id="wbs.renumber" size={16} />, labelKey: 'menu:ribbon.renumberWbs',
            use: () => {
              const renumberWbs = useAppStore(s => s.renumberWbs);
              const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
              return { onClick: () => renumberWbs(), disabled: wbsAutoNumber };
            },
          },
          { kind: 'component', id: 'templates', Component: TemplatesDropdown },
        ],
      },
      {
        kind: 'stack', id: 'structureStack2', items: [
          {
            kind: 'small', id: 'indent', icon: <Icon id="task.indent" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.indent',
            use: () => {
              const binding = useCommandBinding(COMMANDS.indent);
              const treeMode = useAppStore(s => isTreeMode(s.view));
              const { t: tCommon } = useTranslation('common');
              return { ...binding, title: !treeMode ? tCommon('view.structureLockedHint') : undefined };
            },
          },
          {
            kind: 'small', id: 'outdent', icon: <Icon id="task.outdent" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.outdent',
            use: () => {
              const binding = useCommandBinding(COMMANDS.outdent);
              const treeMode = useAppStore(s => isTreeMode(s.view));
              const { t: tCommon } = useTranslation('common');
              return { ...binding, title: !treeMode ? tCommon('view.structureLockedHint') : undefined };
            },
          },
        ],
      },
    ],
  },
  {
    id: 'baselines', labelKey: 'menu:ribbon.baselines',
    items: [{ kind: 'component', id: 'baselinesProgress', Component: BaselinesProgressGroupContent }],
  },
  progressGroup,
];

const openResourcePanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'openResourcePanel', icon: <Icon id="resource.workspace" size={24} />, labelKey: 'menu:ribbon.openResourcePanel',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const { t } = useTranslation('menu');
    const visible = showResourcePanel && !resourcePanelDocked;
    return {
      onClick: () => setUI(visible ? { showResourcePanel: false } : { showResourcePanel: true, resourcePanelDocked: false }),
      active: visible,
      title: t('ribbon.openResourcePanelTitle'),
    };
  },
};

const dockResourcePanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'dockResourcePanel', icon: <Icon id="resource.dock" size={24} className="ops-icon-rail" />,
  labelKey: 'menu:ribbon.dockResourcePanel',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const { t } = useTranslation('menu');
    const visible = showResourcePanel && resourcePanelDocked && !rightPanelCollapsed;
    return {
      onClick: () => setUI(
        visible
          ? { showResourcePanel: false, resourcePanelDocked: false }
          : { showResourcePanel: true, resourcePanelDocked: true },
      ),
      active: visible,
      title: t('ribbon.dockResourcePanelTitle'),
    };
  },
};

function histogramResourceStep(step: -1 | 1): () => RibbonButtonBinding {
  return function useHistogramResourceStep() {
    const resources = useAppStore(s => s.resources);
    const showHistogram = useAppStore(s => s.ui.showHistogram);
    const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
    const setHistogramResource = useAppStore(s => s.setHistogramResource);
    const cycle = () => {
      const ids: (string | undefined)[] = [undefined, ...resources.map(r => r.id)];
      const cur = ids.findIndex(id => id === histogramResourceId);
      setHistogramResource(ids[(cur + step + ids.length) % ids.length]);
    };
    return { onClick: cycle, disabled: !showHistogram || resources.length === 0 };
  };
}

const toggleHistogramButton: RibbonButtonSpec = {
  kind: 'button', id: 'toggleHistogram', icon: <Icon id="data.chart" size={24} />, labelKey: 'menu:ribbon.toggleHistogram',
  use: () => {
    const binding = useCommandBinding(COMMANDS.toggleHistogram);
    const active = useAppStore(s => s.ui.showHistogram);
    return { ...binding, active };
  },
};

const resourcesTab: RibbonTabConfig = [
  {
    id: 'resourceManagement', labelKey: 'menu:ribbon.resourceManagement',
    items: [
      openResourcePanelButton,
      dockResourcePanelButton,
      {
        kind: 'button', id: 'newResource', icon: <Icon id="resource.new" size={24} />, labelKey: 'menu:ribbon.newResource',
        use: uiAction({ showResourcePanel: true, resourcePanelDocked: false, pendingNewResource: true }),
      },
    ],
  },
  {
    id: 'resourceAssignment', labelKey: 'menu:ribbon.resourceAssignment',
    items: [{ kind: 'component', id: 'resourceAssign', Component: ResourceAssignDropdown }],
  },
  {
    id: 'histogram', labelKey: 'menu:ribbon.histogram',
    items: [
      toggleHistogramButton,
      {
        kind: 'stack', id: 'histogramStack', items: [
          {
            kind: 'small', id: 'prevResource', icon: <Icon id="resource.previous" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.prevResource',
            use: histogramResourceStep(-1),
          },
          {
            kind: 'small', id: 'nextResource', icon: <Icon id="resource.next" size={16} className="ops-icon-inline-flip" />, labelKey: 'menu:ribbon.nextResource',
            use: histogramResourceStep(1),
          },
        ],
      },
    ],
  },
  {
    id: 'leveling', labelKey: 'menu:ribbon.leveling',
    items: [
      {
        kind: 'button', id: 'levelResources', icon: <Icon id="resource.level" size={24} />, labelKey: 'menu:ribbon.levelResourcesDialog',
        use: uiAction({ showLevelingDialog: true }),
      },
      {
        kind: 'button', id: 'clearLeveling', icon: <Icon id="resource.clear-level" size={24} />, labelKey: 'menu:ribbon.clearLeveling',
        use: () => {
          const clearLeveling = useAppStore(s => s.clearLeveling);
          const hasLeveling = useAppStore(s => s.tasks.some(hasLevelingOutput));
          return { onClick: () => clearLeveling(), disabled: !hasLeveling };
        },
      },
    ],
  },
  {
    id: 'overallocationIndicator', labelKey: 'menu:ribbon.overallocationIndicator',
    items: [{ kind: 'component', id: 'overallocation', Component: OverallocationIndicator }],
  },
];

const outlineGroup: RibbonGroupSpec = {
  id: 'outline', labelKey: 'menu:ribbon.outline',
  items: [{
    kind: 'stack', id: 'outlineStack', items: [
      {
        kind: 'small', id: 'collapseTasks', icon: <Icon id="tree.collapse-scope" size={16} />, labelKey: 'menu:ribbon.collapseTasks',
        use: () => {
          const collapseTasks = useAppStore(s => s.collapseTasks);
          const collapseAllGroups = useAppStore(s => s.collapseAllGroups);
          const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
          const grouped = useAppStore(s => (s.view.group?.length ?? 0) > 0);
          const { t } = useTranslation('menu');
          return {
            onClick: () => (grouped ? collapseAllGroups() : collapseTasks(selectedTaskIds)),
            title: t(grouped ? 'ribbon.collapseGroupsTitle' : 'ribbon.collapseTasksTitle'),
          };
        },
      },
      {
        kind: 'small', id: 'expandTasks', icon: <Icon id="tree.expand-scope" size={16} />, labelKey: 'menu:ribbon.expandTasks',
        use: () => {
          const expandTasks = useAppStore(s => s.expandTasks);
          const expandAllGroups = useAppStore(s => s.expandAllGroups);
          const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
          const grouped = useAppStore(s => (s.view.group?.length ?? 0) > 0);
          const { t } = useTranslation('menu');
          return {
            onClick: () => (grouped ? expandAllGroups() : expandTasks(selectedTaskIds)),
            title: t(grouped ? 'ribbon.expandGroupsTitle' : 'ribbon.expandTasksTitle'),
          };
        },
      },
    ],
  }],
};

const beeldTab: RibbonTabConfig = [
  { id: 'timeScale', labelKey: 'menu:ribbon.timeScale', items: [{ kind: 'component', id: 'timeScale', Component: TimeScaleGroupContent }] },
  {
    id: 'display', labelKey: 'menu:ribbon.display',
    items: [{ kind: 'component', id: 'display', Component: DisplayGroupContent }],
    useVisible: () => useAppStore(s => s.ui.showClassicViewControls),
  },
  outlineGroup,
  { id: 'layout', labelKey: 'menu:ribbon.layout', items: [{ kind: 'component', id: 'layout', Component: LayoutGroupContent }] },
  { id: 'presentation', labelKey: 'menu:ribbon.presentationMode', items: [{ kind: 'component', id: 'presentation', Component: PresentationGroupContent }] },
  {
    id: 'panels', labelKey: 'menu:ribbon.panels',
    items: [
      {
        kind: 'button', id: 'properties', icon: <Icon id="panel.properties" size={24} />, labelKey: 'menu:ribbon.properties',
        use: () => {
          const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
          const showPropertiesPanel = useAppStore(s => s.ui.showPropertiesPanel);
          const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
          const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
          const setUI = useAppStore(s => s.setUI);
          const railVisible = !rightPanelCollapsed && !(showResourcePanel && !resourcePanelDocked);
          const visible = railVisible && showPropertiesPanel;
          return {
            icon: visible ? <Icon id="panel.properties" size={24} /> : <Icon id="panel.properties-hidden" size={24} />,
            active: visible,
            onClick: () => setUI(visible ? { showPropertiesPanel: false } : { showPropertiesPanel: true }),
          };
        },
      },
      openResourcePanelButton,
      dockResourcePanelButton,
      toggleHistogramButton,
      warningsPanelButton,
      scheduleShiftPanelButton,
    ],
  },
  {
    id: 'overlays', labelKey: 'menu:ribbon.baselines',
    items: [
      { kind: 'component', id: 'toggleBaselineOverlay', Component: BaselineOverlaySplitButton },
      {
        kind: 'stack', id: 'overlaysStack', items: [
          {
            kind: 'small', id: 'toggleProgressLine', icon: <Icon id="planning.progress-line" size={16} />, labelKey: 'menu:ribbon.toggleProgressLine',
            use: () => {
              const showProgressLine = useAppStore(s => s.ui.showProgressLine);
              const setOverlays = useAppStore(s => s.setOverlays);
              return { active: showProgressLine, onClick: () => setOverlays({ progressLine: !showProgressLine }) };
            },
          },
          {
            kind: 'small', id: 'toggleStatusDateLine', icon: <Icon id="planning.status-date-line" size={16} />, labelKey: 'menu:ribbon.toggleStatusDateLine',
            use: () => {
              const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
              const setOverlays = useAppStore(s => s.setOverlays);
              return { active: showStatusDateLine, onClick: () => setOverlays({ statusDateLine: !showStatusDateLine }) };
            },
          },
        ],
      },
    ],
  },
  {
    id: 'bars', labelKey: 'menu:ribbon.barsGroup',
    items: [
      {
        kind: 'stack', id: 'colorAccentStack', items: [
          { kind: 'component', id: 'screenColors', Component: ScreenColorsPopoverButton },
          {
            kind: 'small', id: 'toggleResourceAccent', icon: <Icon id="planning.resource-accent" size={16} />, labelKey: 'menu:ribbon.toggleResourceAccent',
            use: () => {
              const showResourceAccent = useAppStore(s => s.ui.showResourceAccent);
              const setOverlays = useAppStore(s => s.setOverlays);
              return { active: showResourceAccent, onClick: () => setOverlays({ resourceAccent: !showResourceAccent }) };
            },
          },
          {
            kind: 'small', id: 'toggleFloatBand', icon: <Icon id="planning.float-band" size={16} />, labelKey: 'menu:ribbon.toggleFloatBand',
            use: () => {
              const showFloatBand = useAppStore(s => s.ui.showFloatBand);
              const setOverlays = useAppStore(s => s.setOverlays);
              return { active: showFloatBand, onClick: () => setOverlays({ floatBand: !showFloatBand }) };
            },
          },
        ],
      },
      {
        kind: 'stack', id: 'relationsStack', items: [
          {
            kind: 'small', id: 'toggleRelations', icon: <Icon id="planning.relations-visible" size={16} />, labelKey: 'menu:ribbon.toggleRelations',
            use: () => {
              const showRelations = useAppStore(s => s.view.showRelations ?? true);
              const setShowRelations = useAppStore(s => s.setShowRelations);
              return { active: showRelations, onClick: () => setShowRelations(!showRelations) };
            },
          },
          {
            kind: 'small', id: 'toggleBarDates', icon: <Icon id="status.recorded-dates" size={16} />, labelKey: 'menu:ribbon.toggleBarDates',
            use: () => {
              const showBarDates = useAppStore(s => s.ui.showBarDates);
              return { active: showBarDates, onClick: () => applySetting('showBarDates', !showBarDates, saveShowBarDates) };
            },
          },
        ],
      },
    ],
  },
];

const instellingenTab: RibbonTabConfig = [
  {
    id: 'project', labelKey: 'menu:ribbon.project',
    items: [
      {
        kind: 'button', id: 'projectInfo', icon: <Icon id="project.properties" size={24} />, labelKey: 'menu:ribbon.projectInfo',
        use: uiAction({ showProjectInfoDialog: true }),
      },
      {
        kind: 'button', id: 'projectSettings', icon: <Icon id="ui.settings" size={24} />, labelKey: 'menu:ribbon.projectSettings',
        use: uiAction({ showSettingsDialog: true }),
      },
    ],
  },
  { id: 'calendar', labelKey: 'menu:ribbon.calendar', items: [calendarButton] },
  {
    id: 'shortcuts', labelKey: 'common:shortcuts.title',
    items: [{
      kind: 'small', id: 'shortcuts', icon: <Icon id="ui.shortcuts" size={16} />, labelKey: 'common:shortcuts.title',
      use: uiAction({ showShortcutsDialog: true }),
    }],
  },
];

const tableTab: RibbonTabConfig = [
  fileGroup,
  editGroup,
  tasksGroup,
  scheduleGroup,
  traceGroup,
  tableColumnsGroup,
  progressGroup,
];

const ifcTab: RibbonTabConfig = [
  { id: 'ifc', labelKey: 'menu:ribbon.ifc', items: [{ kind: 'component', id: 'ifcInfo', Component: IfcInfo }] },
];

const reportTab: RibbonTabConfig = [];

const aiTab: RibbonTabConfig = [
  { id: 'aiServer', labelKey: 'menu:ribbon.aiServer', items: [{ kind: 'component', id: 'aiServer', Component: AiServerGroup }] },
  { id: 'aiConnection', labelKey: 'menu:ribbon.aiConnection', items: [{ kind: 'component', id: 'aiConnection', Component: AiConnectionGroup }] },
  { id: 'aiSafety', labelKey: 'menu:ribbon.aiSafety', items: [{ kind: 'component', id: 'aiSafety', Component: AiSafetyGroup }] },
  { id: 'aiActivity', labelKey: 'menu:ribbon.aiActivity', items: [{ kind: 'component', id: 'aiActivity', Component: AiActivityGroup }] },
];

export const RIBBON_TABS: Record<Exclude<RibbonTab, 'file'>, RibbonTabConfig> = {
  start: startTab,
  planning: planningTab,
  resources: resourcesTab,
  beeld: beeldTab,
  instellingen: instellingenTab,
  table: tableTab,
  ifc: ifcTab,
  report: reportTab,
  ai: aiTab,
};
