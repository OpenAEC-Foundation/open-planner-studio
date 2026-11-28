import type {
  ReadyExtension,
  QuarantinedExtension,
  ExtensionStatus,
  CatalogEntry,
  CatalogIssue,
  RibbonButtonRegistration,
  ImporterDefinition,
} from '@/extensions/types';
import type { AppSlice, RibbonTab } from './types';

export interface ExtensionRibbonButton extends Omit<RibbonButtonRegistration, 'tab'> {
  tab: RibbonTab;
  extensionId: string;
}

export interface ExtensionImporter extends ImporterDefinition {
  extensionId: string;
}

export interface ExtensionSlice {
  installedExtensions: Record<string, ReadyExtension>;
  quarantinedExtensions: Record<string, QuarantinedExtension>;
  extensionRibbonButtons: ExtensionRibbonButton[];
  extensionImporters: ExtensionImporter[];
  catalogEntries: CatalogEntry[];
  catalogIssues: CatalogIssue[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogLastFetched: number | null;

  registerReadyExtension: (ext: ReadyExtension) => void;
  registerQuarantinedExtension: (ext: QuarantinedExtension) => void;
  removeQuarantinedExtension: (quarantineId: string) => void;
  unregisterExtension: (id: string) => void;
  setExtensionStatus: (id: string, status: ExtensionStatus, error?: string) => void;
  setExtensionPersistenceError: (id: string, error: string) => void;

  addExtensionRibbonButton: (btn: ExtensionRibbonButton) => void;
  removeExtensionRibbonButton: (extensionId: string, label: string) => void;

  addExtensionImporter: (imp: ExtensionImporter) => void;
  removeExtensionImporter: (extensionId: string, importerId: string) => void;

  removeAllExtensionUI: (extensionId: string) => void;

  setCatalog: (entries: CatalogEntry[], issues: CatalogIssue[], fetchedAt: number) => void;
  setCatalogLoading: (loading: boolean) => void;
  setCatalogError: (error: string | null) => void;
}

export const createExtensionSlice: AppSlice<ExtensionSlice> = (set) => ({
  installedExtensions: {},
  quarantinedExtensions: {},
  extensionRibbonButtons: [],
  extensionImporters: [],
  catalogEntries: [],
  catalogIssues: [],
  catalogLoading: false,
  catalogError: null,
  catalogLastFetched: null,

  registerReadyExtension: (ext) =>
    set((s) => {
      s.installedExtensions[ext.id] = ext;
      for (const [quarantineId, quarantined] of Object.entries(s.quarantinedExtensions)) {
        if (quarantined.storageKey === ext.id) delete s.quarantinedExtensions[quarantineId];
      }
    }),

  registerQuarantinedExtension: (ext) =>
    set((s) => {
      s.quarantinedExtensions[ext.quarantineId] = ext;
    }),

  removeQuarantinedExtension: (quarantineId) =>
    set((s) => {
      delete s.quarantinedExtensions[quarantineId];
    }),

  unregisterExtension: (id) =>
    set((s) => {
      delete s.installedExtensions[id];
      s.extensionRibbonButtons = s.extensionRibbonButtons.filter(
        b => b.extensionId !== id
      );
      s.extensionImporters = s.extensionImporters.filter(
        i => i.extensionId !== id
      );
    }),

  setExtensionStatus: (id, status, error) =>
    set((s) => {
      const ext = s.installedExtensions[id];
      if (ext) {
        ext.status = status;
        ext.error = error;
      }
    }),

  setExtensionPersistenceError: (id, error) =>
    set((s) => {
      const ext = s.installedExtensions[id];
      if (ext) ext.error = error;
    }),

  addExtensionRibbonButton: (btn) =>
    set((s) => {
      const exists = s.extensionRibbonButtons.some(
        b => b.extensionId === btn.extensionId && b.label === btn.label
      );
      if (!exists) s.extensionRibbonButtons.push(btn);
    }),

  removeExtensionRibbonButton: (extensionId, label) =>
    set((s) => {
      s.extensionRibbonButtons = s.extensionRibbonButtons.filter(
        b => !(b.extensionId === extensionId && b.label === label)
      );
    }),

  addExtensionImporter: (imp) =>
    set((s) => {
      const exists = s.extensionImporters.some(
        i => i.extensionId === imp.extensionId && i.id === imp.id
      );
      if (!exists) s.extensionImporters.push(imp);
    }),

  removeExtensionImporter: (extensionId, importerId) =>
    set((s) => {
      s.extensionImporters = s.extensionImporters.filter(
        i => !(i.extensionId === extensionId && i.id === importerId)
      );
    }),

  removeAllExtensionUI: (extensionId) =>
    set((s) => {
      s.extensionRibbonButtons = s.extensionRibbonButtons.filter(
        b => b.extensionId !== extensionId
      );
      s.extensionImporters = s.extensionImporters.filter(
        i => i.extensionId !== extensionId
      );
    }),

  setCatalog: (entries, issues, fetchedAt) =>
    set((s) => {
      s.catalogEntries = entries;
      s.catalogIssues = issues;
      s.catalogLastFetched = fetchedAt;
      s.catalogError = null;
    }),

  setCatalogLoading: (loading) =>
    set((s) => {
      s.catalogLoading = loading;
    }),

  setCatalogError: (error) =>
    set((s) => {
      s.catalogError = error;
    }),
});
