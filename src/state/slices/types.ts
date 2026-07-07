import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';

/**
 * StateCreator-alias voor alle slices: eerste generic is de VOLLEDIGE store
 * zodat cross-slice acties (runCPM, undo, newProject) de hele draft zien;
 * immer-middleware zit in de mutator-keten.
 * Type-only import van AppState → de import-cyclus is compile-time-only en veilig.
 */
export type AppSlice<T> = StateCreator<AppState, [['zustand/immer', never]], [], T>;

// Fase 2.7 (§3): 'year' toegevoegd als directe keuze; 'quarter' aan de dropdown.
// Fase 2.8b (§6.2): 'hour' toegevoegd — alleen bereikbaar/zichtbaar als de hoofdschakelaar
// Urenplanning aan staat; `scaleFromZoom` levert 'hour' uitsluitend met die vlag.
export type TimeScale = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';

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

// Datumnotatie (taak #53): bepaalt ALLEEN hoe datums aan de gebruiker getoond worden
// (tabel, panelen, rapporten, print, tooltips) én de segmentvolgorde van het datumveld.
// Interne opslag/serialisatie blijft ALTIJD ISO (YYYY-MM-DD) — deze waarde raakt bestanden,
// engine of import/export nooit. Ontbrekende localStorage-sleutel ⇒ 'dmy' (dd-mm-jjjj).
export type DateNotation = 'dmy' | 'mdy' | 'ymd';

export const DATE_NOTATIONS: DateNotation[] = ['dmy', 'mdy', 'ymd'];

// Fase 2.8b (§6.8): Duurweergave — hoe duur in tabellen/tooltips getoond wordt.
// 'auto' = eigen eenheid per taak ("3d"/"20u"); 'days'/'hours' = altijd forceren.
export type DurationDisplay = 'auto' | 'days' | 'hours';

export const DURATION_DISPLAYS: DurationDisplay[] = ['auto', 'days', 'hours'];

// Fase 2.8b (§6.9): Taakbalken bij onderbrekingen — of uur-taakbalken in hun echte
// werkblokken (bar-necking) worden opgesplitst. 'never' = altijd doorlopend;
// 'selection' = segmenten zichtbaar zodra de taak geselecteerd is; 'always' = altijd.
export type BarSplitMode = 'never' | 'selection' | 'always';

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
  | 'extensions';

// --- Fase 2.7 weergaven: één veld-referentie voor filter, groep én sort (§2.1) ---
export type BuiltinFieldKey =
  | 'name' | 'wbsCode' | 'duration' | 'start' | 'finish'
  | 'totalFloat' | 'isCritical' | 'completion' | 'taskType' | 'isMilestone'
  // Fase 2.9 (§3.5): additieve analyse-velden — raken geen bestaand veld.
  | 'freeFloat' | 'interferingFloat' | 'isNearCritical' | 'floatPath';

export type FieldRef =
  | { src: 'builtin'; key: BuiltinFieldKey }
  | { src: 'activityCode'; typeId: string }   // waarde = valueId (uit task.activityCodes)
  | { src: 'customField'; defId: string }      // waarde = task.customFields[defId]
  | { src: 'resource' };                        // afgeleide waarde = namen van toegewezen resources

/** Kolomconfiguratie op de HTML-TableEditor (§2.2). Volgorde = arrayvolgorde. */
export interface ColumnConfig {
  field: FieldRef;
  visible: boolean;
  width: number; // px
}

export type FilterOperator =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'startsWith' | 'between' | 'isEmpty' | 'in';

export type FilterNode =
  | { kind: 'group'; op: 'AND' | 'OR'; children: FilterNode[] }
  | {
      kind: 'rule';
      field: FieldRef;
      operator: FilterOperator;
      value?: string | number | boolean | string[];
      value2?: string | number; // alleen 'between'
    };

export interface GroupLevel {
  field: FieldRef;
  dir: 'asc' | 'desc'; // volgorde waarin de banden zelf verschijnen
}

export interface SortLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';
}

/** App-globale presentatie-preset (§2.5). Bewust GEEN scroll/zoom-positie of sessie-flags. */
export interface Layout {
  id: string;
  name: string;
  columns: ColumnConfig[];
  group: GroupLevel[];
  sort: SortLevel[];
  filter: FilterNode | null;
  timeScale: TimeScale; // preset-naam; toepassen → setZoom(TIMESCALE_ZOOM[timeScale])
}

/** Split view binnen één document (§10) — undefined = uit. */
export interface SplitViewState {
  ratio: number;          // 0..1 breedteverdeling linker pane
  secondaryZoom: number;  // eigen zoom rechter pane
  secondaryScrollX: number;
}

export interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number; // pixels per day
  timeScale: TimeScale;
  viewStartDate: string; // leftmost visible date
  /** Histogram-selectie (fase 2.5, §6.4): id van de resource die de histogramstrook toont;
   *  undefined = alle renewables samengeteld. Per-document (zit in ViewState → DocumentPayload). */
  histogramResourceId?: string;
  // --- Fase 2.7 (§2.6) — per-document view-state ---
  /** Kolom-config; undefined = defaultColumns(). */
  columns?: ColumnConfig[];
  /** Geneste AND/OR-filter; null = geen filter (short-circuit). */
  filter: FilterNode | null;
  /** Groepeer-niveaus; [] = WBS-boom (huidig gedrag). */
  group: GroupLevel[];
  /** Sorteer-niveaus (multi-key, stabiel); [] = boom-/bandvolgorde. */
  sort: SortLevel[];
  /** Ingeklapte groepsbanden (pad-gecodeerde JSON-sleutels). */
  collapsedGroupKeys: string[];
  /** Split view binnen dit document; undefined = uit. */
  splitView?: SplitViewState;
  /** Open-fit-signaal (issue #16): na het laden van een document zet fileSlice dit op `true`; de
   *  GanttCanvas voert dan de fit-to-project uit (het kent de viewport-breedte, de store niet) en
   *  wist het meteen weer. Transient — bewust GEEN undo/redo (view zit niet in de snapshot). */
  pendingFit?: boolean;
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
}

// Path tracing (MSP "Task Path" / P6 "Trace Logic"): welke kant van het netwerk
// rond de geselecteerde taak gemarkeerd wordt in de Gantt.
export type TraceMode = 'off' | 'predecessors' | 'successors' | 'both';
