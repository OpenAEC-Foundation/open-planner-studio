import type {
  ExtensionManifest,
  ExtensionPlugin,
  QuarantinedExtension,
  ReadyExtension,
  ReadyStoredExtension,
} from './types';
import { createExtensionApi, type ExtensionHostBinding } from './extensionApi';
import { createExtensionNotifier } from './extensionNotifications';
import { getExtensionSdk, installExtensionSdk } from './sdk';
import { sanitizeManifestPermissions } from './permissions';
import { checkApiCompatibility, EXTENSION_API_VERSION } from './apiVersion';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { parseStoredExtension } from './validation';
import { openDb } from '@/utils/idb';
import i18next from 'i18next';
import { buildImportLabels } from '@/i18n/importLabels';

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

const appExtensionHost: ExtensionHostBinding = {
  app: appStoreContext,
  showNotification: createExtensionNotifier(appStoreContext),
  importLabels: () => buildImportLabels((key) => i18next.t(key, { ns: 'common' })),
};

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

const activePlugins = new Map<string, { plugin: ExtensionPlugin; api: ReturnType<typeof createExtensionApi> }>();

const enablingExtensions = new Set<string>();
const cancelledEnables = new Set<string>();
const enablingDone = new Map<string, Promise<void>>();

export function whenExtensionSettled(id: string): Promise<void> {
  return enablingDone.get(id) ?? Promise.resolve();
}

export function cancelPendingEnable(id: string): boolean {
  if (!enablingExtensions.has(id)) return false;
  cancelledEnables.add(id);
  return true;
}

export const EXTENSION_ONLOAD_TIMEOUT_MS = 15_000;

function withOnLoadTimeout(work: Promise<void> | void, id: string, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`onLoad van "${id}" reageerde niet binnen ${Math.ceil(timeoutMs / 1000)} s`));
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(work), timeout]).finally(() => clearTimeout(timer));
}

const openExtensionDb = (): Promise<IDBDatabase> => openDb('ops-extensions', 'extensions');

export interface StoredExtension {
  id: string;
  manifest: ExtensionManifest;
  mainCode: string;
  enabled: boolean;
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

export function executeExtensionCode(mainCode: string): ExtensionPlugin {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports as Record<string, unknown> };

  const requireFn = (moduleName: string) => {
    if (moduleName === 'open-planner-studio') {
      return getExtensionSdk();
    }
    throw new Error(`Module "${moduleName}" is niet beschikbaar in de extensie-sandbox`);
  };

  try {
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

export async function enableExtension(
  id: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
  onLoadTimeoutMs: number = EXTENSION_ONLOAD_TIMEOUT_MS,
): Promise<void> {
  const store = useAppStore.getState();

  if (activePlugins.has(id)) return;
  if (enablingExtensions.has(id)) {
    if (!cancelledEnables.has(id)) return;
    await enablingDone.get(id);
    return enableExtension(id, storage, onLoadTimeoutMs);
  }
  enablingExtensions.add(id);
  cancelledEnables.delete(id);
  let markDone: () => void = () => {};
  enablingDone.set(id, new Promise<void>((resolve) => { markDone = resolve; }));

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

    store.setExtensionStatus(id, 'loading');

    const minVersion = stored.manifest.minAppVersion;
    if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
      throw new Error(
        i18next.t('extensions.minAppVersionRequired', { ns: 'menu', minVersion, appVersion: APP_VERSION }),
      );
    }

    const compat = checkApiCompatibility(stored.manifest.apiVersion);
    if (!compat.ok) {
      throw new Error(`${compat.reason} (extensie-API van deze app: ${EXTENSION_API_VERSION})`);
    }
    if (compat.legacy) {
      appLog.emit('warn', 'Extensies',
        `"${id}" declareert geen apiVersion; aangenomen dat hij past bij extensie-API ${EXTENSION_API_VERSION}.`);
    }

    installExtensionSdk();

    const plugin = executeExtensionCode(stored.mainCode);
    const permissions = sanitizeManifestPermissions(stored.manifest.permissions, id);
    api = createExtensionApi(
      id,
      permissions,
      stored.assets,
      appStoreContext,
      appExtensionHost,
    );

    await withOnLoadTimeout(plugin.onLoad(api), id, onLoadTimeoutMs);

    if (cancelledEnables.has(id)) {
      try { await plugin.onUnload?.(); } catch (unloadErr) {
        console.error(`[Extensies] Fout in onUnload van "${id}" na verwijderen tijdens laden:`, unloadErr);
      }
      api._cleanup();
      return;
    }

    activePlugins.set(id, { plugin, api });
    store.setExtensionStatus(id, 'enabled');

    stored.enabled = true;
    try {
      await storage.save(storableExtension(stored, true));
    } catch (persistErr) {
      reportStorageWriteFailure(id, persistErr);
    }
  } catch (err) {
    if (cancelledEnables.has(id)) {
      try { api?._cleanup(); } catch { }
      return;
    }
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
    cancelledEnables.delete(id);
    enablingDone.delete(id);
    markDone();
  }
}

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
