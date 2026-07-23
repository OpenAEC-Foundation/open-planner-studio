/**
 * Release-vergelijking voor de "Je bent net geüpdatet"-dialoog.
 *
 * Bevat pure, headless-testbare functies (detectie, asset-keuze, dagen-tussen, vergelijking) plus
 * één fetch-wrapper (`fetchReleaseComparison`, zie onder) die de GitHub Releases-API bevraagt.
 * Desktop-only qua gebruik, maar de pure functies hebben geen Tauri-afhankelijkheid.
 */
import type { InstallKind } from './updaterService';

const REPO = 'OpenAEC-Foundation/open-planner-studio';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;

/** Minimale vorm van een GitHub-release-asset die we gebruiken. */
export interface GhAsset {
  name: string;
  size: number;
}

/** Minimale vorm van een GitHub-release die we gebruiken. */
export interface GhRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
}

/** Resultaat dat de dialoog toont. Elk veld kan `null` zijn als de brondata ontbrak. */
export interface ReleaseComparison {
  currentBody: string;
  daysBetween: number | null;
  sizeDeltaBytes: number | null;
  currentSizeBytes: number | null;
}

/** OS-namen zoals `@tauri-apps/plugin-os` `platform()` ze teruggeeft (subset die we nodig hebben). */
export type OsName = 'linux' | 'windows' | 'macos' | string;

/**
 * Pure detectie: is de app zojuist geüpdatet? Geeft de versiesprong terug, of `null`.
 * - `stored` ontbreekt (verse installatie) → `null` (niets tonen).
 * - `stored === current` (normale start) → `null`.
 * - anders → `{ from: stored, to: current }` (ook bij downgrade).
 */
export function detectJustUpdated(
  stored: string | undefined,
  current: string,
): { from: string; to: string } | null {
  if (!stored) return null;
  if (stored === current) return null;
  return { from: stored, to: current };
}

/** Normaliseer een versie/tag door een eventuele `v`-prefix te strippen. */
function normalizeVersion(v: string): string {
  return v.replace(/^v/i, '');
}

/**
 * Kies de installer-asset die bij dit install-type + OS hoort, voor de grootteweergave.
 * Retourneert `null` als er geen passende asset is (bv. snap, of asset ontbreekt in de release).
 * `.sig`-bestanden worden altijd genegeerd.
 */
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
      return null; // snap-installs krijgen geen GitHub-installer-asset
    case 'native':
      if (os === 'windows') return endsWith('-setup.exe');
      if (os === 'macos') return endsWith('.dmg');
      return null;
    default:
      return null;
  }
}

/** Hele dagen tussen twee ISO-datums (previous → current). `null` bij een ongeldige datum. */
export function daysBetween(previousIso: string, currentIso: string): number | null {
  const prev = Date.parse(previousIso);
  const cur = Date.parse(currentIso);
  if (Number.isNaN(prev) || Number.isNaN(cur)) return null;
  const ms = cur - prev;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Vind in een (nieuw→oud gesorteerde) releaselijst de huidige release (op tag) en de release
 * die daarvóór is uitgebracht (eerste niet-draft/niet-prerelease met een oudere `published_at`).
 */
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

/**
 * Pure vergelijking: bouw het `ReleaseComparison`-resultaat uit de gevonden releases.
 * Ontbrekende data → het betreffende veld wordt `null` (nette degradatie in de UI).
 */
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
    currentBody: current.body ?? '',
    daysBetween: dayCount,
    sizeDeltaBytes,
    currentSizeBytes,
  };
}

export { RELEASES_API };
