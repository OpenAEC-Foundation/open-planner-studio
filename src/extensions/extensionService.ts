/**
 * Installeren, verwijderen en catalogusbeheer van extensies.
 * ZIP-parsing gebeurt met een minimale eigen parser op basis van
 * DecompressionStream — geen JSZip-dependency (zelfde aanpak als Open Calc Studio).
 */
import type { ExtensionManifest, InstalledExtension, CatalogEntry } from './types';
import {
  saveExtensionToDb,
  removeExtensionFromDb,
  enableExtension,
  disableExtension,
  getActivePlugins,
} from './extensionLoader';
import { useAppStore } from '@/state/appStore';

// ── Catalogus ──

const CATALOG_URL =
  'https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio-extensions/main/catalog.json';
const CATALOG_CACHE_MS = 30 * 60 * 1000; // 30 min

export async function fetchCatalog(): Promise<void> {
  const store = useAppStore.getState();
  const now = Date.now();

  if (store.catalogLastFetched && now - store.catalogLastFetched < CATALOG_CACHE_MS) return;

  store.setCatalogLoading(true);
  store.setCatalogError(null);

  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog = await res.json();
    store.setCatalog(catalog.extensions || [], now);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalogus ophalen mislukt';
    useAppStore.getState().setCatalogError(message);
  } finally {
    useAppStore.getState().setCatalogLoading(false);
  }
}

// ── Installeren vanuit de catalogus ──

export async function installFromCatalog(entry: CatalogEntry): Promise<boolean> {
  try {
    const res = await fetch(entry.downloadUrl);
    if (!res.ok) throw new Error(`Download mislukt: HTTP ${res.status}`);

    const blob = await res.blob();
    return await installFromZipBlob(blob, entry.id);
  } catch (err) {
    console.error('[Extensies] Installeren vanuit catalogus mislukt:', err);
    return false;
  }
}

// ── Installeren vanuit een lokaal ZIP-bestand ──

export async function installFromFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(false); return; }
      const result = await installFromZipBlob(file);
      resolve(result);
    };
    input.click();
  });
}

// ── Installeren vanuit een los .js-bestand (simpele extensies) ──

export async function installFromJsFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(false); return; }

      try {
        const mainCode = await file.text();
        const manifest = extractManifestFromCode(mainCode, file.name);

        await saveExtensionToDb({
          id: manifest.id,
          manifest,
          mainCode,
          enabled: true,
        });

        const installed: InstalledExtension = {
          id: manifest.id,
          manifest,
          status: 'disabled',
        };
        useAppStore.getState().registerExtension(installed);
        await enableExtension(manifest.id);

        resolve(true);
      } catch (err) {
        console.error('[Extensies] Installeren vanuit JS mislukt:', err);
        resolve(false);
      }
    };
    input.click();
  });
}

function extractManifestFromCode(code: string, fileName: string): ExtensionManifest {
  // Zoek een @manifest-JSON-blok in het commentaar
  const match = code.match(/@manifest\s*(\{[\s\S]*?\})\s*\*/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch { /* val terug op gegenereerd manifest */ }
  }

  const id = fileName.replace(/\.js$/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  return {
    id,
    name: fileName.replace(/\.js$/, ''),
    version: '1.0.0',
    minAppVersion: '0.0.0',
    author: 'Onbekend',
    description: `Extensie geladen uit ${fileName}`,
    category: 'Other',
    main: 'main.js',
    permissions: ['commands', 'events'],
  };
}

// ── ZIP-afhandeling ──

async function installFromZipBlob(blob: Blob, overrideId?: string): Promise<boolean> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const files = await parseZipEntries(arrayBuffer);

    const manifestEntry = files.find((f) => f.name.endsWith('manifest.json'));
    if (!manifestEntry) throw new Error('Geen manifest.json gevonden in ZIP');

    const manifest: ExtensionManifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));

    const mainPath = manifest.main || 'main.js';
    const mainEntry = files.find(
      (f) => f.name.endsWith(mainPath) || f.name.endsWith('/' + mainPath)
    );
    if (!mainEntry) throw new Error(`Hoofdbestand "${mainPath}" niet gevonden in ZIP`);

    const mainCode = new TextDecoder().decode(mainEntry.data);
    const id = overrideId || manifest.id;

    // Al geïnstalleerd? Eerst deactiveren.
    if (getActivePlugins().has(id)) {
      await disableExtension(id);
    }

    await saveExtensionToDb({
      id,
      manifest: { ...manifest, id },
      mainCode,
      enabled: true,
    });

    const installed: InstalledExtension = {
      id,
      manifest: { ...manifest, id },
      status: 'disabled',
    };
    useAppStore.getState().registerExtension(installed);
    await enableExtension(id);

    return true;
  } catch (err) {
    console.error('[Extensies] ZIP-installatie mislukt:', err);
    return false;
  }
}

// ── Minimale ZIP-parser (stored + deflate) ──

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

async function parseZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.byteLength - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // local file header signature

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const dataOffset = offset + 30 + nameLen + extraLen;

    // Bit 3 (0x08): grootte/CRC staan in een data descriptor ná de data, niet in
    // de local header (compSize is dan 0). Zoek het volgende signatuur om het einde
    // van de gecomprimeerde data te bepalen.
    if (flags & 0x08 && compSize === 0) {
      compSize = findDataDescriptorEnd(view, buffer.byteLength, dataOffset);
    }

    const compressedData = new Uint8Array(buffer, dataOffset, compSize);

    // Mappen overslaan
    if (!name.endsWith('/')) {
      let data: Uint8Array;
      if (method === 0) {
        // ongecomprimeerd
        data = compressedData;
      } else if (method === 8) {
        // deflate — via DecompressionStream
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        void writer.write(compressedData);
        void writer.close();

        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }
        data = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          data.set(chunk, pos);
          pos += chunk.length;
        }
      } else {
        throw new Error(`Niet-ondersteunde compressiemethode: ${method}`);
      }

      // Gemeenschappelijke mapprefix strippen
      const cleanName = name.replace(/^[^/]+\//, '');
      if (cleanName) {
        entries.push({ name: cleanName, data });
      }
    }

    // Bij een data descriptor (bit 3) volgt na de data een optioneel signatuur
    // (0x08074b50) + CRC32 (4) + compSize (4) + uncompSize (4). Sla die over.
    let next = dataOffset + compSize;
    if (flags & 0x08) {
      if (next + 4 <= buffer.byteLength && view.getUint32(next, true) === 0x08074b50) {
        next += 4;
      }
      next += 12;
    }
    offset = next;
  }

  return entries;
}

/** Zoek bij een data descriptor (bit 3) het einde van de gecomprimeerde data:
 *  het eerstvolgende data-descriptor- of local-file-header-signatuur. Geeft de
 *  lengte van de gecomprimeerde data terug (vanaf dataOffset). */
function findDataDescriptorEnd(view: DataView, byteLength: number, dataOffset: number): number {
  for (let p = dataOffset; p + 4 <= byteLength; p++) {
    const sig = view.getUint32(p, true);
    // Data descriptor met expliciet signatuur, óf de volgende local/central header.
    if (sig === 0x08074b50 || sig === 0x04034b50 || sig === 0x02014b50) {
      return p - dataOffset;
    }
  }
  return byteLength - dataOffset;
}

// ── Extensie verwijderen ──

export async function removeExtension(id: string): Promise<void> {
  if (getActivePlugins().has(id)) {
    await disableExtension(id);
  }

  await removeExtensionFromDb(id);
  useAppStore.getState().unregisterExtension(id);

  // Instellingen van deze extensie opruimen
  const prefix = `ops-ext:${id}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
