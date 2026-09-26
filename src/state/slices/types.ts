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

// View-/render-contract-types wonen in `@/types/view`. Hier her-geëxporteerd voor
// state-laag-consumenten (slices, componenten);
// engine/services importeren rechtstreeks uit `@/types/view`. De bijbehorende waarde-constanten
// (DATE_NOTATIONS, DURATION_DISPLAYS, BAR_SPLIT_MODES) blijven hieronder in de state-laag.
import type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode, SavedFilter,
  GroupLevel, SortLevel, Layout, LayoutSession, LayoutViewParts, SplitViewState, ViewState,
} from '@/types/view';
import type { BarColorSelection } from '@/types/barColor';
import type { ScheduleErrorKey } from '@/i18n/scheduleErrors';
export type {
  TimeScale, DateNotation, DurationDisplay, BarSplitMode,
  BuiltinFieldKey, FieldRef, ColumnConfig, FilterOperator, FilterNode, SavedFilter,
  GroupLevel, SortLevel, Layout, LayoutSession, LayoutViewParts, SplitViewState, ViewState,
};
export type { BarColorSelection };

// MCP-bridge: status-shape voor de AI-serverindicator in de ui-state. Type-only import →
// geen runtime-cyclus (contracts.ts is dependency-vrij).
import type { McpServerStatus } from '@/services/mcp/contracts';
export type { McpServerStatus };

export type WeekStartDay = 'monday' | 'sunday';

// Richting voor
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

// Waarde-constanten bij de weergave-types uit `@/types/view`. De types worden
// bovenaan her-geïmporteerd; deze arrays blijven in de state-laag (waarde-exports horen niet in
// `src/types/`).
export const DATE_NOTATIONS: DateNotation[] = ['dmy', 'mdy', 'ymd'];

export const DURATION_DISPLAYS: DurationDisplay[] = ['auto', 'days', 'hours'];

export const BAR_SPLIT_MODES: BarSplitMode[] = ['never', 'selection', 'always'];

// 'system' is een VOORKEUR, geen tekenbaar thema: hij lost via `resolveUITheme`
// (`@/utils/theme`) op naar 'dark' of 'light' op basis van `prefers-color-scheme`. Er is dus geen
// `[data-theme="system"]`-blok in globals.css, en alles wat een thema toepast werkt met
// `ResolvedUITheme`. 'high-contrast' blijft een expliciete keuze — het OS-kleurschema kent alleen
// licht/donker.
export type UITheme = 'system' | 'dark' | 'light' | 'high-contrast';

/** Het thema zoals het daadwerkelijk getekend wordt — de voorkeur met 'system' al opgelost.
 *  De volledige uitleg + `resolveUITheme` staan in `@/utils/theme`; dit alias staat hier zodat
 *  `UI_THEMES` de systeemvoorkeur niet per ongeluk als kaart kan opnemen. */
export type ResolvedUITheme = Exclude<UITheme, 'system'>;

// Alleen de KIESBARE thema's. 'system' staat hier bewust NIET in: het is in de interface geen
// vierde kaart maar een schakelaar onder deze drie, die ze uitgrijst zolang hij aanstaat.
export const UI_THEMES: { id: ResolvedUITheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'high-contrast', label: 'High Contrast' },
];

// Lettertype-familie voor de applicatie-interface. Web-apps volgen — anders dan
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

export type RibbonTab = 'file' | 'start' | 'planning' | 'resources' | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report' | 'ai';

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
  // Bedrijfsbibliotheken: bedrijvenbeheer, poolbeheer, export/import.
  | 'library'
  // In-app help/documentatie-viewer.
  | 'help';

// Snapshot van de UI-velden die de rondleiding
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

// --- Gebruikerszichtbaar meldingenkanaal: één gecentraliseerde toast-stapel in
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
 * sleutel pas in productie zichtbaar wordt — als een lege toast.
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
  // Recovery-robuustheid (corrupt herstelbestand): `restoreDocuments` slaat een
  // document over waarvan de solve gooit (bv. cyclische WBS-relatie) i.p.v. het hele herstel te
  // blokkeren; deze melding vertelt hoeveel er zijn overgeslagen. Meervoud, `count`.
  | 'notifications.recoveryDocumentsSkipped'
  | 'notifications.scheduleFailed'
  | 'notifications.ifcParseFailed'
  | 'notifications.templateSaved'
  | 'notifications.relationCreated'
  | 'notifications.relationDuplicate'
  | 'notifications.relationAncestorEndpoint'
  // De store-route weigert een relatie die een kring sluit (net als raster en MCP). Parameter
  // `cycle`: de taaknamen van de kring, "A → B → A".
  | 'notifications.relationCycle'
  // Verhangen maakte een bestaande relatie tot voorouder-relatie (telt niet meer mee) — zie
  // `hierarchyRelationNotice.ts`. Meervoud, `count`.
  | 'notifications.relationsExcludedByHierarchy'
  // Verhangen dat via een fase een kring zou maken, wordt vooraf
  // geweigerd — zie `hierarchyChange.ts`. Parameter `cycle`: de taaknamen, "A → B → A".
  | 'notifications.hierarchyCycle'
  | 'notifications.summaryRelationsDropped'
  | 'notifications.relationsSkippedOnInsert'
  // Plakken uit een ander document: kalender-/taaktype-/code-/veldverwijzingen die hier niet
  // bestaan zijn leeggemaakt (`insertedBranch.ts`s `normalizeInsertedBranch`). Meervoud, `count`.
  | 'notifications.referencesClearedOnPaste'
  // Structuurovergangen met toewijzingen (`src/state/structuralTransition.ts`):
  // wordt mijlpaal ⇒ weigeren; wordt fase ⇒ toewijzingen naar de eerste nieuwe subtaak, of weigeren
  // als dat niet schoon kan; een mijlpaal die kinderen krijgt verliest zijn mijlpaalvlag.
  | 'notifications.milestoneRefusedAssignments'
  | 'notifications.milestoneRefusedSummary'
  | 'notifications.assignmentsMovedToSubtask'
  | 'notifications.assignmentsMovedToSubtasks'
  | 'notifications.milestoneClearedOnPhase'
  | 'notifications.phaseRefusedNoAssignableChild'
  | 'notifications.phaseRefusedDuplicateResource'
  | 'notifications.mppLegacy'
  | 'notifications.mppEncrypted'
  | 'notifications.xerInvalidInput'
  | 'notifications.xerInvalidFile'
  | 'notifications.xerInvalidEncoding'
  | 'notifications.xerDuplicateTable'
  | 'notifications.xerMissingRequiredColumns'
  | 'notifications.xerMissingRequiredValue'
  | 'notifications.xerAmbiguousDecimal'
  | 'notifications.xerInvalidNumberFormat'
  | 'notifications.xerInvalidNumber'
  | 'notifications.xerSingleProjectRequired'
  | 'notifications.xerEmptyProject'
  | 'notifications.xerDuplicateId'
  | 'notifications.xerAmbiguousLocalRelation'
  | 'notifications.xerDanglingLocalRelation'
  | 'notifications.xerEnumFallback'
  | 'notifications.xerImportOpened'
  | 'notifications.xerImportProjectsSeen'
  | 'notifications.xerImportEmptyProjectsSkipped'
  | 'notifications.xerImportBaselineProjectsExcluded'
  | 'notifications.xerImportBaselinesMaterialized'
  | 'notifications.xerImportDanglingBaselineReferences'
  | 'notifications.xerImportBaselineFallback'
  | 'notifications.xerImportExternalLinks'
  | 'notifications.xerImportEncoding'
  | 'notifications.xerImportParserIssues'
  | 'notifications.xerImportCalendarIssues'
  | 'notifications.xerImportNumberIssues'
  | 'notifications.xerImportEnumFallbacks'
  | 'notifications.xerImportUnsupportedSemantics'
  // "Datums zoals opgeslagen" staat standaard aan zodra
  // een geopend XER-document restverschillen heeft. Meervoud, `count` = som van
  // `recordedDates.shifted` over alle documenten van dit bestand (één regel, ook bij twaalf
  // projecten — zie `xerImportNotice`/`applyOpenedImport`).
  | 'notifications.xerImportDatesAsRecorded'
  | 'notifications.xerImportDatesAsRecordedOffer'
  // Dezelfde twee regels, formaatneutraal,
  // voor P6 XML/MSPDI/.mpp/CSV/IFC — één melding per geopend bestand (`applyOpenedImport`).
  | 'notifications.importDatesAsRecorded'
  | 'notifications.importDatesAsRecordedOffer'
  | 'notifications.xerExportLoss'
  | 'notifications.mppSourceScheduleNotes'
  | 'notifications.projectStartAnchorsClamped'
  | 'notifications.taskEditRevertBlocked'
  | 'notifications.mppTimephasedSteeringLost'
  | 'notifications.pasteSkippedReadOnly'
  // Nivelleren/wissen overschrijft de
  // `.mpp`-eigen sub-dag-nivelleervertraging (`levelingDelayMinutes`/`levelingDelayElapsed`) met
  // hele werkdagen — zie `src/state/timephasedLossNotice.ts`s `notifyLevelingDelayRounded`.
  | 'notifications.levelingDelayRoundedToWorkdays'
  // Rekenprofielen: "dit project rekent als …" bij openen (param `profile`, een merknaam) en de
  // telling "N taken verschoven" na een profielwissel (`count`).
  | 'notifications.schedulingProfileApplied'
  | 'notifications.schedulingProfileShifted'
  // Het geladen bestand draagt taaktypedata terwijl "Toon taaktypes"
  // uit staat — de werkregel-UI is voor dit document ontsloten; zie `src/state/taskTypesNotice.ts`.
  | 'notifications.taskTypesUnlocked'
  | 'notifications.taskTypesUnlockedDetail'
  | 'notifications.workRulesReadMore'
  // Een kalenderwissel loopt door de werkregel; wanneer dat de
  // duur van taken verandert (Vast werk/Vaste inzet), meldt de app hoeveel — zie `taskTypesNotice.ts`.
  | 'notifications.workRuleDurationsChanged'
  // Onderbroken taken zonder urenverdeling verliezen hun onderbrekingen bij een
  // MSPDI-/P6-export — zie `fileSlice.ts`s `exportSplitsLostNotice`. Meervoud, `count`.
  | 'notifications.exportSplitsLost'
  // Een onbruikbaar XER-bronarchief is bij het
  // openen weggelaten — zie `src/state/xerArchiveIssueNotice.ts`. Bewust geen meervoud (ook bij
  // crashherstel van meerdere documenten één zin); `xerArchiveUnusableLine` is de kopregel wanneer
  // de melding als detail in een bestaande bestandsmelding landt.
  | 'notifications.xerArchiveUnusable'
  | 'notifications.xerArchiveUnusableLine'
  | 'notifications.xerArchiveUnusableConsequence'
  | 'notifications.xerArchiveReasonSchemaVersion'
  | 'notifications.xerArchiveReasonHashMismatch'
  | 'notifications.xerArchiveReasonTruncated'
  | 'notifications.xerArchiveReasonBytesMissing'
  | 'notifications.xerArchiveReasonMetadataInvalid'
  | 'notifications.xerArchiveReasonStructure'
  // Zoals MS Project: een getypte start op een taak mét voorganger werd een beperking "Start niet
  // eerder dan", of verzette de datum van een bestaande — zie `src/state/startConstraintNotice.ts`.
  // `Many` is het meervoud (`count`) voor plakken/vullen.
  | 'notifications.startSnetCreated'
  | 'notifications.startSnetUpdated'
  | 'notifications.startSnetMany'
  // Idem, "melden, beperking laten staan": een andere constraint (MSO, FNLT, …) houdt
  // de nieuwe start tegen. Het type staat er in gebruikerstaal in (i18next-nesting op
  // `task:constraintType`); `NoDate` voor ALAP, `Many` het meervoud (`count`).
  | 'notifications.startBlockedByConstraint'
  | 'notifications.startBlockedByConstraintNoDate'
  | 'notifications.startBlockedByConstraintMany'
  // Voortgang ingevuld zonder statusdatum ⇒ de app zette hem op vandaag —
  // zie `engine/progressEntry.ts` en `state/progressEntryNotice.ts`. Parameter `date`.
  | 'notifications.statusDateSetToday'
  // Restduur: een nieuwe duur korter dan het gedane werk van een lopende taak is
  // geweigerd — zie `runningDurationChange` in engine/taskMutationRules.ts. Parameters `name`, `percent`.
  | 'notifications.durationBelowDoneWork';

/** Rekenprofielen: het actielabel is een i18n-sleutel in `common`. */
export type NotificationActionLabelKey = 'notifications.actions.openProjectInfo';

/** Een SERIALISEERBARE vervolgactie op een melding (geen functies in de store). `NotificationHost`
 *  voert hem uit; nieuwe soorten krijgen een eigen `kind`. */
export interface NotificationAction {
  kind: 'openBackstageSection';
  section: BackstageSection;
  labelKey: NotificationActionLabelKey;
}

/** Een vertaalde detailregel onder een toast. Anders dan `detail` is deze tekst altijd
 * gebruikerszichtbaar en dus via dezelfde gesloten sleutelunie en i18n-keten getypeerd. */
export interface NotificationDetailLine {
  messageKey: NotificationMessageKey;
  params?: Record<string, string | number>;
  /** Optioneel een EIGEN gidslink voor deze regel: de melding zelf linkt
   *  naar het artikel van het bestand/profiel; een samengevoegde regel over een ander onderwerp
   *  (werkregels) krijgt zo een eigen, aanklikbare link in plaats van een gidsnaam in de tekst.
   *  Label = `linkKey` (standaard `notifications.readMore`). */
  helpArticleId?: string;
  linkKey?: NotificationMessageKey;
}

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
  /** Optionele, vertaalde feiten onder de hoofdboodschap (bv. één XER-bestandsverslag). */
  detailLines?: NotificationDetailLine[];
  /** Vertaalbare detailregel (namespace `common`) met `detailParams`; heeft voorrang op `detail`.
   *  Voor solverfouten, die als code + parameters komen (`src/i18n/scheduleErrors.ts`) zodat ze in
   *  de UI-taal verschijnen en bij een taalwissel meevertalen. */
  detailKey?: ScheduleErrorKey;
  detailParams?: Record<string, string | number>;
  /** Samenvouw-sleutel: een tweede melding met dezelfde sleutel wordt één regel met een teller. */
  dedupeKey?: string;
  /** Aantal samengevouwen voorkomens; 1 bij de eerste. */
  count: number;
  /** Optioneel — id van een in-app-documentatieartikel (`public/docs/<taal>/<id>.md`) dat deze
   *  melding toelicht ("lees meer"). Aanwezig ⇒ `NotificationHost`
   *  toont een "Lees meer"-link die `openHelpArticle` aanroept (Backstage → Help opent op dat
   *  artikel). Geen manifest-validatie hier — zelfde vrijheid als een `docs://`-link in een
   *  gids-artikel zelf (`miniMarkdown.tsx`); `verify:docs` bewaakt dat het artikel-id bestaat. */
  helpArticleId?: string;
  /** Optionele vervolgknop; zie `NotificationAction` (serialiseerbaar, nooit een functie). */
  action?: NotificationAction;
}

/** Wat een aanroeper meegeeft; `id` en `count` vult de store. */
export type NotifyInput = Omit<AppNotification, 'id' | 'count'>;
/** Een gridprepare verzamelt meldingen in deze vorm en toont ze pas ná een geslaagde commit. */
export type DeferredNotification = NotifyInput;

/** Eén taak in de vraag naar de werkelijke start (`engine/progressEntry.ts`): de gegevens die
 *  de dialoog toont en toetst. Bewust platte data (bladmodule, geen import uit `@/engine`). */
export interface ActualStartQuestionItem {
  taskId: string;
  taskName: string;
  /** De statusdatum waartegen gevraagd wordt; het antwoord mag er niet na liggen. */
  statusDate: string;
  /** Laatst mogelijke werkelijke start (opgegeven werkelijk einde, anders de statusdatum); ook het
   *  voorstel in het veld. */
  latest: string;
}

export interface ActualStartQuestionRequest {
  items: ActualStartQuestionItem[];
}

export interface UIState {
  showTaskDialog: boolean;
  editingTaskId: string | null;
  /** Relatiemodus: een "plakkende Shift" voor de Gantt. Staat hij aan, dan start een
   *  sleep vanaf een balk hetzelfde relatie-tekenen als shift+slepen, zónder de toets vast te
   *  houden. Wordt gelezen door `GanttCanvas` (mousedown-hittest + cursor) en door
   *  `DependencyModeNotice` (de strook die vertelt dat de modus aan staat); Escape en de
   *  lint-knop zetten hem weer uit. */
  showDependencyMode: boolean;
  /** Splits-modus: dezelfde vorm als de relatiemodus hierboven. Staat hij
   *  aan, dan begint een sleep vanaf een balk een ONDERBREKING: klikken op de dag waar de pauze
   *  begint, naar rechts slepen voor de lengte. Gelezen door `GanttCanvas` (mousedown-hittest +
   *  cursor) en door `SplitModeNotice`; Escape en de lint-knop zetten hem uit. De twee modi sluiten
   *  elkaar uit — `setUI` dwingt dat af, want beide kapen dezelfde sleep vanaf een balk. */
  showSplitMode: boolean;
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
  /** Als de app zojuist naar een nieuwe versie is geüpdatet — of voor het
   *  eerst draait — bevat dit de versiesprong en toont `JustUpdatedDialog` zich. `from` is `null`
   *  wanneer er geen eerder gestarte versie bekend is (verse installatie); dan toont de dialoog
   *  enkel de huidige versie. `null` = niets tonen (normale herstart). Wordt bij de opstartdetectie
   *  alleen in Tauri gezet, maar kan overal handmatig geopend worden via Instellingen. */
  justUpdated: { from: string | null; to: string } | null;
  uiTheme: UITheme;
  /** Session — de actuele stand van `prefers-color-scheme: dark`, bijgehouden door de
   *  matchMedia-listener in `App.tsx`. Wordt NIET gepersisteerd (het is omgevingsstand, geen
   *  instelling) en is alleen betekenisvol samen met `uiTheme`: zie `resolveUITheme`. */
  systemPrefersDark: boolean;
  uiFontFamily: UIFontFamily; // persisted — interface-lettertypefamilie; 'default' = stylesheet-defaults
  uiFontScale: number;        // persisted — interface-lettertypegrootte als schaalpercentage (90|100|110|125)
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
  /** Compacte keuze na een plusknop in de projectkiezer; maakt pas na een keuze iets aan/open. */
  showNewOrOpenProjectDialog: boolean;
  /** Een pas gemaakte taak krijgt éénmalig de naamfocus in het eigenschappenpaneel. */
  pendingTaskNameFocusId: string | null;
  showFeedbackDialog: boolean;              // session — feedback-dialoog open
  showStructureDialog: boolean;             // session — codes & velden-beheer open
  traceMode: TraceMode;                     // session — path tracing rond de geselecteerde taak
  showResourcePanel: boolean;               // session — resource-beheerpaneel (full-panel) open
  /** Session — resource-paneel gedockt in de rechter-rail (compacte variant, in plaats van
   *  full-panel). Default false. Alleen relevant zolang `showResourcePanel` ook true is; mutueel
   *  exclusief met de volledige-paneel-modus.
   *
   *  "Gedockt" betekent *naast* het eigenschappenpaneel in dezelfde rail, niet *in plaats van*. Dit
   *  veld is daarmee de aan/uit-schakelaar van het resourcepaneel in de rail — precies zoals
   *  `showPropertiesPanel` dat is voor Eigenschappen. */
  resourcePanelDocked: boolean;
  /** Session — staat het eigenschappenpaneel in de rechter-rail aan?
   *
   *  De rail huisvest twee GELIJKWAARDIGE panelen die allebei gewoon open staan zodra ze aan
   *  staan; er is geen samengevouwen tussentoestand. Elk paneel heeft daarom precies één
   *  aan/uit-vlag: dit veld voor Eigenschappen, `resourcePanelDocked` voor de resourcelijst. Staan
   *  ze allebei uit, dan is er geen rail. Default `true`.
   *
   *  Dit is iets ANDERS dan `rightPanelCollapsed`: dat verbergt de hele kolom tijdelijk (de Gantt
   *  krijgt de breedte) zónder de paneelkeuze te vergeten. */
  showPropertiesPanel: boolean;
  /** Persisted — hoogte in px van het Eigenschappen-paneel (kopbalk inbegrepen)
   *  wanneer BEIDE railpanelen aan staan; het resourcepaneel krijgt dan de resterende ruimte.
   *  Staat er maar één paneel aan, dan is dit veld niet van kracht (dat paneel krijgt de volle
   *  hoogte) — het onthoudt enkel de laatst gesleepte verdeling. Geklemd bij het laden
   *  (`settingsRegistry`) én live tijdens het slepen. */
  railPropertiesHeight: number;
  /** session — het Waarschuwingenpaneel (alle actieve waarschuwingen en rule-check-
   *  fouten uit `cpmResult`/`resourceLoadResult`, klik = navigeren) staat onderin de rechter-rail,
   *  ónder de stapel Eigenschappen/Resourcedock. Zelfde model als `showPropertiesPanel`: één
   *  aan/uit-vlag, geen samengevouwen tussentoestand; aanzetten klapt de rail uit (`setUI`-
   *  invariant 1b). Default uit — de statusbalk blijft de compacte ingang. */
  showWarningsPanel: boolean;
  /** Persisted — hoogte in px van het Waarschuwingenpaneel (kopbalk inbegrepen) wanneer
   *  er óók een ander railpaneel aan staat; staat alleen dit paneel aan, dan vult het de rail en is
   *  dit veld niet van kracht. Geklemd bij het laden (`settingsRegistry`) én live tijdens het slepen
   *  — het spiegelbeeld van `railPropertiesHeight`. */
  railWarningsHeight: number;
  showHistogram: boolean;                   // persisted — histogramstrook onder de Gantt zichtbaar
  histogramHeight: number;                  // persisted — hoogte van de histogramstrook in px
  showLevelingDialog: boolean;              // session — nivelleer-dialoog open
  showBaselineDialog: boolean;              // session — baseline-dialoog open
  showMoveProjectDialog: boolean;           // session — "Project verplaatsen…"-dialoog open
  showBaselineOverlay: boolean;             // persisted — baseline-onderbalk in de Gantt
  showProgressLine: boolean;                // persisted — voortgangslijn in de Gantt
  showStatusDateLine: boolean;              // persisted — statusdatumlijn in de Gantt
  /** Dun streepje in de resourcekleur onder taakbalken (scherm-accent; de balkvulling zelf
   *  blijft kritiek-pad-gekleurd — resourcekleuren gelden voor de export, dit is het schermsignaal). */
  showResourceAccent: boolean;               // persisted
  showFloatBand: boolean;                    // persisted — groene spelingsband ná niet-kritieke balken
  /** Canonieke app-globale balkkleurkeuze; scherm en rapport delen deze selectie. */
  barColorSelection: BarColorSelection;       // persisted
  presentationMode: boolean;                // session — presentatie-modus; niet gepersisteerd
  showMiniMap: boolean;                     // persisted — mini-map naast/onder de Gantt
  // --- Dialogen ---
  showColumnsDialog: boolean;                // session — kolommen-dialoog open
  showFilterDialog: boolean;                 // session — filter-editor open
  showLayoutsDialog: boolean;                // session — layoutdialoog open (nieuw of bewerken)
  showClassicViewControls: boolean;          // persisted — LEGACY: losse Kolommen/Filter/Groeperen/Sorteren-knoppen op Beeld, default uit
  layoutDialogTargetId: string | null;       // session — de layout die bewerkt wordt; null = nieuwe layout
  autoCalcCPM: boolean;                      // persisted — runCPM automatisch bij scheduleStale i.p.v. handmatig (F5)
  constructionMode: boolean;                 // persisted — bouwmodus (AAN=bouwgericht, default); UIT=bouw-agnostisch

  dateNotation: DateNotation;                // persisted — weergavenotatie voor datums; opslag blijft ISO
  // --- Urenplanning-instellingen; ontbrekende sleutel ⇒ default (geen reset) ---
  enableHourPlanning: boolean;               // persisted — hoofdschakelaar Urenplanning (default UIT)
  /** persisted (`ops-showTaskTypes`) — toon de werkregel (taaktype) en het
   *  resterende werk per toewijzing in paneel, dialoog en raster. Default UIT; een document dat al
   *  taaktypedata draagt ontsluit de weergave voor zichzelf (`taskTypesVisible`, DOCUMENT_FIELDS). */
  showTaskTypes: boolean;
  allowMixedDayHour: boolean;                // persisted — Gemengde dag/uur-planning toestaan (default AAN); UI-poort
  durationDisplay: DurationDisplay;          // persisted — Duurweergave (default 'auto')
  barSplitMode: BarSplitMode;                // persisted — Taakbalken bij onderbrekingen (default 'selection')
  // «Alleen werkbare dagen tonen» — comprimeert de Gantt/Histogram-tijd-as (weekenden+feestdagen
  // weggelaten). Globaal (geen ViewState).
  compressNonWorkdays: boolean;               // persisted — default UIT
  hourDataNotice: boolean;                   // session — geladen bestand bevat uur-data terwijl Urenplanning uit staat
  /** session — teller voor de "structuur vergrendeld"-melding: elke geweigerde
   *  structuurpoging hoogt hem op, zodat de melding ook opnieuw verschijnt als hij al zichtbaar
   *  was. 0 = niets te tonen. */
  structureLockedNotice: number;
  // --- Sneltoetsen ---
  /** session — sneltoetsen-overzichtsdialoog (Ctrl/Cmd+/, `ShortcutsDialog`) open. */
  showShortcutsDialog: boolean;
  /** session — ingebouwde benchmark-tool open. Draait geïsoleerd op gegenereerde
   *  data; raakt het open project/de store niet aan. */
  showBenchmarkDialog: boolean;
  /** session — statistieken-dialoog (downloads per OS/release van de stats-branch) open; knop
   *  op Instellingen → Toepassing, naast Benchmark. Leest alleen, raakt de store niet aan. */
  showStatsDialog: boolean;
  /** session — de lopende toestemmingsvraag bij het installeren van een extensie, of
   *  `null` als er geen vraag openstaat. Bevat de gegevens die de dialoog toont; het ANTWOORD gaat
   *  niet via de store maar via de resolver in `extensions/consent.ts` — een promise-resolver hoort
   *  niet in state thuis. Bewust `unknown` getypeerd: `slices/types.ts` is een bladmodule voor de
   *  hele state-laag en mag niet van `@/extensions` afhangen (verify:cycles). De dialoog cast naar
   *  `ExtensionConsentRequest`. */
  pendingExtensionConsent: unknown | null;
  /** session — de openstaande vraag naar de werkelijke start (`engine/progressEntry.ts`), of
   *  `null`. Draagt alleen de VRAAG; het antwoord gaat via de resolver in
   *  `state/actualStartQuestion.ts` (een promise-resolver hoort niet in state thuis, zoals bij
   *  `pendingExtensionConsent`). Modaal: telt mee in `hasBlockingDialogOpen`. */
  pendingActualStartQuestion: ActualStartQuestionRequest | null;
  // --- Bedrijfsbibliotheken: Backstage-sectie Bibliotheek-dialogen ---
  /** session — pool-importdialoog open (met demping-waarschuwing). */
  showPoolImportDialog: boolean;
  /** session — het bedrijf waarvoor de pool-importdialoog geopend is (het GEOPENDE bedrijf
   *  in Backstage, niet altijd `defaultCompanyId`). `null` als er geen expliciete opener was; de
   *  dialoog clamp't zelf naar `defaultCompanyId`/eerste bedrijf. Reset naar `null` bij sluiten. */
  poolImportCompanyId: string | null;
  /** session — het gedeelde koppel-/afwijkingenscherm open. Data wordt live uit de store afgeleid
   *  (computeRecognition + classify*), dus er is geen transient payload nodig. */
  showLibraryLinkDialog: boolean;
  /** session — de voortgangsimportdialoog (bestand kiezen → evt. datumvolgorde-
   *  vraag → verplichte preview met handmatige koppelkiezer → bevestigen). Documentgebonden: staat in
   *  `hasBlockingDialogOpen`/`BLOCKING_UI_FLAGS` zodat een documentwissel onmogelijk is zolang hij open
   *  staat, en in `resetDocumentScopedUI` als vangnet dat in de praktijk nooit mag afgaan. */
  showProgressImportDialog: boolean;
  /** session — aantal items dat de meest recente stille verversing heeft bijgewerkt, of `null`
   *  zonder openstaand signaal (het verversingssignaal in de UI). */
  libraryRefreshNotice: number | null;
  /** session — Resources-tabweergave: 'company' (bedrijfspool), 'project' (wat dit project bevat)
   *  of 'occupancy' (bezetting van de bibliotheek over álle open documenten — leesvenster).
   *  Default afgeleid: bij inhoud in de pool 'company', anders 'project'. */
  resourcesView: 'company' | 'project' | 'occupancy';
  /** session — eenmalig verzoek om in het resource-paneel een CONCEPT-rij te openen,
   *  i.p.v. meteen een naamloze resource te persisteren. Gezet door de lintknop "Nieuwe resource",
   *  geconsumeerd (en direct weer op false gezet) door `ResourcePanel`, dat er zijn lokale
   *  `pendingNew`-draft mee opent — zo doorloopt de lintknop exact dezelfde gesaneerde route als de
   *  "+ Nieuwe resource"-knop in het paneel zelf (geen undo-stap, geen leeg item bij niets typen).
   *  App-globale UI-state, GEEN documentdata — hoort dus niet in `DOCUMENT_FIELDS`. */
  pendingNewResource: boolean;
  // --- First-startup (welkomstdialoog + rondleiding) ---
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
  // --- MCP-bridge / AI-modus. App-globaal (niet per document): de bridge
  //     bedient de héle app, niet één tabblad. Gevoed door `src/services/mcp/server.ts`. ---
  /** persisted — AI-modus: AAN ⇒ het AI-ribbontabblad verschijnt (conditioneel, net als de
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
  /** session — AI-activiteitenpaneel zichtbaar in de rechter-rail (patroon debugTerminalOpen).
   *  Wordt geforceerd dicht gezet als AI-modus uitgaat. */
  aiActivityOpen: boolean;
  /** session — gebruikerszichtbare meldingen: gecentraliseerde toast-stapel, gevoed
   *  vanuit fileAccess/recovery/scheduler/IFC en gerenderd door `NotificationHost`. App-globaal
   *  (niet per document): `UIState` wordt als geheel niet geswapt — `collapsedTaskIds` is de énige
   *  uitzondering die per document meegaat, dus `documentContract.ts` blijft ongemoeid. */
  notifications: AppNotification[];
  /** session — eenmalig verzoek om Backstage → Help te openen op een SPECIFIEK artikel ("lees
   *  meer"-link vanuit een melding of het eigenschappenpaneel). Gezet door
   *  `openHelpArticle`, geconsumeerd (en direct weer op `null` gezet) door `HelpPanel` — zelfde
   *  eenmalig-verzoek-patroon als `pendingNewResource` hierboven. App-globale UI-state, geen
   *  documentdata. */
  pendingHelpArticleId: string | null;
}

// Path tracing (MSP "Task Path" / P6 "Trace Logic"): welke kant van het netwerk
// rond de geselecteerde taak gemarkeerd wordt in de Gantt.
export type TraceMode = 'off' | 'predecessors' | 'successors' | 'both';
