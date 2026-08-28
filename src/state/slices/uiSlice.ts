import type { UIState, AppSlice, NotifyInput } from './types';
import type { McpServerStatus } from '@/services/mcp/contracts';
import { MCP_DEFAULT_PORT, peekTheme } from '@/utils/settingsStore';
import { DEFAULT_BAR_COLOR_SELECTION } from '@/types/barColor';
import { maxGanttZoom } from '@/engine/renderer/timelineTiers';

export interface UiSlice {
  ui: UIState;
  setUI: (updates: Partial<UIState>) => void;
  /** MCP-bridge (fase 1): schrijf de serverstatus (uit/live/poort-bezet/fout) — gevoed door
   *  `server.ts` uit de `mcp://status`-events + de start-fout. */
  setAiServerStatus: (status: McpServerStatus) => void;
  /** MCP-bridge: zet de pauze-vlag (muterende tools tijdelijk geweigerd, leestools door). */
  setAiPaused: (paused: boolean) => void;
  /** MCP-bridge: zet de alleen-lezen-vlag (muterende tools geweigerd zolang actief). */
  setAiReadOnly: (readOnly: boolean) => void;
  toggleCollapse: (taskId: string) => void;
  /** Issue #35 punt 3: klap de opgegeven summary-taken expliciet IN (collapsed=true, niet togglen).
   *  Zonder lijst — of met een lege lijst — geldt de actie voor ALLE summary-taken; zo kan de
   *  ribbon-knop zonder selectie toch iets zinnigs doen. Ids die geen summary-taak zijn (geen
   *  kinderen) worden stil genegeerd: een blad inklappen is betekenisloos, geen fout. Geen undo —
   *  `collapsedTaskIds` is UI-sessiestate, net als `toggleCollapse` hierboven (zit niet in de
   *  undo-snapshot, zie `state/snapshot.ts`). */
  collapseTasks: (taskIds?: string[]) => void;
  /** Issue #35 punt 3: tegenhanger van `collapseTasks` — klapt expliciet UIT. Zie daar. */
  expandTasks: (taskIds?: string[]) => void;
  /** Klap de VOLLEDIGE oudersketen van `taskId` uit (issue #65: "spring naar taak" mag een taak
   *  onthullen die in een ingeklapte samenvattingstaak zit). Loopt via `parentId` omhoog tot de
   *  root en klapt elke ingeklapte voorouder uit — niet alleen de directe ouder, want die kan
   *  zelf weer in een ingeklapte grootouder zitten. */
  expandAncestorsOf: (taskId: string) => void;
  /** Golf 1 (fase 2.10, bandkop-contextmenu §2.10): klap ALLES uit in de HUIDIGE weergavemodus.
   *  Boommodus ⇒ alle summary-taken (`expandTasks()`); gegroepeerde weergave ⇒ alle groepsbanden
   *  (`expandAllGroups()`), want daar negeert `computeViewRows` de taak-collapse volledig en zou
   *  de actie anders een dode klik zijn (issue #35). Dunne wrappers zodat er één waarheid is. */
  expandAll: () => void;
  /** Golf 1 (fase 2.10): klap ALLES in in de huidige weergavemodus. Zie `expandAll`. */
  collapseAll: () => void;
  /** Presentatie-modus (§9): zet de flag + roept de echte Fullscreen-API aan. */
  setPresentationMode: (on: boolean) => void;
  /** Meld dat een structuurmutatie geweigerd is omdat de weergave niet in pure boommodus staat
   *  (issue #26): hoogt de teller op zodat `StructureLockedNotice` (opnieuw) verschijnt. */
  notifyStructureLocked: () => void;
  /** Toon een melding aan de gebruiker (bevinding K8). Met `dedupeKey` vouwt een herhaling
   *  samen tot één regel met een teller — nodig omdat de auto-save herhaaldelijk kan falen en
   *  anders meldingen zouden stapelen. Een `error` verdwijnt niet uit zichzelf (klik = weg). */
  notify: (n: NotifyInput) => void;
  dismissNotification: (id: string) => void;
  /** Open Backstage → Help op een specifiek artikel (mpp-nul-data-etappe, "lees meer"-link vanuit
   *  een melding of het eigenschappenpaneel). Zet dezelfde twee velden die de Help-navigatie al
   *  kent (`activeRibbonTab`/`backstageSection`) plus `pendingHelpArticleId`, dat `HelpPanel`
   *  consumeert om die ene keer op het gevraagde artikel te selecteren. Géén nieuw
   *  linknavigatiemechanisme — hergebruikt de bestaande Backstage-navigatie. */
  openHelpArticle: (articleId: string) => void;
}

/** Maximum aantal gelijktijdig zichtbare meldingen; bij overschrijding valt de oudste weg
 *  (fouten voorrang op info, zie `notify`). */
export const MAX_NOTIFICATIONS = 3;

// Module-scope teller voor stabiele, deterministische id's. BEWUST géén Date.now()/Math.random():
// de headless planning-suite (tests/planning) moet op de meldingen-volgorde kunnen asserteren.
let notificationSeq = 0;

export function createDefaultUI(): UIState {
  return {
    showTaskDialog: false,
    editingTaskId: null,
    showDependencyMode: false,
    showProjectSettings: false,
    showProjectInfoDialog: false,
    leftPanelWidth: 350,
    rightPanelWidth: 280,
    rightPanelVisible: true,
    rightPanelCollapsed: false,
    activeRibbonTab: 'start',
    backstageSection: 'recent',
    collapsedTaskIds: [],
    showSettingsDialog: false,
    showCalendarDialog: false,
    showUpdateDialog: false,
    justUpdated: null,
    // Issue #61: synchroon uit localStorage, zodat de default nooit afwijkt van wat het
    // pre-paint-script in index.html al op <html> zette (headless valt peekTheme terug op 'dark').
    uiTheme: peekTheme(),
    // Issue #25.4: interface-lettertype — default = huidige stylesheet-defaults + 100% schaal
    // (bestaande gebruikers merken niets; App.tsx hydrateert bij opstart uit localStorage).
    uiFontFamily: 'default',
    uiFontScale: 100,
    enableQuarterHourZoom: false,
    weekStartDay: 'monday',
    // 'drag' (zoom + slepen, map-style) is sinds issue #22 de standaard: het is de meest
    // intuïtieve navigatie en werkt zonder modifier-toetsen. Wie eerder al een voorkeur opsloeg
    // houdt die — settingsRegistry patcht dit veld alleen bij een aanwezige localStorage-sleutel,
    // en die wordt uitsluitend geschreven als de gebruiker de modus zelf omzet.
    scrollMode: 'drag',
    positionDivision: 'left-right',
    modifierMap: { plain: 'vertical', ctrl: 'zoom', shift: 'horizontal' },
    debugTerminalEnabled: false,
    debugTerminalOpen: false,
    documentChromeStyle: 'tabs',
    ribbonCompact: false,
    showProjectOverview: false,
    pendingCloseDocId: null,
    showNewProjectDialog: false,
    showNewOrOpenProjectDialog: false,
    pendingTaskNameFocusId: null,
    showFeedbackDialog: false,
    showStructureDialog: false,
    traceMode: 'off',
    showResourcePanel: false,
    resourcePanelDocked: false,
    // Issue #46 (slot) — de rechter-rail. Eigenschappen staat standaard aan (byte-identieke
    // opstart), het resourcepaneel niet; de hoogteverdeling is alleen van kracht als ze allebei
    // aan staan.
    showPropertiesPanel: true,
    railPropertiesHeight: 240,
    showHistogram: false,
    histogramHeight: 160,
    showLevelingDialog: false,
    showBaselineDialog: false,
    showMoveProjectDialog: false,
    showBaselineOverlay: true,
    showProgressLine: true,
    showStatusDateLine: true,
    showResourceAccent: false,   // #21: schermbeeld verandert eerst niet — expliciet aanzetten
    barColorSelection: DEFAULT_BAR_COLOR_SELECTION,
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
    // Urenplanning-defaults — hoofdschakelaar uit, gemengd toegestaan,
    // duurweergave automatisch, balk-opsplitsing bij selectie.
    enableHourPlanning: false,
    allowMixedDayHour: true,
    durationDisplay: 'auto',
    barSplitMode: 'selection',
    // Issue #21 punt 5 (fase 2): default UIT (§0/§7.1 user-besluit).
    compressNonWorkdays: false,
    hourDataNotice: false,
    structureLockedNotice: 0,
    showShortcutsDialog: false,
    showBenchmarkDialog: false,
    pendingExtensionConsent: null,
    showPoolImportDialog: false,
    poolImportCompanyId: null,
    showLibraryLinkDialog: false,
    libraryRefreshNotice: null,
    resourcesView: 'project',
    // Issue #48-1: ephemeral verzoek-vlag voor een concept-rij in het resource-paneel (zie UIState).
    pendingNewResource: false,
    // Fase 2.10 onderdeel 3: first-startup — ephemeral, bootstrap-hook in App.tsx zet
    // showWelcomeDialog o.b.v. de persistente `welcomeSeen`-vlag (settingsStore.ts).
    showWelcomeDialog: false,
    showTourOverlay: false,
    tourStepIndex: 0,
    tourSnapshot: null,
    // MCP-bridge / AI-modus (fase 1): AI-modus default uit (geen AI-tabblad); server staat default
    // uit op de default-poort; geen pauze/lezen.
    aiMode: false,
    aiAutostart: false,
    aiServerStatus: { state: 'off', port: MCP_DEFAULT_PORT },
    aiPaused: false,
    aiReadOnly: false,
    aiActivityOpen: false,
    notifications: [],
    pendingHelpArticleId: null,
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
      // T14: als AI-modus uitgezet wordt terwijl het AI-tabblad actief is, val terug naar 'start'
      // (het tabblad verdwijnt uit de ribbon; de content mag niet als wees-tab blijven staan). Het
      // geforceerd stoppen van de bridge is een async neveneffect en gebeurt op de aanroepplek
      // (`applyAiMode`), niet in deze synchrone reducer.
      if (updates.aiMode === false && (updates.activeRibbonTab ?? s.ui.activeRibbonTab) === 'ai') {
        (updates as Partial<UIState>).activeRibbonTab = 'start';
      }
      // T15: AI-modus uit ⇒ het activiteitenpaneel mag niet als wees blijven staan.
      if (updates.aiMode === false) {
        (updates as Partial<UIState>).aiActivityOpen = false;
      }
      // Issue #46c-nasleep: een actie die een paneel AANZET moet dat paneel ook echt zichtbaar
      // maken. De rechter-rail huisvest twee panelen (het eigenschappenpaneel én de GEDOCKTE
      // resource-lijst) en kent twee dingen die hem verbergen: `rightPanelCollapsed`, en het
      // VOLLEDIGE resource-paneel (`showResourcePanel && !resourcePanelDocked`) dat de hele
      // werkruimte — Gantt én rail — vervangt. Beide invarianten staan hier, op de ene plek waar
      // alle callsites (ribbon, MCP-tools, extensies, rondleiding) doorheen lopen, in plaats van
      // als losse plakker per knop.
      const showResourceNext = updates.showResourcePanel ?? s.ui.showResourcePanel;
      const dockedNext = updates.resourcePanelDocked ?? s.ui.resourcePanelDocked;
      const dockIsPresent = showResourceNext && dockedNext;
      // (1) + (1b) Issue #46c en #46-slot — één regel, twee gelijkwaardige railpanelen:
      //
      //     een paneel expliciet AANzetten maakt het ook echt zichtbaar.
      //
      // Zonder dit lichtte "Resourcedock" wel op terwijl de ingeklapte rail leeg bleef (#46c), en
      // met twee panelen geldt precies hetzelfde voor "Eigenschappen".
      //
      // Let op de vorm van de test: hij kijkt naar wat de AANROEPER schrijft, niet naar een
      // false→true-overgang. Twee redenen, allebei nagemeten:
      //   - een overgangstest mist de stand "paneel staat al aan, maar de kolom is ingeklapt":
      //     de knop is dan niet actief, en zijn klik zou een stille no-op zijn — precies de
      //     #46c-klacht terug;
      //   - een test op de EINDstand (`dockIsPresent`) zou bij élke `setUI` vuren zolang het dock
      //     aan staat, en de kolom dus nooit ingeklapt laten blijven.
      // `updates.rightPanelCollapsed === undefined` laat een expliciete patch altijd winnen.
      const turnsDockOn = (updates.showResourcePanel === true || updates.resourcePanelDocked === true) && dockIsPresent;
      const turnsPropertiesOn = updates.showPropertiesPanel === true;
      if ((turnsDockOn || turnsPropertiesOn) && updates.rightPanelCollapsed === undefined) {
        (updates as Partial<UIState>).rightPanelCollapsed = false;
      }
      // (2) Andersom: wie de rail expliciet UITklapt terwijl het volledige resource-paneel de
      //     werkruimte bezet houdt, vroeg om die rail — geef de ruimte dus vrij. Het GEDOCKTE
      //     resource-paneel valt hier bewust buiten: dat deelt de werkruimte juist mét de Gantt.
      if (
        updates.rightPanelCollapsed === false
        && showResourceNext && !dockedNext
        && updates.showResourcePanel === undefined
      ) {
        (updates as Partial<UIState>).showResourcePanel = false;
        (updates as Partial<UIState>).resourcePanelDocked = false;
      }
      // (3) Issue #46 (slot) — sluitstuk van dezelfde familie: wie de rail UITklapt moet ook echt
      //     iets te zien krijgen. Staat er geen enkel railpaneel aan, dan is er niets om uit te
      //     klappen; zet dan Eigenschappen aan (het paneel dat standaard aan staat). Let op de
      //     volgorde: invariant (2) hierboven kan het volledige resourcepaneel net hebben
      //     weggehaald, dus lees de EINDstand uit `updates`.
      if (updates.rightPanelCollapsed === false) {
        const dockFinal = (updates.showResourcePanel ?? s.ui.showResourcePanel)
          && (updates.resourcePanelDocked ?? s.ui.resourcePanelDocked);
        const propsFinal = updates.showPropertiesPanel ?? s.ui.showPropertiesPanel;
        if (!dockFinal && !propsFinal) {
          (updates as Partial<UIState>).showPropertiesPanel = true;
        }
      }
      Object.assign(s.ui, updates);
      const max = maxGanttZoom(s.ui.enableQuarterHourZoom, s.ui.enableHourPlanning);
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

  setAiServerStatus: (status) => set((s) => { s.ui.aiServerStatus = status; }),
  setAiPaused: (paused) => set((s) => { s.ui.aiPaused = paused; }),
  setAiReadOnly: (readOnly) => set((s) => { s.ui.aiReadOnly = readOnly; }),
  // issue #26: sessie-UI-state, dus geen undo-snapshot en niet gepersisteerd — puur een signaal
  // waar `StructureLockedNotice` op reageert.
  notifyStructureLocked: () =>
    set((s) => { s.ui.structureLockedNotice += 1; }),

  notify: (n) =>
    set((s) => {
      // 1. Samenvouwen: bestaat er al een melding met dezelfde dedupeKey? Verhoog dan alleen de
      //    teller en ververs de velden (laatste boodschap/fout zichtbaar), maar laat de POSITIE in
      //    de stapel staan — anders springt de stapel bij elke herhaling op en neer.
      if (n.dedupeKey) {
        const existing = s.ui.notifications.find((x) => x.dedupeKey === n.dedupeKey);
        if (existing) {
          existing.count += 1;
          existing.severity = n.severity;
          existing.messageKey = n.messageKey;
          existing.params = n.params;
          existing.detail = n.detail;
          return;
        }
      }
      // 2. Nieuwe melding onderaan toevoegen.
      s.ui.notifications.push({ ...n, id: `n${++notificationSeq}`, count: 1 });
      // 3. Begrens op MAX_NOTIFICATIONS. Bij overschrijding verwijderen we bij VOORKEUR de oudste
      //    `info`, en pas als die er niet is de oudste melding overall — een fout mag nooit door een
      //    info verdrongen worden (de cyclus-/opslaafout is juist degene die moet blijven staan).
      if (s.ui.notifications.length > MAX_NOTIFICATIONS) {
        const idx = s.ui.notifications.findIndex((x) => x.severity === 'info');
        if (idx >= 0) s.ui.notifications.splice(idx, 1);
        else s.ui.notifications.shift();
      }
    }),

  dismissNotification: (id) =>
    set((s) => {
      const idx = s.ui.notifications.findIndex((x) => x.id === id);
      if (idx >= 0) s.ui.notifications.splice(idx, 1);
    }),

  openHelpArticle: (articleId) =>
    set((s) => {
      s.ui.activeRibbonTab = 'file';
      s.ui.backstageSection = 'help';
      s.ui.pendingHelpArticleId = articleId;
    }),

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

  collapseTasks: (taskIds) => {
    set((s) => {
      const summaryIds = s.tasks.filter((t) => t.childIds.length > 0).map((t) => t.id);
      if (!taskIds || taskIds.length === 0) {
        // Geen doellijst ⇒ alles. Bewust een VERVANGING (niet toevoegen): zo verdwijnen meteen ook
        // ids van taken die inmiddels geen summary meer zijn.
        s.ui.collapsedTaskIds = summaryIds;
        return;
      }
      const isSummary = new Set(summaryIds);
      const collapsed = new Set(s.ui.collapsedTaskIds);
      for (const id of taskIds) {
        if (!isSummary.has(id) || collapsed.has(id)) continue; // blad of al ingeklapt ⇒ overslaan
        collapsed.add(id);
        s.ui.collapsedTaskIds.push(id);
      }
    });
    get().recomputeViewRows(); // collapse verandert de zichtbaarheid van kinderen (§4.3).
  },

  expandTasks: (taskIds) => {
    set((s) => {
      const summaryIds = new Set(s.tasks.filter((t) => t.childIds.length > 0).map((t) => t.id));
      // Doellijst beperken tot echte summary-taken; zonder lijst gelden ze allemaal.
      const targets = !taskIds || taskIds.length === 0
        ? summaryIds
        : new Set(taskIds.filter((id) => summaryIds.has(id)));
      s.ui.collapsedTaskIds = s.ui.collapsedTaskIds.filter((id) => !targets.has(id));
    });
    get().recomputeViewRows();
  },

  expandAncestorsOf: (taskId) => {
    const s = get();
    const taskMap = new Map(s.tasks.map((t) => [t.id, t]));
    const toExpand: string[] = [];
    // Bezocht-bewaking naar het patroon van `isSelfOrDescendant`/`taskTree.ts`: een corrupte
    // `parentId`-cyclus is bereikbaar via IFC-import (`extractNesting` zet 'm zonder cyklusguard),
    // en zonder deze wacht deze lus dan oneindig i.p.v. de vier andere oudersketen-wandelingen in
    // dit project die er wél tegen bewaken.
    const bezocht = new Set<string>();
    let parentId = taskMap.get(taskId)?.parentId ?? null;
    while (parentId && !bezocht.has(parentId)) {
      bezocht.add(parentId);
      if (s.ui.collapsedTaskIds.includes(parentId)) toExpand.push(parentId);
      parentId = taskMap.get(parentId)?.parentId ?? null;
    }
    if (toExpand.length > 0) get().expandTasks(toExpand);
  },

  // Modus-bewust (issue #35): de enige aanroeper is het bandkop-contextmenu, en dat verschijnt
  // alléén in gegroepeerde weergave — daar bedoelt "alles uit-/inklappen" dus de banden.
  expandAll: () => {
    const s = get();
    if ((s.view.group?.length ?? 0) > 0) s.expandAllGroups();
    else s.expandTasks();
  },

  collapseAll: () => {
    const s = get();
    if ((s.view.group?.length ?? 0) > 0) s.collapseAllGroups();
    else s.collapseTasks();
  },
});
