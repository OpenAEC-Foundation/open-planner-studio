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
 *   • 'importSource' → api.data.getImportSourceInfo/getImportSourceChunk/getImportSourceCatalogPage
 *     (hard afgedwongen, DEFAULT-DENY) — geeft de VOLLEDIGE oorspronkelijke bronbytes van een
 *     geïmporteerd bestand (bv. de rauwe XER) terug, inclusief velden die de importlaag bewust niet
 *     in het projectmodel materialiseert (audit-/herkomstvelden, kosten, review-/locatievelden, …).
 *     Dat is wezenlijk breder dan de rest van `data.*` en dus expliciet GEEN kern-API — zie de
 *     privacyparagraaf in docs/extensions.md.
 *
 * NB: 'commands' bestond hiervoor maar had nooit een API-oppervlak en is per audit P16 verwijderd.
 * Manifesten die het (of een andere onbekende waarde) nog noemen, worden bij het activeren
 * gefilterd met een appLog-warn (`sanitizeManifestPermissions`) — installatie blijft slagen.
 */
export type ExtensionPermission =
  | 'ribbon'
  | 'backstage'
  | 'events'
  | 'filesystem'
  | 'network'
  | 'pdf-fonts'
  | 'importSource';

export type ExtensionStatus = 'enabled' | 'disabled' | 'error' | 'loading';

// ── Manifest (manifest.json in de extensie) ──

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  /**
   * Semver van het EXTENSIE-CONTRACT waartegen deze extensie gebouwd is (bv. `"1.0"`), los van
   * `minAppVersion`. Zie `apiVersion.ts` voor waarom die twee verschillende vragen beantwoorden.
   * Optioneel: manifesten van vóór K-item 37 missen hem en blijven gewoon laden (met een warn).
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
    addTask(task: Partial<ExtTask> & { name: string }): string;
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
   * Hex-gecodeerde SHA-256 van de ZIP achter `downloadUrl` (K-item 38). Aanwezig ⇒ de installatie
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
