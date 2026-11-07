/**
 * De backend voor bestanden op de site (issue #309). Het contract zelf staat in `siteHost.ts`.
 *
 * Afspraken die de rest van de app aangaan:
 *  - Deze module houdt GEEN toestand bij. Welke versie een document als basis heeft, staat op het
 *    document zelf (`DocumentPayload.siteFileVersion`); de aanroeper geeft hem mee en krijgt de nieuwe
 *    versie terug. Zo hebben twee tabbladen op hetzelfde bestand elk hun eigen basis.
 *  - Een FOUT van de site (ook een conflict) gooit hier gewoon door. De aanroeper meldt hem; er is
 *    geen stille terugval naar een andere opslagplek, want dan belandt werk ongemerkt ergens anders.
 *  - Een antwoord dat het contract niet volgt (geen versie, een ander id) is ook een fout: anders valt
 *    de conflictcontrole stil uit.
 *  - Schrijven loopt alleen via `saveSiteFileVersion`/`saveNewSiteFile`, vanuit de opslaanroute van de
 *    store. De algemene `FileRef`-functies in `fileAccess/index.ts` schrijven nooit naar de site.
 */
import type { OpenDialogOpts, OpenedFile } from './index';
import { getSiteStorage, type SiteFileInfo, type SiteStorage, type SiteVersionInfo } from './siteHost';
import { isConflictCopyAnswer } from './superCloudHost';
import { extensionOf } from '@/utils/filePath';

/** MIME-type van een opgeslagen IFC-bestand (de tool schrijft altijd IFC). */
export const SITE_SAVE_MIME = 'application/x-step';

// ── Inhoud omzetten ────────────────────────────────────────────────────────────────────────────

type SiteData = Blob | ArrayBuffer | Uint8Array | string;

/**
 * Inhoud van de site als bytes. Bewust zonder `instanceof`: een host op `window.parent` maakt zijn
 * `Uint8Array`/`ArrayBuffer`/`Blob` in een ANDER venster, en `instanceof` geeft dan `false`.
 * `ArrayBuffer.isView` en `Object.prototype.toString` werken wel over vensters heen.
 */
export async function siteDataToBytes(data: SiteData): Promise<Uint8Array> {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') return new Uint8Array(data as ArrayBuffer);
  if (data && typeof (data as Blob).arrayBuffer === 'function') return new Uint8Array(await (data as Blob).arrayBuffer());
  throw new Error('De site leverde inhoud in een onbekende vorm.');
}

/** Inhoud van de site als tekst: UTF-8, zoals `File.text()` (een BOM aan het begin valt weg). */
export async function siteDataToText(data: SiteData): Promise<string> {
  if (typeof data === 'string') return data;
  return new TextDecoder('utf-8').decode(await siteDataToBytes(data));
}

function requireStorage(): SiteStorage {
  const storage = getSiteStorage();
  if (!storage) throw new Error('Er is geen opslag via de site beschikbaar.');
  return storage;
}

/** Een niet-lege tekst uit een antwoord van de site, of `null`. */
function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// ── Openen ─────────────────────────────────────────────────────────────────────────────────────

/** Een geopend site-bestand: de gewone `OpenedFile` plus de info en de versie van de site. */
export interface OpenedSiteFile extends OpenedFile {
  file: SiteFileInfo;
  /** De gelezen versie als het de NIEUWSTE was en het bestand schrijfbaar is (de basis voor de
   *  volgende opslag), anders `null`. */
  version: string | null;
  /** De site gaf de nieuwste versie als alleen-lezen (`readOnly: true`, #818): geen ref en geen basis. */
  readOnly: boolean;
}

/**
 * Open een bestand van de site. Zonder `version`: de nieuwste versie, met een site-ref als opslagdoel
 * en de gelezen versie als basis (het contract eist die versie; zonder versie gooit dit). Met
 * `version`: die (oudere) versie, ZONDER ref en zonder basis — een oudere versie mag nooit het
 * opslagdoel worden. Geeft de site de nieuwste versie als alleen-lezen (`readOnly: true`, #818), dan
 * ook geen ref en geen basis (`readOnly` in het antwoord). Gooit bij een fout van de site of zonder
 * opslag.
 */
export async function openSiteFile(id: string, opts?: OpenDialogOpts & { version?: string }): Promise<OpenedSiteFile> {
  const requested = opts?.version;
  const answer = await requireStorage().open(id, requested);
  const file: SiteFileInfo = { ...answer?.file, id, name: nonEmpty(answer?.file?.name) ?? id };
  const readOnly = requested === undefined && answer?.readOnly === true;
  let version: string | null = null;
  if (requested === undefined && !readOnly) {
    version = nonEmpty(answer?.file?.version);
    if (!version) throw new Error('De site gaf bij het openen geen versie van het bestand terug.');
  }
  const ref = requested === undefined && !readOnly ? { kind: 'site' as const, id } : null;
  if ((opts?.binaryExtensions ?? []).includes(extensionOf(file.name))) {
    return { name: file.name, content: '', bytes: await siteDataToBytes(answer.data), ref, file, version, readOnly };
  }
  return { name: file.name, content: await siteDataToText(answer.data), ref, file, version, readOnly };
}

/** De lijst van bestanden die de tool kan openen. De site MAG op `extensions` filteren; doet ze dat
 *  niet, dan filtert de tool zelf, zodat de lijst nooit bestanden toont die niet te openen zijn.
 *  Gooit bij een fout of zonder opslag. */
export async function listSiteFiles(extensions: string[]): Promise<SiteFileInfo[]> {
  const files = await requireStorage().list({ extensions });
  if (!Array.isArray(files)) return [];
  const wanted = new Set(extensions.map((e) => e.toLowerCase()));
  return files.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string'
    && (wanted.size === 0 || wanted.has(extensionOf(f.name))));
}

/** De versies van één bestand, in de volgorde van de site. Gooit bij een fout of zonder opslag. */
export async function listSiteVersions(id: string): Promise<SiteVersionInfo[]> {
  const versions = await requireStorage().versions(id);
  return Array.isArray(versions) ? versions.filter((v) => v && typeof v.version === 'string') : [];
}

// ── Opslaan ────────────────────────────────────────────────────────────────────────────────────

/** Wat een geslaagde opslag oplevert: het bestand en de net geschreven versie (de nieuwe basis). */
export interface SavedSiteFile {
  id: string;
  name: string;
  version: string;
  /** De SuperCloud-vorm bewaarde het werk na een conflict in een KOPIE (#818): `id` en `name` zijn
   *  die van de kopie. Alleen bij een nieuwe versie (`saveSiteFileVersion`); anders afwezig. */
  conflictCopy?: true;
}

/**
 * Controleer het antwoord van `save`: een `id` (bij een nieuwe versie hetzelfde `id`) en een `version`.
 * Ontbreekt er iets, dan is dat een fout — de opslag telt dan niet als geslaagd. Een ander `id` mag
 * alleen als de SuperCloud-adapter het antwoord als conflictkopie markeerde; bij de `storage`-vorm
 * blijft het een fout.
 */
function checkedSaveAnswer(answer: SiteFileInfo | null | undefined, name: string, expectedId?: string): SavedSiteFile {
  const id = nonEmpty(answer?.id);
  if (!id) throw new Error('De site gaf na het opslaan geen bestand-id terug.');
  const conflictCopy = expectedId !== undefined && id !== expectedId && isConflictCopyAnswer(answer);
  if (expectedId !== undefined && id !== expectedId && !conflictCopy) {
    throw new Error(`De site gaf na het opslaan een ander bestand-id terug (${id} in plaats van ${expectedId}).`);
  }
  const version = nonEmpty(answer?.version);
  if (!version) throw new Error('De site gaf na het opslaan geen versie terug.');
  return { id, name: nonEmpty(answer?.name) ?? name, version, ...(conflictCopy ? { conflictCopy: true as const } : {}) };
}

/** Sla een NIEUW bestand op de site op (geen `id`). Gooit bij een fout of een onvolledig antwoord. */
export async function saveNewSiteFile(name: string, content: string): Promise<SavedSiteFile> {
  const answer = await requireStorage().save({ name, data: new Blob([content], { type: SITE_SAVE_MIME }) });
  return checkedSaveAnswer(answer, name);
}

/**
 * Schrijf een nieuwe versie van een bestaand site-bestand. `baseVersion` is de basis van het DOCUMENT
 * dat opslaat (`DocumentPayload.siteFileVersion`); `null` stuurt geen basis mee. Geeft de net
 * geschreven versie terug: die wordt de nieuwe basis van dat document. Een fout van de site (ook
 * `code === 'conflict'`) of een onvolledig antwoord gooit. Bij de SuperCloud-vorm kan het antwoord
 * een conflictkopie zijn (`conflictCopy`, met het id en de naam van de kopie).
 */
export async function saveSiteFileVersion(
  id: string,
  name: string,
  content: string,
  baseVersion: string | null,
): Promise<SavedSiteFile> {
  const answer = await requireStorage().save({
    id,
    name,
    data: new Blob([content], { type: SITE_SAVE_MIME }),
    ...(baseVersion ? { baseVersion } : {}),
  });
  return checkedSaveAnswer(answer, name, id);
}
