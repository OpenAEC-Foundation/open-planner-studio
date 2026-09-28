/**
 * Typen voor het extensiesysteem van Open Planner Studio.
 * Gemodelleerd naar Open Calc Studio / Open 2D Studio:
 * een extensie = manifest.json + main.js (CommonJS, exporteert onLoad/onUnload),
 * verpakt als ZIP of los .js-bestand, opgeslagen in IndexedDB.
 */
import type {
  ExtProject,
  ExtCalendar,
  ExtTask,
  ExtSequence,
  ExtResource,
  ExtAssignment,
  ExtImportResult,
  ExtImportSourceCatalogPage,
  ExtImportSourceCollection,
  ExtImportSourceInfo,
  ExtImportSourceIssue,
  ExtImportSourcePageOptions,
  ExtRibbonTab,
  ExtFontProvider,
} from './extTypes';

// ── Categorieën & permissies ──

export type ExtensionCategory =
  | 'Import/Export'
  | 'Planning'
  | 'Reporting'
  | 'Utility'
  | 'Fonts'
  | 'Other';

/**
 * Declaratieve manifest-permissies. De afdwinging is gecentraliseerd in `permissions.ts`:
 *   • 'events'    → api.events.*        (hard afgedwongen)
 *   • 'ribbon'    → api.ui.addRibbonButton (hard afgedwongen)
 *   • 'backstage' → api.importers.*      (compat-WARN; zie permissions.ts / docs/extensions.md)
 *   • 'filesystem' / 'network' → puur installatie-informatief; GEEN API-oppervlak en in
 *     same-context JS niet technisch afdwingbaar (getoonde intentie, geen sandbox-garantie).
 *
 *   • 'pdf-fonts'  → api.pdfFonts.register (hard afgedwongen) — een CJK/glyf-font-provider voor de
 *     vector-PDF-export registreren (zie src/services/pdf/fontRegistry.ts).
 *   • 'importSource' → api.data.getImportSourceInfo/getImportSourceIssue/getImportSourceChunk/getImportSourceCatalogPage
 *     (hard afgedwongen, DEFAULT-DENY) — geeft de VOLLEDIGE oorspronkelijke bronbytes van een
 *     geïmporteerd bestand (bv. de rauwe XER) terug, inclusief velden die de importlaag bewust niet
 *     in het projectmodel materialiseert (audit-/herkomstvelden, kosten, review-/locatievelden, …).
 *     Dat is wezenlijk breder dan de rest van `data.*` en dus expliciet GEEN kern-API — zie de
 *     privacyparagraaf in docs/extensions.md.
 *   • 'help'        → api.help.* (hard afgedwongen, sinds contract 1.4.0) — Help-artikelen registreren,
 *     een meegeleverd projectbestand als nieuw document openen en het begeleidingspaneel aansturen.
 *
 * Manifesten die een onbekende waarde noemen (bv. het vervallen 'commands'), worden bij het activeren
 * gefilterd met een appLog-warn (`sanitizeManifestPermissions`) — installatie blijft slagen.
 */
export type ExtensionPermission =
  | 'ribbon'
  | 'backstage'
  | 'events'
  | 'filesystem'
  | 'network'
  | 'pdf-fonts'
  | 'importSource'
  | 'help';

export type ExtensionStatus = 'enabled' | 'disabled' | 'error' | 'loading';

// ── Manifest (manifest.json in de extensie) ──

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  /**
   * Semver van het EXTENSIE-CONTRACT waartegen deze extensie gebouwd is (bv. `"1.0"`), los van
   * `minAppVersion`. Zie `apiVersion.ts` voor waarom die twee verschillende vragen beantwoorden.
   * Optioneel: oudere manifesten missen hem en blijven gewoon laden (met een warn).
   */
  apiVersion?: string;
  /** Minimale APP-versie (CalVer) — een uitspraak over features, niet over het contract. */
  minAppVersion: string;
  author: string;
  description: string;
  category: ExtensionCategory;
  main: string;              // relatief pad naar main.js
  permissions: ExtensionPermission[];
  repository?: string;
  tags?: string[];
  icon?: string;             // inline SVG-string of emoji
}

export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string };

export interface CatalogIssue {
  index: number;
  idHint?: string;
  error: string;
}

// ── Gevalideerde extensies en onuitvoerbare opslagrecords ──

export interface ReadyExtension {
  kind: 'ready';
  id: string;
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  error?: string;
}

/** Gevalideerde, in geheugen genormaliseerde vorm van één IndexedDB-record. */
export interface ReadyStoredExtension {
  id: string;
  manifest: ExtensionManifest;
  mainCode: string;
  enabled: boolean;
  assets?: Record<string, Uint8Array>;
  legacyWarnings: string[];
  storageKey: IDBValidKey;
}

export interface QuarantinedExtension {
  kind: 'quarantined';
  quarantineId: string;
  storageKey: IDBValidKey;
  displayName: string;
  reason: string;
  status: 'quarantined';
}

export type ExtensionRecord = ReadyExtension | QuarantinedExtension;

// ── Plugin-interface (wat main.js exporteert) ──

export interface ExtensionPlugin {
  onLoad(api: ExtensionApi): void | Promise<void>;
  onUnload?(): void | Promise<void>;
}

// ── Importer-registratie ──
// Het importresultaat is EXT-FACING (`ExtImportResult`, zie extTypes.ts). De host mapt het op de
// importer-grens naar zijn interne `ImportResult` (extMappers.fromExtImportResult).

export interface ImporterDefinition {
  id: string;
  name: string;
  description: string;
  fileExtensions: string[];   // bv. ['.xlsx', '.xer']
  icon?: string;
  handler: (file: File) => Promise<ExtImportResult>;
}

// ── Ribbon-registratie ──

export interface RibbonButtonRegistration {
  tab: ExtRibbonTab;          // bv. 'start' of 'planning' — ext-facing unie, zie extTypes.ts
  group: string;              // groepslabel in de ribbon
  label: string;
  icon?: string;              // inline SVG-string
  onClick: () => void;
  tooltip?: string;
}

// ── Help & begeleiding (permissie 'help', sinds contract 1.4.0) ──

/** Tekst in de twee docstalen. Elke andere UI-taal toont `en` (zoals de Help-viewer). */
export interface ExtHelpText {
  nl: string;
  en: string;
}

/**
 * Eén Help-artikel dat een extensie aanlevert. Verschijnt in Backstage → Help onder *Tutorials*,
 * genummerd volgens `order`. De tekst is de Markdown-subset van de Help-viewer; afbeeldingen
 * (`![alt](img/{lang}/x.webp)`) komen uit de eigen assets van de extensie (`{lang}` = `nl`/`en`),
 * en een link `[tekst](project://start.ifc)` opent dat meegeleverde projectbestand als nieuw document.
 */
export interface ExtHelpArticle {
  /** Kleine letters, cijfers en streepjes; uniek over alle bronnen. */
  id: string;
  kind: 'tutorial';
  /** Positie in de leerroute (positief geheel getal). */
  order: number;
  title: ExtHelpText;
  body: ExtHelpText;
}

/**
 * Eén stap van een begeleiding. De `body` (Markdown-subset) mag één regel `---` bevatten: wat
 * ervóór staat is de opdracht, wat erna staat de uitleg ("wat je nu ziet, en waarom"), die pas
 * verschijnt zodra de stap gedaan is.
 */
export interface ExtGuideStep {
  /** Kleine letters, cijfers en streepjes; uniek binnen de begeleiding. */
  id: string;
  body: ExtHelpText;
  /**
   * Waarde van een `data-tour-anchor` in de app (bv. `ribbon:start:addTask`, zie
   * docs/extensions.md). Het element wordt gemarkeerd zolang de stap openstaat.
   */
  anchor?: string;
  /**
   * Is de stap gedaan? De host roept dit aan bij het openen van de stap en daarna (gebundeld) na
   * elke wijziging in de app. Alleen `true` telt; gedaan blijft gedaan tot de stap opnieuw begint.
   * Zonder `check` toont het paneel de knop "Klaar, volgende". Gooit hij, dan meldt de app dat en
   * valt de stap terug op "Klaar, volgende".
   */
  check?: (api: ExtensionApi) => boolean | Promise<boolean>;
  /** "Toon mij": zet de stap klaar (bv. via `api.data.*`). */
  prepare?: (api: ExtensionApi) => void | Promise<void>;
  /** "Opnieuw": naam van een meegeleverd `.ifc` (asset) dat de beginstand van deze stap bevat. */
  resetAsset?: string;
}

/** Een interactieve begeleiding, getekend door de app in het begeleidingspaneel. */
export interface ExtGuide {
  id: string;
  title: ExtHelpText;
  steps: ExtGuideStep[];
}

// ── Extension API (meegegeven aan onLoad) ──

export interface ExtensionApi {
  readonly extensionId: string;

  /** Appbrede registratie van import-formaten (verschijnen in Backstage → Importeren). */
  importers: {
    register(def: ImporterDefinition): void;
    unregister(id: string): void;
  };

  /** Lees-/schrijftoegang tot de expliciet door de host gebonden documentcontext. `get*` levert
   *  VERSE, MUTEERBARE kopieën (Ext*-DTO's,
   *  géén bevroren store-objecten): muteren van het resultaat raakt de store NIET — schrijf via
   *  addTask/updateTask/addSequence. Mutaties lopen via store-acties (die zelf undo-snapshots pushen);
   *  na bulk-wijzigingen zelf recalculate() aanroepen. */
  data: {
    getProject(): ExtProject;
    getCalendar(): ExtCalendar;
    getTasks(): ExtTask[];
    getSequences(): ExtSequence[];
    getResources(): ExtResource[];
    getAssignments(): ExtAssignment[];
    /**
     * Kleine read-only XER-bronsamenvatting; null voor een niet-XER-document. Permissie
     * `importSource` vereist — dit is GEEN kern-API-methode: zonder de permissie gooit deze
     * methode vóórdat er data gelezen wordt. Zie de permissie-uitleg hierboven en docs/extensions.md.
     */
    getImportSourceInfo(): ExtImportSourceInfo | null;
    /**
     * `null`, tenzij het document een XER-bronarchief HAD dat bij het openen onbruikbaar bleek en is
     * weggelaten — dan de reden. Onderscheidt "nooit een XER-bron" van "bron verloren bij openen".
     * Permissie `importSource` vereist (het verraadt dat er een XER-bron was).
     */
    getImportSourceIssue(): ExtImportSourceIssue | null;
    /**
     * Eén verse kopie van een retained XER-bronchunk; null voor een niet-XER-document. Permissie
     * `importSource` vereist.
     */
    getImportSourceChunk(index: number): Uint8Array | null;
    /**
     * Pagineerbare, gekopieerde retained XER-catalogusdata; null voor een niet-XER-document.
     * Permissie `importSource` vereist.
     */
    getImportSourceCatalogPage(
      collection: ExtImportSourceCollection,
      options?: ExtImportSourcePageOptions,
    ): ExtImportSourceCatalogPage | null;
    /**
     * Een `parentId` moet een bestaande taak zijn; een onbekende ouder gooit een fout. `resourceIds`
     * volgt uit de toewijzingen: alleen `[]` mag mee; een andere waarde gooit een fout.
     */
    addTask(task: Partial<ExtTask> & { name: string }): string;
    /**
     * Een gewijzigde `parentId` wordt uitgevoerd als verplaatsing (achteraan bij de nieuwe ouder,
     * `null` = wortel), met de kindlijsten van oude en nieuwe ouder bijgewerkt. Een onbekende ouder
     * of een ouder die de taak zelf of een eigen afstammeling is, gooit een fout vóór er iets
     * gewijzigd is. `resourceIds` volgt uit de toewijzingen en is niet los te zetten: gelijk aan de
     * huidige waarde (bv. een ongewijzigd `getTasks()`-object; volgorde telt niet) wordt genegeerd,
     * een andere waarde gooit een fout vóór er iets gewijzigd is. Een onbekend taak-id blijft een
     * stille no-op.
     */
    updateTask(id: string, updates: Partial<ExtTask>): void;
    /** Retourneert het nieuwe relatie-id, of `null` wanneer de relatie geweigerd is. */
    addSequence(seq: Omit<ExtSequence, 'id'>): string | null;
    /** Vervang het volledige project (zoals een import doet) en herbereken. */
    loadProject(result: ExtImportResult): void;
    /** runCPM — herbereken het schema. */
    recalculate(): void;
    /**
     * Voer een reeks mutaties uit als ÉÉN ongedaan-maakbare stap.
     *
     * Zonder dit pusht elke `addTask`/`updateTask` zijn eigen deep-clone-snapshot: een lus van n
     * toevoegingen kloont 1 + 2 + … + n taken (kwadratisch) en laat n undo-stappen achter voor wat
     * de gebruiker als één handeling ziet. Binnen `batch` wordt de snapshot één keer genomen.
     *
     * Gebruik dit voor élke lus die meer dan een handvol mutaties doet — een importer bijvoorbeeld:
     *
     *   api.data.batch(() => { for (const t of rows) api.data.addTask(t); });
     *   api.data.recalculate();
     *
     * Geen rollback bij een fout: gooit de callback, dan blijft wat al gemuteerd is staan en dekt de
     * ene snapshot de begintoestand — de gebruiker draait het in één keer terug. Nesten is veilig.
     */
    batch<T>(fn: () => T): T;
  };

  /** Globale event-bus (permissie 'events' vereist). */
  events: {
    on(event: string, listener: (data: unknown) => void): () => void;
    off(event: string, listener: (data: unknown) => void): void;
    emit(event: string, data?: unknown): void;
  };

  /** Appbrede UI-registratie; deze volgt de hostbinding, niet de documentcontext. */
  ui: {
    addRibbonButton(reg: RibbonButtonRegistration): void;
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
  };

  /** Per-extensie instellingen (localStorage, prefix 'ops-ext:<id>:'). */
  settings: {
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T): void;
  };

  /**
   * Registratie van font-providers voor de vector-PDF-export (permissie 'pdf-fonts' vereist).
   * Een provider levert rauwe glyf-TTF-bytes (bv. via `api.assets.get(...)`) + een codepoint-dekking;
   * de vector-pagineerder subset en bedt hem conditioneel in. De teruggegeven provider wordt bij
   * disable/unload automatisch weer uitgeschreven (net als importers/ribbon-knoppen).
   */
  pdfFonts: {
    register(provider: ExtFontProvider): void;
  };

  /**
   * Lees de eigen, mee-verpakte binaire assets van de extensie (de niet-`main`/`manifest`-bestanden
   * uit de installatie-ZIP), op naam. Levert een kopie van de bytes of `undefined` als de asset niet
   * bestaat. Géén permissie: dit zijn de eigen bestanden van de extensie (analoog aan `settings.*`).
   * Een los `.js`-geïnstalleerde extensie heeft geen assets → altijd `undefined`.
   */
  assets: {
    get(name: string): Uint8Array | undefined;
  };

  /**
   * Help & begeleiding (permissie `help`, sinds contract 1.4.0). Alles wat hier geregistreerd of
   * gestart wordt, ruimt de app op bij uitschakelen/verwijderen van de extensie.
   */
  help: {
    /**
     * Registreer (of vervang) de Help-artikelen van deze extensie. Ongeldige invoer registreert
     * niets en gooit een fout met alle gevonden problemen.
     */
    registerArticles(articles: ExtHelpArticle[]): void;
    /** Haal de artikelen van deze extensie weer uit Help. */
    unregisterArticles(): void;
    /**
     * Open een meegeleverd `.ifc` (asset) als NIEUW document — zoals een voorbeeld: zonder
     * opslagdoel, het actieve document blijft ongemoeid (alleen een leeg, ongewijzigd tabblad wordt
     * hergebruikt). Wordt afgewezen als de asset ontbreekt, geen `.ifc` is of niet te openen is.
     */
    openBundledProject(assetName: string): Promise<void>;
    /**
     * Start het begeleidingspaneel. Er loopt er hooguit één tegelijk; een nieuwe vervangt de vorige.
     * Een ongeldige begeleiding gooit een fout en start niets.
     */
    startGuide(guide: ExtGuide): void;
    /** Sluit het begeleidingspaneel, als het een begeleiding van deze extensie toont. */
    stopGuide(): void;
  };

  /** Intern — draait alle registraties terug bij disable. */
  _cleanup(): void;
}

// ── Catalogus (extern register op GitHub) ──

export interface ExtensionCatalog {
  version: string;
  lastUpdated: string;
  extensions: CatalogEntry[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: ExtensionCategory;
  tags: string[];
  /** Zie `ExtensionManifest.apiVersion`. Afwezig ⇒ onbekend; de catalogus toont dan geen
   *  contract-compatibiliteit. */
  apiVersion?: string;
  minAppVersion: string;
  repository: string;
  downloadUrl: string;        // wijst naar een release-ZIP
  /**
   * Hex-gecodeerde SHA-256 van de ZIP achter `downloadUrl`. Aanwezig ⇒ de installatie
   * VERIFIEERT de download en weigert bij een verschil; afwezig ⇒ installeren mag, met een
   * waarschuwing in de debug-terminal.
   *
   * Waarom optioneel: de catalogus is een extern bestand (`open-planner-studio-extensions`) dat
   * niet met deze app meebeweegt. Het hard eisen zou elke bestaande entry onbruikbaar maken; het
   * doel is dat een entry MET hash niet meer stil vervangen kan worden.
   */
  sha256?: string;
  icon?: string;
}
