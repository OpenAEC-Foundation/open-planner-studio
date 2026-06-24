import type { UIState, AppSlice } from './types';

export interface UiSlice {
  ui: UIState;
  setUI: (updates: Partial<UIState>) => void;
  toggleCollapse: (taskId: string) => void;
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
    showProjectOverview: false,
    pendingCloseDocId: null,
    showNewProjectDialog: false,
  };
}

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
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

  toggleCollapse: (taskId) =>
    set((s) => {
      const idx = s.ui.collapsedTaskIds.indexOf(taskId);
      if (idx >= 0) {
        s.ui.collapsedTaskIds.splice(idx, 1);
      } else {
        s.ui.collapsedTaskIds.push(taskId);
      }
    }),
});
