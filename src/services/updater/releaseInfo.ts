import type { InstallKind } from './updaterService';
import { isTauri } from '@/utils/platform';
import { GITHUB_REPO } from '@/services/githubRepo';

const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`;

export interface GhAsset {
  name: string;
  size: number;
}

export interface GhRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
}

export interface ReleaseComparison {
  daysBetween: number | null;
  sizeDeltaBytes: number | null;
  currentSizeBytes: number | null;
}

export type OsName = 'linux' | 'windows' | 'macos' | string;

export function detectJustUpdated(
  stored: string | undefined,
  current: string,
  welcomeSeenAtStartup: boolean,
): { from: string | null; to: string } | null {
  if (!stored) return welcomeSeenAtStartup ? { from: null, to: current } : null;
  if (stored === current) return null;
  return { from: stored, to: current };
}

function normalizeVersion(v: string): string {
  return v.replace(/^v/i, '');
}

export function pickInstallerAsset(
  assets: GhAsset[],
  installKind: InstallKind,
  os: OsName,
): GhAsset | null {
  const candidates = assets.filter((a) => !a.name.toLowerCase().endsWith('.sig'));
  const endsWith = (suffix: string) =>
    candidates.find((a) => a.name.toLowerCase().endsWith(suffix.toLowerCase())) ?? null;

  switch (installKind) {
    case 'appimage':
      return endsWith('.appimage');
    case 'deb':
      return endsWith('amd64.deb');
    case 'snap':
      return null;
    case 'native':
      if (os === 'windows') return endsWith('-setup.exe');
      if (os === 'macos') return endsWith('.dmg');
      return null;
    default:
      return null;
  }
}

export function daysBetween(previousIso: string, currentIso: string): number | null {
  const prev = Date.parse(previousIso);
  const cur = Date.parse(currentIso);
  if (Number.isNaN(prev) || Number.isNaN(cur)) return null;
  const ms = cur - prev;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function findCurrentAndPrevious(
  releases: GhRelease[],
  currentVersion: string,
): { current: GhRelease | null; previous: GhRelease | null } {
  const target = normalizeVersion(currentVersion);
  const current =
    releases.find((r) => normalizeVersion(r.tag_name) === target) ?? null;
  if (!current) return { current: null, previous: null };

  const curTime = Date.parse(current.published_at);
  const previous =
    releases
      .filter(
        (r) =>
          !r.draft &&
          !r.prerelease &&
          normalizeVersion(r.tag_name) !== target &&
          Date.parse(r.published_at) < curTime,
      )
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0] ?? null;

  return { current, previous };
}

export function computeComparison(
  current: GhRelease,
  previous: GhRelease | null,
  installKind: InstallKind,
  os: OsName,
): ReleaseComparison {
  const currentAsset = pickInstallerAsset(current.assets, installKind, os);
  const previousAsset = previous
    ? pickInstallerAsset(previous.assets, installKind, os)
    : null;

  const currentSizeBytes = currentAsset ? currentAsset.size : null;
  const sizeDeltaBytes =
    currentAsset && previousAsset ? currentAsset.size - previousAsset.size : null;
  const dayCount = previous ? daysBetween(previous.published_at, current.published_at) : null;

  return {
    daysBetween: dayCount,
    sizeDeltaBytes,
    currentSizeBytes,
  };
}

export { RELEASES_API };

export async function detectOs(): Promise<OsName> {
  if (!isTauri()) return 'linux';
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    return platform() as OsName;
  } catch {
    return 'linux';
  }
}

export async function fetchReleaseComparison(
  currentVersion: string,
  installKind: InstallKind,
): Promise<ReleaseComparison | null> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const releases = (await res.json()) as GhRelease[];
    if (!Array.isArray(releases)) return null;

    const { current, previous } = findCurrentAndPrevious(releases, currentVersion);
    if (!current) return null;

    const os = await detectOs();
    return computeComparison(current, previous, installKind, os);
  } catch {
    return null;
  }
}
