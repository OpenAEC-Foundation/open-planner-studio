import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Play, Undo2, Redo2, ZoomIn, ZoomOut,
  FileText, FolderOpen, Save, Printer, Trash2,
  Calendar, Settings, Info, Clock,
  Eye, EyeOff, SaveAll,
  Tags, ListOrdered, Hash,
  IndentIncrease, IndentDecrease,
  Users, BarChart3, Scale, Eraser, ChevronLeft, ChevronRight,
  ArrowLeftToLine, ArrowRightToLine, LayoutGrid, TrendingUp, CalendarDays, Palette,
  Keyboard, PanelRight,
  CalendarClock, ChevronsDownUp, ChevronsUpDown, Columns3,
  ClipboardCheck, ClipboardList,
} from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { COMMANDS } from '@/state/commands';
import { useCommandBinding } from './useCommandBinding';
import { addTaskNearSelection } from '@/state/taskInsertActions';
import { isTreeMode } from '@/engine/view/visibleRows';
import {
  saveShowBaselineOverlay, saveShowProgressLine, saveShowResourceAccent, saveShowStatusDateLine,
} from '@/utils/settingsStore';
import type { RibbonTab } from '@/state/slices/types';
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
  /** Tooltip (kleine én grote knoppen). */
  title?: string;
  /** Icoon-override voor knoppen die van staat wisselen (bv. Eye/EyeOff). */
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
    const { t } = useTranslation('task');
    const { t: tMenu } = useTranslation('menu');
    const hasSelection = useAppStore(s => s.selectedTaskIds.length > 0);
    const treeMode = useAppStore(s => isTreeMode(s.view));
    // Issue #49: de knop zette de nieuwe taak altijd onderaan de lijst. Nu volgt hij de selectie
    // (zie `addTaskNearSelection`). Net als bij de relatie-dropdown hangt het gedrag dus van
    // de selectie af, en net als daar zegt de tooltip vooraf wélke van de twee er nu
    // gebeurt — anders is "waarom staat mijn taak onderaan?" opnieuw een verrassing.
    return {
      title: hasSelection && treeMode ? tMenu('ribbon.taskHintBelow') : tMenu('ribbon.taskHintAppend'),
      onClick: () => addTaskNearSelection({ name: t('defaultTask') }),
    };
  },
};

const relationDropdownItem: RibbonComponentSpec = {
  kind: 'component', id: 'relation', Component: RelationDropdown,
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

/**
 * Taken-groep: Taak / Mijlpaal / Relatie — gedeeld door de Start- én de Tabel-tab.
 *
 * Issue #49, tweede punt van de melder: de Tabel-tab had alleen Bereken + Taak, terwijl de Tabel
 * net zo goed een takenweergave is ("not all task-related buttons are displayed under the Table
 * tab"). Bewust ÉÉN gedeelde groep-definitie in plaats van een tweede lijst met dezelfde items —
 * anders drijven de twee tabbladen bij de volgende taakknop opnieuw uit elkaar.
 */
const tasksGroup: RibbonGroupSpec = {
  id: 'tasks', labelKey: 'menu:ribbon.tasks',
  items: [
    addTaskButton,
    { kind: 'component', id: 'milestone', Component: MilestoneDropdown },
    relationDropdownItem,
  ],
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

/**
 * Bestand-groep: Nieuw / Opslaan / Openen / Opslaan als / Recent / Exporteren — gedeeld door de
 * Start- én de Tabel-tab. Documentacties zijn weergave-onafhankelijk: opslaan slaat hetzelfde
 * project op of je nu naar de Gantt of naar de tabel kijkt.
 */
const fileGroup: RibbonGroupSpec = {
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
          use: () => useCommandBinding(COMMANDS.save),
        },
        {
          kind: 'small', id: 'open', icon: <FolderOpen size={14} />, labelKey: 'menu:ribbon.open',
          use: () => useCommandBinding(COMMANDS.open),
        },
      ],
    },
    {
      // Save As + Recent + Export horen sámen in één verticale kolom (reviewbevinding pakket P:
      // los geplaatst renderden ze horizontaal en werd de groep ~2× zo breed).
      kind: 'stack', id: 'fileStack2', items: [
        {
          kind: 'small', id: 'saveAs', icon: <SaveAll size={14} />, labelKey: 'menu:backstage.saveAs',
          use: () => useCommandBinding(COMMANDS.saveAs),
        },
        { kind: 'component', id: 'recentFiles', Component: RecentFilesDropdown },
        { kind: 'component', id: 'export', Component: ExportDropdown },
      ],
    },
  ],
};

/**
 * Bewerken-groep: Ongedaan maken / Opnieuw / Verwijderen — gedeeld door de Start- én de Tabel-tab.
 * Alle drie werken op de store en op `selectedTaskIds`, en de tabel deelt die selectie met de
 * Gantt; ze doen in de tabelweergave dus letterlijk hetzelfde.
 */
const editGroup: RibbonGroupSpec = {
  id: 'edit', labelKey: 'menu:ribbon.edit',
  items: [
    {
      kind: 'stack', id: 'editStack', items: [
        {
          kind: 'small', id: 'undo', icon: <Undo2 size={14} />, labelKey: 'menu:ribbon.undo',
          use: () => useCommandBinding(COMMANDS.undo),
        },
        {
          kind: 'small', id: 'redo', icon: <Redo2 size={14} />, labelKey: 'menu:ribbon.redo',
          use: () => useCommandBinding(COMMANDS.redo),
        },
        {
          kind: 'small', id: 'delete', icon: <Trash2 size={14} />, labelKey: 'menu:ribbon.delete', danger: true,
          use: () => useCommandBinding(COMMANDS.delete),
        },
      ],
    },
  ],
};

/** Bereken-groep (start + table) — één groepsdefinitie zodat de twee tabbladen niet uit elkaar lopen. */
const scheduleGroup: RibbonGroupSpec = {
  id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton],
};

/**
 * Kolommen-groep op de Tabel-tab. De knop opent dezelfde gedeelde kiezer als de primaire plus in
 * het grid; vanaf Beeld schakelt de gedeelde binding eerst naar deze surface.
 */
const tableColumnsGroup: RibbonGroupSpec = {
  // Groepskop zonder beletselteken (`menu:ribbon.columns` is "Kolommen…", een knoplabel);
  // `common:view.columns.title` bestaat al in alle veertien talen.
  id: 'tableColumns', labelKey: 'common:view.columns.title',
  items: [{
    kind: 'button', id: 'tableColumns', icon: <Columns3 size={20} />, labelKey: 'menu:ribbon.columns',
    use: useColumnsButtonBinding,
  }],
};

// ── Per-tab configuratie ─────────────────────────────────────────────────────────────────────

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
            kind: 'small', id: 'zoomIn', icon: <ZoomIn size={14} />, labelKey: 'menu:ribbon.zoomIn',
            use: () => useCommandBinding(COMMANDS.zoomIn),
          },
          {
            kind: 'small', id: 'zoomOut', icon: <ZoomOut size={14} />, labelKey: 'menu:ribbon.zoomOut',
            use: () => useCommandBinding(COMMANDS.zoomOut),
          },
        ],
      },
    ],
  },
];

/** "Project verplaatsen…" (pakket D1) — schema-BREDE operatie, dus in de `schedule`-groep naast
 *  Bereken; geen structuur-, kalender- of baseline-actie. Uitgeschakeld zonder projectstartdatum
 *  (die is het referentiepunt van de verschuiving, R9). */
const moveProjectButton: RibbonButtonSpec = {
  kind: 'button', id: 'moveProject', icon: <CalendarClock size={20} />, labelKey: 'menu:ribbon.moveProject',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasStart = useAppStore(s => !!s.project.startDate);
    return { onClick: () => setUI({ showMoveProjectDialog: true }), disabled: !hasStart };
  },
};

/** E2 (issue #27 etappe 2): "Voortgang bijwerken uit een blad" — hetzelfde spec op Planning én Tabel
 *  (één bron, twee callsites; zelfde patroon als `openResourcePanelButton`/`calcButton`). Uitgeschakeld
 *  zonder taken: een blad kan dan sowieso niets koppelen (zelfde lijn als `moveProjectButton`). */
const progressImportButton: RibbonButtonSpec = {
  kind: 'button', id: 'progressImport', icon: <ClipboardCheck size={20} />, labelKey: 'menu:ribbon.progressImport',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasTasks = useAppStore(s => s.tasks.length > 0);
    return { onClick: () => setUI({ showProgressImportDialog: true }), disabled: !hasTasks };
  },
};

/** E7 (eigenaarsbesluit 2026-09-05): "gewoon op een knop klikken en dan krijg ik de juiste CSV in
 *  mijn downloads" — het slanke voortgangsblad (`progress-csv`, `writeProgressSheetCSV`) via één
 *  knopdruk, vóór de importknop in dezelfde gedeelde groep (Planning + Tabel). `disabled` volgt
 *  hetzelfde patroon als `progressImportButton`: zonder taken is er niets te exporteren. */
const progressExportButton: RibbonButtonSpec = {
  kind: 'button', id: 'progressExport', icon: <ClipboardList size={20} />, labelKey: 'menu:ribbon.progressExport',
  use: () => {
    const exportAs = useAppStore(s => s.exportAs);
    const hasTasks = useAppStore(s => s.tasks.length > 0);
    return { onClick: () => { void exportAs('progress-csv'); }, disabled: !hasTasks };
  },
};

/** Afwijking 2026-09-04 (gebruikstest): `progressImportButton` in zijn EIGEN groep, gedeeld door
 *  Planning en Tabel — niet als losse knop náást een `kind: 'component'`-item (dat werkte op
 *  Planning eerst zo in de `baselines`-groep naast `BaselinesProgressGroupContent`). Een `RibbonButtonSpec`
 *  rendert zijn label/knopvormgeving alleen binnen de generieke knoppenlaag van een groep; naast een
 *  component gemengd render je hem als kaal icoontje zonder label of knopvormgeving (bevestigd met
 *  screenshot). Vandaar een eigen groep op beide tabs i.p.v. het item in een bestaande groep te hangen.
 *  Mag NIET op Start belanden: de gedeelde `startTab`-constanten (`scheduleGroup` e.d.) blijven
 *  onaangeraakt, deze groep wordt alleen los aan `planningTab`/`tableTab` toegevoegd.
 *  `progressExportButton` staat VÓÓR de importknop (E7): eerst het blad eraf, dan terug erin. */
const progressGroup: RibbonGroupSpec = {
  id: 'progress', labelKey: 'menu:ribbon.progressGroup', items: [progressExportButton, progressImportButton],
};

const planningTab: RibbonTabConfig = [
  { id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton, moveProjectButton] },
  {
    id: 'relations', labelKey: 'menu:ribbon.relations',
    items: [relationDropdownItem],
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
            // Aanvulling op de gedeelde binding: buiten boommodus krijgt de UITGESCHAKELDE knop
            // een tooltip die uitlegt waarom. De sneltoets kan dat niet en toont in plaats daarvan
            // een melding — zie de toelichting bij `COMMANDS.indent`.
            use: () => {
              const binding = useCommandBinding(COMMANDS.indent);
              const treeMode = useAppStore(s => isTreeMode(s.view));
              const { t: tCommon } = useTranslation('common');
              return { ...binding, title: !treeMode ? tCommon('view.structureLockedHint') : undefined };
            },
          },
          {
            kind: 'small', id: 'outdent', icon: <IndentDecrease size={14} />, labelKey: 'menu:ribbon.outdent',
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

/**
 * Gedeelde item-specs (issue #46c): "Resources", "Resourcedock" en "Histogram" staan zowel op de
 * Resources-tab als onder Beeld → Panelen. Bewust GEDUPLICEERD (niet verplaatst) — de melder vroeg
 * er expliciet om ze ook onder Beeld te zien, zonder ze bij Resources weg te halen. Eén definitie,
 * twee callsites, in lijn met `calcButton`/`relationDropdownItem`/`calendarButton`/`printPreviewButton`
 * hierboven.
 *
 * Naamgeving (issue #46, slot): de twee resourceknoppen doen ECHT iets anders — `openResourcePanel`
 * zet `resourcePanelDocked:false` (het volledige paneel, dat de werkruimte overneemt),
 * `dockResourcePanel` zet `resourcePanelDocked:true` (de compacte rail in de zijkolom). Ze heten
 * daarom verschillend ("Resources" vs "Resourcedock") en dragen een verschillend icoon — op béide
 * tabbladen hetzelfde. Een eerdere ronde noemde de dock onder Beeld óók "Resources" met hetzelfde
 * `Users`-icoon; dat verplaatste de verwarring alleen maar van binnen-één-tab naar over-tabs-heen.
 */

/** Het volledige resourcepaneel — Resources-tab én Beeld → Panelen (dezelfde spec, twee callsites). */
const openResourcePanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'openResourcePanel', icon: <Users size={20} />, labelKey: 'menu:ribbon.openResourcePanel',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const { t } = useTranslation('menu');
    return {
      onClick: () => setUI({ showResourcePanel: true, resourcePanelDocked: false }),
      active: showResourcePanel && !resourcePanelDocked,
      title: t('ribbon.openResourcePanelTitle'),
    };
  },
};

/**
 * De gedockte compacte rail. Icoon: `PanelRight` — het paneel-in-de-zijkolom-glyph (rechthoek met
 * een afgescheiden zijvak), dezelfde conventie als VS Code/Figma voor precies deze schakelaar. Het
 * zegt WAAR het paneel komt; `Users` zegt WAT erin staat en hoort daarom bij de knop hierboven.
 * Geen pijlpunt (`PanelRightOpen`/`-Close`) — dat detail valt weg op 20 px en in de compacte strip.
 * Geen icoonwissel bij aan/uit: net als de Histogram-knop ernaast is de actief-markering van het
 * lint de terugkoppeling. In RTL (`ar`/`fa`) staat de rail gemeten aan de LINKERkant, dus daar
 * spiegelt het glyph mee — zie `.ribbon-btn-icon .ops-icon-rail` in Ribbon.css.
 */
const dockResourcePanelButton: RibbonButtonSpec = {
  kind: 'button', id: 'dockResourcePanel', icon: <PanelRight size={20} className="ops-icon-rail" />,
  labelKey: 'menu:ribbon.dockResourcePanel',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
    const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
    const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
    const { t } = useTranslation('menu');
    // Issue #46 (slot): exact dezelfde vorm als de Eigenschappen-knop hiernaast — actief ⇔
    // zichtbaar, en klikken op een niet-actieve knop maakt het paneel gegarandeerd zichtbaar
    // (`setUI`-invariant 1 klapt de rail zo nodig uit). Vóór deze ronde las `active` alleen de
    // aan-vlag, waardoor de knop kon oplichten terwijl de kolom ingeklapt was.
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

const toggleHistogramButton: RibbonButtonSpec = {
  kind: 'button', id: 'toggleHistogram', icon: <BarChart3 size={20} />, labelKey: 'menu:ribbon.toggleHistogram',
  // Aanvulling op de gedeelde binding: een schakelaar toont zijn STAND. Het omzetten zelf
  // (inclusief het persisteren) zit in het commando, gedeeld met Ctrl+Shift+H.
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
        kind: 'button', id: 'newResource', icon: <Plus size={20} />, labelKey: 'menu:ribbon.newResource',
        // Issue #48-1: deze knop persisteerde direct een NAAMLOZE resource (`addResource` ⇒ undo-stap
        // + een lege rij die blijft staan als je niets typt), terwijl de "+ Nieuwe resource"-knop in
        // het paneel al gesaneerd was tot een concept-rij (critreview-bevinding F10). Nu neemt de
        // lintknop diezelfde route: alleen een verzoek-vlag zetten, `ResourcePanel` opent de draft en
        // maakt pas bij een niet-lege naam écht een resource aan — in de bibliotheek of het project,
        // afhankelijk van de actieve weergave. Daarom ook expliciet `resourcePanelDocked: false`
        // (zoals `openResourcePanel` hierboven): in de gedockte rail bestaat het paneel niet en is de
        // naam readonly, dus daar zou de zojuist aangevraagde resource onbenoembaar zijn.
        use: () => {
          const setUI = useAppStore(s => s.setUI);
          return {
            onClick: () => setUI({ showResourcePanel: true, resourcePanelDocked: false, pendingNewResource: true }),
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
      toggleHistogramButton,
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

/**
 * Overzicht-groep (issue #35 punt 3): in- en uitklappen zijn APARTE knoppen, niet één toggle —
 * met een toggle kun je een gemengde selectie nooit in één keer dezelfde kant op zetten.
 *
 * De knoppen zijn MODUS-BEWUST en dus nooit uitgeschakeld:
 *  - boommodus: de selectie; zonder selectie het hele plan (`collapseTasks`/`expandTasks`);
 *  - gegroepeerde weergave: alle groepsbanden (`collapseAllGroups`/`expandAllGroups`), want daar
 *    negeert `computeViewRows` de taak-collapse volledig — de bandkoppen nemen het over.
 * Een taakselectie heeft in gegroepeerde weergave bewust GEEN effect: dezelfde taak kan in
 * meerdere banden vallen (resource-groepering) en een band is geen taak, dus er is geen zinnige
 * vertaling van "deze taken" naar "deze banden". Alles-of-niets is daar het enige eerlijke gedrag.
 */
const outlineGroup: RibbonGroupSpec = {
  id: 'outline', labelKey: 'menu:ribbon.outline',
  items: [{
    kind: 'stack', id: 'outlineStack', items: [
      {
        kind: 'small', id: 'collapseTasks', icon: <ChevronsDownUp size={14} />, labelKey: 'menu:ribbon.collapseTasks',
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
        kind: 'small', id: 'expandTasks', icon: <ChevronsUpDown size={14} />, labelKey: 'menu:ribbon.expandTasks',
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
  { id: 'display', labelKey: 'menu:ribbon.display', items: [{ kind: 'component', id: 'display', Component: DisplayGroupContent }] },
  outlineGroup,
  { id: 'layout', labelKey: 'menu:ribbon.layout', items: [{ kind: 'component', id: 'layout', Component: LayoutGroupContent }] },
  { id: 'presentation', labelKey: 'menu:ribbon.presentationMode', items: [{ kind: 'component', id: 'presentation', Component: PresentationGroupContent }] },
  {
    id: 'panels', labelKey: 'menu:ribbon.panels',
    items: [
      {
        kind: 'button', id: 'properties', icon: <Eye size={20} />, labelKey: 'menu:ribbon.properties',
        // Issue #46c-nasleep: `!rightPanelCollapsed` is niet hetzelfde als "de rail staat er". Het
        // VOLLEDIGE resource-paneel vervangt de hele werkruimte (App.tsx `isFullPanel`), dus dan
        // lichtte deze knop actief op naast een rail die niet bestond, en deed een klik niets.
        // De andere `isFullPanel`-termen (tabbladen table/relations/ifc/report) kunnen hier niet
        // spelen: deze knop staat op de Beeld-tab.
        //
        // Issue #46 (slot): de rail huisvest nu twee GELIJKWAARDIGE panelen, elk met een eigen
        // aan/uit. Deze knop is die schakelaar voor Eigenschappen — de tegenhanger van
        // "Resourcedock" ernaast, met exact dezelfde vorm:
        //
        //     actief  ⇔  je ziet dit paneel nu
        //     klik op een NIET-actieve knop  ⇒  je ziet het paneel daarna gegarandeerd
        //
        // Die tweede regel is de #46c-belofte, en hij is hier niet met de hand ingebouwd maar
        // afgedwongen in `setUI` (invariant 1b): het paneel aanzetten klapt zo nodig de rail uit.
        // Het UITzetten laat `rightPanelCollapsed` bewust met rust — dat veld is de tijdelijke
        // "geef de Gantt de breedte"-stand, geen paneelkeuze.
        use: () => {
          const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
          const showPropertiesPanel = useAppStore(s => s.ui.showPropertiesPanel);
          const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
          const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
          const setUI = useAppStore(s => s.setUI);
          const railVisible = !rightPanelCollapsed && !(showResourcePanel && !resourcePanelDocked);
          const visible = railVisible && showPropertiesPanel;
          return {
            icon: visible ? <Eye size={20} /> : <EyeOff size={20} />,
            active: visible,
            onClick: () => setUI(visible ? { showPropertiesPanel: false } : { showPropertiesPanel: true }),
          };
        },
      },
      // Issue #46c + slot: dezelfde paneelschakelaars als op de Resources-tab (gedeelde specs
      // hierboven), inclusief het volledige resourcepaneel. Zo staat in deze ene groep het hele
      // aanbod aan panelen bij elkaar — Eigenschappen, Resources, Resourcedock, Histogram — en is
      // het verschil tussen de twee resourceknoppen zichtbaar in plaats van verstopt per tabblad.
      openResourcePanelButton,
      dockResourcePanelButton,
      toggleHistogramButton,
    ],
  },
  {
    id: 'overlays', labelKey: 'menu:ribbon.baselines',
    items: [
      {
        kind: 'stack', id: 'overlaysStack', items: [
          {
            kind: 'small', id: 'toggleBaselineOverlay', icon: <LayoutGrid size={14} />, labelKey: 'menu:ribbon.toggleBaselineOverlay',
            use: () => {
              const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
              const setUI = useAppStore(s => s.setUI);
              return { active: showBaselineOverlay, onClick: () => { const next = !showBaselineOverlay; setUI({ showBaselineOverlay: next }); void saveShowBaselineOverlay(next); } };
            },
          },
          {
            kind: 'small', id: 'toggleProgressLine', icon: <TrendingUp size={14} />, labelKey: 'menu:ribbon.toggleProgressLine',
            use: () => {
              const showProgressLine = useAppStore(s => s.ui.showProgressLine);
              const setUI = useAppStore(s => s.setUI);
              return { active: showProgressLine, onClick: () => { const next = !showProgressLine; setUI({ showProgressLine: next }); void saveShowProgressLine(next); } };
            },
          },
          {
            kind: 'small', id: 'toggleStatusDateLine', icon: <CalendarDays size={14} />, labelKey: 'menu:ribbon.toggleStatusDateLine',
            use: () => {
              const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);
              const setUI = useAppStore(s => s.setUI);
              return { active: showStatusDateLine, onClick: () => { const next = !showStatusDateLine; setUI({ showStatusDateLine: next }); void saveShowStatusDateLine(next); } };
            },
          },
        ],
      },
      // De vaste linthoogte draagt drie kleine knoppen per stack. Kleurmodus en resource-accent
      // vormen daarom samen de tweede verticale kolom, niet twee losse horizontale groepsitems.
      {
        kind: 'stack', id: 'colorAccentStack', items: [
          { kind: 'component', id: 'screenColors', Component: ScreenColorsPopoverButton },
          {
            kind: 'small', id: 'toggleResourceAccent', icon: <Palette size={14} />, labelKey: 'menu:ribbon.toggleResourceAccent',
            use: () => {
              const showResourceAccent = useAppStore(s => s.ui.showResourceAccent);
              const setUI = useAppStore(s => s.setUI);
              return { active: showResourceAccent, onClick: () => { const next = !showResourceAccent; setUI({ showResourceAccent: next }); void saveShowResourceAccent(next); } };
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
  {
    id: 'shortcuts', labelKey: 'common:shortcuts.title',
    items: [{
      kind: 'small', id: 'shortcuts', icon: <Keyboard size={14} />, labelKey: 'common:shortcuts.title',
      use: () => { const setUI = useAppStore(s => s.setUI); return { onClick: () => setUI({ showShortcutsDialog: true }) }; },
    }],
  },
];

/**
 * Tabel-tab: de Start-tab min de zoomknoppen, plus één tabel-eigen groep.
 *
 * Issue #49 bracht de Taken-groep hierheen; de vervolgvraag van de melder was "alles van Start
 * hoort ook op Tabel, behalve zoom". Dat klopt inhoudelijk: Bestand, Bewerken, Taken en Bereken
 * werken allemaal op de store en op `selectedTaskIds` — die selectie deelt de tabel met de Gantt,
 * dus elke knop doet hier precies hetzelfde als op Start. **Zoom is de enige uitzondering**: dat
 * schaalt de tijdas van de Gantt (`view.zoom` → `GanttRenderer`) en heeft in een tabel geen
 * betekenis. Dezelfde redenering als bij de zes Gantt-schakelaars in `docs/TODO.md` — een knop
 * aanbieden in een weergave waar hij niets kan doen, is geen volledigheid maar een valstrik.
 *
 * De eerste vijf groepen zijn dezelfde module-scope constanten die `startTab` gebruikt (geen kopie),
 * zodat een volgende knop op Start hier automatisch meekomt. **Uitzondering (E2, issue #27 etappe 2):**
 * `progressGroup` (gedeeld met Planning, zie daar) hangt hier ACHTERAAN als eigen groep — niet in de
 * gedeelde `scheduleGroup`, want een knop dáár zou automatisch ook op Start verschijnen, en de
 * voortgangsimport is bewust alleen op Backstage → Importeren, Planning en Tabel te vinden.
 */
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

const reportTab: RibbonTabConfig = [
  { id: 'reporting', labelKey: 'menu:ribbon.reporting', items: [printPreviewButton] },
];

/** AI-tab (T14/T15/T16) — conditioneel zichtbaar (alleen bij `ui.aiMode`; zie Ribbon.tsx). Vier
 *  groepen, alle component-escape-hatches (eigen state, inputs, popover/confirm). De veiligheidsgroep
 *  (pauze/alleen-lezen/backup) is T16; de activiteit-groep (T15) toggelt het activiteitenpaneel. */
const aiTab: RibbonTabConfig = [
  { id: 'aiServer', labelKey: 'menu:ribbon.aiServer', items: [{ kind: 'component', id: 'aiServer', Component: AiServerGroup }] },
  { id: 'aiConnection', labelKey: 'menu:ribbon.aiConnection', items: [{ kind: 'component', id: 'aiConnection', Component: AiConnectionGroup }] },
  { id: 'aiSafety', labelKey: 'menu:ribbon.aiSafety', items: [{ kind: 'component', id: 'aiSafety', Component: AiSafetyGroup }] },
  { id: 'aiActivity', labelKey: 'menu:ribbon.aiActivity', items: [{ kind: 'component', id: 'aiActivity', Component: AiActivityGroup }] },
];

/** De registry: actieve-tab → groepen. 'file' heeft geen ribbon-inhoud (Backstage neemt over). */
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
