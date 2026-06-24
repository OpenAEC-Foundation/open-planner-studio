import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';

/**
 * StateCreator-alias voor alle slices: eerste generic is de VOLLEDIGE store
 * zodat cross-slice acties (runCPM, undo, newProject) de hele draft zien;
 * immer-middleware zit in de mutator-keten.
 * Type-only import van AppState → de import-cyclus is compile-time-only en veilig.
 */
export type AppSlice<T> = StateCreator<AppState, [['zustand/immer', never]], [], T>;

export type TimeScale = 'day' | 'week' | 'month' | 'quarter';

export type WeekStartDay = 'monday' | 'sunday';

// --- Scroll & zoom over the Gantt (configurable wheel behavior) ---
// The wheel can do one of three things; in "modifier" mode the mapping is a
// strict bijection (each function used exactly once).
export type WheelFunction = 'vertical' | 'horizontal' | 'zoom';

export type ScrollMode = 'position' | 'modifier' | 'drag';

export type PositionDivision = 'left-right' | 'top-bottom' | 'corner';

export interface ModifierMap {
  plain: WheelFunction;
  ctrl: WheelFunction;
  shift: WheelFunction;
}

export const DEFAULT_MODIFIER_MAP: ModifierMap = {
  plain: 'vertical',
  ctrl: 'zoom',
  shift: 'horizontal',
};

export type UITheme = 'dark' | 'light' | 'high-contrast';

export const UI_THEMES: { id: UITheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'high-contrast', label: 'High Contrast' },
];

// Hoe de gebruiker tussen meerdere geopende documenten wisselt (multi-document).
// 'tabs'     — horizontale tabstrip onder het lint (default, browser/Excel-stijl)
// 'rail'     — verticale projectbalk links (VS Code activity-bar-stijl)
// 'switcher' — minimale projectpil in de titelbalk
export type DocumentChromeStyle = 'tabs' | 'rail' | 'switcher';

export const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

export type RibbonTab = 'file' | 'start' | 'planning' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report';

// Backstage view (Office-style File tab full-screen) — sub-section selectie
export type BackstageSection =
  | 'recent'
  | 'export'
  | 'import'
  | 'print'
  | 'project-info'
  | 'settings'
  | 'extensions';

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
  showCalendarDialog: boolean;
  uiTheme: UITheme;
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  scrollMode: ScrollMode;             // persisted — wheel behavior mode
  positionDivision: PositionDivision; // persisted — split used in position mode
  modifierMap: ModifierMap;           // persisted — wheel→function map for modifier mode
  debugTerminalEnabled: boolean;  // persisted
  debugTerminalOpen: boolean;     // session
  documentChromeStyle: DocumentChromeStyle; // persisted — multi-document wisselstijl
  showProjectOverview: boolean;             // session — projectoverzicht-overlay open
  pendingCloseDocId: string | null;         // session — document met openstaande sluit-bevestiging
  showNewProjectDialog: boolean;            // session — nieuw-project-wizard open
}
