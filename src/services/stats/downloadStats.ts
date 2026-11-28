import { isRecord } from '@/utils/guards';
import { GITHUB_REPO } from '@/services/githubRepo';

export const DOWNLOAD_STATS_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/stats/downloads.json`;
export const DOWNLOAD_STATS_CACHE_MS = 30 * 60 * 1000;
export const DOWNLOAD_STATS_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'ops-downloadStats';

export type StatsOs = 'windows' | 'macos' | 'linux';
export const STATS_OS_ORDER: readonly StatsOs[] = ['windows', 'macos', 'linux'];

export interface OsBucket {
  install: number;
  update: number;
  both: number;
  byKind: Record<string, number>;
}

export interface ReleaseStats {
  tag: string;
  publishedAt: string | null;
  prerelease: boolean;
  os: Record<StatsOs, OsBucket>;
  polls: number;
}

export interface DownloadStats {
  schemaVersion: typeof DOWNLOAD_STATS_SCHEMA_VERSION;
  generatedAt: string;
  releases: ReleaseStats[];
  totals: Record<StatsOs, OsBucket>;
  polls: number;
}

export type ParseResult = { ok: true; value: DownloadStats } | { ok: false; error: string };

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function parseBucket(v: unknown, where: string): OsBucket | string {
  if (!isRecord(v)) return `${where}: geen object`;
  const byKind: Record<string, number> = {};
  if (isRecord(v.byKind)) {
    for (const [k, n] of Object.entries(v.byKind)) byKind[k] = num(n);
  }
  return { install: num(v.install), update: num(v.update), both: num(v.both), byKind };
}

function parseOsMap(v: unknown, where: string): Record<StatsOs, OsBucket> | string {
  if (!isRecord(v)) return `${where}: geen object`;
  const out = {} as Record<StatsOs, OsBucket>;
  for (const os of STATS_OS_ORDER) {
    const b = parseBucket(v[os], `${where}.${os}`);
    if (typeof b === 'string') return b;
    out[os] = b;
  }
  return out;
}

export function parseDownloadStats(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, error: 'geen object' };
  if (input.schemaVersion !== DOWNLOAD_STATS_SCHEMA_VERSION) {
    return { ok: false, error: `onbekende schemaVersion ${String(input.schemaVersion)}` };
  }
  if (typeof input.generatedAt !== 'string' || Number.isNaN(Date.parse(input.generatedAt))) {
    return { ok: false, error: 'generatedAt ontbreekt of is geen datum' };
  }
  const totals = parseOsMap(input.totals, 'totals');
  if (typeof totals === 'string') return { ok: false, error: totals };
  if (!Array.isArray(input.releases)) return { ok: false, error: 'releases is geen lijst' };
  const releases: ReleaseStats[] = [];
  for (const [i, r] of input.releases.entries()) {
    if (!isRecord(r) || typeof r.tag !== 'string' || r.tag === '') return { ok: false, error: `releases[${i}]: tag ontbreekt` };
    const os = parseOsMap(r.os, `releases[${i}].os`);
    if (typeof os === 'string') return { ok: false, error: os };
    releases.push({
      tag: r.tag,
      publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : null,
      prerelease: r.prerelease === true,
      os,
      polls: num(r.polls),
    });
  }
  return {
    ok: true,
    value: { schemaVersion: DOWNLOAD_STATS_SCHEMA_VERSION, generatedAt: input.generatedAt, releases, totals, polls: num(input.polls) },
  };
}

export function userDownloads(b: OsBucket): number {
  return b.install + b.both;
}

export function totalDownloads(stats: DownloadStats): number {
  return STATS_OS_ORDER.reduce((sum, os) => sum + userDownloads(stats.totals[os]), 0);
}

export interface StatsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CachedStats {
  fetchedAt: number;
  stats: DownloadStats;
}

function defaultStorage(): StatsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readCachedStats(storage: StatsStorage | null = defaultStorage()): CachedStats | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'number') return null;
    const stats = parseDownloadStats(parsed.stats);
    return stats.ok ? { fetchedAt: parsed.fetchedAt, stats: stats.value } : null;
  } catch {
    return null;
  }
}

function writeCachedStats(storage: StatsStorage | null, entry: CachedStats): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
  }
}

export function isFresh(entry: CachedStats, now: number): boolean {
  return now - entry.fetchedAt < DOWNLOAD_STATS_CACHE_MS;
}

export interface LoadOptions {
  force?: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
  storage?: StatsStorage | null;
  url?: string;
}

export interface LoadResult extends CachedStats {
  fromCache: boolean;
}

const inflight = new Map<string, Promise<LoadResult>>();

export async function loadDownloadStats(opts: LoadOptions = {}): Promise<LoadResult> {
  const now = opts.now ?? Date.now();
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const cached = readCachedStats(storage);
  if (cached && !opts.force && isFresh(cached, now)) return { ...cached, fromCache: true };

  const url = opts.url ?? DOWNLOAD_STATS_URL;
  const running = inflight.get(url);
  if (running) return running;
  const p = fetchAndCache(url, now, storage, opts.fetchImpl ?? fetch).finally(() => { inflight.delete(url); });
  inflight.set(url, p);
  return p;
}

async function fetchAndCache(url: string, now: number, storage: StatsStorage | null, fetchImpl: typeof fetch): Promise<LoadResult> {
  const res = await fetchImpl(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseDownloadStats(await res.json());
  if (!parsed.ok) throw new Error(parsed.error);
  const entry: CachedStats = { fetchedAt: now, stats: parsed.value };
  writeCachedStats(storage, entry);
  return { ...entry, fromCache: false };
}
