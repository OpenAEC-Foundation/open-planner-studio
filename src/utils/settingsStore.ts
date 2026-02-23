import { load, Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

async function getStore(): Promise<Store | null> {
  if (!isTauri()) return null;
  if (!store) {
    store = await load('settings.json');
  }
  return store;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const s = await getStore();
  if (!s) return undefined;
  return await s.get<T>(key) ?? undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const s = await getStore();
  if (!s) return;
  await s.set(key, value);
}

/**
 * Sync a setting from Tauri Store → localStorage on startup.
 * This keeps i18next's synchronous detector working with durable storage.
 */
export async function syncSettingToLocalStorage(storeKey: string, localStorageKey: string): Promise<void> {
  const value = await getSetting<string>(storeKey);
  if (value) {
    localStorage.setItem(localStorageKey, value);
  }
}

/**
 * Save a locale to both Tauri Store (durable) and localStorage (sync cache).
 */
export async function saveLocale(code: string): Promise<void> {
  localStorage.setItem('ops-locale', code);
  await setSetting('locale', code);
}

/**
 * Save a theme to both Tauri Store (durable) and localStorage (sync cache).
 */
export async function saveTheme(theme: string): Promise<void> {
  localStorage.setItem('ops-theme', theme);
  await setSetting('theme', theme);
}

/**
 * Load saved theme from Tauri Store → localStorage, then apply to document.
 * Call once at app startup.
 */
export async function initTheme(): Promise<string> {
  await syncSettingToLocalStorage('theme', 'ops-theme');
  const saved = localStorage.getItem('ops-theme');
  return saved || 'dark';
}
