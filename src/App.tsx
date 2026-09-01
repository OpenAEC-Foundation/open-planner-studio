import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setNoneLabelValue } from '@/utils/noneLabel';
import { appLog } from '@/services/debug/appLog';
import { installConsentDialogAsker } from '@/extensions/consentBridge';
import { TitleBar } from '@/components/layout/TitleBar/TitleBar';
import '@/components/layout/TitleBar/TitleBar.css';
import { Ribbon } from '@/components/layout/Ribbon/Ribbon';
import { StatusBar } from '@/components/layout/StatusBar/StatusBar';
import { TooltipHost } from '@/components/common/Tooltip';
import { GanttWorkspace } from '@/components/canvas/GanttWorkspace';
import { FullTaskGrid } from '@/components/task-grid/FullTaskGrid';
import { ResourcePanel } from '@/components/panels/ResourcePanel';
import { PresentationHint } from '@/components/layout/PresentationHint';
import { RightRail } from '@/components/layout/RightRail/RightRail';
import { DocumentTabBar } from '@/components/layout/DocumentChrome/DocumentTabBar';
import { ProjectRail } from '@/components/layout/DocumentChrome/ProjectRail';
import { NewOrOpenProjectDialog } from '@/components/dialogs/NewOrOpenProjectDialog';
import { ProjectOverview } from '@/components/layout/DocumentChrome/ProjectOverview';
import { CloseDocumentDialog } from '@/components/layout/DocumentChrome/CloseDocumentDialog';
import { useKeyboardShortcuts } from '@/hooks/keyboard/useKeyboardShortcuts';
import { useSettingsBootstrap } from '@/hooks/useSettingsBootstrap';
import { useAutoCalcCPM } from '@/hooks/useAutoCalcCPM';
import { useExitRecordedDates } from '@/hooks/useExitRecordedDates';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useRecoveryRestore } from '@/hooks/useRecoveryRestore';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { useAiAutostart } from '@/hooks/useAiAutostart';
import { useFullscreenSync } from '@/hooks/useFullscreenSync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAppStore } from '@/state/appStore';
import { UI_FONT_STACKS } from '@/utils/uiFont';
import { HourDataNotice } from '@/components/layout/HourDataNotice';
import { StructureLockedNotice } from '@/components/layout/StructureLockedNotice';
import { DependencyModeNotice } from '@/components/layout/DependencyModeNotice';
import { RecordedDatesNotice } from '@/components/layout/RecordedDatesNotice';
import { NotificationHost } from '@/components/layout/NotificationHost';

// Code-splitting (pakket E2): componenten die pas achter een `ui.show*`-vlag, een ribbontab of een
// overlay renderen worden lazy geladen, zodat hun code niet in de eager first-load-bundel zit maar
// pas wordt opgehaald bij openen. De altijd-gemounte chrome (TitleBar/Ribbon/StatusBar/GanttWorkspace/
// TaskPropertiesPanel/FullTaskGrid/Resource-/Relations-panelen/DocumentChrome) blijft eager. Named
// exports ⇒ .then(m => ({ default: m.X })). Gedrag (welke conditie toont wat, welke props) ongewijzigd;
// elke lazy-render zit in een <Suspense fallback={null}> — een dialoog/overlay die 1 frame later
// verschijnt is prima.
const IFCPanel = lazy(() => import('@/components/panels/IFCPanel').then(m => ({ default: m.IFCPanel })));
const ReportPanel = lazy(() => import('@/components/panels/ReportPanel').then(m => ({ default: m.ReportPanel })));
const TaskDialog = lazy(() => import('@/components/dialogs/TaskDialog').then(m => ({ default: m.TaskDialog })));
const ProjectInfoDialog = lazy(() => import('@/components/dialogs/ProjectInfoDialog').then(m => ({ default: m.ProjectInfoDialog })));
const SettingsDialog = lazy(() => import('@/components/dialogs/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const CalendarDialog = lazy(() => import('@/components/dialogs/CalendarDialog').then(m => ({ default: m.CalendarDialog })));
const StructureDialog = lazy(() => import('@/components/dialogs/StructureDialog').then(m => ({ default: m.StructureDialog })));
const UpdateDialog = lazy(() => import('@/components/dialogs/UpdateDialog').then(m => ({ default: m.UpdateDialog })));
const JustUpdatedDialog = lazy(() => import('@/components/dialogs/JustUpdatedDialog').then(m => ({ default: m.JustUpdatedDialog })));
const ExtensionConsentDialog = lazy(() => import('@/components/dialogs/ExtensionConsentDialog').then(m => ({ default: m.ExtensionConsentDialog })));
const FeedbackDialog = lazy(() => import('@/components/dialogs/FeedbackDialog').then(m => ({ default: m.FeedbackDialog })));
const LevelingDialog = lazy(() => import('@/components/dialogs/LevelingDialog').then(m => ({ default: m.LevelingDialog })));
const BaselineDialog = lazy(() => import('@/components/dialogs/BaselineDialog').then(m => ({ default: m.BaselineDialog })));
const MoveProjectDialog = lazy(() => import('@/components/dialogs/MoveProjectDialog').then(m => ({ default: m.MoveProjectDialog })));
const ColumnsDialog = lazy(() => import('@/components/dialogs/ColumnsDialog').then(m => ({ default: m.ColumnsDialog })));
const FilterDialog = lazy(() => import('@/components/dialogs/FilterDialog').then(m => ({ default: m.FilterDialog })));
const LayoutsDialog = lazy(() => import('@/components/dialogs/LayoutsDialog').then(m => ({ default: m.LayoutsDialog })));
const ShortcutsDialog = lazy(() => import('@/components/dialogs/ShortcutsDialog').then(m => ({ default: m.ShortcutsDialog })));
const BenchmarkDialog = lazy(() => import('@/components/dialogs/BenchmarkDialog').then(m => ({ default: m.BenchmarkDialog })));
const PoolImportDialog = lazy(() => import('@/components/dialogs/PoolImportDialog').then(m => ({ default: m.PoolImportDialog })));
const ProgressImportDialog = lazy(() => import('@/components/dialogs/ProgressImportDialog').then(m => ({ default: m.ProgressImportDialog })));
const LibraryLinkDialog = lazy(() => import('@/components/dialogs/LibraryLinkDialog').then(m => ({ default: m.LibraryLinkDialog })));
const RecoveryDialog = lazy(() => import('@/components/dialogs/RecoveryDialog').then(m => ({ default: m.RecoveryDialog })));
const WelcomeDialog = lazy(() => import('@/components/dialogs/WelcomeDialog').then(m => ({ default: m.WelcomeDialog })));
const TourOverlay = lazy(() => import('@/components/tour/TourOverlay').then(m => ({ default: m.TourOverlay })));
const Backstage = lazy(() => import('@/components/backstage/Backstage').then(m => ({ default: m.Backstage })));

function AppContent() {
  useKeyboardShortcuts();
  const { t } = useTranslation('common');

  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const showProjectInfoDialog = useAppStore(s => s.ui.showProjectInfoDialog);
  const showNewProjectDialog = useAppStore(s => s.ui.showNewProjectDialog);
  const showNewOrOpenProjectDialog = useAppStore(s => s.ui.showNewOrOpenProjectDialog);
  const showSettingsDialog = useAppStore(s => s.ui.showSettingsDialog);
  const showCalendarDialog = useAppStore(s => s.ui.showCalendarDialog);
  const showStructureDialog = useAppStore(s => s.ui.showStructureDialog);
  const showFeedbackDialog = useAppStore(s => s.ui.showFeedbackDialog);
  const showPropertiesPanel = useAppStore(s => s.ui.showPropertiesPanel);
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
  const justUpdated = useAppStore(s => s.ui.justUpdated);
  const showUpdateDialog = useAppStore(s => s.ui.showUpdateDialog);
  const presentationMode = useAppStore(s => s.ui.presentationMode);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const uiFontFamily = useAppStore(s => s.ui.uiFontFamily);
  const uiFontScale = useAppStore(s => s.ui.uiFontScale);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);


  // Recovery-restore bij opstarten (Tauri én web): detectie + RecoveryDialog-callbacks; levert ook
  // de auto-save-poort (`autoSaveEnabled`) en het reactieve "flow afgehandeld"-signaal.
  const { recovery, recoveryResolved, autoSaveEnabled } = useRecoveryRestore();

  // Settings-bootstrap: hydrateert ~20 instellingen + extensies bij mount, en toont de
  // welkomstdialoog zodra de recovery-flow is afgehandeld.
  useSettingsBootstrap(recoveryResolved, recovery);

  // Toestemmingsvraag bij extensie-installatie bedraden (K-item 38). MOET eager en vroeg: de
  // faalstand van `askExtensionConsent` is WEIGEREN, dus zonder deze registratie zou een installatie
  // stilzwijgend afketsen. De dialoog zelf blijft lazy; alleen de bedrading is eager.
  useEffect(() => { installConsentDialogAsker(); }, []);

  // Bedrijfsbibliotheek laden bij opstarten (B1): zet de opgeslagen bibliotheek in de store en
  // hijst `libraryLoaded`, zodat latere mutaties persisteren (vóór dit punt is persist een no-op).
  // Fire-and-forget, maar mét .catch: een rejectende load (bv. IndexedDB stuk) mag nooit een
  // unhandled rejection worden — de fout gaat naar de log-bus.
  useEffect(() => {
    useAppStore.getState().initLibrary().catch((err) => {
      appLog.emit('error', 'library', 'initLibrary faalde', err);
    });
  }, []);

  // Verversingssignaal (spec §3, taak 18): discreet, zelf-opruimend na 4s. `libraryRefreshNotice`
  // wordt gezet door de grens-acties (taken 5/6/10/12) en NUL geeft géén melding — de guard hierboven
  // in de effect-body (early return) voorkomt dat elke render een nieuwe timer opzet.
  const libraryRefreshNotice = useAppStore(s => s.ui.libraryRefreshNotice);
  useEffect(() => {
    if (libraryRefreshNotice == null) return;
    const id = setTimeout(() => useAppStore.getState().setUI({ libraryRefreshNotice: null }), 4000);
    return () => clearTimeout(id);
  }, [libraryRefreshNotice]);

  // Automatisch berekenen: runCPM zodra de planning verouderd raakt (als de instelling aanstaat).
  useAutoCalcCPM();

  // "Datums zoals opgeslagen" (issue #63): rekent één keer door zodra de modus via een BEWERKING
  // wordt verlaten — F5 en de strook zelf roepen runCPM al rechtstreeks aan, dit dekt de rest.
  useExitRecordedDates();

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

  // Lettertype-interface toepassen (issue #25.4): de schaal stuurt de rem-basis (html font-size),
  // zodat Tailwind-`text-*`-klassen van meestijgen EN de losse px-font-sizes in de chrome-css
  // (die expliciet `calc(<n>px * var(--ui-font-scale, 1))` gebruiken). De familie overschrijft de
  // CSS-variabelen --font-heading/--font-body, of verwijdert ze bij 'default' zodat de stylesheet-
  // defaults (Space Grotesk / Inter) weer gelden. Eén effect = één render-pas bij wijzigen.
  // De stacks komen uit `@/utils/uiFont` — dezelfde tabel die `GanttCanvas` gebruikt om de
  // Canvas-2D-renderers hun `ctx.font`-familie te geven (een canvas leest geen CSS-variabelen).
  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--ui-font-scale', String(uiFontScale / 100));
    if (uiFontFamily === 'default') {
      style.removeProperty('--font-heading');
      style.removeProperty('--font-body');
    } else {
      const stack = UI_FONT_STACKS[uiFontFamily];
      style.setProperty('--font-heading', stack);
      style.setProperty('--font-body', stack);
    }
  }, [uiFontFamily, uiFontScale]);

  // Presentation mode (fase 2.7, §9.3): fullscreenchange-listener houdt de ui-flag in sync.
  useFullscreenSync();

  // Venstertitel volgt het actieve document (dirty-markering, projectnaam, bestandsnaam).
  useDocumentTitle();

  // Auto-save (Tauri én web, gethrottled op 10 s — zie useAutoSave voor waarom een throttle en
  // geen debounce): recovery-snapshots per open document,
  // plus de web-only beforeunload-waarschuwing bij niet-opgeslagen wijzigingen.
  useAutoSave(autoSaveEnabled);

  // Stille opstart-update-check (Tauri-only).
  useUpdateCheck();

  // MCP-bridge automatisch starten wanneer AI-modus én autostart aanstaan (Tauri-only; de hook
  // wacht op de asynchrone instellingen-hydratatie en start hoogstens één keer per app-sessie).
  useAiAutostart();

  // Determine if we should show the gantt canvas or a full-panel view.
  // Fase 2.10 (item 6): een GEDOCKT resource-paneel (`resourcePanelDocked`) sluit `showResourcePanel`
  // NIET meer in — de Gantt (incl. histogramstrook) blijft dan zichtbaar en de compacte
  // resource-lijst dockt in de rechter-rail (zie het dock-blok hieronder) in plaats van de hele
  // werkruimte te vervangen.
  const isFullPanel = (showResourcePanel && !resourcePanelDocked) || activeTab === 'table' || activeTab === 'ifc' || activeTab === 'report';
  // Issue #46 (slot): de rechterkolom bestaat alleen zolang er minstens één railpaneel aan staat.
  // Zet de gebruiker ze allebei uit via hun lintknop, dan verdwijnt de kolom — inclusief de
  // ingeklapte strip, want er valt dan niets terug te halen.
  const railHasPanel = showPropertiesPanel || (showResourcePanel && resourcePanelDocked);

  // Presentation mode (fase 2.7, §9.2): één wrapper-conditie i.p.v. losse `&& !presentationMode`-
  // guards door de hele boom — alle chrome (TitleBar/Ribbon/tabbar/brand-strip/rechterpaneel/
  // StatusBar/Backstage) valt weg; alleen de Gantt-kaart full-bleed (+ mini-map, indien aan) blijft.
  if (presentationMode) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-text-primary">
        <div className="flex-1 flex overflow-hidden">
          <GanttWorkspace />
        </div>
        <PresentationHint />
        {/* Gebruikersmeldingen (bevinding K8) — óók in de presentatiemodus: hier is verder geen
            chrome, dus een stille opslaafout mag juist niet onzichtbaar worden. */}
        <NotificationHost />
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

      {/* Structuur-vergrendeld-melding (issue #26): verschijnt wanneer in-/uitspringen geweigerd
          wordt omdat er gefilterd/gegroepeerd/gesorteerd wordt. */}
      <StructureLockedNotice />

      {/* Relatiemodus-strook (issue #40): zichtbaar zolang de Relatie-knop/het contextmenu de
          "plakkende Shift" heeft aangezet — sleep dan in de Gantt van balk naar balk. */}
      <DependencyModeNotice />

      {/* "Datums zoals opgeslagen"-strook (issue #63): aanbod ná het laden van een bestand waarvan
          herberekening de datums verschoof, of de modus zelf zolang hij aan staat. Bewust BOVEN de
          `activeTab === 'file'`-vertakking (net als de meldingen hierboven), zodat de strook
          zichtbaar blijft in élke weergave — Gantt, tabel, rapport én Backstage. */}
      <RecordedDatesNotice />

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
            {showResourcePanel && !resourcePanelDocked ? (
              <ResourcePanel />
            ) : (
              <Suspense fallback={null}>
                {activeTab === 'table' && <FullTaskGrid />}
                {activeTab === 'ifc' && <IFCPanel />}
                {activeTab === 'report' && <ReportPanel />}
              </Suspense>
            )}
          </div>
        ) : (
          // Gantt Chart view — zwevende kaart (Gantt + tabel samen). data-tour-anchor
          // (tourstap 2: taaktabel + Gantt).
          <div className="ui-card flex-1 flex overflow-hidden" data-tour-anchor="gantt-panel">
            <GanttWorkspace />
          </div>
        )}

        {/* Right Panel — issue #46 (slot): geen wederzijdse uitsluiting meer tussen het
            eigenschappenpaneel en de gedockte resourcelijst, maar TWEE GELIJKWAARDIGE panelen boven
            elkaar in dezelfde rail, met een sleepgrens ertussen. Nog steeds één rail en één breedte
            (dat deel van architect-besluit 5 staat overeind); nieuw is enkel de verticale as. Staat
            geen van beide panelen aan, dan is er geen kolom — vandaar `railHasPanel` hier en niet
            een lege `ui-card` in `RightRail`. Alle overige mechaniek zit in `RightRail`. */}
        {(!isFullPanel || activeTab === 'table') && railHasPanel && <RightRail />}
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
        {showNewOrOpenProjectDialog && <NewOrOpenProjectDialog />}
        {(showProjectInfoDialog || showNewProjectDialog) && <ProjectInfoDialog />}
        {showSettingsDialog && <SettingsDialog />}
        {showCalendarDialog && <CalendarDialog />}
        {showStructureDialog && <StructureDialog />}
        {showFeedbackDialog && <FeedbackDialog />}
        {showLevelingDialog && <LevelingDialog />}
        {showBaselineDialog && <BaselineDialog />}
        {showMoveProjectDialog && <MoveProjectDialog />}
        {showColumnsDialog && activeTab !== 'table' && <ColumnsDialog />}
        {showFilterDialog && <FilterDialog />}
        {showLayoutsDialog && <LayoutsDialog />}
        {showShortcutsDialog && <ShortcutsDialog />}
        {showBenchmarkDialog && <BenchmarkDialog />}
        {showWelcomeDialog && <WelcomeDialog />}
        {showTourOverlay && <TourOverlay />}
        <UpdateDialog />
        <PoolImportDialog />
        <ProgressImportDialog />
        <ExtensionConsentDialog />
        <LibraryLinkDialog />
        {recovery && (
          <RecoveryDialog
            entries={recovery.entries}
            onRestore={recovery.onRestore}
            onDiscard={recovery.onDiscard}
            onClose={recovery.onClose}
          />
        )}
        {justUpdated && recoveryResolved && recovery === null && !showUpdateDialog && !showWelcomeDialog && <JustUpdatedDialog />}
      </Suspense>

      {/* Verversingssignaal (spec §3, taak 18): discreet, verdwijnt na 4s (zie effect hierboven). */}
      {libraryRefreshNotice != null && libraryRefreshNotice > 0 && (
        <div
          // S1 (V2-vondst): pure melding, geen interactieve inhoud — zonder pointer-events-none
          // onderschept deze 4 seconden lang klikken op de UI eronder (elementFromPoint bewees dit).
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-[10px] bg-surface border border-border shadow-[var(--shadow-pop)] text-xs pointer-events-none"
          data-ops-library-refresh-notice
        >
          {t('companyLibrary.refreshNotice', { count: libraryRefreshNotice })}
        </div>
      )}

      {/* Gebruikersmeldingen (bevinding K8) — buiten de Backstage-vertakking gemount (ná het
          Suspense-dialogenblok, als laatste kind van de buitenste div), zodat een opslaafout óók
          zichtbaar is wanneer de File-tab (Backstage) de body overneemt. */}
      <NotificationHost />
      <TooltipHost />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
