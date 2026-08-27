import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import type { StoreRuntime } from '../runtime/storeRuntime';

/**
 * StateCreator-alias voor alle slices: eerste generic is de VOLLEDIGE store
 * zodat cross-slice acties (runCPM, undo, newProject) de hele draft zien;
 * immer-middleware zit in de mutator-keten.
 * Type-only import van AppState → de import-cyclus is compile-time-only en veilig.
 */
export type AppSlice<T> = StateCreator<AppState, [['zustand/immer', never]], [], T>;
export type AppSliceFactory<T> = (runtime: StoreRuntime) => AppSlice<T>;

// View-/render-contract-types wonen nu in `@/types/view` (fase 1, thema E). Hier her-geëxporteerd
// zodat state-laag-consumenten (slices, componenten) hun bestaande imports niet hoeven te wijzigen;
// engine/services importeren rechtstreeks uit `@/types/view`. De bijbehorende waarde-constanten
// (DATE_NOTATIONS, DURATION_DISPLAYS, BAR_SPLIT_MODES) blijven hieronder in de state-laag.
import type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode, SavedFilter,
  GroupLevel, SortLevel, Layout, SplitViewState, ViewState,
} from '@/types/view';
import type { BarColorSelection } from '@/types/barColor';
export type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode, SavedFilter,
  GroupLevel, SortLevel, Layout, SplitViewState, ViewState,
};
export type { BarColorSelection };

// MCP-bridge (fase 1): status-shape voor de AI-serverindicator in de ui-state. Type-only import →
// geen runtime-cyclus (contracts.ts is dependency-vrij).
import type { McpServerStatus } from '@/services/mcp/contracts';
export type { McpServerStatus };

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

// Lettertype-familie voor de applicatie-interface (issue #25.4). Web-apps volgen — anders dan
// native apps — niet automatisch de OS-lettertype-instelling, wat leesbaarheid/toegankelijkheid
// kan beïnvloeden; deze instelling geeft de gebruiker de keuze. 'default' laat de stylesheet-
// defaults (Space Grotesk / Inter, globals.css) staan; de andere waarden overschrijven via App.tsx
// de CSS-variabelen --font-heading/--font-body. Labels komen uit i18n (geen `{label}` hier, net
// als bij DATE_NOTATIONS) — de Select-options in SettingsPanelContent mappen id→vertaling.
export type UIFontFamily = 'default' | 'system' | 'serif' | 'mono';

export const UI_FONT_FAMILIES: UIFontFamily[] = ['default', 'system', 'serif', 'mono'];

// Lettertype-grootte van de interface als schaalpercentage.
//
// Hoe het doorwerkt: `--ui-font-scale` (gezet in App.tsx) schaalt de rem-basis in globals.css, dus
// Tailwind's `text-*`-klassen volgen vanzelf; de losse px-font-sizes in de chrome-css schalen
// expliciet mee via `calc(<n>px * var(--ui-font-scale, 1))`, en de canvas-renderers volgen wél de
// familie maar bewust NIET de grootte (vaste rijhoogte ⇒ clipping, zie GanttRenderer.font).
//
// BEWUST geen hogere waarden dan 125. Let op: de eerdere motivering hier ("paddings staan in px en
// schalen niet mee") was FOUT — Tailwind's spacing-schaal is rem-gebaseerd en die rem-basis schalen
// we juist wél, dus `p-*`/`gap-*`/`h-*` en de `--sp-*`-tokens groeien gewoon mee. De echte reden is
// dat niet álle chrome meebeweegt: vaste px-hoogtes/-breedtes in losse componenten en de
// canvas-geometrie blijven staan, en boven ~125% gaan knoplabels in het lint over meerdere regels
// breken. 125 is de grens waarop dat nog acceptabel bleef in een echte browsercontrole.
export const UI_FONT_SCALES: number[] = [90, 100, 110, 125];

// Hoe de gebruiker tussen meerdere geopende documenten wisselt (multi-document).
// 'tabs'     — horizontale tabstrip onder het lint (default, browser/Excel-stijl)
// 'rail'     — verticale projectbalk links (VS Code activity-bar-stijl)
// 'switcher' — minimale projectpil in de titelbalk
export type DocumentChromeStyle = 'tabs' | 'rail' | 'switcher';

export const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

export type RibbonTab = 'file' | 'start' | 'planning' | 'resources' | 'relations' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report' | 'ai';

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
  // B1 (bedrijfsbibliotheken): bedrijvenbeheer, poolbeheer, export/import.
  | 'library'
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
  showPropertiesPanel: boolean;
}

// --- Gebruikerszichtbaar meldingenkanaal (bevinding K8): één gecentraliseerde toast-stapel in
//     `UIState.notifications`, gevoed vanuit élke laag (fileAccess, recovery, scheduler, IFC) en
//     gerenderd door `NotificationHost`. Een fout ("error") plakt tot de gebruiker hem wegklikt;
//     een info ("info") verdwijnt na 5 s. `detail` is bewust onvertaalde technische tekst. ---
export type NotificationSeverity = 'error' | 'info';

/**
 * De i18n-sleutels die een melding mag dragen — bewust een GESLOTEN unie en geen vrije `string`.
 *
 * De vertaalbronnen van dit project zijn getypeerd (`src/i18n/types.d.ts` voedt i18next met de
 * Nederlandse JSON als sleutelbron), dus élke andere `t(...)`-aanroep in de app is
 * compile-gecontroleerd. Een vrije string zou hier de enige plek maken waar een typefout in een
 * sleutel pas in productie zichtbaar wordt — als een lege toast, precies het stille-falen-patroon
 * dat bevinding K8 juist opruimt.
 *
 * Alle sleutels wonen in de `common`-namespace. Dat is geen toeval maar een eis: i18next's
 * typings accepteren een unie van sleutels alleen binnen ÉÉN namespace (een `'task:...'`-vorm of
 * een unie over twee namespaces typecheckt niet, zelf nagemeten). Daarom staat de
 * tak-als-sjabloon-melding hier als `notifications.templateSaved` en niet als
 * `task:structure.templateSaved` — dezelfde vertaalde tekst, in de namespace die het kanaal kan
 * typeren. Een nieuwe melding zet zijn sleutel hier én in alle veertien `common.json`-bestanden.
 */
export type NotificationMessageKey =
  | 'notifications.openFailed'
  | 'notifications.saveFailed'
  | 'notifications.librarySaveFailed'
  | 'notifications.savedViaDownload'
  | 'notifications.autoSaveFailed'
  | 'notifications.recoveryReadFailed'
  | 'notifications.recoveryRestoreFailed'
  | 'notifications.scheduleFailed'
  | 'notifications.ifcParseFailed'
  | 'notifications.templateSaved'
  | 'notifications.relationCreated'
  | 'notifications.relationDuplicate'
  | 'notifications.relationAncestorEndpoint'
  | 'notifications.summaryRelationsDropped'
  | 'notifications.mppLegacy'
  | 'notifications.mppEncrypted'
  | 'notifications.mppSourceScheduleNotes'
  | 'notifications.projectStartAnchorsClamped'
  | 'notifications.mppTimephasedSteeringLost';

export interface AppNotification {
  /** Stabiele id — uitsluitend voor de React-key en voor `dismissNotification`. */
  id: string;
  severity: NotificationSeverity;
  /** i18n-sleutel; `NotificationHost` vertaalt hem. */
  messageKey: NotificationMessageKey;
  /** Interpolatie-parameters voor `t()`. */
  params?: Record<string, string | number>;
  /** Rauwe technische tekst (`err.message`) — BEWUST onvertaald. */
  detail?: string;
  /** Samenvouw-sleutel: een tweede melding met dezelfde sleutel wordt één regel met een teller. */
  dedupeKey?: string;
  /** Aantal samengevouwen voorkomens; 1 bij de eerste. */
  count: number;
  /** Optioneel — id van een in-app-documentatieartikel (`public/docs/<taal>/<id>.md`) dat deze
   *  melding toelicht (mpp-nul-data-etappe, "lees meer"-eigenaarseis). Aanwezig ⇒ `NotificationHost`
   *  toont een "Lees meer"-link die `openHelpArticle` aanroept (Backstage → Help opent op dat
   *  artikel). Geen manifest-validatie hier — zelfde vrijheid als een `docs://`-link in een
   *  gids-artikel zelf (`miniMarkdown.tsx`); `verify:docs` bewaakt dat het artikel-id bestaat. */
  helpArticleId?: string;
}

/** Wat een aanroeper meegeeft; `id` en `count` vult de store. */
export type NotifyInput = Omit<AppNotification, 'id' | 'count'>;

export interface UIState {
  showTaskDialog: boolean;
  editingTaskId: string | null;
  /** Relatiemodus (issue #40): een "plakkende Shift" voor de Gantt. Staat hij aan, dan start een
   *  sleep vanaf een balk hetzelfde relatie-tekenen als shift+slepen, zónder de toets vast te
   *  houden. Wordt gelezen door `GanttCanvas` (mousedown-hittest + cursor) en door
   *  `DependencyModeNotice` (de strook die vertelt dat de modus aan staat); Escape en de
   *  lint-knop zetten hem weer uit.
   *  NB: het vroegere `dependencySourceId` is bewust weg — dat veld werd alleen geschreven en
   *  nergens gelezen (dezelfde bevinding als de dode modus zelf). */
  showDependencyMode: boolean;
  showProjectSettings: boolean;
  showProjectInfoDialog: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  rightPanelVisible: boolean;
  rightPanelCollapsed: boolean;
  activeRibbonTab: RibbonTab;
  backstageSection: BackstageSection; // huidige sub-sectie wanneer File-tab actief is
  collapsedTaskIds: string[];   // summary tasks that are collapsed
  showSettingsDialog: boolean;
  showCalendarDialog: boolean;
  showUpdateDialog: boolean;
  /** Fase "kleine dingen": als de app zojuist naar een nieuwe versie is geüpdatet — of voor het
   *  eerst draait — bevat dit de versiesprong en toont `JustUpdatedDialog` zich. `from` is `null`
   *  wanneer er geen eerder gestarte versie bekend is (verse installatie); dan toont de dialoog
   *  enkel de huidige versie. `null` = niets tonen (normale herstart). Wordt bij de opstartdetectie
   *  alleen in Tauri gezet, maar kan overal handmatig geopend worden via Instellingen. */
  justUpdated: { from: string | null; to: string } | null;
  uiTheme: UITheme;
  uiFontFamily: UIFontFamily; // persisted — interface-lettertypefamilie (issue #25.4); 'default' = stylesheet-defaults
  uiFontScale: number;        // persisted — interface-lettertypegrootte als schaalpercentage (90|100|110|125, issue #25.4)
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
   *  zolang `showResourcePanel` ook true is; mutueel exclusief met de volledige-paneel-modus.
   *
   *  Issue #46 (slot): "gedockt" betekent sinds deze wijziging *naast* het eigenschappenpaneel in
   *  dezelfde rail, niet meer *in plaats van*. Dit veld is daarmee de aan/uit-schakelaar van het
   *  resourcepaneel in de rail — precies zoals `showPropertiesPanel` dat is voor Eigenschappen. */
  resourcePanelDocked: boolean;
  /** Session — issue #46 (slot): staat het eigenschappenpaneel in de rechter-rail aan?
   *
   *  De rail huisvest twee GELIJKWAARDIGE panelen die allebei gewoon open staan zodra ze aan
   *  staan; er is geen samengevouwen tussentoestand. Elk paneel heeft daarom precies één
   *  aan/uit-vlag: dit veld voor Eigenschappen, `resourcePanelDocked` voor de resourcelijst. Staan
   *  ze allebei uit, dan is er geen rail. Default `true` = byte-identieke opstart.
   *
   *  Dit is iets ANDERS dan `rightPanelCollapsed`: dat verbergt de hele kolom tijdelijk (de Gantt
   *  krijgt de breedte) zónder de paneelkeuze te vergeten. */
  showPropertiesPanel: boolean;
  /** Persisted — issue #46 (slot): hoogte in px van het Eigenschappen-paneel (kopbalk inbegrepen)
   *  wanneer BEIDE railpanelen aan staan; het resourcepaneel krijgt dan de resterende ruimte.
   *  Staat er maar één paneel aan, dan is dit veld niet van kracht (dat paneel krijgt de volle
   *  hoogte) — het onthoudt enkel de laatst gesleepte verdeling. Geklemd bij het laden
   *  (`settingsRegistry`) én live tijdens het slepen. */
  railPropertiesHeight: number;
  showHistogram: boolean;                   // persisted — histogramstrook onder de Gantt zichtbaar (fase 2.5)
  histogramHeight: number;                  // persisted — hoogte van de histogramstrook in px (fase 2.5)
  showLevelingDialog: boolean;              // session — nivelleer-dialoog open (fase 2.5)
  showBaselineDialog: boolean;              // session — baseline-dialoog open (fase 2.6)
  showMoveProjectDialog: boolean;           // session — "Project verplaatsen…"-dialoog open (pakket D1)
  showBaselineOverlay: boolean;             // persisted — baseline-onderbalk in de Gantt (fase 2.6)
  showProgressLine: boolean;                // persisted — voortgangslijn in de Gantt (fase 2.6)
  showStatusDateLine: boolean;              // persisted — statusdatumlijn in de Gantt (fase 2.6)
  /** #21: dun streepje in de resourcekleur onder taakbalken (scherm-accent; de balkvulling zelf
   *  blijft kritiek-pad-gekleurd — resourcekleuren gelden voor de export, dit is het schermsignaal). */
  showResourceAccent: boolean;               // persisted
  /** #21: canonieke app-globale balkkleurkeuze; scherm en rapport delen deze selectie. */
  barColorSelection: BarColorSelection;       // persisted
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
  durationDisplay: DurationDisplay;          // persisted — Duurweergave (default 'auto')
  barSplitMode: BarSplitMode;                // persisted — Taakbalken bij onderbrekingen (default 'selection')
  // Issue #21 punt 5 (fase 2): «alleen werkbare dagen tonen» — comprimeert de Gantt/Histogram-
  // tijd-as (weekenden+feestdagen weggelaten). Globaal (geen ViewState), zie werkdagen-as-ontwerp §7.3.
  compressNonWorkdays: boolean;               // persisted — default UIT (§0 user-besluit)
  hourDataNotice: boolean;                   // session — geladen bestand bevat uur-data terwijl Urenplanning uit staat (§6.8)
  /** session — teller voor de "structuur vergrendeld"-melding (issue #26): elke geweigerde
   *  structuurpoging hoogt hem op, zodat de melding ook opnieuw verschijnt als hij al zichtbaar
   *  was. 0 = niets te tonen. */
  structureLockedNotice: number;
  // --- Fase 2.10 golf 1: sneltoetsen-fundament ---
  /** session — sneltoetsen-overzichtsdialoog (Ctrl/Cmd+/) open. De dialoog zelf komt in golf 3;
   *  deze golf zet alleen de vlag zodat de toets al bedraad/testbaar is. */
  showShortcutsDialog: boolean;
  /** session — ingebouwde benchmark-tool (pakket S) open. Draait geïsoleerd op gegenereerde
   *  data; raakt het open project/de store niet aan. */
  showBenchmarkDialog: boolean;
  /** session — de lopende toestemmingsvraag bij het installeren van een extensie (K-item 38), of
   *  `null` als er geen vraag openstaat. Bevat de gegevens die de dialoog toont; het ANTWOORD gaat
   *  niet via de store maar via de resolver in `extensions/consent.ts` — een promise-resolver hoort
   *  niet in state thuis. Bewust `unknown` getypeerd: `slices/types.ts` is een bladmodule voor de
   *  hele state-laag en mag niet van `@/extensions` afhangen (verify:cycles). De dialoog cast naar
   *  `ExtensionConsentRequest`. */
  pendingExtensionConsent: unknown | null;
  // --- B1 (bedrijfsbibliotheken): Backstage-sectie Bibliotheek-dialogen ---
  /** session — pool-importdialoog open (met demping-waarschuwing). */
  showPoolImportDialog: boolean;
  /** session — het bedrijf waarvoor de pool-importdialoog geopend is (fix B1: het GEOPENDE bedrijf
   *  in Backstage, niet altijd `defaultCompanyId`). `null` als er geen expliciete opener was; de
   *  dialoog clamp't zelf naar `defaultCompanyId`/eerste bedrijf. Reset naar `null` bij sluiten. */
  poolImportCompanyId: string | null;
  /** session — het gedeelde koppel-/afwijkingenscherm open (spec §5/§3, plan-eis 7). Vervangt de
   *  verwijderde Add/Update-dialogen. Data wordt live uit de store afgeleid (computeRecognition +
   *  classify*), dus er is geen transient payload nodig. */
  showLibraryLinkDialog: boolean;
  /** session — aantal items dat de meest recente stille verversing (grens 1/2/3/4) heeft bijgewerkt,
   *  of `null` zonder openstaand signaal (Taak 18: het verversingssignaal in de UI). */
  libraryRefreshNotice: number | null;
  /** session — Resources-tabweergave: 'company' (bedrijfspool), 'project' (wat dit project bevat)
   *  of 'occupancy' (B1b: bezetting van de bibliotheek over álle open documenten — leesvenster).
   *  Default afgeleid: bij inhoud in de pool 'company', anders 'project' (spec §4). */
  resourcesView: 'company' | 'project' | 'occupancy';
  /** session — eenmalig verzoek (issue #48-1) om in het resource-paneel een CONCEPT-rij te openen,
   *  i.p.v. meteen een naamloze resource te persisteren. Gezet door de lintknop "Nieuwe resource",
   *  geconsumeerd (en direct weer op false gezet) door `ResourcePanel`, dat er zijn lokale
   *  `pendingNew`-draft mee opent — zo doorloopt de lintknop exact dezelfde gesaneerde route als de
   *  "+ Nieuwe resource"-knop in het paneel zelf (geen undo-stap, geen leeg item bij niets typen).
   *  App-globale UI-state, GEEN documentdata — hoort dus niet in `DOCUMENT_FIELDS`. */
  pendingNewResource: boolean;
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
  // --- MCP-bridge / AI-modus (fase 1 MCP, spec §UI). App-globaal (niet per document): de bridge
  //     bedient de héle app, niet één tabblad. Gevoed door `src/services/mcp/server.ts`. ---
  /** persisted — AI-modus (T14): AAN ⇒ het AI-ribbontabblad verschijnt (conditioneel, net als de
   *  debug-terminal-vlag een paneel toont); UIT ⇒ tabblad weg + bridge geforceerd gestopt. De
   *  bron is de `ops-aiMode`-setting; dit is de opstart-gehydrateerde spiegel voor de reactieve UI. */
  aiMode: boolean;
  /** persisted — automatisch starten: bij het opstarten van de app de bridge meteen live zetten,
   *  zodat een AI-client kan koppelen zonder dat de gebruiker eerst het AI-tabblad opent. Alleen
   *  van kracht wanneer `aiMode` aanstaat én in de Tauri-schil (de bridge is desktop-only). Default
   *  UIT: de bridge opent een luisterende poort, dus dat blijft een bewuste keuze. */
  aiAutostart: boolean;
  /** session — status van de MCP-bridge-server, gevoed door de `mcp://status`-events + de
   *  poort-bezet-fout van `mcp_bridge_start`. Default off op de default-poort. */
  aiServerStatus: McpServerStatus;
  /** session — pauzeknop: bridge blijft live, maar muterende tools krijgen een nette
   *  "gepauzeerd"-weigering (leestools mogen door). Vlag stroomt via de ctx naar de tool-laag. */
  aiPaused: boolean;
  /** session — alleen-lezen-schakelaar: muterende tools geweigerd zolang actief. */
  aiReadOnly: boolean;
  /** session — AI-activiteitenpaneel (T15) zichtbaar in de rechter-rail (patroon debugTerminalOpen).
   *  Wordt geforceerd dicht gezet als AI-modus uitgaat. */
  aiActivityOpen: boolean;
  /** session — gebruikerszichtbare meldingen (bevinding K8): gecentraliseerde toast-stapel, gevoed
   *  vanuit fileAccess/recovery/scheduler/IFC en gerenderd door `NotificationHost`. App-globaal
   *  (niet per document): `UIState` wordt als geheel niet geswapt — `collapsedTaskIds` is de énige
   *  uitzondering die per document meegaat, dus `documentContract.ts` blijft ongemoeid. */
  notifications: AppNotification[];
  /** session — eenmalig verzoek om Backstage → Help te openen op een SPECIFIEK artikel (mpp-nul-
   *  data-etappe, "lees meer"-link vanuit een melding of het eigenschappenpaneel). Gezet door
   *  `openHelpArticle`, geconsumeerd (en direct weer op `null` gezet) door `HelpPanel` — zelfde
   *  eenmalig-verzoek-patroon als `pendingNewResource` hierboven. App-globale UI-state, geen
   *  documentdata. */
  pendingHelpArticleId: string | null;
}

// Path tracing (MSP "Task Path" / P6 "Trace Logic"): welke kant van het netwerk
// rond de geselecteerde taak gemarkeerd wordt in de Gantt.
export type TraceMode = 'off' | 'predecessors' | 'successors' | 'both';
