import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveRightPanelWidth, RIGHT_PANEL_MIN_WIDTH } from '@/utils/settingsStore';
import { setNoneLabelValue } from '@/utils/noneLabel';
import { TitleBar } from '@/components/layout/TitleBar/TitleBar';
import '@/components/layout/TitleBar/TitleBar.css';
import { Ribbon } from '@/components/layout/Ribbon/Ribbon';
import { StatusBar } from '@/components/layout/StatusBar/StatusBar';
import { GanttCanvas } from '@/components/canvas/GanttCanvas';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { TableEditor } from '@/components/panels/TableEditor';
import { ResourcePanel } from '@/components/panels/ResourcePanel';
import { ResourcePanelCompact } from '@/components/panels/ResourcePanelCompact';
import { RelationsPanel } from '@/components/panels/RelationsPanel';
import { PresentationHint } from '@/components/layout/PresentationHint';
import { DocumentTabBar } from '@/components/layout/DocumentChrome/DocumentTabBar';
import { ProjectRail } from '@/components/layout/DocumentChrome/ProjectRail';
import { ProjectOverview } from '@/components/layout/DocumentChrome/ProjectOverview';
import { CloseDocumentDialog } from '@/components/layout/DocumentChrome/CloseDocumentDialog';
import { useKeyboardShortcuts } from '@/hooks/keyboard/useKeyboardShortcuts';
import { useSettingsBootstrap } from '@/hooks/useSettingsBootstrap';
import { useAutoCalcCPM } from '@/hooks/useAutoCalcCPM';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useRecoveryRestore } from '@/hooks/useRecoveryRestore';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { useFullscreenSync } from '@/hooks/useFullscreenSync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSplitter } from '@/hooks/useSplitter';
import { useAppStore } from '@/state/appStore';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { HourDataNotice } from '@/components/layout/HourDataNotice';

// Code-splitting (pakket E2): componenten die pas achter een `ui.show*`-vlag, een ribbontab of een
// overlay renderen worden lazy geladen, zodat hun code niet in de eager first-load-bundel zit maar
// pas wordt opgehaald bij openen. De altijd-gemounte chrome (TitleBar/Ribbon/StatusBar/GanttCanvas/
// TaskPropertiesPanel/TableEditor/Resource-/Relations-panelen/DocumentChrome) blijft eager. Named
// exports ⇒ .then(m => ({ default: m.X })). Gedrag (welke conditie toont wat, welke props) ongewijzigd;
// elke lazy-render zit in een <Suspense fallback={null}> — een dialoog/overlay die 1 frame later
// verschijnt is prima.
const IFCPanel = lazy(() => import('@/components/panels/IFCPanel').then(m => ({ default: m.IFCPanel })));
const ReportPanel = lazy(() => import('@/components/panels/ReportPanel').then(m => ({ default: m.ReportPanel })));
const DebugTerminal = lazy(() => import('@/components/panels/DebugTerminal').then(m => ({ default: m.DebugTerminal })));
const TaskDialog = lazy(() => import('@/components/dialogs/TaskDialog').then(m => ({ default: m.TaskDialog })));
const ProjectInfoDialog = lazy(() => import('@/components/dialogs/ProjectInfoDialog').then(m => ({ default: m.ProjectInfoDialog })));
const SettingsDialog = lazy(() => import('@/components/dialogs/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const CalendarDialog = lazy(() => import('@/components/dialogs/CalendarDialog').then(m => ({ default: m.CalendarDialog })));
const StructureDialog = lazy(() => import('@/components/dialogs/StructureDialog').then(m => ({ default: m.StructureDialog })));
const UpdateDialog = lazy(() => import('@/components/dialogs/UpdateDialog').then(m => ({ default: m.UpdateDialog })));
const FeedbackDialog = lazy(() => import('@/components/dialogs/FeedbackDialog').then(m => ({ default: m.FeedbackDialog })));
const LevelingDialog = lazy(() => import('@/components/dialogs/LevelingDialog').then(m => ({ default: m.LevelingDialog })));
const BaselineDialog = lazy(() => import('@/components/dialogs/BaselineDialog').then(m => ({ default: m.BaselineDialog })));
const MoveProjectDialog = lazy(() => import('@/components/dialogs/MoveProjectDialog').then(m => ({ default: m.MoveProjectDialog })));
const ColumnsDialog = lazy(() => import('@/components/dialogs/ColumnsDialog').then(m => ({ default: m.ColumnsDialog })));
const FilterDialog = lazy(() => import('@/components/dialogs/FilterDialog').then(m => ({ default: m.FilterDialog })));
const LayoutsDialog = lazy(() => import('@/components/dialogs/LayoutsDialog').then(m => ({ default: m.LayoutsDialog })));
const ShortcutsDialog = lazy(() => import('@/components/dialogs/ShortcutsDialog').then(m => ({ default: m.ShortcutsDialog })));
const BenchmarkDialog = lazy(() => import('@/components/dialogs/BenchmarkDialog').then(m => ({ default: m.BenchmarkDialog })));
const RecoveryDialog = lazy(() => import('@/components/dialogs/RecoveryDialog').then(m => ({ default: m.RecoveryDialog })));
const WelcomeDialog = lazy(() => import('@/components/dialogs/WelcomeDialog').then(m => ({ default: m.WelcomeDialog })));
const TourOverlay = lazy(() => import('@/components/tour/TourOverlay').then(m => ({ default: m.TourOverlay })));
const Backstage = lazy(() => import('@/components/backstage/Backstage').then(m => ({ default: m.Backstage })));

function AppContent() {
  useKeyboardShortcuts();
  const { t } = useTranslation('common');

  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const showProjectInfoDialog = useAppStore(s => s.ui.showProjectInfoDialog);
  const showNewProjectDialog = useAppStore(s => s.ui.showNewProjectDialog);
  const showSettingsDialog = useAppStore(s => s.ui.showSettingsDialog);
  const showCalendarDialog = useAppStore(s => s.ui.showCalendarDialog);
  const showStructureDialog = useAppStore(s => s.ui.showStructureDialog);
  const showFeedbackDialog = useAppStore(s => s.ui.showFeedbackDialog);
  const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
  const resourcePanelDocked = useAppStore(s => s.ui.resourcePanelDocked);
  const showLevelingDialog = useAppStore(s => s.ui.showLevelingDialog);
  const showBaselineDialog = useAppStore(s => s.ui.showBaselineDialog);
  const showMoveProjectDialog = useAppStore(s => s.ui.showMoveProjectDialog);
  const showColumnsDialog = useAppStore(s => s.ui.showColumnsDialog);
  const showFilterDialog = useAppStore(s => s.ui.showFilterDialog);
  const showLayoutsDialog = useAppStore(s => s.ui.showLayoutsDialog);
  const showShortcutsDialog = useAppStore(s => s.ui.showShortcutsDialog);
  const showBenchmarkDialog = useAppStore(s => s.ui.showBenchmarkDialog);
  const showWelcomeDialog = useAppStore(s => s.ui.showWelcomeDialog);
  const showTourOverlay = useAppStore(s => s.ui.showTourOverlay);
  const presentationMode = useAppStore(s => s.ui.presentationMode);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const setUI = useAppStore(s => s.setUI);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);

  // Rechterpaneel-breedte slepen (fase 2.10, punt 3) — generiek splitterpatroon (useSplitter,
  // gedeeld met de takentabel-splitter in GanttCanvas): losse drag-state, window-listeners voor
  // move/up, klem tussen min/max, en pas persisteren (localStorage) bij loslaten. Anders dan de
  // canvas-splitter is dit een gewone DOM-sleeprand (het rechterpaneel is React/DOM, niet canvas),
  // en de klem is hier tweezijdig: min 200px (RIGHT_PANEL_MIN_WIDTH), max 60% van het venster
  // (dynamisch, i.p.v. een vaste breedte — het venster kan resizen tussen sessies).
  const rightPanelSplitter = useSplitter({
    min: RIGHT_PANEL_MIN_WIDTH,
    max: () => Math.round(window.innerWidth * 0.6),
    computeSize: e => Math.round(window.innerWidth - e.clientX),
    onResize: w => useAppStore.getState().setUI({ rightPanelWidth: w }),
    onCommit: () => { void saveRightPanelWidth(useAppStore.getState().ui.rightPanelWidth); },
  });

  // Recovery-restore bij opstarten (Tauri én web): detectie + RecoveryDialog-callbacks; levert ook
  // de auto-save-poort (`autoSaveEnabled`) en het reactieve "flow afgehandeld"-signaal.
  const { recovery, recoveryResolved, autoSaveEnabled } = useRecoveryRestore();

  // Settings-bootstrap: hydrateert ~20 instellingen + extensies bij mount, en toont de
  // welkomstdialoog zodra de recovery-flow is afgehandeld.
  useSettingsBootstrap(recoveryResolved, recovery);

  // Automatisch berekenen: runCPM zodra de planning verouderd raakt (als de instelling aanstaat).
  useAutoCalcCPM();

  // "(geen)"-bandlabel voor de gedeelde viewRows-pijplijn (fase 2.7, §4.1): de vertaalde
  // string wordt vanuit deze consument doorgegeven — de engine/store blijft i18n-vrij.
  const noneLabel = t('structure.none', { ns: 'task' });
  useEffect(() => {
    setNoneLabelValue(noneLabel);
    useAppStore.getState().recomputeViewRows();
  }, [noneLabel]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
  }, [uiTheme]);

  // Presentation mode (fase 2.7, §9.3): fullscreenchange-listener houdt de ui-flag in sync.
  useFullscreenSync();

  // Venstertitel volgt het actieve document (dirty-markering, projectnaam, bestandsnaam).
  useDocumentTitle();

  // Auto-save (Tauri én web, gedebounced 800 ms): recovery-snapshots per open document,
  // plus de web-only beforeunload-waarschuwing bij niet-opgeslagen wijzigingen.
  useAutoSave(autoSaveEnabled);

  // Stille opstart-update-check (Tauri-only).
  useUpdateCheck();

  // Determine if we should show the gantt canvas or a full-panel view.
  // Fase 2.10 (item 6): een GEDOCKT resource-paneel (`resourcePanelDocked`) sluit `showResourcePanel`
  // NIET meer in — de Gantt (incl. histogramstrook) blijft dan zichtbaar en de compacte
  // resource-lijst dockt in de rechter-rail (zie het dock-blok hieronder) in plaats van de hele
  // werkruimte te vervangen.
  const isFullPanel = (showResourcePanel && !resourcePanelDocked) || activeTab === 'table' || activeTab === 'relations' || activeTab === 'ifc' || activeTab === 'report';
  const resourceDocked = showResourcePanel && resourcePanelDocked;

  // Presentation mode (fase 2.7, §9.2): één wrapper-conditie i.p.v. losse `&& !presentationMode`-
  // guards door de hele boom — alle chrome (TitleBar/Ribbon/tabbar/brand-strip/rechterpaneel/
  // StatusBar/Backstage) valt weg; alleen de Gantt-kaart full-bleed (+ mini-map, indien aan) blijft.
  if (presentationMode) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-text-primary">
        <div className="flex-1 flex overflow-hidden">
          <GanttCanvas />
        </div>
        <PresentationHint />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-text-primary">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Ribbon Toolbar */}
      <Ribbon />

      {/* Uur-data-melding (§6.8): niet-blokkerende strook onder het lint wanneer een geladen
          bestand urenplanning bevat terwijl de hoofdschakelaar uit staat. */}
      <HourDataNotice />

      {/* Backstage view (File-tab actief) — neemt de volledige body over.
          Anders: gradient strip + main content. */}
      {activeTab === 'file' ? (
        <Suspense fallback={null}><Backstage /></Suspense>
      ) : (
        <>
      {/* A · Documenttabs — tabstrip onder het lint (multi-document) */}
      {documentChromeStyle === 'tabs' && <DocumentTabBar />}

      {/* Body-rij: optionele projectbalk (B) links + de werkruimte-kolom */}
      <div className="flex flex-1 overflow-hidden">
        {documentChromeStyle === 'rail' && <ProjectRail />}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* OpenAEC merk-accent strip — gradient amber → gold → orange (DESIGN-SYSTEM.md §2.1) */}
      <div aria-hidden className="brand-accent-strip" />

      {/* Main Content — getinte werkruimte met zwevende kaarten (spec §4) */}
      <div
        className="flex flex-1 overflow-hidden ui-workspace"
        style={{ padding: 12, gap: 12 }}
      >
        {isFullPanel ? (
          // Full panel views (Table, IFC, Report) — eigen kaart
          // data-tour-anchor (fase 2.10, onderdeel 3, tourstap 5): alleen gezet op het
          // Rapport-tabblad — dat is het enige full-panel-anker dat de tour gebruikt.
          <div
            className="ui-card flex-1 flex overflow-hidden"
            {...(activeTab === 'report' ? { 'data-tour-anchor': 'report-panel' } : {})}
          >
            {showResourcePanel ? (
              <ResourcePanel />
            ) : (
              <Suspense fallback={null}>
                {activeTab === 'table' && <TableEditor />}
                {activeTab === 'relations' && <RelationsPanel />}
                {activeTab === 'ifc' && <IFCPanel />}
                {activeTab === 'report' && <ReportPanel />}
              </Suspense>
            )}
          </div>
        ) : (
          // Gantt Chart view — zwevende kaart (Gantt + tabel samen). data-tour-anchor
          // (tourstap 2: taaktabel + Gantt).
          <div className="ui-card flex-1 flex overflow-hidden" data-tour-anchor="gantt-panel">
            <GanttCanvas />
          </div>
        )}

        {/* Right Panel: Properties (collapsible) — of, gedockt (fase 2.10 item 6), de compacte
            resource-lijst i.p.v. het eigenschappenpaneel. Mutueel exclusief (architect-besluit 5):
            één rail, geen tweede breedte/collapsed-veld. */}
        {!isFullPanel && (
          rightPanelCollapsed ? (
            <div
              className="ui-card cursor-pointer flex flex-col items-center justify-center gap-2 py-4 hover:bg-surface-hover overflow-hidden"
              style={{ width: 28 }}
              onClick={() => setUI({ rightPanelCollapsed: false })}
            >
              <ChevronLeft size={14} className="text-text-secondary" />
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {resourceDocked ? t('resource.compact.title') : t('properties')}
              </span>
            </div>
          ) : (
            <div
              className="ui-card flex flex-col overflow-hidden"
              style={{ width: rightPanelWidth, minWidth: 200, position: 'relative' }}
              data-tour-anchor="properties-panel"
            >
              {/* Sleepgrijpzone (fase 2.10, punt 3-correctie op user-feedback c8cce49) — geen
                  zichtbare balk meer (die kostte enkel ruimte); i.p.v. een aparte DOM-kolom nu
                  een onzichtbare, absoluut gepositioneerde grijpzone die over de linkerrand van
                  het paneel heen ligt (half erbinnen/erbuiten), zelfde patroon als de tabel/
                  chart-splitter in GanttCanvas (SPLITTER_GRAB_MARGIN: grijpmarge rond de rand,
                  geen aparte balk, geen kleur). `insetInlineStart` i.p.v. `left` zodat de zone in
                  RTL (ar/fa) automatisch mee-spiegelt naar de juiste (binnen)rand — de flex-rij
                  hierboven heeft geen expliciete `row-reverse`, dus de browser spiegelt 'm al bij
                  `dir="rtl"` op `<html>` (RTL_LOCALES); logical properties houden deze grijpzone
                  daarmee synchroon zonder aparte RTL-tak. Neemt geen ruimte in (geen invloed op
                  paneel-breedte/padding); alleen cursor, geen achtergrond/border. */}
              <div
                onMouseDown={e => { e.preventDefault(); rightPanelSplitter.start(); }}
                style={{
                  position: 'absolute',
                  insetInlineStart: -4,
                  top: 0,
                  bottom: 0,
                  width: 8,
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
                data-ops-right-panel-resize
              />
              <div className="flex items-center justify-between h-8 px-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {resourceDocked ? t('resource.compact.title') : t('properties')}
                </span>
                <div className="flex items-center gap-0.5">
                  {resourceDocked && (
                    <>
                      <button
                        onClick={() => setUI({ resourcePanelDocked: false })}
                        title={t('resource.compact.expandFull')}
                        className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                      >
                        <Maximize2 size={13} />
                      </button>
                      <button
                        onClick={() => setUI({ showResourcePanel: false, resourcePanelDocked: false })}
                        title={t('resource.compact.closeDock')}
                        className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setUI({ rightPanelCollapsed: true })}
                    className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {resourceDocked ? <ResourcePanelCompact /> : <TaskPropertiesPanel />}
              </div>
              {debugTerminalEnabled && debugTerminalOpen && (
                <Suspense fallback={null}><DebugTerminal /></Suspense>
              )}
            </div>
          )
        )}
      </div>
        </div>{/* /werkruimte-kolom */}
      </div>{/* /body-rij */}
        </>
      )}

      {/* Status Bar */}
      <StatusBar />

      {/* Projectoverzicht-overlay (gedeeld door alle multi-document-stijlen) */}
      <ProjectOverview />

      {/* Sluit-bevestiging bij niet-opgeslagen wijzigingen (3-weg) */}
      <CloseDocumentDialog />

      {/* Dialogs — lazy geladen (pakket E2); één Suspense-grens rond het hele blok. Alle dialogs
          zijn standaard verborgen (gated of intern `return null`), dus een null-fallback tijdens het
          laden van een chunk is onzichtbaar. */}
      <Suspense fallback={null}>
        <TaskDialog />
        {(showProjectInfoDialog || showNewProjectDialog) && <ProjectInfoDialog />}
        {showSettingsDialog && <SettingsDialog />}
        {showCalendarDialog && <CalendarDialog />}
        {showStructureDialog && <StructureDialog />}
        {showFeedbackDialog && <FeedbackDialog />}
        {showLevelingDialog && <LevelingDialog />}
        {showBaselineDialog && <BaselineDialog />}
        {showMoveProjectDialog && <MoveProjectDialog />}
        {showColumnsDialog && <ColumnsDialog />}
        {showFilterDialog && <FilterDialog />}
        {showLayoutsDialog && <LayoutsDialog />}
        {showShortcutsDialog && <ShortcutsDialog />}
        {showBenchmarkDialog && <BenchmarkDialog />}
        {showWelcomeDialog && <WelcomeDialog />}
        {showTourOverlay && <TourOverlay />}
        <UpdateDialog />
        {recovery && (
          <RecoveryDialog
            entries={recovery.entries}
            onRestore={recovery.onRestore}
            onDiscard={recovery.onDiscard}
            onClose={recovery.onClose}
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
