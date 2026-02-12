import { useEffect } from 'react';
import { I18nProvider } from '@/i18n/I18nProvider';
import { Ribbon } from '@/components/layout/Ribbon/Ribbon';
import { StatusBar } from '@/components/layout/StatusBar/StatusBar';
import { GanttCanvas } from '@/components/canvas/GanttCanvas';
import { TaskPropertiesPanel } from '@/components/panels/TaskPropertiesPanel';
import { TableEditor } from '@/components/panels/TableEditor';
import { IFCPanel } from '@/components/panels/IFCPanel';
import { ReportPanel } from '@/components/panels/ReportPanel';
import { TaskDialog } from '@/components/dialogs/TaskDialog';
import { ProjectInfoDialog } from '@/components/dialogs/ProjectInfoDialog';
import { useKeyboardShortcuts } from '@/hooks/keyboard/useKeyboardShortcuts';
import { useAppStore } from '@/state/appStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function AppContent() {
  useKeyboardShortcuts();

  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const rightPanelWidth = useAppStore(s => s.ui.rightPanelWidth);
  const project = useAppStore(s => s.project);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const showProjectInfoDialog = useAppStore(s => s.ui.showProjectInfoDialog);
  const setUI = useAppStore(s => s.setUI);

  useEffect(() => {
    document.title = `${project.name} — Open Planner Studio`;
  }, [project.name]);

  // Determine if we should show the gantt canvas or a full-panel view
  const isFullPanel = activeTab === 'table' || activeTab === 'ifc' || activeTab === 'report';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-text-primary">
      {/* Ribbon Toolbar */}
      <Ribbon />

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
                Eigenschappen
              </span>
            </div>
          ) : (
            <div
              className="border-l border-border bg-surface-alt overflow-y-auto flex flex-col"
              style={{ width: rightPanelWidth, minWidth: 200 }}
            >
              <div className="flex items-center justify-between h-8 px-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Eigenschappen
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
            </div>
          )
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Dialogs */}
      <TaskDialog />
      {showProjectInfoDialog && <ProjectInfoDialog />}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
