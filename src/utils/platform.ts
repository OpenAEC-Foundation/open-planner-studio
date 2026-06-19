/**
 * Runtime-platformdetectie: de naad tussen de web-build en de Tauri-desktopschil.
 *
 * Tauri injecteert `__TAURI_INTERNALS__` op `window`; in een kale browser ontbreekt
 * het. Code die `@tauri-apps/*` aanraakt moet hier eerst doorheen (dynamische import
 * binnen een `isTauri()`-tak), anders breekt de web-build.
 */
export const isTauri = (): boolean => '__TAURI_INTERNALS__' in window;
