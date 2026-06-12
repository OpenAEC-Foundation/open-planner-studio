import type {
  InstalledExtension,
  ExtensionStatus,
  CatalogEntry,
  RibbonButtonRegistration,
  ImporterDefinition,
} from '@/extensions/types';
import type { AppSlice } from './types';

export interface ExtensionRibbonButton extends RibbonButtonRegistration {
  extensionId: string;
}

export interface ExtensionImporter extends ImporterDefinition {
  extensionId: string;
}

export interface ExtensionSlice {
  // State
  installedExtensions: Record<string, InstalledExtension>;
  extensionRibbonButtons: ExtensionRibbonButton[];
  extensionImporters: ExtensionImporter[];
  catalogEntries: CatalogEntry[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogLastFetched: number | null;

  // Extensie-CRUD
  registerExtension: (ext: InstalledExtension) => void;
  unregisterExtension: (id: string) => void;
  setExtensionStatus: (id: string, status: ExtensionStatus, error?: string) => void;

  // Ribbon-knoppen
  addExtensionRibbonButton: (btn: ExtensionRibbonButton) => void;
  removeExtensionRibbonButton: (extensionId: string, label: string) => void;

  // Importers
  addExtensionImporter: (imp: ExtensionImporter) => void;
  removeExtensionImporter: (extensionId: string, importerId: string) => void;

  // Alle UI van een extensie opruimen
  removeAllExtensionUI: (extensionId: string) => void;

  // Catalogus
  setCatalog: (entries: CatalogEntry[], fetchedAt: number) => void;
  setCatalogLoading: (loading: boolean) => void;
  setCatalogError: (error: string | null) => void;
}

export const createExtensionSlice: AppSlice<ExtensionSlice> = (set) => ({
  installedExtensions: {},
  extensionRibbonButtons: [],
  extensionImporters: [],
  catalogEntries: [],
  catalogLoading: false,
  catalogError: null,
  catalogLastFetched: null,

  registerExtension: (ext) =>
    set((s) => {
      s.installedExtensions[ext.id] = ext;
    }),

  unregisterExtension: (id) =>
    set((s) => {
      delete s.installedExtensions[id];
      // Ruim ook alle UI-registraties van deze extensie op (voorkomt orphans).
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

  setCatalog: (entries, fetchedAt) =>
    set((s) => {
      s.catalogEntries = entries;
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
