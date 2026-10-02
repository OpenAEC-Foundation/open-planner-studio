/**
 * Installeren, verwijderen en catalogusbeheer van extensies.
 * ZIP-parsing gebeurt met een minimale eigen parser op basis van DecompressionStream — geen
 * JSZip-dependency (zelfde aanpak als Open Calc Studio). Die parser woont in
 * `src/services/zip/zipReader.ts`; dit bestand is er alleen afnemer van.
 */
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

// De ZIP-lezer woont in `src/services/zip/`, zodat de `.xlsx`-lezer hem kan delen zonder de hele
// extensie-/store-laag mee de bundel in te trekken. Hier blijft hij heruitgevoerd omdat afnemers
// (o.a. `tests/planning/check-ext-integrity.ts`) hem via dit pad importeren.
export { parseZipEntries };
export type { ZipEntry };

// ── Catalogus ──

const CATALOG_URL =
  'https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio-extensions/main/catalog.json';
const CATALOG_CACHE_MS = 30 * 60 * 1000; // 30 min

/**
 * Tijdslimieten voor het netwerk (zie `services/fetchWithTimeout.ts`). Zonder limiet bleef een
 * hangende verbinding eeuwig "bezig" — o.a. de Ja-knop van de tutorialvraag.
 *  - Catalogus: een klein JSON-bestand, dus een TOTALE limiet (verzoek + body).
 *  - Extensie-ZIP: tot 48 MiB (`EXTENSION_ZIP_LIMITS`), dus een STILTE-limiet: de timer begint
 *    opnieuw bij elk binnengekomen stuk. Een trage maar gestage download loopt af, hoe lang hij ook
 *    duurt; alleen een download die zo lang niets binnenkrijgt, breekt af.
 */
export const CATALOG_FETCH_TIMEOUT_MS = 20_000;
export const EXTENSION_DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;

/** Foutmelding voor de gebruiker/het log; een timeout krijgt een vertaalde tekst. */
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
    // no-store: omzeil de browser/CDN-HTTP-cache zodat een net-bijgewerkte catalogus
    // niet stale wordt geserveerd (de store-cache hierboven beperkt de frequentie al).
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

// ── Installeren vanuit de catalogus ──

// Let op: dit downloadt en activeert externe code na een gebruikersklik.
// Er is geen echte sandbox (zie executeExtensionCode in extensionLoader.ts);
// de catalogus is een door de Foundation beheerde lijst.
/**
 * Afloop van een installatiepoging. Een bewuste WEIGERING is nadrukkelijk geen fout: de UI hoort
 * daar geen "installatie mislukt" op te tonen, en met een kale boolean was dat onderscheid er niet.
 */
export type InstallOutcome = 'installed' | 'declined' | 'failed';

export interface InstallOptions {
  /** Waar de bytes vandaan komen — bepaalt wat de toestemmingsvraag over herkomst kan zeggen. */
  source?: ConsentSource;
  /** Verificatiestand van die bytes (zie `verifyCatalogDownload`). */
  verification?: ConsentVerification;
  /**
   * Sla de vertrouwensvraag over. UITSLUITEND voor de dev-bridge en geautomatiseerde zelftests: die
   * testen extensie-GEDRAG en hebben geen mens die een dialoog kan wegklikken. Nooit vanuit een
   * gebruikerspad meegeven — dat zou de enige stap die om vertrouwen vraagt stil overslaan.
   * `check-ext-consent.ts` bewaakt met een bron-assert dat alleen `devBridge.ts` dit zet.
   */
  assumeConsent?: boolean;
}

/**
 * Manifest + installatiecontext → de vraag die de gebruiker te zien krijgt.
 *
 * Apart en puur, zodat toetsbaar is dát de velden overkomen. Een vraag die de auteur of de
 * declaratie kwijtraakt ziet er in de dialoog nog steeds compleet uit — er staat dan gewoon minder,
 * en niemand die de dialoog nooit eerder zag merkt het verschil.
 */
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

/**
 * De vertrouwensvraag, op één plek voor élk installatiepad.
 *
 * Staat bewust VÓÓR elke schrijfactie: bij een weigering mag er niets in IndexedDB staan, niets in
 * de store geregistreerd zijn, en een al geïnstalleerde vorige versie onaangeroerd blijven.
 */
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
  /** Gevuld wanneer `ok` onwaar is — gaat rechtstreeks naar de gebruiker/het log. */
  reason?: string;
  /** True wanneer de entry geen `sha256` draagt: geïnstalleerd, maar ONgeverifieerd. */
  unverified?: boolean;
}

/**
 * Mag deze download geïnstalleerd worden?
 *
 * De catalogus is een extern JSON-bestand en `downloadUrl` wijst naar een release-asset; zonder
 * hash zijn "wat de catalogus beschrijft" en "wat je installeert" alleen door TLS aan elkaar
 * geknoopt, en een vervangen asset is onzichtbaar. Mét hash faalt de installatie bij het kleinste
 * verschil.
 *
 * Bewust een aparte, pure functie: de installatie zelf heeft IndexedDB en `DecompressionStream`
 * nodig en is daarmee niet headless te draaien; deze beslissing wél
 * (`tests/planning/check-ext-integrity.ts`).
 *
 * Een aanwezige maar ONLEESBARE hash is een weigering, geen "dan maar overslaan": dat laatste zou
 * een typefout in de catalogus stilzwijgend in "niet verifiëren" laten omslaan — precies de
 * degradatie die de controle waardeloos maakt.
 */
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

/**
 * Hex-gecodeerde SHA-256 van een byte-reeks, via Web Crypto (beschikbaar in de browser, de
 * Tauri-webview én Node ≥ 18 — dus ook headless toetsbaar).
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Installeren vanuit een lokaal ZIP-bestand ──

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

// ── Installeren vanuit een los .js-bestand (simpele extensies) ──

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

        // Vertrouwensvraag vóór élke schrijfactie — zie gateConsent.
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

/**
 * Installeer een extensie uit een ZIP-`Blob` via het volledige install-pad (parse → assets bewaren →
 * opslaan → activeren). Ook gebruikt door `installFromCatalog`/`installFromFile`; los geëxporteerd zodat
 * programmatische installatie (o.a. zelftests) hetzelfde pad kan aanroepen zonder bestandskiezer.
 */
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

    // Overige ZIP-entries (niet main/manifest) bewaren als binaire assets, op naam → bytes. Zo kan
    // een extensie z'n eigen font-bytes leveren via `api.assets.get(...)`. Grootte begrensd (font-
    // assets zijn MB's, maar IndexedDB mag niet volgestampt worden). De parser heeft iedere entry
    // en het totaal al begrensd; hier is alleen nog de expliciete selectie nodig.
    // Null-prototype: een geldige bestandsnaam als "__proto__" mag de assetmap niet muteren.
    const assets: Record<string, Uint8Array> = Object.create(null);
    for (const f of files) {
      if (f === manifestEntry || f === mainEntry) continue;
      assets[f.name] = f.data;
    }
    const hasAssets = Object.keys(assets).length > 0;

    // Vertrouwensvraag — VÓÓR de eerste schrijfactie, en dus ook vóór het deactiveren van een
    // eventuele vorige versie: een weigering mag niets achterlaten en niets kapotmaken.
    if (!await gateConsent(manifest, manifest.id, opts)) return 'declined';

    // Al geïnstalleerd? Eerst deactiveren.
    if (getActivePlugins().has(manifest.id)) {
      await disableExtension(manifest.id);
    }

    await saveExtensionToDb({
      id: manifest.id,
      manifest,
      mainCode,
      enabled: true,
      // Backward-compat: alleen een `assets`-veld schrijven als er echt assets zijn.
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

// ── Extensie verwijderen ──

export async function removeExtension(
  id: string,
  storage: ExtensionStorage = indexedDbExtensionStorage,
): Promise<void> {
  if (getActivePlugins().has(id)) {
    await disableExtension(id, storage);
  }
  // Loopt de activatie nog (status "laden"), dan annuleren: anders activeert en bewaart
  // `enableExtension` haar na de lopende `onLoad` alsnog (audit 2026-09-26).
  cancelPendingEnable(id);

  await storage.remove(id);
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

/** Verwijder een onuitvoerbaar opslagrecord via zijn bewaarde IndexedDB-sleutel. */
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
