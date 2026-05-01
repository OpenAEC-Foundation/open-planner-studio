export type TimeScale = 'day' | 'week' | 'month' | 'quarter';

export type WeekStartDay = 'monday' | 'sunday';

export type UITheme = 'default' | 'light' | 'dark' | 'blue' | 'amber-navy' | 'warm-ember' | 'highContrast';

export const UI_THEMES: { id: UITheme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'blue', label: 'Blue' },
  { id: 'amber-navy', label: 'Amber Navy' },
  { id: 'warm-ember', label: 'Warm Ember' },
  { id: 'highContrast', label: 'High Contrast' },
];

export type RibbonTab = 'start' | 'planning' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report';

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
  collapsedTaskIds: string[];   // summary tasks that are collapsed
  inlineEditTaskId: string | null;
  showSettingsDialog: boolean;
  uiTheme: UITheme;
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
}
