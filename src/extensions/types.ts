/**
 * Typen voor het extensiesysteem van Open Planner Studio.
 * Gemodelleerd naar Open Calc Studio / Open 2D Studio:
 * een extensie = manifest.json + main.js (CommonJS, exporteert onLoad/onUnload),
 * verpakt als ZIP of los .js-bestand, opgeslagen in IndexedDB.
 */
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { RibbonTab } from '@/state/slices/types';

// ── Categorieën & permissies ──

export type ExtensionCategory =
  | 'Import/Export'
  | 'Planning'
  | 'Reporting'
  | 'Utility'
  | 'Other';

// Declaratief in het manifest; 'ribbon' en 'events' worden afgedwongen in de API.
export type ExtensionPermission =
  | 'commands'
  | 'ribbon'
  | 'backstage'
  | 'events'
  | 'filesystem'
  | 'network';

export type ExtensionStatus = 'enabled' | 'disabled' | 'error' | 'loading';

// ── Manifest (manifest.json in de extensie) ──

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
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

// ── Geïnstalleerde extensie (runtime-record in de store) ──

export interface InstalledExtension {
  id: string;
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  error?: string;
}

// ── Plugin-interface (wat main.js exporteert) ──

export interface ExtensionPlugin {
  onLoad(api: ExtensionApi): void | Promise<void>;
  onUnload?(): void | Promise<void>;
}

// ── Importresultaat = exact de vorm die loadState verwacht ──

export interface ImportResult {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

// ── Importer-registratie ──

export interface ImporterDefinition {
  id: string;
  name: string;
  description: string;
  fileExtensions: string[];   // bv. ['.xlsx', '.xer']
  icon?: string;
  handler: (file: File) => Promise<ImportResult>;
}

// ── Ribbon-registratie ──

export interface RibbonButtonRegistration {
  tab: RibbonTab;             // bv. 'start' of 'planning'
  group: string;              // groepslabel in de ribbon
  label: string;
  icon?: string;              // inline SVG-string
  onClick: () => void;
  tooltip?: string;
}

// ── Extension API (meegegeven aan onLoad) ──

export interface ExtensionApi {
  readonly extensionId: string;

  /** Registratie van import-formaten (verschijnen in Backstage → Importeren). */
  importers: {
    register(def: ImporterDefinition): void;
    unregister(id: string): void;
  };

  /** Lees-/schrijftoegang tot de planningsdata. Mutaties lopen via store-acties
   *  (die zelf undo-snapshots pushen); na bulk-wijzigingen zelf recalculate() aanroepen. */
  data: {
    getProject(): Project;
    getCalendar(): WorkCalendar;
    getTasks(): Task[];
    getSequences(): Sequence[];
    getResources(): Resource[];
    getAssignments(): ResourceAssignment[];
    addTask(task: Partial<Task> & { name: string }): string;
    updateTask(id: string, updates: Partial<Task>): void;
    addSequence(seq: Omit<Sequence, 'id'>): string;
    /** Vervang het volledige project (zoals een import doet) en herbereken. */
    loadProject(result: ImportResult): void;
    /** runCPM — herbereken het schema. */
    recalculate(): void;
  };

  /** Globale event-bus (permissie 'events' vereist). */
  events: {
    on(event: string, listener: (data: unknown) => void): () => void;
    off(event: string, listener: (data: unknown) => void): void;
    emit(event: string, data?: unknown): void;
  };

  /** UI-registratie. */
  ui: {
    addRibbonButton(reg: RibbonButtonRegistration): void;
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
  };

  /** Per-extensie instellingen (localStorage, prefix 'ops-ext:<id>:'). */
  settings: {
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T): void;
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
  minAppVersion: string;
  repository: string;
  downloadUrl: string;        // wijst naar een release-ZIP
  icon?: string;
}
