import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Link, Play, Undo2, Redo2, ZoomIn, ZoomOut,
  FileText, FolderOpen, Save, Printer, Trash2,
  Calendar, Settings, Info, Clock,
  ArrowRightLeft, Eye, EyeOff, SaveAll,
  Tags, ListOrdered, Hash,
  IndentIncrease, IndentDecrease,
  Users, BarChart3, Scale, Eraser, ChevronLeft, ChevronRight,
  ArrowLeftToLine, ArrowRightToLine, LayoutGrid, TrendingUp, CalendarDays,
  Keyboard, Pin, PinOff, Compass,
} from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { formatDate } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { isTreeMode } from '@/engine/view/visibleRows';
import {
  saveShowHistogram, saveShowBaselineOverlay, saveShowProgressLine, saveShowStatusDateLine,
} from '@/utils/settingsStore';
import type { RibbonTab } from '@/state/slices/types';
import {
  BaselinesProgressGroupContent, MilestoneDropdown, TemplatesDropdown, RecentFilesDropdown,
  ExportDropdown, ResourceAssignDropdown, LayoutGroupContent, PresentationGroupContent,
  TimeScaleGroupContent, DisplayGroupContent, OverallocationIndicator, IfcInfo,
} from './ribbonWidgets';

/**
 * Declaratieve ribbon-config-registry (audit P18). Naar het model van ExtensionRibbonGroups:
 * elke tab is data (groepen → items) i.p.v. ~350 regels inline-JSX in één god-functie. Het
 * generieke render-pad staat in RibbonTabContent.tsx.
 *
 * Drie item-soorten dekken de herhaalde structuur (knop, knop-stapel), plus een
 * component-escape-hatch voor de écht complexe widgets (popovers, inputs, speciale panelen —
 * zie ribbonWidgets.tsx). Criterium voor de escape-hatch: eigen React-state, een popover, of
 * een niet-triviale layout die niet uit een knop-lijst volgt. De winst zit in de vele
 * herhaalde knoppen/groepen en de gedeelde definities (Bereken/Taak/Relatie/Trace/…), niet in
 * het in data persen van iedere widget.
 *
 * Vertaling: labels zijn i18n-SLEUTELS met namespace-prefix ('menu:ribbon.calculate'); de
 * vertaling gebeurt pas bij render. Dynamische props (onClick/active/disabled/icon/title) komen
 * uit een per-item `use`-hook die zélf zijn store-selectors ophaalt — zo loopt geen enkele
 * tab-wissel of knop-mutatie meer door één reuzenselector.
 */

/** Vertaal-sleutel met namespace-prefix. */
export type NsKey = `${'menu' | 'common' | 'task' | 'report'}:${string}`;

/** Dynamische, uit de store afgeleide props voor een knop-item. */
export interface RibbonButtonBinding {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Tooltip (alleen kleine knoppen). */
  title?: string;
  /** Icoon-override voor knoppen die van staat wisselen (bv. Pin/PinOff, Eye/EyeOff). */
  icon?: ReactNode;
}

export interface RibbonButtonSpec {
  kind: 'button' | 'small';
  id: string;
  icon: ReactNode;
  labelKey: NsKey;
  primary?: boolean;
  danger?: boolean;
  /** Hook: leest eigen store-state/acties en levert de dynamische props (optioneel = statisch). */
  use?: () => RibbonButtonBinding;
}

export interface RibbonStackSpec {
  kind: 'stack';
  id: string;
  /** Kleine knoppen, of een component-escape-hatch die zelf een `ribbon-btn small` rendert. */
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
}

export type RibbonTabConfig = RibbonGroupSpec[];

// ── Gedeelde item-definities (dedup: één bron i.p.v. 4-5 kopieën) ────────────────────────────

/** Bereken/CPM-knop — voorheen 4× letterlijk gekopieerd (start/planning/relations/table). */
const calcButton: RibbonButtonSpec = {
  kind: 'button', id: 'calc', icon: <Play size={20} />, labelKey: 'menu:ribbon.calculate', primary: true,
  use: () => {
    const runCPM = useAppStore(s => s.runCPM);
    return { onClick: () => runCPM() };
  },
};

/** Taak-toevoegen-knop (start + table). */
const addTaskButton: RibbonButtonSpec = {
  kind: 'button', id: 'addTask', icon: <Plus size={20} />, labelKey: 'menu:ribbon.task',
  use: () => {
    const addTask = useAppStore(s => s.addTask);
    const startDate = useAppStore(s => s.project.startDate);
    const { t } = useTranslation('task');
    return {
      onClick: () => addTask({
        name: t('defaultTask'),
        time: createDefaultTaskTime(startDate || formatDate(new Date()), 5),
      }),
    };
  },
};

/** Relatie-modus-knop (start/planning/relations). */
const relationButton: RibbonButtonSpec = {
  kind: 'button', id: 'relation', icon: <Link size={20} />, labelKey: 'menu:ribbon.relation',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const active = useAppStore(s => s.ui.showDependencyMode);
    return { active, onClick: () => setUI({ showDependencyMode: !active, dependencySourceId: null }) };
  },
};

/** Kalender-knop (planning + instellingen). */
const calendarButton: RibbonButtonSpec = {
  kind: 'button', id: 'calendar', icon: <Calendar size={20} />, labelKey: 'menu:ribbon.calendar',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    return { onClick: () => setUI({ showCalendarDialog: true }) };
  },
};

/** Afdrukvoorbeeld-knop (beeld + report) — opent de Rapport-tab. */
const printPreviewButton: RibbonButtonSpec = {
  kind: 'button', id: 'printPreview', icon: <Printer size={20} />, labelKey: 'menu:ribbon.printPreview',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    return { onClick: () => setUI({ activeRibbonTab: 'report' }) };
  },
};

/** Trace-groep (Task Path): predecessors/successors-toggle, gedeeld door planning + relations. */
const traceGroup: RibbonGroupSpec = {
  id: 'trace', labelKey: 'menu:ribbon.trace',
  items: [
    {
      kind: 'button', id: 'tracePred', icon: <ArrowLeftToLine size={20} />, labelKey: 'menu:ribbon.tracePredecessors',
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
      kind: 'button', id: 'traceSucc', icon: <ArrowRightToLine size={20} />, labelKey: 'menu:ribbon.traceSuccessors',
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

// ── Per-tab configuratie ─────────────────────────────────────────────────────────────────────

const startTab: RibbonTabConfig = [
  {
    id: 'file', labelKey: 'menu:ribbon.file',
    items: [
      {
        kind: 'stack', id: 'fileStack1', items: [
          {
            kind: 'small', id: 'new', icon: <FileText size={14} />, labelKey: 'menu:ribbon.new',
            use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showNewProjectDialog: true }) }; },
          },
          {
            kind: 'small', id: 'save', icon: <Save size={14} />, labelKey: 'menu:ribbon.save',
            use: () => { const saveFile = useAppStore(s => s.saveFile); return { onClick: () => saveFile() }; },
          },
          {
            kind: 'small', id: 'open', icon: <FolderOpen size={14} />, labelKey: 'menu:ribbon.open',
            use: () => { const openFile = useAppStore(s => s.openFile); return { onClick: () => openFile() }; },
          },
        ],
      },
      {
        // Save As + Recent + Export horen sámen in één verticale kolom (reviewbevinding pakket P:
        // los geplaatst renderden ze horizontaal en werd de groep ~2× zo breed).
        kind: 'stack', id: 'fileStack2', items: [
          {
            kind: 'small', id: 'saveAs', icon: <SaveAll size={14} />, labelKey: 'menu:backstage.saveAs',
            use: () => { const saveFileAs = useAppStore(s => s.saveFileAs); return { onClick: () => saveFileAs() }; },
          },
          { kind: 'component', id: 'recentFiles', Component: RecentFilesDropdown },
          { kind: 'component', id: 'export', Component: ExportDropdown },
        ],
      },
    ],
  },
  {
    id: 'edit', labelKey: 'menu:ribbon.edit',
    items: [
      {
        kind: 'stack', id: 'editStack', items: [
          {
            kind: 'small', id: 'undo', icon: <Undo2 size={14} />, labelKey: 'menu:ribbon.undo',
            use: () => {
              const undo = useAppStore(s => s.undo);
              const disabled = useAppStore(s => s.undoStack.length === 0);
              return { onClick: () => undo(), disabled };
            },
          },
          {
            kind: 'small', id: 'redo', icon: <Redo2 size={14} />, labelKey: 'menu:ribbon.redo',
            use: () => {
              const redo = useAppStore(s => s.redo);
              const disabled = useAppStore(s => s.redoStack.length === 0);
              return { onClick: () => redo(), disabled };
            },
          },
          {
            kind: 'small', id: 'delete', icon: <Trash2 size={14} />, labelKey: 'menu:ribbon.delete', danger: true,
            use: () => {
              const deleteTask = useAppStore(s => s.deleteTask);
              const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
              return {
                onClick: () => { for (const id of selectedTaskIds) deleteTask(id); },
                disabled: selectedTaskIds.length === 0,
              };
            },
          },
        ],
      },
    ],
  },
  {
    id: 'tasks', labelKey: 'menu:ribbon.tasks',
    items: [
      addTaskButton,
      { kind: 'component', id: 'milestone', Component: MilestoneDropdown },
      relationButton,
    ],
  },
  { id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton] },
  {
    id: 'zoom', labelKey: 'menu:ribbon.zoom',
    items: [
      {
        kind: 'stack', id: 'zoomStack', items: [
          {
            kind: 'small', id: 'zoomIn', icon: <ZoomIn size={14} />, labelKey: 'menu:ribbon.zoomIn',
            use: () => { const setZoom = useAppStore(s => s.setZoom); const zoom = useAppStore(s => s.view.zoom); return { onClick: () => setZoom(zoom + 10) }; },
          },
          {
            kind: 'small', id: 'zoomOut', icon: <ZoomOut size={14} />, labelKey: 'menu:ribbon.zoomOut',
            use: () => { const setZoom = useAppStore(s => s.setZoom); const zoom = useAppStore(s => s.view.zoom); return { onClick: () => setZoom(zoom - 5) }; },
          },
        ],
      },
    ],
  },
];

const planningTab: RibbonTabConfig = [
  { id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton] },
  {
    id: 'relations', labelKey: 'menu:ribbon.relations',
    items: [
      relationButton,
      {
        kind: 'button', id: 'manage', icon: <ArrowRightLeft size={20} />, labelKey: 'menu:ribbon.manage',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ activeRibbonTab: 'relations' }) }; },
      },
    ],
  },
  traceGroup,
  {
    id: 'calendar', labelKey: 'menu:ribbon.calendar',
    items: [
      calendarButton,
      {
        kind: 'button', id: 'holidays', icon: <Clock size={20} />, labelKey: 'menu:ribbon.holidays',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showCalendarDialog: true }) }; },
      },
    ],
  },
  {
    id: 'structure', labelKey: 'menu:ribbon.structure',
    items: [
      {
        kind: 'button', id: 'codesFields', icon: <Tags size={20} />, labelKey: 'menu:ribbon.codesFields',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showStructureDialog: true }) }; },
      },
      {
        kind: 'stack', id: 'structureStack1', items: [
          {
            kind: 'small', id: 'wbsAuto', icon: <Hash size={14} />, labelKey: 'menu:ribbon.wbsAuto',
            use: () => {
              const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
              const setWbsAutoNumber = useAppStore(s => s.setWbsAutoNumber);
              return { onClick: () => setWbsAutoNumber(!wbsAutoNumber), active: wbsAutoNumber };
            },
          },
          {
            kind: 'small', id: 'renumberWbs', icon: <ListOrdered size={14} />, labelKey: 'menu:ribbon.renumberWbs',
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
            kind: 'small', id: 'indent', icon: <IndentIncrease size={14} />, labelKey: 'menu:ribbon.indent',
            use: () => {
              const view = useAppStore(s => s.view);
              const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
              const indentTasks = useAppStore(s => s.indentTasks);
              const { t: tCommon } = useTranslation('common');
              const treeMode = isTreeMode(view);
              return {
                onClick: () => indentTasks(selectedTaskIds),
                disabled: selectedTaskIds.length === 0 || !treeMode,
                title: !treeMode ? tCommon('view.structureLockedHint') : undefined,
              };
            },
          },
          {
            kind: 'small', id: 'outdent', icon: <IndentDecrease size={14} />, labelKey: 'menu:ribbon.outdent',
            use: () => {
              const view = useAppStore(s => s.view);
              const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
              const outdentTasks = useAppStore(s => s.outdentTasks);
              const { t: tCommon } = useTranslation('common');
              const treeMode = isTreeMode(view);
              return {
                onClick: () => outdentTasks(selectedTaskIds),
                disabled: selectedTaskIds.length === 0 || !treeMode,
                title: !treeMode ? tCommon('view.structureLockedHint') : undefined,
              };
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
];

const resourcesTab: RibbonTabConfig = [
  {
    id: 'resourceManagement', labelKey: 'menu:ribbon.resourceManagement',
    items: [
      {
        kind: 'button', id: 'openResourcePanel', icon: <Users size={20} />, labelKey: 'menu:ribbon.openResourcePanel',
        use: () => {
          const setUI = useAppStore(s => s.setUI);
          const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
          const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
          return {
            onClick: () => setUI({ showResourcePanel: true, resourcePanelDocked: false }),
            active: showResourcePanel && !resourcePanelDocked,
          };
        },
      },
      {
        kind: 'button', id: 'dockResourcePanel', icon: <Pin size={20} />, labelKey: 'menu:ribbon.dockResourcePanel',
        use: () => {
          const setUI = useAppStore(s => s.setUI);
          const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
          const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
          const onClick = () => {
            if (showResourcePanel && resourcePanelDocked) {
              setUI({ showResourcePanel: false, resourcePanelDocked: false });
            } else {
              setUI({ showResourcePanel: true, resourcePanelDocked: true });
            }
          };
          return {
            icon: resourcePanelDocked ? <PinOff size={20} /> : <Pin size={20} />,
            onClick,
            active: showResourcePanel && resourcePanelDocked,
          };
        },
      },
      {
        kind: 'button', id: 'newResource', icon: <Plus size={20} />, labelKey: 'menu:ribbon.newResource',
        use: () => {
          const addResource = useAppStore(s => s.addResource);
          const setUI = useAppStore(s => s.setUI);
          return {
            onClick: () => { addResource({ name: '', type: 'LABOR', description: '', maxUnits: 1 }); setUI({ showResourcePanel: true }); },
          };
        },
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
      {
        kind: 'button', id: 'toggleHistogram', icon: <BarChart3 size={20} />, labelKey: 'menu:ribbon.toggleHistogram',
        use: () => {
          const showHistogram = useAppStore(s => s.ui.showHistogram);
          const setUI = useAppStore(s => s.setUI);
          return {
            active: showHistogram,
            onClick: () => { const next = !showHistogram; setUI({ showHistogram: next }); void saveShowHistogram(next); },
          };
        },
      },
      {
        kind: 'stack', id: 'histogramStack', items: [
          {
            kind: 'small', id: 'prevResource', icon: <ChevronLeft size={14} />, labelKey: 'menu:ribbon.prevResource',
            use: () => {
              const resources = useAppStore(s => s.resources);
              const showHistogram = useAppStore(s => s.ui.showHistogram);
              const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
              const setHistogramResource = useAppStore(s => s.setHistogramResource);
              const cycle = () => {
                const ids: (string | undefined)[] = [undefined, ...resources.map(r => r.id)];
                const cur = ids.findIndex(id => id === histogramResourceId);
                setHistogramResource(ids[(cur - 1 + ids.length) % ids.length]);
              };
              return { onClick: cycle, disabled: !showHistogram || resources.length === 0 };
            },
          },
          {
            kind: 'small', id: 'nextResource', icon: <ChevronRight size={14} />, labelKey: 'menu:ribbon.nextResource',
            use: () => {
              const resources = useAppStore(s => s.resources);
              const showHistogram = useAppStore(s => s.ui.showHistogram);
              const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
              const setHistogramResource = useAppStore(s => s.setHistogramResource);
              const cycle = () => {
                const ids: (string | undefined)[] = [undefined, ...resources.map(r => r.id)];
                const cur = ids.findIndex(id => id === histogramResourceId);
                setHistogramResource(ids[(cur + 1 + ids.length) % ids.length]);
              };
              return { onClick: cycle, disabled: !showHistogram || resources.length === 0 };
            },
          },
        ],
      },
    ],
  },
  {
    id: 'leveling', labelKey: 'menu:ribbon.leveling',
    items: [
      {
        kind: 'button', id: 'levelResources', icon: <Scale size={20} />, labelKey: 'menu:ribbon.levelResourcesDialog',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showLevelingDialog: true }) }; },
      },
      {
        kind: 'button', id: 'clearLeveling', icon: <Eraser size={20} />, labelKey: 'menu:ribbon.clearLeveling',
        use: () => {
          const clearLeveling = useAppStore(s => s.clearLeveling);
          const hasLeveling = useAppStore(s => s.tasks.some(t => t.levelingDelay !== undefined));
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

const relationsTab: RibbonTabConfig = [
  { id: 'relations', labelKey: 'menu:ribbon.relations', items: [relationButton] },
  traceGroup,
  { id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton] },
];

const beeldTab: RibbonTabConfig = [
  { id: 'timeScale', labelKey: 'menu:ribbon.timeScale', items: [{ kind: 'component', id: 'timeScale', Component: TimeScaleGroupContent }] },
  { id: 'display', labelKey: 'menu:ribbon.display', items: [{ kind: 'component', id: 'display', Component: DisplayGroupContent }] },
  {
    id: 'shortcuts', labelKey: 'common:shortcuts.title',
    items: [{
      kind: 'small', id: 'shortcuts', icon: <Keyboard size={14} />, labelKey: 'common:shortcuts.title',
      use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showShortcutsDialog: true }) }; },
    }],
  },
  {
    id: 'tour', labelKey: 'common:tour.restartButton',
    items: [{
      kind: 'small', id: 'tourRestart', icon: <Compass size={14} />, labelKey: 'common:tour.restartButton',
      use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showTourOverlay: true, tourStepIndex: 0 }) }; },
    }],
  },
  { id: 'layout', labelKey: 'menu:ribbon.layout', items: [{ kind: 'component', id: 'layout', Component: LayoutGroupContent }] },
  { id: 'presentation', labelKey: 'menu:ribbon.presentationMode', items: [{ kind: 'component', id: 'presentation', Component: PresentationGroupContent }] },
  {
    id: 'panels', labelKey: 'menu:ribbon.panels',
    items: [{
      kind: 'button', id: 'properties', icon: <Eye size={20} />, labelKey: 'menu:ribbon.properties',
      use: () => {
        const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
        const setUI = useAppStore(s => s.setUI);
        return {
          icon: !rightPanelCollapsed ? <Eye size={20} /> : <EyeOff size={20} />,
          active: !rightPanelCollapsed,
          onClick: () => setUI({ rightPanelCollapsed: !rightPanelCollapsed }),
        };
      },
    }],
  },
  {
    id: 'overlays', labelKey: 'menu:ribbon.baselines',
    items: [
      {
        kind: 'button', id: 'toggleBaselineOverlay', icon: <LayoutGrid size={20} />, labelKey: 'menu:ribbon.toggleBaselineOverlay',
        use: () => {
          const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
          const setUI = useAppStore(s => s.setUI);
          return { active: showBaselineOverlay, onClick: () => { const next = !showBaselineOverlay; setUI({ showBaselineOverlay: next }); void saveShowBaselineOverlay(next); } };
        },
      },
      {
        kind: 'button', id: 'toggleProgressLine', icon: <TrendingUp size={20} />, labelKey: 'menu:ribbon.toggleProgressLine',
        use: () => {
          const showProgressLine = useAppStore(s => s.ui.showProgressLine);
          const setUI = useAppStore(s => s.setUI);
          return { active: showProgressLine, onClick: () => { const next = !showProgressLine; setUI({ showProgressLine: next }); void saveShowProgressLine(next); } };
        },
      },
      {
        kind: 'button', id: 'toggleStatusDateLine', icon: <CalendarDays size={20} />, labelKey: 'menu:ribbon.toggleStatusDateLine',
        use: () => {
          const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
          const setUI = useAppStore(s => s.setUI);
          return { active: showStatusDateLine, onClick: () => { const next = !showStatusDateLine; setUI({ showStatusDateLine: next }); void saveShowStatusDateLine(next); } };
        },
      },
    ],
  },
  { id: 'printing', labelKey: 'menu:ribbon.printing', items: [printPreviewButton] },
];

const instellingenTab: RibbonTabConfig = [
  {
    id: 'project', labelKey: 'menu:ribbon.project',
    items: [
      {
        kind: 'button', id: 'projectInfo', icon: <Info size={20} />, labelKey: 'menu:ribbon.projectInfo',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showProjectInfoDialog: true }) }; },
      },
      {
        kind: 'button', id: 'projectSettings', icon: <Settings size={20} />, labelKey: 'menu:ribbon.projectSettings',
        use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showSettingsDialog: true }) }; },
      },
    ],
  },
  { id: 'calendar', labelKey: 'menu:ribbon.calendar', items: [calendarButton] },
];

const tableTab: RibbonTabConfig = [
  { id: 'table', labelKey: 'task:table.title', items: [calcButton, addTaskButton] },
];

const ifcTab: RibbonTabConfig = [
  { id: 'ifc', labelKey: 'menu:ribbon.ifc', items: [{ kind: 'component', id: 'ifcInfo', Component: IfcInfo }] },
];

const reportTab: RibbonTabConfig = [
  { id: 'reporting', labelKey: 'menu:ribbon.reporting', items: [printPreviewButton] },
];

/** De registry: actieve-tab → groepen. 'file' heeft geen ribbon-inhoud (Backstage neemt over). */
export const RIBBON_TABS: Record<Exclude<RibbonTab, 'file'>, RibbonTabConfig> = {
  start: startTab,
  planning: planningTab,
  resources: resourcesTab,
  relations: relationsTab,
  beeld: beeldTab,
  instellingen: instellingenTab,
  table: tableTab,
  ifc: ifcTab,
  report: reportTab,
};
