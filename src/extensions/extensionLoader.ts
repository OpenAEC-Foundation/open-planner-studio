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

function openExtensionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ops-extensions', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('extensions')) {
        db.createObjectStore('extensions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

/** Voer extensie-code uit in een minimale CommonJS-sandbox. */
function executeExtensionCode(mainCode: string): ExtensionPlugin {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports as Record<string, unknown> };

  const requireFn = (moduleName: string) => {
    if (moduleName === 'open-planner-studio') {
      return (window as unknown as Record<string, unknown>).__openPlannerStudioSdk || {};
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

  store.setExtensionStatus(id, 'loading');

  try {
    const stored = await getExtensionFromDb(id);
    if (!stored) throw new Error(`Extensie "${id}" niet gevonden in opslag`);

    const plugin = executeExtensionCode(stored.mainCode);
    const api = createExtensionApi(id, stored.manifest.permissions);

    await plugin.onLoad(api);

    activePlugins.set(id, { plugin, api });
    store.setExtensionStatus(id, 'enabled');

    stored.enabled = true;
    await saveExtensionToDb(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.setExtensionStatus(id, 'error', message);
    console.error(`[Extensies] Activeren van "${id}" mislukt:`, err);
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
