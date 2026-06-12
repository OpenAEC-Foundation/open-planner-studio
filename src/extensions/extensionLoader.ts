/**
 * Extensie-loader — bewaart, laadt, activeert en deactiveert extensies.
 * Opslag: IndexedDB-database 'ops-extensions' (werkt in browser én Tauri-webview).
 * Uitvoering: new Function(...) met een minimale CommonJS-omgeving; require()
 * geeft alleen de host-SDK ('open-planner-studio') terug.
 */
import type { ExtensionManifest, ExtensionPlugin, InstalledExtension } from './types';
import { createExtensionApi } from './extensionApi';
import { useAppStore } from '@/state/appStore';

// Actieve plugin-instanties (voor opruimen bij disable)
const activePlugins = new Map<string, { plugin: ExtensionPlugin; api: ReturnType<typeof createExtensionApi> }>();

// Voorkomt dubbele activatie terwijl onLoad nog loopt (race bij dubbelklik/parallel laden)
const enablingExtensions = new Set<string>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openExtensionDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('ops-extensions', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('extensions')) {
        db.createObjectStore('extensions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Sluit de verbinding als een andere instantie een versie-upgrade wil doen.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export interface StoredExtension {
  id: string;
  manifest: ExtensionManifest;
  mainCode: string;
  enabled: boolean;
}

export async function saveExtensionToDb(ext: StoredExtension): Promise<void> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readwrite');
    tx.objectStore('extensions').put(ext);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeExtensionFromDb(id: string): Promise<void> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readwrite');
    tx.objectStore('extensions').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllExtensionsFromDb(): Promise<StoredExtension[]> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const req = tx.objectStore('extensions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getExtensionFromDb(id: string): Promise<StoredExtension | undefined> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const req = tx.objectStore('extensions').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Voer extensie-code uit in een minimale CommonJS-sandbox.
 *  Let op: dit is GEEN echte isolatie — extensie-code heeft gewoon toegang tot
 *  window, document, fetch e.d.; permissies zijn een conventie, geen harde grens. */
function executeExtensionCode(mainCode: string): ExtensionPlugin {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports as Record<string, unknown> };

  const requireFn = (moduleName: string) => {
    if (moduleName === 'open-planner-studio') {
      const sdk = (window as unknown as Record<string, unknown>).__openPlannerStudioSdk;
      if (!sdk) {
        console.warn('[Extensies] require("open-planner-studio"): SDK is nog niet beschikbaar; leeg object teruggegeven');
      }
      return sdk || {};
    }
    throw new Error(`Module "${moduleName}" is niet beschikbaar in de extensie-sandbox`);
  };

  try {
    const fn = new Function('module', 'exports', 'require', mainCode);
    fn(moduleObj, moduleExports, requireFn);
  } catch (err) {
    throw new Error(`Uitvoeren van extensie-code mislukt: ${err}`);
  }

  const plugin = (moduleObj.exports as { default?: unknown }).default || moduleObj.exports;
  if (typeof (plugin as ExtensionPlugin).onLoad !== 'function') {
    throw new Error('Extensie moet een onLoad-functie exporteren');
  }

  return plugin as ExtensionPlugin;
}

/** Activeer een extensie: code laden, uitvoeren, onLoad(api) aanroepen. */
export async function enableExtension(id: string): Promise<void> {
  const store = useAppStore.getState();

  if (activePlugins.has(id)) return;
  if (enablingExtensions.has(id)) return;
  enablingExtensions.add(id);

  store.setExtensionStatus(id, 'loading');

  let api: ReturnType<typeof createExtensionApi> | undefined;

  try {
    const stored = await getExtensionFromDb(id);
    if (!stored) throw new Error(`Extensie "${id}" niet gevonden in opslag`);

    const plugin = executeExtensionCode(stored.mainCode);
    api = createExtensionApi(id, stored.manifest.permissions);

    await plugin.onLoad(api);

    activePlugins.set(id, { plugin, api });
    store.setExtensionStatus(id, 'enabled');

    stored.enabled = true;
    try {
      await saveExtensionToDb(stored);
    } catch (persistErr) {
      console.warn(`[Extensies] Kon enabled-status van "${id}" niet opslaan (extensie draait wel):`, persistErr);
    }
  } catch (err) {
    // Draai eventuele al-gedane registraties terug (onLoad kan halverwege gefaald zijn).
    try {
      api?._cleanup();
    } catch (cleanupErr) {
      console.error(`[Extensies] Cleanup na mislukte activatie van "${id}" faalde:`, cleanupErr);
    }
    const message = err instanceof Error ? err.message : String(err);
    store.setExtensionStatus(id, 'error', message);
    console.error(`[Extensies] Activeren van "${id}" mislukt:`, err);
  } finally {
    enablingExtensions.delete(id);
  }
}

/** Deactiveer een extensie en draai alle registraties terug. */
export async function disableExtension(id: string): Promise<void> {
  const active = activePlugins.get(id);
  if (active) {
    try {
      await active.plugin.onUnload?.();
    } catch (err) {
      console.error(`[Extensies] Fout in onUnload van "${id}":`, err);
    }
    active.api._cleanup();
    activePlugins.delete(id);
  }

  useAppStore.getState().setExtensionStatus(id, 'disabled');

  const stored = await getExtensionFromDb(id);
  if (stored) {
    stored.enabled = false;
    await saveExtensionToDb(stored);
  }
}

/** Laad alle geïnstalleerde extensies bij het opstarten (auto-enable wat aan stond). */
export async function loadAllExtensions(): Promise<void> {
  try {
    const allExtensions = await getAllExtensionsFromDb();

    for (const ext of allExtensions) {
      // Idempotent: een al-geregistreerde extensie niet overschrijven (kan al actief zijn)
      if (useAppStore.getState().installedExtensions[ext.id]) continue;

      const installed: InstalledExtension = {
        id: ext.id,
        manifest: ext.manifest,
        status: 'disabled',
      };
      useAppStore.getState().registerExtension(installed);

      if (ext.enabled) {
        await enableExtension(ext.id);
      }
    }
  } catch (err) {
    console.error('[Extensies] Laden van extensies mislukt:', err);
  }
}

export function getActivePlugins() {
  return activePlugins;
}
