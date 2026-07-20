import type { UIState, AppSlice } from './types';

export interface UiSlice {
  ui: UIState;
  setUI: (updates: Partial<UIState>) => void;
  toggleCollapse: (taskId: string) => void;
  /** Golf 1 (fase 2.10, bandkop-contextmenu §2.10): klap ALLE summary-taken (childIds.length>0)
   *  expliciet uit (collapsed=false, niet togglen). Geen undo — `collapsedTaskIds` is
   *  UI-sessiestate, net als `toggleCollapse` hierboven (zit niet in de undo-snapshot, zie
   *  `state/snapshot.ts`). */
  expandAll: () => void;
  /** Golf 1 (fase 2.10): klap ALLE summary-taken expliciet in (collapsed=true). Zie `expandAll`. */
  collapseAll: () => void;
  /** Presentatie-modus (§9): zet de flag + roept de echte Fullscreen-API aan. */
  setPresentationMode: (on: boolean) => void;
}

export function createDefaultUI(): UIState {
  return {
    showTaskDialog: false,
    editingTaskId: null,
    showDependencyMode: false,
    dependencySourceId: null,
    showProjectSettings: false,
    showProjectInfoDialog: false,
    leftPanelWidth: 350,
    rightPanelWidth: 280,
    rightPanelVisible: true,
    rightPanelCollapsed: false,
    activeRibbonTab: 'start',
    backstageSection: 'recent',
    collapsedTaskIds: [],
    inlineEditTaskId: null,
    showSettingsDialog: false,
    showCalendarDialog: false,
    showUpdateDialog: false,
    uiTheme: 'dark',
    enableQuarterHourZoom: false,
    weekStartDay: 'monday',
    scrollMode: 'modifier',
    positionDivision: 'left-right',
    modifierMap: { plain: 'vertical', ctrl: 'zoom', shift: 'horizontal' },
    debugTerminalEnabled: false,
    debugTerminalOpen: false,
    documentChromeStyle: 'tabs',
    ribbonCompact: false,
    showProjectOverview: false,
    pendingCloseDocId: null,
    showNewProjectDialog: false,
    showFeedbackDialog: false,
    showStructureDialog: false,
    traceMode: 'off',
    showResourcePanel: false,
    resourcePanelDocked: false,
    showHistogram: false,
    histogramHeight: 160,
    showLevelingDialog: false,
    showBaselineDialog: false,
    showBaselineOverlay: true,
    showProgressLine: true,
    showStatusDateLine: true,
    presentationMode: false,
    showMiniMap: false,
    showColumnsDialog: false,
    showFilterDialog: false,
    showLayoutsDialog: false,
    autoCalcCPM: false,
    // Bouwmodus (2026-07-13): default AAN = huidige bouwgerichte defaults/framing ongewijzigd.
    // App.tsx hydrateert bij opstart uit localStorage (loadConstructionMode).
    constructionMode: true,
    dateNotation: 'dmy',
    // Fase 2.8b (§6.8): urenplanning-defaults — hoofdschakelaar uit, gemengd toegestaan,
    // duurweergave automatisch, balk-opsplitsing bij selectie.
    enableHourPlanning: false,
    allowMixedDayHour: true,
    durationDisplay: 'auto',
    barSplitMode: 'selection',
    hourDataNotice: false,
    showShortcutsDialog: false,
    showBenchmarkDialog: false,
    // Fase 2.10 onderdeel 3: first-startup — ephemeral, bootstrap-hook in App.tsx zet
    // showWelcomeDialog o.b.v. de persistente `welcomeSeen`-vlag (settingsStore.ts).
    showWelcomeDialog: false,
    showTourOverlay: false,
    tourStepIndex: 0,
    tourSnapshot: null,
  };
}

export const createUiSlice: AppSlice<UiSlice> = (set, get) => ({
  ui: createDefaultUI(),

  setUI: (updates) =>
    set((s) => {
      // Als debugTerminalEnabled uitgezet wordt, forceer de terminal dicht.
      if (updates.debugTerminalEnabled === false) {
        (updates as Partial<UIState>).debugTerminalOpen = false;
      }
      Object.assign(s.ui, updates);
      const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
      if (s.view.zoom > max) s.view.zoom = max;
    }),

  // Presentation mode (fase 2.7, §9): ui-flag + echte Fullscreen-API. De fullscreenchange-listener
  // (App.tsx) zet de flag terug op false als de gebruiker fullscreen verlaat buiten onze knop/F11 om
  // (bv. OS-toets), zodat flag en werkelijkheid nooit desyncen.
  setPresentationMode: (on) => {
    set((s) => { s.ui.presentationMode = on; });
    if (typeof document === 'undefined') return;
    if (on) {
      document.documentElement.requestFullscreen?.().catch(() => { /* geweigerd/geen user-gesture — flag blijft, alleen chrome verbergt */ });
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { /* niet fataal */ });
    }
  },

  toggleCollapse: (taskId) => {
    set((s) => {
      const idx = s.ui.collapsedTaskIds.indexOf(taskId);
      if (idx >= 0) {
        s.ui.collapsedTaskIds.splice(idx, 1);
      } else {
        s.ui.collapsedTaskIds.push(taskId);
      }
    });
    get().recomputeViewRows(); // taak-collapse verandert de zichtbaarheid van kinderen (§4.3).
  },

  expandAll: () => {
    set((s) => {
      const summaryIds = new Set(s.tasks.filter((t) => t.childIds.length > 0).map((t) => t.id));
      s.ui.collapsedTaskIds = s.ui.collapsedTaskIds.filter((id) => !summaryIds.has(id));
    });
    get().recomputeViewRows();
  },

  collapseAll: () => {
    set((s) => {
      s.ui.collapsedTaskIds = s.tasks.filter((t) => t.childIds.length > 0).map((t) => t.id);
    });
    get().recomputeViewRows();
  },
});
