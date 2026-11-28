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

export type ExtensionCategory =
  | 'Import/Export'
  | 'Planning'
  | 'Reporting'
  | 'Utility'
  | 'Fonts'
  | 'Other';

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

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  apiVersion?: string;
  minAppVersion: string;
  author: string;
  description: string;
  category: ExtensionCategory;
  main: string;
  permissions: ExtensionPermission[];
  repository?: string;
  tags?: string[];
  icon?: string;
}

export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string };

export interface CatalogIssue {
  index: number;
  idHint?: string;
  error: string;
}

export interface ReadyExtension {
  kind: 'ready';
  id: string;
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  error?: string;
}

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

export interface ExtensionPlugin {
  onLoad(api: ExtensionApi): void | Promise<void>;
  onUnload?(): void | Promise<void>;
}

export interface ImporterDefinition {
  id: string;
  name: string;
  description: string;
  fileExtensions: string[];
  icon?: string;
  handler: (file: File) => Promise<ExtImportResult>;
}

export interface RibbonButtonRegistration {
  tab: ExtRibbonTab;
  group: string;
  label: string;
  icon?: string;
  onClick: () => void;
  tooltip?: string;
}

export interface ExtHelpText {
  nl: string;
  en: string;
}

export interface ExtHelpArticle {
  id: string;
  kind: 'tutorial';
  order: number;
  title: ExtHelpText;
  body: ExtHelpText;
}

export interface ExtGuideStep {
  id: string;
  body: ExtHelpText;
  anchor?: string;
  check?: (api: ExtensionApi) => boolean | Promise<boolean>;
  prepare?: (api: ExtensionApi) => void | Promise<void>;
  resetAsset?: string;
}

export interface ExtGuide {
  id: string;
  title: ExtHelpText;
  steps: ExtGuideStep[];
}

export interface ExtensionApi {
  readonly extensionId: string;

  importers: {
    register(def: ImporterDefinition): void;
    unregister(id: string): void;
  };

  data: {
    getProject(): ExtProject;
    getCalendar(): ExtCalendar;
    getTasks(): ExtTask[];
    getSelectedTaskIds(): string[];
    getSequences(): ExtSequence[];
    getResources(): ExtResource[];
    getAssignments(): ExtAssignment[];
    getImportSourceInfo(): ExtImportSourceInfo | null;
    getImportSourceIssue(): ExtImportSourceIssue | null;
    getImportSourceChunk(index: number): Uint8Array | null;
    getImportSourceCatalogPage(
      collection: ExtImportSourceCollection,
      options?: ExtImportSourcePageOptions,
    ): ExtImportSourceCatalogPage | null;
    addTask(task: Partial<ExtTask> & { name: string }): string;
    updateTask(id: string, updates: Partial<ExtTask>): void;
    addSequence(seq: Omit<ExtSequence, 'id'>): string | null;
    loadProject(result: ExtImportResult): void;
    recalculate(): void;
    batch<T>(fn: () => T): T;
  };

  events: {
    on(event: string, listener: (data: unknown) => void): () => void;
    off(event: string, listener: (data: unknown) => void): void;
    emit(event: string, data?: unknown): void;
  };

  ui: {
    addRibbonButton(reg: RibbonButtonRegistration): void;
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
  };

  settings: {
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T): void;
  };

  pdfFonts: {
    register(provider: ExtFontProvider): void;
  };

  assets: {
    get(name: string): Uint8Array | undefined;
  };

  help: {
    registerArticles(articles: ExtHelpArticle[]): void;
    unregisterArticles(): void;
    openBundledProject(assetName: string): Promise<void>;
    startGuide(guide: ExtGuide): void;
    stopGuide(): void;
  };

  _cleanup(): void;
}

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
  apiVersion?: string;
  minAppVersion: string;
  repository: string;
  downloadUrl: string;
  sha256?: string;
  icon?: string;
}
