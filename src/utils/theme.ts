import type { ResolvedUITheme, UITheme } from '@/state/slices/types';

/**
 * Thema-resolutie voor de "Systeem"-voorkeur (volg het OS/browser-kleurschema).
 *
 * `UITheme` is de VOORKEUR van de gebruiker en kent daarnaast `'system'`. Die waarde bestaat
 * bewust niet als `data-theme`-waarde: `globals.css` heeft alleen `[data-theme="dark"]`,
 * `[data-theme="light"]` en `[data-theme="high-contrast"]`-blokken. Alles wat een thema
 * TOEPAST (het `<html data-theme>`-attribuut, de Canvas-2D-renderers) werkt daarom met
 * `ResolvedUITheme`; alleen de settings-UI en de opslag werken met de voorkeur zelf.
 *
 * De module is bewust puur + zonder React: hij wordt zowel door `App.tsx` als door de
 * pre-paint-spiegel in `index.html` (in JS-vorm) en door de headless tests gebruikt.
 */
export type { ResolvedUITheme };

/** De mediaquery die "het systeem staat op donker" betekent. Eén constante, zodat de listener,
 *  de detectie en de tests niet uit elkaar kunnen lopen. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** Zet de voorkeur + de actuele systeemstand om in het thema dat daadwerkelijk getekend wordt.
 *  `'high-contrast'` blijft een expliciete keuze: het OS-kleurschema kent alleen licht/donker. */
export function resolveUITheme(preference: UITheme, systemPrefersDark: boolean): ResolvedUITheme {
  if (preference !== 'system') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Leest de huidige systeemstand. Geen `matchMedia` (headless Node, oude webview) ⇒ `false`, wat
 *  overeenkomt met wat de CSS-spec zegt: geen voorkeur = de donkerquery matcht niet. */
export function detectSystemPrefersDark(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(SYSTEM_DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** De verouderde `MediaQueryList`-listener-API. WKWebView van vóór macOS 11 (Safari 13) kent
 *  `addEventListener` op een MediaQueryList nog niet, en `tauri.conf.json` legt geen
 *  `minimumSystemVersion` vast — dan geldt Tauri's default (10.13). Zonder deze terugval zou het
 *  thema daar alleen bij het opstarten kloppen en niet live meebewegen. */
interface LegacyMediaQueryList {
  addListener(handler: (e: MediaQueryListEvent) => void): void;
  removeListener(handler: (e: MediaQueryListEvent) => void): void;
}

/** Abonneert op wijzigingen van het systeemkleurschema. Levert een opzegger; zonder `matchMedia`
 *  is dat een no-op. Wordt ALTIJD geabonneerd, ook als de voorkeur niet 'system' is — zo staat de
 *  waarde in de store al klaar op het moment dat de gebruiker naar 'Systeem' schakelt. */
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
