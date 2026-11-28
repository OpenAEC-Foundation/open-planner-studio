import type { FileData, OpenDialogOpts, OpenedFile } from './index';
import { getSiteStorage, type SiteFileInfo, type SiteStorage, type SiteVersionInfo } from './siteHost';
import { isConflictCopyAnswer } from './superCloudHost';
import { extensionOf } from '@/utils/filePath';
import { bytesBlob, ByteWriteError } from './byteWrite';

export const SITE_SAVE_MIME = 'application/x-step';

type SiteData = Blob | ArrayBuffer | Uint8Array | string;

export async function siteDataToBytes(data: SiteData): Promise<Uint8Array> {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') return new Uint8Array(data as ArrayBuffer);
  if (data && typeof (data as Blob).arrayBuffer === 'function') return new Uint8Array(await (data as Blob).arrayBuffer());
  throw new Error('De site leverde inhoud in een onbekende vorm.');
}

export async function siteDataToText(data: SiteData): Promise<string> {
  if (typeof data === 'string') return data;
  return new TextDecoder('utf-8').decode(await siteDataToBytes(data));
}

function requireStorage(): SiteStorage {
  const storage = getSiteStorage();
  if (!storage) throw new Error('Er is geen opslag via de site beschikbaar.');
  return storage;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface OpenedSiteFile extends OpenedFile {
  file: SiteFileInfo;
  version: string | null;
  readOnly: boolean;
}

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

export async function listSiteFiles(extensions: string[]): Promise<SiteFileInfo[]> {
  const files = await requireStorage().list({ extensions });
  if (!Array.isArray(files)) return [];
  const wanted = new Set(extensions.map((e) => e.toLowerCase()));
  return files.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string'
    && (wanted.size === 0 || wanted.has(extensionOf(f.name))));
}

export async function listSiteVersions(id: string): Promise<SiteVersionInfo[]> {
  const versions = await requireStorage().versions(id);
  return Array.isArray(versions) ? versions.filter((v) => v && typeof v.version === 'string') : [];
}

export interface SiteSourceFile {
  id: string;
  name: string;
  version?: string;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
}

export async function readSiteSourceFile(id: string): Promise<SiteSourceFile> {
  const answer = await requireStorage().open(id);
  const name = nonEmpty(answer?.file?.name) ?? id;
  const version = nonEmpty(answer?.file?.version);
  const data = answer?.data;
  return {
    id, name, ...(version ? { version } : {}),
    text: () => siteDataToText(data),
    bytes: () => siteDataToBytes(data),
  };
}

export async function latestSiteVersion(id: string): Promise<SiteVersionInfo | null> {
  const [latest] = await listSiteVersions(id);
  return latest ?? null;
}

export interface SavedSiteFile {
  id: string;
  name: string;
  version: string;
  conflictCopy?: true;
}

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

export async function saveNewSiteFile(name: string, data: FileData): Promise<SavedSiteFile> {
  const answer = await requireStorage().save({ name, data: new Blob([data as BlobPart], { type: SITE_SAVE_MIME }) });
  return checkedSaveAnswer(answer, name);
}

export async function saveNewSiteFileBytes(name: string, bytes: Uint8Array): Promise<SavedSiteFile> {
  const answer = await requireStorage().save({ name, data: bytesBlob(bytes, SITE_SAVE_MIME) });
  return checkedSaveAnswer(answer, name);
}

export async function saveSiteFileVersionBytes(
  id: string, name: string, bytes: Uint8Array, baseVersion: string | null,
): Promise<SavedSiteFile> {
  if (typeof baseVersion !== 'string' || !baseVersion.length) throw new ByteWriteError('base-version');
  const answer = await requireStorage().save({
    id, name, data: bytesBlob(bytes, SITE_SAVE_MIME), baseVersion,
  });
  return checkedSaveAnswer(answer, name, id);
}

export async function saveSiteFileVersion(
  id: string,
  name: string,
  data: FileData,
  baseVersion: string | null,
): Promise<SavedSiteFile> {
  const answer = await requireStorage().save({
    id,
    name,
    data: new Blob([data as BlobPart], { type: SITE_SAVE_MIME }),
    ...(baseVersion ? { baseVersion } : {}),
  });
  return checkedSaveAnswer(answer, name, id);
}
