// Anti-thema-flits (issue #61): zet het thema op <html> vóór de eerste paint, als `data-theme` én
// `data-oa-theme` (OpenAEC-tokens 0.4).
//
// Een klassiek script (geen module), dat `index.html` blokkerend in <head> laadt. Bewust geen inline
// script meer (#818): de Content-Security-Policy van de SuperCloud laat alleen de eigen bundel toe.
// Het staat in `public/`, dus Vite kopieert het ongewijzigd en zet het `src`-pad in `index.html` op
// de `base` van de bouw (dev, `npm run build`, Tauri, en de platformbouw met `--base /pad/` of `./`),
// net als het icoon.
//
// Zonder dit valt de eerste paint op de :root-default (dark) en klapt de app pas ná de React-mount
// (App.tsx → data-theme-effect) naar het gekozen thema: een zichtbare flits bij Light. Dit script is
// bewust een minimale spiegel van `initTheme()` (src/utils/settingsStore.ts): eerst het `thema` van
// de host als de tool ingebed draait (#818, `siteHostTheme()` in siteHostPreferences.ts: alleen
// 'light' of 'dark', eerst het eigen venster, dan een same-origin parent, nooit in Tauri), anders
// dezelfde sleutel (`ops-theme`), dezelfde 7→3-legacy-mapping en dezelfde default 'dark'.
// `initTheme()` blijft de bron van waarheid en persisteert de migratie daarna alsnog; App.tsx zet
// het attribuut opnieuw (idempotent). `tests/planning/check-theme-premirror.ts` voert dit script uit
// en vergelijkt het met de TS-kant.
// De 'system'-voorkeur wordt hier net zo opgelost als in `resolveUITheme` (src/utils/theme.ts):
// prefers-color-scheme → 'dark' of 'light'. Zonder dat zou juist de systeemvolger de flits
// terugkrijgen die dit script wegneemt.
(function () {
  var theme = 'dark';
  var hostThemes = ['light', 'dark'];
  var hostTheme = null;
  try {
    if (!('__TAURI_INTERNALS__' in window)) {
      var hosts = [];
      try { hosts.push(window.openaecHost); } catch (_e) { /* niets */ }
      try {
        if (window.parent && window.parent !== window) hosts.push(window.parent.openaecHost);
      } catch (_e) { /* cross-origin parent: geen host */ }
      for (var i = 0; i < hosts.length && hostTheme === null; i++) {
        var host = hosts[i];
        if (typeof host !== 'object' || host === null) continue;
        var value;
        try { value = host.thema; } catch (_e) { value = undefined; }
        if (hostThemes.indexOf(value) !== -1) hostTheme = value;
      }
    }
  } catch (_e) { /* vreemde omgeving: geen host */ }
  if (hostTheme !== null) {
    theme = hostTheme;
  } else {
    try {
      var map = {
        'default': 'dark', 'light': 'light', 'dark': 'dark', 'blue': 'dark',
        'amber-navy': 'dark', 'warm-ember': 'dark',
        'highContrast': 'high-contrast', 'high-contrast': 'high-contrast',
        'system': 'system',
      };
      var saved = localStorage.getItem('ops-theme');
      if (saved && Object.prototype.hasOwnProperty.call(map, saved)) theme = map[saved];
      if (theme === 'system') {
        var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = dark ? 'dark' : 'light';
      }
    } catch (_e) { /* localStorage geblokkeerd ⇒ default dark, net als initTheme() */ }
  }
  // Alleen bereikbaar als matchMedia ontbreekt of gooit; 'light' spiegelt exact wat
  // `resolveUITheme('system', false)` in TS doet, zodat er ook dán geen flits ontstaat.
  if (theme === 'system') theme = 'light';
  // Spiegel van `OA_THEME_FOR` (src/utils/theme.ts): de brugblokken in globals.css hangen aan
  // `data-oa-theme`, dus zonder dit attribuut flitst licht alsnog donker.
  var oaTheme = { 'dark': 'dark', 'light': 'light', 'high-contrast': 'high-contrast-dark' };
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-oa-theme', oaTheme[theme] || 'dark');
})();
