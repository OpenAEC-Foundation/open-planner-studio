/**
 * Installeren, verwijderen en catalogusbeheer van extensies.
 * ZIP-parsing gebeurt met een minimale eigen parser op basis van
 * DecompressionStream — geen JSZip-dependency (zelfde aanpak als Open Calc Studio).
 */
import type { ExtensionManifest, InstalledExtension, CatalogEntry, ExtensionCatalog } from './types';
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
    // no-store: omzeil de browser/CDN-HTTP-cache zodat een net-bijgewerkte catalogus
    // niet stale wordt geserveerd (de store-cache hierboven beperkt de frequentie al).
    const res = await fetch(CATALOG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog: ExtensionCatalog = await res.json();
    store.setCatalog(catalog.extensions || [], now);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalogus ophalen mislukt';
    useAppStore.getState().setCatalogError(message);
  } finally {
    useAppStore.getState().setCatalogLoading(false);
  }
}

// ── Installeren vanuit de catalogus ──

// Let op: dit downloadt en activeert externe code na een gebruikersklik.
// Er is geen echte sandbox (zie executeExtensionCode in extensionLoader.ts);
// de catalogus is een door de Foundation beheerde lijst.
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
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => { input.remove(); resolve(false); });
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); resolve(false); return; }
      const result = await installFromZipBlob(file);
      input.remove();
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
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => { input.remove(); resolve(false); });
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); resolve(false); return; }

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

        input.remove();
        resolve(true);
      } catch (err) {
        console.error('[Extensies] Installeren vanuit JS mislukt:', err);
        input.remove();
        resolve(false);
      }
    };
    input.click();
  });
}

function extractManifestFromCode(code: string, fileName: string): ExtensionManifest {
  // Zoek een @manifest-JSON-blok in het commentaar
  // Beperking: de non-greedy match stopt bij de eerste '}', dus het manifest
  // moet een plat JSON-object zijn (geen geneste objecten; arrays van strings zijn OK).
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

const SIG_LOCAL = 0x04034b50;       // local file header
const SIG_CENTRAL = 0x02014b50;     // central directory file header
const SIG_EOCD = 0x06054b50;        // end of central directory
const SIG_DATA_DESC = 0x08074b50;   // optional data descriptor

/** Inflate ruwe deflate-data via de browser-native DecompressionStream. */
async function inflateRaw(compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  void writer.write(compressed);
  void writer.close();

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

async function decompressEntry(method: number, compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (method === 0) return compressed;       // stored
  if (method === 8) return inflateRaw(compressed); // deflate
  throw new Error(`Niet-ondersteunde compressiemethode: ${method}`);
}

/** Strip de gemeenschappelijke topmap-prefix (bv. "my-ext/manifest.json" → "manifest.json"). */
function stripTopDir(name: string): string {
  return name.replace(/^[^/]+\//, '');
}

/**
 * Parse ZIP-entries. Primair via de CENTRAL DIRECTORY (betrouwbare maten, lost het
 * data-descriptor-overshoot-probleem op); valt terug op een local-header-scan als de
 * EOCD ontbreekt of de central-directory-lezing faalt.
 */
async function parseZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  try {
    const viaCentral = await parseViaCentralDirectory(buffer);
    if (viaCentral) return viaCentral;
  } catch (err) {
    console.warn('[Extensies] Central-directory-lezing faalde, val terug op local-scan:', err);
  }
  return parseViaLocalHeaders(buffer);
}

/** Zoek de End Of Central Directory-record (scan achterwaarts; comment is meestal leeg). */
function findEocdOffset(view: DataView, byteLength: number): number {
  const minOffset = Math.max(0, byteLength - 0xffff - 22);
  for (let p = byteLength - 22; p >= minOffset; p--) {
    if (view.getUint32(p, true) === SIG_EOCD) return p;
  }
  return -1;
}

async function parseViaCentralDirectory(buffer: ArrayBuffer): Promise<ZipEntry[] | null> {
  const view = new DataView(buffer);
  const eocd = findEocdOffset(view, buffer.byteLength);
  if (eocd < 0) return null;

  const total = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true); // offset van central directory

  const entries: ZipEntry[] = [];
  for (let i = 0; i < total; i++) {
    if (cd + 4 > buffer.byteLength || view.getUint32(cd, true) !== SIG_CENTRAL) break;

    const method = view.getUint16(cd + 10, true);
    const compSize = view.getUint32(cd + 20, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOffset = view.getUint32(cd + 42, true);

    const name = new TextDecoder().decode(new Uint8Array(buffer, cd + 46, nameLen));
    cd += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // map

    // Lees het local file header om de exacte datastart te vinden (extra-veld kan afwijken).
    if (view.getUint32(localOffset, true) !== SIG_LOCAL) continue;
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;

    const compressed = new Uint8Array(buffer, dataStart, compSize);
    const data = await decompressEntry(method, compressed);

    const cleanName = stripTopDir(name);
    if (cleanName) entries.push({ name: cleanName, data });
  }

  return entries;
}

/** Fallback: lineaire scan over local file headers (voor ZIP's zonder bruikbare EOCD). */
async function parseViaLocalHeaders(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 4 <= buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== SIG_LOCAL) break;

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 30, nameLen));
    const dataOffset = offset + 30 + nameLen + extraLen;

    // Bit 3 (0x08): grootte staat in een data descriptor ná de data. dataDescLen = het
    // aantal bytes vanaf de data tot (en met) de descriptor; compSize = data ervóór.
    let dataDescLen = 0;
    if ((flags & 0x08) && compSize === 0) {
      const { dataLen, descLen } = scanDataDescriptor(view, buffer.byteLength, dataOffset);
      compSize = dataLen;
      dataDescLen = descLen;
    }

    if (!name.endsWith('/')) {
      const compressed = new Uint8Array(buffer, dataOffset, compSize);
      const data = await decompressEntry(method, compressed);
      const cleanName = stripTopDir(name);
      if (cleanName) entries.push({ name: cleanName, data });
    }

    offset = dataOffset + compSize + dataDescLen;
  }

  return entries;
}

/** Voor een bit-3-entry: vind het einde van de data en de lengte van de descriptor.
 *  Lost de eerdere 12-byte-overshoot op door de descriptor mee te bepalen i.p.v.
 *  altijd 12 bytes op te tellen. */
function scanDataDescriptor(
  view: DataView,
  byteLength: number,
  dataOffset: number,
): { dataLen: number; descLen: number } {
  for (let p = dataOffset; p + 4 <= byteLength; p++) {
    const sig = view.getUint32(p, true);
    if (sig === SIG_DATA_DESC) {
      // Descriptor mét signatuur: sig(4) + crc(4) + comp(4) + uncomp(4) = 16 bytes.
      return { dataLen: p - dataOffset, descLen: 16 };
    }
    if (sig === SIG_LOCAL || sig === SIG_CENTRAL) {
      // Volgende header bereikt: de descriptor zónder signatuur (12 bytes) zit
      // vóór deze header, dus die hoort nog bij de huidige entry.
      const dataLen = Math.max(0, p - dataOffset - 12);
      return { dataLen, descLen: 12 };
    }
  }
  return { dataLen: byteLength - dataOffset, descLen: 0 };
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
