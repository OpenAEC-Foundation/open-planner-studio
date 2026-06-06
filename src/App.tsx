import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { initLocale } from '@/i18n/config';
import { initTheme, loadZoomSettings, loadDebugTerminalEnabled } from '@/utils/settingsStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
const isTauri = () => '__TAURI_INTERNALS__' in window;

// The recovery file lives in the shared appDataDir (app-id org.openaec.planner),
// so concurrent dev builds from different worktrees would clobber each other.
// In a dev build the worktree slug (set by scripts/tauri-dev.mjs) isolates it;
// a plain/production build keeps the canonical name.
const recoveryFileName = __OPS_DEV_INSTANCE__ ? `recovery.${__OPS_DEV_INSTANCE__}.ifc` : 'recovery.ifc';
import { TitleBar } from '@/components/layout/TitleBar/TitleBar';
import '@/components/layout/TitleBar/TitleBar.css';
import { Ribbon } from '@/components/layout/Ribbon/Ribbon';
import { StatusBar } from '@/components/layout/StatusBar/StatusBar';
import { GanttCanvas } from '@/components/canvas/GanttCanvas';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { TableEditor } from '@/components/panels/TableEditor';
import { IFCPanel } from '@/components/panels/IFCPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { DebugTerminal } from '@/components/panels/DebugTerminal';
import { TaskDialog } from '@/components/dialogs/TaskDialog';
import { ProjectInfoDialog } from '@/components/dialogs/ProjectInfoDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { CalendarDialog } from '@/components/dialogs/CalendarDialog';
import { Backstage } from '@/components/backstage/Backstage';
import { useKeyboardShortcuts } from '@/hooks/keyboard/useKeyboardShortcuts';
import { useAppStore } from '@/state/appStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function AppContent() {
  useKeyboardShortcuts();
  const { t } = useTranslation('common');

  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const project = useAppStore(s => s.project);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const showProjectInfoDialog = useAppStore(s => s.ui.showProjectInfoDialog);
  const showSettingsDialog = useAppStore(s => s.ui.showSettingsDialog);
  const showCalendarDialog = useAppStore(s => s.ui.showCalendarDialog);
  const uiTheme = useAppStore(s => s.ui.uiTheme);
  const setUI = useAppStore(s => s.setUI);
  const isDirty = useAppStore(s => s.isDirty);
  const filePath = useAppStore(s => s.filePath);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);

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

  // Auto-save every 60 seconds if dirty
  useEffect(() => {
    if (!isTauri()) return;
    const interval = setInterval(async () => {
      const state = useAppStore.getState();
      if (!state.isDirty) return;
      try {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const content = writeIFC(
          state.project, state.calendar, state.tasks,
          state.sequences, state.resources, state.assignments,
        );
        const dir = await appDataDir();
        await writeTextFile(await join(dir, recoveryFileName), content);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 60000);

    return () => clearInterval(interval);
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
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dir = await appDataDir();
        const recoveryPath = await join(dir, recoveryFileName);
        const hasRecovery = await exists(recoveryPath);
        if (hasRecovery) {
          const content = await readTextFile(recoveryPath);
          const shouldRecover = confirm('A recovery file was found. Would you like to restore your previous work?');
          if (shouldRecover) {
            try {
              const parsed = readIFC(content);
              useAppStore.getState().loadState(parsed);
            } catch (err) {
              console.error('Failed to restore recovery file:', err);
            }
          }
          await remove(recoveryPath);
        }
      } catch (err) {
        console.error('Recovery check failed:', err);
      }
    })();
  }, []);

  // Determine if we should show the gantt canvas or a full-panel view
  const isFullPanel = activeTab === 'table' || activeTab === 'ifc' || activeTab === 'report';

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
      {/* OpenAEC merk-accent strip — gradient amber → gold → orange (DESIGN-SYSTEM.md §2.1) */}
      <div aria-hidden className="brand-accent-strip" />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {isFullPanel ? (
          // Full panel views (Table, IFC, Report)
          <>
            {activeTab === 'table' && <TableEditor />}
            {activeTab === 'ifc' && <IFCPanel />}
            {activeTab === 'report' && <ReportPanel />}
          </>
        ) : (
          // Gantt Chart view
          <GanttCanvas />
        )}

        {/* Right Panel: Properties (collapsible) */}
        {!isFullPanel && (
          rightPanelCollapsed ? (
            <div
              className="border-l border-border bg-surface-alt cursor-pointer flex flex-col items-center justify-center gap-2 py-4 hover:bg-surface-hover"
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
              className="border-l border-border bg-surface-alt flex flex-col"
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
        </>
      )}

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <TaskDialog />
      {showProjectInfoDialog && <ProjectInfoDialog />}
      {showSettingsDialog && <SettingsDialog />}
      {showCalendarDialog && <CalendarDialog />}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
