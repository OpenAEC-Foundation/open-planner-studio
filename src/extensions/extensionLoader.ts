/**
 * Extensie-loader — bewaart, laadt, activeert en deactiveert extensies.
 * Opslag: IndexedDB-database 'ops-extensions' (werkt in browser én Tauri-webview).
 * Uitvoering: new Function(...) met een minimale CommonJS-omgeving; require()
 * geeft alleen de host-SDK ('open-planner-studio') terug.
 */
import type {
  ExtensionManifest,
  ExtensionPlugin,
  QuarantinedExtension,
  ReadyExtension,
  ReadyStoredExtension,
} from './types';
import { createExtensionApi, type ExtensionHostBinding } from './extensionApi';
import { getExtensionSdk, installExtensionSdk } from './sdk';
import { sanitizeManifestPermissions } from './permissions';
import { checkApiCompatibility, EXTENSION_API_VERSION } from './apiVersion';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { parseStoredExtension } from './validation';

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Productie-compositie: documentdata en appchrome delen in de gemounte app dezelfde singleton. */
const appExtensionHost: ExtensionHostBinding = {
  app: appStoreContext,
  showNotification(extensionId, message, type) {
    const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
    appLog.emit(level, `ext:${extensionId}`, message);
  },
};

/** Vergelijk twee puntgescheiden versies numeriek. <0 als a ouder is dan b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

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
  /**
   * Binaire, mee-verpakte assets (de niet-`main`/`manifest`-bestanden uit de installatie-ZIP),
   * op naam → rauwe bytes. Optioneel en backward-compat: oude records zonder `assets` (en los
   * `.js`-geïnstalleerde extensies) blijven geldig; de extensie krijgt dan een lege asset-set.
   */
  assets?: Record<string, Uint8Array>;
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

export async function removeExtensionFromDb(key: IDBValidKey): Promise<void> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readwrite');
    tx.objectStore('extensions').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-delete is mislukt'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-delete is afgebroken'));
  });
}

export interface RawStoredExtension {
  storageKey: IDBValidKey;
  value: unknown;
}

/** Injecteerbare opslagnaad: productcode gebruikt IndexedDB, tests leveren een lokale implementatie. */
export interface ExtensionStorage {
  get(key: IDBValidKey): Promise<RawStoredExtension | undefined>;
  getAll(): Promise<RawStoredExtension[]>;
  save(extension: StoredExtension): Promise<void>;
  remove(key: IDBValidKey): Promise<void>;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** Canonieke, typebewuste representatie van iedere geldige IndexedDB-sleutel. */
export function encodeIdbKey(key: IDBValidKey): string {
  if (typeof key === 'string') {
    const bytes = new TextEncoder().encode(key);
    return `s${bytes.byteLength}:${bytesToHex(bytes)}`;
  }
  if (typeof key === 'number') {
    if (!Number.isFinite(key)) throw new TypeError('IndexedDB-getalsleutel moet eindig zijn');
    return `n${Object.is(key, -0) ? '0' : String(key)}`;
  }
  if (key instanceof Date) {
    if (!Number.isFinite(key.getTime())) throw new TypeError('IndexedDB-datumsleutel moet geldig zijn');
    return `d${key.toISOString()}`;
  }
  if (key instanceof ArrayBuffer) {
    const bytes = new Uint8Array(key);
    return `b${bytes.byteLength}:${bytesToHex(bytes)}`;
  }
  if (ArrayBuffer.isView(key)) {
    const bytes = new Uint8Array(key.buffer, key.byteOffset, key.byteLength);
    return `b${bytes.byteLength}:${bytesToHex(bytes)}`;
  }
  if (Array.isArray(key)) {
    const parts = key.map(encodeIdbKey);
    const encoded = parts.map((part) => {
      const length = new TextEncoder().encode(part).byteLength;
      return `${length}:${part}`;
    }).join('');
    return `a${parts.length}:${encoded}`;
  }
  throw new TypeError('Onbekend IndexedDB-sleuteltype');
}

/** Objectproperty-veilige, stabiele identiteit; verwijderen gebruikt altijd de originele sleutel. */
export function quarantineIdForStorageKey(key: IDBValidKey): string {
  return `q:${bytesToHex(new TextEncoder().encode(encodeIdbKey(key)))}`;
}

export async function getAllExtensionRecordsFromDb(): Promise<RawStoredExtension[]> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const records: RawStoredExtension[] = [];
    const req = tx.objectStore('extensions').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      records.push({ storageKey: cursor.primaryKey, value: cursor.value });
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB-cursor is mislukt'));
    tx.oncomplete = () => resolve(records);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-read is mislukt'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-read is afgebroken'));
  });
}

export async function getExtensionRecordFromDb(
  key: IDBValidKey,
): Promise<RawStoredExtension | undefined> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const req = tx.objectStore('extensions').openCursor(IDBKeyRange.only(key));
    req.onsuccess = () => {
      const cursor = req.result;
      resolve(cursor
        ? { storageKey: cursor.primaryKey, value: cursor.value }
        : undefined);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB-recordlezing is mislukt'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-recordlezing is afgebroken'));
  });
}

export const indexedDbExtensionStorage: ExtensionStorage = {
  get: getExtensionRecordFromDb,
  getAll: getAllExtensionRecordsFromDb,
  save: saveExtensionToDb,
  remove: removeExtensionFromDb,
};

function storableExtension(
  extension: ReadyStoredExtension,
  enabled: boolean,
): StoredExtension {
  return {
    id: extension.id,
    manifest: extension.manifest,
    mainCode: extension.mainCode,
    enabled,
    ...(extension.assets !== undefined ? { assets: extension.assets } : {}),
  };
}

function quarantineRecord(id: string, raw: RawStoredExtension, reason: string): void {
  const store = useAppStore.getState();
  store.unregisterExtension(id);
  store.registerQuarantinedExtension({
    kind: 'quarantined',
    quarantineId: quarantineIdForStorageKey(raw.storageKey),
    storageKey: raw.storageKey,
    displayName: '',
    reason,
    status: 'quarantined',
  });
}

function reportStorageWriteFailure(id: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  useAppStore.getState().setExtensionPersistenceError(id, message);
  appLog.emit('error', 'Extensies', `Status van "${id}" kon niet worden opgeslagen: ${message}`);
}

/** Voer extensie-code uit in een minimale CommonJS-sandbox.
 *  Let op: dit is GEEN echte isolatie — extensie-code heeft gewoon toegang tot
 *  window, document, fetch e.d.; permissies zijn een conventie, geen harde grens. */
export function executeExtensionCode(mainCode: string): ExtensionPlugin {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports as Record<string, unknown> };

  const requireFn = (moduleName: string) => {
    if (moduleName === 'open-planner-studio') {
      // De SDK is altijd beschikbaar (lazy gebouwd); installExtensionSdk() hangt 'm
      // ook op window voor devtools-inspectie.
      return getExtensionSdk();
    }
    throw new Error(`Module "${moduleName}" is niet beschikbaar in de extensie-sandbox`);
  };

  try {
    // AFSCHERMING (K-item 38). De namen hieronder worden als functieparameter meegegeven en dus
    // BINNEN de extensie-scope geschaduwd op `undefined`. Ze hebben geen legitiem gebruik in
    // extensie-code — `__TAURI_INTERNALS__` is de rauwe Tauri-invoke-brug (dus bestandssysteem,
    // shell, updater, buiten élke plugin-scope om), `__OPS__` is de dev-bridge met de kale store,
    // en `__TAURI__` is de oude plugin-namespace. Alles wat een extensie legitiem nodig heeft loopt
    // via `require('open-planner-studio')` en de `api` die `onLoad` krijgt.
    //
    // DIT IS GEEN SANDBOX, en het is belangrijk dat niemand dat denkt. De code draait in dezelfde
    // realm, dus `globalThis.__TAURI_INTERNALS__`, `window[...]` of `Function('return this')()`
    // komen er nog steeds bij. Wat dit wél doet: het weghalen van de KANSLOZE route (een
    // kale identifier), zodat wie er alsnog bij komt dat aantoonbaar met opzet deed. De echte
    // grens is een Web Worker of een iframe; zie docs/extensions.md en het rapport-item.
    const AFGESCHERMD = ['__TAURI_INTERNALS__', '__TAURI__', '__OPS__'] as const;
    const fn = new Function('module', 'exports', 'require', ...AFGESCHERMD, mainCode);
    fn(moduleObj, moduleExports, requireFn, ...AFGESCHERMD.map(() => undefined));
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
export async function enableExtension(
  id: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
  const store = useAppStore.getState();

  if (activePlugins.has(id)) return;
  if (enablingExtensions.has(id)) return;
  enablingExtensions.add(id);

  let api: ReturnType<typeof createExtensionApi> | undefined;

  try {
    const raw = await storage.get(id);
    if (!raw) throw new Error(`Extensie "${id}" niet gevonden in opslag`);
    const parsed = parseStoredExtension(raw.value, raw.storageKey);
    if (!parsed.ok) {
      quarantineRecord(id, raw, parsed.error);
      return;
    }
    const stored = parsed.value;

    // Pas na een geldige verse parse wordt de readykaart tijdelijk loading.
    store.setExtensionStatus(id, 'loading');

    // Poort 1 — APP-versie (features): weiger als de app ouder is dan minAppVersion.
    const minVersion = stored.manifest.minAppVersion;
    if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
      throw new Error(
        `Vereist Open Planner Studio ≥ ${minVersion} (huidige versie: ${APP_VERSION})`,
      );
    }

    // Poort 2 — CONTRACT-versie (K-item 37). Los van poort 1: CalVer draagt geen
    // breaking-change-signaal, dus zonder deze poort laadt een extensie voor een ander
    // API-contract gewoon en klapt hij pas halverwege `onLoad` op een verdwenen methode.
    // Een manifest zonder `apiVersion` (alles van vóór dit item) blijft laden — weigeren zou elke
    // geïnstalleerde extensie in één update slopen — maar wordt wél zichtbaar gelogd.
    const compat = checkApiCompatibility(stored.manifest.apiVersion);
    if (!compat.ok) {
      throw new Error(`${compat.reason} (extensie-API van deze app: ${EXTENSION_API_VERSION})`);
    }
    if (compat.legacy) {
      appLog.emit('warn', 'Extensies',
        `"${id}" declareert geen apiVersion; aangenomen dat hij past bij extensie-API ${EXTENSION_API_VERSION}.`);
    }

    // Zorg dat de host-SDK op window staat vóór extensie-code draait.
    installExtensionSdk();

    const plugin = executeExtensionCode(stored.mainCode);
    // Filter permissies tot wat deze app-versie kent (onbekende → weglaten + warn). Centrale
    // chokepoint: elke activatie (zip/js/catalogus/devBridge/DB-load) loopt hierlangs, dus dit
    // dekt óók manifesten die al in IndexedDB staan met een permissie die deze versie niet kent.
    const permissions = sanitizeManifestPermissions(stored.manifest.permissions, id);
    api = createExtensionApi(
      id,
      permissions,
      stored.assets,
      appStoreContext,
      appExtensionHost,
    );

    await plugin.onLoad(api);

    activePlugins.set(id, { plugin, api });
    store.setExtensionStatus(id, 'enabled');

    stored.enabled = true;
    try {
      await storage.save(storableExtension(stored, true));
    } catch (persistErr) {
      reportStorageWriteFailure(id, persistErr);
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
export async function disableExtension(
  id: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
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

  const store = useAppStore.getState();
  store.setExtensionStatus(id, 'disabled');

  try {
    const raw = await storage.get(id);
    if (!raw) {
      reportStorageWriteFailure(id, new Error(`Extensie "${id}" niet gevonden in opslag`));
      return;
    }
    const parsed = parseStoredExtension(raw.value, raw.storageKey);
    if (!parsed.ok) {
      quarantineRecord(id, raw, parsed.error);
      return;
    }
    try {
      await storage.save(storableExtension(parsed.value, false));
    } catch (persistErr) {
      reportStorageWriteFailure(id, persistErr);
    }
  } catch (readErr) {
    reportStorageWriteFailure(id, readErr);
  }
}

/** Laad alle geïnstalleerde extensies bij het opstarten (auto-enable wat aan stond). */
export async function loadAllExtensions(
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
  installExtensionSdk();

  let allExtensions: RawStoredExtension[];
  try {
    allExtensions = await storage.getAll();
  } catch (err) {
    console.error('[Extensies] Lezen van extensieopslag mislukt:', err);
    return;
  }

  for (const raw of allExtensions) {
    try {
      const parsed = parseStoredExtension(raw.value, raw.storageKey);
      if (!parsed.ok) {
        const quarantined: QuarantinedExtension = {
          kind: 'quarantined',
          quarantineId: quarantineIdForStorageKey(raw.storageKey),
          storageKey: raw.storageKey,
          displayName: '',
          reason: parsed.error,
          status: 'quarantined',
        };
        useAppStore.getState().registerQuarantinedExtension(quarantined);
        continue;
      }
      const ext = parsed.value;
      // Idempotent: een al-geregistreerde extensie niet overschrijven (kan al actief zijn)
      if (useAppStore.getState().installedExtensions[ext.id]) continue;

      const installed: ReadyExtension = {
        kind: 'ready',
        id: ext.id,
        manifest: ext.manifest,
        status: 'disabled',
      };
      useAppStore.getState().registerReadyExtension(installed);

      if (ext.enabled) {
        await enableExtension(ext.id, storage);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const quarantined: QuarantinedExtension = {
        kind: 'quarantined',
        quarantineId: quarantineIdForStorageKey(raw.storageKey),
        storageKey: raw.storageKey,
        displayName: '',
        reason,
        status: 'quarantined',
      };
      useAppStore.getState().registerQuarantinedExtension(quarantined);
    }
  }
}

export function getActivePlugins() {
  return activePlugins;
}
