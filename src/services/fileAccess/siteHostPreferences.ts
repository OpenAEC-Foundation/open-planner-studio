/**
 * Presentatie van de host (#818): het thema en de instellingenopslag die een site op
 * `window.openaecHost` kan zetten, naast de taal (`siteLanguageHints` in `siteHost.ts`).
 *
 * Alleen lezen, zonder store, i18n of `settingsStore`: `settingsStore.ts` importeert deze module
 * (het sessiethema), dus een import de andere kant op zou een kring maken.
 *
 * - `thema`: `'light'` of `'dark'`. Een andere waarde telt als "geen thema".
 * - `settings`: `get`, `set` en `delete`, elk met een Promise. De tool bewaart daar zijn
 *   `ops-`-instellingen (zie `siteHostSettings.ts`).
 * - Het event `openaec-host-preferences` op het venster van de host meldt dat `taal` of `thema` op
 *   hetzelfde object veranderde.
 */
import { candidateHosts } from './siteHost';

/** Event waarmee de site meldt dat `taal` of `thema` op de host veranderde (#818). */
export const SITE_HOST_PREFERENCES_EVENT = 'openaec-host-preferences';

/** De thema's die een host kan doorgeven. Het pre-paint-script (`public/theme-prepaint.js`) heeft een
 *  handkopie; `tests/planning/check-theme-premirror.ts` bewaakt dat ze gelijk blijven. */
export const SITE_HOST_THEMES = ['light', 'dark'] as const;
export type SiteHostTheme = typeof SITE_HOST_THEMES[number];

/** De instellingenopslag van de host. */
export interface SiteHostSettings {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

/** Lees één veld van de host. Een getter van een vreemd venster kan gooien; dat telt als "niets". */
function field(host: Record<string, unknown>, name: string): unknown {
  try {
    return host[name];
  } catch {
    return undefined;
  }
}

/** Is `value` een `SiteHostSettings` (drie functies)? */
export function isSiteHostSettings(value: unknown): value is SiteHostSettings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.get === 'function' && typeof s.set === 'function' && typeof s.delete === 'function';
}

/** Het thema van de eerste host die een geldig thema geeft, anders `null`. Kijkt op het moment van
 *  aanroepen; desktop (Tauri) heeft nooit een host. */
export function siteHostTheme(): SiteHostTheme | null {
  for (const host of candidateHosts()) {
    const theme = field(host, 'thema');
    if ((SITE_HOST_THEMES as readonly unknown[]).includes(theme)) return theme as SiteHostTheme;
  }
  return null;
}

/** De instellingenopslag van de eerste host die er een geeft, anders `null`. */
export function siteHostSettings(): SiteHostSettings | null {
  for (const host of candidateHosts()) {
    const settings = field(host, 'settings');
    if (isSiteHostSettings(settings)) return settings;
  }
  return null;
}
