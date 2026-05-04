import type { WeekStartDay, UITheme } from '@/state/slices/types';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const raw = localStorage.getItem(`ops-${key}`);
  if (raw === null) return undefined;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(`ops-${key}`, typeof value === 'string' ? value : JSON.stringify(value));
}

export async function syncSettingToLocalStorage(storeKey: string, localStorageKey: string): Promise<void> {
  const value = localStorage.getItem(`ops-${storeKey}`);
  if (value) {
    localStorage.setItem(localStorageKey, value);
  }
}

export async function saveLocale(code: string): Promise<void> {
  localStorage.setItem('ops-locale', code);
}

export async function saveTheme(theme: UITheme): Promise<void> {
  localStorage.setItem('ops-theme', theme);
}

// Migration map: 7 oude thema's → 3 nieuwe (post stylebook alignment)
// 'default' was de warme bruine + amber dark theme; nu de canonical 'dark'
// 'light' blijft 'light' (light kleuren krijgen OpenAEC token-update in globals.css)
// 'highContrast' wordt 'high-contrast' (consistente naamgeving)
// Alle andere oude thema's vallen terug op 'dark'
const THEME_MIGRATION: Record<string, UITheme> = {
  'default': 'dark',
  'light': 'light',
  'dark': 'dark',
  'blue': 'dark',
  'amber-navy': 'dark',
  'warm-ember': 'dark',
  'highContrast': 'high-contrast',
  'high-contrast': 'high-contrast',
};

export async function initTheme(): Promise<UITheme> {
  const saved = localStorage.getItem('ops-theme');
  if (!saved) return 'dark';

  const migrated = THEME_MIGRATION[saved] ?? 'dark';
  if (migrated !== saved) {
    // Persisteer de migratie zodat dit een eenmalige conversie is
    localStorage.setItem('ops-theme', migrated);
  }
  return migrated;
}

export interface PersistedZoomSettings {
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
}

export async function loadZoomSettings(): Promise<Partial<PersistedZoomSettings>> {
  const result: Partial<PersistedZoomSettings> = {};
  const qh = await getSetting<boolean>('enableQuarterHourZoom');
  const week = await getSetting<WeekStartDay>('weekStartDay');
  if (typeof qh === 'boolean') result.enableQuarterHourZoom = qh;
  if (week === 'monday' || week === 'sunday') result.weekStartDay = week;
  return result;
}

export async function saveZoomSettings(settings: Partial<PersistedZoomSettings>): Promise<void> {
  if (settings.enableQuarterHourZoom !== undefined) await setSetting('enableQuarterHourZoom', settings.enableQuarterHourZoom);
  if (settings.weekStartDay !== undefined) await setSetting('weekStartDay', settings.weekStartDay);
}

export async function loadDebugTerminalEnabled(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('debugTerminalEnabled');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveDebugTerminalEnabled(value: boolean): Promise<void> {
  await setSetting('debugTerminalEnabled', value);
}
