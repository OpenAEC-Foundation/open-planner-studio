export type TimeScale = 'day' | 'week' | 'month' | 'quarter';

export type WeekStartDay = 'monday' | 'sunday';

export type UITheme = 'dark' | 'light' | 'high-contrast';

export const UI_THEMES: { id: UITheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'high-contrast', label: 'High Contrast' },
];

export type RibbonTab = 'file' | 'start' | 'planning' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report';

// Backstage view (Office-style File tab full-screen) — sub-section selectie
export type BackstageSection =
  | 'recent'
  | 'export'
  | 'print'
  | 'project-info'
  | 'settings';

export interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number; // pixels per day
  timeScale: TimeScale;
  viewStartDate: string; // leftmost visible date
}

export interface UIState {
  showTaskDialog: boolean;
  editingTaskId: string | null;
  showDependencyMode: boolean;
  dependencySourceId: string | null;
  showProjectSettings: boolean;
  showProjectInfoDialog: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  rightPanelVisible: boolean;
  rightPanelCollapsed: boolean;
  activeRibbonTab: RibbonTab;
  backstageSection: BackstageSection; // huidige sub-sectie wanneer File-tab actief is
  collapsedTaskIds: string[];   // summary tasks that are collapsed
  inlineEditTaskId: string | null;
  showSettingsDialog: boolean;
  uiTheme: UITheme;
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  debugTerminalEnabled: boolean;  // persisted
  debugTerminalOpen: boolean;     // session
}
