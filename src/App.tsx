import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { initLocale } from '@/i18n/config';
import { initTheme, loadZoomSettings, loadDebugTerminalEnabled, loadDocumentChromeStyle } from '@/utils/settingsStore';
import { loadAllExtensions } from '@/extensions';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { isTauri } from '@/utils/platform';

// Recovery-bestanden leven in de gedeelde appDataDir (app-id org.openaec.planner),
// dus concurrent dev-builds van verschillende worktrees zouden elkaar overschrijven.
// In een dev-build isoleert de worktree-slug (gezet door scripts/tauri-dev.mjs) ze;
// een plain/productie-build houdt de canonieke naam.
//
// Multi-document: er is één manifest (<base>.documents.json) dat alle open documenten
// opsomt, elk met een eigen IFC-snapshot (<base>.<docId>.ifc). De oude losse
// <base>.ifc wordt bij het opstarten nog herkend (terugval) en daarna opgeruimd.
const recoveryBase = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}` : 'recovery';
const recoveryManifestName = `${recoveryBase}.documents.json`;
const legacyRecoveryFile = `${recoveryBase}.ifc`;
const recoveryIfcName = (docId: string) => `${recoveryBase}.${docId}.ifc`;

interface RecoveryManifest {
  version: number;
  activeDocumentId: string | null;
  documents: { id: string; ifc: string; filePath: string | null; isDirty: boolean }[];
}
import { TitleBar } from '@/components/layout/TitleBar/TitleBar';
import '@/components/layout/TitleBar/TitleBar.css';
import { Ribbon } from '@/components/layout/Ribbon/Ribbon';
import { StatusBar } from '@/components/layout/StatusBar/StatusBar';
import { GanttCanvas } from '@/components/canvas/GanttCanvas';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { TableEditor } from '@/components/panels/TableEditor';
import { RelationsPanel } from '@/components/panels/RelationsPanel';
import { IFCPanel } from '@/components/panels/IFCPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { DebugTerminal } from '@/components/panels/DebugTerminal';
import { TaskDialog } from '@/components/dialogs/TaskDialog';
import { ProjectInfoDialog } from '@/components/dialogs/ProjectInfoDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { CalendarDialog } from '@/components/dialogs/CalendarDialog';
import { UpdateDialog } from '@/components/dialogs/UpdateDialog';
import { FeedbackDialog } from '@/components/dialogs/FeedbackDialog';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { Backstage } from '@/components/backstage/Backstage';
import { DocumentTabBar } from '@/components/layout/DocumentChrome/DocumentTabBar';
import { ProjectRail } from '@/components/layout/DocumentChrome/ProjectRail';
import { ProjectOverview } from '@/components/layout/DocumentChrome/ProjectOverview';
import { CloseDocumentDialog } from '@/components/layout/DocumentChrome/CloseDocumentDialog';
import { useKeyboardShortcuts } from '@/hooks/keyboard/useKeyboardShortcuts';
import { useAppStore } from '@/state/appStore';
import type { RecoveryDocInput } from '@/state/slices/documentSlice';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function AppContent() {
  useKeyboardShortcuts();
  const { t } = useTranslation('common');

  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const project = useAppStore(s => s.project);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const showProjectInfoDialog = useAppStore(s => s.ui.showProjectInfoDialog);
  const showNewProjectDialog = useAppStore(s => s.ui.showNewProjectDialog);
  const showSettingsDialog = useAppStore(s => s.ui.showSettingsDialog);
  const showCalendarDialog = useAppStore(s => s.ui.showCalendarDialog);
  const showFeedbackDialog = useAppStore(s => s.ui.showFeedbackDialog);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const setUI = useAppStore(s => s.setUI);
  const isDirty = useAppStore(s => s.isDirty);
  const filePath = useAppStore(s => s.filePath);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);

  useEffect(() => {
    initLocale();
    initTheme().then(theme => {
      setUI({ uiTheme: theme });
    });
    loadZoomSettings().then(zs => {
      if (Object.keys(zs).length > 0) setUI(zs);
    });
    loadDebugTerminalEnabled().then(v => {
      if (typeof v === 'boolean') setUI({ debugTerminalEnabled: v });
    });
    loadDocumentChromeStyle().then(style => {
      if (style) setUI({ documentChromeStyle: style });
    });
    void loadAllExtensions();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const dirtyMark = isDirty ? '* ' : '';
    const fileInfo = filePath ? ` — ${filePath.split(/[/\\]/).pop()}` : '';
    document.title = `${dirtyMark}${project.name}${fileInfo} — Open Planner Studio`;
  }, [project.name, isDirty, filePath]);

  // Auto-save bij ELKE wijziging (gedebounced) i.p.v. op een vaste interval:
  // we abonneren op de store en schrijven een recovery-snapshot kort nadat de
  // wijzigingen tot rust komen (de debounce coalesceert snelle bursts zoals
  // slepen/typen tot één schrijfactie). Alle open documenten krijgen een eigen
  // IFC-snapshot + een manifest; snapshots van gesloten documenten worden
  // opgeruimd.
  useEffect(() => {
    if (!isTauri()) return;

    let saving = false;
    let pending = false;

    const runAutoSave = async () => {
      // Voorkom overlappende schrijfacties; vraag een herhaling aan als er
      // tijdens het schrijven nieuwe wijzigingen binnenkwamen.
      if (saving) { pending = true; return; }
      const state = useAppStore.getState();
      const docs = state.getOpenDocumentPayloads();
      if (!docs.some((d) => d.payload.isDirty)) return;
      saving = true;
      try {
        const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dir = await appDataDir();

        for (const { id, payload } of docs) {
          const content = writeIFC(
            payload.project, payload.calendar, payload.tasks,
            payload.sequences, payload.resources, payload.assignments,
            payload.activityCodeTypes, payload.customFieldDefs,
          );
          await writeTextFile(await join(dir, recoveryIfcName(id)), content);
        }

        const manifest: RecoveryManifest = {
          version: 1,
          activeDocumentId: state.activeDocumentId,
          documents: docs.map(({ id, payload }) => ({
            id, ifc: recoveryIfcName(id), filePath: payload.filePath, isDirty: payload.isDirty,
          })),
        };
        await writeTextFile(await join(dir, recoveryManifestName), JSON.stringify(manifest));

        // Ruim snapshots op van documenten die niet meer open zijn (zelfde slug).
        const keep = new Set(docs.map((d) => recoveryIfcName(d.id)));
        const prefix = `${recoveryBase}.`;
        for (const entry of await readDir(dir)) {
          const name = entry.name;
          if (name && name.startsWith(prefix) && name.endsWith('.ifc') && !keep.has(name)) {
            await remove(await join(dir, name));
          }
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        saving = false;
        if (pending) { pending = false; void runAutoSave(); }
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void runAutoSave(); }, 800);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  // Check for recovery file on startup
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    (async () => {
      if (!isTauri()) return;
      try {
        const { readTextFile, exists, remove } = await import('@tauri-apps/plugin-fs');
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dir = await appDataDir();
        const manifestPath = await join(dir, recoveryManifestName);

        // Nieuw pad: multi-document manifest.
        if (await exists(manifestPath)) {
          const manifest = JSON.parse(await readTextFile(manifestPath)) as RecoveryManifest;
          const shouldRecover = await ask(t('confirm.restoreRecovery'), { kind: 'warning' });
          if (shouldRecover) {
            const restored: RecoveryDocInput[] = [];
            for (const d of manifest.documents) {
              try {
                const parsed = readIFC(await readTextFile(await join(dir, d.ifc)));
                restored.push({
                  id: d.id,
                  project: parsed.project, calendar: parsed.calendar, tasks: parsed.tasks,
                  sequences: parsed.sequences, resources: parsed.resources, assignments: parsed.assignments,
                  activityCodeTypes: parsed.activityCodeTypes, customFieldDefs: parsed.customFieldDefs,
                  filePath: d.filePath ?? null, isDirty: d.isDirty ?? true,
                });
              } catch (err) {
                console.error('Failed to restore recovery document:', d.id, err);
              }
            }
            if (restored.length > 0) {
              useAppStore.getState().restoreDocuments(restored, manifest.activeDocumentId ?? null);
            }
          }
          // Opruimen: alle gerefereerde snapshots + het manifest.
          for (const d of manifest.documents) {
            try { await remove(await join(dir, d.ifc)); } catch { /* al weg */ }
          }
          try { await remove(manifestPath); } catch { /* al weg */ }
          return;
        }

        // Terugval: oude losse <base>.ifc (één document).
        const legacyPath = await join(dir, legacyRecoveryFile);
        if (await exists(legacyPath)) {
          const content = await readTextFile(legacyPath);
          const shouldRecover = await ask(t('confirm.restoreRecovery'), { kind: 'warning' });
          if (shouldRecover) {
            try {
              useAppStore.getState().loadState(readIFC(content));
            } catch (err) {
              console.error('Failed to restore recovery file:', err);
            }
          }
          await remove(legacyPath);
        }
      } catch (err) {
        console.error('Recovery check failed:', err);
      }
    })();
  }, []);

  // Stille opstart-update-check (Tauri-only) — spiegelt het auto-save-patroon:
  // dynamische import binnen de service, niet-blokkerend. Is er een update, dan
  // openen we de update-dialog zodat de gebruiker het ziet. Fouten worden in
  // stille modus genegeerd.
  const updateChecked = useRef(false);
  useEffect(() => {
    if (updateChecked.current) return;
    updateChecked.current = true;
    if (!isTauri()) return;
    // Snap-builds worden door de Snap Store/snapd zelf bijgewerkt — de in-app
    // auto-check overslaan zodat we de gebruiker niet lastigvallen.
    getInstallKind()
      .then(kind => {
        if (kind === 'snap') return;
        return checkForUpdates(true).then(info => {
          if (info) useAppStore.getState().setUI({ showUpdateDialog: true });
        });
      })
      .catch(() => { /* stille check — fouten negeren */ });
  }, []);

  // Determine if we should show the gantt canvas or a full-panel view
  const isFullPanel = activeTab === 'table' || activeTab === 'relations' || activeTab === 'ifc' || activeTab === 'report';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-text-primary">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Ribbon Toolbar */}
      <Ribbon />

      {/* Backstage view (File-tab actief) — neemt de volledige body over.
          Anders: gradient strip + main content. */}
      {activeTab === 'file' ? (
        <Backstage />
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
          <div className="ui-card flex-1 flex overflow-hidden">
            {activeTab === 'table' && <TableEditor />}
            {activeTab === 'relations' && <RelationsPanel />}
            {activeTab === 'ifc' && <IFCPanel />}
            {activeTab === 'report' && <ReportPanel />}
          </div>
        ) : (
          // Gantt Chart view — zwevende kaart (Gantt + tabel samen)
          <div className="ui-card flex-1 flex overflow-hidden">
            <GanttCanvas />
          </div>
        )}

        {/* Right Panel: Properties (collapsible) */}
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
                {t('properties')}
              </span>
            </div>
          ) : (
            <div
              className="ui-card flex flex-col overflow-hidden"
              style={{ width: rightPanelWidth, minWidth: 200 }}
            >
              <div className="flex items-center justify-between h-8 px-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {t('properties')}
                </span>
                <button
                  onClick={() => setUI({ rightPanelCollapsed: true })}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TaskPropertiesPanel />
              </div>
              {debugTerminalEnabled && debugTerminalOpen && <DebugTerminal />}
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

      {/* Dialogs */}
      <TaskDialog />
      {(showProjectInfoDialog || showNewProjectDialog) && <ProjectInfoDialog />}
      {showSettingsDialog && <SettingsDialog />}
      {showCalendarDialog && <CalendarDialog />}
      {showFeedbackDialog && <FeedbackDialog />}
      <UpdateDialog />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
