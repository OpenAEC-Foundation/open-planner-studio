import { PLATFORM_BUILD } from '@/utils/buildFlags';
import { isSuperCloudHost, superCloudStorage, type HostVersion } from './superCloudHost';

export interface HostFileRef { id: string; name: string; version: HostVersion }

export interface SiteFileInfo {
  id: string;
  name: string;
  version?: string;
  modified?: string;
  size?: number;
}

export interface SiteVersionInfo {
  version: string;
  modified?: string;
  author?: string;
  label?: string;
}

export interface SiteStorage {
  list(query?: { extensions?: string[] }): Promise<SiteFileInfo[]>;
  open(id: string, version?: string): Promise<{ file: SiteFileInfo; data: Blob | ArrayBuffer | Uint8Array | string; readOnly?: boolean }>;
  save(request: { id?: string; name: string; data: Blob; baseVersion?: string }): Promise<SiteFileInfo>;
  versions(id: string): Promise<SiteVersionInfo[]>;
}

export interface SiteHostSettings {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export interface OpenAECHost {
  storage?: SiteStorage;
  open?: (id: string, version?: HostVersion) => Promise<HostFileRef & { readOnly: boolean; bytes: ArrayBuffer | Uint8Array }>;
  save?: (bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: HostVersion }) => Promise<HostFileRef>;
  list?: () => Promise<{ id: string; name: string; modified: string }[]>;
  versions?: (id: string) => Promise<{ version: HostVersion; modified: string; author?: string }[]>;
  initialFileId?: string;
  taal?: string;
  thema?: string;
  settings?: SiteHostSettings;
  skipWelcome?: boolean;
}

export const SITE_HOST_READY_EVENT = 'openaec-host-ready';

export const SITE_CONFLICT_CODE = 'conflict';

export const SITE_NOT_FOUND_CODE = 'not-found';

declare global {
  interface Window {
    openaecHost?: unknown;
  }
}

export function isSiteStorage(value: unknown): value is SiteStorage {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.list === 'function' && typeof s.open === 'function'
    && typeof s.save === 'function' && typeof s.versions === 'function';
}

function readHost(read: () => unknown): Record<string, unknown> | null {
  try {
    const host = read();
    return typeof host === 'object' && host !== null ? host as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function candidateHosts(): Record<string, unknown>[] {
  if (typeof window === 'undefined') return [];
  if ('__TAURI_INTERNALS__' in window) return [];
  const hosts: Record<string, unknown>[] = [];
  const own = readHost(() => window.openaecHost);
  if (own) hosts.push(own);
  const parent = readHost(() => {
    const p = window.parent;
    return p && p !== window ? p.openaecHost : undefined;
  });
  if (parent) hosts.push(parent);
  return hosts;
}

function storageOf(host: Record<string, unknown>): SiteStorage | null {
  if (isSiteStorage(host.storage)) return host.storage;
  if (isSuperCloudHost(host)) return superCloudStorage(host);
  return null;
}

export function getSiteStorage(): SiteStorage | null {
  for (const host of candidateHosts()) {
    const storage = storageOf(host);
    if (storage) return storage;
  }
  return null;
}

export function siteStorageAvailable(): boolean {
  return getSiteStorage() !== null;
}

export function siteInitialFileId(): string | null {
  for (const host of candidateHosts()) {
    if (!isSiteStorage(host.storage) && !isSuperCloudHost(host)) continue;
    const id = host.initialFileId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  return null;
}

export function runsEmbedded(): boolean {
  return PLATFORM_BUILD || candidateHosts().length > 0;
}

export function siteLanguageHints(): string[] {
  if (typeof window === 'undefined') return [];
  const hints: string[] = [];
  for (const host of candidateHosts()) {
    if (typeof host.taal === 'string') hints.push(host.taal);
  }
  const lang = readSafely(() => {
    const p = window.parent;
    return p && p !== window ? p.document.documentElement.lang : undefined;
  });
  if (lang) hints.push(lang);
  const hash = readSafely(() => /(?:^#|[?&])taal=([^&]*)/.exec(window.location.hash)?.[1]);
  if (hash) hints.push(readSafely(() => decodeURIComponent(hash)) ?? hash);
  return hints;
}

function readSafely(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function siteErrorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
}

export function isSiteConflict(err: unknown): boolean {
  return siteErrorCode(err) === SITE_CONFLICT_CODE;
}

export function isSiteNotFound(err: unknown): boolean {
  return siteErrorCode(err) === SITE_NOT_FOUND_CODE;
}

export function siteHostWindows(): Window[] {
  if (typeof window === 'undefined' || '__TAURI_INTERNALS__' in window) return [];
  const windows: Window[] = [window];
  try {
    const p = window.parent;
    if (p && p !== window && typeof p.addEventListener === 'function') windows.push(p);
  } catch {
  }
  return windows;
}

export function siteErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}
