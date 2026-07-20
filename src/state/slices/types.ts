import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';

/**
 * StateCreator-alias voor alle slices: eerste generic is de VOLLEDIGE store
 * zodat cross-slice acties (runCPM, undo, newProject) de hele draft zien;
 * immer-middleware zit in de mutator-keten.
 * Type-only import van AppState → de import-cyclus is compile-time-only en veilig.
 */
export type AppSlice<T> = StateCreator<AppState, [['zustand/immer', never]], [], T>;

// View-/render-contract-types wonen nu in `@/types/view` (fase 1, thema E). Hier her-geëxporteerd
// zodat state-laag-consumenten (slices, componenten) hun bestaande imports niet hoeven te wijzigen;
// engine/services importeren rechtstreeks uit `@/types/view`. De bijbehorende waarde-constanten
// (DATE_NOTATIONS, DURATION_DISPLAYS, BAR_SPLIT_MODES) blijven hieronder in de state-laag.
import type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode,
  GroupLevel, SortLevel, Layout, SplitViewState, ViewState,
} from '@/types/view';
export type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode,
  GroupLevel, SortLevel, Layout, SplitViewState, ViewState,
};

export type WeekStartDay = 'monday' | 'sunday';

// Fase 2.10 (golf 1, sneltoetsen-fundament §"Nieuwe store-acties"): richting voor
// `reorderSibling` — verwissel een taak met haar vorige/volgende sibling binnen dezelfde ouder.
export type SiblingDirection = 'up' | 'down';

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

// Waarde-constanten bij de (nu naar `@/types/view` verhuisde) weergave-types. De types worden
// bovenaan her-geïmporteerd; deze arrays blijven in de state-laag (waarde-exports horen niet in
// `src/types/`).
export const DATE_NOTATIONS: DateNotation[] = ['dmy', 'mdy', 'ymd'];

export const DURATION_DISPLAYS: DurationDisplay[] = ['auto', 'days', 'hours'];

export const BAR_SPLIT_MODES: BarSplitMode[] = ['never', 'selection', 'always'];

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

export type RibbonTab = 'file' | 'start' | 'planning' | 'resources' | 'relations' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report';

// Backstage view (Office-style File tab full-screen) — sub-section selectie
export type BackstageSection =
  | 'recent'
  | 'examples'
  | 'export'
  | 'import'
  | 'print'
  | 'project-info'
  | 'settings'
  | 'extensions'
  // Fase 2.10, onderdeel 5 (golf 1): in-app help/documentatie-viewer.
  | 'help';

// Fase 2.10 fix-golf (onderdeel 3, item 6): snapshot van de UI-velden die de rondleiding
// per stap forceert (`tourSteps.ts`'s `prepare()`-lijst) — vastgelegd bij tour-START, teruggezet
// bij ELKE sluitroute (Sluiten/Overslaan/Escape/auto-skip-naar-buiten-de-lijst), zodat de
// gebruikersstand van vóór de tour intact terugkomt i.p.v. altijd naar een vaste default.
export interface TourUiSnapshot {
  activeRibbonTab: RibbonTab;
  backstageSection: BackstageSection;
  showHistogram: boolean;
  rightPanelCollapsed: boolean;
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
  showUpdateDialog: boolean;
  uiTheme: UITheme;
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  scrollMode: ScrollMode;             // persisted — wheel behavior mode
  positionDivision: PositionDivision; // persisted — split used in position mode
  modifierMap: ModifierMap;           // persisted — wheel→function map for modifier mode
  debugTerminalEnabled: boolean;  // persisted
  debugTerminalOpen: boolean;     // session
  documentChromeStyle: DocumentChromeStyle; // persisted — multi-document wisselstijl
  ribbonCompact: boolean; // persisted — compacte ribbon voor kleine schermen
  showProjectOverview: boolean;             // session — projectoverzicht-overlay open
  pendingCloseDocId: string | null;         // session — document met openstaande sluit-bevestiging
  showNewProjectDialog: boolean;            // session — nieuw-project-wizard open
  showFeedbackDialog: boolean;              // session — feedback-dialoog open
  showStructureDialog: boolean;             // session — codes & velden-beheer open
  traceMode: TraceMode;                     // session — path tracing rond de geselecteerde taak
  showResourcePanel: boolean;               // session — resource-beheerpaneel (full-panel) open (fase 2.5)
  /** Session — fase 2.10 (item 6): resource-paneel gedockt in de rechter-rail (compacte variant,
   *  in plaats van full-panel). Default false = byte-identiek bestaand gedrag. Alleen relevant
   *  zolang `showResourcePanel` ook true is; mutueel exclusief met de volledige-paneel-modus. */
  resourcePanelDocked: boolean;
  showHistogram: boolean;                   // persisted — histogramstrook onder de Gantt zichtbaar (fase 2.5)
  histogramHeight: number;                  // persisted — hoogte van de histogramstrook in px (fase 2.5)
  showLevelingDialog: boolean;              // session — nivelleer-dialoog open (fase 2.5)
  showBaselineDialog: boolean;              // session — baseline-dialoog open (fase 2.6)
  showBaselineOverlay: boolean;             // persisted — baseline-onderbalk in de Gantt (fase 2.6)
  showProgressLine: boolean;                // persisted — voortgangslijn in de Gantt (fase 2.6)
  showStatusDateLine: boolean;              // persisted — statusdatumlijn in de Gantt (fase 2.6)
  presentationMode: boolean;                // session — presentatie-modus (fase 2.7, §9); niet gepersisteerd
  showMiniMap: boolean;                     // persisted — mini-map naast/onder de Gantt (fase 2.7, §11)
  // --- Fase 2.7 golf 3: dialogen (§5.5/§6/§13.1/§8) ---
  showColumnsDialog: boolean;                // session — kolommen-dialoog open
  showFilterDialog: boolean;                 // session — filter-editor open
  showLayoutsDialog: boolean;                // session — layouts-beheer/opslaan-als-dialoog open
  autoCalcCPM: boolean;                      // persisted — runCPM automatisch bij scheduleStale i.p.v. handmatig (F5)
  constructionMode: boolean;                 // persisted — bouwmodus (AAN=bouwgericht, default); UIT=bouw-agnostisch

  dateNotation: DateNotation;                // persisted — weergavenotatie voor datums (taak #53); opslag blijft ISO
  // --- Fase 2.8b: urenplanning-instellingen (§6.8); ontbrekende sleutel ⇒ default (geen reset) ---
  enableHourPlanning: boolean;               // persisted — hoofdschakelaar Urenplanning (default UIT)
  allowMixedDayHour: boolean;                // persisted — Gemengde dag/uur-planning toestaan (default AAN); UI-poort
  durationDisplay: DurationDisplay;          // persisted — Duurweergave (default 'auto')
  barSplitMode: BarSplitMode;                // persisted — Taakbalken bij onderbrekingen (default 'selection')
  hourDataNotice: boolean;                   // session — geladen bestand bevat uur-data terwijl Urenplanning uit staat (§6.8)
  // --- Fase 2.10 golf 1: sneltoetsen-fundament ---
  /** session — sneltoetsen-overzichtsdialoog (Ctrl/Cmd+/) open. De dialoog zelf komt in golf 3;
   *  deze golf zet alleen de vlag zodat de toets al bedraad/testbaar is. */
  showShortcutsDialog: boolean;
  // --- Fase 2.10 onderdeel 3: first-startup (welkomstdialoog + rondleiding) ---
  /** session — welkomstdialoog (2 stappen: voorkeuren + rondleiding-aanbod) open. Ephemeral:
   *  het bootstrap-effect in App.tsx zet 'm op true bij een verse `!loadWelcomeSeen()`, of de
   *  herstart-ingangen (ribbon/backstage) zetten 'm handmatig, ongeacht welcomeSeen. */
  showWelcomeDialog: boolean;
  /** session — rondleiding-overlay (TourOverlay) open. */
  showTourOverlay: boolean;
  /** session — huidige stapindex (0-based) van de rondleiding. */
  tourStepIndex: number;
  /** session — snapshot van de gebruikersstand vóór tour-start (zie `TourUiSnapshot`). `null`
   *  wanneer er geen tour loopt; overleeft een presentatiemodus-unmount/remount van
   *  `TourOverlay` (dit staat in de store, niet in component-state) — zie TourOverlay.tsx. */
  tourSnapshot: TourUiSnapshot | null;
}

// Path tracing (MSP "Task Path" / P6 "Trace Logic"): welke kant van het netwerk
// rond de geselecteerde taak gemarkeerd wordt in de Gantt.
export type TraceMode = 'off' | 'predecessors' | 'successors' | 'both';
