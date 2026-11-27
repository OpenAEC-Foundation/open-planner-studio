import type { ExtensionManifest, ReadyExtension, CatalogEntry } from './types';
import { manifestFromJavaScript, parseCatalog, parseExtensionManifest } from './validation';
import {
  saveExtensionToDb,
  enableExtension,
  disableExtension,
  getActivePlugins,
  cancelPendingEnable,
  indexedDbExtensionStorage,
  type ExtensionStorage,
} from './extensionLoader';
import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { askExtensionConsent, type ConsentSource, type ConsentVerification, type ExtensionConsentRequest } from './consent';
import { isTauri } from '@/utils/platform';
import { EXTENSION_ZIP_LIMITS, parseZipEntries, type ZipEntry } from '@/services/zip/zipReader';
import { FetchTimeoutError, fetchWithIdleTimeout, fetchWithTimeout, readBodyBytes } from '@/services/fetchWithTimeout';
import i18next from 'i18next';

export { parseZipEntries };
export type { ZipEntry };

const CATALOG_URL =
  'https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio-extensions/main/catalog.json';
const CATALOG_CACHE_MS = 30 * 60 * 1000;

export const CATALOG_FETCH_TIMEOUT_MS = 20_000;
export const EXTENSION_DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;

function networkErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FetchTimeoutError) {
    return i18next.t('extensions.networkTimeout', { ns: 'menu', seconds: Math.ceil(err.timeoutMs / 1000) });
  }
  return err instanceof Error ? err.message : fallback;
}

export async function fetchCatalog(): Promise<void> {
  const store = useAppStore.getState();
  const now = Date.now();

  if (store.catalogLastFetched && now - store.catalogLastFetched < CATALOG_CACHE_MS) return;

  store.setCatalogLoading(true);
  store.setCatalogError(null);

  try {
    const json = await fetchWithTimeout(CATALOG_URL, { cache: 'no-store' }, CATALOG_FETCH_TIMEOUT_MS, async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    });
    const parsed = parseCatalog(json);
    if (!parsed.ok) throw new Error(parsed.error);
    store.setCatalog(parsed.value.catalog.extensions, parsed.value.issues, now);
    if (parsed.value.issues.length > 0) {
      const details = parsed.value.issues.slice(0, 5)
        .map((issue) => `#${issue.index}: ${issue.error}`)
        .join('; ');
      const remaining = parsed.value.issues.length - 5;
      appLog.emit(
        'warn',
        'Extensies',
        `${parsed.value.issues.length} ongeldige catalogusentry(s) overgeslagen: ${details}`
          + (remaining > 0 ? `; en ${remaining} meer` : ''),
      );
    }
  } catch (err) {
    useAppStore.getState().setCatalogError(networkErrorMessage(err, 'Catalogus ophalen mislukt'));
  } finally {
    useAppStore.getState().setCatalogLoading(false);
  }
}

export type InstallOutcome = 'installed' | 'declined' | 'failed';

export interface InstallOptions {
  source?: ConsentSource;
  verification?: ConsentVerification;
  assumeConsent?: boolean;
}

export function buildConsentRequest(
  manifest: ExtensionManifest,
  id: string,
  opts: InstallOptions,
  desktop: boolean = isTauri(),
): ExtensionConsentRequest {
  return {
    id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    declared: manifest.permissions ?? [],
    repository: manifest.repository,
    source: opts.source ?? 'zip',
    verification: opts.verification ?? 'local',
    isDesktop: desktop,
  };
}

async function gateConsent(
  manifest: ExtensionManifest,
  id: string,
  opts: InstallOptions,
): Promise<boolean> {
  if (opts.assumeConsent) return true;
  const granted = await askExtensionConsent(buildConsentRequest(manifest, id, opts));
  if (!granted) {
    appLog.emit('info', 'Extensies', `Installatie van "${id}" geannuleerd door de gebruiker.`);
  }
  return granted;
}

export async function installFromCatalog(entry: CatalogEntry): Promise<InstallOutcome> {
  try {
    const bytes = await fetchWithIdleTimeout(entry.downloadUrl, {}, EXTENSION_DOWNLOAD_IDLE_TIMEOUT_MS, async (res, progress) => {
      if (!res.ok) throw new Error(`Download mislukt: HTTP ${res.status}`);
      return readBodyBytes(res, progress);
    });

    const oordeel = await verifyCatalogDownload(entry, bytes);
    if (!oordeel.ok) throw new Error(oordeel.reason);
    if (oordeel.unverified) {
      appLog.emit('warn', 'Extensies',
        `Catalogusentry "${entry.id}" heeft geen sha256; de download is niet geverifieerd.`);
    }

    return await installFromZipBlob(
      new Blob([bytes as unknown as BlobPart]),
      { id: entry.id, version: entry.version },
      {
        source: 'catalog',
        verification: oordeel.unverified ? 'unverified' : 'checksum',
      },
    );
  } catch (err) {
    console.error('[Extensies] Installeren vanuit catalogus mislukt:', err);
    appLog.emit('error', 'Extensies', networkErrorMessage(err, String(err)));
    return 'failed';
  }
}

export interface DownloadVerdict {
  ok: boolean;
  reason?: string;
  unverified?: boolean;
}

export async function verifyCatalogDownload(
  entry: Pick<CatalogEntry, 'id' | 'sha256'>,
  bytes: Uint8Array,
): Promise<DownloadVerdict> {
  const verwacht = entry.sha256?.trim().toLowerCase();
  if (!verwacht) return { ok: true, unverified: true };
  if (!/^[0-9a-f]{64}$/.test(verwacht)) {
    return { ok: false, reason: `Catalogusentry "${entry.id}" heeft een ongeldige sha256 ("${entry.sha256}") — verwacht 64 hex-tekens.` };
  }
  const werkelijk = await sha256Hex(bytes);
  if (werkelijk !== verwacht) {
    return {
      ok: false,
      reason: `Checksum komt niet overeen voor "${entry.id}" — verwacht ${verwacht}, kreeg ${werkelijk}. De download is niet geïnstalleerd.`,
    };
  }
  return { ok: true };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function installFromFile(): Promise<InstallOutcome> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => { input.remove(); resolve('declined'); });
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); resolve('declined'); return; }
      const result = await installFromZipBlob(file, undefined, { source: 'zip', verification: 'local' });
      input.remove();
      resolve(result);
    };
    input.click();
  });
}

export async function installFromJsFile(): Promise<InstallOutcome> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => { input.remove(); resolve('declined'); });
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); resolve('declined'); return; }

      try {
        const mainCode = await file.text();
        const parsed = manifestFromJavaScript(mainCode, file.name);
        if (!parsed.ok) throw new Error(parsed.error);
        const manifest = parsed.value;

        if (!await gateConsent(manifest, manifest.id, { source: 'js', verification: 'local' })) {
          input.remove();
          resolve('declined');
          return;
        }

        await saveExtensionToDb({
          id: manifest.id,
          manifest,
          mainCode,
          enabled: true,
        });

        const installed: ReadyExtension = {
          kind: 'ready',
          id: manifest.id,
          manifest,
          status: 'disabled',
        };
        useAppStore.getState().registerReadyExtension(installed);
        await enableExtension(manifest.id);

        input.remove();
        resolve('installed');
      } catch (err) {
        console.error('[Extensies] Installeren vanuit JS mislukt:', err);
        input.remove();
        resolve('failed');
      }
    };
    input.click();
  });
}

export interface ExpectedExtensionIdentity {
  id: string;
  version: string;
}

export async function installFromZipBlob(
  blob: Blob,
  expected?: ExpectedExtensionIdentity,
  opts: InstallOptions = {},
): Promise<InstallOutcome> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const files = await parseZipEntries(arrayBuffer, EXTENSION_ZIP_LIMITS);

    const manifestEntries = files.filter((file) => file.name === 'manifest.json');
    if (manifestEntries.length !== 1) {
      throw new Error(
        manifestEntries.length === 0
          ? 'Geen manifest.json gevonden in ZIP'
          : 'Meer dan één manifest.json gevonden in ZIP',
      );
    }
    const manifestEntry = manifestEntries[0];

    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestEntry.data));
    } catch (error) {
      throw new Error(`manifest.json bevat ongeldige JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const parsedManifest = parseExtensionManifest(rawManifest, 'fresh');
    if (!parsedManifest.ok) throw new Error(parsedManifest.error);
    const manifest = parsedManifest.value;

    const mainEntry = files.find((file) => file.name === manifest.main);
    if (!mainEntry) throw new Error(`Hoofdbestand "${manifest.main}" niet gevonden in ZIP`);

    const mainCode = new TextDecoder('utf-8', { fatal: true }).decode(mainEntry.data);

    if (expected && (manifest.id !== expected.id || manifest.version !== expected.version)) {
      throw new Error(
        `Catalogusidentiteit ${expected.id}@${expected.version} komt niet overeen met `
          + `manifest ${manifest.id}@${manifest.version}`,
      );
    }

    const assets: Record<string, Uint8Array> = Object.create(null);
    for (const f of files) {
      if (f === manifestEntry || f === mainEntry) continue;
      assets[f.name] = f.data;
    }
    const hasAssets = Object.keys(assets).length > 0;

    if (!await gateConsent(manifest, manifest.id, opts)) return 'declined';

    if (getActivePlugins().has(manifest.id)) {
      await disableExtension(manifest.id);
    }

    await saveExtensionToDb({
      id: manifest.id,
      manifest,
      mainCode,
      enabled: true,
      ...(hasAssets ? { assets } : {}),
    });

    const installed: ReadyExtension = {
      kind: 'ready',
      id: manifest.id,
      manifest,
      status: 'disabled',
    };
    useAppStore.getState().registerReadyExtension(installed);
    await enableExtension(manifest.id);

    return 'installed';
  } catch (err) {
    console.error('[Extensies] ZIP-installatie mislukt:', err);
    return 'failed';
  }
}

export async function removeExtension(
  id: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
  if (getActivePlugins().has(id)) {
    await disableExtension(id, storage);
  }
  cancelPendingEnable(id);

  await storage.remove(id);
  useAppStore.getState().unregisterExtension(id);

  const prefix = `ops-ext:${id}:`;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch { }
}

export async function removeQuarantinedExtension(
  quarantineId: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
  const store = useAppStore.getState();
  const quarantined = store.quarantinedExtensions[quarantineId];
  if (!quarantined) return;

  await storage.remove(quarantined.storageKey);
  useAppStore.getState().removeQuarantinedExtension(quarantineId);
}
