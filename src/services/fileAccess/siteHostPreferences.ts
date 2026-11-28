import { candidateHosts, type SiteHostSettings } from './siteHost';

export type { SiteHostSettings };

export const SITE_HOST_PREFERENCES_EVENT = 'openaec-host-preferences';

export const SITE_HOST_THEMES = ['light', 'dark'] as const;
export type SiteHostTheme = typeof SITE_HOST_THEMES[number];

function field(host: Record<string, unknown>, name: string): unknown {
  try {
    return host[name];
  } catch {
    return undefined;
  }
}

export function isSiteHostSettings(value: unknown): value is SiteHostSettings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.get === 'function' && typeof s.set === 'function' && typeof s.delete === 'function';
}

export function siteHostTheme(): SiteHostTheme | null {
  for (const host of candidateHosts()) {
    const theme = field(host, 'thema');
    if ((SITE_HOST_THEMES as readonly unknown[]).includes(theme)) return theme as SiteHostTheme;
  }
  return null;
}

export function siteHostSettings(): SiteHostSettings | null {
  for (const host of candidateHosts()) {
    const settings = field(host, 'settings');
    if (isSiteHostSettings(settings)) return settings;
  }
  return null;
}
