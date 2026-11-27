import type { ResolvedUITheme, UITheme } from '@/state/slices/types';

export type { ResolvedUITheme };

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveUITheme(preference: UITheme, systemPrefersDark: boolean): ResolvedUITheme {
  if (preference !== 'system') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}

export type OAThemeId = 'light' | 'dark' | 'high-contrast-dark';
export const OA_THEME_FOR = {
  'dark': 'dark',
  'light': 'light',
  'high-contrast': 'high-contrast-dark',
} as const satisfies Record<ResolvedUITheme, OAThemeId>;

export function applyThemeAttributes(el: Element, theme: ResolvedUITheme): void {
  el.setAttribute('data-theme', theme);
  el.setAttribute('data-oa-theme', OA_THEME_FOR[theme]);
}

export function detectSystemPrefersDark(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(SYSTEM_DARK_QUERY).matches;
  } catch {
    return false;
  }
}

interface LegacyMediaQueryList {
  addListener(handler: (e: MediaQueryListEvent) => void): void;
  removeListener(handler: (e: MediaQueryListEvent) => void): void;
}

export function subscribeSystemPrefersDark(onChange: (prefersDark: boolean) => void): () => void {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mql = window.matchMedia(SYSTEM_DARK_QUERY);
    const handler = (e: MediaQueryListEvent) => onChange(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    const legacy = mql as unknown as LegacyMediaQueryList;
    if (typeof legacy.addListener !== 'function') return () => {};
    legacy.addListener(handler);
    return () => legacy.removeListener(handler);
  } catch {
    return () => {};
  }
}
